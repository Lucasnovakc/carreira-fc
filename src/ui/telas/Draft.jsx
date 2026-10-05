import { useState } from 'react';
import { girarDraft, usarCuringa, escolherNoDraft } from '../../engine/carreira.js';
import { vagasDaFormacao, TAMANHO_BANCO } from '../../engine/elenco.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { Campinho } from '../componentes/Campinho.jsx';
import { Roleta } from '../componentes/Roleta.jsx';
import { avaliarVaga } from '../logica/escalacao.js';

export function Draft() {
  const { carreira, dados, executar } = useCarreira();
  const { draft, elenco, config } = carreira;
  const olheiro = config.dificuldade === 'olheiro';
  const vagas = vagasDaFormacao(elenco.formacao);
  const titulares = elenco.titulares.map((id) => (id ? elenco.jogadores[id] : null));
  const banco = Object.values(elenco.jogadores).filter((j) => !elenco.titulares.includes(j.id));
  const total = Object.keys(elenco.jogadores).length;
  const [revelado, setRevelado] = useState(Boolean(draft.atual)); // false enquanto a roleta gira
  const [escolhido, setEscolhido] = useState(null);
  const [destino, setDestino] = useState(null); // vaga (índice) ou 'banco', aguardando confirmação
  const jogador = draft.atual?.opcoes.find((j) => j.id === escolhido) ?? null;
  const elencoAtual = draft.atual && dados.elencos.find((e) => e.id === draft.atual.elencoId);

  const escolher = (id) => { setEscolhido(id); setDestino(null); };
  const girar = () => { setRevelado(false); escolher(null); executar((c) => girarDraft(c, dados)); };
  const confirmar = () => {
    if (!jogador || destino === null) return;
    if (executar((c) => escolherNoDraft(c, dados, jogador.id, destino))) escolher(null);
  };
  const textoDestino = destino === 'banco' ? 'no banco'
    : destino !== null ? `como ${vagas[destino]} · ${avaliarVaga(jogador, vagas[destino], config.dificuldade).texto}` : '';

  return (
    <div className="app">
      <div className="topo"><span>Montando o elenco</span><span>{total}/15 · curingas: {draft.curingas}</span></div>
      <h1 className="tela-titulo">Draft</h1>
      <p className="subtitulo">{jogador ? `Toque numa vaga livre para ${jogador.nome}.` : 'Gire a roleta e escolha um jogador do elenco sorteado.'}</p>

      <Campinho vagas={vagas} ocupantes={titulares} alvos={Boolean(jogador)} mostrarOvr={!olheiro}
        selecionada={typeof destino === 'number' ? destino : null}
        avaliacao={jogador ? (i) => (titulares[i] ? null : avaliarVaga(jogador, vagas[i], config.dificuldade).texto) : undefined}
        onVaga={(i) => jogador && !titulares[i] && setDestino(i)} />

      {jogador && destino !== null && (
        <div className="cartao realce" style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 10px' }}>Colocar <b>{jogador.nome}</b> {textoDestino}?</p>
          <div className="botoes">
            <button className="botao primario" onClick={confirmar}>Confirmar</button>
            <button className="botao" onClick={() => setDestino(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="secao">Banco ({banco.length}/{TAMANHO_BANCO})</div>
      <div className="lista">
        {banco.map((j) => (
          <div key={j.id} className="linha"><span className="pos">{j.pos}</span><span className="grow">{j.nome}</span>{!olheiro && <span className="ovr">{j.ovr}</span>}</div>
        ))}
        {jogador && banco.length < TAMANHO_BANCO && (
          <button className="botao" onClick={() => setDestino('banco')}>Colocar {jogador.nome} no banco</button>
        )}
      </div>

      <div className="secao">Roleta</div>
      {draft.atual ? (
        <>
          <Roleta elencos={dados.elencos} alvoId={draft.atual.elencoId} onFim={() => setRevelado(true)} />
          {revelado && (
            <>
              <h2 style={{ fontSize: 16, margin: '12px 0 6px' }}>{elencoAtual.clube} {elencoAtual.ano}</h2>
              <div className="lista">
                {draft.atual.opcoes.map((j) => (
                  <button key={j.id} className={`linha ${escolhido === j.id ? 'on' : ''}`} onClick={() => escolher(j.id)}>
                    <span className="pos">{j.pos}</span>
                    <span className="grow">{j.nome} <span className="muted">· {j.idade} anos</span></span>
                    {!olheiro && <span className="ovr">{j.ovr}</span>}
                  </button>
                ))}
              </div>
              <div style={{ height: 10 }} />
              <button className="botao" disabled={draft.curingas === 0} onClick={() => { escolher(null); executar((c) => usarCuringa(c)); }}>
                Usar curinga ({draft.curingas})
              </button>
            </>
          )}
        </>
      ) : (
        <button className="botao primario" onClick={girar}>⚽ Puxar a alavanca</button>
      )}
    </div>
  );
}
