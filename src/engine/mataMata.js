// Mata-mata: quem passa em ida e volta (agregado) ou jogo único.
// Os pênaltis são decididos por quem chama (penaltis.js), aqui só se diz se são necessários.

// ida: { casa: A, fora: B, golsCasa, golsFora }; volta: { casa: B, fora: A, golsCasa, golsFora }
export function decidirIdaVolta(ida, volta) {
  if (ida.casa !== volta.fora || ida.fora !== volta.casa) throw new Error('A volta precisa inverter o mando da ida');
  const a = ida.casa, b = ida.fora;
  const agregado = { [a]: ida.golsCasa + volta.golsFora, [b]: ida.golsFora + volta.golsCasa };
  if (agregado[a] === agregado[b]) return { vencedor: null, agregado, precisaPenaltis: true };
  return { vencedor: agregado[a] > agregado[b] ? a : b, agregado, precisaPenaltis: false };
}

// jogo: { casa, fora, golsCasa, golsFora } (já com a prorrogação, se houve)
export function decidirJogoUnico(jogo) {
  if (jogo.golsCasa === jogo.golsFora) return { vencedor: null, precisaPenaltis: true };
  return { vencedor: jogo.golsCasa > jogo.golsFora ? jogo.casa : jogo.fora, precisaPenaltis: false };
}

// [a, b, c, d] -> [[a, b], [c, d]]
export function emparelhar(ids) {
  if (ids.length % 2) throw new Error('Mata-mata precisa de número par de times');
  const pares = [];
  for (let i = 0; i < ids.length; i += 2) pares.push([ids[i], ids[i + 1]]);
  return pares;
}

export function sortearChave(ids, rng) {
  return emparelhar(rng.embaralhar(ids));
}
