import { posicoesNoCampo } from '../logica/escalacao.js';

// vagas: ['GOL', ...]; ocupantes: [jogador | null] alinhado às vagas
// selecionada: índice destacado; avaliacao(i): texto extra na vaga (ex.: overall efetivo)
export function Campinho({ vagas, ocupantes, selecionada = null, alvos = false, avaliacao, onVaga, mostrarOvr = true }) {
  const pos = posicoesNoCampo(vagas);
  return (
    <div className="campinho">
      {vagas.map((vaga, i) => {
        const j = ocupantes[i];
        const classes = ['vaga', j ? '' : 'vazia', selecionada === i ? 'on' : '', alvos && !j ? 'alvo' : ''].join(' ');
        const extra = avaliacao?.(i);
        return (
          <button key={i} type="button" className={classes} style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%` }}
            onClick={() => onVaga?.(i)} aria-label={`Vaga ${vaga}${j ? `: ${j.nome}` : ' vazia'}`}>
            <span className="muted">{vaga}</span>
            {j ? <b>{j.nome}</b> : <b>—</b>}
            {extra ? <span className="avaliacao">{extra}</span> : j && mostrarOvr && <span className="avaliacao">{j.ovr}</span>}
          </button>
        );
      })}
    </div>
  );
}
