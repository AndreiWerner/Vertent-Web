import { useGLTF, Text } from "@react-three/drei";

export function Terreno({ mostrarConfrontantes }) {
  const { scene } = useGLTF("/models/terreno2.glb");

  const baseRotation = -Math.PI / 2;

  return (
    <>
      {/* GLB */}
      <primitive object={scene} />

      {/* CONFRONTANTES */}
      {mostrarConfrontantes && (
        <>
          {/* NORTE */}
          <Text
            position={[0, 0.05, -5]}
            rotation={[baseRotation, 0, 0]}
            fontSize={0.5}
            color="#333"
            anchorX="center"
            anchorY="middle"
          >
            Norte - João
          </Text>

          {/* SUL */}
          <Text
            position={[0, 0.05, 5]}
            rotation={[baseRotation, 0, Math.PI]}
            fontSize={0.5}
            color="#333"
            anchorX="center"
            anchorY="middle"
          >
            Sul - Maria
          </Text>

          {/* LESTE */}
          <Text
            position={[5, 0.05, 0]}
            rotation={[baseRotation, 0, -Math.PI / 2]}
            fontSize={0.5}
            color="#333"
            anchorX="center"
            anchorY="middle"
          >
            Leste - Terreno
          </Text>

          {/* OESTE */}
          <Text
            position={[-5, 0.05, 0]}
            rotation={[baseRotation, 0, Math.PI / 2]}
            fontSize={0.5}
            color="#333"
            anchorX="center"
            anchorY="middle"
          >
            Oeste - Rua
          </Text>
        </>
      )}
    </>
  );
}

// preload
useGLTF.preload("/models/terreno2.glb");