// Salvamento da carreira no navegador. Toda leitura/escrita fica em try/catch:
// em aba anônima ou com o armazenamento bloqueado, o jogo continua funcionando (só não salva).

export const CHAVE = 'carreira-fc:save';

function armazenamento() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function salvar(carreira) {
  try {
    armazenamento()?.setItem(CHAVE, JSON.stringify(carreira));
    return true;
  } catch {
    return false;
  }
}

export function carregar() {
  try {
    const txt = armazenamento()?.getItem(CHAVE);
    if (!txt) return null;
    const c = JSON.parse(txt);
    return c && c.versao === 1 ? c : null;
  } catch {
    return null;
  }
}

export function apagar() {
  try {
    armazenamento()?.removeItem(CHAVE);
  } catch {
    // nada a fazer
  }
}
