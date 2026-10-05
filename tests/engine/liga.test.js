import { describe, it, expect } from 'vitest';
import { criarTabela, registrarResultado, ordenarTabela, gerarRodadas } from '../../src/engine/liga.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `t${i}`);

describe('gerarRodadas', () => {
  it.each([4, 12, 20])('%i times: turno único, todos se enfrentam uma vez', (n) => {
    const rodadas = gerarRodadas(ids(n));
    expect(rodadas).toHaveLength(n - 1);
    const pares = new Set();
    for (const jogos of rodadas) {
      expect(jogos).toHaveLength(n / 2);
      const naRodada = jogos.flatMap((j) => [j.casa, j.fora]);
      expect(new Set(naRodada).size).toBe(n); // ninguém joga duas vezes na rodada
      for (const { casa, fora } of jogos) pares.add([casa, fora].sort().join('-'));
    }
    expect(pares.size).toBe((n * (n - 1)) / 2);
  });

  it('20 times ida e volta: 38 rodadas e cada confronto com um mando para cada lado', () => {
    const rodadas = gerarRodadas(ids(20), { idaEVolta: true });
    expect(rodadas).toHaveLength(38);
    const mandos = new Map();
    for (const jogos of rodadas) for (const { casa, fora } of jogos) mandos.set(`${casa}>${fora}`, true);
    expect(mandos.size).toBe(20 * 19);
  });

  it('mando equilibrado no turno: ninguém tem mais que n/2 jogos em casa', () => {
    const n = 20;
    const emCasa = Object.fromEntries(ids(n).map((id) => [id, 0]));
    for (const jogos of gerarRodadas(ids(n))) for (const { casa } of jogos) emCasa[casa]++;
    for (const v of Object.values(emCasa)) {
      expect(v).toBeGreaterThanOrEqual(n / 2 - 1);
      expect(v).toBeLessThanOrEqual(n / 2);
    }
  });

  it('número ímpar: cada time folga uma vez', () => {
    const rodadas = gerarRodadas(ids(5));
    expect(rodadas).toHaveLength(5);
    for (const jogos of rodadas) expect(jogos).toHaveLength(2);
  });
});

describe('tabela', () => {
  it('registra vitória, empate e derrota', () => {
    let t = criarTabela(['a', 'b', 'c']);
    t = registrarResultado(t, { casa: 'a', fora: 'b', golsCasa: 2, golsFora: 0 });
    t = registrarResultado(t, { casa: 'b', fora: 'c', golsCasa: 1, golsFora: 1 });
    const por = Object.fromEntries(t.map((l) => [l.id, l]));
    expect(por.a).toMatchObject({ j: 1, v: 1, pts: 3, gp: 2, gc: 0 });
    expect(por.b).toMatchObject({ j: 2, v: 0, e: 1, d: 1, pts: 1, gp: 1, gc: 3 });
    expect(por.c).toMatchObject({ j: 1, e: 1, pts: 1 });
  });

  it('não altera a tabela original', () => {
    const t = criarTabela(['a', 'b']);
    registrarResultado(t, { casa: 'a', fora: 'b', golsCasa: 1, golsFora: 0 });
    expect(t[0].j).toBe(0);
  });

  it('desempata por pontos, vitórias, saldo e gols pró', () => {
    const l = (id, pts, v, gp, gc) => ({ id, j: 0, e: 0, d: 0, pts, v, gp, gc });
    const ordem = ordenarTabela([
      l('saldo-pior', 10, 3, 5, 5),
      l('mais-pontos', 11, 3, 0, 0),
      l('mais-vitorias', 10, 4, 0, 0),
      l('saldo-melhor-mais-gols', 10, 3, 8, 6),
      l('saldo-melhor', 10, 3, 4, 2),
    ]).map((x) => x.id);
    expect(ordem).toEqual(['mais-pontos', 'mais-vitorias', 'saldo-melhor-mais-gols', 'saldo-melhor', 'saldo-pior']);
  });
});
