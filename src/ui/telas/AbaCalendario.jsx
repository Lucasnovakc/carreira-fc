import { useCarreira } from '../estado/CarreiraContext.jsx';
import { clubeVisual } from '../componentes/Distintivo.jsx';
import { linhasDoCalendario } from '../logica/temporada.js';

export function AbaCalendario() {
  const { carreira, dados } = useCarreira();
  const linhas = linhasDoCalendario(carreira, dados);
  return (
    <div className="lista">
      {linhas.map((l) => (
        <div key={l.indice} className={`linha ${l.atual ? 'on' : ''}`} style={l.meu ? undefined : { opacity: 0.45 }}>
          <span className="muted" style={{ minWidth: 26 }}>{l.indice + 1}</span>
          <span className="grow">
            {l.titulo}
            {l.adversario && <span className="muted"> · {clubeVisual(dados, l.adversario).nome}</span>}
            {!l.meu && <span className="muted"> · sem jogo seu</span>}
          </span>
          {l.resultado && <span className={`bolinha ${l.resultado.letra}`} style={{ width: 'auto', padding: '0 8px', borderRadius: 6 }}>{l.resultado.meus}-{l.resultado.deles}</span>}
        </div>
      ))}
    </div>
  );
}
