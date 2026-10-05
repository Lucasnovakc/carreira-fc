import { useCarreira } from '../estado/CarreiraContext.jsx';
import { DistintivoClube, clubeVisual } from '../componentes/Distintivo.jsx';
import { totalTitulos } from '../logica/temporada.js';

// Aparece ao abrir o jogo quando existe carreira salva.
export function Inicio({ onContinuar }) {
  const { carreira, dados, encerrar } = useCarreira();
  const clube = clubeVisual(dados, carreira.config.clubeId);
  return (
    <div className="app">
      <h1 className="tela-titulo">Carreira FC</h1>
      <p className="subtitulo">Monte seu time na roleta e escreva a história do clube.</p>
      <div className="cartao realce">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <DistintivoClube dados={dados} id={carreira.config.clubeId} tamanho={48} />
          <div>
            <b>{clube.nome}</b>
            <div className="muted">
              {carreira.fase === 'draft' ? 'Montando o elenco' : `Temporada ${carreira.temporada} de ${carreira.config.duracao}`}
              {' · '}🏆 {totalTitulos(carreira)}
            </div>
          </div>
        </div>
        <div style={{ height: 12 }} />
        <button className="botao primario" onClick={onContinuar}>Continuar</button>
      </div>
      <button className="botao" onClick={() => {
        if (window.confirm('Começar outra carreira? A carreira atual será apagada.')) encerrar();
      }}>Nova carreira</button>
    </div>
  );
}
