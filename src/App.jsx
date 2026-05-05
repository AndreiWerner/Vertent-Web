import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useState } from "react";
import { Terrenos } from "./components/Terrenos";

function App() {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url");

    if (urlParam) {
      setUrl(urlParam);
    } else {
      setUrl("http://localhost:5174/models/terreno.glb");
    }
  }, []);

  if (!url) return <p>Carregando...</p>;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",

        // 🔥 FUNDO CARTOGRÁFICO
        backgroundColor: "#ffffff",
        backgroundImage: `
          linear-gradient(#e5e5e5 1px, transparent 1px),
          linear-gradient(90deg, #e5e5e5 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }}
    >
      <Canvas
        camera={{ position: [15, 12, 15], fov: 50 }}
        style={{ background: "transparent" }}
      >
        {/* Luz suave */}
        <ambientLight intensity={1.5} />

        {/* Luz principal */}
        <directionalLight position={[10, 15, 10]} intensity={2} />

        {/* Terreno */}
        <Terrenos url={url} />

        {/* Controles */}
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
        />
      </Canvas>
    </div>
  );
}

export default App;