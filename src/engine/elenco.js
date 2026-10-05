import formacoes from '../data/formacoes.json';
import { ovrEfetivo } from './posicoes.js';

// elenco: { formacao, postura, titulares: [jogadorId | null] x11 (alinhado às vagas da formação),
//           jogadores: { [id]: { id, nome, pos, ovr, idade, origem, fora, suspenso } } }
// fora = jogos que ainda perde por lesão; suspenso = jogos que ainda cumpre de suspensão.

export const TAMANHO_ELENCO = 15;
export const TAMANHO_BANCO = 4;

export function vagasDaFormacao(id) {
  const f = formacoes.find((x) => x.id === id);
  if (!f) throw new Error(`Formação desconhecida: ${id}`);
  return f.vagas;
}

export const disponivel = (j) => !j.fora && !j.suspenso;

export function novoJogadorDoElenco(jogadorBase) {
  return { ...jogadorBase, ovrBase: jogadorBase.ovr, fora: 0, suspenso: 0 };
}

// Escolhe, vaga a vaga (goleiro primeiro), o melhor jogador ainda livre. Vagas sem candidato ficam null.
function preencher(vagas, candidatos, fixos = []) {
  const usados = new Set(fixos.filter(Boolean));
  const ordem = vagas.map((v, i) => i).sort((a, b) => (vagas[a] === 'GOL' ? -1 : 0) - (vagas[b] === 'GOL' ? -1 : 0));
  const res = [...fixos];
  for (const i of ordem) {
    if (res[i]) continue;
    let melhor = null;
    for (const j of candidatos) {
      if (usados.has(j.id)) continue;
      if (!melhor || ovrEfetivo(j, vagas[i]) > ovrEfetivo(melhor, vagas[i])) melhor = j;
    }
    res[i] = melhor ? melhor.id : null;
    if (melhor) usados.add(melhor.id);
  }
  return res;
}

// Mantém os titulares que ainda existem e completa as vagas vazias com o melhor do resto do elenco.
export function completarTitulares(elenco) {
  const vagas = vagasDaFormacao(elenco.formacao);
  const fixos = vagas.map((_, i) => (elenco.jogadores[elenco.titulares[i]] ? elenco.titulares[i] : null));
  return { ...elenco, titulares: preencher(vagas, Object.values(elenco.jogadores), fixos) };
}

// Escalação de um jogo: titulares disponíveis; quem está fora é trocado pelo melhor disponível para a vaga.
// -> { escalacao: [{ jogador, vaga }], banco: jogador[], desfalques }
export function escalacaoParaJogo(elenco) {
  const vagas = vagasDaFormacao(elenco.formacao);
  const disponiveis = Object.values(elenco.jogadores).filter(disponivel);
  const fixos = vagas.map((_, i) => {
    const j = elenco.jogadores[elenco.titulares[i]];
    return j && disponivel(j) ? j.id : null;
  });
  const ids = preencher(vagas, disponiveis, fixos);
  const escalacao = ids.map((id, i) => (id ? { jogador: elenco.jogadores[id], vaga: vagas[i] } : null)).filter(Boolean);
  const emCampo = new Set(ids.filter(Boolean));
  const banco = disponiveis.filter((j) => !emCampo.has(j.id)).sort((a, b) => b.ovr - a.ovr).slice(0, TAMANHO_BANCO);
  return { escalacao, banco, desfalques: vagas.length - escalacao.length };
}

// Depois de um jogo do usuário: quem estava fora cumpre um jogo; quem se lesionou ou foi expulso fica fora.
// lesoes: [{ jogadorId, jogos }], expulsos: [{ jogadorId }]
export function aplicarConsequencias(elenco, { lesoes = [], expulsos = [] }) {
  const jogadores = {};
  for (const [id, j] of Object.entries(elenco.jogadores)) {
    jogadores[id] = { ...j, fora: Math.max(0, j.fora - 1), suspenso: Math.max(0, j.suspenso - 1) };
  }
  for (const { jogadorId, jogos } of lesoes) if (jogadores[jogadorId]) jogadores[jogadorId].fora = jogos;
  for (const { jogadorId } of expulsos) if (jogadores[jogadorId]) jogadores[jogadorId].suspenso = 1;
  return { ...elenco, jogadores };
}

export function forcaMediaDoElenco(elenco) {
  const ids = elenco.titulares.filter(Boolean);
  if (!ids.length) return 0;
  return ids.reduce((s, id) => s + elenco.jogadores[id].ovr, 0) / ids.length;
}
