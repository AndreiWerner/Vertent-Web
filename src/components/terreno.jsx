import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";

export default function Terreno() {
  const params = useLocalSearchParams();

  const url = params.url;
  const matricula = params.matricula;
  const area = params.area;
  const perimetro = params.perimetro;
  const alturaMax = params.altura_max;
  const alturaMin = params.altura_min;

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>Registro do Terreno</Text>
        <Text style={styles.headerTitle}>
          Matrícula • {matricula}
        </Text>
      </View>

      {/* 🔥 WEBVIEW COM GLB DINÂMICO */}
    <WebView
  source={{ uri: url }}
  javaScriptEnabled={true}
  domStorageEnabled={true}
  originWhitelist={["*"]}
  mixedContentMode="always"
  allowFileAccess={true}
  allowsInlineMediaPlayback={true}
  mediaPlaybackRequiresUserAction={false}
  startInLoadingState={true}
  renderLoading={() => (
    <ActivityIndicator size="large" style={{ flex: 1 }} />
  )}
  style={{ flex: 1 }}
/>

      {/* CARD */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📐 Informações Técnicas</Text>

        <View style={styles.grid}>
          <Info label="Área" value={area} />
          <Info label="Perímetro" value={perimetro} />
          <Info label="Altura Máx." value={alturaMax} />
          <Info label="Altura Mín." value={alturaMin} />
        </View>
      </View>

    </View>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: "rgba(15,15,15,0.9)",
    zIndex: 10,
  },

  headerSubtitle: {
    color: "#aaa",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 2,
  },

  card: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    padding: 18,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 14,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  infoBox: {
    width: "48%",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f4f6f8",
    marginBottom: 12,
  },

  infoLabel: {
    fontSize: 12,
    color: "#777",
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111",
  },
});