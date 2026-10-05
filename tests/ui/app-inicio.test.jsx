// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { carregar } from '../../src/storage/index.js';
import { clicar, montar, fazerDraft } from './ajuda.jsx';

describe('app: início e draft', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('nova carreira → draft completo → painel da temporada', async () => {
    montar();
    expect(screen.getByText('Nova carreira')).toBeTruthy();
    await fazerDraft();
    expect(screen.getByText(/Temporada 1 de 10/)).toBeTruthy();
  });

  it('com save existente, abre na tela Continuar', async () => {
    const { unmount } = montar();
    await fazerDraft();
    unmount();
    // reabre lendo o save do navegador, como ao abrir o jogo de novo
    const salvo = carregar();
    expect(salvo).not.toBeNull();
    montar(salvo);
    expect(screen.getByText('Continuar')).toBeTruthy();
    await clicar(screen.getByText('Continuar'));
    expect(screen.getByText(/Temporada 1 de 10/)).toBeTruthy();
  });
});
