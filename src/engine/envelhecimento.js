// Envelhecimento e aposentadoria (spec 6.1). Usa a idade depois do aniversário.

export const OVR_MIN = 40;
export const OVR_MAX = 99;
// Quanto um jogador pode crescer acima do overall com que entrou no elenco (ovrBase).
export const TETO_EVOLUCAO = 6;

export function deltaOvr(idade) {
  if (idade <= 23) return 2;
  if (idade <= 27) return 1;
  if (idade <= 31) return 0;
  if (idade <= 33) return -2;
  return -4;
}

export function chanceAposentar(idade) {
  if (idade >= 37) return 1;
  if (idade >= 35) return 0.4;
  return 0;
}

// jogadores: [{ id, ovr, idade, ovrBase?, ... }] -> { jogadores (os que seguem), aposentados }
export function envelhecer(jogadores, rng) {
  const seguem = [];
  const aposentados = [];
  for (const j of jogadores) {
    const idade = j.idade + 1;
    const ovrBase = j.ovrBase ?? j.ovr;
    const delta = deltaOvr(idade);
    const subido = delta > 0 ? Math.min(j.ovr + delta, Math.max(j.ovr, ovrBase + TETO_EVOLUCAO)) : j.ovr + delta;
    const ovr = Math.max(OVR_MIN, Math.min(OVR_MAX, subido));
    const novo = { ...j, idade, ovr, ovrBase };
    const p = chanceAposentar(idade);
    if (p > 0 && rng.chance(p)) aposentados.push(novo);
    else seguem.push(novo);
  }
  return { jogadores: seguem, aposentados };
}
