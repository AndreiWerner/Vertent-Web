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

    const dados = await resposta.json();

    // [LOG TEMPORÁRIO DE DIAGNÓSTICO] Investigação: confrontantes
    // cadastrados no Admin não aparecem no app/Web. Sem CPF/senha/
    // token -- só contagens e a estrutura do primeiro confrontante.
    // Remover depois que o diagnóstico for confirmado em produção.
    console.log(
      `[WEB] parâmetro matrícula recebido: ${matricula}`
    );
    console.log(
      `[WEB] resposta de /terreno-publico -- origin_x=${dados?.origin_x} origin_y=${dados?.origin_y} ` +
        `pontos=${Array.isArray(dados?.pontos) ? dados.pontos.length : typeof dados?.pontos} ` +
        `confrontantes=${Array.isArray(dados?.confrontantes) ? dados.confrontantes.length : typeof dados?.confrontantes}`
    );
    if (Array.isArray(dados?.confrontantes) && dados.confrontantes[0]) {
      console.log(`[WEB] estrutura do primeiro confrontante: ${JSON.stringify(dados.confrontantes[0])}`);
    }

    return dados;
  } catch (err) {
    console.error("Falha ao buscar dados do terreno no Backend:", err);
    return null;
  }
}
