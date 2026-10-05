import { criarRng } from './rng.js';
import { criarLado, simularPartida } from './partida.js';
import { setoresDoLado } from './forca.js';
import { disputarPenaltis } from './penaltis.js';
import { ordenarTabela } from './liga.js';
import {
  criarBrasileirao, criarEstadual, criarCopaDoBrasil, criarContinental, jogosDaEtapa, registrarEtapa, campanha,
  confrontoVaiAosPenaltis,
} from './competicoes.js';
import { montarCalendario } from './calendario.js';
import { vagasContinentais, roletasDoFimDeTemporada } from './classificacao.js';
import { envelhecer } from './envelhecimento.js';
import { girarRoleta } from './roleta.js';
import {
  vagasDaFormacao, completarTitulares, escalacaoParaJogo, aplicarConsequencias, forcaMediaDoElenco,
  novoJogadorDoElenco, TAMANHO_ELENCO, TAMANHO_BANCO,
} from './elenco.js';

// A carreira é um objeto JSON puro (dá para salvar com JSON.stringify). Toda função pública recebe
// a carreira e devolve uma nova; `dados` ({ clubes, estaduais, estrangeiros, elencos }) nunca é salvo.
// Fases: 'draft' -> 'temporada' -> 'transferencias' -> 'temporada' ... -> 'fim'

export const CURINGAS = 3;
export const OSCILACAO = 3;
export const DURACOES = [5, 10];
export const POSTURAS = ['defensiva', 'equilibrada', 'ofensiva'];
const RODADAS_DECISIVAS = 5;
const NOTA_MIN = 50;
const NOTA_MAX = 90;

const media = (n) => (n.gol + n.def + n.mei + n.ata) / 4;

function exigirFase(c, fase) {
  if (c.fase !== fase) throw new Error(`Ação inválida na fase "${c.fase}" (esperado "${fase}")`);
}

// Copia a carreira, entrega um rng que continua a sequência salva e grava o estado do rng no fim.
function alterar(carreira, fn) {
  const c = structuredClone(carreira);
  const rng = criarRng(c.rng);
  fn(c, rng);
  c.rng = rng.estado();
  return c;
}

export function novaCarreira({ dados, clubeId, duracao = 10, dificuldade = 'classico', formacao = '4-3-3', postura = 'equilibrada', semente }) {
  const clube = dados.clubes.find((x) => x.id === clubeId);
  if (!clube || !clube.serieA) throw new Error('Escolha um clube da Série A');
  if (!Number.isInteger(semente)) throw new Error('Semente precisa ser um número inteiro');
  if (!DURACOES.includes(duracao)) throw new Error('Duração deve ser 5 ou 10 temporadas');
  if (!['classico', 'olheiro'].includes(dificuldade)) throw new Error('Dificuldade inválida');
  if (!POSTURAS.includes(postura)) throw new Error('Postura inválida');
  vagasDaFormacao(formacao);
  const notas = {};
  for (const x of [...dados.clubes, ...dados.estrangeiros]) notas[x.id] = { gol: x.gol, def: x.def, mei: x.mei, ata: x.ata };
  return {
    versao: 1,
    semente: semente >>> 0,
    rng: semente >>> 0,
    config: { clubeId, duracao, dificuldade },
    fase: 'draft',
    temporada: 0,
    draft: { giros: 0, curingas: CURINGAS, elencosUsados: [], atual: null },
    elenco: { formacao, postura, titulares: Array(11).fill(null), jogadores: {} },
    notas,
    vagas: null,
    exJogadores: [],
    historico: [],
    temporadaAtual: null,
    transferencias: null,
  };
}

// ---------- Draft ----------

export function girarDraft(carreira, dados) {
  exigirFase(carreira, 'draft');
  if (carreira.draft.atual) throw new Error('Escolha um jogador ou use um curinga antes de girar de novo');
  return alterar(carreira, (c, rng) => {
    const atual = girarRoleta(dados.elencos, rng, { excluirElencos: c.draft.elencosUsados });
    if (!atual) throw new Error('Não há mais elencos disponíveis na roleta');
    c.draft.atual = atual;
    c.draft.elencosUsados.push(atual.elencoId);
    c.draft.giros += 1;
  });
}

export function usarCuringa(carreira) {
  exigirFase(carreira, 'draft');
  if (!carreira.draft.atual) throw new Error('Gire a roleta antes de usar um curinga');
  if (carreira.draft.curingas <= 0) throw new Error('Sem curingas');
  const c = structuredClone(carreira);
  c.draft.atual = null;
  c.draft.curingas -= 1;
  return c;
}

const tamanhoDoBanco = (elenco) => Object.keys(elenco.jogadores).length - elenco.titulares.filter(Boolean).length;

// destino: índice da vaga (0..10) ou 'banco'
export function escolherNoDraft(carreira, dados, jogadorId, destino) {
  exigirFase(carreira, 'draft');
  const escolhido = carreira.draft.atual?.opcoes.find((j) => j.id === jogadorId);
  if (!escolhido) throw new Error('Esse jogador não está na roleta atual');
  const c = structuredClone(carreira);
  if (destino === 'banco') {
    if (tamanhoDoBanco(c.elenco) >= TAMANHO_BANCO) throw new Error(`O banco já tem ${TAMANHO_BANCO} jogadores`);
  } else {
    if (!Number.isInteger(destino) || destino < 0 || destino > 10) throw new Error('Vaga inválida');
    if (c.elenco.titulares[destino]) throw new Error('Essa vaga já está ocupada');
    c.elenco.titulares[destino] = escolhido.id;
  }
  c.elenco.jogadores[escolhido.id] = novoJogadorDoElenco(escolhido);
  c.draft.atual = null;
  if (Object.keys(c.elenco.jogadores).length === TAMANHO_ELENCO) return iniciarTemporada(c, dados);
  return c;
}

// ---------- Temporada ----------

function forcaDe(c, id) {
  return id === c.config.clubeId ? forcaMediaDoElenco(c.elenco) : media(c.notas[id]);
}

function iniciarTemporada(carreira, dados) {
  return alterar(carreira, (c, rng) => {
    c.temporada += 1;
    if (c.temporada > 1) {
      for (const n of Object.values(c.notas)) {
        for (const s of ['gol', 'def', 'mei', 'ata']) {
          n[s] = Math.max(NOTA_MIN, Math.min(NOTA_MAX, n[s] + rng.int(-OSCILACAO, OSCILACAO)));
        }
      }
    }
    const clube = dados.clubes.find((x) => x.id === c.config.clubeId);
    const serieA = dados.clubes.filter((x) => x.serieA).map((x) => x.id);
    const porForca = (ids) => [...ids].sort((a, b) => forcaDe(c, b) - forcaDe(c, a));
    const competicoes = {
      estadual: criarEstadual(dados.estaduais[clube.estado].clubes),
      brasileirao: criarBrasileirao(rng.embaralhar(serieA)),
    };
    if (c.vagas) {
      const pequenos = porForca(dados.clubes.filter((x) => !x.serieA).map((x) => x.id)).slice(0, 24);
      competicoes.copaDoBrasil = criarCopaDoBrasil([...serieA, ...rng.embaralhar(pequenos).slice(0, 12)], rng);
      const estrangeiros = porForca(dados.estrangeiros.map((x) => x.id));
      const nLib = 32 - c.vagas.libertadores.length;
      const nSul = 32 - c.vagas.sulamericana.length;
      competicoes.libertadores = criarContinental('libertadores', porForca([...c.vagas.libertadores, ...estrangeiros.slice(0, nLib)]), rng);
      competicoes.sulamericana = criarContinental('sulamericana', porForca([...c.vagas.sulamericana, ...estrangeiros.slice(nLib, nLib + nSul)]), rng);
    }
    for (const j of Object.values(c.elenco.jogadores)) { j.fora = 0; j.suspenso = 0; }
    c.elenco = completarTitulares(c.elenco);
    c.temporadaAtual = { competicoes, calendario: montarCalendario(competicoes), indice: 0, gols: {}, jogos: [] };
    c.fase = 'temporada';
    c.transferencias = null;
  });
}

export function nomeDoClube(dados, id) {
  return (dados.clubes.find((x) => x.id === id) ?? dados.estrangeiros.find((x) => x.id === id))?.nome ?? id;
}

export function ladoDoUsuario(carreira, dados) {
  const { escalacao, banco, desfalques } = escalacaoParaJogo(carreira.elenco);
  const lado = criarLado({
    id: carreira.config.clubeId, nome: nomeDoClube(dados, carreira.config.clubeId),
    escalacao, banco, postura: carreira.elenco.postura,
  });
  lado.desfalques = desfalques;
  return lado;
}

export function ladosDoJogo(carreira, dados, jogo) {
  const lado = (id) => (id === carreira.config.clubeId
    ? ladoDoUsuario(carreira, dados)
    : criarLado({ id, nome: nomeDoClube(dados, id), setoresBase: carreira.notas[id] }));
  return { casa: lado(jogo.casa), fora: lado(jogo.fora) };
}

// rng próprio da partida ao vivo do usuário, para não depender da ordem em que a tela chama as coisas.
export function rngDaPartida(carreira) {
  return criarRng((carreira.semente ^ Math.imul(carreira.temporada, 7919) ^ Math.imul(carreira.temporadaAtual.indice + 1, 104729)) >>> 0);
}

export function ehJogoImportante(carreira, dados, compId, jogo) {
  if (jogo.mataMata) return true;
  const eu = dados.clubes.find((x) => x.id === carreira.config.clubeId);
  const rival = jogo.casa === eu.id ? jogo.fora : jogo.casa;
  if (eu.classicos.includes(rival)) return true;
  const br = carreira.temporadaAtual.competicoes.brasileirao;
  return compId === 'brasileirao' && br.proxima >= br.etapas.length - RODADAS_DECISIVAS;
}

// O jogo do usuário na próxima data, se houver: { indice, tipo, compId, jogo, importante } ou { indice, tipo, jogo: null }
export function proximaData(carreira, dados) {
  exigirFase(carreira, 'temporada');
  const t = carreira.temporadaAtual;
  const data = t.calendario[t.indice];
  const eu = carreira.config.clubeId;
  for (const compId of data.comps) {
    const jogo = jogosDaEtapa(t.competicoes[compId]).find((j) => j.casa === eu || j.fora === eu);
    if (jogo) return { indice: t.indice, tipo: data.tipo, compId, jogo, importante: ehJogoImportante(carreira, dados, compId, jogo) };
  }
  return { indice: t.indice, tipo: data.tipo, compId: null, jogo: null, importante: false };
}

// Confere se a partida jogada na tela é a deste jogo e terminou do jeito que a regra pede.
// penaltis (opcional): disputa jogada na tela, { casa, fora, vencedor: 'casa' | 'fora', cobrancas }.
export function validarPartidaUsuario(jogo, partida, penaltis = null) {
  const erro = (m) => { throw new Error(`Partida ao vivo inválida: ${m}`); };
  if (partida.casa.id !== jogo.casa || partida.fora.id !== jogo.fora) erro('não é o jogo desta data');
  if (Boolean(partida.neutro) !== Boolean(jogo.neutro)) erro('campo neutro diferente do jogo');
  if (partida.tempo < 2) erro('a partida não terminou');
  if (partida.tempo === 3 && !jogo.prorrogacao) erro('este jogo não tem prorrogação');
  if (partida.tempo === 2 && jogo.prorrogacao && partida.placar.casa === partida.placar.fora) erro('falta jogar a prorrogação');
  if (penaltis) {
    if (penaltis.casa === penaltis.fora) erro('disputa de pênaltis empatada');
    if ((penaltis.casa > penaltis.fora ? 'casa' : 'fora') !== penaltis.vencedor) erro('vencedor dos pênaltis não bate com o placar');
  }
}

// Se o resultado do usuário nesta data leva o confronto aos pênaltis (para a tela jogar a disputa).
export function precisaDePenaltis(carreira, compId, resultado) {
  return confrontoVaiAosPenaltis(carreira.temporadaAtual.competicoes[compId], resultado);
}

// Joga a próxima data inteira. partidaUsuario: estado final de uma partida jogada ao vivo (opcional);
// sem ela, o jogo do usuário também é simulado. penaltisUsuario: disputa jogada na tela, se precisou.
export function jogarData(carreira, dados, { partidaUsuario = null, penaltisUsuario = null } = {}) {
  exigirFase(carreira, 'temporada');
  if (partidaUsuario && !proximaData(carreira, dados).jogo) {
    throw new Error('Partida ao vivo inválida: o usuário não joga nesta data');
  }
  return alterar(carreira, (c, rng) => {
    const t = c.temporadaAtual;
    const eu = c.config.clubeId;
    let penaltisUsados = false;
    for (const compId of t.calendario[t.indice].comps) {
      const jogos = jogosDaEtapa(t.competicoes[compId]);
      const partidas = new Map();
      let doUsuario = null;
      for (const jogo of jogos) {
        const meu = jogo.casa === eu || jogo.fora === eu;
        let partida;
        if (meu && partidaUsuario) {
          validarPartidaUsuario(jogo, partidaUsuario, penaltisUsuario);
          partida = partidaUsuario;
        } else {
          const { casa, fora } = ladosDoJogo(c, dados, jogo);
          partida = simularPartida({ casa, fora, neutro: jogo.neutro, prorrogacao: jogo.prorrogacao }, rng);
        }
        partidas.set(`${jogo.casa}>${jogo.fora}`, partida);
        if (meu) doUsuario = { jogo, partida, penaltis: null };
      }
      const resultados = jogos.map((j) => {
        const p = partidas.get(`${j.casa}>${j.fora}`);
        return { casa: j.casa, fora: j.fora, golsCasa: p.placar.casa, golsFora: p.placar.fora };
      });
      const penaltis = (casaId, foraId) => {
        const p = partidas.get(`${casaId}>${foraId}`);
        const doUsuarioAqui = doUsuario && doUsuario.jogo.casa === casaId && doUsuario.jogo.fora === foraId;
        let r;
        if (doUsuarioAqui && penaltisUsuario) {
          r = penaltisUsuario;
          penaltisUsados = true;
        } else {
          r = disputarPenaltis(setoresDoLado(p.casa, { progresso: 1 }), setoresDoLado(p.fora, { progresso: 1 }), rng);
        }
        if (doUsuarioAqui) doUsuario.penaltis = r;
        return { vencedor: r.vencedor === 'casa' ? casaId : foraId, casa: r.casa, fora: r.fora };
      };
      t.competicoes[compId] = registrarEtapa(t.competicoes[compId], resultados, { penaltis, rng });
      if (doUsuario) registrarJogoDoUsuario(c, compId, doUsuario);
    }
    if (penaltisUsuario && !penaltisUsados) throw new Error('Este jogo não foi para os pênaltis');
    t.indice += 1;
    if (t.indice >= t.calendario.length) encerrarTemporada(c, dados, rng);
  });
}

function registrarJogoDoUsuario(c, compId, { jogo, partida, penaltis }) {
  const t = c.temporadaAtual;
  const lado = jogo.casa === c.config.clubeId ? 'casa' : 'fora';
  c.elenco = aplicarConsequencias(c.elenco, {
    lesoes: partida.lesoes.filter((l) => l.lado === lado),
    expulsos: partida.expulsos.filter((e) => e.lado === lado),
  });
  for (const ev of partida.eventos) {
    if (ev.tipo === 'gol' && ev.lado === lado && ev.jogadorId) t.gols[ev.jogadorId] = (t.gols[ev.jogadorId] ?? 0) + 1;
  }
  t.jogos.push({
    indice: t.indice, compId, casa: jogo.casa, fora: jogo.fora,
    golsCasa: partida.placar.casa, golsFora: partida.placar.fora,
    penaltis: penaltis ? { casa: penaltis.casa, fora: penaltis.fora, cobrancas: penaltis.cobrancas ?? [] } : null,
  });
}

function encerrarTemporada(c, dados, rng) {
  const t = c.temporadaAtual;
  const comps = t.competicoes;
  const eu = c.config.clubeId;
  const titulos = Object.keys(comps).filter((id) => comps[id].campeao === eu);
  const ordem = ordenarTabela(comps.brasileirao.tabelas.geral).map((l) => l.id);
  const posicao = ordem.indexOf(eu) + 1;
  const [artId, artGols] = Object.entries(t.gols).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const campanhas = {};
  for (const [id, comp] of Object.entries(comps)) {
    const r = campanha(comp, eu);
    if (r) campanhas[id] = r;
  }
  c.historico.push({
    temporada: c.temporada, titulos, posicaoBrasileirao: posicao, campanhas,
    artilheiro: artId ? { jogadorId: artId, nome: c.elenco.jogadores[artId]?.nome ?? artId, gols: artGols } : null,
  });
  c.vagas = vagasContinentais(ordem, {
    copaDoBrasil: comps.copaDoBrasil?.campeao ?? null,
    libertadores: comps.libertadores?.campeao ?? null,
    sulamericana: comps.sulamericana?.campeao ?? null,
  });
  if (c.temporada >= c.config.duracao) {
    c.fase = 'fim';
    return;
  }
  const antes = c.elenco.jogadores;
  const { jogadores, aposentados } = envelhecer(Object.values(c.elenco.jogadores), rng);
  const idsAposentados = new Set(aposentados.map((j) => j.id));
  const envelhecimento = [...jogadores, ...aposentados].map((j) => ({
    id: j.id, nome: j.nome, idade: j.idade, ovrAntes: antes[j.id].ovr, ovrDepois: j.ovr, aposentou: idsAposentados.has(j.id),
  }));
  c.elenco.jogadores = Object.fromEntries(jogadores.map((j) => [j.id, j]));
  c.elenco.titulares = c.elenco.titulares.map((id) => (c.elenco.jogadores[id] ? id : null));
  c.elenco = completarTitulares(c.elenco);
  c.exJogadores.push(...aposentados.map((j) => j.id));
  c.transferencias = {
    fila: [...aposentados.map(() => ({ tipo: 'reposicao', obrigatoria: true })), ...roletasDoFimDeTemporada(posicao, titulos)],
    atual: null,
    aposentados,
    envelhecimento,
  };
  c.fase = 'transferencias';
}

// ---------- Transferências ----------

export function girarTransferencia(carreira, dados) {
  exigirFase(carreira, 'transferencias');
  const tr = carreira.transferencias;
  if (tr.atual) throw new Error('Resolva a roleta atual antes de girar de novo');
  if (!tr.fila.length) throw new Error('Não há mais roletas nesta janela');
  return alterar(carreira, (c, rng) => {
    const { tipo } = c.transferencias.fila[0];
    const atual = girarRoleta(dados.elencos, rng, {
      tipo: tipo === 'reposicao' ? 'boa' : tipo,
      excluirJogadores: [...Object.keys(c.elenco.jogadores), ...c.exJogadores],
    });
    if (atual) c.transferencias.atual = atual;
    else c.transferencias.fila.shift(); // nada para oferecer: a roleta se perde
  });
}

// saiId: quem deixa o elenco (obrigatório quando o elenco já tem 15; proibido quando tem menos)
export function aceitarTransferencia(carreira, jogadorId, saiId = null) {
  exigirFase(carreira, 'transferencias');
  const tr = carreira.transferencias;
  const escolhido = tr.atual?.opcoes.find((j) => j.id === jogadorId);
  if (!escolhido) throw new Error('Esse jogador não está na roleta atual');
  const cheio = Object.keys(carreira.elenco.jogadores).length >= TAMANHO_ELENCO;
  if (cheio && !saiId) throw new Error('Elenco cheio: escolha quem sai');
  if (!cheio && saiId) throw new Error('O elenco tem vaga: ninguém precisa sair');
  if (saiId && !carreira.elenco.jogadores[saiId]) throw new Error('Quem sai precisa ser do elenco');
  const c = structuredClone(carreira);
  if (saiId) {
    delete c.elenco.jogadores[saiId];
    c.elenco.titulares = c.elenco.titulares.map((id) => (id === saiId ? escolhido.id : id));
    c.exJogadores.push(saiId);
  }
  c.elenco.jogadores[escolhido.id] = novoJogadorDoElenco(escolhido);
  c.elenco = completarTitulares(c.elenco);
  c.transferencias.fila.shift();
  c.transferencias.atual = null;
  return c;
}

export function recusarTransferencia(carreira) {
  exigirFase(carreira, 'transferencias');
  const tr = carreira.transferencias;
  if (!tr.atual) throw new Error('Gire a roleta antes de recusar');
  if (tr.fila[0].obrigatoria) throw new Error('Esta roleta é obrigatória');
  const c = structuredClone(carreira);
  c.transferencias.fila.shift();
  c.transferencias.atual = null;
  return c;
}

export function concluirTransferencias(carreira, dados) {
  exigirFase(carreira, 'transferencias');
  if (carreira.transferencias.fila.length) throw new Error('Ainda há roletas para resolver');
  return iniciarTemporada(carreira, dados);
}

// ---------- Tática ----------

// titulares: 11 ids do elenco (ou null), alinhados às vagas da formação
export function definirTatica(carreira, { formacao, postura, titulares } = {}) {
  if (!['temporada', 'transferencias'].includes(carreira.fase)) throw new Error('Tática só durante a temporada');
  const c = structuredClone(carreira);
  if (formacao) { vagasDaFormacao(formacao); c.elenco.formacao = formacao; }
  if (postura) {
    if (!POSTURAS.includes(postura)) throw new Error('Postura inválida');
    c.elenco.postura = postura;
  }
  if (titulares) {
    const ids = titulares.filter(Boolean);
    if (titulares.length !== 11) throw new Error('São 11 titulares');
    if (new Set(ids).size !== ids.length) throw new Error('Jogador repetido na escalação');
    if (!ids.every((id) => c.elenco.jogadores[id])) throw new Error('Jogador fora do elenco');
    c.elenco.titulares = [...titulares];
  }
  return c;
}
