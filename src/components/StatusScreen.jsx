import { cartographicBackground } from "../theme";

// Tela de mensagem amigável (sem terreno informado, URL inválida, ou
// falha ao carregar o GLB). Precisa funcionar bem dentro do WebView
// do app mobile também, por isso é só HTML/CSS simples, sem depender
// de mouse/hover.
export function StatusScreen({ title, subtitle }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <p style={styles.title}>{title}</p>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    boxSizing: "border-box",
    fontFamily: "system-ui, -apple-system, sans-serif",
    ...cartographicBackground,
  },
  card: {
    textAlign: "center",
    background: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    padding: "20px 28px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    maxWidth: 340,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: "#2c3e2f",
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: 13,
    color: "#777",
  },
};
