import { SETOR, ovrEfetivo } from './posicoes.js';

export const SETOR_VAZIO = 40;
export const BONUS_POSTURA = 4;
export const BONUS_MANDO = 2;
export const FATOR_DESFALQUE = 0.92;
export const QUEDA_MAX_CANSACO = 0.1;

// escalacao: [{ jogador: { id, ovr, pos }, vaga }]
// cansaco: { [jogadorId]: 0..100 }; progresso: 0..1 dentro do 2º tempo
export function setoresDaEscalacao(escalacao, cansaco = {}, progresso = 0) {
  const soma = { gol: 0, def: 0, mei: 0, ata: 0 };
  const qtd = { gol: 0, def: 0, mei: 0, ata: 0 };
  for (const { jogador, vaga } of escalacao) {
    const setor = SETOR[vaga];
    const queda = QUEDA_MAX_CANSACO * ((cansaco[jogador.id] ?? 0) / 100) * progresso;
    soma[setor] += ovrEfetivo(jogador, vaga) * (1 - queda);
    qtd[setor] += 1;
  }
  const r = {};
  for (const s of Object.keys(soma)) r[s] = qtd[s] ? soma[s] / qtd[s] : SETOR_VAZIO;
  return r;
}

export function aplicarModificadores(setores, { postura = 'equilibrada', mandante = false, desfalques = 0 } = {}) {
  const r = { ...setores };
  if (postura === 'ofensiva') { r.ata += BONUS_POSTURA; r.def -= BONUS_POSTURA; }
  if (postura === 'defensiva') { r.def += BONUS_POSTURA; r.ata -= BONUS_POSTURA; }
  const fator = FATOR_DESFALQUE ** desfalques;
  for (const s of Object.keys(r)) {
    if (mandante) r[s] += BONUS_MANDO;
    r[s] *= fator;
  }
  return r;
}

// lado: { setoresBase?, escalacao?, cansaco, postura, desfalques }
export function setoresDoLado(lado, { mandante = false, progresso = 0 } = {}) {
  const base = lado.escalacao
    ? setoresDaEscalacao(lado.escalacao, lado.cansaco, progresso)
    : lado.setoresBase;
  return aplicarModificadores(base, { postura: lado.postura, mandante, desfalques: lado.desfalques });
}
