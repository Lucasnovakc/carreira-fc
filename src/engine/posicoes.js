export const POSICOES = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'CA'];

export const SETOR = {
  GOL: 'gol',
  ZAG: 'def', LD: 'def', LE: 'def',
  VOL: 'mei', MC: 'mei', MEI: 'mei',
  PD: 'ata', PE: 'ata', CA: 'ata',
};

// Pares de posições vizinhas (a ordem não importa).
const VIZINHOS = [
  ['ZAG', 'LD'], ['ZAG', 'LE'], ['ZAG', 'VOL'],
  ['LD', 'PD'], ['LE', 'PE'],
  ['VOL', 'MC'], ['MC', 'MEI'],
  ['MEI', 'PD'], ['MEI', 'PE'],
  ['PD', 'CA'], ['PE', 'CA'],
];

const chave = (a, b) => [a, b].sort().join('-');
const VIZINHOS_SET = new Set(VIZINHOS.map(([a, b]) => chave(a, b)));

export const FATOR = { natural: 1, vizinha: 0.92, distante: 0.8, goleiro: 0.5 };

export function fatorPosicao(natural, vaga) {
  if (natural === vaga) return FATOR.natural;
  if (natural === 'GOL' || vaga === 'GOL') return FATOR.goleiro;
  if (VIZINHOS_SET.has(chave(natural, vaga))) return FATOR.vizinha;
  return FATOR.distante;
}

export function ovrEfetivo(jogador, vaga) {
  return Math.round(jogador.ovr * fatorPosicao(jogador.pos, vaga));
}
