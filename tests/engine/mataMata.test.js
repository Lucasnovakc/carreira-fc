import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { decidirIdaVolta, decidirJogoUnico, emparelhar, sortearChave } from '../../src/engine/mataMata.js';

const jogo = (casa, fora, golsCasa, golsFora) => ({ casa, fora, golsCasa, golsFora });

describe('decidirIdaVolta', () => {
  it('soma o agregado e aponta o vencedor', () => {
    const r = decidirIdaVolta(jogo('A', 'B', 2, 1), jogo('B', 'A', 1, 0));
    expect(r.agregado).toEqual({ A: 2, B: 2 });
    expect(r.precisaPenaltis).toBe(true);
    expect(r.vencedor).toBeNull();
  });

  it('vencedor pelo agregado, sem gol fora de casa', () => {
    expect(decidirIdaVolta(jogo('A', 'B', 0, 1), jogo('B', 'A', 0, 2)).vencedor).toBe('A');
    // 1x1 fora e 0x0 em casa: empate no agregado, gol fora não vale
    expect(decidirIdaVolta(jogo('A', 'B', 0, 0), jogo('B', 'A', 1, 1)).precisaPenaltis).toBe(true);
  });

  it('rejeita volta sem inverter o mando', () => {
    expect(() => decidirIdaVolta(jogo('A', 'B', 1, 0), jogo('A', 'B', 1, 0))).toThrow();
  });
});

describe('decidirJogoUnico', () => {
  it('vencedor direto ou pênaltis', () => {
    expect(decidirJogoUnico(jogo('A', 'B', 0, 1))).toEqual({ vencedor: 'B', precisaPenaltis: false });
    expect(decidirJogoUnico(jogo('A', 'B', 2, 2))).toEqual({ vencedor: null, precisaPenaltis: true });
  });
});

describe('emparelhar e sortearChave', () => {
  it('emparelha em ordem', () => {
    expect(emparelhar(['a', 'b', 'c', 'd'])).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('rejeita número ímpar', () => {
    expect(() => emparelhar(['a', 'b', 'c'])).toThrow();
  });

  it('sorteio usa todos os times uma vez', () => {
    const ids = Array.from({ length: 32 }, (_, i) => `t${i}`);
    const pares = sortearChave(ids, criarRng(4));
    expect(pares).toHaveLength(16);
    expect(pares.flat().sort()).toEqual([...ids].sort());
  });
});
