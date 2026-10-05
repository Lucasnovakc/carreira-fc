import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { criarBrasileirao, criarEstadual, criarCopaDoBrasil, criarContinental } from '../../src/engine/competicoes.js';
import { montarCalendario, RODADAS_COPA, RODADAS_CONTINENTAL } from '../../src/engine/calendario.js';

const ids = (n, p) => Array.from({ length: n }, (_, i) => `${p}${i}`);

function completas() {
  const rng = criarRng(1);
  return {
    estadual: criarEstadual(ids(12, 'e')),
    brasileirao: criarBrasileirao(ids(20, 'b')),
    copaDoBrasil: criarCopaDoBrasil(ids(32, 'c'), rng),
    libertadores: criarContinental('libertadores', ids(32, 'l'), rng),
    sulamericana: criarContinental('sulamericana', ids(32, 's'), rng),
  };
}

const vezes = (datas, id) => datas.filter((d) => d.comps.includes(id)).length;

describe('montarCalendario', () => {
  it('cada competição aparece exatamente o número de etapas que tem', () => {
    const comps = completas();
    const datas = montarCalendario(comps);
    for (const [id, c] of Object.entries(comps)) expect(vezes(datas, id)).toBe(c.etapas.length);
    expect(datas).toHaveLength(14 + 38 + 10 + 13);
  });

  it('estadual vem primeiro, depois o Brasileirão começa', () => {
    const datas = montarCalendario(completas());
    expect(datas.slice(0, 14).every((d) => d.tipo === 'estadual')).toBe(true);
    expect(datas[14].tipo).toBe('brasileirao');
    expect(datas.at(-1).tipo).toBe('brasileirao');
  });

  it('Libertadores e Sul-Americana dividem a mesma data', () => {
    const datas = montarCalendario(completas());
    const cont = datas.filter((d) => d.tipo === 'continental');
    expect(cont).toHaveLength(13);
    expect(cont.every((d) => d.comps.length === 2)).toBe(true);
  });

  it('temporada 1: só estadual e Brasileirão', () => {
    const { estadual, brasileirao } = completas();
    const datas = montarCalendario({ estadual, brasileirao });
    expect(datas).toHaveLength(52);
  });

  it('as tabelas de datas têm o tamanho das competições', () => {
    expect(RODADAS_COPA).toHaveLength(10);
    expect(RODADAS_CONTINENTAL).toHaveLength(13);
    expect(Math.max(...RODADAS_COPA, ...RODADAS_CONTINENTAL)).toBeLessThan(38);
  });
});
