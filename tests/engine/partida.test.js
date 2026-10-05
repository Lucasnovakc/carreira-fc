import { describe, it, expect } from 'vitest';
import formacoes from '../../src/data/formacoes.json';
import { criarRng } from '../../src/engine/rng.js';
import {
  CONST, criarLado, iniciarPartida, simularPrimeiroTempo, aplicarIntervalo,
  intervaloAutomatico, simularSegundoTempo, simularProrrogacao, simularPartida,
} from '../../src/engine/partida.js';

const VAGAS_433 = formacoes.find((f) => f.id === '4-3-3').vagas;

function timeComElenco(prefixo, ovr = 80, idade = 25) {
  const escalacao = VAGAS_433.map((vaga, i) => ({
    jogador: { id: `${prefixo}${i}`, nome: `${prefixo} ${i}`, pos: vaga, ovr, idade },
    vaga,
  }));
  const banco = ['GOL', 'ZAG', 'MC', 'CA'].map((pos, i) => ({
    id: `${prefixo}b${i}`, nome: `${prefixo} reserva ${i}`, pos, ovr, idade: 22,
  }));
  return criarLado({ id: prefixo, nome: prefixo, escalacao, banco });
}

const timeCpu = (id, n) => criarLado({ id, nome: id, setoresBase: { gol: n, def: n, mei: n, ata: n } });

function estatisticas(casa, fora, n, semente = 1) {
  const rng = criarRng(semente);
  let gols = 0, v = 0, e = 0;
  for (let i = 0; i < n; i++) {
    const r = simularPartida({ casa, fora, neutro: true }, rng);
    gols += r.placar.casa + r.placar.fora;
    if (r.placar.casa > r.placar.fora) v++;
    else if (r.placar.casa === r.placar.fora) e++;
  }
  return { gols: gols / n, vitorias: v / n, empates: e / n };
}

describe('calibração', () => {
  it('times iguais: ~2,5 gols por jogo e 20–30% de empates', () => {
    const s = estatisticas(timeCpu('A', 75), timeCpu('B', 75), 10000);
    expect(s.gols).toBeGreaterThan(2.3);
    expect(s.gols).toBeLessThan(2.8);
    expect(s.empates).toBeGreaterThan(0.2);
    expect(s.empates).toBeLessThan(0.3);
  });

  it('time 10 pontos melhor vence entre 57% e 68%', () => {
    const s = estatisticas(timeCpu('A', 85), timeCpu('B', 75), 10000);
    expect(s.vitorias).toBeGreaterThan(0.57);
    expect(s.vitorias).toBeLessThan(0.68);
  });

  it('mando de campo ajuda', () => {
    const rng = criarRng(5);
    let vCasa = 0, vFora = 0;
    for (let i = 0; i < 10000; i++) {
      const r = simularPartida({ casa: timeCpu('A', 75), fora: timeCpu('B', 75) }, rng);
      if (r.placar.casa > r.placar.fora) vCasa++;
      if (r.placar.fora > r.placar.casa) vFora++;
    }
    expect(vCasa).toBeGreaterThan(vFora);
  });
});

describe('fluxo da partida', () => {
  it('é determinística com a mesma semente', () => {
    const a = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 78) }, criarRng(42));
    const b = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 78) }, criarRng(42));
    expect(a).toEqual(b);
  });

  it('não altera os lados recebidos', () => {
    const casa = timeComElenco('A');
    const copia = structuredClone(casa);
    simularPartida({ casa, fora: timeCpu('B', 78) }, criarRng(1));
    expect(casa).toEqual(copia);
  });

  it('gols no placar batem com os eventos de gol', () => {
    const rng = criarRng(8);
    for (let i = 0; i < 200; i++) {
      const r = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }, rng);
      expect(r.eventos.filter((e) => e.tipo === 'gol' && e.lado === 'casa')).toHaveLength(r.placar.casa);
      expect(r.eventos.filter((e) => e.tipo === 'gol' && e.lado === 'fora')).toHaveLength(r.placar.fora);
    }
  });

  it('eventos do 1º tempo vão até 45 e do 2º até 90', () => {
    const rng = criarRng(3);
    let e = simularPrimeiroTempo(iniciarPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }), rng);
    expect(e.eventos.every((ev) => ev.minuto >= 1 && ev.minuto <= 45)).toBe(true);
    const n1 = e.eventos.length;
    e = simularSegundoTempo(e, rng);
    expect(e.eventos.slice(n1).every((ev) => ev.minuto >= 46 && ev.minuto <= 90)).toBe(true);
  });

  it('gol do time com elenco tem autor; gol do computador não', () => {
    const rng = criarRng(11);
    for (let i = 0; i < 100; i++) {
      const r = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }, rng);
      for (const ev of r.eventos.filter((x) => x.tipo === 'gol')) {
        if (ev.lado === 'casa') expect(ev.nome).toMatch(/^A /);
        else expect(ev.nome).toBeNull();
      }
    }
  });

  it('respeita a ordem dos tempos', () => {
    const rng = criarRng(1);
    const e0 = iniciarPartida({ casa: timeCpu('A', 70), fora: timeCpu('B', 70) });
    expect(() => simularSegundoTempo(e0, rng)).toThrow();
    expect(() => simularProrrogacao(e0, rng)).toThrow();
    const e1 = simularPrimeiroTempo(e0, rng);
    expect(() => simularPrimeiroTempo(e1, rng)).toThrow();
  });

  it('prorrogação só acontece se pedida e empatado', () => {
    const rng = criarRng(21);
    let houve = 0;
    for (let i = 0; i < 300; i++) {
      const r = simularPartida({ casa: timeCpu('A', 75), fora: timeCpu('B', 75), prorrogacao: true }, rng);
      if (r.tempo === 3) {
        houve++;
        expect(r.eventos.filter((ev) => ev.minuto > 90).every((ev) => ev.minuto <= 120)).toBe(true);
      }
    }
    expect(houve).toBeGreaterThan(0);
  });
});

describe('intervalo', () => {
  const primeiroTempo = (semente = 2) =>
    simularPrimeiroTempo(iniciarPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }), criarRng(semente));

  it('gera cansaço para os titulares no fim do 1º tempo', () => {
    const e = primeiroTempo();
    for (const { jogador } of e.casa.escalacao) {
      expect(e.casa.cansaco[jogador.id]).toBeGreaterThanOrEqual(0);
      expect(e.casa.cansaco[jogador.id]).toBeLessThanOrEqual(100);
    }
  });

  it('veteranos cansam mais que jovens na média', () => {
    const rng = criarRng(4);
    let velhos = 0, jovens = 0;
    for (let i = 0; i < 200; i++) {
      const v = simularPrimeiroTempo(iniciarPartida({ casa: timeComElenco('V', 80, 34), fora: timeCpu('B', 80) }), rng);
      const j = simularPrimeiroTempo(iniciarPartida({ casa: timeComElenco('J', 80, 22), fora: timeCpu('B', 80) }), rng);
      velhos += v.casa.cansaco[v.casa.escalacao[5].jogador.id];
      jovens += j.casa.cansaco[j.casa.escalacao[5].jogador.id];
    }
    expect(velhos).toBeGreaterThan(jovens);
  });

  it('troca jogador do banco na mesma vaga', () => {
    const e = primeiroTempo();
    const sai = e.casa.escalacao.find((x) => x.vaga === 'CA');
    if (!sai) return; // CA pode ter sido expulso nesta semente
    const e2 = aplicarIntervalo(e, 'casa', { trocas: [{ saiId: sai.jogador.id, entraId: 'Ab3' }] });
    expect(e2.casa.escalacao.find((x) => x.jogador.id === 'Ab3').vaga).toBe('CA');
    expect(e2.casa.banco.some((j) => j.id === 'Ab3')).toBe(false);
    expect(e2.casa.trocas).toBe(e.casa.trocas + 1);
    expect(e2.eventos.at(-1)).toMatchObject({ tipo: 'troca', minuto: 45, entraId: 'Ab3' });
  });

  it('muda formação e postura', () => {
    const e = primeiroTempo();
    const nova = e.casa.escalacao.map((x) => ({ jogadorId: x.jogador.id, vaga: x.vaga === 'PE' ? 'MEI' : x.vaga }));
    const e2 = aplicarIntervalo(e, 'casa', { escalacao: nova, postura: 'defensiva' });
    expect(e2.casa.postura).toBe('defensiva');
    expect(e2.casa.escalacao.some((x) => x.vaga === 'MEI')).toBe(true);
  });

  it('rejeita escalação com jogador que não está em campo', () => {
    const e = primeiroTempo();
    const nova = e.casa.escalacao.map((x) => ({ jogadorId: x.jogador.id, vaga: x.vaga }));
    nova[0] = { jogadorId: 'Ab0', vaga: 'GOL' };
    expect(() => aplicarIntervalo(e, 'casa', { escalacao: nova })).toThrow();
  });

  it(`rejeita mais de ${CONST.MAX_TROCAS} trocas e jogador fora do banco`, () => {
    const e = primeiroTempo();
    const ids = e.casa.escalacao.map((x) => x.jogador.id);
    const cinco = ['Ab0', 'Ab1', 'Ab2', 'Ab3', 'X'].map((entraId, i) => ({ saiId: ids[i], entraId }));
    expect(() => aplicarIntervalo(e, 'casa', { trocas: cinco })).toThrow();
    expect(() => aplicarIntervalo(e, 'casa', { trocas: [{ saiId: ids[0], entraId: 'nao-existe' }] })).toThrow();
  });

  it('não dá para mexer fora do intervalo', () => {
    const e0 = iniciarPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) });
    expect(() => aplicarIntervalo(e0, 'casa', { postura: 'ofensiva' })).toThrow();
  });

  it('intervalo automático só troca cansados por reservas que rendem igual ou mais', () => {
    const e = primeiroTempo();
    for (const id of Object.keys(e.casa.cansaco)) e.casa.cansaco[id] = 90;
    const e2 = intervaloAutomatico(e, 'casa');
    expect(e2.casa.trocas).toBeGreaterThan(0);
    expect(e2.casa.trocas).toBeLessThanOrEqual(CONST.MAX_TROCAS);
  });
});

describe('lesões e cartões', () => {
  it('taxas próximas de 1,5% por jogador e 3% por time', () => {
    const rng = criarRng(77);
    const N = 4000;
    let lesoes = 0, vermelhos = 0;
    for (let i = 0; i < N; i++) {
      const r = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }, rng);
      lesoes += r.lesoes.length;
      vermelhos += r.eventos.filter((ev) => ev.tipo === 'vermelho' && ev.lado === 'casa').length;
    }
    expect(lesoes / (N * 11)).toBeGreaterThan(0.01);
    expect(lesoes / (N * 11)).toBeLessThan(0.025);
    expect(vermelhos / N).toBeGreaterThan(0.02);
    expect(vermelhos / N).toBeLessThan(0.045);
  });

  it('lesionado sai de campo e fica 1 a 3 jogos fora', () => {
    const rng = criarRng(99);
    for (let i = 0; i < 500; i++) {
      const r = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }, rng);
      for (const l of r.lesoes) {
        expect(l.jogos).toBeGreaterThanOrEqual(1);
        expect(l.jogos).toBeLessThanOrEqual(3);
        expect(r.casa.escalacao.some((e) => e.jogador.id === l.jogadorId)).toBe(false);
      }
    }
  });

  it('expulso sai de campo e o time fica com menos gente', () => {
    const rng = criarRng(13);
    let viu = false;
    for (let i = 0; i < 2000 && !viu; i++) {
      const r = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }, rng);
      if (r.expulsos.length) {
        viu = true;
        const { jogadorId } = r.expulsos[0];
        expect(r.casa.escalacao.some((e) => e.jogador.id === jogadorId)).toBe(false);
        expect(r.casa.desfalques).toBeGreaterThanOrEqual(1);
      }
    }
    expect(viu).toBe(true);
  });

  it('VAR anula gols às vezes', () => {
    const rng = criarRng(31);
    let anulados = 0;
    for (let i = 0; i < 1000; i++) {
      anulados += simularPartida({ casa: timeCpu('A', 80), fora: timeCpu('B', 80) }, rng)
        .eventos.filter((ev) => ev.tipo === 'var').length;
    }
    expect(anulados).toBeGreaterThan(0);
  });
});

describe('time muito desfalcado', () => {
  it('com só 3 jogadores e sem banco a partida termina sem NaN', () => {
    const casa = timeComElenco('A');
    casa.escalacao = casa.escalacao.slice(8); // sobram PD, CA, PE — sem goleiro nem defesa
    casa.banco = [];
    casa.desfalques = 8;
    const r = simularPartida({ casa, fora: timeCpu('B', 75) }, criarRng(6));
    expect(Number.isInteger(r.placar.casa)).toBe(true);
    expect(Number.isInteger(r.placar.fora)).toBe(true);
    expect(r.placar.fora).toBeGreaterThan(r.placar.casa);
  });
});
