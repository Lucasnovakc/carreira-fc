import { useCarreira } from '../estado/CarreiraContext.jsx';
import { DistintivoClube, clubeVisual } from '../componentes/Distintivo.jsx';
import { salaDeTrofeus, artilheiroDaHistoria, nomeCompeticao, totalTitulos } from '../logica/temporada.js';

export function FimCarreira() {
  const { carreira, dados, encerrar } = useCarreira();
  const sala = salaDeTrofeus(carreira);
  const artilheiro = artilheiroDaHistoria(carreira);
  return (
    <div className="app">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <DistintivoClube dados={dados} id={carreira.config.clubeId} tamanho={56} />
        <div>
          <h1 className="tela-titulo">Fim da carreira</h1>
          <p className="subtitulo" style={{ margin: 0 }}>{clubeVisual(dados, carreira.config.clubeId).nome} · {carreira.config.duracao} temporadas · 🏆 {totalTitulos(carreira)}</p>
        </div>
      </div>

      <div className="secao">Sala de troféus</div>
      {sala.length ? (
        <div className="lista">
          {sala.map(({ compId, temporadas }) => (
            <div key={compId} className="linha">
              <span className="trofeu" style={{ fontSize: 22 }}>🏆</span>
              <span className="grow"><b>{nomeCompeticao(compId, carreira, dados)} ×{temporadas.length}</b></span>
              <span className="muted">{temporadas.map((t) => `T${t}`).join(', ')}</span>
            </div>
          ))}
        </div>
      ) : <p className="muted">Nenhum título. A próxima carreira vai ser diferente!</p>}

      <div className="secao">Brasileirão, temporada a temporada</div>
      <div className="bolinhas" style={{ flexWrap: 'wrap' }}>
        {carreira.historico.map((h) => (
          <span key={h.temporada} className={`bolinha ${h.posicaoBrasileirao === 1 ? 'V' : h.posicaoBrasileirao >= 17 ? 'D' : 'E'}`} title={`T${h.temporada}`}>
            {h.posicaoBrasileirao}º
          </span>
        ))}
      </div>

      <div className="secao">Artilheiros</div>
      <div className="lista">
        {carreira.historico.map((h) => (
          <div key={h.temporada} className="linha"><span className="muted">T{h.temporada}</span>
            <span className="grow">{h.artilheiro ? h.artilheiro.nome : '—'}</span><b>{h.artilheiro?.gols ?? 0}</b></div>
        ))}
      </div>
      {artilheiro && <p className="cartao realce">Artilheiro da história: <b>{artilheiro.nome}</b>, {artilheiro.gols} gols</p>}

      <button className="botao primario" onClick={encerrar}>Nova carreira</button>
    </div>
  );
}
