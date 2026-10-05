// Roleta de elencos históricos (draft e transferências).

export const LIMITE_OVR = { boa: 99, media: 85, ruim: 68 };

export const idJogador = (elencoId, i) => `${elencoId}:${i}`;

export function jogadorDaBase(elenco, i) {
  const j = elenco.jogadores[i];
  return { id: idJogador(elenco.id, i), nome: j.nome, pos: j.pos, ovr: j.ovr, idade: j.idade, origem: `${elenco.clube} ${elenco.ano}` };
}

// Para numa elenco que tenha pelo menos uma opção válida. Retorna { elencoId, opcoes } ou null.
// tipo: 'boa' | 'media' | 'ruim'; excluirElencos: ids; excluirJogadores: ids de jogador.
export function girarRoleta(elencos, rng, { tipo = 'boa', excluirElencos = [], excluirJogadores = [] } = {}) {
  const limite = LIMITE_OVR[tipo];
  if (limite === undefined) throw new Error(`Tipo de roleta desconhecido: ${tipo}`);
  const fora = new Set(excluirJogadores);
  const candidatos = elencos
    .filter((e) => !excluirElencos.includes(e.id))
    .map((e) => ({
      elencoId: e.id,
      opcoes: e.jogadores.map((_, i) => jogadorDaBase(e, i)).filter((j) => j.ovr <= limite && !fora.has(j.id)),
    }))
    .filter((c) => c.opcoes.length > 0);
  return candidatos.length ? rng.pick(candidatos) : null;
}
