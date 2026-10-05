import { describe, it, expect } from 'vitest';
import { dados } from '../../src/data/index.js';
import { POSICOES } from '../../src/engine/posicoes.js';

const { clubes, estaduais, estrangeiros, elencos } = dados;

const SERIE_A_2026 = [
  'athletico-pr', 'atletico-mg', 'bahia', 'botafogo', 'bragantino', 'chapecoense', 'corinthians', 'coritiba',
  'cruzeiro', 'flamengo', 'fluminense', 'gremio', 'internacional', 'mirassol', 'palmeiras', 'remo', 'santos',
  'sao-paulo', 'vasco', 'vitoria',
];
const ESTADOS = ['SP', 'RJ', 'MG', 'RS', 'BA', 'PR', 'SC', 'PA'];
const ELENCOS = [
  'santos-1962', 'botafogo-1962', 'atletico-mg-1971', 'palmeiras-1972', 'internacional-1976', 'cruzeiro-1976', 'fluminense-1976', 'guarani-1978',
  'atletico-mg-1980', 'flamengo-1981', 'corinthians-1982', 'gremio-1983', 'coritiba-1985', 'sao-paulo-1986', 'bahia-1988', 'vasco-1989',
  'criciuma-1991', 'sao-paulo-1992', 'palmeiras-1993', 'botafogo-1995', 'gremio-1995', 'vasco-1997', 'juventude-1999', 'corinthians-1999',
  'sao-caetano-2000', 'athletico-pr-2001', 'santos-2002', 'cruzeiro-2003', 'santo-andre-2004', 'sao-paulo-2005', 'internacional-2006', 'sport-2008',
  'santos-2011', 'corinthians-2012', 'fluminense-2012', 'atletico-mg-2013', 'cruzeiro-2014', 'flamengo-2019', 'palmeiras-2021', 'botafogo-2024',
];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COR = /^#[0-9a-f]{6}$/i;
const notaValida = (n) => Number.isInteger(n) && n >= 50 && n <= 90;
const semRepetir = (lista) => new Set(lista).size === lista.length;

describe('clubes', () => {
  it('ids únicos e válidos, cores e notas', () => {
    expect(semRepetir(clubes.map((c) => c.id))).toBe(true);
    for (const c of clubes) {
      expect(c.id).toMatch(ID);
      expect(c.nome.length).toBeGreaterThan(0);
      expect(c.sigla).toMatch(/^[A-Z0-9]{2,4}$/);
      expect(c.cores).toHaveLength(2);
      c.cores.forEach((cor) => expect(cor).toMatch(COR));
      for (const s of ['gol', 'def', 'mei', 'ata']) expect(notaValida(c[s]), `${c.id}.${s}`).toBe(true);
      expect(ESTADOS).toContain(c.estado);
      expect(Array.isArray(c.classicos)).toBe(true);
    }
  });

  it('Série A 2026 exata', () => {
    expect(clubes.filter((c) => c.serieA).map((c) => c.id).sort()).toEqual([...SERIE_A_2026].sort());
  });

  it('clássicos apontam para clubes da Série A e são recíprocos', () => {
    const porId = Object.fromEntries(clubes.map((c) => [c.id, c]));
    for (const c of clubes) {
      for (const r of c.classicos) {
        expect(porId[r]?.serieA, `${c.id} -> ${r}`).toBe(true);
        expect(porId[r].classicos, `${r} não lista ${c.id}`).toContain(c.id);
      }
    }
  });

  it('todo clube da Série A tem pelo menos um clássico', () => {
    for (const c of clubes.filter((x) => x.serieA)) expect(c.classicos.length, c.id).toBeGreaterThan(0);
  });
});

describe('estaduais', () => {
  it('8 estaduais de 12 clubes existentes e do próprio estado', () => {
    expect(Object.keys(estaduais).sort()).toEqual([...ESTADOS].sort());
    const porId = Object.fromEntries(clubes.map((c) => [c.id, c]));
    for (const [uf, e] of Object.entries(estaduais)) {
      expect(e.nome.length).toBeGreaterThan(0);
      expect(e.clubes).toHaveLength(12);
      expect(semRepetir(e.clubes)).toBe(true);
      for (const id of e.clubes) expect(porId[id]?.estado, `${uf}: ${id}`).toBe(uf);
    }
  });

  it('todo clube da Série A está no estadual do seu estado', () => {
    for (const c of clubes.filter((x) => x.serieA)) expect(estaduais[c.estado].clubes).toContain(c.id);
  });

  it('todo clube cadastrado joga algum estadual', () => {
    const todos = new Set(Object.values(estaduais).flatMap((e) => e.clubes));
    for (const c of clubes) expect(todos.has(c.id), c.id).toBe(true);
  });

  it('pelo menos 24 clubes fora da Série A (para completar a Copa do Brasil)', () => {
    expect(clubes.filter((c) => !c.serieA).length).toBeGreaterThanOrEqual(24);
  });
});

describe('estrangeiros', () => {
  it('56 clubes com ids únicos que não colidem com os brasileiros', () => {
    expect(estrangeiros).toHaveLength(56);
    const ids = estrangeiros.map((c) => c.id);
    expect(semRepetir(ids)).toBe(true);
    const br = new Set(clubes.map((c) => c.id));
    for (const c of estrangeiros) {
      expect(c.id).toMatch(ID);
      expect(br.has(c.id), c.id).toBe(false);
      expect(c.pais).toMatch(/^[A-Z]{3}$/);
      expect(c.cores).toHaveLength(2);
      for (const s of ['gol', 'def', 'mei', 'ata']) expect(notaValida(c[s]), `${c.id}.${s}`).toBe(true);
    }
  });
});

describe('elencos', () => {
  it('são exatamente os 40 aprovados', () => {
    expect(elencos.map((e) => e.id).sort()).toEqual([...ELENCOS].sort());
  });

  it.each(ELENCOS)('%s: formato e composição mínima', (id) => {
    const e = elencos.find((x) => x.id === id);
    expect(e, id).toBeDefined();
    expect(e.clube.length).toBeGreaterThan(0);
    expect(Number.isInteger(e.ano)).toBe(true);
    expect(id.endsWith(String(e.ano))).toBe(true);
    expect(e.cores).toHaveLength(2);
    expect(e.jogadores.length).toBeGreaterThanOrEqual(18);
    expect(e.jogadores.length).toBeLessThanOrEqual(23);
    expect(semRepetir(e.jogadores.map((j) => j.nome))).toBe(true);
    const conta = (...ps) => e.jogadores.filter((j) => ps.includes(j.pos)).length;
    expect(conta('GOL'), 'GOL').toBeGreaterThanOrEqual(2);
    expect(conta('ZAG'), 'ZAG').toBeGreaterThanOrEqual(3);
    expect(conta('LD'), 'LD').toBeGreaterThanOrEqual(1);
    expect(conta('LE'), 'LE').toBeGreaterThanOrEqual(1);
    expect(conta('VOL', 'MC', 'MEI'), 'meio').toBeGreaterThanOrEqual(3);
    expect(conta('PD', 'PE', 'CA'), 'ataque').toBeGreaterThanOrEqual(3);
    for (const j of e.jogadores) {
      expect(POSICOES, `${id}: ${j.nome}`).toContain(j.pos);
      expect(Number.isInteger(j.ovr) && j.ovr >= 40 && j.ovr <= 99, `${id}: ${j.nome} ovr`).toBe(true);
      expect(Number.isInteger(j.idade) && j.idade >= 16 && j.idade <= 42, `${id}: ${j.nome} idade`).toBe(true);
    }
    expect(e.jogadores.some((j) => j.ovr <= 85), 'roleta média').toBe(true);
  });

  it('a base tem pelo menos 60 jogadores com overall até 68 (roleta ruim)', () => {
    expect(elencos.flatMap((e) => e.jogadores).filter((j) => j.ovr <= 68).length).toBeGreaterThanOrEqual(60);
  });

  it('lendas são raras: no máximo 25 jogadores com 90+ na base inteira', () => {
    expect(elencos.flatMap((e) => e.jogadores).filter((j) => j.ovr >= 90).length).toBeLessThanOrEqual(25);
  });
});
