import { Canvas } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import { Suspense, useState } from "react";
import { Terrenos } from "./components/Terrenos";
import { StatusScreen } from "./components/StatusScreen";
import { ModelErrorBoundary } from "./components/ModelErrorBoundary";
import { cartographicBackground } from "./theme";

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// window.location já está disponível de forma síncrona (SPA pura, sem
// SSR), então não precisa de useEffect pra isso - calcular direto no
// useState evita um render extra e o problema de setState em effect.
function computeInitialStatus() {
  const params = new URLSearchParams(window.location.search);
  // URLSearchParams já decodifica o valor automaticamente.
  const urlParam = params.get("url");

  if (!urlParam || !urlParam.trim()) {
    return { state: "missing" };
  }

  if (!isValidHttpUrl(urlParam)) {
    console.error("URL do terreno inválida:", urlParam);
    return { state: "invalid" };
  }

  return { state: "ready", url: urlParam };
}

// Overlay de carregamento (usa o useProgress do drei, que já
// acompanha o useGLTF automaticamente - nenhuma dependência nova).
function LoadingOverlay() {
  const { active, progress } = useProgress();

  if (!active) return null;

  return (
    <div style={styles.loadingOverlay}>
      <p style={{ margin: 0, fontWeight: 600, color: "#2c3e2f" }}>
        Carregando terreno...
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
        {Math.round(progress)}%
      </p>
    </div>
  );
}

function App() {
  // "missing" | "invalid" | "ready"
  const [status] = useState(computeInitialStatus);

  if (status.state === "missing") {
    return <StatusScreen title="Nenhum terreno foi informado." />;
  }

  if (status.state === "invalid") {
    return (
      <StatusScreen
        title="Não foi possível carregar o terreno."
        subtitle="A URL informada não é válida."
      />
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", ...cartographicBackground }}>
      <ModelErrorBoundary
        fallback={
          <StatusScreen
            title="Não foi possível carregar o terreno."
            subtitle="Verifique sua conexão e tente novamente."
          />
        }
      >
        <Canvas
          camera={{ position: [14, 12, 15], fov: 50 }}
          style={{ background: "transparent" }}
        >
          {/* Luz suave */}
          <ambientLight intensity={1.5} />

          {/* Luz principal */}
          <directionalLight position={[10, 15, 10]} intensity={2} />

          {/* Terreno */}
          <Suspense fallback={null}>
            <Terrenos url={status.url} />
          </Suspense>

          {/* Controles */}
          <OrbitControls enablePan enableZoom enableRotate />
        </Canvas>

        <LoadingOverlay />
      </ModelErrorBoundary>
    </div>
  );
}

const styles = {
  loadingOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    padding: "14px 22px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    textAlign: "center",
    pointerEvents: "none",
  },
};

export default App;
