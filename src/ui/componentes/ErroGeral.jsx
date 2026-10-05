import { Component } from 'react';
import { apagar } from '../../storage/index.js';

// Se algo quebrar ao desenhar a tela (ex.: save estranho), mostra uma saída em vez de tela branca.
export class ErroGeral extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;
    const recarregar = this.props.aoRecarregar ?? (() => window.location.reload());
    return (
      <div className="app">
        <h1 className="tela-titulo">Algo deu errado</h1>
        <p className="subtitulo">{erro.message}</p>
        <button className="botao primario" onClick={() => this.setState({ erro: null })}>Tentar de novo</button>
        <div style={{ height: 10 }} />
        <button className="botao perigo" onClick={() => {
          if (window.confirm('Apagar a carreira salva e começar do zero?')) { apagar(); recarregar(); }
        }}>Apagar carreira salva</button>
      </div>
    );
  }
}
