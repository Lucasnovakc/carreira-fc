import { describe, it, expect } from 'vitest';
import { criarDados } from '../fixtures/dados.js';
import {
  iniciarPartida, simularPrimeiroTempo, aplicarIntervalo, simularSegundoTempo, simularProrrogacao,
} from '../../src/engine/partida.js';
import {
  novaCarreira, girarDraft, usarCuringa, escolherNoDraft, proximaData, jogarData, ladosDoJogo, rngDaPartida,
  girarTransferencia, aceitarTransferencia, recusarTransferencia, concluirTransferencias, definirTatica, CURINGAS,
} from '../../src/engine/carreira.js';

const dados = criarDados();
const nova = (extra = {}) => novaCarreira({ dados, clubeId: 'a0', duracao: 5, semente: 42, ...extra });

// Completa o draft: titulares nas vagas 0..10, depois 4 no banco; pega sempre a 1ª opção.
function draftCompleto(c) {
  for (let i = 0; i < 15; i++) {
    c = girarDraft(c, dados);
    c = escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, i < 11 ? i : 'banco');
  }
  return c;
}

function jogarTemporada(c) {
  while (c.fase === 'temporada') c = jogarData(c, dados);
  return c;
}

// Na janela: aceita as obrigatórias (trocando o pior quando o elenco está cheio) e recusa as opcionais.
function resolverJanela(c) {
  while (c.transferencias.fila.length) {
    c = girarTransferencia(c, dados);
    if (!c.transferencias.atual) continue;
    const { obrigatoria } = c.transferencias.fila[0];
    if (!obrigatoria) { c = recusarTransferencia(c); continue; }
    const cheio = Object.keys(c.elenco.jogadores).length >= 15;
    const pior = Object.values(c.elenco.jogadores).sort((a, b) => a.ovr - b.ovr)[0].id;
    c = aceitarTransferencia(c, c.transferencias.atual.opcoes[0].id, cheio ? pior : null);
  }
  return concluirTransferencias(c, dados);
}

describe('novaCarreira', () => {
  it('começa no draft com 3 curingas e elenco vazio', () => {
    const c = nova();
    expect(c.fase).toBe('draft');
    expect(c.draft.curingas).toBe(CURINGAS);
    expect(c.elenco.titulares).toEqual(Array(11).fill(null));
  });

  it('rejeita clube fora da Série A, duração e postura inválidas', () => {
    expect(() => nova({ clubeId: 'p0' })).toThrow();
    expect(() => nova({ duracao: 7 })).toThrow();
    expect(() => nova({ postura: 'retranca' })).toThrow();
    expect(() => nova({ formacao: '3-5-2' })).toThrow();
  });
});

describe('draft', () => {
  it('girar mostra um elenco; não dá para girar de novo sem escolher', () => {
    const c = girarDraft(nova(), dados);
    expect(c.draft.atual.opcoes.length).toBeGreaterThan(0);
    expect(() => girarDraft(c, dados)).toThrow();
  });

  it('curinga descarta o giro e acaba depois de 3 usos', () => {
    let c = nova();
    for (let i = 0; i < CURINGAS; i++) c = usarCuringa(girarDraft(c, dados));
    expect(c.draft.curingas).toBe(0);
    expect(() => usarCuringa(girarDraft(c, dados))).toThrow();
  });

  it('elenco sorteado não se repete no mesmo draft (15 escolhas + 3 curingas)', () => {
    let c = nova();
    while (c.fase === 'draft') {
      c = girarDraft(c, dados);
      const n = Object.keys(c.elenco.jogadores).length;
      if (c.draft.curingas > 0 && c.draft.giros % 5 === 0) c = usarCuringa(c);
      else c = escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, n < 11 ? n : 'banco');
    }
    expect(c.draft.giros).toBe(18);
    expect(new Set(c.draft.elencosUsados).size).toBe(18);
  });

  it('não aceita vaga ocupada, banco cheio ou jogador fora da roleta', () => {
    let c = girarDraft(nova(), dados);
    c = escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, 0);
    c = girarDraft(c, dados);
    expect(() => escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, 0)).toThrow();
    expect(() => escolherNoDraft(c, dados, 'nao-existe', 1)).toThrow();
    for (let i = 0; i < 4; i++) {
      c = escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, 'banco');
      c = girarDraft(c, dados);
    }
    expect(() => escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, 'banco')).toThrow();
  });

  it('com 15 jogadores a temporada 1 começa: estadual + Brasileirão = 52 datas', () => {
    const c = draftCompleto(nova());
    expect(c.fase).toBe('temporada');
    expect(c.temporada).toBe(1);
    expect(Object.keys(c.elenco.jogadores)).toHaveLength(15);
    expect(c.temporadaAtual.calendario).toHaveLength(52);
    expect(Object.keys(c.temporadaAtual.competicoes).sort()).toEqual(['brasileirao', 'estadual']);
  });
});

describe('temporada', () => {
  it('proximaData aponta o jogo do usuário', () => {
    const c = draftCompleto(nova());
    const p = proximaData(c, dados);
    expect(p.compId).toBe('estadual');
    expect([p.jogo.casa, p.jogo.fora]).toContain('a0');
  });

  it('clássico é jogo importante', () => {
    let c = draftCompleto(nova());
    let viu = false;
    while (c.fase === 'temporada' && !viu) {
      const p = proximaData(c, dados);
      if (p.jogo && [p.jogo.casa, p.jogo.fora].includes('a1')) { expect(p.importante).toBe(true); viu = true; }
      c = jogarData(c, dados);
    }
    expect(viu).toBe(true);
  });

  it('cada data jogada registra o jogo do usuário e avança o índice', () => {
    let c = draftCompleto(nova());
    c = jogarData(c, dados);
    expect(c.temporadaAtual.indice).toBe(1);
    expect(c.temporadaAtual.jogos).toHaveLength(1);
    expect(c.temporadaAtual.jogos[0].compId).toBe('estadual');
  });

  it('fim da temporada 1: histórico, vagas e janela de transferências', () => {
    const c = jogarTemporada(draftCompleto(nova()));
    expect(c.fase).toBe('transferencias');
    const h = c.historico[0];
    expect(h.temporada).toBe(1);
    expect(h.posicaoBrasileirao).toBeGreaterThanOrEqual(1);
    expect(h.campanhas.brasileirao).toBeDefined();
    expect(c.vagas.libertadores.length).toBeGreaterThanOrEqual(4);
    expect(c.vagas.sulamericana).toHaveLength(6);
    expect(c.temporadaAtual.jogos.length).toBeGreaterThanOrEqual(40);
  });

  it('temporada 2 tem Copa do Brasil e as duas continentais; usuário em no máximo uma', () => {
    let c = jogarTemporada(draftCompleto(nova()));
    c = resolverJanela(c);
    expect(c.temporada).toBe(2);
    const comps = c.temporadaAtual.competicoes;
    expect(Object.keys(comps).sort()).toEqual(['brasileirao', 'copaDoBrasil', 'estadual', 'libertadores', 'sulamericana']);
    expect(comps.copaDoBrasil.participantes).toHaveLength(32);
    expect(comps.copaDoBrasil.participantes).toContain('a0');
    expect(comps.libertadores.participantes).toHaveLength(32);
    expect(comps.sulamericana.participantes).toHaveLength(32);
    const emContinental = ['libertadores', 'sulamericana'].filter((id) => comps[id].participantes.includes('a0'));
    expect(emContinental.length).toBeLessThanOrEqual(1);
    expect(c.temporadaAtual.calendario).toHaveLength(75);
  });

  it('carreira de 5 temporadas termina com 5 entradas no histórico', () => {
    let c = draftCompleto(nova());
    for (let s = 1; s <= 5; s++) {
      c = jogarTemporada(c);
      if (c.fase === 'transferencias') c = resolverJanela(c);
    }
    expect(c.fase).toBe('fim');
    expect(c.historico.map((h) => h.temporada)).toEqual([1, 2, 3, 4, 5]);
  }, 60000);

  it('mesma semente, mesma carreira; e o estado sobrevive a JSON', () => {
    const a = jogarTemporada(draftCompleto(nova()));
    const b = jogarTemporada(draftCompleto(nova()));
    expect(a.historico).toEqual(b.historico);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('notas dos clubes do computador oscilam no máximo 3 por temporada', () => {
    const c1 = jogarTemporada(draftCompleto(nova()));
    const c2 = resolverJanela(c1);
    for (const [id, n] of Object.entries(c2.notas)) {
      for (const s of ['gol', 'def', 'mei', 'ata']) expect(Math.abs(n[s] - c1.notas[id][s])).toBeLessThanOrEqual(3);
    }
  });
});

describe('partida ao vivo do usuário', () => {
  it('jogarData usa o resultado da partida jogada na tela', () => {
    let c = draftCompleto(nova());
    const { jogo } = proximaData(c, dados);
    const rng = rngDaPartida(c);
    const { casa, fora } = ladosDoJogo(c, dados, jogo);
    let p = simularPrimeiroTempo(iniciarPartida({ casa, fora, neutro: jogo.neutro }), rng);
    const meu = casa.id === 'a0' ? 'casa' : 'fora';
    p = aplicarIntervalo(p, meu, { postura: 'ofensiva' });
    p = simularSegundoTempo(p, rng);
    if (jogo.prorrogacao && p.placar.casa === p.placar.fora) p = simularProrrogacao(p, rng);
    c = jogarData(c, dados, { partidaUsuario: p });
    expect(c.temporadaAtual.jogos[0]).toMatchObject({ golsCasa: p.placar.casa, golsFora: p.placar.fora });
  });

  it('rejeita partida de outro jogo ou não terminada', () => {
    const c = draftCompleto(nova());
    const { jogo } = proximaData(c, dados);
    const { casa, fora } = ladosDoJogo(c, dados, jogo);
    const incompleta = simularPrimeiroTempo(iniciarPartida({ casa, fora }), rngDaPartida(c));
    expect(() => jogarData(c, dados, { partidaUsuario: incompleta })).toThrow();
    const trocada = simularSegundoTempo(simularPrimeiroTempo(iniciarPartida({ casa: fora, fora: casa }), rngDaPartida(c)), rngDaPartida(c));
    expect(() => jogarData(c, dados, { partidaUsuario: trocada })).toThrow();
  });

  it('lesionado do usuário fica fora dos jogos seguintes', () => {
    let c = draftCompleto(nova());
    let alvo = null;
    while (c.fase === 'temporada' && !alvo) {
      c = jogarData(c, dados);
      alvo = Object.values(c.elenco.jogadores).find((j) => j.fora > 0);
    }
    expect(alvo).toBeTruthy();
    const { jogo } = proximaData(c, dados);
    expect(jogo).not.toBeNull(); // com a semente 42 a lesão sai na 4ª data do estadual
    const { casa, fora } = ladosDoJogo(c, dados, jogo);
    const meu = casa.id === 'a0' ? casa : fora;
    expect(meu.escalacao.some((e) => e.jogador.id === alvo.id)).toBe(false);
    expect(meu.banco.some((j) => j.id === alvo.id)).toBe(false);
  });
});

describe('transferências', () => {
  function ateJanela() { return jogarTemporada(draftCompleto(nova())); }

  it('elenco incompleto: entra sem ninguém sair; elenco cheio: exige quem sai e o novo herda a vaga', () => {
    let c = ateJanela();
    // deixa o elenco com exatamente 14, como depois de uma aposentadoria
    while (Object.keys(c.elenco.jogadores).length > 14) {
      const reserva = Object.keys(c.elenco.jogadores).find((id) => !c.elenco.titulares.includes(id));
      c = structuredClone(c);
      delete c.elenco.jogadores[reserva];
    }
    c = { ...c, transferencias: { ...c.transferencias, fila: [{ tipo: 'reposicao', obrigatoria: true }, { tipo: 'boa', obrigatoria: false }] } };
    c = girarTransferencia(c, dados);
    const reposto = c.transferencias.atual.opcoes[0].id;
    expect(() => aceitarTransferencia(c, reposto, c.elenco.titulares[0])).toThrow();
    c = aceitarTransferencia(c, reposto);
    expect(Object.keys(c.elenco.jogadores)).toHaveLength(15);

    c = girarTransferencia(c, dados);
    const novo = c.transferencias.atual.opcoes[0].id;
    const sai = c.elenco.titulares[3];
    expect(() => aceitarTransferencia(c, novo)).toThrow();
    c = aceitarTransferencia(c, novo, sai);
    expect(c.elenco.titulares[3]).toBe(novo);
    expect(c.elenco.jogadores[sai]).toBeUndefined();
    expect(c.exJogadores).toContain(sai);
    expect(c.transferencias.fila).toEqual([]);
  });

  it('roleta obrigatória não pode ser recusada; opcional pode', () => {
    let c = ateJanela();
    c = { ...c, transferencias: { ...c.transferencias, fila: [{ tipo: 'ruim', obrigatoria: true }, { tipo: 'boa', obrigatoria: false }] } };
    c = girarTransferencia(c, dados);
    expect(c.transferencias.atual.opcoes.every((j) => j.ovr <= 68)).toBe(true);
    expect(() => recusarTransferencia(c)).toThrow();
  });

  it('não dá para concluir com roletas pendentes', () => {
    let c = ateJanela();
    c = { ...c, transferencias: { ...c.transferencias, fila: [{ tipo: 'boa', obrigatoria: false }] } };
    expect(() => concluirTransferencias(c, dados)).toThrow();
  });

  it('roleta nunca oferece quem já está no elenco ou já saiu', () => {
    let c = ateJanela();
    c = { ...c, exJogadores: [...c.exJogadores, 'elenco-0:0'], transferencias: { ...c.transferencias, fila: Array(20).fill({ tipo: 'boa', obrigatoria: false }) } };
    for (let i = 0; i < 20; i++) {
      c = girarTransferencia(c, dados);
      const ids = c.transferencias.atual.opcoes.map((j) => j.id);
      for (const id of ids) {
        expect(c.elenco.jogadores[id]).toBeUndefined();
        expect(c.exJogadores).not.toContain(id);
      }
      c = recusarTransferencia(c);
    }
  });
});

describe('definirTatica', () => {
  it('troca formação, postura e titulares com validação', () => {
    let c = draftCompleto(nova());
    c = definirTatica(c, { formacao: '4-4-2', postura: 'ofensiva' });
    expect(c.elenco.formacao).toBe('4-4-2');
    expect(c.elenco.postura).toBe('ofensiva');
    const t = [...c.elenco.titulares];
    [t[0], t[1]] = [t[1], t[0]];
    expect(definirTatica(c, { titulares: t }).elenco.titulares).toEqual(t);
    expect(() => definirTatica(c, { titulares: [t[0], t[0], ...t.slice(2)] })).toThrow();
    expect(() => definirTatica(c, { titulares: t.slice(1) })).toThrow();
    expect(() => definirTatica(c, { postura: 'retranca' })).toThrow();
  });

  it('não vale durante o draft', () => {
    expect(() => definirTatica(nova(), { postura: 'ofensiva' })).toThrow();
  });
});
