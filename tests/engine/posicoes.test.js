import { describe, it, expect } from 'vitest';
import { POSICOES, SETOR, fatorPosicao, ovrEfetivo } from '../../src/engine/posicoes.js';

describe('fatorPosicao', () => {
  it('posição natural vale 100%', () => {
    for (const p of POSICOES) expect(fatorPosicao(p, p)).toBe(1);
  });

  it.each([
    ['VOL', 'MC'], ['MC', 'VOL'], ['MC', 'MEI'], ['LD', 'ZAG'], ['LE', 'ZAG'],
    ['ZAG', 'VOL'], ['PE', 'CA'], ['PD', 'CA'], ['PE', 'MEI'], ['PD', 'MEI'],
    ['LD', 'PD'], ['LE', 'PE'],
  ])('%s em %s é vizinha (92%%)', (nat, vaga) => {
    expect(fatorPosicao(nat, vaga)).toBe(0.92);
  });

  it.each([
    ['ZAG', 'MEI'], ['LD', 'PE'], ['LD', 'LE'], ['PD', 'PE'], ['VOL', 'CA'], ['ZAG', 'CA'],
  ])('%s em %s é distante (80%%)', (nat, vaga) => {
    expect(fatorPosicao(nat, vaga)).toBe(0.8);
  });

  it('goleiro na linha e linha no gol valem 50%', () => {
    expect(fatorPosicao('GOL', 'CA')).toBe(0.5);
    expect(fatorPosicao('ZAG', 'GOL')).toBe(0.5);
  });
});

describe('ovrEfetivo', () => {
  it('arredonda o overall com o fator', () => {
    expect(ovrEfetivo({ ovr: 90, pos: 'CA' }, 'CA')).toBe(90);
    expect(ovrEfetivo({ ovr: 90, pos: 'PE' }, 'CA')).toBe(83); // 82.8
    expect(ovrEfetivo({ ovr: 90, pos: 'ZAG' }, 'MEI')).toBe(72);
    expect(ovrEfetivo({ ovr: 90, pos: 'GOL' }, 'CA')).toBe(45);
  });
});

describe('SETOR', () => {
  it('toda posição tem setor', () => {
    for (const p of POSICOES) expect(['gol', 'def', 'mei', 'ata']).toContain(SETOR[p]);
  });
});
