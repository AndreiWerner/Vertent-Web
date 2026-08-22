// Fundo cartográfico compartilhado entre o viewer 3D e as telas de
// mensagem (sem terreno / erro), pra manter a mesma identidade visual
// em qualquer estado da aplicação.
export const cartographicBackground = {
  backgroundColor: "#ffffff",
  backgroundImage: `
    linear-gradient(#e5e5e5 1px, transparent 1px),
    linear-gradient(90deg, #e5e5e5 1px, transparent 1px)
  `,
  backgroundSize: "40px 40px",
};
