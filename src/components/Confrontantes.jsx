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

function posicaoDoRotulo(ancora, externo, comprimento, tamanhoTerreno, anel, rotulos) {
  const afastamento = Math.min(Math.max(tamanhoTerreno * 0.035, comprimento * 0.18), tamanhoTerreno * 0.2);
  const candidato = ancora.clone().addScaledVector(externo, afastamento);
  while (pontoNoPoligono(candidato, anel) && candidato.distanceTo(ancora) < tamanhoTerreno) candidato.addScaledVector(externo, afastamento * 0.5);
  for (const anterior of rotulos) while (candidato.distanceTo(anterior) < tamanhoTerreno * 0.09) candidato.addScaledVector(externo, tamanhoTerreno * 0.04);
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
    const orientacao = areaAssinada(anel); const rotulos = []; const verticesDeTransicao = new Map(); const lista = [];
    for (const confrontante of dados.confrontantes) {
      const inicio = porNumero.get(numeroPonto(confrontante.ponto_inicio)); const fim = porNumero.get(numeroPonto(confrontante.ponto_fim));
      if (inicio === undefined || fim === undefined) continue;
      const indices = indicesDoIntervalo(inicio, fim, anel.length); if (indices.length < 2) continue;
      const centro = centroDoTrecho(indices, anel); const externo = direcaoExterna(indices, anel, orientacao);
      const rotulo = posicaoDoRotulo(centro.ponto, externo, centro.comprimento, tamanhoTerreno, anel, rotulos); rotulo.y = centro.ponto.y + ALTURA_ACIMA_DO_TERRENO * 2; rotulos.push(rotulo);
      verticesDeTransicao.set(indices[0], externo); verticesDeTransicao.set(indices[indices.length - 1], externo);
      lista.push({ key: `${confrontante.ordem ?? ""}-${numeroPonto(confrontante.ponto_inicio)}-${numeroPonto(confrontante.ponto_fim)}`, nome: confrontante.nome || "Confrontante", matricula: confrontante.matricula || "Não informada", trecho: indices.map((indice) => anel[indice].toArray()), ancora: centro.ponto.toArray(), rotulo: rotulo.toArray() });
    }
    const tamanhoTexto = Math.max(tamanhoTerreno / 70, 0.12); const tamanhoDivisor = Math.max(tamanhoTerreno * 0.018, tamanhoTexto * 0.8);
    return { perimetro: [...anel, anel[0]].map((ponto) => ponto.toArray()), segmentos: lista, divisores: [...verticesDeTransicao].map(([indice, externo]) => { const vertice = anel[indice]; return [vertice.clone().addScaledVector(externo, -tamanhoDivisor).toArray(), vertice.clone().addScaledVector(externo, tamanhoDivisor).toArray()]; }), escala: tamanhoTexto };
  })();

  if (!visivel) return null;
  return <group ref={grupoRef}>
    <Line points={perimetro} color="#f8fafc" lineWidth={2.5} />
    {segmentos.map((segmento) => <group key={segmento.key}>
      <Line points={segmento.trecho} color="#16a34a" lineWidth={3.5} />
      <Line points={[segmento.ancora, segmento.rotulo]} color="#14532d" lineWidth={1.5} />
      <Text position={segmento.rotulo} rotation={[-Math.PI / 2, 0, 0]} fontSize={escala} color="#14532d" anchorX="center" anchorY="middle" outlineWidth={escala * 0.08} outlineColor="#ffffff">{`${segmento.nome}\nMatrícula: ${segmento.matricula}`}</Text>
    </group>)}
    {divisores.map((pontos, indice) => <Line key={`divisor-${indice}`} points={pontos} color="#0f172a" lineWidth={2} />)}
  </group>;
}
