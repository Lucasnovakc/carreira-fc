import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { deltaOvr, chanceAposentar, envelhecer } from '../../src/engine/envelhecimento.js';

describe('deltaOvr', () => {
  it.each([[19, 3], [23, 3], [24, 1], [27, 1], [28, 0], [31, 0], [32, -2], [33, -2], [34, -4], [38, -4]])(
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
      { id: 'a', ovr: 99, idade: 21 },
      { id: 'b', ovr: 80, idade: 31 },
      { id: 'c', ovr: 40, idade: 34 },
    ]);
  });

  it('aos 37 sempre se aposenta', () => {
    const r = envelhecer([{ id: 'v', ovr: 80, idade: 36 }], criarRng(2));
    expect(r.jogadores).toEqual([]);
    expect(r.aposentados).toEqual([{ id: 'v', ovr: 76, idade: 37 }]);
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
