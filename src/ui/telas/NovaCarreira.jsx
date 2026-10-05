import { useState } from 'react';
import formacoes from '../../data/formacoes.json';
import { novaCarreira } from '../../engine/carreira.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { Distintivo } from '../componentes/Distintivo.jsx';
import { Campinho } from '../componentes/Campinho.jsx';

function sementeAleatoria() {
  const v = new Uint32Array(1);
  globalThis.crypto.getRandomValues(v);
  return v[0] & 0x7fffffff;
}

export function NovaCarreira() {
  const { dados, executar } = useCarreira();
  const serieA = dados.clubes.filter((c) => c.serieA).sort((a, b) => a.nome.localeCompare(b.nome));
  const [clubeId, setClubeId] = useState(null);
  const [duracao, setDuracao] = useState(10);
  const [dificuldade, setDificuldade] = useState('classico');
  const [formacao, setFormacao] = useState('4-3-3');
  const [postura, setPostura] = useState('equilibrada');
  const vagas = formacoes.find((f) => f.id === formacao).vagas;

  return (
    <div className="app">
      <h1 className="tela-titulo">Nova carreira</h1>
      <p className="subtitulo">Escolha o clube. O elenco sai da roleta.</p>

      <div className="secao">Clube</div>
      <div className="grade">
        {serieA.map((c) => (
          <button key={c.id} className={`opcao ${clubeId === c.id ? 'on' : ''}`} onClick={() => setClubeId(c.id)}>
            <Distintivo sigla={c.sigla} cores={c.cores} tamanho={34} />
            <div style={{ marginTop: 4, fontWeight: 700 }}>{c.nome}</div>
            <div className="muted">{c.estado}</div>
          </button>
        ))}
      </div>

      <div className="secao">Duração</div>
      <div className="segmentos">
        {[5, 10].map((d) => (
          <button key={d} className={`opcao ${duracao === d ? 'on' : ''}`} onClick={() => setDuracao(d)}>{d} temporadas</button>
        ))}
      </div>

      <div className="secao">Dificuldade</div>
      <div className="segmentos">
        <button className={`opcao ${dificuldade === 'classico' ? 'on' : ''}`} onClick={() => setDificuldade('classico')}>
          <b>Clássico</b><div className="muted">overall visível</div>
        </button>
        <button className={`opcao ${dificuldade === 'olheiro' ? 'on' : ''}`} onClick={() => setDificuldade('olheiro')}>
          <b>Olheiro</b><div className="muted">overall escondido</div>
        </button>
      </div>

      <div className="secao">Formação</div>
      <div className="segmentos">
        {formacoes.map((f) => (
          <button key={f.id} className={`opcao ${formacao === f.id ? 'on' : ''}`} onClick={() => setFormacao(f.id)}>{f.id}</button>
        ))}
      </div>
      <p className="muted">{formacoes.find((f) => f.id === formacao).descricao}</p>
      <div style={{ maxWidth: 260, margin: '0 auto' }}>
        <Campinho vagas={vagas} ocupantes={vagas.map(() => null)} />
      </div>

      <div className="secao">Postura</div>
      <div className="segmentos">
        {['defensiva', 'equilibrada', 'ofensiva'].map((p) => (
          <button key={p} className={`opcao ${postura === p ? 'on' : ''}`} onClick={() => setPostura(p)}>
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ height: 18 }} />
      <button className="botao primario" disabled={!clubeId}
        onClick={() => executar(() => novaCarreira({ dados, clubeId, duracao, dificuldade, formacao, postura, semente: sementeAleatoria() }))}>
        Bora girar a roleta!
      </button>
    </div>
  );
}
