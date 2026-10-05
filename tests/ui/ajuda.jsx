import { vi, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { dados } from '../../src/data/index.js';
import { CarreiraProvider } from '../../src/ui/estado/CarreiraContext.jsx';
import { App } from '../../src/ui/App.jsx';

// Apoio para os testes de fumaça: usam o app de verdade num navegador simulado (jsdom).
export const clicar = (el) => act(() => { fireEvent.click(el); });
export const passar = (ms) => act(() => { vi.advanceTimersByTime(ms); });
export const botoes = () => screen.getAllByRole('button');

export function montar(inicial = null) {
  return render(<CarreiraProvider dados={dados} inicial={inicial}><App /></CarreiraProvider>);
}

// Escolhe o Flamengo e completa o draft pela tela: sempre o 1º jogador, na 1ª vaga livre ou no banco.
export async function fazerDraft() {
  await clicar(screen.getByText('Flamengo'));
  await clicar(screen.getByText('Bora girar a roleta!'));
  expect(screen.getByText('Draft')).toBeTruthy();
  for (let i = 0; i < 15; i++) {
    await clicar(screen.getByText('⚽ Puxar a alavanca'));
    await passar(2500);
    await clicar(botoes().find((b) => /anos/.test(b.textContent)));
    const vagaLivre = botoes().find((b) => /vazia$/.test(b.getAttribute('aria-label') ?? ''));
    if (vagaLivre) await clicar(vagaLivre);
    else await clicar(botoes().find((b) => /no banco$/.test(b.textContent)));
  }
}
