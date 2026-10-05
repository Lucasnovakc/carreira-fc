import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { salvar, carregar, apagar, CHAVE } from '../../src/storage/index.js';

function memoria() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    dados,
  };
}

describe('storage', () => {
  let original;
  beforeEach(() => { original = globalThis.localStorage; globalThis.localStorage = memoria(); });
  afterEach(() => { globalThis.localStorage = original; });

  it('salva e carrega a carreira', () => {
    const c = { versao: 1, fase: 'draft', temporada: 0 };
    expect(salvar(c)).toBe(true);
    expect(carregar()).toEqual(c);
  });

  it('sem save, carrega null', () => {
    expect(carregar()).toBeNull();
  });

  it('save corrompido ou de outra versão vira null', () => {
    globalThis.localStorage.setItem(CHAVE, '{quebrado');
    expect(carregar()).toBeNull();
    globalThis.localStorage.setItem(CHAVE, JSON.stringify({ versao: 99 }));
    expect(carregar()).toBeNull();
  });

  it('apagar remove o save', () => {
    salvar({ versao: 1 });
    apagar();
    expect(carregar()).toBeNull();
  });

  it('se o navegador bloquear o armazenamento, nada quebra', () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
      removeItem: () => { throw new Error('bloqueado'); },
    };
    expect(salvar({ versao: 1 })).toBe(false);
    expect(carregar()).toBeNull();
    expect(() => apagar()).not.toThrow();
  });
});
