import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { Terreno } from "./components/terreno";
import { useRef, useState } from "react";

function App() {
  const timeoutRef = useRef();
  const [mostrarConfrontantes, setMostrarConfrontantes] = useState(true);

  function handleCameraChange() {
    // esconde imediatamente ao mover
    setMostrarConfrontantes(false);

    // limpa timeout anterior
    clearTimeout(timeoutRef.current);

    // mostra novamente após parar
    timeoutRef.current = setTimeout(() => {
      setMostrarConfrontantes(true);
    }, 300); // 300ms após parar de mexer
  }

  return (
    <Canvas
      camera={{ position: [10, 10, 10], fov: 25 }}
      style={{ width: "100vw", height: "100vh" }}
      gl={{ preserveDrawingBuffer: true }}
      dpr={[1, 1.5]}
    >
      {/* Fundo cartográfico */}
      <color attach="background" args={["#f8f8f89a"]} />

      {/* Grade UTM */}
      <Grid
        args={[200, 200]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#ffffff"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#ffffff"
        fadeDistance={80}
        fadeStrength={1}
      />

      {/* Luz */}
      <ambientLight intensity={3.1} />
      <directionalLight position={[2, 4, 5]} intensity={1} />

      {/* Terreno */}
      <Terreno mostrarConfrontantes={mostrarConfrontantes} />
      

      {/* Controles */}
      <OrbitControls onChange={handleCameraChange} />
    </Canvas>
  );
}

export default App;
