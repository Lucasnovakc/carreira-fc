import { describe, it, expect } from 'vitest';
import formacoes from '../../src/data/formacoes.json';
import { POSICOES } from '../../src/engine/posicoes.js';
import { setoresDaEscalacao, aplicarModificadores, setoresDoLado, SETOR_VAZIO } from '../../src/engine/forca.js';

const j = (id, pos, ovr) => ({ id, nome: id, pos, ovr, idade: 25 });

function escalacaoNatural(ovr = 80) {
  const vagas = formacoes.find((f) => f.id === '4-3-3').vagas;
  return vagas.map((vaga, i) => ({ jogador: j(`p${i}`, vaga, ovr), vaga }));
}

describe('formacoes.json', () => {
  it('toda formação tem 11 vagas válidas e exatamente 1 GOL', () => {
    expect(formacoes.length).toBe(7);
    for (const f of formacoes) {
      expect(f.vagas).toHaveLength(11);
      for (const v of f.vagas) expect(POSICOES).toContain(v);
      expect(f.vagas.filter((v) => v === 'GOL')).toHaveLength(1);
    }
  });
});

describe('setoresDaEscalacao', () => {
  it('média por setor com todos na posição natural', () => {
    expect(setoresDaEscalacao(escalacaoNatural(80))).toEqual({ gol: 80, def: 80, mei: 80, ata: 80 });
  });

  it('jogador fora de posição puxa o setor para baixo', () => {
    const esc = escalacaoNatural(80);
    esc[0] = { jogador: j('zag', 'ZAG', 80), vaga: 'GOL' }; // zagueiro no gol: 40
    expect(setoresDaEscalacao(esc).gol).toBe(40);
  });

  it('setor sem ninguém vale SETOR_VAZIO', () => {
    const esc = escalacaoNatural(80).filter((e) => e.vaga !== 'GOL');
    expect(setoresDaEscalacao(esc).gol).toBe(SETOR_VAZIO);
  });

  it('cansaço só pesa conforme o progresso do 2º tempo', () => {
    const esc = escalacaoNatural(80);
    const cansaco = Object.fromEntries(esc.map((e) => [e.jogador.id, 100]));
    expect(setoresDaEscalacao(esc, cansaco, 0).ata).toBe(80);
    expect(setoresDaEscalacao(esc, cansaco, 1).ata).toBeCloseTo(72);
    expect(setoresDaEscalacao(esc, cansaco, 0.5).ata).toBeCloseTo(76);
  });
});

describe('aplicarModificadores', () => {
  const base = { gol: 70, def: 70, mei: 70, ata: 70 };
  it('ofensiva troca defesa por ataque', () => {
    expect(aplicarModificadores(base, { postura: 'ofensiva' })).toEqual({ gol: 70, def: 66, mei: 70, ata: 74 });
  });
  it('defensiva troca ataque por defesa', () => {
    expect(aplicarModificadores(base, { postura: 'defensiva' })).toEqual({ gol: 70, def: 74, mei: 70, ata: 66 });
  });
  it('mandante ganha +2 em tudo', () => {
    expect(aplicarModificadores(base, { mandante: true })).toEqual({ gol: 72, def: 72, mei: 72, ata: 72 });
  });
  it('cada desfalque multiplica por 0.92', () => {
    expect(aplicarModificadores(base, { desfalques: 1 }).mei).toBeCloseTo(64.4);
  });
  it('não altera o objeto original', () => {
    aplicarModificadores(base, { postura: 'ofensiva', mandante: true });
    expect(base).toEqual({ gol: 70, def: 70, mei: 70, ata: 70 });
  });
});

describe('setoresDoLado', () => {
  it('usa setoresBase quando não há escalação (adversário do computador)', () => {
    const lado = { setoresBase: { gol: 75, def: 76, mei: 77, ata: 78 }, postura: 'equilibrada', desfalques: 0 };
    expect(setoresDoLado(lado)).toEqual({ gol: 75, def: 76, mei: 77, ata: 78 });
  });
  it('usa a escalação quando existe', () => {
    const lado = { escalacao: escalacaoNatural(85), cansaco: {}, postura: 'equilibrada', desfalques: 0 };
    expect(setoresDoLado(lado, { mandante: true }).ata).toBe(87);
  });
});
