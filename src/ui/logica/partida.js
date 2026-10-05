// Lógica pura da partida ao vivo: narração, relógio, pressão e cansaço.

const FRASES = {
  gol: ['GOL! {jogador} balança a rede!', 'É GOL! {jogador} não perdoa!', 'Golaço de {jogador}!', '{jogador} manda pro fundo do gol!'],
  golSemNome: ['Gol do {clube}!', 'É gol do {clube}!'],
  chance: ['Chute de {jogador}, pra fora.', 'Defesaça do goleiro na finalização de {jogador}!', '{jogador} cabeceia por cima do gol.', 'Bola na trave! {jogador} quase marca.'],
  chanceSemNome: ['O {clube} assusta.', 'Chance do {clube}, mas a zaga afasta.', 'Finalização do {clube} passa raspando.'],
  var: ['VAR chamado... gol de {jogador} anulado!', 'Impedimento! O VAR anula o gol de {jogador}.'],
  varSemNome: ['VAR anula o gol do {clube}!'],
  vermelho: ['Cartão vermelho! {jogador} está expulso.', 'Entrada dura e {jogador} recebe o vermelho!'],
  vermelhoSemNome: ['Expulsão no {clube}!'],
  lesao: ['{jogador} sente e sai lesionado ({jogos}).'],
  troca: ['Sai {jogador}, entra {entra}.'],
};

const plural = (n) => (n === 1 ? '1 jogo fora' : `${n} jogos fora`);

// nomes: { casa: 'Flamengo', fora: 'Palmeiras' }
export function narrar(evento, nomes) {
  const semNome = !evento.nome && FRASES[`${evento.tipo}SemNome`];
  const lista = semNome || FRASES[evento.tipo] || ['{jogador}'];
  const frase = lista[evento.minuto % lista.length];
  return frase
    .replaceAll('{jogador}', evento.nome ?? '')
    .replaceAll('{clube}', nomes[evento.lado] ?? '')
    .replaceAll('{entra}', evento.entraNome ?? '')
    .replaceAll('{jogos}', plural(evento.jogos ?? 1));
}

export const TIPOS_DESTAQUE = ['gol', 'var', 'vermelho', 'lesao'];

export function eventosAte(eventos, minuto) {
  return eventos.filter((e) => e.minuto <= minuto);
}

const LANCES = ['chance', 'gol', 'var'];

// Fração das chances de cada lado nos últimos `janela` minutos até `minuto`.
export function pressao(eventos, minuto, janela = 15) {
  const recentes = eventos.filter((e) => LANCES.includes(e.tipo) && e.minuto <= minuto && e.minuto > minuto - janela);
  const casa = recentes.filter((e) => e.lado === 'casa').length;
  const fora = recentes.length - casa;
  if (!recentes.length) return { casa: 0.5, fora: 0.5 };
  return { casa: casa / recentes.length, fora: fora / recentes.length };
}

export function contarChances(eventos, minuto) {
  const lances = eventos.filter((e) => LANCES.includes(e.tipo) && e.minuto <= minuto);
  const casa = lances.filter((e) => e.lado === 'casa').length;
  return { casa, fora: lances.length - casa };
}

export function faixaCansaco(valor) {
  if (valor >= 70) return 'vermelho';
  if (valor >= 50) return 'amarelo';
  return 'verde';
}

// Períodos do relógio: { inicio, fim } em minutos de jogo.
export const PERIODOS = {
  primeiro: { inicio: 0, fim: 45 },
  segundo: { inicio: 45, fim: 90 },
  prorrogacao: { inicio: 90, fim: 120 },
};

// fracao 0..1 do tempo real -> minuto de jogo (inteiro)
export function minutoNoPeriodo(periodo, fracao) {
  const { inicio, fim } = PERIODOS[periodo];
  return Math.min(fim, Math.floor(inicio + (fim - inicio) * Math.max(0, Math.min(1, fracao))));
}

export function rotuloRelogio(minuto, periodo, acrescimos) {
  const { fim } = PERIODOS[periodo];
  if (minuto >= fim && acrescimos && periodo !== 'prorrogacao') {
    const extra = periodo === 'primeiro' ? acrescimos.primeiro : acrescimos.segundo;
    return `${fim}+${extra}'`;
  }
  return `${minuto}'`;
}
