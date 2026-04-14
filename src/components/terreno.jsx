import { useGLTF, Text } from "@react-three/drei";

/* ========= COMPONENTE DO TEXTO ========= */
function Confrontante({ p1, p2, nome }) {
  let angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);

  // Evita texto de cabeça pra baixo
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
    angle += Math.PI;
  }

  const midX = (p1.x + p2.x) / 2;
  const midZ = (p1.z + p2.z) / 2;



  return (
    <Text
      position={[midX, 1.88, midZ]}   // levemente acima do terreno
      rotation={[-Math.PI / 2, 0, -angle]}
      fontSize={0.6}
      color="black"
      outlineWidth={0.03}
      outlineColor="white"
      anchorX="center"
      anchorY="middle"
    >
      {nome}
    </Text>
  );
}

/* ========= TERRENO ========= */
export function Terreno({ mostrarConfrontantes }) {
  const { scene } = useGLTF("/public/Douglas.glb"); // caminho para o modelo otimizado

  const lados = [
    { p1: { x: -1, z: -12 }, p2: { x: 10, z: -1 }, nome: "Eliseu Vieira Tuelher" },
    { p1: { x: 11, z: 1 }, p2: { x: -3, z: 7 }, nome: "Maria de Souza" },
    { p1: { x: -4, z: 5 }, p2: { x: -7, z: -10 }, nome: "Rua Municipal" },
  ];

  return (
    <>
      {/* Modelo 3D */}
      <primitive object={scene} scale={1} />

      {/* Confrontantes */}
      {mostrarConfrontantes &&
        lados.map((lado, i) => (
          <Confrontante key={i} {...lado} />
        ))}
    </>
  );
}
