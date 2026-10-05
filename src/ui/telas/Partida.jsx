import { useEffect, useState } from 'react';
import formacoes from '../../data/formacoes.json';
import { iniciarPartida, simularPrimeiroTempo, aplicarIntervalo, simularSegundoTempo, simularProrrogacao, CONST } from '../../engine/partida.js';
import { setoresDoLado } from '../../engine/forca.js';
import { disputarPenaltis } from '../../engine/penaltis.js';
import { ladosDoJogo, rngDaPartida, precisaDePenaltis, jogarData } from '../../engine/carreira.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { DistintivoClube, clubeVisual } from '../componentes/Distintivo.jsx';
import {
  narrar, eventosAte, pressao, contarChances, faixaCansaco, minutoNoPeriodo, rotuloRelogio, TIPOS_DESTAQUE,
} from '../logica/partida.js';
import { reorganizar } from '../logica/escalacao.js';

const DURACAO = { primeiro: 15000, segundo: 15000, prorrogacao: 10000 };
const PASSO = 100;
const ANIMADOS = ['primeiro', 'segundo', 'prorrogacao'];

const TITULO_DESTAQUE = { gol: 'GOOOL!', var: 'VAR · ANULADO', vermelho: 'EXPULSO', lesao: 'LESÃO' };

function Intervalo({ estado, lado, olheiro, onComecar }) {
  const meu = estado[lado];
  const livres = CONST.MAX_TROCAS - meu.trocas;
  const [trocas, setTrocas] = useState([]); // [{ saiId, entraId }]
  const [sai, setSai] = useState(null);
  const [postura, setPostura] = useState(meu.postura);
  const [formacao, setFormacao] = useState(null);
  const saem = new Set(trocas.map((t) => t.saiId));
  const entram = new Set(trocas.map((t) => t.entraId));

  const comecar = () => {
    let escalacao = null;
    if (formacao) {
      const emCampo = meu.escalacao.map((e) => {
        const t = trocas.find((x) => x.saiId === e.jogador.id);
        return t ? meu.banco.find((b) => b.id === t.entraId) : e.jogador;
      });
      const vagas = formacoes.find((f) => f.id === formacao).vagas;
      escalacao = reorganizar(emCampo, vagas).map((id, i) => (id ? { jogadorId: id, vaga: vagas[i] } : null)).filter(Boolean);
    }
    onComecar({ trocas, postura, escalacao });
  };

  return (
    <div className="cartao realce">
      <div className="secao" style={{ marginTop: 0 }}>Intervalo · trocas disponíveis: {livres - trocas.length}</div>
      <p className="muted">Toque em quem sai e depois em quem entra.</p>
      <div className="lista">
        {meu.escalacao.map(({ jogador, vaga }) => {
          const c = meu.cansaco[jogador.id] ?? 0;
          const troca = trocas.find((t) => t.saiId === jogador.id);
          return (
            <button key={jogador.id} className={`linha ${sai === jogador.id ? 'on' : ''}`} disabled={saem.has(jogador.id)}
              onClick={() => setSai(jogador.id)}>
              <span className="pos">{vaga}</span>
              <span className="grow">{jogador.nome}{troca && ` → ${meu.banco.find((b) => b.id === troca.entraId).nome}`}</span>
              <span className="cansaco"><div className={faixaCansaco(c)} style={{ width: `${c}%` }} /></span>
            </button>
          );
        })}
      </div>
      <div className="secao">Banco</div>
      <div className="lista">
        {meu.banco.map((j) => (
          <button key={j.id} className="linha" disabled={!sai || entram.has(j.id) || trocas.length >= livres}
            onClick={() => { setTrocas([...trocas, { saiId: sai, entraId: j.id }]); setSai(null); }}>
            <span className="pos">{j.pos}</span><span className="grow">{j.nome}</span>{!olheiro && <span className="ovr">{j.ovr}</span>}
          </button>
        ))}
        {meu.banco.length === 0 && <span className="muted">Ninguém no banco.</span>}
      </div>
      {trocas.length > 0 && <button className="botao" style={{ marginTop: 8 }} onClick={() => setTrocas([])}>Desfazer trocas</button>}
      <div className="secao">Postura</div>
      <div className="segmentos">
        {['defensiva', 'equilibrada', 'ofensiva'].map((p) => (
          <button key={p} className={`opcao ${postura === p ? 'on' : ''}`} onClick={() => setPostura(p)}>{p}</button>
        ))}
      </div>
      <div className="secao">Formação</div>
      <div className="segmentos">
        {formacoes.map((f) => (
          <button key={f.id} className={`opcao ${formacao === f.id ? 'on' : ''}`} onClick={() => setFormacao(formacao === f.id ? null : f.id)}>{f.id}</button>
        ))}
      </div>
      <div style={{ height: 12 }} />
      <button className="botao primario" onClick={comecar}>Começar o 2º tempo</button>
    </div>
  );
}

export function Partida({ info, onFechar }) {
  const { carreira, dados, executar } = useCarreira();
  const eu = carreira.config.clubeId;
  const { jogo, compId } = info;
  const lado = jogo.casa === eu ? 'casa' : 'fora';
  const nomes = { casa: clubeVisual(dados, jogo.casa).nome, fora: clubeVisual(dados, jogo.fora).nome };

  // rng e 1º tempo criados juntos, uma vez só (o rng é próprio desta partida)
  const [{ rng }] = useState(() => ({ rng: rngDaPartida(carreira) }));
  const [estado, setEstado] = useState(() => {
    const { casa, fora } = ladosDoJogo(carreira, dados, jogo);
    return simularPrimeiroTempo(iniciarPartida({ casa, fora, neutro: jogo.neutro }), rng);
  });
  const [periodo, setPeriodo] = useState('primeiro');
  const [fracao, setFracao] = useState(0);
  const [disputa, setDisputa] = useState(null);
  const [cobrancas, setCobrancas] = useState(0);

  // relógio
  useEffect(() => {
    if (!ANIMADOS.includes(periodo)) return undefined;
    const passo = PASSO / DURACAO[periodo];
    const id = setInterval(() => setFracao((f) => Math.min(1, f + passo)), PASSO);
    return () => clearInterval(id);
  }, [periodo]);

  // fim de cada período
  useEffect(() => {
    if (!ANIMADOS.includes(periodo) || fracao < 1) return;
    if (periodo === 'primeiro') { setPeriodo('intervalo'); return; }
    if (periodo === 'segundo' && jogo.prorrogacao && estado.placar.casa === estado.placar.fora) {
      setEstado(simularProrrogacao(estado, rng));
      setFracao(0);
      setPeriodo('prorrogacao');
      return;
    }
    const resultado = { casa: jogo.casa, fora: jogo.fora, golsCasa: estado.placar.casa, golsFora: estado.placar.fora };
    if (precisaDePenaltis(carreira, compId, resultado)) {
      setDisputa(disputarPenaltis(setoresDoLado(estado.casa, { progresso: 1 }), setoresDoLado(estado.fora, { progresso: 1 }), rng));
      setPeriodo('penaltis');
    } else {
      setPeriodo('fim');
    }
  }, [fracao, periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  // cobranças de pênalti, uma a uma
  useEffect(() => {
    if (periodo !== 'penaltis') return undefined;
    if (cobrancas >= disputa.cobrancas.length) { setPeriodo('fim'); return undefined; }
    const id = setTimeout(() => setCobrancas((n) => n + 1), 800);
    return () => clearTimeout(id);
  }, [periodo, cobrancas, disputa]);

  const periodoRelogio = ANIMADOS.includes(periodo) ? periodo : periodo === 'intervalo' ? 'primeiro' : estado.tempo === 3 ? 'prorrogacao' : 'segundo';
  const minuto = ANIMADOS.includes(periodo) ? minutoNoPeriodo(periodo, fracao) : periodoRelogio === 'primeiro' ? 45 : estado.tempo === 3 ? 120 : 90;
  const revelados = eventosAte(estado.eventos, minuto);
  const placar = {
    casa: revelados.filter((e) => e.tipo === 'gol' && e.lado === 'casa').length,
    fora: revelados.filter((e) => e.tipo === 'gol' && e.lado === 'fora').length,
  };
  const p = pressao(revelados, minuto);
  const chances = contarChances(revelados, minuto);
  const destaque = [...revelados].reverse().find((e) => TIPOS_DESTAQUE.includes(e.tipo) && minuto - e.minuto <= 3);

  const comecarSegundo = (escolhas) => {
    try {
      const e = aplicarIntervalo(estado, lado, escolhas);
      setEstado(simularSegundoTempo(e, rng));
      setFracao(0);
      setPeriodo('segundo');
    } catch (err) {
      window.alert(err.message);
    }
  };

  const concluir = () => {
    const nova = executar((c) => jogarData(c, dados, { partidaUsuario: estado, penaltisUsuario: disputa }));
    if (nova) onFechar();
  };

  // classificação no mata-mata (volta ou jogo único)
  let classificacao = null;
  if (periodo === 'fim' && jogo.mataMata && info.perna !== 'ida') {
    const idaMeus = info.ida ? (info.ida.casa === eu ? info.ida.golsCasa : info.ida.golsFora) : 0;
    const idaDeles = info.ida ? (info.ida.casa === eu ? info.ida.golsFora : info.ida.golsCasa) : 0;
    const meus = estado.placar[lado] + idaMeus;
    const deles = estado.placar[lado === 'casa' ? 'fora' : 'casa'] + idaDeles;
    classificacao = disputa ? disputa.vencedor === lado : meus > deles;
  }

  return (
    <div className="sobreposicao">
      <div className="app">
        <div className="topo"><span>{info.titulo}</span></div>
        <div className="placar">
          <DistintivoClube dados={dados} id={jogo.casa} tamanho={40} />
          <span className="gols">{placar.casa} - {placar.fora}</span>
          <DistintivoClube dados={dados} id={jogo.fora} tamanho={40} />
        </div>
        <div className="relogio">
          {periodo === 'intervalo' ? 'INTERVALO' : periodo === 'penaltis' ? 'PÊNALTIS' : periodo === 'fim' ? 'FIM DE JOGO' : rotuloRelogio(minuto, periodoRelogio, estado.acrescimos)}
        </div>
        <div className="pressao" aria-label="Pressão">
          <div style={{ width: `${p.casa * 100}%`, background: 'var(--destaque)' }} />
          <div style={{ width: `${p.fora * 100}%`, background: '#2e7d4a' }} />
        </div>
        <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span>{nomes.casa}</span><span>Chances {chances.casa} x {chances.fora}</span><span>{nomes.fora}</span>
        </div>

        {destaque && ANIMADOS.includes(periodo) && (
          <div key={`${destaque.tipo}-${destaque.minuto}`} className={`destaque-grande ${destaque.tipo === 'gol' ? '' : 'perigo'}`}>
            <b>{TITULO_DESTAQUE[destaque.tipo]}</b>
            <span>{destaque.nome ?? nomes[destaque.lado]} · {destaque.minuto}'</span>
          </div>
        )}

        {periodo === 'intervalo' && <Intervalo estado={estado} lado={lado} olheiro={carreira.config.dificuldade === 'olheiro'} onComecar={comecarSegundo} />}

        {(periodo === 'penaltis' || (periodo === 'fim' && disputa)) && (
          <div className="cartao realce">
            <div className="secao" style={{ marginTop: 0 }}>Disputa de pênaltis</div>
            {['casa', 'fora'].map((l) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ minWidth: 90 }}>{nomes[l]}</span>
                <div className="cobrancas">
                  {disputa.cobrancas.slice(0, cobrancas).filter((c) => c.lado === l).map((c, i) => <span key={i}>{c.convertido ? '⚽' : '❌'}</span>)}
                </div>
              </div>
            ))}
            {periodo === 'fim' && <b>Pênaltis: {disputa.casa} x {disputa.fora}</b>}
          </div>
        )}

        {periodo === 'fim' && (
          <div className="cartao realce">
            <div className="secao" style={{ marginTop: 0 }}>Fim de jogo</div>
            {classificacao !== null && <p style={{ fontWeight: 900, fontSize: 18, color: classificacao ? 'var(--destaque)' : 'var(--perigo)' }}>{classificacao ? 'Classificado!' : 'Eliminado'}</p>}
            <div className="lista">
              {estado.eventos.filter((e) => ['gol', 'vermelho', 'lesao'].includes(e.tipo)).map((e, i) => (
                <div key={i} className="muted">{e.tipo === 'gol' ? '⚽' : e.tipo === 'vermelho' ? '🟥' : '🚑'} {e.minuto}' {e.nome ?? nomes[e.lado]}</div>
              ))}
            </div>
            <div style={{ height: 10 }} />
            <button className="botao primario" onClick={concluir}>Continuar</button>
          </div>
        )}

        {ANIMADOS.includes(periodo) && <button className="botao" style={{ marginTop: 10 }} onClick={() => setFracao(1)}>⏩ Pular</button>}

        <div style={{ marginTop: 8 }}>
          {[...revelados].reverse().slice(0, 8).map((e, i) => (
            <div key={i} className={`lance ${e.tipo}`}><span className="min">{e.minuto}'</span><span>{narrar(e, nomes)}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
