import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
import { Terrenos } from "./components/Terrenos";

function ViewerLoading() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        color: "#16241c",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      Carregando terreno...
    </div>
  );
}

function App() {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url");

    if (!urlParam) {
      setErro("Nenhum terreno foi informado.");
      return;
    }

    setUrl(urlParam);
  }, []);

  if (erro) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#16241c",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {erro}
      </div>
    );
  }

  if (!url) return <ViewerLoading />;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#ffffff",
        backgroundImage: `
          linear-gradient(#e5e5e5 1px, transparent 1px),
          linear-gradient(90deg, #e5e5e5 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }}
    >
      <Canvas
        camera={{ position: [14, 12, 15], fov: 50 }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 15, 10]} intensity={2} />

        <Suspense fallback={null}>
          <Terrenos url={url} />
        </Suspense>

        <OrbitControls enablePan enableZoom enableRotate />
      </Canvas>
    </div>
  );
}

export default App;
