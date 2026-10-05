import { useState } from 'react';
import { ordenarTabela } from '../../engine/liga.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { clubeVisual } from '../componentes/Distintivo.jsx';
import { nomeCompeticao, ORDEM_COMPETICOES } from '../logica/temporada.js';

function faixa(compId, chave, pos) {
  if (compId === 'brasileirao') {
    if (pos <= 4) return 'faixa-g4';
    if (pos <= 10) return 'faixa-sul';
    if (pos >= 17) return 'faixa-z4';
    return '';
  }
  if (compId === 'estadual') return pos <= 4 ? 'faixa-classifica' : '';
  return chave !== 'geral' && pos <= 2 ? 'faixa-classifica' : '';
}

function Tabela({ compId, chave, linhas }) {
  const { carreira, dados } = useCarreira();
  const eu = carreira.config.clubeId;
  return (
    <table className="tabela">
      <thead><tr><th>#</th><th>Clube</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>GP</th></tr></thead>
      <tbody>
        {ordenarTabela(linhas).map((l, i) => (
          <tr key={l.id} className={`${l.id === eu ? 'eu' : ''} ${faixa(compId, chave, i + 1)}`}>
            <td>{i + 1}</td><td>{clubeVisual(dados, l.id).nome}</td><td><b>{l.pts}</b></td><td>{l.j}</td><td>{l.v}</td><td>{l.e}</td><td>{l.d}</td><td>{l.gp - l.gc}</td><td>{l.gp}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Chave({ fase }) {
  const { carreira, dados } = useCarreira();
  const eu = carreira.config.clubeId;
  const sigla = (id) => clubeVisual(dados, id).sigla;
  return (
    <div className="cartao">
      <div className="secao" style={{ marginTop: 0 }}>{fase.nome}</div>
      <div className="lista">
        {fase.pares.map(([a, b], i) => {
          const ida = fase.idas[i];
          const volta = fase.voltas?.[i];
          const pen = fase.penaltis?.[i];
          const venc = fase.vencedores[i];
          const meu = a === eu || b === eu;
          return (
            <div key={i} className="linha" style={meu ? { borderColor: 'var(--destaque)' } : undefined}>
              <span className="grow">
                <b style={venc === a ? { color: 'var(--destaque)' } : undefined}>{sigla(a)}</b> x <b style={venc === b ? { color: 'var(--destaque)' } : undefined}>{sigla(b)}</b>
              </span>
              <span className="muted">
                {fase.idaEVolta
                  ? `${ida ? `${ida.golsCasa}-${ida.golsFora}` : '–'} / ${volta ? `${volta.golsFora}-${volta.golsCasa}` : '–'}`
                  : volta ? `${volta.golsCasa}-${volta.golsFora}` : '–'}
                {pen && ` (pên. ${pen.casa}-${pen.fora})`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AbaTabelas() {
  const { carreira, dados } = useCarreira();
  const comps = carreira.temporadaAtual.competicoes;
  const ids = ORDEM_COMPETICOES.filter((id) => comps[id]);
  const [sel, setSel] = useState(ids.includes('brasileirao') ? 'brasileirao' : ids[0]);
  const comp = comps[sel];
  const chaves = Object.keys(comp.tabelas).sort();

  return (
    <>
      <div className="segmentos" style={{ marginBottom: 12 }}>
        {ids.map((id) => (
          <button key={id} className={`opcao ${sel === id ? 'on' : ''}`} onClick={() => setSel(id)}>{nomeCompeticao(id, carreira, dados)}</button>
        ))}
      </div>
      {comp.campeao && <div className="cartao realce">🏆 Campeão: <b>{clubeVisual(dados, comp.campeao).nome}</b></div>}
      {chaves.map((k) => (
        <div key={k} className="cartao">
          {k !== 'geral' && <div className="secao" style={{ marginTop: 0 }}>Grupo {k}</div>}
          <Tabela compId={sel} chave={k} linhas={comp.tabelas[k]} />
        </div>
      ))}
      {comp.fases.filter((f) => f.pares).map((f) => <Chave key={f.nome} fase={f} />)}
      {sel === 'brasileirao' && <p className="muted">Azul: Libertadores · Laranja: Sul-Americana · Vermelho: roleta ruim</p>}
    </>
  );
}
