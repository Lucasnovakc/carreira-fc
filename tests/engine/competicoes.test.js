import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import {
  criarBrasileirao, criarEstadual, criarCopaDoBrasil, criarContinental,
  jogosDaEtapa, registrarEtapa, terminou, campanha,
} from '../../src/engine/competicoes.js';

const ids = (n, p = 't') => Array.from({ length: n }, (_, i) => `${p}${String(i).padStart(2, '0')}`);

// Joga a competição inteira com placares aleatórios; o mandante de índice menor nunca é favorecido.
function jogarTudo(comp, rng, { placar } = {}) {
  let c = comp;
  let datas = 0;
  while (!terminou(c)) {
    const jogos = jogosDaEtapa(c);
    const resultados = jogos.map((j) => ({
      casa: j.casa, fora: j.fora,
      ...(placar ? placar(j) : { golsCasa: rng.int(0, 3), golsFora: rng.int(0, 3) }),
    }));
    c = registrarEtapa(c, resultados, { penaltis: (a, b) => (rng.chance(0.5) ? a : b), rng });
    datas++;
  }
  return { c, datas };
}

describe('Brasileirão', () => {
  it('38 datas de 10 jogos e campeão = líder da tabela', () => {
    const rng = criarRng(1);
    const comp = criarBrasileirao(ids(20));
    expect(comp.etapas).toHaveLength(38);
    expect(jogosDaEtapa(comp)).toHaveLength(10);
    const { c, datas } = jogarTudo(comp, rng);
    expect(datas).toBe(38);
    expect(c.tabelas.geral.every((l) => l.j === 38)).toBe(true);
    expect(campanha(c, c.campeao)).toBe('Campeão');
    expect(campanha(c, c.vice)).toBe('Vice');
  });
});

describe('Estadual', () => {
  it('11 rodadas + semi única + final ida e volta = 14 datas', () => {
    const rng = criarRng(2);
    const comp = criarEstadual(ids(12));
    expect(comp.etapas).toHaveLength(14);
    const { c } = jogarTudo(comp, rng);
    expect(c.campeao).not.toBeNull();
    expect(c.fases[0].pares).toHaveLength(2);
    expect(c.fases[1].pares[0]).toContain(c.campeao);
  });

  it('semifinal é 1º x 4º e 2º x 3º, com o melhor em casa', () => {
    const rng = criarRng(3);
    // t00 sempre vence, t01 vence todos menos t00, etc.: a tabela fica na ordem dos ids
    let c = criarEstadual(ids(12));
    for (let n = 0; n < 11; n++) {
      const res = jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: j.casa < j.fora ? 1 : 0, golsFora: j.casa < j.fora ? 0 : 1 }));
      c = registrarEtapa(c, res, { penaltis: () => null, rng });
    }
    expect(c.fases[0].pares).toEqual([['t00', 't03'], ['t01', 't02']]);
    expect(jogosDaEtapa(c)[0]).toMatchObject({ casa: 't00', fora: 't03', prorrogacao: false, mataMata: true });
  });

  it('empate na semifinal vai para os pênaltis', () => {
    const rng = criarRng(4);
    let c = criarEstadual(ids(12));
    for (let n = 0; n < 11; n++) {
      c = registrarEtapa(c, jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 0, golsFora: 0 })), { penaltis: () => null, rng });
    }
    const chamados = [];
    c = registrarEtapa(c, jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 1, golsFora: 1 })), {
      penaltis: (a, b) => { chamados.push([a, b]); return b; }, rng,
    });
    expect(chamados).toHaveLength(2);
    expect(c.fases[0].vencedores).toEqual(chamados.map(([, b]) => b));
  });
});

describe('Copa do Brasil', () => {
  it('5 fases ida e volta = 10 datas; 16, 8, 4, 2, 1 jogos por data', () => {
    const rng = criarRng(5);
    let c = criarCopaDoBrasil(ids(32), rng);
    expect(c.etapas).toHaveLength(10);
    const porData = [];
    while (!terminou(c)) {
      const jogos = jogosDaEtapa(c);
      porData.push(jogos.length);
      c = registrarEtapa(c, jogos.map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: rng.int(0, 2), golsFora: rng.int(0, 2) })),
        { penaltis: (a) => a, rng });
    }
    expect(porData).toEqual([16, 16, 8, 8, 4, 4, 2, 2, 1, 1]);
    expect(ids(32)).toContain(c.campeao);
  });

  it('a volta inverte o mando da ida', () => {
    const rng = criarRng(6);
    let c = criarCopaDoBrasil(ids(32), rng);
    const ida = jogosDaEtapa(c);
    c = registrarEtapa(c, ida.map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 0, golsFora: 0 })), { penaltis: (a) => a, rng });
    const volta = jogosDaEtapa(c);
    volta.forEach((j, i) => expect([j.casa, j.fora]).toEqual([ida[i].fora, ida[i].casa]));
  });

  it('vencedor pelo agregado sem pênaltis quando não empata', () => {
    const rng = criarRng(7);
    let c = criarCopaDoBrasil(ids(32), rng);
    const ida = jogosDaEtapa(c);
    c = registrarEtapa(c, ida.map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 2, golsFora: 0 })), { penaltis: () => { throw new Error('não devia'); }, rng });
    c = registrarEtapa(c, jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 1, golsFora: 0 })), { penaltis: () => { throw new Error('não devia'); }, rng });
    expect(c.fases[0].vencedores).toEqual(ida.map((j) => j.casa));
  });
});

describe('Libertadores / Sul-Americana', () => {
  it('6 rodadas de grupo + 3 fases ida e volta + final única = 13 datas', () => {
    const rng = criarRng(8);
    const comp = criarContinental('libertadores', ids(32), rng);
    expect(comp.etapas).toHaveLength(13);
    expect(jogosDaEtapa(comp)).toHaveLength(16);
    const { c } = jogarTudo(comp, rng);
    expect(c.campeao).not.toBeNull();
    expect(c.fases[0].pares).toHaveLength(8);
  });

  it('final é jogo único, neutro, com prorrogação', () => {
    const rng = criarRng(9);
    let c = criarContinental('sulamericana', ids(32), rng);
    while (c.proxima < c.etapas.length - 1) {
      c = registrarEtapa(c, jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: rng.int(0, 2), golsFora: rng.int(0, 2) })),
        { penaltis: (a) => a, rng });
    }
    const [final] = jogosDaEtapa(c);
    expect(final).toMatchObject({ neutro: true, prorrogacao: true, mataMata: true });
  });

  it('oitavas cruzam 1º de um grupo com 2º do vizinho', () => {
    const rng = criarRng(10);
    let c = criarContinental('libertadores', ids(32), rng);
    for (let n = 0; n < 6; n++) {
      c = registrarEtapa(c, jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: j.casa < j.fora ? 2 : 0, golsFora: 0 })),
        { penaltis: (a) => a, rng });
    }
    const primeiroA = [...c.tabelas.A].sort((a, b) => b.pts - a.pts)[0].id;
    const par = c.fases[0].pares.find((p) => p.includes(primeiroA));
    expect(par[1]).toBe(primeiroA); // 1º decide em casa (fica como segundo do par)
    expect(c.tabelas.B.some((l) => l.id === par[0])).toBe(true);
  });
});

describe('campanha', () => {
  it('nome da fase em que o clube caiu, ou posição', () => {
    const rng = criarRng(11);
    const { c } = jogarTudo(criarCopaDoBrasil(ids(32), rng), rng);
    const caiuNos16 = ids(32).find((id) => !c.fases[1].pares.flat().includes(id));
    expect(campanha(c, caiuNos16)).toBe('16 avos');
    expect(campanha(c, 'nao-participa')).toBeNull();
    const { c: e } = jogarTudo(criarEstadual(ids(12)), rng);
    const ultimo = ids(12).find((id) => !e.fases[0].pares.flat().includes(id));
    expect(campanha(e, ultimo)).toMatch(/º lugar$/);
  });

  it('não altera a competição recebida', () => {
    const rng = criarRng(12);
    const comp = criarBrasileirao(ids(20));
    const copia = structuredClone(comp);
    registrarEtapa(comp, jogosDaEtapa(comp).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 1, golsFora: 0 })), { penaltis: (a) => a, rng });
    expect(comp).toEqual(copia);
  });
});
