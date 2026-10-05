import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { ajustePorPosicao, evoluirClubes, PUXADA, OSCILACAO } from '../../src/engine/evolucaoClubes.js';

const n = (v) => ({ gol: v, def: v, mei: v, ata: v });
const media = (x) => (x.gol + x.def + x.mei + x.ata) / 4;

describe('ajustePorPosicao', () => {
  it.each([[1, 3], [2, 2], [4, 2], [5, 1], [10, 1], [11, 0], [16, 0], [17, -1], [20, -1]])('%iº: %i', (p, a) => {
    expect(ajustePorPosicao(p)).toBe(a);
  });
});

describe('evoluirClubes', () => {
  const ordem = Array.from({ length: 20 }, (_, i) => `c${i + 1}`);
  const base = () => Object.fromEntries([...ordem, 'eu', 'boca'].map((id) => [id, n(75)]));

  it('campeão sobe, rebaixados caem, meio da tabela fica (sem oscilação na média de muitas rodadas)', () => {
    const rng = criarRng(1);
    let somaCampeao = 0, somaUltimo = 0, somaMeio = 0;
    for (let i = 0; i < 400; i++) {
      const r = evoluirClubes(base(), base(), { ordemBrasileirao: ordem, campeoes: [], excluir: 'eu' }, rng);
      somaCampeao += media(r.c1) - 75;
      somaUltimo += media(r.c20) - 75;
      somaMeio += media(r.c13) - 75;
    }
    expect(somaCampeao / 400).toBeCloseTo(3, 0);
    expect(somaUltimo / 400).toBeCloseTo(-1, 0);
    expect(Math.abs(somaMeio / 400)).toBeLessThan(0.5);
  });

  it('cada título de copa soma +1, inclusive para estrangeiro', () => {
    const semOsc = { int: () => 0 };
    const r = evoluirClubes(base(), base(), { ordemBrasileirao: ordem, campeoes: ['c12', 'c12', 'boca'], excluir: 'eu' }, semOsc);
    expect(r.c12).toEqual(n(77));
    expect(r.boca).toEqual(n(76));
  });

  it('a nota é puxada 20% de volta para a original', () => {
    const semOsc = { int: () => 0 };
    const atual = { ...base(), c13: n(85) };
    const r = evoluirClubes(atual, base(), { ordemBrasileirao: ordem, campeoes: [], excluir: 'eu' }, semOsc);
    expect(r.c13).toEqual(n(85 - Math.round(10 * PUXADA)));
  });

  it('oscilação fica entre -2 e +2 e as notas ficam entre 50 e 90', () => {
    const rng = criarRng(2);
    const atual = { ...base(), c1: n(90), c20: n(50) };
    const orig = { ...base(), c1: n(90), c20: n(50) };
    for (let i = 0; i < 200; i++) {
      const r = evoluirClubes(atual, orig, { ordemBrasileirao: ordem, campeoes: [], excluir: 'eu' }, rng);
      for (const s of ['gol', 'def', 'mei', 'ata']) {
        expect(r.c1[s]).toBeLessThanOrEqual(90);
        expect(r.c20[s]).toBeGreaterThanOrEqual(50);
        expect(Math.abs(r.c13[s] - 75)).toBeLessThanOrEqual(OSCILACAO);
      }
    }
  });

  it('o clube do usuário não muda e a entrada não é alterada', () => {
    const atual = base();
    const copia = structuredClone(atual);
    const r = evoluirClubes(atual, base(), { ordemBrasileirao: ['eu', ...ordem.slice(0, 19)], campeoes: ['eu'], excluir: 'eu' }, criarRng(3));
    expect(r.eu).toEqual(n(75));
    expect(atual).toEqual(copia);
  });
});
