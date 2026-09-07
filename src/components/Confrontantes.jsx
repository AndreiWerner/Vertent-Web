import { useEffect, useMemo, useRef } from "react";
import { Line, Text } from "@react-three/drei";
import { Raycaster, Vector3 } from "three";

// Só afasta a linha/texto um pouco ACIMA da altura real da superfície
// naquele ponto (calculada por raycast logo abaixo) -- nunca substitui
// a altura real por um valor fixo (ETAPA 3, seção 5).
const ALTURA_ACIMA_DO_TERRENO = 0.4;
// Ponto de partida do raio: um pouco acima do topo do bounding box,
// pra garantir que ele sempre comece FORA da malha e desça até achar
// a superfície de verdade, não um valor fixo "no chute".
const MARGEM_INICIO_RAIO = 5;

/**
 * X/Z locais de um ponto cadastral (x, y -- mesmo sistema de
 * coordenadas do DXF usado pelo Topo Textura, ex. UTM), já
 * transformados pelo `origin` do terreno.
 *
 * Fórmula confirmada a partir do código-fonte real do Topo Textura:
 * - terrain/mesh.py:_compute_origin / build_mesh -> subtrai origin
 *   (ainda em eixos Z-up: X=Leste, Y=Norte, Z=cota);
 * - export/gltf_exporter.py:_to_gltf_axes -> troca de eixos para
 *   Y-up do three.js: `converted[:,0]=x`, `converted[:,1]=z` (cota),
 *   `converted[:,2] = -y`.
 *
 * Combinando os dois: webX = X - origin.x, webZ = -(Y - origin.y).
 * Sem nenhuma escala em nenhum dos dois passos -- e sem NENHUMA
 * transformação diferente da que o Topo Textura já usa (ETAPA 3,
 * seção 16).
 */
function paraXZLocal(ponto, origin) {
  return { x: ponto.x - origin.x, z: -(ponto.y - origin.y) };
}

/**
 * Altura real da superfície do terreno em (x, z) local, via raycast
 * vertical contra a própria geometria (ETAPA 3, seção 5: "a altura
 * NÃO deve ser inventada"). Ray e interseção calculados em espaço
 * MUNDO -- assim já consideram a translação de centralização feita em
 * Terrenos.jsx (e qualquer outro transform herdado) -- e convertidos
 * de volta pro espaço local do node, mesmo referencial de x/z.
 *
 * Retorna `null` se o raio não acertar a malha (ex.: ponto cadastral
 * fora da extensão do GLB) -- nesse caso quem chama decide o que
 * fazer, nunca inventamos uma altura aqui.
 */
function alturaLocalNoPonto(terrenoNode, raycaster, x, z, alturaInicioLocal) {
  const origemMundo = terrenoNode.localToWorld(
    new Vector3(x, alturaInicioLocal, z)
  );
  const direcaoMundo = terrenoNode
    .localToWorld(new Vector3(x, alturaInicioLocal - 1, z))
    .sub(origemMundo)
    .normalize();

  raycaster.set(origemMundo, direcaoMundo);
  const [hit] = raycaster.intersectObject(terrenoNode, false);
  if (!hit) return null;

  return terrenoNode.worldToLocal(hit.point.clone()).y;
}

export function Confrontantes({ terrenoNode, dados, visivel }) {
  const grupoRef = useRef();

  // Reparenta o grupo para dentro do MESMO node que carrega o origin
  // (o node "Terreno" gravado pelo Topo Textura) -- assim os textos e
  // linhas herdam exatamente a mesma cadeia de transformações que os
  // vértices da malha (incluindo a centralização feita em
  // Terrenos.jsx), sem precisar copiar nenhuma matriz manualmente.
  useEffect(() => {
    const grupo = grupoRef.current;
    if (!terrenoNode || !grupo) return;
    terrenoNode.add(grupo);
    return () => {
      terrenoNode.remove(grupo);
    };
  }, [terrenoNode]);

  const { segmentos, escala } = useMemo(() => {
    if (!terrenoNode || dados?.origin_x == null || !dados?.confrontantes?.length) {
      return { segmentos: [], escala: 1 };
    }

    const origin = { x: dados.origin_x, y: dados.origin_y };
    const pontosPorNumero = new Map(
      (dados.pontos ?? []).map((p) => [p.numero, p])
    );

    // Garante que as matrizes de mundo do node estão atualizadas antes
    // de converter local<->mundo pro raycast (não depende do timing do
    // loop de render do R3F).
    terrenoNode.updateWorldMatrix(true, false);

    const geometria = terrenoNode.geometry;
    geometria.computeBoundingBox?.();
    const bbox = geometria.boundingBox;
    const alturaInicioLocal = (bbox?.max?.y ?? 0) + MARGEM_INICIO_RAIO;
    const alturaMaximaFallback = bbox?.max?.y ?? 0;

    const tamanho = bbox ? bbox.max.x - bbox.min.x : 10;
    const escalaTexto = Math.max(tamanho / 60, 0.15);

    const raycaster = new Raycaster();

    // Um ponto (numero) pode aparecer em vários segmentos (ETAPA 3,
    // seção 8) -- calcula a altura de cada um só uma vez.
    const alturaPorNumero = new Map();
    function posicaoLocalDoPonto(numero) {
      if (alturaPorNumero.has(numero)) return alturaPorNumero.get(numero);

      const ponto = pontosPorNumero.get(numero);
      if (!ponto) {
        alturaPorNumero.set(numero, null);
        return null;
      }

      const { x, z } = paraXZLocal(ponto, origin);
      const alturaSuperficie = alturaLocalNoPonto(
        terrenoNode,
        raycaster,
        x,
        z,
        alturaInicioLocal
      );

      if (alturaSuperficie == null) {
        console.warn(
          `Ponto ${numero}: raycast não encontrou a superfície do terreno em (x=${x.toFixed(3)}, z=${z.toFixed(3)}). ` +
            `Usando o topo do bounding box como altura de fallback (posição horizontal continua exata).`
        );
      }

      const posicao = {
        x,
        y: (alturaSuperficie ?? alturaMaximaFallback) + ALTURA_ACIMA_DO_TERRENO,
        z,
      };
      alturaPorNumero.set(numero, posicao);
      return posicao;
    }

    const lista = [];
    let logado = false;

    for (const confrontante of dados.confrontantes) {
      const a = posicaoLocalDoPonto(confrontante.ponto_inicio);
      const b = posicaoLocalDoPonto(confrontante.ponto_fim);

      if (!a || !b) {
        console.warn(
          `Confrontante "${confrontante.nome}" (ordem ${confrontante.ordem}) ` +
            "ignorado: ponto_inicio/ponto_fim sem coordenadas válidas."
        );
        continue;
      }

      // Teste numérico pedido na ETAPA 3 (seção 20) -- só do primeiro
      // segmento válido, pra não poluir o console.
      if (!logado) {
        const pIni = pontosPorNumero.get(confrontante.ponto_inicio);
        const pFim = pontosPorNumero.get(confrontante.ponto_fim);
        console.log(
          "[Confrontantes] Teste numérico:\n" +
            `Origin: X=${origin.x}  Y=${origin.y}\n` +
            `Ponto inicial (numero ${confrontante.ponto_inicio}): X=${pIni.x}  Y=${pIni.y}\n` +
            `Ponto transformado: X=${a.x.toFixed(3)}  Z=${a.z.toFixed(3)}\n` +
            `Ponto final (numero ${confrontante.ponto_fim}): X=${pFim.x}  Y=${pFim.y}\n` +
            `Ponto transformado: X=${b.x.toFixed(3)}  Z=${b.z.toFixed(3)}`
        );
        logado = true;
      }

      const pontosLinha = [
        [a.x, a.y, a.z],
        [b.x, b.y, b.z],
      ];
      const meio = [(a.x + b.x) / 2, Math.max(a.y, b.y), (a.z + b.z) / 2];

      lista.push({
        key: `${confrontante.ordem}-${confrontante.ponto_inicio}-${confrontante.ponto_fim}`,
        pontos: pontosLinha,
        meio,
        nome: confrontante.nome,
        matricula: confrontante.matricula,
      });
    }

    return { segmentos: lista, escala: escalaTexto };
  }, [terrenoNode, dados]);

  if (!visivel) return null;

  return (
    <group ref={grupoRef}>
      {segmentos.map((segmento) => (
        <group key={segmento.key}>
          <Line points={segmento.pontos} color="#22c55e" lineWidth={2.5} />
          <Text
            position={segmento.meio}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={escala}
            color="#14532d"
            anchorX="center"
            anchorY="middle"
            outlineWidth={escala * 0.06}
            outlineColor="#ffffff"
          >
            {`${segmento.nome}\nMatrícula: ${segmento.matricula}`}
          </Text>
        </group>
      ))}
    </group>
  );
}
