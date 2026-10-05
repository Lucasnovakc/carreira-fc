import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';

describe('criarRng', () => {
  it('mesma semente gera a mesma sequência', () => {
    const a = criarRng(123), b = criarRng(123);
    const sa = Array.from({ length: 5 }, () => a.next());
    const sb = Array.from({ length: 5 }, () => b.next());
    expect(sa).toEqual(sb);
  });

  it('sementes diferentes geram sequências diferentes', () => {
    expect(criarRng(1).next()).not.toBe(criarRng(2).next());
  });

  it('next fica em [0, 1)', () => {
    const r = criarRng(7);
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int é inclusivo nas duas pontas', () => {
    const r = criarRng(9);
    const vistos = new Set();
    for (let i = 0; i < 2000; i++) vistos.add(r.int(1, 3));
    expect([...vistos].sort()).toEqual([1, 2, 3]);
  });

  it('retoma a sequência a partir do estado salvo', () => {
    const a = criarRng(55);
    a.next(); a.next();
    const b = criarRng(a.estado());
    expect(b.next()).toBe(a.next());
  });

  it('embaralhar não altera a lista original e mantém os itens', () => {
    const r = criarRng(3);
    const lista = [1, 2, 3, 4, 5];
    const e = r.embaralhar(lista);
    expect(lista).toEqual([1, 2, 3, 4, 5]);
    expect([...e].sort()).toEqual(lista);
  });
});
