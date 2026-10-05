import { useState } from 'react';
import { girarTransferencia, aceitarTransferencia, recusarTransferencia, concluirTransferencias } from '../../engine/carreira.js';
import { TAMANHO_ELENCO } from '../../engine/elenco.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { Roleta } from '../componentes/Roleta.jsx';
import { nomeCompeticao, competicoesDaProxima, ORDEM_COMPETICOES } from '../logica/temporada.js';

const FICHA = { boa: '🟢 Boa', media: '🟡 Média', ruim: '🔴 Ruim', reposicao: '⚪ Reposição' };

function Resumo({ onSeguir }) {
  const { carreira, dados } = useCarreira();
  const h = carreira.historico.at(-1);
  const env = carreira.transferencias?.envelhecimento ?? [];
  return (
    <>
      <h1 className="tela-titulo">Temporada {h.temporada} de {carreira.config.duracao}</h1>
      <div className="cartao realce" style={{ textAlign: 'center' }}>
        {h.titulos.length ? (
          <>
            <div className="trofeu">{'🏆'.repeat(h.titulos.length)}</div>
            {h.titulos.map((t) => <div key={t}><b>{nomeCompeticao(t, carreira, dados)}</b></div>)}
          </>
        ) : <p className="subtitulo" style={{ margin: 0 }}>Sem títulos desta vez.</p>}
      </div>
      <div className="secao">Campanha</div>
      <div className="lista">
        {ORDEM_COMPETICOES.filter((id) => h.campanhas[id]).map((id) => (
          <div key={id} className="linha"><span className="grow">{nomeCompeticao(id, carreira, dados)}</span><b>{h.campanhas[id]}</b></div>
        ))}
      </div>
      {h.artilheiro && <p className="muted">Artilheiro: <b>{h.artilheiro.nome}</b> ({h.artilheiro.gols} gols)</p>}
      <div className="secao">Próxima temporada</div>
      <p className="muted">{competicoesDaProxima(carreira).map((id) => nomeCompeticao(id, carreira, dados)).join(' · ')}</p>
      {env.length > 0 && (
        <>
          <div className="secao">Evolução do elenco</div>
          <div className="lista">
            {env.map((e) => (
              <div key={e.id} className="linha">
                <span className="grow">{e.nome} <span className="muted">· {e.idade} anos</span></span>
                {e.aposentou
                  ? <span className="muted">pendurou as chuteiras</span>
                  : e.ovrDepois > e.ovrAntes ? <span className="evolucao-sobe">↑ {e.ovrDepois}</span>
                    : e.ovrDepois < e.ovrAntes ? <span className="evolucao-cai">↓ {e.ovrDepois}</span>
                      : <span className="muted">= {e.ovrDepois}</span>}
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ height: 14 }} />
      <button className="botao primario" onClick={onSeguir}>Ir para a janela de transferências</button>
    </>
  );
}

function Janela() {
  const { carreira, dados, executar } = useCarreira();
  const { transferencias: tr, elenco, config } = carreira;
  const olheiro = config.dificuldade === 'olheiro';
  const [revelado, setRevelado] = useState(Boolean(tr.atual));
  const [entra, setEntra] = useState(null);
  const [sai, setSai] = useState(null);
  const cheio = Object.keys(elenco.jogadores).length >= TAMANHO_ELENCO;
  const atual = tr.fila[0];
  const novo = tr.atual?.opcoes.find((j) => j.id === entra);
  const elencoSorteado = tr.atual && dados.elencos.find((e) => e.id === tr.atual.elencoId);
  const limpar = () => { setEntra(null); setSai(null); };

  if (!tr.fila.length) {
    return (
      <>
        <p className="subtitulo">Janela fechada.</p>
        <button className="botao primario" onClick={() => executar((c) => concluirTransferencias(c, dados))}>
          Começar a temporada {carreira.temporada + 1}
        </button>
      </>
    );
  }

  return (
    <>
      <div className="segmentos" style={{ marginBottom: 10 }}>
        {tr.fila.map((r, i) => <span key={i} className={`chip ${i === 0 ? 'destaque' : ''}`}>{FICHA[r.tipo]}{r.obrigatoria ? ' · obrigatória' : ''}</span>)}
      </div>
      {!tr.atual ? (
        <button className="botao primario" onClick={() => { setRevelado(false); limpar(); executar((c) => girarTransferencia(c, dados)); }}>
          Girar roleta {FICHA[atual.tipo]}
        </button>
      ) : (
        <>
          <Roleta elencos={dados.elencos} alvoId={tr.atual.elencoId} onFim={() => setRevelado(true)} />
          {revelado && (
            <>
              <h2 style={{ fontSize: 16, margin: '12px 0 6px' }}>{elencoSorteado.clube} {elencoSorteado.ano}</h2>
              <div className="lista">
                {tr.atual.opcoes.map((j) => (
                  <button key={j.id} className={`linha ${entra === j.id ? 'on' : ''}`} onClick={() => setEntra(j.id)}>
                    <span className="pos">{j.pos}</span><span className="grow">{j.nome} <span className="muted">· {j.idade} anos</span></span>
                    {!olheiro && <span className="ovr">{j.ovr}</span>}
                  </button>
                ))}
              </div>
              {novo && cheio && (
                <>
                  <div className="secao">Quem sai?</div>
                  <div className="lista">
                    {Object.values(elenco.jogadores).map((j) => (
                      <button key={j.id} className={`linha ${sai === j.id ? 'on' : ''}`} onClick={() => setSai(j.id)}>
                        <span className="pos">{j.pos}</span><span className="grow">{j.nome} <span className="muted">· {j.idade} anos</span></span>
                        {!olheiro && <span className="ovr">{j.ovr}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {novo && (
                <p className="muted">Entra: <b>{novo.nome}</b>{!olheiro && ` (${novo.ovr})`}
                  {sai && <> · Sai: <b>{elenco.jogadores[sai].nome}</b>{!olheiro && ` (${elenco.jogadores[sai].ovr})`}</>}</p>
              )}
              <div className="botoes">
                <button className="botao primario" disabled={!novo || (cheio && !sai)}
                  onClick={() => { if (executar((c) => aceitarTransferencia(c, entra, cheio ? sai : null))) limpar(); }}>
                  Confirmar
                </button>
                {!atual.obrigatoria && <button className="botao" onClick={() => { limpar(); executar((c) => recusarTransferencia(c)); }}>Recusar</button>}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export function FimTemporada() {
  const [etapa, setEtapa] = useState('resumo');
  return (
    <div className="app">
      {etapa === 'resumo' ? <Resumo onSeguir={() => setEtapa('janela')} /> : (
        <>
          <h1 className="tela-titulo">Janela de transferências</h1>
          <Janela />
        </>
      )}
    </div>
  );
}
