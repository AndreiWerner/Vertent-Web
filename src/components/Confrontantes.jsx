import { useEffect, useMemo, useRef } from "react";
import { Line, Text } from "@react-three/drei";
import { Group } from "three";

// Pequeno deslocamento vertical (acima do topo do terreno) só para
// evitar z-fighting entre a linha/texto e a superfície -- não tem
// relação com a cota real de nenhum ponto (que não é armazenada em
// pontos_terreno, só numero/x/y). Ver ETAPA 3, seção 6.
const ALTURA_ACIMA_DO_TERRENO = 0.4;

/**
 * Converte um ponto cadastral (x, y -- mesmo sistema de coordenadas
 * do DXF usado pelo Topo Textura, ex. UTM) na posição local
 * equivalente dentro do GLB.
 *
 * Fórmula confirmada a partir do código-fonte real do Topo Textura:
 * - terrain/mesh.py:_compute_origin / build_mesh -> subtrai origin
 *   (ainda em eixos Z-up: X=Leste, Y=Norte, Z=cota);
 * - export/gltf_exporter.py:_to_gltf_axes -> troca de eixos para
 *   Y-up do three.js: gltf.x = local_x, gltf.y = local_z (cota),
 *   gltf.z = -local_y.
 *
 * Combinando os dois: gltf.x = X - origin_x, gltf.z = -(Y - origin_y).
 * Sem nenhuma escala em nenhum dos dois passos.
 */
function paraEspacoLocal(ponto, origin, alturaY) {
  return [ponto.x - origin.origin_x, alturaY, -(ponto.y - origin.origin_y)];
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
    if (!terrenoNode || !dados || !dados.origin_x || !dados.confrontantes?.length) {
      return { segmentos: [], escala: 1 };
    }

    const origin = {
      origin_x: dados.origin_x,
      origin_y: dados.origin_y,
    };

    const pontosPorNumero = new Map(
      (dados.pontos ?? []).map((p) => [p.numero, p])
    );

    // Altura acima do terreno calculada a partir da própria geometria
    // (espaço local do node "Terreno", mesmo referencial usado acima)
    // -- nunca um valor fixo "no chute", já que cada GLB tem um
    // tamanho diferente (ver ETAPA 3, seção 9).
    const geometria = terrenoNode.geometry;
    geometria.computeBoundingBox?.();
    const alturaBase = geometria.boundingBox?.max?.y ?? 0;
    const alturaY = alturaBase + ALTURA_ACIMA_DO_TERRENO;

    // Escala do texto proporcional ao tamanho do terreno, pra não
    // ficar minúsculo em terrenos grandes nem gigante em pequenos.
    const tamanho = geometria.boundingBox
      ? geometria.boundingBox.max.x - geometria.boundingBox.min.x
      : 10;
    const escalaTexto = Math.max(tamanho / 60, 0.15);

    const lista = [];

    for (const confrontante of dados.confrontantes) {
      const inicio = pontosPorNumero.get(confrontante.ponto_inicio);
      const fim = pontosPorNumero.get(confrontante.ponto_fim);

      if (!inicio || !fim) {
        console.warn(
          `Confrontante "${confrontante.nome}" (ordem ${confrontante.ordem}) ` +
            "ignorado: ponto_inicio/ponto_fim sem coordenadas válidas."
        );
        continue;
      }

      const a = paraEspacoLocal(inicio, origin, alturaY);
      const b = paraEspacoLocal(fim, origin, alturaY);
      const meio = [(a[0] + b[0]) / 2, alturaY, (a[2] + b[2]) / 2];

      lista.push({
        key: `${confrontante.ordem}-${confrontante.ponto_inicio}-${confrontante.ponto_fim}`,
        pontos: [a, b],
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
