import { useEffect, useMemo, useRef } from "react";
import { Line, Text } from "@react-three/drei";
import { Box3, Raycaster, Vector3 } from "three";

// Pequena folga para evitar z-fighting. A altura real de cada ponto
// é obtida por raycast na malha do GLB.
const ALTURA_ACIMA_DO_TERRENO = 0.02;

function numeroPonto(valor) {
  return String(valor ?? "").trim();
}

function paraEspacoLocal(ponto, origin, alturaY) {
  // O Topo Textura exporta:
  // gltf.x = X - origin_x
  // gltf.y = cota
  // gltf.z = -(Y - origin_y)
  return [ponto.x - origin.origin_x, alturaY, -(ponto.y - origin.origin_y)];
}

function obterMalhas(raiz) {
  const malhas = [];
  raiz?.traverse((obj) => {
    if (obj.isMesh && obj.geometry) malhas.push(obj);
  });
  return malhas;
}

function obterAlturaDoTerreno(raiz, x, z, malhas, box) {
  if (!malhas.length) return null;

  // O ponto é criado no espaço local do node que contém a origem.
  // Convertemos para world, lançamos o raio vertical e voltamos para
  // o espaço local do mesmo node. Assim funciona mesmo se o GLB tiver
  // grupos/meshes filhos e transformações.
  const origem = new Vector3(x, box.max.y + 1000, z);
  raiz.localToWorld(origem);

  const raycaster = new Raycaster();
  raycaster.set(
    origem,
    new Vector3(0, -1, 0)
  );

  const hits = raycaster.intersectObjects(malhas, true);
  if (!hits.length) return null;

  const hitLocal = raiz.worldToLocal(hits[0].point.clone());
  return hitLocal.y + ALTURA_ACIMA_DO_TERRENO;
}

export function Confrontantes({ terrenoNode, dados, visivel }) {
  const grupoRef = useRef();

  useEffect(() => {
    const grupo = grupoRef.current;
    if (!terrenoNode || !grupo) return;

    terrenoNode.add(grupo);
    return () => {
      terrenoNode.remove(grupo);
    };
  }, [terrenoNode]);

  const { segmentos, escala } = useMemo(() => {
    if (
      !terrenoNode ||
      !dados ||
      dados.origin_x == null ||
      dados.origin_y == null ||
      !dados.confrontantes?.length
    ) {
      return { segmentos: [], escala: 1 };
    }

    const origin = {
      origin_x: Number(dados.origin_x),
      origin_y: Number(dados.origin_y),
    };

    if (!Number.isFinite(origin.origin_x) || !Number.isFinite(origin.origin_y)) {
      return { segmentos: [], escala: 1 };
    }

    const pontosPorNumero = new Map(
      (dados.pontos ?? []).map((p) => [numeroPonto(p.numero), p])
    );

    const malhas = obterMalhas(terrenoNode);
    const box = new Box3().setFromObject(terrenoNode);

    // Tamanho proporcional do texto, calculado a partir do terreno.
    const tamanhoX = Math.max(
      box.max.x - box.min.x,
      box.max.z - box.min.z,
      1
    );
    const escalaTexto = Math.max(tamanhoX / 60, 0.15);

    const lista = [];

    for (const confrontante of dados.confrontantes) {
      const inicio = pontosPorNumero.get(numeroPonto(confrontante.ponto_inicio));
      const fim = pontosPorNumero.get(numeroPonto(confrontante.ponto_fim));

      if (!inicio || !fim) {
        console.warn(
          `Confrontante "${confrontante.nome}" (ordem ${confrontante.ordem}) ` +
          "ignorado: ponto_inicio/ponto_fim sem coordenadas válidas."
        );
        continue;
      }

      const x1 = Number(inicio.x);
      const y1 = Number(inicio.y);
      const x2 = Number(fim.x);
      const y2 = Number(fim.y);

      if (![x1, y1, x2, y2].every(Number.isFinite)) {
        console.warn(
          `Confrontante "${confrontante.nome}" ignorado: coordenadas inválidas.`
        );
        continue;
      }

      // Primeiro obtemos a posição XY no sistema local do GLB.
      const preliminarA = paraEspacoLocal(
        { x: x1, y: y1 },
        origin,
        0
      );
      const preliminarB = paraEspacoLocal(
        { x: x2, y: y2 },
        origin,
        0
      );

      const alturaA = obterAlturaDoTerreno(
        terrenoNode,
        preliminarA[0],
        preliminarA[2],
        malhas,
        box
      );
      const alturaB = obterAlturaDoTerreno(
        terrenoNode,
        preliminarB[0],
        preliminarB[2],
        malhas,
        box
      );

      // Se não houver interseção com a malha, não inventamos uma cota.
      if (alturaA == null || alturaB == null) {
        console.warn(
          `Confrontante "${confrontante.nome}" ignorado: ` +
          "não foi possível encontrar a superfície do terreno nos pontos."
        );
        continue;
      }

      const a = [preliminarA[0], alturaA, preliminarA[2]];
      const b = [preliminarB[0], alturaB, preliminarB[2]];
      const meio = [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        (a[2] + b[2]) / 2,
      ];

      lista.push({
        key: `${confrontante.ordem}-${numeroPonto(confrontante.ponto_inicio)}-${numeroPonto(confrontante.ponto_fim)}`,
        pontos: [a, b],
        meio,
        nome: confrontante.nome || "Confrontante",
        matricula: confrontante.matricula || "Não informada",
      });
    }

    return { segmentos: lista, escala: escalaTexto };
  }, [terrenoNode, dados]);

  if (!visivel) return null;

  return (
    <group ref={grupoRef}>
      {segmentos.map((segmento) => (
        <group key={segmento.key}>
          <Line
            points={segmento.pontos}
            color="#22c55e"
            lineWidth={2.5}
          />
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
