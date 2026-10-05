// Escudo simples: sigla nas cores do clube (opcionalmente com o ano, para elencos históricos).
export function Distintivo({ sigla, cores = ['#13241b', '#e8f5ec'], ano, tamanho = 40 }) {
  const [fundo, letra] = cores;
  return (
    <span
      className="distintivo"
      style={{ width: tamanho, height: tamanho * 1.08, background: fundo, color: letra, fontSize: tamanho * 0.3 }}
      aria-label={ano ? `${sigla} ${ano}` : sigla}
    >
      {sigla}
      {ano && <small>{ano}</small>}
    </span>
  );
}

export function clubeVisual(dados, id) {
  const c = dados.clubes.find((x) => x.id === id) ?? dados.estrangeiros.find((x) => x.id === id);
  return c ? { sigla: c.sigla, cores: c.cores, nome: c.nome } : { sigla: '?', cores: undefined, nome: id };
}

export function DistintivoClube({ dados, id, tamanho }) {
  const v = clubeVisual(dados, id);
  return <Distintivo sigla={v.sigla} cores={v.cores} tamanho={tamanho} />;
}
