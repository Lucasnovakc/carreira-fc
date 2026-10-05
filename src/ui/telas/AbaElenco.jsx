import { useState } from 'react';
import formacoes from '../../data/formacoes.json';
import { definirTatica } from '../../engine/carreira.js';
import { vagasDaFormacao } from '../../engine/elenco.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { Campinho } from '../componentes/Campinho.jsx';
import { reorganizar } from '../logica/escalacao.js';

// Toque em dois jogadores (no campo ou no banco) para trocá-los de lugar.
export function AbaElenco() {
  const { carreira, executar } = useCarreira();
  const { elenco, config } = carreira;
  const olheiro = config.dificuldade === 'olheiro';
  const vagas = vagasDaFormacao(elenco.formacao);
  const titulares = elenco.titulares.map((id) => (id ? elenco.jogadores[id] : null));
  const reservas = Object.values(elenco.jogadores).filter((j) => !elenco.titulares.includes(j.id));
  const gols = carreira.temporadaAtual?.gols ?? {};
  const [sel, setSel] = useState(null); // { tipo: 'vaga', i } | { tipo: 'reserva', id }

  const tocar = (alvo) => {
    if (!sel) return setSel(alvo);
    const t = [...elenco.titulares];
    if (sel.tipo === 'vaga' && alvo.tipo === 'vaga') [t[sel.i], t[alvo.i]] = [t[alvo.i], t[sel.i]];
    else if (sel.tipo === 'vaga' && alvo.tipo === 'reserva') t[sel.i] = alvo.id;
    else if (sel.tipo === 'reserva' && alvo.tipo === 'vaga') t[alvo.i] = sel.id;
    else return setSel(alvo);
    setSel(null);
    executar((c) => definirTatica(c, { titulares: t }));
  };

  const mudarFormacao = (id) => {
    const jogadoresEmCampo = titulares.filter(Boolean);
    executar((c) => definirTatica(c, { formacao: id, titulares: reorganizar(jogadoresEmCampo, vagasDaFormacao(id)) }));
  };

  return (
    <>
      <p className="subtitulo">Toque em dois jogadores para trocá-los de lugar.</p>
      <Campinho vagas={vagas} ocupantes={titulares} mostrarOvr={!olheiro}
        selecionada={sel?.tipo === 'vaga' ? sel.i : null} onVaga={(i) => tocar({ tipo: 'vaga', i })} />

      <div className="secao">Reservas</div>
      <div className="lista">
        {reservas.map((j) => (
          <button key={j.id} className={`linha ${sel?.id === j.id ? 'on' : ''}`} onClick={() => tocar({ tipo: 'reserva', id: j.id })}>
            <span className="pos">{j.pos}</span><span className="grow">{j.nome}</span>
            {j.fora > 0 && <span>🚑{j.fora}</span>}{j.suspenso > 0 && <span>🟥</span>}
            {!olheiro && <span className="ovr">{j.ovr}</span>}
          </button>
        ))}
      </div>

      <div className="secao">Formação</div>
      <div className="segmentos">
        {formacoes.map((f) => (
          <button key={f.id} className={`opcao ${elenco.formacao === f.id ? 'on' : ''}`} onClick={() => mudarFormacao(f.id)}>{f.id}</button>
        ))}
      </div>

      <div className="secao">Postura</div>
      <div className="segmentos">
        {['defensiva', 'equilibrada', 'ofensiva'].map((p) => (
          <button key={p} className={`opcao ${elenco.postura === p ? 'on' : ''}`} onClick={() => executar((c) => definirTatica(c, { postura: p }))}>
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="secao">Elenco</div>
      <div className="lista">
        {Object.values(elenco.jogadores).map((j) => (
          <div key={j.id} className="linha">
            <span className="pos">{j.pos}</span>
            <span className="grow">{j.nome} <span className="muted">· {j.idade} anos · {j.origem}</span></span>
            {gols[j.id] > 0 && <span className="muted">⚽{gols[j.id]}</span>}
            {j.fora > 0 && <span>🚑{j.fora}</span>}{j.suspenso > 0 && <span>🟥</span>}
            {!olheiro && <span className="ovr">{j.ovr}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
