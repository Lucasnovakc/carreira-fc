// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { clicar, passar, montar, fazerDraft } from './ajuda.jsx';

describe('app: temporada', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('simular um jogo mostra o resultado e avança a data', async () => {
    montar();
    await fazerDraft();
    await clicar(screen.getByText('Simular'));
    expect(screen.getByText('Resultado')).toBeTruthy();
    expect(screen.getByText(/Data 2\//)).toBeTruthy();
  });

  it('assistir: 1º tempo, intervalo, 2º tempo e volta ao painel', async () => {
    montar();
    await fazerDraft();
    await clicar(screen.getByText('▶ Assistir'));
    await passar(16000);
    expect(screen.getByText('INTERVALO')).toBeTruthy();
    await clicar(screen.getByText('Começar o 2º tempo'));
    await passar(16000);
    await passar(12000); // prorrogação, se houver
    await passar(20000); // pênaltis, se houver
    expect(screen.getByText('FIM DE JOGO')).toBeTruthy();
    await clicar(screen.getByText('Continuar'));
    expect(screen.getByText(/Data 2\//)).toBeTruthy();
  });

  it('as abas Tabelas, Elenco e Calendário abrem', async () => {
    montar();
    await fazerDraft();
    await clicar(screen.getByText('Tabelas'));
    expect(screen.getAllByText('Brasileirão').length).toBeGreaterThan(0);
    await clicar(screen.getByText('Elenco', { selector: 'button' }));
    expect(screen.getByText('Reservas')).toBeTruthy();
    await clicar(screen.getByText('Calendário'));
    expect(screen.getAllByText(/Paulistão|Carioca/).length).toBeGreaterThan(0);
  });

  it('na aba Elenco, a vaga mostra o overall com a penalidade de posição', async () => {
    montar();
    await fazerDraft(); // o robô sempre pega o 1º jogador da lista, que é um goleiro
    await clicar(screen.getByText('Elenco', { selector: 'button' }));
    const vaga = (pos) => screen.getAllByRole('button').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(`Vaga ${pos}:`));
    // troca o goleiro titular com o ponta-esquerda (que também é goleiro de origem)
    await clicar(vaga('GOL'));
    await clicar(vaga('PE'));
    expect(vaga('PE').textContent).toMatch(/\(−50%\)/);
    expect(vaga('GOL').textContent).not.toMatch(/−/);
  });
});
