import { describe, it, expect } from 'vitest';
import {
  vagasDaFormacao, completarTitulares, escalacaoParaJogo, aplicarConsequencias, forcaMediaDoElenco, novoJogadorDoElenco,
} from '../../src/engine/elenco.js';

const j = (id, pos, ovr, extra = {}) => novoJogadorDoElenco({ id, nome: id, pos, ovr, idade: 25, origem: 'x', ...extra });

// 4-3-3: GOL LD ZAG ZAG LE VOL MC MC PD CA PE
function elenco433() {
  const vagas = vagasDaFormacao('4-3-3');
  const titulares = vagas.map((v, i) => j(`t${i}`, v, 80));
  const banco = [j('bGOL', 'GOL', 70), j('bZAG', 'ZAG', 75), j('bMC', 'MC', 72), j('bCA', 'CA', 78)];
  const jogadores = Object.fromEntries([...titulares, ...banco].map((x) => [x.id, x]));
  return { formacao: '4-3-3', postura: 'equilibrada', titulares: titulares.map((x) => x.id), jogadores };
}

describe('vagasDaFormacao', () => {
  it('devolve as 11 vagas e rejeita formação desconhecida', () => {
    expect(vagasDaFormacao('4-4-2')).toHaveLength(11);
    expect(() => vagasDaFormacao('3-5-2')).toThrow();
  });
});

describe('escalacaoParaJogo', () => {
  it('todos disponíveis: os 11 titulares nas suas vagas e 4 no banco', () => {
    const { escalacao, banco, desfalques } = escalacaoParaJogo(elenco433());
    expect(escalacao.map((e) => e.jogador.id)).toEqual(['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10']);
    expect(banco.map((b) => b.id).sort()).toEqual(['bCA', 'bGOL', 'bMC', 'bZAG']);
    expect(desfalques).toBe(0);
  });

  it('titular lesionado é trocado pelo melhor reserva para a vaga', () => {
    const e = elenco433();
    e.jogadores.t9.fora = 2; // CA
    const { escalacao, banco } = escalacaoParaJogo(e);
    expect(escalacao.find((x) => x.vaga === 'CA').jogador.id).toBe('bCA');
    expect(banco.some((b) => b.id === 't9')).toBe(false);
  });

  it('goleiro suspenso: entra o goleiro reserva', () => {
    const e = elenco433();
    e.jogadores.t0.suspenso = 1;
    expect(escalacaoParaJogo(e).escalacao.find((x) => x.vaga === 'GOL').jogador.id).toBe('bGOL');
  });

  it('menos de 11 disponíveis: joga com quem tem e conta desfalques', () => {
    const e = elenco433();
    for (const id of ['t1', 't2', 't3', 't4', 'bZAG', 'bGOL']) e.jogadores[id].fora = 1;
    const { escalacao, banco, desfalques } = escalacaoParaJogo(e);
    expect(escalacao).toHaveLength(9);
    expect(desfalques).toBe(2);
    expect(banco).toEqual([]);
  });
});

describe('completarTitulares', () => {
  it('preenche vaga vazia com o melhor do elenco para ela', () => {
    const e = elenco433();
    delete e.jogadores.t9; // CA aposentou
    const c = completarTitulares(e);
    expect(c.titulares[9]).toBe('bCA');
    expect(c.titulares.filter(Boolean)).toHaveLength(11);
  });
});

describe('aplicarConsequencias', () => {
  it('quem estava fora cumpre um jogo; lesionado e expulso ficam fora', () => {
    const e = elenco433();
    e.jogadores.t5.fora = 2;
    e.jogadores.t6.suspenso = 1;
    const r = aplicarConsequencias(e, { lesoes: [{ jogadorId: 't8', jogos: 3 }], expulsos: [{ jogadorId: 't10' }] });
    expect(r.jogadores.t5.fora).toBe(1);
    expect(r.jogadores.t6.suspenso).toBe(0);
    expect(r.jogadores.t8.fora).toBe(3);
    expect(r.jogadores.t10.suspenso).toBe(1);
    expect(e.jogadores.t5.fora).toBe(2); // não muta
  });

  it('ignora ids que não são do elenco (ex.: jogadores do adversário)', () => {
    const r = aplicarConsequencias(elenco433(), { lesoes: [{ jogadorId: 'outro', jogos: 2 }], expulsos: [{ jogadorId: null }] });
    expect(r.jogadores.outro).toBeUndefined();
  });
});

describe('forcaMediaDoElenco', () => {
  it('média do overall dos titulares', () => {
    expect(forcaMediaDoElenco(elenco433())).toBe(80);
  });
});
