import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { salvar, carregar, apagar } from '../../storage/index.js';

const Contexto = createContext(null);

// Guarda a carreira, salva a cada mudança e transforma erros do motor em aviso na tela.
export function CarreiraProvider({ dados, inicial, children }) {
  const [carreira, setCarreira] = useState(() => (inicial !== undefined ? inicial : carregar()));
  const [erro, setErro] = useState(null);

  // fn: (carreira) => novaCarreira. Retorna a nova carreira (ou null se deu erro).
  const executar = useCallback((fn) => {
    try {
      const nova = fn(carreira);
      setCarreira(nova);
      salvar(nova);
      setErro(null);
      return nova;
    } catch (e) {
      setErro(e.message);
      return null;
    }
  }, [carreira]);

  const encerrar = useCallback(() => {
    apagar();
    setCarreira(null);
  }, []);

  const valor = useMemo(() => ({ carreira, dados, executar, encerrar, erro, limparErro: () => setErro(null) }),
    [carreira, dados, executar, encerrar, erro]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarreira() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useCarreira fora do CarreiraProvider');
  return v;
}
