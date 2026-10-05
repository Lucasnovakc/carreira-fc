// Regras de classificação (spec 5.5) e roletas de fim de temporada (spec 6.2).

// ordemBrasileirao: ids do 1º ao 20º. campeoes: { copaDoBrasil, libertadores, sulamericana } (ids ou null).
// Libertadores: G4 + campeões de copa que sejam brasileiros. Sul-Americana: os 6 seguintes da tabela
// que não foram para a Libertadores (as vagas "descem").
export function vagasContinentais(ordemBrasileirao, campeoes = {}) {
  const brasileiros = new Set(ordemBrasileirao);
  const extras = [campeoes.libertadores, campeoes.sulamericana, campeoes.copaDoBrasil].filter((id) => brasileiros.has(id));
  const libertadores = [...new Set([...ordemBrasileirao.slice(0, 4), ...extras])];
  const sulamericana = ordemBrasileirao.filter((id) => !libertadores.includes(id)).slice(0, 6);
  return { libertadores, sulamericana };
}

// posicao: 1..20 no Brasileirão. titulos: ids das competições ganhas na temporada.
export function roletasDoFimDeTemporada(posicao, titulos = []) {
  const fila = [];
  const add = (tipo, n, obrigatoria = false) => { for (let i = 0; i < n; i++) fila.push({ tipo, obrigatoria }); };
  if (posicao >= 17) add('ruim', 3, true);
  if (posicao === 1) add('boa', 3);
  else if (posicao <= 4) add('boa', 2);
  else if (posicao <= 10) add('boa', 1);
  add('boa', titulos.filter((t) => ['copaDoBrasil', 'libertadores', 'sulamericana'].includes(t)).length);
  if (titulos.includes('estadual')) add('media', 1);
  return fila;
}
