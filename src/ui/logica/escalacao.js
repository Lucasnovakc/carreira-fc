// Lógica pura de escalação para as telas: encaixe na vaga, reorganização e desenho do campinho.
import { fatorPosicao, ovrEfetivo } from '../../engine/posicoes.js';

const ROTULO = { 1: 'posição natural', 0.92: 'posição vizinha', 0.8: 'fora de posição', 0.5: 'improvisado' };

// { ovr, fator, texto } — no modo olheiro o texto não revela números
export function avaliarVaga(jogador, vaga, dificuldade = 'classico') {
  const fator = fatorPosicao(jogador.pos, vaga);
  const ovr = ovrEfetivo(jogador, vaga);
  if (dificuldade === 'olheiro') return { ovr: null, fator, texto: ROTULO[fator] };
  const perda = Math.round((1 - fator) * 100);
  return { ovr, fator, texto: perda ? `${ovr} (−${perda}%)` : `${ovr}` };
}

// Distribui jogadores nas vagas pelo melhor encaixe (goleiro primeiro). Retorna ids alinhados às vagas
// (null quando faltam jogadores).
export function reorganizar(jogadores, vagas) {
  const livres = [...jogadores];
  const ordem = vagas.map((_, i) => i).sort((a, b) => (vagas[b] === 'GOL') - (vagas[a] === 'GOL'));
  const res = Array(vagas.length).fill(null);
  for (const i of ordem) {
    if (!livres.length) break;
    let melhor = 0;
    for (let k = 1; k < livres.length; k++) {
      if (ovrEfetivo(livres[k], vagas[i]) > ovrEfetivo(livres[melhor], vagas[i])) melhor = k;
    }
    res[i] = livres.splice(melhor, 1)[0].id;
  }
  return res;
}

// Altura (em % do campo, 0 = ataque no topo) e lado preferido de cada posição.
// Defesa numa linha só e ataque numa linha só (laterais e pontas nas extremidades): sem sobreposição em 360 px.
const ALTURA = { GOL: 91, ZAG: 76, LD: 76, LE: 76, VOL: 60, MC: 47, MEI: 32, PD: 14, PE: 14, CA: 14 };
const LADO = { LE: -1, PE: -1, LD: 1, PD: 1 };

// [{ x, y }] em % para cada vaga, espalhando quem divide a mesma linha.
export function posicoesNoCampo(vagas) {
  const linhas = new Map();
  vagas.forEach((v, i) => {
    const y = ALTURA[v];
    if (!linhas.has(y)) linhas.set(y, []);
    linhas.get(y).push(i);
  });
  const pos = [];
  for (const [y, idx] of linhas) {
    const ordenados = [...idx].sort((a, b) => (LADO[vagas[a]] ?? 0) - (LADO[vagas[b]] ?? 0) || a - b);
    ordenados.forEach((i, k) => {
      pos[i] = { x: Math.round(((k + 1) / (ordenados.length + 1)) * 100), y };
    });
  }
  return pos;
}
