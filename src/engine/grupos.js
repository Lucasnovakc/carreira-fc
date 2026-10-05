import { ordenarTabela } from './liga.js';

// idsPorForca: do mais forte ao mais fraco. Cada pote tem nGrupos times e cada grupo recebe um de cada pote.
export function sortearGrupos(idsPorForca, rng, nGrupos = 8) {
  if (idsPorForca.length % nGrupos) throw new Error('O número de times precisa ser múltiplo do número de grupos');
  const grupos = Array.from({ length: nGrupos }, () => []);
  for (let i = 0; i < idsPorForca.length; i += nGrupos) {
    const pote = rng.embaralhar(idsPorForca.slice(i, i + nGrupos));
    pote.forEach((id, g) => grupos[g].push(id));
  }
  return grupos;
}

export function classificadosDoGrupo(tabela, n = 2) {
  return ordenarTabela(tabela).slice(0, n).map((l) => l.id);
}

// classificados: [[1º, 2º] do grupo A, [1º, 2º] do grupo B, ...]
// Cruzamento: 1A x 2B, 1B x 2A, 1C x 2D, 1D x 2C, ... (o 1º decide em casa: fica como segundo do par)
export function cruzarOitavas(classificados) {
  if (classificados.length % 2) throw new Error('Número de grupos precisa ser par');
  const pares = [];
  for (let g = 0; g < classificados.length; g += 2) {
    const [p1, s1] = classificados[g];
    const [p2, s2] = classificados[g + 1];
    pares.push([s2, p1], [s1, p2]);
  }
  return pares;
}
