// Envelhecimento e aposentadoria (spec 6.1). Usa a idade depois do aniversário.

export const OVR_MIN = 40;
export const OVR_MAX = 99;

export function deltaOvr(idade) {
  if (idade <= 23) return 3;
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

// jogadores: [{ id, ovr, idade, ... }] -> { jogadores (os que seguem), aposentados }
export function envelhecer(jogadores, rng) {
  const seguem = [];
  const aposentados = [];
  for (const j of jogadores) {
    const idade = j.idade + 1;
    const ovr = Math.max(OVR_MIN, Math.min(OVR_MAX, j.ovr + deltaOvr(idade)));
    const novo = { ...j, idade, ovr };
    const p = chanceAposentar(idade);
    if (p > 0 && rng.chance(p)) aposentados.push(novo);
    else seguem.push(novo);
  }
  return { jogadores: seguem, aposentados };
}
