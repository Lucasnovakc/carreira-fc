import { useState } from 'react';
import { jogarData } from '../../engine/carreira.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { DistintivoClube, clubeVisual } from '../componentes/Distintivo.jsx';
import { infoProximoJogo, ultimosResultados, resultadoDoUsuario, simularAteImportante, nomeCompeticao } from '../logica/temporada.js';
import { Partida } from './Partida.jsx';

function Resumo({ jogos, onFechar }) {
  const { carreira, dados } = useCarreira();
  const eu = carreira.config.clubeId;
  return (
    <div className="cartao realce">
      <div className="secao" style={{ marginTop: 0 }}>{jogos.length === 1 ? 'Resultado' : `${jogos.length} jogos simulados`}</div>
      <div className="lista">
        {jogos.map((j, i) => {
          const r = resultadoDoUsuario(j, eu);
          return (
            <div key={i} className="linha">
              <span className={`bolinha ${r.letra}`}>{r.letra}</span>
              <span className="grow">{r.meus} x {r.deles} {r.emCasa ? 'vs' : '@'} {clubeVisual(dados, r.adversario).nome}
                {r.penaltis && <span className="muted"> (pên. {r.penaltis.meus}x{r.penaltis.deles})</span>}</span>
              <span className="muted">{nomeCompeticao(j.compId, carreira, dados)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ height: 8 }} />
      <button className="botao" onClick={onFechar}>OK</button>
    </div>
  );
}

export function AbaJogo({ onAjustar }) {
  const { carreira, dados, executar } = useCarreira();
  const [aoVivo, setAoVivo] = useState(false);
  const [resumo, setResumo] = useState(null);
  const info = infoProximoJogo(carreira, dados);
  const eu = carreira.config.clubeId;
  const fora = Object.values(carreira.elenco.jogadores).filter((j) => j.fora || j.suspenso);

  const simular = () => {
    const antes = carreira.temporadaAtual.jogos.length;
    const nova = executar((c) => jogarData(c, dados));
    if (nova && nova.fase === 'temporada' && nova.temporadaAtual.jogos.length > antes) setResumo([nova.temporadaAtual.jogos.at(-1)]);
  };
  const ateImportante = () => {
    let jogos = [];
    const nova = executar((c) => { const r = simularAteImportante(c, dados); jogos = r.jogos; return r.carreira; });
    if (nova && nova.fase === 'temporada' && jogos.length) setResumo(jogos);
  };

  if (aoVivo) return <Partida info={info} onFechar={() => setAoVivo(false)} />;

  return (
    <>
      {resumo && <Resumo jogos={resumo} onFechar={() => setResumo(null)} />}
      <div className="cartao realce">
        <span className="chip destaque">{info.titulo}</span>
        {info.importante && <span className="chip aviso" style={{ marginLeft: 6 }}>Importante</span>}
        {info.jogo ? (
          <>
            <div className="vs">
              <div style={{ textAlign: 'center' }}><DistintivoClube dados={dados} id={info.jogo.casa} tamanho={52} /><div className="nome">{clubeVisual(dados, info.jogo.casa).nome}</div></div>
              <span>x</span>
              <div style={{ textAlign: 'center' }}><DistintivoClube dados={dados} id={info.jogo.fora} tamanho={52} /><div className="nome">{clubeVisual(dados, info.jogo.fora).nome}</div></div>
            </div>
            <p className="muted" style={{ textAlign: 'center', margin: '0 0 10px' }}>
              {info.mando === 'neutro' ? 'Campo neutro' : info.mando === 'casa' ? 'Você joga em casa' : 'Você joga fora'}
              {info.ida && ` · Ida: ${clubeVisual(dados, info.ida.casa).sigla} ${info.ida.golsCasa} x ${info.ida.golsFora} ${clubeVisual(dados, info.ida.fora).sigla}`}
            </p>
            <div className="botoes">
              <button className="botao primario" onClick={() => setAoVivo(true)}>▶ Assistir</button>
              <button className="botao" onClick={simular}>Simular</button>
              <button className="botao" onClick={ateImportante} disabled={info.importante}>⏩ Até importante</button>
            </div>
          </>
        ) : (
          <>
            <p className="subtitulo" style={{ marginTop: 12 }}>Rodada sem jogo do seu time.</p>
            <div className="botoes">
              <button className="botao primario" onClick={simular}>Avançar</button>
              <button className="botao" onClick={ateImportante}>⏩ Até importante</button>
            </div>
          </>
        )}
      </div>

      {fora.length > 0 && (
        <div className="cartao">
          <div className="lista">
            {fora.map((j) => (
              <div key={j.id} className="muted">{j.fora ? `🚑 ${j.nome} fora por ${j.fora} jogo(s)` : `🟥 ${j.nome} suspenso`}</div>
            ))}
          </div>
          <div style={{ height: 8 }} />
          <button className="botao" onClick={onAjustar}>Ajustar escalação</button>
        </div>
      )}

      <div className="secao">Últimos jogos</div>
      <div className="bolinhas">
        {ultimosResultados(carreira).map((r, i) => <span key={i} className={`bolinha ${r.letra}`} title={`${r.meus}x${r.deles}`}>{r.letra}</span>)}
        {carreira.temporadaAtual.jogos.length === 0 && <span className="muted">A temporada ainda não começou.</span>}
      </div>
      <p className="muted" style={{ marginTop: 14 }}>{clubeVisual(dados, eu).nome} · {carreira.elenco.formacao} · postura {carreira.elenco.postura}</p>
    </>
  );
}
