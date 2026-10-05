// Pontos corridos: rodadas, tabela e ordenação.

export function criarTabela(ids) {
  return ids.map((id) => ({ id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }));
}

function somar(linha, pro, contra) {
  const v = pro > contra ? 1 : 0, e = pro === contra ? 1 : 0, d = pro < contra ? 1 : 0;
  return {
    ...linha,
    j: linha.j + 1, v: linha.v + v, e: linha.e + e, d: linha.d + d,
    gp: linha.gp + pro, gc: linha.gc + contra, pts: linha.pts + 3 * v + e,
  };
}

// resultado: { casa, fora, golsCasa, golsFora }
export function registrarResultado(tabela, { casa, fora, golsCasa, golsFora }) {
  return tabela.map((l) => {
    if (l.id === casa) return somar(l, golsCasa, golsFora);
    if (l.id === fora) return somar(l, golsFora, golsCasa);
    return l;
  });
}

// Desempate: pontos, vitórias, saldo, gols pró, id (para ser estável).
export function ordenarTabela(tabela) {
  return [...tabela].sort((a, b) =>
    b.pts - a.pts || b.v - a.v || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp || (a.id < b.id ? -1 : 1));
}

// Método do círculo. Retorna [[{ casa, fora }]]; com número ímpar, quem "folga" fica de fora da rodada.
export function gerarRodadas(ids, { idaEVolta = false } = {}) {
  const lista = ids.length % 2 ? [...ids, null] : [...ids];
  const n = lista.length;
  const turno = [];
  for (let r = 0; r < n - 1; r++) {
    const jogos = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lista[i], b = lista[n - 1 - i];
      if (a === null || b === null) continue;
      // alterna o mando para ninguém jogar sempre em casa
      const inverter = i === 0 ? r % 2 === 1 : i % 2 === 1;
      jogos.push(inverter ? { casa: b, fora: a } : { casa: a, fora: b });
    }
    turno.push(jogos);
    lista.splice(1, 0, lista.pop()); // gira todos menos o primeiro
  }
  if (!idaEVolta) return turno;
  return [...turno, ...turno.map((jogos) => jogos.map(({ casa, fora }) => ({ casa: fora, fora: casa })))];
}
