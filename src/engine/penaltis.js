const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function probConversao(ataBatedor, golAdversario) {
  return clamp(0.75 + (ataBatedor - golAdversario) * 0.005, 0.55, 0.92);
}

// casa / fora: setores { ata, gol }. Cinco cobranças alternadas, depois alternadas até desempatar.
export function disputarPenaltis(casa, fora, rng) {
  const pCasa = probConversao(casa.ata, fora.gol);
  const pFora = probConversao(fora.ata, casa.gol);
  const placar = { casa: 0, fora: 0 };
  const cobrancas = [];
  const bater = (lado, p) => {
    const convertido = rng.chance(p);
    if (convertido) placar[lado] += 1;
    cobrancas.push({ lado, convertido });
  };

  for (let i = 0; i < 5; i++) {
    bater('casa', pCasa);
    if (placar.casa > placar.fora + (5 - i) || placar.fora > placar.casa + (4 - i)) break;
    bater('fora', pFora);
    const restam = 4 - i;
    if (Math.abs(placar.casa - placar.fora) > restam) break;
  }
  while (placar.casa === placar.fora) {
    bater('casa', pCasa);
    bater('fora', pFora);
  }
  return { casa: placar.casa, fora: placar.fora, vencedor: placar.casa > placar.fora ? 'casa' : 'fora', cobrancas };
}
