import { criarTabela, registrarResultado, ordenarTabela, gerarRodadas } from './liga.js';
import { decidirIdaVolta, decidirJogoUnico, emparelhar, sortearChave } from './mataMata.js';
import { sortearGrupos, classificadosDoGrupo, cruzarOitavas } from './grupos.js';

// Uma competição é uma lista de "etapas"; cada etapa ocupa uma data do calendário.
// Etapa de rodada: { tipo: 'rodada', n }  (todas as tabelas jogam a rodada n)
// Etapa de mata-mata: { tipo: 'fase', fase, perna: 'ida' | 'volta' | 'unico' }
// Fase: { nome, idaEVolta, neutro, prorrogacao, sorteio: 'chave' | 'ordem', pares, idas, vencedores }

export const NOMES = {
  estadual: 'Estadual',
  brasileirao: 'Brasileirão',
  copaDoBrasil: 'Copa do Brasil',
  libertadores: 'Libertadores',
  sulamericana: 'Sul-Americana',
};

function fase(nome, { idaEVolta = true, neutro = false, prorrogacao = false, sorteio = 'ordem' } = {}) {
  return { nome, idaEVolta, neutro, prorrogacao, sorteio, pares: null, idas: [], vencedores: [] };
}

function etapasDasFases(fases) {
  return fases.flatMap((f, i) =>
    f.idaEVolta
      ? [{ tipo: 'fase', fase: i, perna: 'ida' }, { tipo: 'fase', fase: i, perna: 'volta' }]
      : [{ tipo: 'fase', fase: i, perna: 'unico' }]);
}

function base(id, participantes) {
  return { id, nome: NOMES[id], participantes, tabelas: {}, rodadas: {}, fases: [], etapas: [], proxima: 0, campeao: null, vice: null };
}

// 20 clubes, ida e volta.
export function criarBrasileirao(ids) {
  const c = base('brasileirao', ids);
  c.tabelas.geral = criarTabela(ids);
  c.rodadas.geral = gerarRodadas(ids, { idaEVolta: true });
  c.etapas = c.rodadas.geral.map((_, n) => ({ tipo: 'rodada', n }));
  return c;
}

// 12 clubes em turno único; 4 primeiros: semifinal em jogo único (1º x 4º, 2º x 3º, sem prorrogação); final ida e volta.
export function criarEstadual(ids) {
  const c = base('estadual', ids);
  c.tabelas.geral = criarTabela(ids);
  c.rodadas.geral = gerarRodadas(ids);
  c.fases = [fase('Semifinal', { idaEVolta: false }), fase('Final')];
  c.etapas = [...c.rodadas.geral.map((_, n) => ({ tipo: 'rodada', n })), ...etapasDasFases(c.fases)];
  return c;
}

// 32 clubes, mata-mata ida e volta, novo sorteio a cada fase.
export function criarCopaDoBrasil(ids, rng) {
  const c = base('copaDoBrasil', ids);
  c.fases = ['16 avos', 'Oitavas', 'Quartas', 'Semifinal', 'Final'].map((n) => fase(n, { sorteio: 'chave' }));
  c.fases[0].pares = sortearChave(ids, rng);
  c.etapas = etapasDasFases(c.fases);
  return c;
}

// 32 clubes do mais forte ao mais fraco: 8 grupos de 4 (ida e volta), 2 primeiros avançam;
// oitavas, quartas e semi em ida e volta; final em jogo único, campo neutro, com prorrogação.
export function criarContinental(id, idsPorForca, rng) {
  const c = base(id, idsPorForca);
  const grupos = sortearGrupos(idsPorForca, rng, 8);
  grupos.forEach((g, i) => {
    const chave = String.fromCharCode(65 + i);
    c.tabelas[chave] = criarTabela(g);
    c.rodadas[chave] = gerarRodadas(g, { idaEVolta: true });
  });
  c.fases = [fase('Oitavas'), fase('Quartas'), fase('Semifinal'),
    fase('Final', { idaEVolta: false, neutro: true, prorrogacao: true })];
  c.etapas = [...c.rodadas.A.map((_, n) => ({ tipo: 'rodada', n })), ...etapasDasFases(c.fases)];
  return c;
}

export function terminou(comp) {
  return comp.proxima >= comp.etapas.length;
}

// Jogos da próxima etapa: [{ casa, fora, neutro, prorrogacao, mataMata }]
export function jogosDaEtapa(comp) {
  if (terminou(comp)) return [];
  const etapa = comp.etapas[comp.proxima];
  if (etapa.tipo === 'rodada') {
    return Object.keys(comp.rodadas).flatMap((k) =>
      comp.rodadas[k][etapa.n].map((j) => ({ ...j, neutro: false, prorrogacao: false, mataMata: false })));
  }
  const f = comp.fases[etapa.fase];
  const extra = { neutro: f.neutro, prorrogacao: etapa.perna === 'unico' && f.prorrogacao, mataMata: true };
  if (etapa.perna === 'volta') return f.pares.map(([a, b]) => ({ casa: b, fora: a, ...extra }));
  return f.pares.map(([a, b]) => ({ casa: a, fora: b, ...extra }));
}

function montarPrimeiraFase(comp) {
  if (comp.id === 'estadual') {
    const t = ordenarTabela(comp.tabelas.geral).map((l) => l.id);
    comp.fases[0].pares = [[t[0], t[3]], [t[1], t[2]]];
  } else {
    const chaves = Object.keys(comp.tabelas).sort();
    comp.fases[0].pares = cruzarOitavas(chaves.map((k) => classificadosDoGrupo(comp.tabelas[k])));
  }
}

function fecharFase(comp, i, rng) {
  const f = comp.fases[i];
  const prox = comp.fases[i + 1];
  if (!prox) {
    comp.campeao = f.vencedores[0];
    const [a, b] = f.pares[0];
    comp.vice = comp.campeao === a ? b : a;
    return;
  }
  prox.pares = prox.sorteio === 'chave' ? sortearChave(f.vencedores, rng) : emparelhar(f.vencedores);
}

// resultados: [{ casa, fora, golsCasa, golsFora }] na mesma ordem de jogosDaEtapa.
// penaltis(casaId, foraId) -> id do vencedor; chamado só quando o confronto precisa de pênaltis.
export function registrarEtapa(compAnterior, resultados, { penaltis, rng }) {
  const comp = structuredClone(compAnterior);
  const etapa = comp.etapas[comp.proxima];
  if (etapa.tipo === 'rodada') {
    for (const r of resultados) {
      const chave = Object.keys(comp.tabelas).find((k) => comp.tabelas[k].some((l) => l.id === r.casa));
      comp.tabelas[chave] = registrarResultado(comp.tabelas[chave], r);
    }
    const proxima = comp.etapas[comp.proxima + 1];
    if (!proxima) {
      const ordem = ordenarTabela(comp.tabelas.geral);
      comp.campeao = ordem[0].id;
      comp.vice = ordem[1].id;
    } else if (proxima.tipo === 'fase') {
      montarPrimeiraFase(comp);
    }
  } else {
    const f = comp.fases[etapa.fase];
    if (etapa.perna === 'ida') {
      f.idas = resultados;
    } else {
      f.vencedores = resultados.map((r, i) => {
        const d = etapa.perna === 'volta' ? decidirIdaVolta(f.idas[i], r) : decidirJogoUnico(r);
        return d.precisaPenaltis ? penaltis(r.casa, r.fora) : d.vencedor;
      });
      fecharFase(comp, etapa.fase, rng);
    }
  }
  comp.proxima += 1;
  return comp;
}

// Até onde o clube chegou: 'campeão', 'vice', nome da fase em que caiu, ou posição na tabela.
export function campanha(comp, clubeId) {
  if (!comp.participantes.includes(clubeId)) return null;
  if (comp.campeao === clubeId) return 'Campeão';
  if (comp.vice === clubeId) return 'Vice';
  for (let i = comp.fases.length - 1; i >= 0; i--) {
    if (comp.fases[i].pares?.some((p) => p.includes(clubeId))) return comp.fases[i].nome;
  }
  const chave = Object.keys(comp.tabelas).find((k) => comp.tabelas[k].some((l) => l.id === clubeId));
  if (chave === undefined) return null;
  const pos = ordenarTabela(comp.tabelas[chave]).findIndex((l) => l.id === clubeId) + 1;
  return comp.fases.length && chave !== 'geral' ? `Fase de grupos (${pos}º)` : `${pos}º lugar`;
}
