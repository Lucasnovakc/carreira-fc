import { useState } from 'react';
import { useCarreira } from './estado/CarreiraContext.jsx';
import { Inicio } from './telas/Inicio.jsx';
import { NovaCarreira } from './telas/NovaCarreira.jsx';
import { Draft } from './telas/Draft.jsx';
import { Painel } from './telas/Painel.jsx';
import { FimTemporada } from './telas/FimTemporada.jsx';
import { FimCarreira } from './telas/FimCarreira.jsx';

// A tela é escolhida pela fase da carreira; não há como abrir uma tela fora de hora.
export function App() {
  const { carreira, erro, limparErro } = useCarreira();
  // A tela "Continuar" só aparece para a carreira que já estava salva quando o app abriu.
  const [sementeSalva] = useState(() => carreira?.semente ?? null);
  const [entrou, setEntrou] = useState(false);
  const mostrarInicio = !entrou && carreira && carreira.semente === sementeSalva;

  let tela;
  if (!carreira) tela = <NovaCarreira />;
  else if (mostrarInicio) tela = <Inicio onContinuar={() => setEntrou(true)} />;
  else if (carreira.fase === 'draft') tela = <Draft />;
  else if (carreira.fase === 'temporada') tela = <Painel />;
  else if (carreira.fase === 'transferencias') tela = <FimTemporada />;
  else tela = <FimCarreira />;

  return (
    <>
      {tela}
      {erro && <div className="aviso-erro" role="alert" onClick={limparErro}>{erro} (toque para fechar)</div>}
    </>
  );
}
