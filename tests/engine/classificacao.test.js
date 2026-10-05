import { describe, it, expect } from 'vitest';
import { vagasContinentais, roletasDoFimDeTemporada } from '../../src/engine/classificacao.js';

const ordem = Array.from({ length: 20 }, (_, i) => `c${i + 1}`); // c1 = 1º lugar

describe('vagasContinentais', () => {
  it('G4 na Libertadores, 5º ao 10º na Sul-Americana', () => {
    const v = vagasContinentais(ordem);
    expect(v.libertadores).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(v.sulamericana).toEqual(['c5', 'c6', 'c7', 'c8', 'c9', 'c10']);
  });

  it('campeão da Copa do Brasil fora do G4 vai à Libertadores e a vaga da Sul-Americana desce', () => {
    const v = vagasContinentais(ordem, { copaDoBrasil: 'c7' });
    expect(v.libertadores).toEqual(['c1', 'c2', 'c3', 'c4', 'c7']);
    expect(v.sulamericana).toEqual(['c5', 'c6', 'c8', 'c9', 'c10', 'c11']);
  });

  it('campeão de copa que ficou mal no Brasileirão também vai', () => {
    const v = vagasContinentais(ordem, { libertadores: 'c18', sulamericana: 'c15' });
    expect(v.libertadores).toEqual(['c1', 'c2', 'c3', 'c4', 'c18', 'c15']);
    expect(v.sulamericana).toEqual(['c5', 'c6', 'c7', 'c8', 'c9', 'c10']);
  });

  it('campeão que já está no G4 não ocupa vaga extra; estrangeiro campeão é ignorado', () => {
    const v = vagasContinentais(ordem, { copaDoBrasil: 'c2', libertadores: 'boca' });
    expect(v.libertadores).toEqual(['c1', 'c2', 'c3', 'c4']);
  });
});

describe('roletasDoFimDeTemporada', () => {
  const tipos = (fila) => fila.map((r) => `${r.tipo}${r.obrigatoria ? '!' : ''}`);

  it.each([
    [1, ['boa', 'boa', 'boa']],
    [3, ['boa', 'boa']],
    [5, ['boa']],
    [10, ['boa']],
    [11, []],
    [16, []],
    [17, ['ruim!', 'ruim!', 'ruim!']],
    [20, ['ruim!', 'ruim!', 'ruim!']],
  ])('%iº lugar', (pos, esperado) => {
    expect(tipos(roletasDoFimDeTemporada(pos))).toEqual(esperado);
  });

  it('+1 boa por título de copa e +1 média pelo estadual', () => {
    expect(tipos(roletasDoFimDeTemporada(3, ['copaDoBrasil']))).toEqual(['boa', 'boa', 'boa']);
    expect(tipos(roletasDoFimDeTemporada(1, ['brasileirao', 'libertadores', 'estadual']))).toEqual(['boa', 'boa', 'boa', 'boa', 'media']);
  });

  it('rebaixado que ganha copa leva as ruins e a boa', () => {
    expect(tipos(roletasDoFimDeTemporada(18, ['copaDoBrasil']))).toEqual(['ruim!', 'ruim!', 'ruim!', 'boa']);
  });
});
