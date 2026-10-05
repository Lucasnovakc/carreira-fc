import { useState } from 'react';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { totalTitulos } from '../logica/temporada.js';
import { AbaJogo } from './AbaJogo.jsx';
import { AbaTabelas } from './AbaTabelas.jsx';
import { AbaElenco } from './AbaElenco.jsx';
import { AbaCalendario } from './AbaCalendario.jsx';

const ABAS = [
  { id: 'jogo', icone: '⚽', nome: 'Jogo' },
  { id: 'tabelas', icone: '📊', nome: 'Tabelas' },
  { id: 'elenco', icone: '👥', nome: 'Elenco' },
  { id: 'calendario', icone: '📅', nome: 'Calendário' },
];

export function Painel() {
  const { carreira } = useCarreira();
  const [aba, setAba] = useState('jogo');
  const t = carreira.temporadaAtual;
  return (
    <div className="app">
      <div className="topo">
        <span>Temporada {carreira.temporada} de {carreira.config.duracao} · Data {Math.min(t.indice + 1, t.calendario.length)}/{t.calendario.length}</span>
        <span>🏆 {totalTitulos(carreira)}</span>
      </div>
      {aba === 'jogo' && <AbaJogo onAjustar={() => setAba('elenco')} />}
      {aba === 'tabelas' && <AbaTabelas />}
      {aba === 'elenco' && <AbaElenco />}
      {aba === 'calendario' && <AbaCalendario />}
      <nav className="abas">
        <div className="abas-interno">
          {ABAS.map((a) => (
            <button key={a.id} className={aba === a.id ? 'on' : ''} onClick={() => setAba(a.id)}>
              <span>{a.icone}</span>{a.nome}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
