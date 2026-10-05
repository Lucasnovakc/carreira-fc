import { describe, it, expect } from 'vitest';
import {
  narrar, eventosAte, pressao, contarChances, faixaCansaco, minutoNoPeriodo, rotuloRelogio,
} from '../../src/ui/logica/partida.js';

const nomes = { casa: 'Santos', fora: 'Palmeiras' };

describe('narrar', () => {
  it('gol com autor usa o nome do jogador', () => {
    const t = narrar({ tipo: 'gol', minuto: 64, lado: 'casa', nome: 'Pelé' }, nomes);
    expect(t).toContain('Pelé');
    expect(t).not.toContain('{');
  });

  it('gol sem autor (clube do computador) usa o nome do clube', () => {
    expect(narrar({ tipo: 'gol', minuto: 10, lado: 'fora', nome: null }, nomes)).toMatch(/Palmeiras/);
  });

  it('lesão diz quantos jogos fica fora; troca diz quem entra', () => {
    expect(narrar({ tipo: 'lesao', minuto: 30, lado: 'casa', nome: 'Zito', jogos: 2 }, nomes)).toContain('2 jogos fora');
    expect(narrar({ tipo: 'lesao', minuto: 30, lado: 'casa', nome: 'Zito', jogos: 1 }, nomes)).toContain('1 jogo fora');
    expect(narrar({ tipo: 'troca', minuto: 45, lado: 'casa', nome: 'Zito', entraNome: 'Lima' }, nomes)).toBe('Sai Zito, entra Lima.');
  });

  it('é determinística: mesmo evento, mesma frase', () => {
    const e = { tipo: 'chance', minuto: 33, lado: 'casa', nome: 'Pepe' };
    expect(narrar(e, nomes)).toBe(narrar(e, nomes));
  });

  it('varia a frase conforme o minuto', () => {
    const frases = new Set([1, 2, 3, 4].map((m) => narrar({ tipo: 'gol', minuto: m, lado: 'casa', nome: 'X' }, nomes)));
    expect(frases.size).toBeGreaterThan(1);
  });
});

describe('relógio e eventos', () => {
  const eventos = [
    { tipo: 'chance', minuto: 5, lado: 'casa' },
    { tipo: 'gol', minuto: 20, lado: 'casa' },
    { tipo: 'chance', minuto: 25, lado: 'fora' },
    { tipo: 'troca', minuto: 45, lado: 'casa' },
    { tipo: 'chance', minuto: 60, lado: 'fora' },
  ];

  it('eventosAte revela só o que já aconteceu', () => {
    expect(eventosAte(eventos, 20).map((e) => e.minuto)).toEqual([5, 20]);
  });

  it('pressão olha os últimos 15 minutos e só lances de ataque', () => {
    expect(pressao(eventos, 26)).toEqual({ casa: 0.5, fora: 0.5 });
    expect(pressao(eventos, 22)).toEqual({ casa: 1, fora: 0 });
    expect(pressao(eventos, 50)).toEqual({ casa: 0.5, fora: 0.5 }); // nenhum lance entre 35 e 50
  });

  it('contarChances soma gols e chances de cada lado', () => {
    expect(contarChances(eventos, 90)).toEqual({ casa: 2, fora: 2 });
  });

  it('minutoNoPeriodo vai do início ao fim do período', () => {
    expect(minutoNoPeriodo('primeiro', 0)).toBe(0);
    expect(minutoNoPeriodo('primeiro', 0.5)).toBe(22);
    expect(minutoNoPeriodo('segundo', 1)).toBe(90);
    expect(minutoNoPeriodo('prorrogacao', 2)).toBe(120);
  });

  it('rotuloRelogio mostra os acréscimos no fim de cada tempo', () => {
    const acr = { primeiro: 2, segundo: 5 };
    expect(rotuloRelogio(30, 'primeiro', acr)).toBe("30'");
    expect(rotuloRelogio(45, 'primeiro', acr)).toBe("45+2'");
    expect(rotuloRelogio(90, 'segundo', acr)).toBe("90+5'");
    expect(rotuloRelogio(120, 'prorrogacao', acr)).toBe("120'");
  });
});

describe('faixaCansaco', () => {
  it.each([[0, 'verde'], [49, 'verde'], [50, 'amarelo'], [69, 'amarelo'], [70, 'vermelho'], [100, 'vermelho']])('%i: %s', (v, f) => {
    expect(faixaCansaco(v)).toBe(f);
  });
});
