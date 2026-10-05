import { SETOR, ovrEfetivo } from './posicoes.js';
import { setoresDoLado } from './forca.js';

export const CONST = {
  TICKS_TEMPO: 9, // 9 lances de 5 minutos por tempo
  TICKS_PRORROGACAO: 6,
  K: 0.0055, // sensibilidade à diferença de força (calibrada)
  BASE_CHANCE: 0.4,
  BASE_GOL: 0.35,
  P_LESAO_JOGO: 0.015, // por jogador por jogo
  P_VERMELHO_JOGO: 0.03, // por time por jogo
  P_VAR: 0.04, // chance de um gol ser anulado
  MAX_TROCAS: 4,
};

const TICKS_JOGO = CONST.TICKS_TEMPO * 2;
const PESO_AUTOR = { ata: 5, mei: 2, def: 1, gol: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function criarLado({ id, nome, setoresBase = null, escalacao = null, banco = [], postura = 'equilibrada' }) {
  return {
    id, nome, setoresBase, postura,
    escalacao: escalacao ? escalacao.map((e) => ({ ...e })) : null,
    banco: [...banco],
    desfalques: 0,
    trocas: 0,
    cansaco: {},
  };
}

export function iniciarPartida({ casa, fora, neutro = false }) {
  return {
    casa: structuredClone(casa),
    fora: structuredClone(fora),
    neutro,
    tempo: 0, // 0 = não começou, 1 = fim do 1º, 2 = fim do 2º, 3 = fim da prorrogação
    placar: { casa: 0, fora: 0 },
    eventos: [],
    lesoes: [], // { lado, jogadorId, jogos }
    expulsos: [], // { lado, jogadorId }
    acrescimos: null,
  };
}

function melhorReserva(lado, vaga) {
  let melhor = null;
  for (const j of lado.banco) {
    if (!melhor || ovrEfetivo(j, vaga) > ovrEfetivo(melhor, vaga)) melhor = j;
  }
  return melhor;
}

function substituir(estado, chave, saiId, entra, minuto) {
  const lado = estado[chave];
  const idx = lado.escalacao.findIndex((e) => e.jogador.id === saiId);
  const sai = lado.escalacao[idx];
  lado.escalacao[idx] = { jogador: entra, vaga: sai.vaga };
  lado.banco = lado.banco.filter((j) => j.id !== entra.id);
  lado.trocas += 1;
  estado.eventos.push({
    minuto, tipo: 'troca', lado: chave,
    jogadorId: sai.jogador.id, nome: sai.jogador.nome, entraId: entra.id, entraNome: entra.nome,
  });
}

function escolherAutor(lado, rng) {
  if (!lado.escalacao) return null;
  const pesos = lado.escalacao.map((e) => PESO_AUTOR[SETOR[e.vaga]]);
  const total = pesos.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  let r = rng.next() * total;
  for (let i = 0; i < pesos.length; i++) {
    r -= pesos[i];
    if (r < 0) return lado.escalacao[i].jogador;
  }
  return null;
}

function incidentes(estado, chave, rng, minuto) {
  const lado = estado[chave];
  if (lado.escalacao) {
    const pLesao = CONST.P_LESAO_JOGO / TICKS_JOGO;
    for (const { jogador, vaga } of [...lado.escalacao]) {
      if (!rng.chance(pLesao)) continue;
      const jogos = rng.int(1, 3);
      estado.lesoes.push({ lado: chave, jogadorId: jogador.id, jogos });
      estado.eventos.push({ minuto, tipo: 'lesao', lado: chave, jogadorId: jogador.id, nome: jogador.nome, jogos });
      const reserva = lado.trocas < CONST.MAX_TROCAS ? melhorReserva(lado, vaga) : null;
      if (reserva) {
        substituir(estado, chave, jogador.id, reserva, minuto);
      } else {
        lado.escalacao = lado.escalacao.filter((e) => e.jogador.id !== jogador.id);
        lado.desfalques += 1;
      }
    }
  }
  if (rng.chance(CONST.P_VERMELHO_JOGO / TICKS_JOGO)) {
    let jogador = null;
    if (lado.escalacao && lado.escalacao.length) {
      jogador = rng.pick(lado.escalacao).jogador;
      lado.escalacao = lado.escalacao.filter((e) => e.jogador.id !== jogador.id);
      estado.expulsos.push({ lado: chave, jogadorId: jogador.id });
    }
    lado.desfalques += 1;
    estado.eventos.push({ minuto, tipo: 'vermelho', lado: chave, jogadorId: jogador?.id ?? null, nome: jogador?.nome ?? null });
  }
}

function lance(estado, rng, tick, progresso) {
  const minuto = tick * 5 + rng.int(1, 5);
  const sc = setoresDoLado(estado.casa, { mandante: !estado.neutro, progresso });
  const sf = setoresDoLado(estado.fora, { progresso });
  const pCasa = clamp(0.5 + (sc.mei - sf.mei) * CONST.K, 0.2, 0.8);
  const [chave, at, df] = rng.chance(pCasa) ? ['casa', sc, sf] : ['fora', sf, sc];
  const pChance = clamp(CONST.BASE_CHANCE + (at.ata - df.def) * CONST.K, 0.1, 0.8);
  if (rng.chance(pChance)) {
    const autor = escolherAutor(estado[chave], rng);
    const base = { minuto, lado: chave, jogadorId: autor?.id ?? null, nome: autor?.nome ?? null };
    const pGol = clamp(CONST.BASE_GOL + (at.ata - df.gol) * CONST.K, 0.08, 0.7);
    if (!rng.chance(pGol)) {
      estado.eventos.push({ ...base, tipo: 'chance' });
    } else if (rng.chance(CONST.P_VAR)) {
      estado.eventos.push({ ...base, tipo: 'var' });
    } else {
      estado.placar[chave] += 1;
      estado.eventos.push({ ...base, tipo: 'gol' });
    }
  }
  incidentes(estado, 'casa', rng, minuto);
  incidentes(estado, 'fora', rng, minuto);
}

function gerarCansaco(lado, rng) {
  if (!lado.escalacao) return;
  for (const { jogador } of lado.escalacao) {
    let c = 50 + rng.int(-10, 10);
    if (jogador.idade >= 32) c += 15;
    if (lado.postura === 'ofensiva') c += 10;
    lado.cansaco[jogador.id] = clamp(c, 0, 100);
  }
}

export function simularPrimeiroTempo(estadoAnterior, rng) {
  if (estadoAnterior.tempo !== 0) throw new Error('O 1º tempo já foi jogado');
  const estado = structuredClone(estadoAnterior);
  estado.acrescimos = { primeiro: rng.int(1, 4), segundo: rng.int(2, 7) };
  for (let t = 0; t < CONST.TICKS_TEMPO; t++) lance(estado, rng, t, 0);
  gerarCansaco(estado.casa, rng);
  gerarCansaco(estado.fora, rng);
  estado.tempo = 1;
  return estado;
}

// trocas: [{ saiId, entraId }]
// escalacao (opcional): [{ jogadorId, vaga }] com exatamente os jogadores em campo depois das trocas
export function aplicarIntervalo(estadoAnterior, chave, { trocas = [], escalacao = null, postura = null } = {}) {
  if (estadoAnterior.tempo !== 1) throw new Error('Só dá para mexer no time no intervalo');
  const estado = structuredClone(estadoAnterior);
  const lado = estado[chave];
  if (!lado.escalacao) throw new Error('Este time não tem escalação');
  if (lado.trocas + trocas.length > CONST.MAX_TROCAS) throw new Error(`Máximo de ${CONST.MAX_TROCAS} substituições`);
  for (const { saiId, entraId } of trocas) {
    if (!lado.escalacao.some((e) => e.jogador.id === saiId)) throw new Error(`Jogador ${saiId} não está em campo`);
    const entra = lado.banco.find((j) => j.id === entraId);
    if (!entra) throw new Error(`Jogador ${entraId} não está no banco`);
    substituir(estado, chave, saiId, entra, 45);
  }
  if (escalacao) {
    const emCampo = new Map(lado.escalacao.map((e) => [e.jogador.id, e.jogador]));
    const ids = escalacao.map((e) => e.jogadorId);
    const valida = ids.length === emCampo.size && new Set(ids).size === ids.length && ids.every((id) => emCampo.has(id));
    if (!valida) throw new Error('A nova escalação precisa ter exatamente os jogadores em campo');
    lado.escalacao = escalacao.map(({ jogadorId, vaga }) => ({ jogador: emCampo.get(jogadorId), vaga }));
  }
  if (postura) lado.postura = postura;
  return estado;
}

// Se o time ficou sem ninguém no gol: entra o goleiro reserva no lugar do jogador de linha mais fraco,
// ou, sem goleiro no banco, o jogador de linha que renderia mais no gol muda de vaga.
export function reporGoleiro(estado, chave) {
  const lado = estado[chave];
  if (!lado.escalacao.length || lado.escalacao.some((e) => e.vaga === 'GOL')) return estado;
  const reserva = lado.trocas < CONST.MAX_TROCAS ? melhorReserva(lado, 'GOL') : null;
  if (reserva && reserva.pos === 'GOL') {
    const sai = lado.escalacao.reduce((a, b) => (ovrEfetivo(b.jogador, b.vaga) < ovrEfetivo(a.jogador, a.vaga) ? b : a));
    const escalacao = lado.escalacao.map((e) =>
      e.jogador.id === sai.jogador.id ? { jogadorId: reserva.id, vaga: 'GOL' } : { jogadorId: e.jogador.id, vaga: e.vaga });
    return aplicarIntervalo(estado, chave, { trocas: [{ saiId: sai.jogador.id, entraId: reserva.id }], escalacao });
  }
  const vai = lado.escalacao.reduce((a, b) => (ovrEfetivo(b.jogador, 'GOL') > ovrEfetivo(a.jogador, 'GOL') ? b : a));
  const escalacao = lado.escalacao.map((e) => ({ jogadorId: e.jogador.id, vaga: e === vai ? 'GOL' : e.vaga }));
  return aplicarIntervalo(estado, chave, { escalacao });
}

// O computador repõe o goleiro, se preciso, e troca jogadores muito cansados por reservas
// que rendam pelo menos o mesmo no 2º tempo.
export function intervaloAutomatico(estadoAnterior, chave) {
  if (!estadoAnterior[chave].escalacao || estadoAnterior.tempo !== 1) return estadoAnterior;
  const estado = reporGoleiro(estadoAnterior, chave);
  const lado = estado[chave];
  const trocas = [];
  const banco = [...lado.banco];
  const cansados = lado.escalacao
    .filter((e) => (lado.cansaco[e.jogador.id] ?? 0) >= 60)
    .sort((a, b) => lado.cansaco[b.jogador.id] - lado.cansaco[a.jogador.id]);
  for (const { jogador, vaga } of cansados) {
    if (lado.trocas + trocas.length >= CONST.MAX_TROCAS) break;
    const rendimento = ovrEfetivo(jogador, vaga) * (1 - 0.05 * (lado.cansaco[jogador.id] / 100));
    let melhor = null;
    for (const r of banco) {
      const v = ovrEfetivo(r, vaga);
      if (v >= rendimento && (!melhor || v > ovrEfetivo(melhor, vaga))) melhor = r;
    }
    if (melhor) {
      trocas.push({ saiId: jogador.id, entraId: melhor.id });
      banco.splice(banco.indexOf(melhor), 1);
    }
  }
  return trocas.length ? aplicarIntervalo(estado, chave, { trocas }) : estado;
}

export function simularSegundoTempo(estadoAnterior, rng) {
  if (estadoAnterior.tempo !== 1) throw new Error('O 2º tempo vem depois do 1º');
  const estado = structuredClone(estadoAnterior);
  for (let i = 0; i < CONST.TICKS_TEMPO; i++) {
    lance(estado, rng, CONST.TICKS_TEMPO + i, (i + 1) / CONST.TICKS_TEMPO);
  }
  estado.tempo = 2;
  return estado;
}

export function simularProrrogacao(estadoAnterior, rng) {
  if (estadoAnterior.tempo !== 2) throw new Error('Prorrogação só depois dos 90 minutos');
  const estado = structuredClone(estadoAnterior);
  for (let i = 0; i < CONST.TICKS_PRORROGACAO; i++) lance(estado, rng, TICKS_JOGO + i, 1);
  estado.tempo = 3;
  return estado;
}

// Partida inteira sem pausa: o computador decide o intervalo dos dois lados.
export function simularPartida({ casa, fora, neutro = false, prorrogacao = false }, rng) {
  let e = simularPrimeiroTempo(iniciarPartida({ casa, fora, neutro }), rng);
  e = intervaloAutomatico(intervaloAutomatico(e, 'casa'), 'fora');
  e = simularSegundoTempo(e, rng);
  if (prorrogacao && e.placar.casa === e.placar.fora) e = simularProrrogacao(e, rng);
  return e;
}
