import { useEffect, useRef } from "react";
import { Line, Text } from "@react-three/drei";
import { Box3, Matrix4, Raycaster, Vector3 } from "three";

const ALTURA_ACIMA_DO_TERRENO = 0.02;

function numeroPonto(valor) { return String(valor ?? "").trim(); }

function valorDeOrdem(ponto, indice) {
  const valor = Number(ponto.ordem ?? ponto.sequencia ?? ponto.numero);
  return Number.isFinite(valor) ? valor : indice;
}

function paraEspacoLocal(ponto, origin, altura) {
  // Convenção registrada pelo exportador: Easting -> X, elevação -> Y,
  // Northing invertido -> Z. Não há deslocamento empírico nesta fórmula.
  return new Vector3(Number(ponto.x) - origin.x, altura, -(Number(ponto.y) - origin.y));
}

function obterMalhas(raiz) {
  const malhas = [];
  raiz?.traverse((objeto) => { if (objeto.isMesh && objeto.geometry) malhas.push(objeto); });
  return malhas;
}

function obterCaixaLocal(raiz, malhas) {
  raiz.updateWorldMatrix(true, true);
  const inversaDaRaiz = new Matrix4().copy(raiz.matrixWorld).invert();
  const caixa = new Box3();
  malhas.forEach((malha) => {
    malha.geometry.computeBoundingBox();
    if (!malha.geometry.boundingBox) return;
    const matrizLocal = new Matrix4().multiplyMatrices(inversaDaRaiz, malha.matrixWorld);
    caixa.union(malha.geometry.boundingBox.clone().applyMatrix4(matrizLocal));
  });
  return caixa;
}

function obterAlturaDoTerreno(raiz, ponto, malhas, caixaLocal) {
  if (!malhas.length || caixaLocal.isEmpty()) return null;
  const origemLocal = ponto.clone();
  origemLocal.y = caixaLocal.max.y + Math.max(caixaLocal.getSize(new Vector3()).y, 1);
  const origemMundo = raiz.localToWorld(origemLocal);
  const direcaoMundo = new Vector3(0, -1, 0).transformDirection(raiz.matrixWorld);
  const hit = new Raycaster(origemMundo, direcaoMundo).intersectObjects(malhas, true)[0];
  return hit ? raiz.worldToLocal(hit.point.clone()).y + ALTURA_ACIMA_DO_TERRENO : null;
}

function areaAssinada(anel) {
  return anel.reduce((area, atual, indice) => {
    const proximo = anel[(indice + 1) % anel.length];
    return area + atual.x * proximo.z - proximo.x * atual.z;
  }, 0) / 2;
}

function pontoNoPoligono(ponto, anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const a = anel[i]; const b = anel[j];
    if ((a.z > ponto.z) !== (b.z > ponto.z) && ponto.x < ((b.x - a.x) * (ponto.z - a.z)) / (b.z - a.z) + a.x) dentro = !dentro;
  }
  return dentro;
}

function indicesDoIntervalo(inicio, fim, quantidade) {
  const indices = [inicio]; let indice = inicio;
  while (indice !== fim && indices.length <= quantidade) { indice = (indice + 1) % quantidade; indices.push(indice); }
  return indice === fim ? indices : [];
}

function centroDoTrecho(indices, anel) {
  let comprimentoTotal = 0; const partes = [];
  for (let i = 0; i < indices.length - 1; i += 1) {
    const inicio = anel[indices[i]]; const fim = anel[indices[i + 1]]; const comprimento = inicio.distanceTo(fim);
    partes.push({ inicio, fim, comprimento }); comprimentoTotal += comprimento;
  }
  let restante = comprimentoTotal / 2;
  for (const parte of partes) {
    if (restante <= parte.comprimento) return { ponto: parte.inicio.clone().lerp(parte.fim, parte.comprimento ? restante / parte.comprimento : 0), comprimento: comprimentoTotal };
    restante -= parte.comprimento;
  }
  return { ponto: anel[indices[0]].clone(), comprimento: comprimentoTotal };
}

function direcaoExterna(indices, anel, orientacao) {
  const direcao = new Vector3();
  for (let i = 0; i < indices.length - 1; i += 1) {
    const vetor = anel[indices[i + 1]].clone().sub(anel[indices[i]]); vetor.y = 0;
    const comprimento = vetor.length();
    if (comprimento) direcao.add(vetor);
  }
  if (!direcao.lengthSq()) return new Vector3(0, 0, -1);
  direcao.normalize();
  // Para anel anti-horário, (dz, -dx) é a normal externa (lado direito).
  return new Vector3(direcao.z, 0, -direcao.x).multiplyScalar(orientacao >= 0 ? 1 : -1);
}

function metricasDoTexto(nome, matricula, tamanhoFonte) {
  const maiorLinha = Math.max(nome.length, `Matrícula: ${matricula}`.length);
  const largura = maiorLinha * tamanhoFonte * 0.56;
  const altura = tamanhoFonte * 2.5;
  return { raio: Math.hypot(largura, altura) / 2, folga: tamanhoFonte * 0.7 };
}

function rotuloInterseccionaTerreno(centro, raio, anel) {
  if (pontoNoPoligono(centro, anel)) return true;
  for (let indice = 0; indice < 8; indice += 1) {
    const angulo = (Math.PI * 2 * indice) / 8;
    const borda = centro.clone().add(new Vector3(Math.cos(angulo) * raio, 0, Math.sin(angulo) * raio));
    if (pontoNoPoligono(borda, anel)) return true;
  }
  return false;
}

function posicaoDoRotulo(ancora, externo, comprimento, tamanhoTerreno, anel, rotulos, metricas) {
  // A distância inclui o raio do texto. Assim, mesmo nomes longos não
  // encostam na divisa; ela continua proporcional ao terreno e ao trecho.
  const afastamento = Math.max(tamanhoTerreno * 0.035, comprimento * 0.18, metricas.raio + metricas.folga);
  const candidato = ancora.clone().addScaledVector(externo, afastamento);
  while (rotuloInterseccionaTerreno(candidato, metricas.raio, anel) && candidato.distanceTo(ancora) < tamanhoTerreno * 2) candidato.addScaledVector(externo, afastamento * 0.35);
  for (const anterior of rotulos) {
    const distanciaMinima = metricas.raio + anterior.raio + metricas.folga;
    while (candidato.distanceTo(anterior.ponto) < distanciaMinima) candidato.addScaledVector(externo, metricas.folga + tamanhoTerreno * 0.025);
  }
  return candidato;
}

function origemDoModelo(terrenoNode, dados) {
  const origemGLB = terrenoNode.userData ?? {};
  const x = Number(origemGLB.topotexture_origin_x ?? dados.origin_x);
  const y = Number(origemGLB.topotexture_origin_y ?? dados.origin_y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (origemGLB.topotexture_origin_x !== undefined && (Math.abs(x - Number(dados.origin_x)) > 0.001 || Math.abs(y - Number(dados.origin_y)) > 0.001)) console.warn("A origem UTM do GLB diverge da origem retornada pelo Backend; usando a origem do GLB.");
  return { x, y };
}

export function Confrontantes({ terrenoNode, dados, visivel }) {
  const grupoRef = useRef();

  useEffect(() => {
    const grupo = grupoRef.current;
    if (!visivel || !terrenoNode || !grupo) return undefined;
    terrenoNode.add(grupo);
    return () => terrenoNode.remove(grupo);
  }, [terrenoNode, visivel]);

  const { perimetro, segmentos, divisores, escala } = (() => {
    if (!terrenoNode || !dados?.confrontantes?.length || !(dados.pontos?.length >= 3)) return { perimetro: [], segmentos: [], divisores: [], escala: 1 };
    const origin = origemDoModelo(terrenoNode, dados);
    if (!origin) return { perimetro: [], segmentos: [], divisores: [], escala: 1 };
    const pontosOrdenados = dados.pontos.map((ponto, indice) => ({ ...ponto, _ordem: valorDeOrdem(ponto, indice) })).sort((a, b) => a._ordem - b._ordem);
    const porNumero = new Map(pontosOrdenados.map((ponto, indice) => [numeroPonto(ponto.numero), indice]));
    const malhas = obterMalhas(terrenoNode); const caixaLocal = obterCaixaLocal(terrenoNode, malhas); const anel = [];
    for (const ponto of pontosOrdenados) {
      const local = paraEspacoLocal(ponto, origin, 0); const altura = obterAlturaDoTerreno(terrenoNode, local, malhas, caixaLocal);
      if (altura == null) { console.warn(`Ponto ${numeroPonto(ponto.numero)} não intercepta o terreno; divisa não desenhada.`); return { perimetro: [], segmentos: [], divisores: [], escala: 1 }; }
      local.y = altura; anel.push(local);
    }
    const caixa = new Box3().setFromPoints(anel); const tamanhoTerreno = Math.max(caixa.getSize(new Vector3()).x, caixa.getSize(new Vector3()).z, 1);
    const orientacao = areaAssinada(anel); const tamanhoTexto = Math.max(tamanhoTerreno / 70, 0.12); const rotulos = []; const verticesDeTransicao = new Map(); const lista = [];
    for (const confrontante of dados.confrontantes) {
      const inicio = porNumero.get(numeroPonto(confrontante.ponto_inicio)); const fim = porNumero.get(numeroPonto(confrontante.ponto_fim));
      if (inicio === undefined || fim === undefined) continue;
      const indices = indicesDoIntervalo(inicio, fim, anel.length); if (indices.length < 2) continue;
      const centro = centroDoTrecho(indices, anel); const externo = direcaoExterna(indices, anel, orientacao);
      const nome = confrontante.nome || "Confrontante"; const matricula = confrontante.matricula || "Não informada";
      const metricas = metricasDoTexto(nome, matricula, tamanhoTexto);
      const rotulo = posicaoDoRotulo(centro.ponto, externo, centro.comprimento, tamanhoTerreno, anel, rotulos, metricas); rotulo.y = centro.ponto.y + ALTURA_ACIMA_DO_TERRENO * 2; rotulos.push({ ponto: rotulo, raio: metricas.raio });
      verticesDeTransicao.set(indices[0], externo); verticesDeTransicao.set(indices[indices.length - 1], externo);
      lista.push({ key: `${confrontante.ordem ?? ""}-${numeroPonto(confrontante.ponto_inicio)}-${numeroPonto(confrontante.ponto_fim)}`, nome, matricula, trecho: indices.map((indice) => anel[indice].toArray()), ancora: centro.ponto.toArray(), rotulo: rotulo.toArray(), pontaLinha: rotulo.clone().addScaledVector(externo, -metricas.raio).toArray() });
    }
    const tamanhoDivisor = Math.max(tamanhoTerreno * 0.018, tamanhoTexto * 0.8);
    return { perimetro: [...anel, anel[0]].map((ponto) => ponto.toArray()), segmentos: lista, divisores: [...verticesDeTransicao].map(([indice, externo]) => { const vertice = anel[indice]; return [vertice.clone().addScaledVector(externo, -tamanhoDivisor).toArray(), vertice.clone().addScaledVector(externo, tamanhoDivisor).toArray()]; }), escala: tamanhoTexto };
  })();

  if (!visivel) return null;
  return <group ref={grupoRef}>
    <Line points={perimetro} color="#f8fafc" lineWidth={2.5} />
    {segmentos.map((segmento) => <group key={segmento.key}>
      <Line points={segmento.trecho} color="#16a34a" lineWidth={3.5} />
      <Line points={[segmento.ancora, segmento.pontaLinha]} color="#14532d" lineWidth={1.5} />
      <Text position={segmento.rotulo} rotation={[-Math.PI / 2, 0, 0]} fontSize={escala} color="#14532d" anchorX="center" anchorY="middle" outlineWidth={escala * 0.08} outlineColor="#ffffff">{`${segmento.nome}\nMatrícula: ${segmento.matricula}`}</Text>
    </group>)}
    {divisores.map((pontos, indice) => <Line key={`divisor-${indice}`} points={pontos} color="#0f172a" lineWidth={2} />)}
  </group>;
}
