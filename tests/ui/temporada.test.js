import { describe, it, expect } from 'vitest';
import { criarDados } from '../fixtures/dados.js';
import { novaCarreira, girarDraft, escolherNoDraft, jogarData, proximaData } from '../../src/engine/carreira.js';
import {
  nomeCompeticao, infoProximoJogo, resultadoDoUsuario, ultimosResultados, linhasDoCalendario,
  simularAteImportante, totalTitulos, competicoesDaProxima, salaDeTrofeus, artilheiroDaHistoria,
} from '../../src/ui/logica/temporada.js';

const dados = criarDados();

function comecar() {
  let c = novaCarreira({ dados, clubeId: 'a0', duracao: 5, semente: 7 });
  for (let i = 0; i < 15; i++) {
    c = girarDraft(c, dados);
    c = escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, i < 11 ? i : 'banco');
  }
  return c;
}

describe('nomes e próximo jogo', () => {
  it('estadual usa o nome do campeonato do estado do clube', () => {
    expect(nomeCompeticao('estadual', comecar(), dados)).toBe('Campeonato AA');
    expect(nomeCompeticao('brasileirao', comecar(), dados)).toBe('Brasileirão');
  });

  it('infoProximoJogo descreve competição, rodada e mando', () => {
    const info = infoProximoJogo(comecar(), dados);
    expect(info.titulo).toBe('Campeonato AA · Rodada 1');
    expect(['casa', 'fora']).toContain(info.mando);
    expect(info.ida).toBeNull();
    expect(info.perna).toBeNull();
  });

  it('na semifinal do estadual mostra a fase', () => {
    let c = comecar();
    for (let i = 0; i < 11; i++) c = jogarData(c, dados);
    const info = infoProximoJogo(c, dados);
    if (info.jogo) { expect(info.titulo).toBe('Campeonato AA · Semifinal'); expect(info.perna).toBe('unico'); }
    else expect(info.titulo).toBe('Campeonato AA');
  });
});

describe('resultadoDoUsuario', () => {
  it('vitória, derrota e empate do ponto de vista do usuário', () => {
    expect(resultadoDoUsuario({ casa: 'eu', fora: 'x', golsCasa: 2, golsFora: 1 }, 'eu')).toMatchObject({ letra: 'V', meus: 2, deles: 1, adversario: 'x', emCasa: true });
    expect(resultadoDoUsuario({ casa: 'x', fora: 'eu', golsCasa: 2, golsFora: 1 }, 'eu')).toMatchObject({ letra: 'D', meus: 1, deles: 2, emCasa: false });
    expect(resultadoDoUsuario({ casa: 'x', fora: 'eu', golsCasa: 0, golsFora: 0 }, 'eu').letra).toBe('E');
  });

  it('empate decidido nos pênaltis conta como vitória ou derrota', () => {
    const r = resultadoDoUsuario({ casa: 'x', fora: 'eu', golsCasa: 1, golsFora: 1, penaltis: { casa: 3, fora: 4 } }, 'eu');
    expect(r).toMatchObject({ letra: 'V', penaltis: { meus: 4, deles: 3 } });
  });
});

describe('ultimosResultados e calendário', () => {
  it('ultimosResultados traz no máximo 5', () => {
    let c = comecar();
    for (let i = 0; i < 8; i++) c = jogarData(c, dados);
    const r = ultimosResultados(c);
    expect(r).toHaveLength(5);
    for (const x of r) expect(['V', 'E', 'D']).toContain(x.letra);
  });

  it('calendário tem uma linha por data, com resultados no passado e adversário nas rodadas futuras', () => {
    let c = comecar();
    for (let i = 0; i < 3; i++) c = jogarData(c, dados);
    const linhas = linhasDoCalendario(c, dados);
    expect(linhas).toHaveLength(c.temporadaAtual.calendario.length);
    expect(linhas.slice(0, 3).every((l) => l.resultado)).toBe(true);
    expect(linhas[3].atual).toBe(true);
    expect(linhas[3].adversario).toBe(proximaData(c, dados).jogo.casa === 'a0' ? proximaData(c, dados).jogo.fora : proximaData(c, dados).jogo.casa);
    const brasileirao = linhas.filter((l) => l.compId === 'brasileirao');
    expect(brasileirao).toHaveLength(38);
    expect(brasileirao.every((l) => l.adversario)).toBe(true);
  });
});

describe('simularAteImportante', () => {
  it('para antes do próximo jogo importante, sem jogá-lo', () => {
    const c0 = comecar();
    const { carreira, jogos } = simularAteImportante(c0, dados);
    expect(jogos.length).toBeGreaterThan(0);
    if (carreira.fase === 'temporada') expect(proximaData(carreira, dados).importante).toBe(true);
  });

  it('sempre joga pelo menos a data atual', () => {
    const c0 = comecar();
    const { carreira } = simularAteImportante(c0, dados);
    expect(carreira.temporadaAtual.indice).toBeGreaterThan(0);
  });
});

describe('troféus e próxima temporada', () => {
  function temporadaCompleta() {
    let c = comecar();
    while (c.fase === 'temporada') c = jogarData(c, dados);
    return c;
  }

  it('competicoesDaProxima inclui Copa do Brasil e no máximo uma continental', () => {
    const c = temporadaCompleta();
    const lista = competicoesDaProxima(c);
    expect(lista.slice(0, 3)).toEqual(['estadual', 'brasileirao', 'copaDoBrasil']);
    expect(lista.length).toBeLessThanOrEqual(4);
  });

  it('sala de troféus agrupa por competição e soma com totalTitulos', () => {
    const c = { historico: [{ temporada: 1, titulos: ['estadual'] }, { temporada: 2, titulos: ['brasileirao', 'estadual'] }] };
    expect(salaDeTrofeus(c)).toEqual([{ compId: 'brasileirao', temporadas: [2] }, { compId: 'estadual', temporadas: [1, 2] }]);
    expect(totalTitulos(c)).toBe(3);
  });

  it('artilheiro da história é quem tem mais gols na carreira', () => {
    expect(artilheiroDaHistoria({ golsNaCarreira: { a: { nome: 'A', gols: 3 }, b: { nome: 'B', gols: 9 } } })).toEqual({ id: 'b', nome: 'B', gols: 9 });
    expect(artilheiroDaHistoria({ golsNaCarreira: {} })).toBeNull();
  });
});
