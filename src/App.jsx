import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState } from "react";
import { Terreno } from "./components/terreno";

function App() {
  const [interagindo, setInteragindo] = useState(false);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",

        // GRID FIXO (CSS)
        backgroundColor: "#ffffff",
        backgroundImage: `
          linear-gradient(#e5e5e5 1px, transparent 1px),
          linear-gradient(90deg, #e5e5e5 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }}
    >
      <Canvas
        camera={{ position: [10, 10, 10], fov: 50 }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 10]} />

        <Terreno mostrarConfrontantes={!interagindo} />

        <OrbitControls
          onStart={() => setInteragindo(true)}
          onEnd={() => setInteragindo(false)}
        />
      </Canvas>
    </div>
  );
}

export default App;