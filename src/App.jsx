import { Canvas } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
import { Terrenos } from "./components/Terrenos";
import { Confrontantes } from "./components/Confrontantes";
import { StatusScreen } from "./components/StatusScreen";
import { ModelErrorBoundary } from "./components/ModelErrorBoundary";
import { cartographicBackground } from "./theme";
import { buscarTerrenoPublico } from "./backend";

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function computeInitialStatus() {
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get("url");
  // Além da URL do GLB (já existente), a matrícula é o identificador
  // usado pra buscar confrontantes/planta/memorial no Backend (GET
  // /terreno-publico/:matricula). Terrenos antigos, ou links que ainda
  // não passam esse parâmetro, continuam funcionando normalmente --
  // só ficam sem o botão Confrontantes funcional (ETAPA 3, seção 11).
  const matricula = params.get("matricula");

  if (!urlParam || !urlParam.trim()) {
    return { state: "missing" };
  }

  if (!isValidHttpUrl(urlParam)) {
    console.error("URL do terreno inválida:", urlParam);
    return { state: "invalid" };
  }

  return { state: "ready", url: urlParam, matricula };
}

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
  const [status] = useState(computeInitialStatus);
  const [terrenoNode, setTerrenoNode] = useState(null);
  const [modoConfrontantes, setModoConfrontantes] = useState(false);
  // "sem-matricula" | "carregando" | "ok" | "erro" -- ver seções 11 e
  // 16 da ETAPA 3: em qualquer caso que não seja "ok", o visualizador
  // continua funcionando normalmente, só o botão Confrontantes muda de
  // mensagem.
  const [dadosTerreno, setDadosTerreno] = useState(null);
  const [statusDados, setStatusDados] = useState(
    status.matricula ? "carregando" : "sem-matricula"
  );

  useEffect(() => {
    if (status.state !== "ready" || !status.matricula) return;

    let cancelado = false;

    buscarTerrenoPublico(status.matricula).then((dados) => {
      if (cancelado) return;
      if (!dados) {
        setStatusDados("erro");
        return;
      }
      setDadosTerreno(dados);
      setStatusDados("ok");
    });

    return () => {
      cancelado = true;
    };
  }, [status.state, status.matricula]);

  // Só desenha linhas/textos quando TUDO que a fórmula de
  // transformação precisa está disponível -- nunca uma aproximação
  // (ETAPA 3, seções 10 e 16): o GLB tem o node com o origin do Topo
  // Textura, o Backend respondeu com sucesso, e existe pelo menos um
  // confrontante cadastrado.
  const dadosProntos =
    statusDados === "ok" &&
    !!terrenoNode &&
    dadosTerreno?.origin_x != null &&
    dadosTerreno?.origin_y != null &&
    (dadosTerreno?.confrontantes?.length ?? 0) > 0;

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
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        ...cartographicBackground,
      }}
    >
      <ModelErrorBoundary
        fallback={
          <StatusScreen
            title="Não foi possível carregar o terreno."
            subtitle="Verifique sua conexão e tente novamente."
          />
        }
      >
        <Canvas
          camera={{
            position: [8, 6, 8],
            fov: 50,
            near: 0.01,
            far: 1000000,
          }}
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
          }}
          gl={{ antialias: true, alpha: true, logarithmicDepthBuffer: true }}
        >
          <ambientLight intensity={2.5} />
          <directionalLight position={[16, 15, 10]} intensity={2} />

          <Suspense fallback={null}>
            <Terrenos
              url={status.url}
              onTerrenoNode={setTerrenoNode}
              modoConfrontantes={modoConfrontantes}
            />
            {dadosProntos && (
              <Confrontantes
                terrenoNode={terrenoNode}
                dados={dadosTerreno}
                visivel={modoConfrontantes}
              />
            )}
          </Suspense>

          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            enableRotate
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.8}
            zoomSpeed={0.9}
            panSpeed={0.8}
            minDistance={0.01}
            maxDistance={1000000}
          />
        </Canvas>

        <LoadingOverlay />

        <BarraDeAcoes
          modoConfrontantes={modoConfrontantes}
          onToggleConfrontantes={() => setModoConfrontantes((v) => !v)}
          mostrarAvisoSemDados={modoConfrontantes && !dadosProntos}
          plantaUrl={dadosTerreno?.planta_url}
          memorialUrl={dadosTerreno?.memorial_url}
        />
      </ModelErrorBoundary>
    </div>
  );
}

// [ Confrontantes ] [ Planta ] [ Memorial ] -- ETAPA 3, seção 14. Só
// os controles necessários, sem redesenhar o resto da interface.
function BarraDeAcoes({
  modoConfrontantes,
  onToggleConfrontantes,
  mostrarAvisoSemDados,
  plantaUrl,
  memorialUrl,
}) {
  const abrirPdf = (url) => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <div style={styles.barra}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onToggleConfrontantes}
          style={{
            ...styles.botao,
            ...(modoConfrontantes ? styles.botaoAtivo : null),
          }}
        >
          Confrontantes
        </button>
        {plantaUrl && (
          <button type="button" style={styles.botao} onClick={() => abrirPdf(plantaUrl)}>
            Planta
          </button>
        )}
        {memorialUrl && (
          <button type="button" style={styles.botao} onClick={() => abrirPdf(memorialUrl)}>
            Memorial
          </button>
        )}
      </div>

      {mostrarAvisoSemDados && (
        <p style={styles.aviso}>
          Não há dados de confrontantes cadastrados para este terreno.
        </p>
      )}
    </div>
  );
}

const styles = {
  barra: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-start",
  },
  botao: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.92)",
    color: "#2c3e2f",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  botaoAtivo: {
    background: "#22c55e",
    color: "#ffffff",
    borderColor: "#22c55e",
  },
  aviso: {
    margin: 0,
    padding: "8px 12px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.92)",
    color: "#7a4a00",
    fontSize: 12,
    maxWidth: 260,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
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
