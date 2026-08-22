import { Component } from "react";

// Precisa ser um componente de classe (Error Boundary só funciona
// assim em React). Envolve o <Canvas> inteiro: erros de carregamento
// do GLTF (404, CORS, arquivo corrompido) sobem até aqui mesmo vindo
// de dentro do Canvas - esse é o padrão suportado pelo react-three-fiber.
export class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Log técnico detalhado no console, para diagnóstico (fica de fora
    // da mensagem amigável mostrada ao usuário).
    console.error("Falha ao carregar o terreno 3D:", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
