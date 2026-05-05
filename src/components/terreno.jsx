import { useGLTF, Text } from "@react-three/drei";

export function Terrenos({ ativo, mostrarConfrontantes }) {
  const terreno1 = useGLTF("/models/terreno1.glb");
  const terreno2 = useGLTF("/models/terreno2.glb");

  const baseRotation = -Math.PI / 2;

  return (
    <>
      {/* MOSTRA UM OU OUTRO */}
      {ativo === 1 && <primitive object={terreno1.scene} />}
      {ativo === 2 && <primitive object={terreno2.scene} />}

      {/* CONFRONTANTES */}
      {mostrarConfrontantes && (
        <>
          <Text position={[0, 0.05, -5]} rotation={[baseRotation, 0, 0]} fontSize={0.5}>
            Norte - João
          </Text>

          <Text position={[0, 0.05, 5]} rotation={[baseRotation, 0, Math.PI]} fontSize={0.5}>
            Sul - Maria
          </Text>

          <Text position={[5, 0.05, 0]} rotation={[baseRotation, 0, -Math.PI / 2]} fontSize={0.5}>
            Leste - Terreno
          </Text>

          <Text position={[-5, 0.05, 0]} rotation={[baseRotation, 0, Math.PI / 2]} fontSize={0.5}>
            Oeste - Rua
          </Text>
        </>
      )}
    </>
  );
}

// preload
useGLTF.preload("/models/terreno.glb");
useGLTF.preload("/models/terreno2.glb");