import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState } from "react";
import { Terrenos } from "./components/Terrenos";

function App() {
  const [interagindo, setInteragindo] = useState(false);
  const [ativo, setAtivo] = useState(1);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",

        // GRID FIXO
        backgroundColor: "#ffffff",
        backgroundImage: `
          linear-gradient(#e5e5e5 1px, transparent 1px),
          linear-gradient(90deg, #e5e5e5 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }}
    >
      {/* BOTÕES */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 10,
        }}
      >
        <button onClick={() => setAtivo(1)}>Terreno 1</button>
        <button onClick={() => setAtivo(2)}>Terreno 2</button>
      </div>

      <Canvas
        camera={{ position: [10, 10, 10], fov: 50 }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 10]} />

        <Terrenos
          ativo={ativo}
          mostrarConfrontantes={!interagindo}
        />

        <OrbitControls
          onStart={() => setInteragindo(true)}
          onEnd={() => setInteragindo(false)}
        />
      </Canvas>
    </div>
  );
}

export default App;