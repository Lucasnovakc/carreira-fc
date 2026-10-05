import { useEffect, useMemo, useRef, useState } from 'react';
import { Distintivo } from './Distintivo.jsx';

const ITEM = 86; // largura do item + espaço (px)
const VOLTAS = 18; // quantos itens passam antes de parar
export const DURACAO_ROLETA = 2200;

// Faixa de elencos que gira e para no elenco já sorteado pelo motor (a animação só revela).
// elencos: base completa; alvoId: id sorteado; onFim: chamado quando para.
export function Roleta({ elencos, alvoId, onFim }) {
  const faixa = useMemo(() => {
    const inicio = Math.max(0, elencos.findIndex((e) => e.id === alvoId));
    const itens = [];
    for (let k = -VOLTAS; k <= 3; k++) itens.push(elencos[(inicio + k + elencos.length * 10) % elencos.length]);
    return itens;
  }, [elencos, alvoId]);
  const alvoIndice = VOLTAS;
  const [parou, setParou] = useState(false);
  const [deslocamento, setDeslocamento] = useState(0);
  const fim = useRef(onFim);
  fim.current = onFim;

  useEffect(() => {
    setParou(false);
    setDeslocamento(0);
    const a = requestAnimationFrame(() => setDeslocamento(-(alvoIndice * ITEM + ITEM / 2 - 5)));
    const t = setTimeout(() => { setParou(true); fim.current?.(); }, DURACAO_ROLETA);
    return () => { cancelAnimationFrame(a); clearTimeout(t); };
  }, [alvoId, alvoIndice]);

  return (
    <div className="roleta" aria-live="polite">
      <div className="roleta-marca" />
      <div className="roleta-faixa" style={{
        transform: `translateX(${deslocamento}px)`,
        transition: deslocamento ? `transform ${DURACAO_ROLETA}ms cubic-bezier(.12,.75,.15,1)` : 'none',
      }}>
        {faixa.map((e, i) => (
          <div key={`${e.id}-${i}`} className={`roleta-item ${i === alvoIndice ? 'alvo' : ''} ${parou ? 'parou' : ''}`}>
            <Distintivo sigla={e.sigla} cores={e.cores} tamanho={34} />
            <span>{e.ano}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
