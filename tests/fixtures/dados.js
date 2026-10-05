// Base de dados falsa, com o mesmo formato dos JSONs reais (Plano 3), para testar a carreira.

const notas = (n) => ({ gol: n, def: n, mei: n, ata: n });
const POSICOES_ELENCO = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'ZAG', 'LD', 'LD', 'LE', 'LE',
  'VOL', 'VOL', 'MC', 'MC', 'MEI', 'MEI', 'PD', 'PE', 'CA', 'CA'];

export function criarDados() {
  // 20 clubes da Série A: 10 no estado AA, 10 no BB
  const serieA = Array.from({ length: 20 }, (_, i) => ({
    id: `a${i}`, nome: `Clube A${i}`, sigla: `A${i}`, estado: i < 10 ? 'AA' : 'BB',
    cores: ['#000000', '#ffffff'], ...notas(70 + (i % 10)), serieA: true,
    classicos: i === 0 ? ['a1'] : i === 1 ? ['a0'] : [],
  }));
  // 2 pequenos por estado AA/BB e 12 num estado só de pequenos (para completar a Copa do Brasil)
  const pequenos = [
    ...['AA', 'AA', 'BB', 'BB'].map((estado, i) => ({ id: `p${i}`, estado })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: `p${i + 4}`, estado: 'CC' })),
  ].map((p, i) => ({ ...p, nome: `Pequeno ${i}`, sigla: `P${i}`, cores: ['#333333', '#cccccc'], ...notas(60 + (i % 8)), serieA: false, classicos: [] }));
  const clubes = [...serieA, ...pequenos];

  const doEstado = (uf) => clubes.filter((c) => c.estado === uf).map((c) => c.id);
  const estaduais = {
    AA: { nome: 'Campeonato AA', clubes: doEstado('AA') },
    BB: { nome: 'Campeonato BB', clubes: doEstado('BB') },
    CC: { nome: 'Campeonato CC', clubes: doEstado('CC') },
  };

  const estrangeiros = Array.from({ length: 56 }, (_, i) => ({
    id: `x${i}`, nome: `Estrangeiro ${i}`, sigla: `X${i}`, pais: 'ARG', cores: ['#0000ff', '#ffff00'], ...notas(62 + (i % 20)),
  }));

  const elencos = Array.from({ length: 40 }, (_, e) => ({
    id: `elenco-${e}`, clube: `Histórico ${e}`, sigla: `H${e}`, ano: 1960 + e, cores: ['#00aa00', '#ffffff'],
    jogadores: POSICOES_ELENCO.map((pos, i) => ({
      nome: `Jogador ${e}-${i}`, pos, ovr: 60 + ((e * 7 + i * 3) % 35), idade: 19 + ((e + i) % 17),
    })),
  }));

  return { clubes, estaduais, estrangeiros, elencos };
}
