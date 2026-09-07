// URL do Backend já usada hoje pelo terreno-app (React Native) para
// login -- ver terreno-app/app/login.tsx. Reaproveitada aqui para que
// o Vertente Web busque os dados do terreno (pontos, confrontantes,
// planta, memorial) SEMPRE através do Backend, nunca de um banco
// direto -- ver endpoint público GET /terreno-publico/:matricula.
const BACKEND_URL = "https://vertent-backend-5.onrender.com";

/**
 * Busca os dados públicos de um terreno pela matrícula.
 *
 * Nunca lança: em caso de falha de rede, matrícula inexistente, ou
 * resposta inesperada do Backend, resolve com `null` -- o visualizador
 * precisa continuar funcionando (GLB carregando normalmente) mesmo
 * que essa chamada falhe (ver App.jsx).
 */
export async function buscarTerrenoPublico(matricula) {
  if (!matricula || !matricula.trim()) return null;

  try {
    const resposta = await fetch(
      `${BACKEND_URL}/terreno-publico/${encodeURIComponent(matricula.trim())}`
    );

    if (!resposta.ok) {
      console.error(
        `Backend respondeu ${resposta.status} para /terreno-publico/${matricula}`
      );
      return null;
    }

    return await resposta.json();
  } catch (err) {
    console.error("Falha ao buscar dados do terreno no Backend:", err);
    return null;
  }
}
