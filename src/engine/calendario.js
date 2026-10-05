// Datas de meio de semana: depois de qual rodada do Brasileirão entra cada etapa das copas.
export const RODADAS_COPA = [3, 5, 10, 12, 17, 19, 24, 26, 31, 33];
export const RODADAS_CONTINENTAL = [2, 4, 6, 8, 11, 13, 15, 18, 21, 23, 27, 29, 35];

// competicoes: { estadual, brasileirao, copaDoBrasil?, libertadores?, sulamericana? }
// Retorna [{ tipo, comps: [compId] }]: cada data roda a próxima etapa de cada competição listada.
export function montarCalendario(competicoes) {
  const datas = [];
  const { estadual, brasileirao, copaDoBrasil } = competicoes;
  const continentais = ['libertadores', 'sulamericana'].filter((id) => competicoes[id]);
  if (estadual) for (let i = 0; i < estadual.etapas.length; i++) datas.push({ tipo: 'estadual', comps: ['estadual'] });
  for (let r = 1; r <= brasileirao.etapas.length; r++) {
    datas.push({ tipo: 'brasileirao', comps: ['brasileirao'] });
    if (copaDoBrasil && RODADAS_COPA.includes(r)) datas.push({ tipo: 'copaDoBrasil', comps: ['copaDoBrasil'] });
    if (continentais.length && RODADAS_CONTINENTAL.includes(r)) datas.push({ tipo: 'continental', comps: continentais });
  }
  return datas;
}
