// Lógica pura do painel da temporada: textos, calendário, simulação em sequência e troféus.
import { NOMES } from '../../engine/competicoes.js';
import { jogarData, proximaData } from '../../engine/carreira.js';

export const ORDEM_COMPETICOES = ['brasileirao', 'libertadores', 'copaDoBrasil', 'sulamericana', 'estadual'];

export function nomeCompeticao(compId, carreira, dados) {
  if (compId === 'estadual') {
    const clube = dados.clubes.find((x) => x.id === carreira.config.clubeId);
    return dados.estaduais[clube.estado]?.nome ?? NOMES.estadual;
  }
  return NOMES[compId] ?? compId;
}

export function descreverEtapa(comp, etapa) {
  if (etapa.tipo === 'rodada') {
    const grupos = Object.keys(comp.tabelas).some((k) => k !== 'geral');
    return grupos ? `Fase de grupos · Rodada ${etapa.n + 1}` : `Rodada ${etapa.n + 1}`;
  }
  const nome = comp.fases[etapa.fase].nome;
  if (etapa.perna === 'ida') return `${nome} · Ida`;
  if (etapa.perna === 'volta') return `${nome} · Volta`;
  return nome;
}

// Próximo jogo com textos prontos para o cartão da aba Jogo.
export function infoProximoJogo(carreira, dados) {
  const p = proximaData(carreira, dados);
  const t = carreira.temporadaAtual;
  if (!p.jogo) {
    const nomes = t.calendario[t.indice].comps.map((id) => nomeCompeticao(id, carreira, dados));
    return { ...p, titulo: nomes.join(' / '), ida: null, mando: null, perna: null };
  }
  const comp = t.competicoes[p.compId];
  const etapa = comp.etapas[comp.proxima];
  let ida = null;
  if (etapa.tipo === 'fase' && etapa.perna === 'volta') {
    ida = comp.fases[etapa.fase].idas.find((r) => r.casa === p.jogo.fora && r.fora === p.jogo.casa) ?? null;
  }
  const eu = carreira.config.clubeId;
  const mando = p.jogo.neutro ? 'neutro' : p.jogo.casa === eu ? 'casa' : 'fora';
  const perna = etapa.tipo === 'fase' ? etapa.perna : null;
  return { ...p, titulo: `${nomeCompeticao(p.compId, carreira, dados)} · ${descreverEtapa(comp, etapa)}`, ida, mando, perna };
}

// Resultado de um jogo do ponto de vista do usuário.
export function resultadoDoUsuario(jogo, eu) {
  const emCasa = jogo.casa === eu;
  const meus = emCasa ? jogo.golsCasa : jogo.golsFora;
  const deles = emCasa ? jogo.golsFora : jogo.golsCasa;
  let letra = meus > deles ? 'V' : meus < deles ? 'D' : 'E';
  let penaltis = null;
  if (jogo.penaltis) {
    const pm = emCasa ? jogo.penaltis.casa : jogo.penaltis.fora;
    const pd = emCasa ? jogo.penaltis.fora : jogo.penaltis.casa;
    penaltis = { meus: pm, deles: pd };
  }
  if (letra === 'E' && penaltis) letra = penaltis.meus > penaltis.deles ? 'V' : 'D';
  return { letra, meus, deles, penaltis, adversario: emCasa ? jogo.fora : jogo.casa, emCasa };
}

export function ultimosResultados(carreira, n = 5) {
  const eu = carreira.config.clubeId;
  return carreira.temporadaAtual.jogos.slice(-n).map((j) => ({ ...resultadoDoUsuario(j, eu), compId: j.compId }));
}

// Uma linha por data: { indice, compId, titulo, adversario, resultado, atual, meu }
export function linhasDoCalendario(carreira, dados) {
  const t = carreira.temporadaAtual;
  const eu = carreira.config.clubeId;
  const vezes = {};
  return t.calendario.map((data, indice) => {
    const etapaDe = {};
    for (const id of data.comps) { etapaDe[id] = vezes[id] ?? 0; vezes[id] = etapaDe[id] + 1; }
    const registrado = t.jogos.find((j) => j.indice === indice);
    const base = { indice, atual: indice === t.indice };
    if (registrado) {
      return {
        ...base, compId: registrado.compId, meu: true, titulo: nomeCompeticao(registrado.compId, carreira, dados),
        adversario: resultadoDoUsuario(registrado, eu).adversario, resultado: resultadoDoUsuario(registrado, eu),
      };
    }
    // jogo futuro: só dá para saber o adversário em rodadas de pontos corridos/grupos
    for (const id of data.comps) {
      const comp = t.competicoes[id];
      if (!comp.participantes.includes(eu)) continue;
      const etapa = comp.etapas[etapaDe[id]];
      let adversario = null;
      if (etapa?.tipo === 'rodada') {
        for (const rodadas of Object.values(comp.rodadas)) {
          const j = rodadas[etapa.n]?.find((x) => x.casa === eu || x.fora === eu);
          if (j) adversario = j.casa === eu ? j.fora : j.casa;
        }
      }
      if (indice < t.indice && !adversario) continue; // fase passada sem jogo meu (eliminado)
      return { ...base, compId: id, meu: true, titulo: nomeCompeticao(id, carreira, dados), adversario, resultado: null };
    }
    return { ...base, compId: data.comps[0], meu: false, titulo: data.comps.map((id) => nomeCompeticao(id, carreira, dados)).join(' / '), adversario: null, resultado: null };
  });
}

// Joga datas em sequência até a próxima marcada como importante (sem jogá-la) ou até a temporada acabar.
export function simularAteImportante(carreira, dados, limite = 100) {
  let c = carreira;
  const jogos = [];
  for (let i = 0; i < limite && c.fase === 'temporada'; i++) {
    if (i > 0 && proximaData(c, dados).importante) break;
    const antes = c.temporadaAtual.jogos.length;
    c = jogarData(c, dados);
    if (c.temporadaAtual.jogos.length > antes) jogos.push(c.temporadaAtual.jogos.at(-1));
  }
  return { carreira: c, jogos };
}

export function totalTitulos(carreira) {
  return carreira.historico.reduce((s, h) => s + h.titulos.length, 0);
}

// Competições que o usuário disputa na temporada seguinte (a partir das vagas já calculadas).
export function competicoesDaProxima(carreira) {
  if (!carreira.vagas) return [];
  const eu = carreira.config.clubeId;
  const lista = ['estadual', 'brasileirao', 'copaDoBrasil'];
  if (carreira.vagas.libertadores.includes(eu)) lista.push('libertadores');
  else if (carreira.vagas.sulamericana.includes(eu)) lista.push('sulamericana');
  return lista;
}

// [{ compId, temporadas: [n] }] na ordem de importância
export function salaDeTrofeus(carreira) {
  const por = {};
  for (const h of carreira.historico) for (const t of h.titulos) (por[t] ??= []).push(h.temporada);
  return ORDEM_COMPETICOES.filter((id) => por[id]).map((compId) => ({ compId, temporadas: por[compId] }));
}

export function artilheiroDaHistoria(carreira) {
  const lista = Object.entries(carreira.golsNaCarreira ?? {}).map(([id, x]) => ({ id, ...x }));
  lista.sort((a, b) => b.gols - a.gols);
  return lista[0] ?? null;
}

// Rótulo da evolução de um jogador no fim da temporada; no modo olheiro não revela o overall.
export function rotuloEvolucao({ ovrAntes, ovrDepois, aposentou }, olheiro) {
  if (aposentou) return { classe: 'muted', texto: 'pendurou as chuteiras' };
  if (ovrDepois > ovrAntes) return { classe: 'evolucao-sobe', texto: olheiro ? '↑ evoluiu' : `↑ ${ovrDepois}` };
  if (ovrDepois < ovrAntes) return { classe: 'evolucao-cai', texto: olheiro ? '↓ caiu' : `↓ ${ovrDepois}` };
  return { classe: 'muted', texto: olheiro ? '= estável' : `= ${ovrDepois}` };
}
