// Evolução dos clubes do computador entre temporadas: como não têm elenco, o "reforço"
// é um ajuste nas 4 notas, espelhando as roletas do usuário.

export const PUXADA = 0.3; // quanto a nota volta, por temporada, para a nota original do clube
export const OSCILACAO = 2;
export const BONUS_TITULO = 1; // por Copa do Brasil, Libertadores ou Sul-Americana
const NOTA_MIN = 50;
const NOTA_MAX = 90;

export function ajustePorPosicao(posicao) {
  if (posicao === 1) return 2;
  if (posicao <= 4) return 1;
  if (posicao <= 16) return 0;
  return -1;
}

// notas / originais: { [clubeId]: { gol, def, mei, ata } }
// ordemBrasileirao: ids do 1º ao 20º; campeoes: ids dos campeões de copa (um por título); excluir: clube do usuário
export function evoluirClubes(notas, originais, { ordemBrasileirao, campeoes = [], excluir = null }, rng) {
  const novas = {};
  for (const [id, n] of Object.entries(notas)) {
    if (id === excluir) { novas[id] = { ...n }; continue; }
    const pos = ordemBrasileirao.indexOf(id) + 1;
    const bonus = (pos ? ajustePorPosicao(pos) : 0) + campeoes.filter((c) => c === id).length * BONUS_TITULO;
    const o = originais[id] ?? n;
    novas[id] = {};
    for (const s of ['gol', 'def', 'mei', 'ata']) {
      const v = n[s] + (o[s] - n[s]) * PUXADA + bonus + rng.int(-OSCILACAO, OSCILACAO);
      novas[id][s] = Math.max(NOTA_MIN, Math.min(NOTA_MAX, Math.round(v)));
    }
  }
  return novas;
}
