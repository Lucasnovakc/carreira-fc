import { describe, it, expect } from 'vitest';
import formacoes from '../../src/data/formacoes.json';
import { avaliarVaga, reorganizar, posicoesNoCampo } from '../../src/ui/logica/escalacao.js';

const j = (id, pos, ovr = 80) => ({ id, pos, ovr });

describe('avaliarVaga', () => {
  it('clássico mostra o overall efetivo e a perda', () => {
    expect(avaliarVaga(j('p', 'CA', 97), 'CA')).toMatchObject({ ovr: 97, texto: '97' });
    expect(avaliarVaga(j('p', 'CA', 97), 'PE')).toMatchObject({ ovr: 89, texto: '89 (−8%)' });
    expect(avaliarVaga(j('p', 'ZAG', 80), 'GOL').texto).toBe('40 (−50%)');
  });

  it('olheiro esconde números e mostra só o tipo de encaixe', () => {
    expect(avaliarVaga(j('p', 'CA', 97), 'CA', 'olheiro')).toEqual({ ovr: null, fator: 1, texto: 'posição natural' });
    expect(avaliarVaga(j('p', 'CA', 97), 'PE', 'olheiro').texto).toBe('posição vizinha');
    expect(avaliarVaga(j('p', 'ZAG', 80), 'CA', 'olheiro').texto).toBe('fora de posição');
    expect(avaliarVaga(j('p', 'ZAG', 80), 'GOL', 'olheiro').texto).toBe('improvisado');
  });
});

describe('reorganizar', () => {
  const vagas433 = formacoes.find((f) => f.id === '4-3-3').vagas;

  it('cada jogador vai para a sua posição quando dá', () => {
    const jogadores = vagas433.map((v, i) => j(`j${i}`, v)).reverse();
    const ids = reorganizar(jogadores, vagas433);
    ids.forEach((id, i) => expect(jogadores.find((x) => x.id === id).pos).toBe(vagas433[i]));
  });

  it('o goleiro é escolhido primeiro', () => {
    const jogadores = [j('gol', 'GOL', 70), j('craque', 'CA', 95), ...Array.from({ length: 9 }, (_, i) => j(`z${i}`, 'ZAG', 75))];
    expect(reorganizar(jogadores, vagas433)[0]).toBe('gol');
  });

  it('com menos de 11 jogadores sobram vagas vazias', () => {
    const ids = reorganizar([j('a', 'GOL'), j('b', 'CA')], vagas433);
    expect(ids.filter(Boolean)).toHaveLength(2);
    expect(ids.filter((x) => x === null)).toHaveLength(9);
  });
});

describe('posicoesNoCampo', () => {
  it('goleiro embaixo, centroavante em cima, laterais nas pontas certas', () => {
    const vagas = formacoes.find((f) => f.id === '4-3-3').vagas; // GOL LD ZAG ZAG LE VOL MC MC PD CA PE
    const p = posicoesNoCampo(vagas);
    expect(p).toHaveLength(11);
    expect(p[0].y).toBeGreaterThan(p[9].y);
    expect(p[4].x).toBeLessThan(p[1].x); // LE à esquerda do LD
    expect(p[10].x).toBeLessThan(p[8].x); // PE à esquerda do PD
    for (const { x, y } of p) {
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(100);
      expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(100);
    }
  });

  it('jogadores na mesma linha não se sobrepõem', () => {
    const vagas = formacoes.find((f) => f.id === '4-2-2-2').vagas;
    const p = posicoesNoCampo(vagas);
    const chaves = p.map(({ x, y }) => `${x}-${y}`);
    expect(new Set(chaves).size).toBe(11);
  });
});

describe('vagas não se sobrepõem num celular de 360 px', () => {
  // campo útil ~328 x 437 px (aspect 3/4); botão da vaga 58 x 46 px
  const LARGURA = 328, ALTURA = 437, VAGA_L = 58, VAGA_A = 46;
  it.each(formacoes.map((f) => f.id))('%s', (id) => {
    const vagas = formacoes.find((f) => f.id === id).vagas;
    const p = posicoesNoCampo(vagas);
    const choques = [];
    for (let a = 0; a < p.length; a++) {
      for (let b = a + 1; b < p.length; b++) {
        const dx = Math.abs(p[a].x - p[b].x) / 100 * LARGURA;
        const dy = Math.abs(p[a].y - p[b].y) / 100 * ALTURA;
        if (dx < VAGA_L && dy < VAGA_A) choques.push(`${vagas[a]}/${vagas[b]}`);
      }
    }
    expect(choques).toEqual([]);
  });
});
