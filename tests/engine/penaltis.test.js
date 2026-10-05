import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { disputarPenaltis, probConversao } from '../../src/engine/penaltis.js';

const s = (ata, gol) => ({ ata, gol });

describe('probConversao', () => {
  it('75% com forças iguais e limitada entre 55% e 92%', () => {
    expect(probConversao(80, 80)).toBeCloseTo(0.75);
    expect(probConversao(99, 20)).toBe(0.92);
    expect(probConversao(20, 99)).toBe(0.55);
  });
});

describe('disputarPenaltis', () => {
  it('sempre tem vencedor e o placar bate com as cobranças', () => {
    const rng = criarRng(1);
    for (let i = 0; i < 2000; i++) {
      const r = disputarPenaltis(s(80, 80), s(80, 80), rng);
      expect(r.casa).not.toBe(r.fora);
      expect(r.vencedor).toBe(r.casa > r.fora ? 'casa' : 'fora');
      expect(r.cobrancas.filter((c) => c.lado === 'casa' && c.convertido)).toHaveLength(r.casa);
      expect(r.cobrancas.filter((c) => c.lado === 'fora' && c.convertido)).toHaveLength(r.fora);
    }
  });

  it('para cedo quando um lado não alcança mais o outro', () => {
    const rng = criarRng(2);
    for (let i = 0; i < 2000; i++) {
      const r = disputarPenaltis(s(80, 80), s(80, 80), rng);
      const nCasa = r.cobrancas.filter((c) => c.lado === 'casa').length;
      const nFora = r.cobrancas.filter((c) => c.lado === 'fora').length;
      if (nCasa <= 5) expect(nFora).toBeLessThanOrEqual(5);
      // nunca há uma cobrança desnecessária: depois de decidido nos 5, ninguém bate de novo
      if (nCasa < 5 || nFora < 5) {
        const restamCasa = 5 - nCasa, restamFora = 5 - nFora;
        expect(r.casa + restamCasa < r.fora || r.fora + restamFora < r.casa).toBe(true);
      }
    }
  });

  it('é equilibrado entre times iguais e favorece o melhor batedor', () => {
    const rng = criarRng(3);
    let casaIgual = 0, casaForte = 0;
    for (let i = 0; i < 5000; i++) {
      if (disputarPenaltis(s(80, 80), s(80, 80), rng).vencedor === 'casa') casaIgual++;
      if (disputarPenaltis(s(95, 80), s(70, 80), rng).vencedor === 'casa') casaForte++;
    }
    expect(casaIgual / 5000).toBeGreaterThan(0.45);
    expect(casaIgual / 5000).toBeLessThan(0.55);
    expect(casaForte / 5000).toBeGreaterThan(0.6);
  });
});
