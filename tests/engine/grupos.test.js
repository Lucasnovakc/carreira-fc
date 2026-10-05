import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { criarTabela, registrarResultado } from '../../src/engine/liga.js';
import { sortearGrupos, classificadosDoGrupo, cruzarOitavas } from '../../src/engine/grupos.js';

const ids = Array.from({ length: 32 }, (_, i) => `t${String(i).padStart(2, '0')}`);

describe('sortearGrupos', () => {
  it('8 grupos de 4, com um time de cada pote', () => {
    const grupos = sortearGrupos(ids, criarRng(1));
    expect(grupos).toHaveLength(8);
    for (const g of grupos) {
      expect(g).toHaveLength(4);
      g.forEach((id, pote) => expect(ids.indexOf(id)).toBeGreaterThanOrEqual(pote * 8));
      g.forEach((id, pote) => expect(ids.indexOf(id)).toBeLessThan((pote + 1) * 8));
    }
    expect(grupos.flat().sort()).toEqual(ids);
  });

  it('rejeita quantidade que não divide nos grupos', () => {
    expect(() => sortearGrupos(ids.slice(0, 30), criarRng(1))).toThrow();
  });
});

describe('classificadosDoGrupo', () => {
  it('pega os 2 primeiros pela tabela', () => {
    let t = criarTabela(['a', 'b', 'c', 'd']);
    t = registrarResultado(t, { casa: 'c', fora: 'a', golsCasa: 3, golsFora: 0 });
    t = registrarResultado(t, { casa: 'd', fora: 'b', golsCasa: 1, golsFora: 0 });
    t = registrarResultado(t, { casa: 'c', fora: 'd', golsCasa: 1, golsFora: 1 });
    expect(classificadosDoGrupo(t)).toEqual(['c', 'd']);
  });
});

describe('cruzarOitavas', () => {
  it('1º de um grupo pega o 2º do grupo vizinho e decide em casa', () => {
    const classificados = [['1A', '2A'], ['1B', '2B'], ['1C', '2C'], ['1D', '2D']];
    expect(cruzarOitavas(classificados)).toEqual([['2B', '1A'], ['2A', '1B'], ['2D', '1C'], ['2C', '1D']]);
  });
});
