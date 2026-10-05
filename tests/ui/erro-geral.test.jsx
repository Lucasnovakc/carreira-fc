// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErroGeral } from '../../src/ui/componentes/ErroGeral.jsx';
import { salvar, carregar } from '../../src/storage/index.js';

function Quebra() {
  throw new Error('save estranho');
}

describe('ErroGeral', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

  it('mostra uma saída em vez de tela branca', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErroGeral><Quebra /></ErroGeral>);
    expect(screen.getByText('Algo deu errado')).toBeTruthy();
    expect(screen.getByText(/save estranho/)).toBeTruthy();
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });

  it('"Apagar carreira salva" remove o save', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    salvar({ versao: 1, fase: 'temporada' });
    const recarregar = vi.fn();
    render(<ErroGeral aoRecarregar={recarregar}><Quebra /></ErroGeral>);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByText('Apagar carreira salva'));
    expect(carregar()).toBeNull();
    expect(recarregar).toHaveBeenCalled();
  });

  it('sem erro, mostra o conteúdo normal', () => {
    render(<ErroGeral><p>tudo certo</p></ErroGeral>);
    expect(screen.getByText('tudo certo')).toBeTruthy();
  });
});
