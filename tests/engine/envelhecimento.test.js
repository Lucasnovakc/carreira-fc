import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { deltaOvr, chanceAposentar, envelhecer } from '../../src/engine/envelhecimento.js';

describe('deltaOvr', () => {
  it.each([[19, 2], [23, 2], [24, 1], [27, 1], [28, 0], [31, 0], [32, -2], [33, -2], [34, -4], [38, -4]])(
    '%i anos: %i', (idade, d) => expect(deltaOvr(idade)).toBe(d));
});

describe('chanceAposentar', () => {
  it('ninguém antes dos 35, 40% dos 35 aos 36, obrigatório aos 37', () => {
    expect(chanceAposentar(34)).toBe(0);
    expect(chanceAposentar(35)).toBe(0.4);
    expect(chanceAposentar(36)).toBe(0.4);
    expect(chanceAposentar(37)).toBe(1);
  });
});

describe('envelhecer', () => {
  it('soma 1 ano, aplica o delta e limita entre 40 e 99', () => {
    const { jogadores } = envelhecer([
      { id: 'a', ovr: 98, idade: 20 },
      { id: 'b', ovr: 80, idade: 30 },
      { id: 'c', ovr: 41, idade: 33 },
    ], criarRng(1));
    expect(jogadores).toEqual([
      { id: 'a', ovr: 99, idade: 21, ovrBase: 98 }, // 98 + 2, limitado a 99
      { id: 'b', ovr: 80, idade: 31, ovrBase: 80 },
      { id: 'c', ovr: 40, idade: 34, ovrBase: 41 },
    ]);
  });

  it('aos 37 sempre se aposenta', () => {
    const r = envelhecer([{ id: 'v', ovr: 80, idade: 36 }], criarRng(2));
    expect(r.jogadores).toEqual([]);
    expect(r.aposentados).toEqual([{ id: 'v', ovr: 76, idade: 37, ovrBase: 80 }]);
  });

  it('aos 35 se aposenta perto de 40% das vezes', () => {
    const rng = criarRng(3);
    let n = 0;
    for (let i = 0; i < 5000; i++) n += envelhecer([{ id: 'x', ovr: 80, idade: 34 }], rng).aposentados.length;
    expect(n / 5000).toBeGreaterThan(0.36);
    expect(n / 5000).toBeLessThan(0.44);
  });

  it('não altera a lista recebida', () => {
    const lista = [{ id: 'a', ovr: 80, idade: 25 }];
    envelhecer(lista, criarRng(4));
    expect(lista).toEqual([{ id: 'a', ovr: 80, idade: 25 }]);
  });
});

describe('teto de evolução', () => {
  it('jovem não passa de +6 acima do overall com que entrou (ovrBase)', () => {
    let lista = [{ id: 'g', ovr: 78, ovrBase: 78, idade: 17 }];
    const rng = criarRng(5);
    for (let i = 0; i < 6; i++) lista = envelhecer(lista, rng).jogadores;
    expect(lista[0]).toMatchObject({ idade: 23, ovr: 84 });
  });

  it('sem ovrBase, o teto é o overall atual + 6', () => {
    const { jogadores } = envelhecer([{ id: 'x', ovr: 80, idade: 19 }], criarRng(6));
    expect(jogadores[0].ovr).toBe(82);
    expect(jogadores[0].ovrBase).toBe(80);
  });

  it('o teto não impede a queda por idade', () => {
    const { jogadores } = envelhecer([{ id: 'v', ovr: 90, ovrBase: 84, idade: 33 }], criarRng(7));
    expect(jogadores[0].ovr).toBe(86);
  });
});
