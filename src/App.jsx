import { Canvas } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
import { Terrenos } from "./components/Terrenos";
import { Confrontantes } from "./components/Confrontantes";
import { StatusScreen } from "./components/StatusScreen";
import { ModelErrorBoundary } from "./components/ModelErrorBoundary";
import { cartographicBackground } from "./theme";
import { buscarTerrenoPublico } from "./backend";

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function computeInitialStatus() {
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get("url");
  // Além da URL do GLB (já existente), a matrícula é o identificador
  // usado pra buscar confrontantes/planta/memorial no Backend (GET
  // /terreno-publico/:matricula). Terrenos antigos, ou links que ainda
  // não passam esse parâmetro, continuam funcionando normalmente --
  // só ficam sem o botão Confrontantes funcional (ETAPA 3, seção 11).
  const matricula = params.get("matricula");

  if (!urlParam || !urlParam.trim()) {
    return { state: "missing" };
  }

  if (!isValidHttpUrl(urlParam)) {
    console.error("URL do terreno inválida:", urlParam);
    return { state: "invalid" };
  }

  return { state: "ready", url: urlParam, matricula };
}

function LoadingOverlay() {
  const { active, progress } = useProgress();

  if (!active) return null;

  return (
    <div style={styles.loadingOverlay}>
      <p style={{ margin: 0, fontWeight: 600, color: "#2c3e2f" }}>
        Carregando terreno...
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
        {Math.round(progress)}%
      </p>
    </div>
  );
}

function App() {
  const [status] = useState(computeInitialStatus);
  const [terrenoNode, setTerrenoNode] = useState(null);
  const [modoConfrontantes, setModoConfrontantes] = useState(false);
  // "sem-matricula" | "carregando" | "ok" | "erro" -- ver seções 11 e
  // 16 da ETAPA 3: em qualquer caso que não seja "ok", o visualizador
  // continua funcionando normalmente, só o botão Confrontantes muda de
  // mensagem.
  const [dadosTerreno, setDadosTerreno] = useState(null);
  const [statusDados, setStatusDados] = useState(
    status.matricula ? "carregando" : "sem-matricula"
  );

  useEffect(() => {
    if (status.state !== "ready" || !status.matricula) return;

    let cancelado = false;

    buscarTerrenoPublico(status.matricula).then((dados) => {
      if (cancelado) return;
      if (!dados) {
        setStatusDados("erro");
        return;
      }
      setDadosTerreno(dados);
      setStatusDados("ok");
    });

    return () => {
      cancelado = true;
    };
  }, [status.state, status.matricula]);

  // Só desenha linhas/textos quando TUDO que a fórmula de
  // transformação precisa está disponível -- nunca uma aproximação
  // (ETAPA 3, seções 10 e 16): o GLB tem o node com o origin do Topo
  // Textura, o Backend respondeu com sucesso, e existe pelo menos um
  // confrontante cadastrado.
  const dadosProntos =
    statusDados === "ok" &&
    !!terrenoNode &&
    dadosTerreno?.origin_x != null &&
    dadosTerreno?.origin_y != null &&
    (dadosTerreno?.confrontantes?.length ?? 0) > 0;

  if (status.state === "missing") {
    return <StatusScreen title="Nenhum terreno foi informado." />;
  }

  if (status.state === "invalid") {
    return (
      <StatusScreen
        title="Não foi possível carregar o terreno."
        subtitle="A URL informada não é válida."
      />
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        ...cartographicBackground,
      }}
    >
      <ModelErrorBoundary
        fallback={
          <StatusScreen
            title="Não foi possível carregar o terreno."
            subtitle="Verifique sua conexão e tente novamente."
          />
        }
      >
        <Canvas
          camera={{
            position: [8, 6, 8],
            fov: 50,
            near: 0.01,
            far: 1000000,
          }}
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
          }}
          gl={{ antialias: true, alpha: true, logarithmicDepthBuffer: true }}
        >
          <ambientLight intensity={2.5} />
          <directionalLight position={[16, 15, 10]} intensity={2} />

          <Suspense fallback={null}>
            <Terrenos
              url={status.url}
              onTerrenoNode={setTerrenoNode}
              modoConfrontantes={modoConfrontantes}
            />
            {dadosProntos && (
              <Confrontantes
                terrenoNode={terrenoNode}
                dados={dadosTerreno}
                visivel={modoConfrontantes}
              />
            )}
          </Suspense>

          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            enableRotate
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.8}
            zoomSpeed={0.9}
            panSpeed={0.8}
            minDistance={0.01}
            maxDistance={1000000}
          />
        </Canvas>

        <LoadingOverlay />

      </ModelErrorBoundary>

      {/* Os controles permanecem disponíveis mesmo se o Canvas/GLB falhar. */}
      <BarraDeAcoes
        modoConfrontantes={modoConfrontantes}
        onToggleConfrontantes={() => setModoConfrontantes((v) => !v)}
        mostrarAvisoSemDados={modoConfrontantes && !dadosProntos}
        plantaUrl={dadosTerreno?.planta_url}
        memorialUrl={dadosTerreno?.memorial_url}
      />
    </div>
  );
}

// [ Confrontantes ] [ Planta ] [ Memorial ] -- ETAPA 3, seção 14. Só
// os controles necessários, sem redesenhar o resto da interface.
function BarraDeAcoes({
  modoConfrontantes,
  onToggleConfrontantes,
  mostrarAvisoSemDados,
  plantaUrl,
  memorialUrl,
}) {
  const abrirPdf = (url) => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <div style={styles.barra}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          onClick={onToggleConfrontantes}
          aria-label="Mostrar ou ocultar confrontantes"
          aria-pressed={modoConfrontantes}
          title="Confrontantes"
          style={{
            ...styles.botao,
            ...(modoConfrontantes ? styles.botaoAtivo : null),
          }}
        >
          <IconeConfrontantes />
        </button>
        {plantaUrl && (
          <button type="button" aria-label="Abrir planta" title="Planta" style={styles.botao} onClick={() => abrirPdf(plantaUrl)}>
            <IconePlanta />
          </button>
        )}
        {memorialUrl && (
          <button type="button" aria-label="Abrir memorial" title="Memorial" style={styles.botao} onClick={() => abrirPdf(memorialUrl)}>
            <IconeMemorial />
          </button>
        )}
      </div>

      {mostrarAvisoSemDados && (
        <p style={styles.aviso}>
          Não há dados de confrontantes cadastrados para este terreno.
        </p>
      )}
    </div>
  );
}

function IconeConfrontantes() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M2.8 19c.8-3 2.7-4.5 5.2-4.5s4.4 1.5 5.2 4.5M14.3 19c.45-1.8 1.55-2.9 3.25-2.9 1.65 0 2.8 1.1 3.25 2.9" /></svg>;
}

function IconeMemorial() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5v4h4M9 12h6M9 16h6" /></svg>;
}

function IconePlanta() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 5.5 5-2 7 2.5 5-2v14.5l-5 2-7-2.5-5 2z" /><path d="M8.5 3.5V18M15.5 6v14.5" /></svg>;
}

const styles = {
  barra: {
    position: "absolute",
    top: "50%",
    right: "max(16px, env(safe-area-inset-right))",
    transform: "translateY(-50%)",
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-start",
  },
  botao: {
    width: 44,
    height: 44,
    padding: 0,
    borderRadius: "50%",
    border: "1px solid rgba(15,23,42,0.14)",
    background: "rgba(255,255,255,0.94)",
    color: "#1f2937",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    boxShadow: "0 3px 10px rgba(15,23,42,0.16)",
  },
  botaoAtivo: {
    background: "#166534",
    color: "#ffffff",
    borderColor: "#166534",
  },
  aviso: {
    margin: 0,
    padding: "8px 12px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.92)",
    color: "#7a4a00",
    fontSize: 12,
    maxWidth: 260,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  loadingOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    padding: "14px 22px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    textAlign: "center",
    pointerEvents: "none",
  },
};

export default App;
