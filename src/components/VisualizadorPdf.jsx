import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Por que este componente desenha o PDF em <canvas> em vez de usar <iframe>:
//
// O WebView do Android (que é o que o app Expo usa para abrir o Vertent-Web)
// NÃO tem leitor de PDF embutido. Um <iframe>/<embed> apontando para um PDF --
// seja uma URL http, seja uma blob: URL -- simplesmente não renderiza nada: a
// área fica BRANCA, sem erro no console. Era exatamente essa a causa da tela
// branca no celular, enquanto no Chrome desktop (que tem leitor próprio) a
// mesma tela funcionava.
//
// A solução compatível com WebView é o próprio JavaScript da página decodificar
// o PDF e desenhar as páginas em canvas -- que todo WebView sabe renderizar.
// Isso é feito com o pdf.js (build "legacy", a mais tolerante com motores
// antigos), carregado sob demanda por <script> a partir de CDN.
//
// O carregamento por CDN segue o padrão que o projeto já usa (public/viewer.html
// carrega o three.js de CDN) e evita adicionar dependência nova ao package.json,
// mexer no bundler ou atualizar qualquer versão existente.
// ---------------------------------------------------------------------------

const PDFJS_VERSAO = "3.11.174";
const MAMMOTH_VERSAO = "1.6.0";

// Duas origens: se a primeira estiver indisponível/bloqueada na rede do
// celular, a segunda é tentada antes de desistir.
const PDFJS_CDNS = [
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSAO}`,
  `https://unpkg.com/pdfjs-dist@${PDFJS_VERSAO}`,
];

const TEMPO_LIMITE_SCRIPT = 20000;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_PASSO = 1.25;

// Vários aparelhos móveis têm limite de ~4096px por lado no canvas. Passar
// disso faz o canvas sair TOTALMENTE BRANCO (sem erro). Por isso a escala
// física é sempre reduzida para caber nesse limite.
const LIMITE_LADO_CANVAS = 4096;

let promessaPdfJs = null;

/**
 * Carrega o pdf.js sob demanda (só quando o usuário abre um documento) e
 * devolve `{ lib, base }`. Nunca lança de forma silenciosa: quem chama trata o
 * erro e mostra mensagem na tela.
 */
function carregarPdfJs() {
  if (typeof window !== "undefined" && window.pdfjsLib && window.pdfjsLib.__vertentBase) {
    return Promise.resolve({ lib: window.pdfjsLib, base: window.pdfjsLib.__vertentBase });
  }
  if (promessaPdfJs) return promessaPdfJs;

  promessaPdfJs = new Promise((resolve, reject) => {
    const tentar = (indice) => {
      if (indice >= PDFJS_CDNS.length) {
        promessaPdfJs = null;
        reject(new Error("Não foi possível carregar o leitor de PDF."));
        return;
      }

      const base = PDFJS_CDNS[indice];
      const script = document.createElement("script");
      let encerrado = false;

      const seguir = (ok) => {
        if (encerrado) return;
        encerrado = true;
        clearTimeout(cronometro);
        if (ok) return;
        script.remove();
        tentar(indice + 1);
      };

      const cronometro = setTimeout(() => seguir(false), TEMPO_LIMITE_SCRIPT);

      script.src = `${base}/legacy/build/pdf.min.js`;
      script.async = true;
      script.onload = () => {
        const lib = window.pdfjsLib;
        if (!lib) {
          seguir(false);
          return;
        }
        try {
          // Se o worker não puder ser criado (WebView restritivo), o próprio
          // pdf.js cai para execução na thread principal -- mais lento, porém
          // ainda funcional. Não é motivo para falhar.
          lib.GlobalWorkerOptions.workerSrc = `${base}/legacy/build/pdf.worker.min.js`;
        } catch (err) {
          console.warn("[PDF] não foi possível configurar o worker:", err);
        }
        lib.__vertentBase = base;
        seguir(true);
        resolve({ lib, base });
      };
      script.onerror = () => seguir(false);

      document.head.appendChild(script);
    };

    tentar(0);
  });

  return promessaPdfJs;
}

const MAMMOTH_CDNS = [
  `https://cdn.jsdelivr.net/npm/mammoth@${MAMMOTH_VERSAO}/mammoth.browser.min.js`,
  `https://unpkg.com/mammoth@${MAMMOTH_VERSAO}/mammoth.browser.min.js`,
];

let promessaMammoth = null;

/**
 * Carrega o mammoth.js sob demanda -- usado quando o documento cadastrado é
 * .docx em vez de PDF (caso do memorial descritivo, que hoje sai em Word).
 * Mesmo padrão do pdf.js: <script> de CDN, com origem reserva.
 */
function carregarMammoth() {
  if (typeof window !== "undefined" && window.mammoth) {
    return Promise.resolve(window.mammoth);
  }
  if (promessaMammoth) return promessaMammoth;

  promessaMammoth = new Promise((resolve, reject) => {
    const tentar = (indice) => {
      if (indice >= MAMMOTH_CDNS.length) {
        promessaMammoth = null;
        reject(new Error("Não foi possível carregar o leitor de Word."));
        return;
      }

      const script = document.createElement("script");
      let encerrado = false;

      const seguir = (ok) => {
        if (encerrado) return;
        encerrado = true;
        clearTimeout(cronometro);
        if (ok) return;
        script.remove();
        tentar(indice + 1);
      };

      const cronometro = setTimeout(() => seguir(false), TEMPO_LIMITE_SCRIPT);

      script.src = MAMMOTH_CDNS[indice];
      script.async = true;
      script.onload = () => {
        if (!window.mammoth) {
          seguir(false);
          return;
        }
        seguir(true);
        resolve(window.mammoth);
      };
      script.onerror = () => seguir(false);

      document.head.appendChild(script);
    };

    tentar(0);
  });

  return promessaMammoth;
}

function limitarZoom(valor) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, valor));
}

/**
 * Olha os primeiros bytes do arquivo baixado para saber se é mesmo um PDF.
 *
 * Erro "Invalid PDF structure" quase nunca é PDF corrompido: normalmente o
 * link devolveu OUTRA COISA (página de erro HTML, JSON do Storage, .docx...).
 * Saber o que veio é o que permite dar uma mensagem útil em vez de genérica.
 */
function analisarArquivo(buffer) {
  const bytes = new Uint8Array(buffer);
  let texto = "";
  for (let i = 0; i < Math.min(bytes.length, 8192); i += 1) {
    texto += String.fromCharCode(bytes[i]);
  }

  // Alguns arquivos chegam com BOM ou lixo antes do cabeçalho; se o "%PDF-"
  // existir logo no início do arquivo, dá pra aproveitar a partir dali.
  const posicao = texto.indexOf("%PDF-");
  if (posicao === 0) return { ehPdf: true, ehDocx: false, deslocamento: 0, rotulo: "PDF", previa: "" };
  if (posicao > 0) return { ehPdf: true, ehDocx: false, deslocamento: posicao, rotulo: "PDF", previa: "" };

  const inicio = texto.slice(0, 120).trim();
  const ehZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  // Um .docx é um ZIP; o que o identifica é o conteúdo interno do pacote
  // Office, cujos nomes de arquivo aparecem em texto claro logo no início.
  const ehDocx =
    ehZip && (texto.includes("word/") || texto.includes("[Content_Types].xml"));
  if (ehDocx) {
    return { ehPdf: false, ehDocx: true, deslocamento: 0, rotulo: "documento Word (.docx)", previa: "" };
  }

  let rotulo = "arquivo desconhecido";
  if (ehZip) rotulo = "arquivo ZIP";
  else if (/^<(!doctype|html|\?xml)/i.test(inicio)) rotulo = "página HTML";
  else if (/^[[{]/.test(inicio)) rotulo = "resposta JSON";
  else if (bytes[0] === 0xff && bytes[1] === 0xd8) rotulo = "imagem JPEG";
  else if (bytes[0] === 0x89 && bytes[1] === 0x50) rotulo = "imagem PNG";

  return { ehPdf: false, ehDocx: false, deslocamento: 0, rotulo, previa: inicio };
}

function distanciaEntreToques(toques) {
  const dx = toques[0].clientX - toques[1].clientX;
  const dy = toques[0].clientY - toques[1].clientY;
  return Math.hypot(dx, dy);
}

/**
 * Tela interna de documento (Planta/Memorial).
 *
 * Estados possíveis, nessa ordem de preferência:
 *   "carregando" -> "ok"        (pdf.js desenhando as páginas em canvas)
 *   "carregando" -> "nativo"    (pdf.js indisponível; último recurso, usa o
 *                                leitor do navegador -- funciona em desktop/iOS)
 *   "carregando" -> "erro"      (mensagem amigável + tentar de novo + voltar)
 *
 * Em nenhum caminho a tela fica branca.
 */
export function VisualizadorPdf({ titulo, url, onVoltar }) {
  const [fase, setFase] = useState("carregando");
  const [mensagemErro, setMensagemErro] = useState("");
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [tentativa, setTentativa] = useState(0);
  const [urlNativa, setUrlNativa] = useState(null);
  const [htmlDocumento, setHtmlDocumento] = useState("");

  const docRef = useRef(null);
  const canvasRef = useRef(null);
  const areaRef = useRef(null);
  const tarefaRenderRef = useRef(null);
  const blobUrlRef = useRef(null);
  const pinchRef = useRef(null);

  // ---- carregamento do documento -----------------------------------------
  useEffect(() => {
    let vivo = true;

    setFase("carregando");
    setMensagemErro("");
    setTotalPaginas(0);
    setPagina(1);
    setZoom(1);
    setUrlNativa(null);
    setHtmlDocumento("");
    docRef.current = null;

    const criarUrlNativa = (dados) => {
      const blobUrl = URL.createObjectURL(new Blob([dados], { type: "application/pdf" }));
      blobUrlRef.current = blobUrl;
      return blobUrl;
    };

    (async () => {
      if (!url) {
        if (vivo) {
          setMensagemErro("Este terreno não possui este documento cadastrado.");
          setFase("erro");
        }
        return;
      }

      // 1) Baixa os bytes do PDF. Entregar os bytes prontos ao pdf.js evita
      //    depender de range requests e de uma segunda rodada de CORS dentro
      //    do worker -- pontos onde o WebView costuma falhar.
      let dados = null;
      let diagnostico = null;
      try {
        const resposta = await fetch(url, { credentials: "omit" });
        console.log(
          `[PDF] ${titulo}: HTTP ${resposta.status} tipo=${resposta.headers.get("content-type")} ` +
            `tamanho=${resposta.headers.get("content-length")}`
        );
        if (!resposta.ok) {
          diagnostico =
            resposta.status === 404
              ? "O link deste documento não existe mais no servidor (erro 404)."
              : `O servidor respondeu com erro ${resposta.status} ao buscar o arquivo.`;
          throw new Error(`HTTP ${resposta.status}`);
        }
        dados = await resposta.arrayBuffer();

        const analise = analisarArquivo(dados);

        // O memorial descritivo é gerado em Word (.docx), não em PDF. Em vez
        // de recusar o arquivo, ele é convertido em HTML aqui mesmo e exibido
        // na mesma tela -- continua tudo dentro do Vertent-Web, sem download e
        // sem abrir aplicativo externo.
        if (analise.ehDocx) {
          try {
            const mammoth = await carregarMammoth();
            const resultado = await mammoth.convertToHtml({ arrayBuffer: dados });
            if (!vivo) return;
            const html = (resultado?.value || "").trim();
            if (!html) throw new Error("documento Word sem conteúdo legível");
            setHtmlDocumento(html);
            setFase("word");
          } catch (erroWord) {
            console.error(`[PDF] ${titulo}: falha ao converter o .docx:`, erroWord);
            if (!vivo) return;
            setMensagemErro("Não foi possível converter o documento do Word. Verifique sua conexão e tente novamente.");
            setFase("erro");
          }
          return;
        }

        if (!analise.ehPdf) {
          console.error(
            `[PDF] ${titulo}: o link não devolveu um PDF, e sim ${analise.rotulo}. ` +
              `Início do conteúdo: ${analise.previa}`
          );
          if (!vivo) return;
          setMensagemErro(
            `O link cadastrado para ${titulo.toLowerCase()} não aponta para um PDF ` +
              `(o servidor devolveu ${analise.rotulo}). É preciso corrigir o arquivo no cadastro do terreno.`
          );
          setFase("erro");
          return;
        }
        if (analise.deslocamento > 0) {
          console.warn(`[PDF] ${titulo}: ignorando ${analise.deslocamento} byte(s) antes do cabeçalho do PDF.`);
          dados = dados.slice(analise.deslocamento);
        }
      } catch (err) {
        // Não é fatal por si só: o pdf.js ainda pode buscar a URL por conta própria.
        console.warn("[PDF] download direto falhou, tentando pelo pdf.js:", err);
      }
      if (!vivo) return;

      // 2) Carrega o leitor.
      let lib;
      let base;
      try {
        const modulo = await carregarPdfJs();
        lib = modulo.lib;
        base = modulo.base;
      } catch (err) {
        console.error("[PDF] leitor indisponível:", err);
        if (!vivo) return;
        if (dados) {
          setUrlNativa(criarUrlNativa(dados));
          setFase("nativo");
        } else {
          setMensagemErro("Verifique sua conexão e tente novamente.");
          setFase("erro");
        }
        return;
      }

      // 3) Abre o documento.
      try {
        const origem = dados ? { data: new Uint8Array(dados.slice(0)) } : { url };
        const tarefa = lib.getDocument({
          ...origem,
          cMapUrl: `${base}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${base}/standard_fonts/`,
          // WebViews com CSP restritiva bloqueiam eval; sem isso o pdf.js
          // pode falhar ao montar as fontes.
          isEvalSupported: false,
        });
        const doc = await tarefa.promise;

        if (!vivo) {
          doc.destroy?.();
          return;
        }

        docRef.current = doc;
        setTotalPaginas(doc.numPages);
        setPagina(1);
        setFase("ok");
      } catch (err) {
        console.error("[PDF] falha ao abrir o documento:", err);
        if (!vivo) return;
        setMensagemErro(
          diagnostico ||
            (err?.name === "InvalidPDFException"
              ? "O arquivo cadastrado não é um PDF válido. É preciso reenviá-lo no cadastro do terreno."
              : dados
                ? "O arquivo pode estar corrompido ou em um formato não suportado."
                : "Verifique sua conexão e tente novamente.")
        );
        setFase("erro");
      }
    })();

    return () => {
      vivo = false;
      try {
        tarefaRenderRef.current?.cancel?.();
      } catch {
        // cancelamento não precisa de tratamento
      }
      tarefaRenderRef.current = null;
      docRef.current?.destroy?.();
      docRef.current = null;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [url, titulo, tentativa]);

  // ---- desenho da página --------------------------------------------------
  const desenhar = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const area = areaRef.current;
    if (!doc || !canvas || !area) return;

    try {
      tarefaRenderRef.current?.cancel?.();
    } catch {
      // ignorado de propósito
    }

    try {
      const page = await doc.getPage(pagina);
      if (docRef.current !== doc || !canvasRef.current || !areaRef.current) return;
      const original = page.getViewport({ scale: 1 });

      // Ponto de partida: a página cabendo na largura disponível. O zoom do
      // usuário multiplica esse valor.
      const larguraDisponivel = Math.max(240, area.clientWidth - 16);
      const escalaCss = (larguraDisponivel / original.width) * zoom;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let escalaFisica = escalaCss * dpr;
      const maiorLado = Math.max(original.width, original.height) * escalaFisica;
      if (maiorLado > LIMITE_LADO_CANVAS) {
        escalaFisica *= LIMITE_LADO_CANVAS / maiorLado;
      }

      const viewport = page.getViewport({ scale: escalaFisica });
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      canvas.style.width = `${Math.floor(original.width * escalaCss)}px`;
      canvas.style.height = `${Math.floor(original.height * escalaCss)}px`;
      canvas.style.transform = "";

      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("canvas 2d indisponível");
      contexto.fillStyle = "#ffffff";
      contexto.fillRect(0, 0, canvas.width, canvas.height);

      const tarefa = page.render({ canvasContext: contexto, viewport });
      tarefaRenderRef.current = tarefa;
      await tarefa.promise;
    } catch (err) {
      if (err?.name === "RenderingCancelledException") return;
      console.error("[PDF] falha ao desenhar a página:", err);
      setMensagemErro("Não foi possível desenhar esta página do documento.");
      setFase("erro");
    }
  }, [pagina, zoom]);

  useEffect(() => {
    if (fase !== "ok") return;
    desenhar();
  }, [fase, desenhar]);

  // Redesenha quando a área muda de tamanho (rotação de tela, teclado, etc.).
  useEffect(() => {
    if (fase !== "ok") return;
    let cronometro;
    const aoRedimensionar = () => {
      clearTimeout(cronometro);
      cronometro = setTimeout(desenhar, 150);
    };
    window.addEventListener("resize", aoRedimensionar);
    window.addEventListener("orientationchange", aoRedimensionar);
    return () => {
      clearTimeout(cronometro);
      window.removeEventListener("resize", aoRedimensionar);
      window.removeEventListener("orientationchange", aoRedimensionar);
    };
  }, [fase, desenhar]);

  // ---- zoom por toque (pinça) --------------------------------------------
  // Listeners nativos com { passive: false }: o React registra touchmove como
  // passivo em vários navegadores, e aí preventDefault não funcionaria.
  useEffect(() => {
    const area = areaRef.current;
    if (!area || fase !== "ok") return;

    const inicio = (evento) => {
      if (evento.touches.length !== 2) return;
      pinchRef.current = {
        distancia: distanciaEntreToques(evento.touches),
        zoomInicial: zoom,
        zoomAtual: zoom,
      };
    };

    const mover = (evento) => {
      const pinca = pinchRef.current;
      if (!pinca || evento.touches.length !== 2) return;
      evento.preventDefault();
      const razao = distanciaEntreToques(evento.touches) / pinca.distancia;
      const novo = limitarZoom(pinca.zoomInicial * razao);
      pinca.zoomAtual = novo;
      // Prévia barata durante o gesto; o redesenho nítido acontece ao soltar.
      const canvas = canvasRef.current;
      if (canvas) canvas.style.transform = `scale(${novo / pinca.zoomInicial})`;
    };

    const fim = () => {
      const pinca = pinchRef.current;
      if (!pinca) return;
      pinchRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) canvas.style.transform = "";
      if (Math.abs(pinca.zoomAtual - zoom) > 0.01) setZoom(pinca.zoomAtual);
    };

    area.addEventListener("touchstart", inicio, { passive: true });
    area.addEventListener("touchmove", mover, { passive: false });
    area.addEventListener("touchend", fim, { passive: true });
    area.addEventListener("touchcancel", fim, { passive: true });

    return () => {
      area.removeEventListener("touchstart", inicio);
      area.removeEventListener("touchmove", mover);
      area.removeEventListener("touchend", fim);
      area.removeEventListener("touchcancel", fim);
    };
  }, [fase, zoom]);

  const irParaPagina = (destino) => {
    setPagina((atual) => {
      const alvo = Math.min(Math.max(1, destino), totalPaginas || 1);
      if (alvo !== atual && areaRef.current) areaRef.current.scrollTop = 0;
      return alvo;
    });
  };

  const ajustarZoom = (fator) => setZoom((atual) => limitarZoom(atual * fator));

  return (
    <div style={estilos.overlay} role="dialog" aria-label={titulo}>
      <style>{CSS_INTERNO}</style>

      <div style={estilos.barraTopo}>
        <button type="button" onClick={onVoltar} style={estilos.botaoVoltar}>
          <IconeVoltar />
          Voltar
        </button>
        <span style={estilos.titulo}>{titulo}</span>
      </div>

      <div
        ref={areaRef}
        className="vertent-pdf-area"
        style={{
          ...estilos.area,
          justifyContent: zoom > 1 ? "flex-start" : "center",
        }}
      >
        {fase === "carregando" && (
          <div style={estilos.centralizado}>
            <div className="vertent-pdf-spinner" />
            <p style={estilos.textoEstado}>Carregando documento...</p>
          </div>
        )}

        {fase === "erro" && (
          <div style={estilos.centralizado}>
            <p style={estilos.textoErro}>Não foi possível carregar este documento.</p>
            {mensagemErro && <p style={estilos.textoEstado}>{mensagemErro}</p>}
            <div style={estilos.acoesErro}>
              <button
                type="button"
                style={estilos.botaoAcao}
                onClick={() => setTentativa((valor) => valor + 1)}
              >
                Tentar novamente
              </button>
              <button type="button" style={estilos.botaoAcao} onClick={onVoltar}>
                Voltar
              </button>
            </div>
          </div>
        )}

        {fase === "word" && (
          <div
            className="vertent-doc"
            style={{ ...estilos.folhaWord, fontSize: `${Math.round(15 * zoom)}px` }}
            dangerouslySetInnerHTML={{ __html: htmlDocumento }}
          />
        )}

        {fase === "nativo" && urlNativa && (
          <iframe title={titulo} src={urlNativa} style={estilos.iframe} />
        )}

        <canvas
          ref={canvasRef}
          style={{
            ...estilos.canvas,
            display: fase === "ok" ? "block" : "none",
          }}
        />
      </div>

      {(fase === "ok" || fase === "word") && (
        <div style={estilos.barraInferior}>
          <div style={estilos.grupoControles}>
            <button
              type="button"
              style={estilos.botaoControle}
              onClick={() => ajustarZoom(1 / ZOOM_PASSO)}
              disabled={zoom <= ZOOM_MIN + 0.001}
              aria-label="Diminuir zoom"
            >
              −
            </button>
            <span style={estilos.indicador}>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              style={estilos.botaoControle}
              onClick={() => ajustarZoom(ZOOM_PASSO)}
              disabled={zoom >= ZOOM_MAX - 0.001}
              aria-label="Aumentar zoom"
            >
              +
            </button>
          </div>

          {fase === "ok" && totalPaginas > 1 && (
            <div style={estilos.grupoControles}>
              <button
                type="button"
                style={estilos.botaoControle}
                onClick={() => irParaPagina(pagina - 1)}
                disabled={pagina <= 1}
                aria-label="Página anterior"
              >
                ‹
              </button>
              <span style={estilos.indicador}>
                {pagina} / {totalPaginas}
              </span>
              <button
                type="button"
                style={estilos.botaoControle}
                onClick={() => irParaPagina(pagina + 1)}
                disabled={pagina >= totalPaginas}
                aria-label="Próxima página"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IconeVoltar() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

const CSS_INTERNO = `
.vertent-pdf-spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid rgba(15,23,42,0.15);
  border-top-color: #166534;
  animation: vertent-pdf-girar 0.9s linear infinite;
  margin: 0 auto 10px;
}
@keyframes vertent-pdf-girar { to { transform: rotate(360deg); } }
.vertent-pdf-area { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.vertent-pdf-area::-webkit-scrollbar { width: 8px; height: 8px; }
.vertent-doc p { margin: 0 0 0.7em; }
.vertent-doc h1, .vertent-doc h2, .vertent-doc h3 { margin: 1.1em 0 0.5em; line-height: 1.3; }
.vertent-doc img { max-width: 100%; height: auto; }
.vertent-doc table { border-collapse: collapse; width: 100%; margin: 0 0 1em; font-size: 0.92em; }
.vertent-doc td, .vertent-doc th { border: 1px solid rgba(15,23,42,0.2); padding: 5px 7px; vertical-align: top; }
.vertent-doc a { color: #166534; }
`;

const estilos = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 30,
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#1f2937",
  },
  barraTopo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    paddingTop: "max(10px, env(safe-area-inset-top))",
    borderBottom: "1px solid rgba(15,23,42,0.12)",
    background: "#ffffff",
    flexShrink: 0,
  },
  botaoVoltar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "#ffffff",
    color: "#1f2937",
    fontSize: 14,
    cursor: "pointer",
    flexShrink: 0,
  },
  titulo: {
    fontSize: 14,
    fontWeight: 600,
    color: "#2c3e2f",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  area: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    background: "#f3f4f6",
    padding: 8,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  canvas: {
    background: "#ffffff",
    boxShadow: "0 2px 10px rgba(15,23,42,0.14)",
    maxWidth: "none",
    transformOrigin: "center top",
  },
  folhaWord: {
    background: "#ffffff",
    boxShadow: "0 2px 10px rgba(15,23,42,0.14)",
    borderRadius: 4,
    padding: "22px 18px",
    width: "100%",
    maxWidth: 820,
    boxSizing: "border-box",
    lineHeight: 1.55,
    color: "#1f2937",
    textAlign: "left",
    overflowWrap: "anywhere",
  },
  iframe: {
    flex: 1,
    alignSelf: "stretch",
    width: "100%",
    minHeight: 0,
    border: "none",
    background: "#ffffff",
  },
  centralizado: {
    margin: "auto",
    textAlign: "center",
    padding: 20,
    maxWidth: 320,
  },
  textoEstado: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "#6b7280",
  },
  textoErro: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: "#2c3e2f",
  },
  acoesErro: {
    marginTop: 14,
    display: "flex",
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  botaoAcao: {
    padding: "9px 14px",
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "#ffffff",
    color: "#1f2937",
    fontSize: 14,
    cursor: "pointer",
  },
  barraInferior: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
    padding: "8px 12px",
    paddingBottom: "max(8px, env(safe-area-inset-bottom))",
    borderTop: "1px solid rgba(15,23,42,0.12)",
    background: "#ffffff",
    flexShrink: 0,
  },
  grupoControles: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  botaoControle: {
    minWidth: 40,
    height: 40,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "#ffffff",
    color: "#1f2937",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
  },
  indicador: {
    minWidth: 62,
    textAlign: "center",
    fontSize: 13,
    color: "#374151",
    fontVariantNumeric: "tabular-nums",
  },
};
