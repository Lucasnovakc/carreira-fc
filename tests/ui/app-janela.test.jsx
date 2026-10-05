// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { clicar, passar, botoes, montar, fazerDraft } from './ajuda.jsx';

describe('app: fim de temporada', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('temporada inteira → resumo → janela de transferências → temporada 2', async () => {
    montar();
    await fazerDraft();
    for (let i = 0; i < 80 && !screen.queryByText('Ir para a janela de transferências'); i++) {
      const ok = screen.queryByText('OK');
      if (ok) await clicar(ok);
      const avancar = screen.queryByText('Simular') ?? screen.queryByText('Avançar');
      await clicar(avancar);
    }
    expect(screen.getByText(/Temporada 1 de 10/)).toBeTruthy();
    await clicar(screen.getByText('Ir para a janela de transferências'));
    for (let i = 0; i < 20 && !screen.queryByText(/Começar a temporada 2/); i++) {
      await clicar(botoes().find((b) => /^Girar roleta/.test(b.textContent)));
      await passar(2500);
      const recusar = screen.queryByText('Recusar');
      if (recusar) { await clicar(recusar); continue; }
      await clicar(botoes().find((b) => /anos/.test(b.textContent)));
      const confirmar = screen.getByText('Confirmar');
      if (confirmar.disabled) {
        const quemSai = botoes().filter((b) => /anos/.test(b.textContent)).at(-1);
        await clicar(quemSai);
      }
      await clicar(screen.getByText('Confirmar'));
    }
    await clicar(screen.getByText(/Começar a temporada 2/));
    expect(screen.getByText(/Temporada 2 de 10/)).toBeTruthy();
  }, 60000);
});
