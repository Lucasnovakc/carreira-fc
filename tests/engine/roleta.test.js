import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { girarRoleta, jogadorDaBase, idJogador } from '../../src/engine/roleta.js';

const elencos = [
  { id: 'santos-1962', clube: 'Santos', ano: 1962, jogadores: [
    { nome: 'Pelé', pos: 'CA', ovr: 97, idade: 21 },
    { nome: 'Lima', pos: 'VOL', ovr: 80, idade: 20 },
    { nome: 'Reserva', pos: 'ZAG', ovr: 65, idade: 24 },
  ] },
  { id: 'fla-1981', clube: 'Flamengo', ano: 1981, jogadores: [
    { nome: 'Zico', pos: 'MEI', ovr: 96, idade: 28 },
    { nome: 'Nunes', pos: 'CA', ovr: 84, idade: 27 },
  ] },
];

describe('jogadorDaBase', () => {
  it('monta o jogador com id e origem', () => {
    expect(jogadorDaBase(elencos[0], 0)).toEqual({
      id: 'santos-1962:0', nome: 'Pelé', pos: 'CA', ovr: 97, idade: 21, origem: 'Santos 1962',
    });
    expect(idJogador('x', 3)).toBe('x:3');
  });
});

describe('girarRoleta', () => {
  it('boa: todos os jogadores do elenco sorteado', () => {
    const r = girarRoleta(elencos, criarRng(1), { excluirElencos: ['fla-1981'] });
    expect(r.elencoId).toBe('santos-1962');
    expect(r.opcoes.map((j) => j.nome)).toEqual(['Pelé', 'Lima', 'Reserva']);
  });

  it('média: só até 85 de overall', () => {
    const r = girarRoleta(elencos, criarRng(1), { tipo: 'media', excluirElencos: ['santos-1962'] });
    expect(r.opcoes.map((j) => j.nome)).toEqual(['Nunes']);
  });

  it('ruim: só até 68, e pula elenco sem ninguém nessa faixa', () => {
    const rng = criarRng(2);
    for (let i = 0; i < 50; i++) {
      const r = girarRoleta(elencos, rng, { tipo: 'ruim' });
      expect(r.elencoId).toBe('santos-1962');
      expect(r.opcoes.map((j) => j.nome)).toEqual(['Reserva']);
    }
  });

  it('não oferece jogadores excluídos (já no elenco ou ex-jogadores)', () => {
    const r = girarRoleta(elencos, criarRng(3), { excluirElencos: ['fla-1981'], excluirJogadores: ['santos-1962:0'] });
    expect(r.opcoes.map((j) => j.nome)).toEqual(['Lima', 'Reserva']);
  });

  it('retorna null quando nada serve', () => {
    expect(girarRoleta(elencos, criarRng(4), { excluirElencos: ['santos-1962', 'fla-1981'] })).toBeNull();
  });

  it('sorteia os dois elencos ao longo de vários giros', () => {
    const rng = criarRng(5);
    const vistos = new Set();
    for (let i = 0; i < 50; i++) vistos.add(girarRoleta(elencos, rng).elencoId);
    expect(vistos.size).toBe(2);
  });

  it('tipo desconhecido lança erro', () => {
    expect(() => girarRoleta(elencos, criarRng(6), { tipo: 'otima' })).toThrow();
  });
});
