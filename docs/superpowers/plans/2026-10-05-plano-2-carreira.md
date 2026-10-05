# Carreira FC — Plano 2: Regras da temporada e da carreira

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a carreira inteira funcionar no motor, sem tela: competições rodando etapa a etapa, calendário da temporada, classificação, envelhecimento, roletas, escalação com lesões/suspensões, e o objeto `carreira` (draft → temporadas → janelas de transferência → fim), testado com uma base de dados falsa.

**Architecture:** Novos módulos em `src/engine/`, todos puros (recebem dados, devolvem dados novos, aleatoriedade só via `rng`). `carreira.js` orquestra os demais e guarda o estado do `rng` dentro da própria carreira, então a carreira é um objeto JSON que dá para salvar e retomar. Os dados reais (clubes, elencos) chegam no Plano 3; aqui os testes usam `tests/fixtures/dados.js`, com o mesmo formato.

**Tech Stack:** Node 24, JavaScript (ES modules), Vitest 3. Usa o motor do Plano 1 (`rng`, `posicoes`, `forca`, `partida`, `penaltis`, `liga`, `mataMata`, `grupos`).

**Spec:** `docs/superpowers/specs/2026-10-05-carreira-fc-design.md` (seções 3, 5, 6, 7 e 8).

Planos seguintes: **3** — dados reais (40 elencos, 20 clubes da Série A, 8 estaduais, 56 estrangeiros); **4** — telas React; **5** — fim de temporada/carreira na tela, save/export/import e deploy.

## Global Constraints

- Rodar tudo em `C:\Users\User\Desktop\carreira-fc`, num branch `plano-2-carreira` criado a partir do `main`.
- Código, nomes e mensagens de erro em **português**; imports relativos com `.js`; JSON importado sem atributo (`import x from '../data/x.json'`).
- Funções do engine nunca mutam os argumentos; a carreira inteira precisa sobreviver a `JSON.parse(JSON.stringify(c))`.
- Elenco do usuário: **15 jogadores** (11 titulares + 4 reservas); **3 curingas** no draft; elenco sorteado não se repete no mesmo draft.
- Estadual: 12 clubes, turno único, semifinal em jogo único (1º×4º, 2º×3º, pênaltis direto), final ida e volta.
- Brasileirão: 20 clubes, 38 rodadas. Copa do Brasil (temporada 2+): 32 clubes, ida e volta, sorteio a cada fase. Libertadores/Sul-Americana (temporada 2+): 32 clubes, 8 grupos, oitavas/quartas/semi ida e volta, final única neutra com prorrogação.
- Classificação: G4 + campeões brasileiros de copa → Libertadores; os 6 seguintes da tabela → Sul-Americana.
- Roletas: campeão 3 boas · 2º–4º 2 · 5º–10º 1 · 17º–20º 3 ruins obrigatórias · +1 boa por Copa do Brasil/Libertadores/Sul-Americana · +1 média pelo estadual · 1 reposição obrigatória por aposentado. Média ≤ 85, ruim ≤ 68.
- Envelhecimento: ≤23 +3 · 24–27 +1 · 28–31 0 · 32–33 −2 · ≥34 −4; overall 40–99; aposenta 40% aos 35–36, sempre aos 37.
- Notas dos clubes do computador oscilam ±3 por temporada (limitadas a 50–90).
- Jogo importante: mata-mata, clássico, últimas 5 rodadas do Brasileirão.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Elenco chega à janela com menos de 15** (aposentadorias) — reposição entra sem ninguém sair; com elenco cheio, aceitar exige quem sai. Testado na Task 6 ("elenco incompleto: entra sem ninguém sair…").
2. **Tantos lesionados/suspensos que não fecham 11** — o time joga com quem tem e conta desfalques, sem quebrar. Testado na Task 5 ("menos de 11 disponíveis").
3. **Partida ao vivo que não bate com o jogo da data** (outro adversário, mando invertido ou 2º tempo não jogado) — `jogarData` precisa recusar com erro, não gravar placar errado. Testado na Task 6 ("rejeita partida de outro jogo ou não terminada").
4. **Carreira salva e recarregada no meio da temporada** — o estado é JSON puro e a mesma semente gera a mesma carreira. Testado na Task 6 ("mesma semente, mesma carreira; e o estado sobrevive a JSON").
5. **Ex-jogador voltando pela roleta** (vendido ou aposentado reaparecendo) — nunca pode ser oferecido de novo. Testado na Task 6 ("roleta nunca oferece quem já está no elenco ou já saiu").

---

### Task 1: Competições rodando etapa a etapa

**Files:**
- Create: `src/engine/competicoes.js`
- Test: `tests/engine/competicoes.test.js`

**Interfaces:**
- Consumes: `criarTabela`, `registrarResultado`, `ordenarTabela`, `gerarRodadas` (liga.js); `decidirIdaVolta`, `decidirJogoUnico`, `emparelhar`, `sortearChave` (mataMata.js); `sortearGrupos`, `classificadosDoGrupo`, `cruzarOitavas` (grupos.js); `criarRng` (testes).
- Produces:
  - `NOMES: { estadual, brasileirao, copaDoBrasil, libertadores, sulamericana }`.
  - Competição (objeto JSON): `{ id, nome, participantes, tabelas: { [chave]: tabela }, rodadas: { [chave]: [[{ casa, fora }]] }, fases: [{ nome, idaEVolta, neutro, prorrogacao, sorteio, pares, idas, vencedores }], etapas: [{ tipo: 'rodada', n } | { tipo: 'fase', fase, perna: 'ida' | 'volta' | 'unico' }], proxima, campeao, vice }`.
  - `criarBrasileirao(ids)`, `criarEstadual(ids)`, `criarCopaDoBrasil(ids, rng)`, `criarContinental(id, idsPorForca, rng)` — 38, 14, 10 e 13 etapas.
  - `terminou(comp) → boolean`.
  - `jogosDaEtapa(comp) → [{ casa, fora, neutro, prorrogacao, mataMata }]`.
  - `registrarEtapa(comp, resultados: [{ casa, fora, golsCasa, golsFora }], { penaltis: (casaId, foraId) → idVencedor, rng }) → comp`.
  - `campanha(comp, clubeId) → 'Campeão' | 'Vice' | nomeDaFase | 'Fase de grupos (Nº)' | 'Nº lugar' | null`.

- [ ] **Step 1: Criar o branch**

Run: `git checkout -b plano-2-carreira`
Expected: `Switched to a new branch 'plano-2-carreira'`

- [ ] **Step 2: Escrever o teste que falha**

`tests/engine/competicoes.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import {
  criarBrasileirao, criarEstadual, criarCopaDoBrasil, criarContinental,
  jogosDaEtapa, registrarEtapa, terminou, campanha,
} from '../../src/engine/competicoes.js';

const ids = (n, p = 't') => Array.from({ length: n }, (_, i) => `${p}${String(i).padStart(2, '0')}`);

// Joga a competição inteira com placares aleatórios; o mandante de índice menor nunca é favorecido.
function jogarTudo(comp, rng, { placar } = {}) {
  let c = comp;
  let datas = 0;
  while (!terminou(c)) {
    const jogos = jogosDaEtapa(c);
    const resultados = jogos.map((j) => ({
      casa: j.casa, fora: j.fora,
      ...(placar ? placar(j) : { golsCasa: rng.int(0, 3), golsFora: rng.int(0, 3) }),
    }));
    c = registrarEtapa(c, resultados, { penaltis: (a, b) => (rng.chance(0.5) ? a : b), rng });
    datas++;
  }
  return { c, datas };
}

describe('Brasileirão', () => {
  it('38 datas de 10 jogos e campeão = líder da tabela', () => {
    const rng = criarRng(1);
    const comp = criarBrasileirao(ids(20));
    expect(comp.etapas).toHaveLength(38);
    expect(jogosDaEtapa(comp)).toHaveLength(10);
    const { c, datas } = jogarTudo(comp, rng);
    expect(datas).toBe(38);
    expect(c.tabelas.geral.every((l) => l.j === 38)).toBe(true);
    expect(campanha(c, c.campeao)).toBe('Campeão');
    expect(campanha(c, c.vice)).toBe('Vice');
  });
});

describe('Estadual', () => {
  it('11 rodadas + semi única + final ida e volta = 14 datas', () => {
    const rng = criarRng(2);
    const comp = criarEstadual(ids(12));
    expect(comp.etapas).toHaveLength(14);
    const { c } = jogarTudo(comp, rng);
    expect(c.campeao).not.toBeNull();
    expect(c.fases[0].pares).toHaveLength(2);
    expect(c.fases[1].pares[0]).toContain(c.campeao);
  });

  it('semifinal é 1º x 4º e 2º x 3º, com o melhor em casa', () => {
    const rng = criarRng(3);
    // t00 sempre vence, t01 vence todos menos t00, etc.: a tabela fica na ordem dos ids
    let c = criarEstadual(ids(12));
    for (let n = 0; n < 11; n++) {
      const res = jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: j.casa < j.fora ? 1 : 0, golsFora: j.casa < j.fora ? 0 : 1 }));
      c = registrarEtapa(c, res, { penaltis: () => null, rng });
    }
    expect(c.fases[0].pares).toEqual([['t00', 't03'], ['t01', 't02']]);
    expect(jogosDaEtapa(c)[0]).toMatchObject({ casa: 't00', fora: 't03', prorrogacao: false, mataMata: true });
  });

  it('empate na semifinal vai para os pênaltis', () => {
    const rng = criarRng(4);
    let c = criarEstadual(ids(12));
    for (let n = 0; n < 11; n++) {
      c = registrarEtapa(c, jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 0, golsFora: 0 })), { penaltis: () => null, rng });
    }
    const chamados = [];
    c = registrarEtapa(c, jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 1, golsFora: 1 })), {
      penaltis: (a, b) => { chamados.push([a, b]); return b; }, rng,
    });
    expect(chamados).toHaveLength(2);
    expect(c.fases[0].vencedores).toEqual(chamados.map(([, b]) => b));
  });
});

describe('Copa do Brasil', () => {
  it('5 fases ida e volta = 10 datas; 16, 8, 4, 2, 1 jogos por data', () => {
    const rng = criarRng(5);
    let c = criarCopaDoBrasil(ids(32), rng);
    expect(c.etapas).toHaveLength(10);
    const porData = [];
    while (!terminou(c)) {
      const jogos = jogosDaEtapa(c);
      porData.push(jogos.length);
      c = registrarEtapa(c, jogos.map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: rng.int(0, 2), golsFora: rng.int(0, 2) })),
        { penaltis: (a) => a, rng });
    }
    expect(porData).toEqual([16, 16, 8, 8, 4, 4, 2, 2, 1, 1]);
    expect(ids(32)).toContain(c.campeao);
  });

  it('a volta inverte o mando da ida', () => {
    const rng = criarRng(6);
    let c = criarCopaDoBrasil(ids(32), rng);
    const ida = jogosDaEtapa(c);
    c = registrarEtapa(c, ida.map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 0, golsFora: 0 })), { penaltis: (a) => a, rng });
    const volta = jogosDaEtapa(c);
    volta.forEach((j, i) => expect([j.casa, j.fora]).toEqual([ida[i].fora, ida[i].casa]));
  });

  it('vencedor pelo agregado sem pênaltis quando não empata', () => {
    const rng = criarRng(7);
    let c = criarCopaDoBrasil(ids(32), rng);
    const ida = jogosDaEtapa(c);
    c = registrarEtapa(c, ida.map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 2, golsFora: 0 })), { penaltis: () => { throw new Error('não devia'); }, rng });
    c = registrarEtapa(c, jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 1, golsFora: 0 })), { penaltis: () => { throw new Error('não devia'); }, rng });
    expect(c.fases[0].vencedores).toEqual(ida.map((j) => j.casa));
  });
});

describe('Libertadores / Sul-Americana', () => {
  it('6 rodadas de grupo + 3 fases ida e volta + final única = 13 datas', () => {
    const rng = criarRng(8);
    const comp = criarContinental('libertadores', ids(32), rng);
    expect(comp.etapas).toHaveLength(13);
    expect(jogosDaEtapa(comp)).toHaveLength(16);
    const { c } = jogarTudo(comp, rng);
    expect(c.campeao).not.toBeNull();
    expect(c.fases[0].pares).toHaveLength(8);
  });

  it('final é jogo único, neutro, com prorrogação', () => {
    const rng = criarRng(9);
    let c = criarContinental('sulamericana', ids(32), rng);
    while (c.proxima < c.etapas.length - 1) {
      c = registrarEtapa(c, jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: rng.int(0, 2), golsFora: rng.int(0, 2) })),
        { penaltis: (a) => a, rng });
    }
    const [final] = jogosDaEtapa(c);
    expect(final).toMatchObject({ neutro: true, prorrogacao: true, mataMata: true });
  });

  it('oitavas cruzam 1º de um grupo com 2º do vizinho', () => {
    const rng = criarRng(10);
    let c = criarContinental('libertadores', ids(32), rng);
    for (let n = 0; n < 6; n++) {
      c = registrarEtapa(c, jogosDaEtapa(c).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: j.casa < j.fora ? 2 : 0, golsFora: 0 })),
        { penaltis: (a) => a, rng });
    }
    const primeiroA = [...c.tabelas.A].sort((a, b) => b.pts - a.pts)[0].id;
    const par = c.fases[0].pares.find((p) => p.includes(primeiroA));
    expect(par[1]).toBe(primeiroA); // 1º decide em casa (fica como segundo do par)
    expect(c.tabelas.B.some((l) => l.id === par[0])).toBe(true);
  });
});

describe('campanha', () => {
  it('nome da fase em que o clube caiu, ou posição', () => {
    const rng = criarRng(11);
    const { c } = jogarTudo(criarCopaDoBrasil(ids(32), rng), rng);
    const caiuNos16 = ids(32).find((id) => !c.fases[1].pares.flat().includes(id));
    expect(campanha(c, caiuNos16)).toBe('16 avos');
    expect(campanha(c, 'nao-participa')).toBeNull();
    const { c: e } = jogarTudo(criarEstadual(ids(12)), rng);
    const ultimo = ids(12).find((id) => !e.fases[0].pares.flat().includes(id));
    expect(campanha(e, ultimo)).toMatch(/º lugar$/);
  });

  it('não altera a competição recebida', () => {
    const rng = criarRng(12);
    const comp = criarBrasileirao(ids(20));
    const copia = structuredClone(comp);
    registrarEtapa(comp, jogosDaEtapa(comp).map((j) => ({ casa: j.casa, fora: j.fora, golsCasa: 1, golsFora: 0 })), { penaltis: (a) => a, rng });
    expect(comp).toEqual(copia);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/engine/competicoes.test.js`
Expected: FAIL — `Cannot find module '../../src/engine/competicoes.js'`.

- [ ] **Step 4: Implementar**

`src/engine/competicoes.js`:
```js
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
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/engine/competicoes.test.js`
Expected: PASS (12 testes).

- [ ] **Step 6: Commit**

```bash
git add src/engine/competicoes.js tests/engine/competicoes.test.js
git commit -m "feat(engine): competições (estadual, Brasileirão, Copa do Brasil, continentais)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Calendário da temporada

**Files:**
- Create: `src/engine/calendario.js`
- Test: `tests/engine/calendario.test.js`

**Interfaces:**
- Consumes: `criarBrasileirao`, `criarEstadual`, `criarCopaDoBrasil`, `criarContinental` (Task 1, só nos testes), `criarRng`.
- Produces:
  - `RODADAS_COPA: number[10]`, `RODADAS_CONTINENTAL: number[13]` — depois de qual rodada do Brasileirão entra cada etapa.
  - `montarCalendario({ estadual, brasileirao, copaDoBrasil?, libertadores?, sulamericana? }) → [{ tipo: 'estadual' | 'brasileirao' | 'copaDoBrasil' | 'continental', comps: compId[] }]` — cada data roda a **próxima** etapa de cada competição listada. Temporada 1: 52 datas; completa: 75.

- [ ] **Step 1: Escrever o teste que falha**

`tests/engine/calendario.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { criarBrasileirao, criarEstadual, criarCopaDoBrasil, criarContinental } from '../../src/engine/competicoes.js';
import { montarCalendario, RODADAS_COPA, RODADAS_CONTINENTAL } from '../../src/engine/calendario.js';

const ids = (n, p) => Array.from({ length: n }, (_, i) => `${p}${i}`);

function completas() {
  const rng = criarRng(1);
  return {
    estadual: criarEstadual(ids(12, 'e')),
    brasileirao: criarBrasileirao(ids(20, 'b')),
    copaDoBrasil: criarCopaDoBrasil(ids(32, 'c'), rng),
    libertadores: criarContinental('libertadores', ids(32, 'l'), rng),
    sulamericana: criarContinental('sulamericana', ids(32, 's'), rng),
  };
}

const vezes = (datas, id) => datas.filter((d) => d.comps.includes(id)).length;

describe('montarCalendario', () => {
  it('cada competição aparece exatamente o número de etapas que tem', () => {
    const comps = completas();
    const datas = montarCalendario(comps);
    for (const [id, c] of Object.entries(comps)) expect(vezes(datas, id)).toBe(c.etapas.length);
    expect(datas).toHaveLength(14 + 38 + 10 + 13);
  });

  it('estadual vem primeiro, depois o Brasileirão começa', () => {
    const datas = montarCalendario(completas());
    expect(datas.slice(0, 14).every((d) => d.tipo === 'estadual')).toBe(true);
    expect(datas[14].tipo).toBe('brasileirao');
    expect(datas.at(-1).tipo).toBe('brasileirao');
  });

  it('Libertadores e Sul-Americana dividem a mesma data', () => {
    const datas = montarCalendario(completas());
    const cont = datas.filter((d) => d.tipo === 'continental');
    expect(cont).toHaveLength(13);
    expect(cont.every((d) => d.comps.length === 2)).toBe(true);
  });

  it('temporada 1: só estadual e Brasileirão', () => {
    const { estadual, brasileirao } = completas();
    const datas = montarCalendario({ estadual, brasileirao });
    expect(datas).toHaveLength(52);
  });

  it('as tabelas de datas têm o tamanho das competições', () => {
    expect(RODADAS_COPA).toHaveLength(10);
    expect(RODADAS_CONTINENTAL).toHaveLength(13);
    expect(Math.max(...RODADAS_COPA, ...RODADAS_CONTINENTAL)).toBeLessThan(38);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/calendario.test.js`
Expected: FAIL — `Cannot find module '../../src/engine/calendario.js'`.

- [ ] **Step 3: Implementar**

`src/engine/calendario.js`:
```js
// Datas de meio de semana: depois de qual rodada do Brasileirão entra cada etapa das copas.
export const RODADAS_COPA = [3, 5, 10, 12, 17, 19, 24, 26, 31, 33];
export const RODADAS_CONTINENTAL = [2, 4, 6, 8, 11, 13, 15, 18, 21, 23, 27, 29, 35];

// competicoes: { estadual, brasileirao, copaDoBrasil?, libertadores?, sulamericana? }
// Retorna [{ tipo, comps: [compId] }]: cada data roda a próxima etapa de cada competição listada.
export function montarCalendario(competicoes) {
  const datas = [];
  const { estadual, brasileirao, copaDoBrasil } = competicoes;
  const continentais = ['libertadores', 'sulamericana'].filter((id) => competicoes[id]);
  if (estadual) for (let i = 0; i < estadual.etapas.length; i++) datas.push({ tipo: 'estadual', comps: ['estadual'] });
  for (let r = 1; r <= brasileirao.etapas.length; r++) {
    datas.push({ tipo: 'brasileirao', comps: ['brasileirao'] });
    if (copaDoBrasil && RODADAS_COPA.includes(r)) datas.push({ tipo: 'copaDoBrasil', comps: ['copaDoBrasil'] });
    if (continentais.length && RODADAS_CONTINENTAL.includes(r)) datas.push({ tipo: 'continental', comps: continentais });
  }
  return datas;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/engine/calendario.test.js`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/calendario.js tests/engine/calendario.test.js
git commit -m "feat(engine): calendário da temporada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Classificação e envelhecimento

**Files:**
- Create: `src/engine/classificacao.js`
- Create: `src/engine/envelhecimento.js`
- Test: `tests/engine/classificacao.test.js`
- Test: `tests/engine/envelhecimento.test.js`

**Interfaces:**
- Consumes: `criarRng` (testes).
- Produces:
  - `vagasContinentais(ordemBrasileirao: id[20], { copaDoBrasil?, libertadores?, sulamericana? }) → { libertadores: id[], sulamericana: id[6] }`.
  - `roletasDoFimDeTemporada(posicao: 1..20, titulos: compId[]) → [{ tipo: 'boa' | 'media' | 'ruim', obrigatoria }]` — ruins primeiro.
  - `OVR_MIN = 40`, `OVR_MAX = 99`, `deltaOvr(idade)`, `chanceAposentar(idade)`.
  - `envelhecer(jogadores: [{ ovr, idade, ... }], rng) → { jogadores, aposentados }`.

- [ ] **Step 1: Escrever os testes que falham**

`tests/engine/classificacao.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { vagasContinentais, roletasDoFimDeTemporada } from '../../src/engine/classificacao.js';

const ordem = Array.from({ length: 20 }, (_, i) => `c${i + 1}`); // c1 = 1º lugar

describe('vagasContinentais', () => {
  it('G4 na Libertadores, 5º ao 10º na Sul-Americana', () => {
    const v = vagasContinentais(ordem);
    expect(v.libertadores).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(v.sulamericana).toEqual(['c5', 'c6', 'c7', 'c8', 'c9', 'c10']);
  });

  it('campeão da Copa do Brasil fora do G4 vai à Libertadores e a vaga da Sul-Americana desce', () => {
    const v = vagasContinentais(ordem, { copaDoBrasil: 'c7' });
    expect(v.libertadores).toEqual(['c1', 'c2', 'c3', 'c4', 'c7']);
    expect(v.sulamericana).toEqual(['c5', 'c6', 'c8', 'c9', 'c10', 'c11']);
  });

  it('campeão de copa que ficou mal no Brasileirão também vai', () => {
    const v = vagasContinentais(ordem, { libertadores: 'c18', sulamericana: 'c15' });
    expect(v.libertadores).toEqual(['c1', 'c2', 'c3', 'c4', 'c18', 'c15']);
    expect(v.sulamericana).toEqual(['c5', 'c6', 'c7', 'c8', 'c9', 'c10']);
  });

  it('campeão que já está no G4 não ocupa vaga extra; estrangeiro campeão é ignorado', () => {
    const v = vagasContinentais(ordem, { copaDoBrasil: 'c2', libertadores: 'boca' });
    expect(v.libertadores).toEqual(['c1', 'c2', 'c3', 'c4']);
  });
});

describe('roletasDoFimDeTemporada', () => {
  const tipos = (fila) => fila.map((r) => `${r.tipo}${r.obrigatoria ? '!' : ''}`);

  it.each([
    [1, ['boa', 'boa', 'boa']],
    [3, ['boa', 'boa']],
    [5, ['boa']],
    [10, ['boa']],
    [11, []],
    [16, []],
    [17, ['ruim!', 'ruim!', 'ruim!']],
    [20, ['ruim!', 'ruim!', 'ruim!']],
  ])('%iº lugar', (pos, esperado) => {
    expect(tipos(roletasDoFimDeTemporada(pos))).toEqual(esperado);
  });

  it('+1 boa por título de copa e +1 média pelo estadual', () => {
    expect(tipos(roletasDoFimDeTemporada(3, ['copaDoBrasil']))).toEqual(['boa', 'boa', 'boa']);
    expect(tipos(roletasDoFimDeTemporada(1, ['brasileirao', 'libertadores', 'estadual']))).toEqual(['boa', 'boa', 'boa', 'boa', 'media']);
  });

  it('rebaixado que ganha copa leva as ruins e a boa', () => {
    expect(tipos(roletasDoFimDeTemporada(18, ['copaDoBrasil']))).toEqual(['ruim!', 'ruim!', 'ruim!', 'boa']);
  });
});
```

`tests/engine/envelhecimento.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { deltaOvr, chanceAposentar, envelhecer } from '../../src/engine/envelhecimento.js';

describe('deltaOvr', () => {
  it.each([[19, 3], [23, 3], [24, 1], [27, 1], [28, 0], [31, 0], [32, -2], [33, -2], [34, -4], [38, -4]])(
    '%i anos: %i', (idade, d) => expect(deltaOvr(idade)).toBe(d));
});

describe('chanceAposentar', () => {
  it('ninguém antes dos 35, 40% dos 35 aos 36, obrigatório aos 37', () => {
    expect(chanceAposentar(34)).toBe(0);
    expect(chanceAposentar(35)).toBe(0.4);
    expect(chanceAposentar(36)).toBe(0.4);
    expect(chanceAposentar(37)).toBe(1);
  });
});

describe('envelhecer', () => {
  it('soma 1 ano, aplica o delta e limita entre 40 e 99', () => {
    const { jogadores } = envelhecer([
      { id: 'a', ovr: 98, idade: 20 },
      { id: 'b', ovr: 80, idade: 30 },
      { id: 'c', ovr: 41, idade: 33 },
    ], criarRng(1));
    expect(jogadores).toEqual([
      { id: 'a', ovr: 99, idade: 21 },
      { id: 'b', ovr: 80, idade: 31 },
      { id: 'c', ovr: 40, idade: 34 },
    ]);
  });

  it('aos 37 sempre se aposenta', () => {
    const r = envelhecer([{ id: 'v', ovr: 80, idade: 36 }], criarRng(2));
    expect(r.jogadores).toEqual([]);
    expect(r.aposentados).toEqual([{ id: 'v', ovr: 76, idade: 37 }]);
  });

  it('aos 35 se aposenta perto de 40% das vezes', () => {
    const rng = criarRng(3);
    let n = 0;
    for (let i = 0; i < 5000; i++) n += envelhecer([{ id: 'x', ovr: 80, idade: 34 }], rng).aposentados.length;
    expect(n / 5000).toBeGreaterThan(0.36);
    expect(n / 5000).toBeLessThan(0.44);
  });

  it('não altera a lista recebida', () => {
    const lista = [{ id: 'a', ovr: 80, idade: 25 }];
    envelhecer(lista, criarRng(4));
    expect(lista).toEqual([{ id: 'a', ovr: 80, idade: 25 }]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/classificacao.test.js tests/engine/envelhecimento.test.js`
Expected: FAIL — `Cannot find module` para `classificacao.js` e `envelhecimento.js`.

- [ ] **Step 3: Implementar a classificação**

`src/engine/classificacao.js`:
```js
// Regras de classificação (spec 5.5) e roletas de fim de temporada (spec 6.2).

// ordemBrasileirao: ids do 1º ao 20º. campeoes: { copaDoBrasil, libertadores, sulamericana } (ids ou null).
// Libertadores: G4 + campeões de copa que sejam brasileiros. Sul-Americana: os 6 seguintes da tabela
// que não foram para a Libertadores (as vagas "descem").
export function vagasContinentais(ordemBrasileirao, campeoes = {}) {
  const brasileiros = new Set(ordemBrasileirao);
  const extras = [campeoes.libertadores, campeoes.sulamericana, campeoes.copaDoBrasil].filter((id) => brasileiros.has(id));
  const libertadores = [...new Set([...ordemBrasileirao.slice(0, 4), ...extras])];
  const sulamericana = ordemBrasileirao.filter((id) => !libertadores.includes(id)).slice(0, 6);
  return { libertadores, sulamericana };
}

// posicao: 1..20 no Brasileirão. titulos: ids das competições ganhas na temporada.
export function roletasDoFimDeTemporada(posicao, titulos = []) {
  const fila = [];
  const add = (tipo, n, obrigatoria = false) => { for (let i = 0; i < n; i++) fila.push({ tipo, obrigatoria }); };
  if (posicao >= 17) add('ruim', 3, true);
  if (posicao === 1) add('boa', 3);
  else if (posicao <= 4) add('boa', 2);
  else if (posicao <= 10) add('boa', 1);
  add('boa', titulos.filter((t) => ['copaDoBrasil', 'libertadores', 'sulamericana'].includes(t)).length);
  if (titulos.includes('estadual')) add('media', 1);
  return fila;
}
```

- [ ] **Step 4: Implementar o envelhecimento**

`src/engine/envelhecimento.js`:
```js
// Envelhecimento e aposentadoria (spec 6.1). Usa a idade depois do aniversário.

export const OVR_MIN = 40;
export const OVR_MAX = 99;

export function deltaOvr(idade) {
  if (idade <= 23) return 3;
  if (idade <= 27) return 1;
  if (idade <= 31) return 0;
  if (idade <= 33) return -2;
  return -4;
}

export function chanceAposentar(idade) {
  if (idade >= 37) return 1;
  if (idade >= 35) return 0.4;
  return 0;
}

// jogadores: [{ id, ovr, idade, ... }] -> { jogadores (os que seguem), aposentados }
export function envelhecer(jogadores, rng) {
  const seguem = [];
  const aposentados = [];
  for (const j of jogadores) {
    const idade = j.idade + 1;
    const ovr = Math.max(OVR_MIN, Math.min(OVR_MAX, j.ovr + deltaOvr(idade)));
    const novo = { ...j, idade, ovr };
    const p = chanceAposentar(idade);
    if (p > 0 && rng.chance(p)) aposentados.push(novo);
    else seguem.push(novo);
  }
  return { jogadores: seguem, aposentados };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/engine/classificacao.test.js tests/engine/envelhecimento.test.js`
Expected: PASS (14 + 15 testes).

- [ ] **Step 6: Commit**

```bash
git add src/engine/classificacao.js src/engine/envelhecimento.js tests/engine/classificacao.test.js tests/engine/envelhecimento.test.js
git commit -m "feat(engine): classificação continental, roletas de fim de temporada e envelhecimento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Roleta de elencos

**Files:**
- Create: `src/engine/roleta.js`
- Test: `tests/engine/roleta.test.js`

**Interfaces:**
- Consumes: `criarRng` (testes).
- Produces:
  - `LIMITE_OVR = { boa: 99, media: 85, ruim: 68 }`.
  - `idJogador(elencoId, indice) → 'elencoId:indice'`.
  - `jogadorDaBase(elenco, indice) → { id, nome, pos, ovr, idade, origem: 'Clube Ano' }`.
  - `girarRoleta(elencos, rng, { tipo?, excluirElencos?, excluirJogadores? }) → { elencoId, opcoes: jogador[] } | null` — só para em elenco com pelo menos uma opção válida.
  - Elenco da base (formato do Plano 3): `{ id, clube, sigla, ano, cores, jogadores: [{ nome, pos, ovr, idade }] }`.

- [ ] **Step 1: Escrever o teste que falha**

`tests/engine/roleta.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { girarRoleta, jogadorDaBase, idJogador } from '../../src/engine/roleta.js';

const elencos = [
  { id: 'santos-1962', clube: 'Santos', ano: 1962, jogadores: [
    { nome: 'Pelé', pos: 'CA', ovr: 97, idade: 21 },
    { nome: 'Lima', pos: 'VOL', ovr: 80, idade: 20 },
    { nome: 'Reserva', pos: 'ZAG', ovr: 65, idade: 24 },
  ] },
  { id: 'fla-1981', clube: 'Flamengo', ano: 1981, jogadores: [
    { nome: 'Zico', pos: 'MEI', ovr: 96, idade: 28 },
    { nome: 'Nunes', pos: 'CA', ovr: 84, idade: 27 },
  ] },
];

describe('jogadorDaBase', () => {
  it('monta o jogador com id e origem', () => {
    expect(jogadorDaBase(elencos[0], 0)).toEqual({
      id: 'santos-1962:0', nome: 'Pelé', pos: 'CA', ovr: 97, idade: 21, origem: 'Santos 1962',
    });
    expect(idJogador('x', 3)).toBe('x:3');
  });
});

describe('girarRoleta', () => {
  it('boa: todos os jogadores do elenco sorteado', () => {
    const r = girarRoleta(elencos, criarRng(1), { excluirElencos: ['fla-1981'] });
    expect(r.elencoId).toBe('santos-1962');
    expect(r.opcoes.map((j) => j.nome)).toEqual(['Pelé', 'Lima', 'Reserva']);
  });

  it('média: só até 85 de overall', () => {
    const r = girarRoleta(elencos, criarRng(1), { tipo: 'media', excluirElencos: ['santos-1962'] });
    expect(r.opcoes.map((j) => j.nome)).toEqual(['Nunes']);
  });

  it('ruim: só até 68, e pula elenco sem ninguém nessa faixa', () => {
    const rng = criarRng(2);
    for (let i = 0; i < 50; i++) {
      const r = girarRoleta(elencos, rng, { tipo: 'ruim' });
      expect(r.elencoId).toBe('santos-1962');
      expect(r.opcoes.map((j) => j.nome)).toEqual(['Reserva']);
    }
  });

  it('não oferece jogadores excluídos (já no elenco ou ex-jogadores)', () => {
    const r = girarRoleta(elencos, criarRng(3), { excluirElencos: ['fla-1981'], excluirJogadores: ['santos-1962:0'] });
    expect(r.opcoes.map((j) => j.nome)).toEqual(['Lima', 'Reserva']);
  });

  it('retorna null quando nada serve', () => {
    expect(girarRoleta(elencos, criarRng(4), { excluirElencos: ['santos-1962', 'fla-1981'] })).toBeNull();
  });

  it('sorteia os dois elencos ao longo de vários giros', () => {
    const rng = criarRng(5);
    const vistos = new Set();
    for (let i = 0; i < 50; i++) vistos.add(girarRoleta(elencos, rng).elencoId);
    expect(vistos.size).toBe(2);
  });

  it('tipo desconhecido lança erro', () => {
    expect(() => girarRoleta(elencos, criarRng(6), { tipo: 'otima' })).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/roleta.test.js`
Expected: FAIL — `Cannot find module '../../src/engine/roleta.js'`.

- [ ] **Step 3: Implementar**

`src/engine/roleta.js`:
```js
// Roleta de elencos históricos (draft e transferências).

export const LIMITE_OVR = { boa: 99, media: 85, ruim: 68 };

export const idJogador = (elencoId, i) => `${elencoId}:${i}`;

export function jogadorDaBase(elenco, i) {
  const j = elenco.jogadores[i];
  return { id: idJogador(elenco.id, i), nome: j.nome, pos: j.pos, ovr: j.ovr, idade: j.idade, origem: `${elenco.clube} ${elenco.ano}` };
}

// Para numa elenco que tenha pelo menos uma opção válida. Retorna { elencoId, opcoes } ou null.
// tipo: 'boa' | 'media' | 'ruim'; excluirElencos: ids; excluirJogadores: ids de jogador.
export function girarRoleta(elencos, rng, { tipo = 'boa', excluirElencos = [], excluirJogadores = [] } = {}) {
  const limite = LIMITE_OVR[tipo];
  if (limite === undefined) throw new Error(`Tipo de roleta desconhecido: ${tipo}`);
  const fora = new Set(excluirJogadores);
  const candidatos = elencos
    .filter((e) => !excluirElencos.includes(e.id))
    .map((e) => ({
      elencoId: e.id,
      opcoes: e.jogadores.map((_, i) => jogadorDaBase(e, i)).filter((j) => j.ovr <= limite && !fora.has(j.id)),
    }))
    .filter((c) => c.opcoes.length > 0);
  return candidatos.length ? rng.pick(candidatos) : null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/engine/roleta.test.js`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/roleta.js tests/engine/roleta.test.js
git commit -m "feat(engine): roleta de elencos (boa, média, ruim)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Elenco do usuário — escalação, lesões e suspensões

**Files:**
- Create: `src/engine/elenco.js`
- Test: `tests/engine/elenco.test.js`

**Interfaces:**
- Consumes: `formacoes.json` (Plano 1), `ovrEfetivo` (posicoes.js).
- Produces:
  - Elenco: `{ formacao, postura, titulares: (id | null)[11] alinhado às vagas, jogadores: { [id]: { id, nome, pos, ovr, idade, origem, fora, suspenso } } }`.
  - `TAMANHO_ELENCO = 15`, `TAMANHO_BANCO = 4`.
  - `vagasDaFormacao(id) → vaga[11]` (lança erro se desconhecida).
  - `disponivel(jogador) → boolean`; `novoJogadorDoElenco(jogadorBase) → jogador com fora: 0, suspenso: 0`.
  - `completarTitulares(elenco) → elenco` — preenche vagas `null` com o melhor do elenco.
  - `escalacaoParaJogo(elenco) → { escalacao: [{ jogador, vaga }], banco: jogador[≤4], desfalques }` — formato que `criarLado` (partida.js) recebe.
  - `aplicarConsequencias(elenco, { lesoes: [{ jogadorId, jogos }], expulsos: [{ jogadorId }] }) → elenco`.
  - `forcaMediaDoElenco(elenco) → number`.

- [ ] **Step 1: Escrever o teste que falha**

`tests/engine/elenco.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  vagasDaFormacao, completarTitulares, escalacaoParaJogo, aplicarConsequencias, forcaMediaDoElenco, novoJogadorDoElenco,
} from '../../src/engine/elenco.js';

const j = (id, pos, ovr, extra = {}) => novoJogadorDoElenco({ id, nome: id, pos, ovr, idade: 25, origem: 'x', ...extra });

// 4-3-3: GOL LD ZAG ZAG LE VOL MC MC PD CA PE
function elenco433() {
  const vagas = vagasDaFormacao('4-3-3');
  const titulares = vagas.map((v, i) => j(`t${i}`, v, 80));
  const banco = [j('bGOL', 'GOL', 70), j('bZAG', 'ZAG', 75), j('bMC', 'MC', 72), j('bCA', 'CA', 78)];
  const jogadores = Object.fromEntries([...titulares, ...banco].map((x) => [x.id, x]));
  return { formacao: '4-3-3', postura: 'equilibrada', titulares: titulares.map((x) => x.id), jogadores };
}

describe('vagasDaFormacao', () => {
  it('devolve as 11 vagas e rejeita formação desconhecida', () => {
    expect(vagasDaFormacao('4-4-2')).toHaveLength(11);
    expect(() => vagasDaFormacao('3-5-2')).toThrow();
  });
});

describe('escalacaoParaJogo', () => {
  it('todos disponíveis: os 11 titulares nas suas vagas e 4 no banco', () => {
    const { escalacao, banco, desfalques } = escalacaoParaJogo(elenco433());
    expect(escalacao.map((e) => e.jogador.id)).toEqual(['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10']);
    expect(banco.map((b) => b.id).sort()).toEqual(['bCA', 'bGOL', 'bMC', 'bZAG']);
    expect(desfalques).toBe(0);
  });

  it('titular lesionado é trocado pelo melhor reserva para a vaga', () => {
    const e = elenco433();
    e.jogadores.t9.fora = 2; // CA
    const { escalacao, banco } = escalacaoParaJogo(e);
    expect(escalacao.find((x) => x.vaga === 'CA').jogador.id).toBe('bCA');
    expect(banco.some((b) => b.id === 't9')).toBe(false);
  });

  it('goleiro suspenso: entra o goleiro reserva', () => {
    const e = elenco433();
    e.jogadores.t0.suspenso = 1;
    expect(escalacaoParaJogo(e).escalacao.find((x) => x.vaga === 'GOL').jogador.id).toBe('bGOL');
  });

  it('menos de 11 disponíveis: joga com quem tem e conta desfalques', () => {
    const e = elenco433();
    for (const id of ['t1', 't2', 't3', 't4', 'bZAG', 'bGOL']) e.jogadores[id].fora = 1;
    const { escalacao, banco, desfalques } = escalacaoParaJogo(e);
    expect(escalacao).toHaveLength(9);
    expect(desfalques).toBe(2);
    expect(banco).toEqual([]);
  });
});

describe('completarTitulares', () => {
  it('preenche vaga vazia com o melhor do elenco para ela', () => {
    const e = elenco433();
    delete e.jogadores.t9; // CA aposentou
    const c = completarTitulares(e);
    expect(c.titulares[9]).toBe('bCA');
    expect(c.titulares.filter(Boolean)).toHaveLength(11);
  });
});

describe('aplicarConsequencias', () => {
  it('quem estava fora cumpre um jogo; lesionado e expulso ficam fora', () => {
    const e = elenco433();
    e.jogadores.t5.fora = 2;
    e.jogadores.t6.suspenso = 1;
    const r = aplicarConsequencias(e, { lesoes: [{ jogadorId: 't8', jogos: 3 }], expulsos: [{ jogadorId: 't10' }] });
    expect(r.jogadores.t5.fora).toBe(1);
    expect(r.jogadores.t6.suspenso).toBe(0);
    expect(r.jogadores.t8.fora).toBe(3);
    expect(r.jogadores.t10.suspenso).toBe(1);
    expect(e.jogadores.t5.fora).toBe(2); // não muta
  });

  it('ignora ids que não são do elenco (ex.: jogadores do adversário)', () => {
    const r = aplicarConsequencias(elenco433(), { lesoes: [{ jogadorId: 'outro', jogos: 2 }], expulsos: [{ jogadorId: null }] });
    expect(r.jogadores.outro).toBeUndefined();
  });
});

describe('forcaMediaDoElenco', () => {
  it('média do overall dos titulares', () => {
    expect(forcaMediaDoElenco(elenco433())).toBe(80);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/elenco.test.js`
Expected: FAIL — `Cannot find module '../../src/engine/elenco.js'`.

- [ ] **Step 3: Implementar**

`src/engine/elenco.js`:
```js
import formacoes from '../data/formacoes.json';
import { ovrEfetivo } from './posicoes.js';

// elenco: { formacao, postura, titulares: [jogadorId | null] x11 (alinhado às vagas da formação),
//           jogadores: { [id]: { id, nome, pos, ovr, idade, origem, fora, suspenso } } }
// fora = jogos que ainda perde por lesão; suspenso = jogos que ainda cumpre de suspensão.

export const TAMANHO_ELENCO = 15;
export const TAMANHO_BANCO = 4;

export function vagasDaFormacao(id) {
  const f = formacoes.find((x) => x.id === id);
  if (!f) throw new Error(`Formação desconhecida: ${id}`);
  return f.vagas;
}

export const disponivel = (j) => !j.fora && !j.suspenso;

export function novoJogadorDoElenco(jogadorBase) {
  return { ...jogadorBase, fora: 0, suspenso: 0 };
}

// Escolhe, vaga a vaga (goleiro primeiro), o melhor jogador ainda livre. Vagas sem candidato ficam null.
function preencher(vagas, candidatos, fixos = []) {
  const usados = new Set(fixos.filter(Boolean));
  const ordem = vagas.map((v, i) => i).sort((a, b) => (vagas[a] === 'GOL' ? -1 : 0) - (vagas[b] === 'GOL' ? -1 : 0));
  const res = [...fixos];
  for (const i of ordem) {
    if (res[i]) continue;
    let melhor = null;
    for (const j of candidatos) {
      if (usados.has(j.id)) continue;
      if (!melhor || ovrEfetivo(j, vagas[i]) > ovrEfetivo(melhor, vagas[i])) melhor = j;
    }
    res[i] = melhor ? melhor.id : null;
    if (melhor) usados.add(melhor.id);
  }
  return res;
}

// Mantém os titulares que ainda existem e completa as vagas vazias com o melhor do resto do elenco.
export function completarTitulares(elenco) {
  const vagas = vagasDaFormacao(elenco.formacao);
  const fixos = vagas.map((_, i) => (elenco.jogadores[elenco.titulares[i]] ? elenco.titulares[i] : null));
  return { ...elenco, titulares: preencher(vagas, Object.values(elenco.jogadores), fixos) };
}

// Escalação de um jogo: titulares disponíveis; quem está fora é trocado pelo melhor disponível para a vaga.
// -> { escalacao: [{ jogador, vaga }], banco: jogador[], desfalques }
export function escalacaoParaJogo(elenco) {
  const vagas = vagasDaFormacao(elenco.formacao);
  const disponiveis = Object.values(elenco.jogadores).filter(disponivel);
  const fixos = vagas.map((_, i) => {
    const j = elenco.jogadores[elenco.titulares[i]];
    return j && disponivel(j) ? j.id : null;
  });
  const ids = preencher(vagas, disponiveis, fixos);
  const escalacao = ids.map((id, i) => (id ? { jogador: elenco.jogadores[id], vaga: vagas[i] } : null)).filter(Boolean);
  const emCampo = new Set(ids.filter(Boolean));
  const banco = disponiveis.filter((j) => !emCampo.has(j.id)).sort((a, b) => b.ovr - a.ovr).slice(0, TAMANHO_BANCO);
  return { escalacao, banco, desfalques: vagas.length - escalacao.length };
}

// Depois de um jogo do usuário: quem estava fora cumpre um jogo; quem se lesionou ou foi expulso fica fora.
// lesoes: [{ jogadorId, jogos }], expulsos: [{ jogadorId }]
export function aplicarConsequencias(elenco, { lesoes = [], expulsos = [] }) {
  const jogadores = {};
  for (const [id, j] of Object.entries(elenco.jogadores)) {
    jogadores[id] = { ...j, fora: Math.max(0, j.fora - 1), suspenso: Math.max(0, j.suspenso - 1) };
  }
  for (const { jogadorId, jogos } of lesoes) if (jogadores[jogadorId]) jogadores[jogadorId].fora = jogos;
  for (const { jogadorId } of expulsos) if (jogadores[jogadorId]) jogadores[jogadorId].suspenso = 1;
  return { ...elenco, jogadores };
}

export function forcaMediaDoElenco(elenco) {
  const ids = elenco.titulares.filter(Boolean);
  if (!ids.length) return 0;
  return ids.reduce((s, id) => s + elenco.jogadores[id].ovr, 0) / ids.length;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/engine/elenco.test.js`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/elenco.js tests/engine/elenco.test.js
git commit -m "feat(engine): escalação do usuário com lesões e suspensões

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Carreira — draft, temporadas e transferências

**Files:**
- Create: `tests/fixtures/dados.js`
- Create: `src/engine/carreira.js`
- Test: `tests/engine/carreira.test.js`

**Interfaces:**
- Consumes: tudo das Tasks 1–5 e do Plano 1 (`criarRng`, `criarLado`, `simularPartida`, `setoresDoLado`, `disputarPenaltis`, `ordenarTabela`).
- Produces (usado pelas telas do Plano 4):
  - `dados` (formato do Plano 3): `{ clubes: [{ id, nome, sigla, estado, cores, gol, def, mei, ata, serieA, classicos }], estaduais: { [UF]: { nome, clubes: id[12] } }, estrangeiros: [{ id, nome, sigla, pais, cores, gol, def, mei, ata }] (≥ 54), elencos: [...] }`.
  - Carreira: `{ versao, semente, rng, config: { clubeId, duracao, dificuldade }, fase: 'draft' | 'temporada' | 'transferencias' | 'fim', temporada, draft: { giros, curingas, elencosUsados, atual }, elenco, notas: { [clubeId]: { gol, def, mei, ata } }, vagas, exJogadores, historico: [{ temporada, titulos, posicaoBrasileirao, campanhas, artilheiro }], temporadaAtual: { competicoes, calendario, indice, gols, jogos }, transferencias: { fila, atual, aposentados } }`.
  - `CURINGAS`, `OSCILACAO`, `DURACOES`, `POSTURAS`.
  - `novaCarreira({ dados, clubeId, duracao?, dificuldade?, formacao?, postura?, semente })`.
  - Draft: `girarDraft(c, dados)`, `usarCuringa(c)`, `escolherNoDraft(c, dados, jogadorId, vaga 0..10 | 'banco')` — com o 15º jogador começa a temporada 1.
  - Temporada: `proximaData(c, dados) → { indice, tipo, compId, jogo, importante }`, `jogarData(c, dados, { partidaUsuario? })`, `ladosDoJogo(c, dados, jogo) → { casa, fora }`, `ladoDoUsuario(c, dados)`, `rngDaPartida(c)`, `ehJogoImportante(c, dados, compId, jogo)`, `nomeDoClube(dados, id)`.
  - Janela: `girarTransferencia(c, dados)`, `aceitarTransferencia(c, jogadorId, saiId?)`, `recusarTransferencia(c)`, `concluirTransferencias(c, dados)`.
  - Tática: `definirTatica(c, { formacao?, postura?, titulares? })`.

- [ ] **Step 1: Criar a base de dados falsa**

`tests/fixtures/dados.js`:
```js
// Base de dados falsa, com o mesmo formato dos JSONs reais (Plano 3), para testar a carreira.

const notas = (n) => ({ gol: n, def: n, mei: n, ata: n });
const POSICOES_ELENCO = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'ZAG', 'LD', 'LD', 'LE', 'LE',
  'VOL', 'VOL', 'MC', 'MC', 'MEI', 'MEI', 'PD', 'PE', 'CA', 'CA'];

export function criarDados() {
  // 20 clubes da Série A: 10 no estado AA, 10 no BB
  const serieA = Array.from({ length: 20 }, (_, i) => ({
    id: `a${i}`, nome: `Clube A${i}`, sigla: `A${i}`, estado: i < 10 ? 'AA' : 'BB',
    cores: ['#000000', '#ffffff'], ...notas(70 + (i % 10)), serieA: true,
    classicos: i === 0 ? ['a1'] : i === 1 ? ['a0'] : [],
  }));
  // 2 pequenos por estado AA/BB e 12 num estado só de pequenos (para completar a Copa do Brasil)
  const pequenos = [
    ...['AA', 'AA', 'BB', 'BB'].map((estado, i) => ({ id: `p${i}`, estado })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: `p${i + 4}`, estado: 'CC' })),
  ].map((p, i) => ({ ...p, nome: `Pequeno ${i}`, sigla: `P${i}`, cores: ['#333333', '#cccccc'], ...notas(60 + (i % 8)), serieA: false, classicos: [] }));
  const clubes = [...serieA, ...pequenos];

  const doEstado = (uf) => clubes.filter((c) => c.estado === uf).map((c) => c.id);
  const estaduais = {
    AA: { nome: 'Campeonato AA', clubes: doEstado('AA') },
    BB: { nome: 'Campeonato BB', clubes: doEstado('BB') },
    CC: { nome: 'Campeonato CC', clubes: doEstado('CC') },
  };

  const estrangeiros = Array.from({ length: 56 }, (_, i) => ({
    id: `x${i}`, nome: `Estrangeiro ${i}`, sigla: `X${i}`, pais: 'ARG', cores: ['#0000ff', '#ffff00'], ...notas(62 + (i % 20)),
  }));

  const elencos = Array.from({ length: 40 }, (_, e) => ({
    id: `elenco-${e}`, clube: `Histórico ${e}`, sigla: `H${e}`, ano: 1960 + e, cores: ['#00aa00', '#ffffff'],
    jogadores: POSICOES_ELENCO.map((pos, i) => ({
      nome: `Jogador ${e}-${i}`, pos, ovr: 60 + ((e * 7 + i * 3) % 35), idade: 19 + ((e + i) % 17),
    })),
  }));

  return { clubes, estaduais, estrangeiros, elencos };
}
```

- [ ] **Step 2: Escrever o teste que falha**

`tests/engine/carreira.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarDados } from '../fixtures/dados.js';
import {
  iniciarPartida, simularPrimeiroTempo, aplicarIntervalo, simularSegundoTempo, simularProrrogacao,
} from '../../src/engine/partida.js';
import {
  novaCarreira, girarDraft, usarCuringa, escolherNoDraft, proximaData, jogarData, ladosDoJogo, rngDaPartida,
  girarTransferencia, aceitarTransferencia, recusarTransferencia, concluirTransferencias, definirTatica, CURINGAS,
} from '../../src/engine/carreira.js';

const dados = criarDados();
const nova = (extra = {}) => novaCarreira({ dados, clubeId: 'a0', duracao: 5, semente: 42, ...extra });

// Completa o draft: titulares nas vagas 0..10, depois 4 no banco; pega sempre a 1ª opção.
function draftCompleto(c) {
  for (let i = 0; i < 15; i++) {
    c = girarDraft(c, dados);
    c = escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, i < 11 ? i : 'banco');
  }
  return c;
}

function jogarTemporada(c) {
  while (c.fase === 'temporada') c = jogarData(c, dados);
  return c;
}

// Na janela: aceita as obrigatórias (trocando o pior quando o elenco está cheio) e recusa as opcionais.
function resolverJanela(c) {
  while (c.transferencias.fila.length) {
    c = girarTransferencia(c, dados);
    if (!c.transferencias.atual) continue;
    const { obrigatoria } = c.transferencias.fila[0];
    if (!obrigatoria) { c = recusarTransferencia(c); continue; }
    const cheio = Object.keys(c.elenco.jogadores).length >= 15;
    const pior = Object.values(c.elenco.jogadores).sort((a, b) => a.ovr - b.ovr)[0].id;
    c = aceitarTransferencia(c, c.transferencias.atual.opcoes[0].id, cheio ? pior : null);
  }
  return concluirTransferencias(c, dados);
}

describe('novaCarreira', () => {
  it('começa no draft com 3 curingas e elenco vazio', () => {
    const c = nova();
    expect(c.fase).toBe('draft');
    expect(c.draft.curingas).toBe(CURINGAS);
    expect(c.elenco.titulares).toEqual(Array(11).fill(null));
  });

  it('rejeita clube fora da Série A, duração e postura inválidas', () => {
    expect(() => nova({ clubeId: 'p0' })).toThrow();
    expect(() => nova({ duracao: 7 })).toThrow();
    expect(() => nova({ postura: 'retranca' })).toThrow();
    expect(() => nova({ formacao: '3-5-2' })).toThrow();
  });
});

describe('draft', () => {
  it('girar mostra um elenco; não dá para girar de novo sem escolher', () => {
    const c = girarDraft(nova(), dados);
    expect(c.draft.atual.opcoes.length).toBeGreaterThan(0);
    expect(() => girarDraft(c, dados)).toThrow();
  });

  it('curinga descarta o giro e acaba depois de 3 usos', () => {
    let c = nova();
    for (let i = 0; i < CURINGAS; i++) c = usarCuringa(girarDraft(c, dados));
    expect(c.draft.curingas).toBe(0);
    expect(() => usarCuringa(girarDraft(c, dados))).toThrow();
  });

  it('elenco sorteado não se repete no mesmo draft (15 escolhas + 3 curingas)', () => {
    let c = nova();
    while (c.fase === 'draft') {
      c = girarDraft(c, dados);
      const n = Object.keys(c.elenco.jogadores).length;
      if (c.draft.curingas > 0 && c.draft.giros % 5 === 0) c = usarCuringa(c);
      else c = escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, n < 11 ? n : 'banco');
    }
    expect(c.draft.giros).toBe(18);
    expect(new Set(c.draft.elencosUsados).size).toBe(18);
  });

  it('não aceita vaga ocupada, banco cheio ou jogador fora da roleta', () => {
    let c = girarDraft(nova(), dados);
    c = escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, 0);
    c = girarDraft(c, dados);
    expect(() => escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, 0)).toThrow();
    expect(() => escolherNoDraft(c, dados, 'nao-existe', 1)).toThrow();
    for (let i = 0; i < 4; i++) {
      c = escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, 'banco');
      c = girarDraft(c, dados);
    }
    expect(() => escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, 'banco')).toThrow();
  });

  it('com 15 jogadores a temporada 1 começa: estadual + Brasileirão = 52 datas', () => {
    const c = draftCompleto(nova());
    expect(c.fase).toBe('temporada');
    expect(c.temporada).toBe(1);
    expect(Object.keys(c.elenco.jogadores)).toHaveLength(15);
    expect(c.temporadaAtual.calendario).toHaveLength(52);
    expect(Object.keys(c.temporadaAtual.competicoes).sort()).toEqual(['brasileirao', 'estadual']);
  });
});

describe('temporada', () => {
  it('proximaData aponta o jogo do usuário', () => {
    const c = draftCompleto(nova());
    const p = proximaData(c, dados);
    expect(p.compId).toBe('estadual');
    expect([p.jogo.casa, p.jogo.fora]).toContain('a0');
  });

  it('clássico é jogo importante', () => {
    let c = draftCompleto(nova());
    let viu = false;
    while (c.fase === 'temporada' && !viu) {
      const p = proximaData(c, dados);
      if (p.jogo && [p.jogo.casa, p.jogo.fora].includes('a1')) { expect(p.importante).toBe(true); viu = true; }
      c = jogarData(c, dados);
    }
    expect(viu).toBe(true);
  });

  it('cada data jogada registra o jogo do usuário e avança o índice', () => {
    let c = draftCompleto(nova());
    c = jogarData(c, dados);
    expect(c.temporadaAtual.indice).toBe(1);
    expect(c.temporadaAtual.jogos).toHaveLength(1);
    expect(c.temporadaAtual.jogos[0].compId).toBe('estadual');
  });

  it('fim da temporada 1: histórico, vagas e janela de transferências', () => {
    const c = jogarTemporada(draftCompleto(nova()));
    expect(c.fase).toBe('transferencias');
    const h = c.historico[0];
    expect(h.temporada).toBe(1);
    expect(h.posicaoBrasileirao).toBeGreaterThanOrEqual(1);
    expect(h.campanhas.brasileirao).toBeDefined();
    expect(c.vagas.libertadores.length).toBeGreaterThanOrEqual(4);
    expect(c.vagas.sulamericana).toHaveLength(6);
    expect(c.temporadaAtual.jogos.length).toBeGreaterThanOrEqual(40);
  });

  it('temporada 2 tem Copa do Brasil e as duas continentais; usuário em no máximo uma', () => {
    let c = jogarTemporada(draftCompleto(nova()));
    c = resolverJanela(c);
    expect(c.temporada).toBe(2);
    const comps = c.temporadaAtual.competicoes;
    expect(Object.keys(comps).sort()).toEqual(['brasileirao', 'copaDoBrasil', 'estadual', 'libertadores', 'sulamericana']);
    expect(comps.copaDoBrasil.participantes).toHaveLength(32);
    expect(comps.copaDoBrasil.participantes).toContain('a0');
    expect(comps.libertadores.participantes).toHaveLength(32);
    expect(comps.sulamericana.participantes).toHaveLength(32);
    const emContinental = ['libertadores', 'sulamericana'].filter((id) => comps[id].participantes.includes('a0'));
    expect(emContinental.length).toBeLessThanOrEqual(1);
    expect(c.temporadaAtual.calendario).toHaveLength(75);
  });

  it('carreira de 5 temporadas termina com 5 entradas no histórico', () => {
    let c = draftCompleto(nova());
    for (let s = 1; s <= 5; s++) {
      c = jogarTemporada(c);
      if (c.fase === 'transferencias') c = resolverJanela(c);
    }
    expect(c.fase).toBe('fim');
    expect(c.historico.map((h) => h.temporada)).toEqual([1, 2, 3, 4, 5]);
  }, 60000);

  it('mesma semente, mesma carreira; e o estado sobrevive a JSON', () => {
    const a = jogarTemporada(draftCompleto(nova()));
    const b = jogarTemporada(draftCompleto(nova()));
    expect(a.historico).toEqual(b.historico);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('notas dos clubes do computador oscilam no máximo 3 por temporada', () => {
    const c1 = jogarTemporada(draftCompleto(nova()));
    const c2 = resolverJanela(c1);
    for (const [id, n] of Object.entries(c2.notas)) {
      for (const s of ['gol', 'def', 'mei', 'ata']) expect(Math.abs(n[s] - c1.notas[id][s])).toBeLessThanOrEqual(3);
    }
  });
});

describe('partida ao vivo do usuário', () => {
  it('jogarData usa o resultado da partida jogada na tela', () => {
    let c = draftCompleto(nova());
    const { jogo } = proximaData(c, dados);
    const rng = rngDaPartida(c);
    const { casa, fora } = ladosDoJogo(c, dados, jogo);
    let p = simularPrimeiroTempo(iniciarPartida({ casa, fora, neutro: jogo.neutro }), rng);
    const meu = casa.id === 'a0' ? 'casa' : 'fora';
    p = aplicarIntervalo(p, meu, { postura: 'ofensiva' });
    p = simularSegundoTempo(p, rng);
    if (jogo.prorrogacao && p.placar.casa === p.placar.fora) p = simularProrrogacao(p, rng);
    c = jogarData(c, dados, { partidaUsuario: p });
    expect(c.temporadaAtual.jogos[0]).toMatchObject({ golsCasa: p.placar.casa, golsFora: p.placar.fora });
  });

  it('rejeita partida de outro jogo ou não terminada', () => {
    const c = draftCompleto(nova());
    const { jogo } = proximaData(c, dados);
    const { casa, fora } = ladosDoJogo(c, dados, jogo);
    const incompleta = simularPrimeiroTempo(iniciarPartida({ casa, fora }), rngDaPartida(c));
    expect(() => jogarData(c, dados, { partidaUsuario: incompleta })).toThrow();
    const trocada = simularSegundoTempo(simularPrimeiroTempo(iniciarPartida({ casa: fora, fora: casa }), rngDaPartida(c)), rngDaPartida(c));
    expect(() => jogarData(c, dados, { partidaUsuario: trocada })).toThrow();
  });

  it('lesionado do usuário fica fora dos jogos seguintes', () => {
    let c = draftCompleto(nova());
    let alvo = null;
    while (c.fase === 'temporada' && !alvo) {
      c = jogarData(c, dados);
      alvo = Object.values(c.elenco.jogadores).find((j) => j.fora > 0);
    }
    expect(alvo).toBeTruthy();
    const { jogo } = proximaData(c, dados);
    expect(jogo).not.toBeNull(); // com a semente 42 a lesão sai na 4ª data do estadual
    const { casa, fora } = ladosDoJogo(c, dados, jogo);
    const meu = casa.id === 'a0' ? casa : fora;
    expect(meu.escalacao.some((e) => e.jogador.id === alvo.id)).toBe(false);
    expect(meu.banco.some((j) => j.id === alvo.id)).toBe(false);
  });
});

describe('transferências', () => {
  function ateJanela() { return jogarTemporada(draftCompleto(nova())); }

  it('elenco incompleto: entra sem ninguém sair; elenco cheio: exige quem sai e o novo herda a vaga', () => {
    let c = ateJanela();
    // deixa o elenco com exatamente 14, como depois de uma aposentadoria
    while (Object.keys(c.elenco.jogadores).length > 14) {
      const reserva = Object.keys(c.elenco.jogadores).find((id) => !c.elenco.titulares.includes(id));
      c = structuredClone(c);
      delete c.elenco.jogadores[reserva];
    }
    c = { ...c, transferencias: { ...c.transferencias, fila: [{ tipo: 'reposicao', obrigatoria: true }, { tipo: 'boa', obrigatoria: false }] } };
    c = girarTransferencia(c, dados);
    const reposto = c.transferencias.atual.opcoes[0].id;
    expect(() => aceitarTransferencia(c, reposto, c.elenco.titulares[0])).toThrow();
    c = aceitarTransferencia(c, reposto);
    expect(Object.keys(c.elenco.jogadores)).toHaveLength(15);

    c = girarTransferencia(c, dados);
    const novo = c.transferencias.atual.opcoes[0].id;
    const sai = c.elenco.titulares[3];
    expect(() => aceitarTransferencia(c, novo)).toThrow();
    c = aceitarTransferencia(c, novo, sai);
    expect(c.elenco.titulares[3]).toBe(novo);
    expect(c.elenco.jogadores[sai]).toBeUndefined();
    expect(c.exJogadores).toContain(sai);
    expect(c.transferencias.fila).toEqual([]);
  });

  it('roleta obrigatória não pode ser recusada; opcional pode', () => {
    let c = ateJanela();
    c = { ...c, transferencias: { ...c.transferencias, fila: [{ tipo: 'ruim', obrigatoria: true }, { tipo: 'boa', obrigatoria: false }] } };
    c = girarTransferencia(c, dados);
    expect(c.transferencias.atual.opcoes.every((j) => j.ovr <= 68)).toBe(true);
    expect(() => recusarTransferencia(c)).toThrow();
  });

  it('não dá para concluir com roletas pendentes', () => {
    let c = ateJanela();
    c = { ...c, transferencias: { ...c.transferencias, fila: [{ tipo: 'boa', obrigatoria: false }] } };
    expect(() => concluirTransferencias(c, dados)).toThrow();
  });

  it('roleta nunca oferece quem já está no elenco ou já saiu', () => {
    let c = ateJanela();
    c = { ...c, exJogadores: [...c.exJogadores, 'elenco-0:0'], transferencias: { ...c.transferencias, fila: Array(20).fill({ tipo: 'boa', obrigatoria: false }) } };
    for (let i = 0; i < 20; i++) {
      c = girarTransferencia(c, dados);
      const ids = c.transferencias.atual.opcoes.map((j) => j.id);
      for (const id of ids) {
        expect(c.elenco.jogadores[id]).toBeUndefined();
        expect(c.exJogadores).not.toContain(id);
      }
      c = recusarTransferencia(c);
    }
  });
});

describe('definirTatica', () => {
  it('troca formação, postura e titulares com validação', () => {
    let c = draftCompleto(nova());
    c = definirTatica(c, { formacao: '4-4-2', postura: 'ofensiva' });
    expect(c.elenco.formacao).toBe('4-4-2');
    expect(c.elenco.postura).toBe('ofensiva');
    const t = [...c.elenco.titulares];
    [t[0], t[1]] = [t[1], t[0]];
    expect(definirTatica(c, { titulares: t }).elenco.titulares).toEqual(t);
    expect(() => definirTatica(c, { titulares: [t[0], t[0], ...t.slice(2)] })).toThrow();
    expect(() => definirTatica(c, { titulares: t.slice(1) })).toThrow();
    expect(() => definirTatica(c, { postura: 'retranca' })).toThrow();
  });

  it('não vale durante o draft', () => {
    expect(() => definirTatica(nova(), { postura: 'ofensiva' })).toThrow();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/engine/carreira.test.js`
Expected: FAIL — `Cannot find module '../../src/engine/carreira.js'`.

- [ ] **Step 4: Implementar**

`src/engine/carreira.js`:
```js
import { criarRng } from './rng.js';
import { criarLado, simularPartida } from './partida.js';
import { setoresDoLado } from './forca.js';
import { disputarPenaltis } from './penaltis.js';
import { ordenarTabela } from './liga.js';
import {
  criarBrasileirao, criarEstadual, criarCopaDoBrasil, criarContinental, jogosDaEtapa, registrarEtapa, campanha,
} from './competicoes.js';
import { montarCalendario } from './calendario.js';
import { vagasContinentais, roletasDoFimDeTemporada } from './classificacao.js';
import { envelhecer } from './envelhecimento.js';
import { girarRoleta } from './roleta.js';
import {
  vagasDaFormacao, completarTitulares, escalacaoParaJogo, aplicarConsequencias, forcaMediaDoElenco,
  novoJogadorDoElenco, TAMANHO_ELENCO, TAMANHO_BANCO,
} from './elenco.js';

// A carreira é um objeto JSON puro (dá para salvar com JSON.stringify). Toda função pública recebe
// a carreira e devolve uma nova; `dados` ({ clubes, estaduais, estrangeiros, elencos }) nunca é salvo.
// Fases: 'draft' -> 'temporada' -> 'transferencias' -> 'temporada' ... -> 'fim'

export const CURINGAS = 3;
export const OSCILACAO = 3;
export const DURACOES = [5, 10];
export const POSTURAS = ['defensiva', 'equilibrada', 'ofensiva'];
const RODADAS_DECISIVAS = 5;
const NOTA_MIN = 50;
const NOTA_MAX = 90;

const media = (n) => (n.gol + n.def + n.mei + n.ata) / 4;

function exigirFase(c, fase) {
  if (c.fase !== fase) throw new Error(`Ação inválida na fase "${c.fase}" (esperado "${fase}")`);
}

// Copia a carreira, entrega um rng que continua a sequência salva e grava o estado do rng no fim.
function alterar(carreira, fn) {
  const c = structuredClone(carreira);
  const rng = criarRng(c.rng);
  fn(c, rng);
  c.rng = rng.estado();
  return c;
}

export function novaCarreira({ dados, clubeId, duracao = 10, dificuldade = 'classico', formacao = '4-3-3', postura = 'equilibrada', semente }) {
  const clube = dados.clubes.find((x) => x.id === clubeId);
  if (!clube || !clube.serieA) throw new Error('Escolha um clube da Série A');
  if (!DURACOES.includes(duracao)) throw new Error('Duração deve ser 5 ou 10 temporadas');
  if (!['classico', 'olheiro'].includes(dificuldade)) throw new Error('Dificuldade inválida');
  if (!POSTURAS.includes(postura)) throw new Error('Postura inválida');
  vagasDaFormacao(formacao);
  const notas = {};
  for (const x of [...dados.clubes, ...dados.estrangeiros]) notas[x.id] = { gol: x.gol, def: x.def, mei: x.mei, ata: x.ata };
  return {
    versao: 1,
    semente: semente >>> 0,
    rng: semente >>> 0,
    config: { clubeId, duracao, dificuldade },
    fase: 'draft',
    temporada: 0,
    draft: { giros: 0, curingas: CURINGAS, elencosUsados: [], atual: null },
    elenco: { formacao, postura, titulares: Array(11).fill(null), jogadores: {} },
    notas,
    vagas: null,
    exJogadores: [],
    historico: [],
    temporadaAtual: null,
    transferencias: null,
  };
}

// ---------- Draft ----------

export function girarDraft(carreira, dados) {
  exigirFase(carreira, 'draft');
  if (carreira.draft.atual) throw new Error('Escolha um jogador ou use um curinga antes de girar de novo');
  return alterar(carreira, (c, rng) => {
    const atual = girarRoleta(dados.elencos, rng, { excluirElencos: c.draft.elencosUsados });
    if (!atual) throw new Error('Não há mais elencos disponíveis na roleta');
    c.draft.atual = atual;
    c.draft.elencosUsados.push(atual.elencoId);
    c.draft.giros += 1;
  });
}

export function usarCuringa(carreira) {
  exigirFase(carreira, 'draft');
  if (!carreira.draft.atual) throw new Error('Gire a roleta antes de usar um curinga');
  if (carreira.draft.curingas <= 0) throw new Error('Sem curingas');
  const c = structuredClone(carreira);
  c.draft.atual = null;
  c.draft.curingas -= 1;
  return c;
}

const tamanhoDoBanco = (elenco) => Object.keys(elenco.jogadores).length - elenco.titulares.filter(Boolean).length;

// destino: índice da vaga (0..10) ou 'banco'
export function escolherNoDraft(carreira, dados, jogadorId, destino) {
  exigirFase(carreira, 'draft');
  const escolhido = carreira.draft.atual?.opcoes.find((j) => j.id === jogadorId);
  if (!escolhido) throw new Error('Esse jogador não está na roleta atual');
  const c = structuredClone(carreira);
  if (destino === 'banco') {
    if (tamanhoDoBanco(c.elenco) >= TAMANHO_BANCO) throw new Error(`O banco já tem ${TAMANHO_BANCO} jogadores`);
  } else {
    if (!Number.isInteger(destino) || destino < 0 || destino > 10) throw new Error('Vaga inválida');
    if (c.elenco.titulares[destino]) throw new Error('Essa vaga já está ocupada');
    c.elenco.titulares[destino] = escolhido.id;
  }
  c.elenco.jogadores[escolhido.id] = novoJogadorDoElenco(escolhido);
  c.draft.atual = null;
  if (Object.keys(c.elenco.jogadores).length === TAMANHO_ELENCO) return iniciarTemporada(c, dados);
  return c;
}

// ---------- Temporada ----------

function forcaDe(c, id) {
  return id === c.config.clubeId ? forcaMediaDoElenco(c.elenco) : media(c.notas[id]);
}

function iniciarTemporada(carreira, dados) {
  return alterar(carreira, (c, rng) => {
    c.temporada += 1;
    if (c.temporada > 1) {
      for (const n of Object.values(c.notas)) {
        for (const s of ['gol', 'def', 'mei', 'ata']) {
          n[s] = Math.max(NOTA_MIN, Math.min(NOTA_MAX, n[s] + rng.int(-OSCILACAO, OSCILACAO)));
        }
      }
    }
    const clube = dados.clubes.find((x) => x.id === c.config.clubeId);
    const serieA = dados.clubes.filter((x) => x.serieA).map((x) => x.id);
    const porForca = (ids) => [...ids].sort((a, b) => forcaDe(c, b) - forcaDe(c, a));
    const competicoes = {
      estadual: criarEstadual(dados.estaduais[clube.estado].clubes),
      brasileirao: criarBrasileirao(rng.embaralhar(serieA)),
    };
    if (c.vagas) {
      const pequenos = porForca(dados.clubes.filter((x) => !x.serieA).map((x) => x.id)).slice(0, 24);
      competicoes.copaDoBrasil = criarCopaDoBrasil([...serieA, ...rng.embaralhar(pequenos).slice(0, 12)], rng);
      const estrangeiros = porForca(dados.estrangeiros.map((x) => x.id));
      const nLib = 32 - c.vagas.libertadores.length;
      const nSul = 32 - c.vagas.sulamericana.length;
      competicoes.libertadores = criarContinental('libertadores', porForca([...c.vagas.libertadores, ...estrangeiros.slice(0, nLib)]), rng);
      competicoes.sulamericana = criarContinental('sulamericana', porForca([...c.vagas.sulamericana, ...estrangeiros.slice(nLib, nLib + nSul)]), rng);
    }
    for (const j of Object.values(c.elenco.jogadores)) { j.fora = 0; j.suspenso = 0; }
    c.elenco = completarTitulares(c.elenco);
    c.temporadaAtual = { competicoes, calendario: montarCalendario(competicoes), indice: 0, gols: {}, jogos: [] };
    c.fase = 'temporada';
    c.transferencias = null;
  });
}

export function nomeDoClube(dados, id) {
  return (dados.clubes.find((x) => x.id === id) ?? dados.estrangeiros.find((x) => x.id === id))?.nome ?? id;
}

export function ladoDoUsuario(carreira, dados) {
  const { escalacao, banco, desfalques } = escalacaoParaJogo(carreira.elenco);
  const lado = criarLado({
    id: carreira.config.clubeId, nome: nomeDoClube(dados, carreira.config.clubeId),
    escalacao, banco, postura: carreira.elenco.postura,
  });
  lado.desfalques = desfalques;
  return lado;
}

export function ladosDoJogo(carreira, dados, jogo) {
  const lado = (id) => (id === carreira.config.clubeId
    ? ladoDoUsuario(carreira, dados)
    : criarLado({ id, nome: nomeDoClube(dados, id), setoresBase: carreira.notas[id] }));
  return { casa: lado(jogo.casa), fora: lado(jogo.fora) };
}

// rng próprio da partida ao vivo do usuário, para não depender da ordem em que a tela chama as coisas.
export function rngDaPartida(carreira) {
  return criarRng((carreira.semente ^ Math.imul(carreira.temporada, 7919) ^ Math.imul(carreira.temporadaAtual.indice + 1, 104729)) >>> 0);
}

export function ehJogoImportante(carreira, dados, compId, jogo) {
  if (jogo.mataMata) return true;
  const eu = dados.clubes.find((x) => x.id === carreira.config.clubeId);
  const rival = jogo.casa === eu.id ? jogo.fora : jogo.casa;
  if (eu.classicos.includes(rival)) return true;
  const br = carreira.temporadaAtual.competicoes.brasileirao;
  return compId === 'brasileirao' && br.proxima >= br.etapas.length - RODADAS_DECISIVAS;
}

// O jogo do usuário na próxima data, se houver: { indice, tipo, compId, jogo, importante } ou { indice, tipo, jogo: null }
export function proximaData(carreira, dados) {
  exigirFase(carreira, 'temporada');
  const t = carreira.temporadaAtual;
  const data = t.calendario[t.indice];
  const eu = carreira.config.clubeId;
  for (const compId of data.comps) {
    const jogo = jogosDaEtapa(t.competicoes[compId]).find((j) => j.casa === eu || j.fora === eu);
    if (jogo) return { indice: t.indice, tipo: data.tipo, compId, jogo, importante: ehJogoImportante(carreira, dados, compId, jogo) };
  }
  return { indice: t.indice, tipo: data.tipo, compId: null, jogo: null, importante: false };
}

// Joga a próxima data inteira. partidaUsuario: estado final de uma partida jogada ao vivo (opcional);
// sem ela, o jogo do usuário também é simulado.
export function jogarData(carreira, dados, { partidaUsuario = null } = {}) {
  exigirFase(carreira, 'temporada');
  return alterar(carreira, (c, rng) => {
    const t = c.temporadaAtual;
    const eu = c.config.clubeId;
    for (const compId of t.calendario[t.indice].comps) {
      const jogos = jogosDaEtapa(t.competicoes[compId]);
      const partidas = new Map();
      let doUsuario = null;
      for (const jogo of jogos) {
        const meu = jogo.casa === eu || jogo.fora === eu;
        let partida;
        if (meu && partidaUsuario) {
          if (partidaUsuario.tempo < 2 || partidaUsuario.casa.id !== jogo.casa || partidaUsuario.fora.id !== jogo.fora) {
            throw new Error('A partida ao vivo não corresponde ao jogo desta data');
          }
          partida = partidaUsuario;
        } else {
          const { casa, fora } = ladosDoJogo(c, dados, jogo);
          partida = simularPartida({ casa, fora, neutro: jogo.neutro, prorrogacao: jogo.prorrogacao }, rng);
        }
        partidas.set(`${jogo.casa}>${jogo.fora}`, partida);
        if (meu) doUsuario = { jogo, partida, penaltis: null };
      }
      const resultados = jogos.map((j) => {
        const p = partidas.get(`${j.casa}>${j.fora}`);
        return { casa: j.casa, fora: j.fora, golsCasa: p.placar.casa, golsFora: p.placar.fora };
      });
      const penaltis = (casaId, foraId) => {
        const p = partidas.get(`${casaId}>${foraId}`);
        const r = disputarPenaltis(setoresDoLado(p.casa, { progresso: 1 }), setoresDoLado(p.fora, { progresso: 1 }), rng);
        if (doUsuario && doUsuario.jogo.casa === casaId && doUsuario.jogo.fora === foraId) doUsuario.penaltis = r;
        return r.vencedor === 'casa' ? casaId : foraId;
      };
      t.competicoes[compId] = registrarEtapa(t.competicoes[compId], resultados, { penaltis, rng });
      if (doUsuario) registrarJogoDoUsuario(c, compId, doUsuario);
    }
    t.indice += 1;
    if (t.indice >= t.calendario.length) encerrarTemporada(c, dados, rng);
  });
}

function registrarJogoDoUsuario(c, compId, { jogo, partida, penaltis }) {
  const t = c.temporadaAtual;
  const lado = jogo.casa === c.config.clubeId ? 'casa' : 'fora';
  c.elenco = aplicarConsequencias(c.elenco, {
    lesoes: partida.lesoes.filter((l) => l.lado === lado),
    expulsos: partida.expulsos.filter((e) => e.lado === lado),
  });
  for (const ev of partida.eventos) {
    if (ev.tipo === 'gol' && ev.lado === lado && ev.jogadorId) t.gols[ev.jogadorId] = (t.gols[ev.jogadorId] ?? 0) + 1;
  }
  t.jogos.push({
    indice: t.indice, compId, casa: jogo.casa, fora: jogo.fora,
    golsCasa: partida.placar.casa, golsFora: partida.placar.fora,
    penaltis: penaltis ? { casa: penaltis.casa, fora: penaltis.fora } : null,
  });
}

function encerrarTemporada(c, dados, rng) {
  const t = c.temporadaAtual;
  const comps = t.competicoes;
  const eu = c.config.clubeId;
  const titulos = Object.keys(comps).filter((id) => comps[id].campeao === eu);
  const ordem = ordenarTabela(comps.brasileirao.tabelas.geral).map((l) => l.id);
  const posicao = ordem.indexOf(eu) + 1;
  const [artId, artGols] = Object.entries(t.gols).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const campanhas = {};
  for (const [id, comp] of Object.entries(comps)) {
    const r = campanha(comp, eu);
    if (r) campanhas[id] = r;
  }
  c.historico.push({
    temporada: c.temporada, titulos, posicaoBrasileirao: posicao, campanhas,
    artilheiro: artId ? { jogadorId: artId, nome: c.elenco.jogadores[artId]?.nome ?? artId, gols: artGols } : null,
  });
  c.vagas = vagasContinentais(ordem, {
    copaDoBrasil: comps.copaDoBrasil?.campeao ?? null,
    libertadores: comps.libertadores?.campeao ?? null,
    sulamericana: comps.sulamericana?.campeao ?? null,
  });
  if (c.temporada >= c.config.duracao) {
    c.fase = 'fim';
    return;
  }
  const { jogadores, aposentados } = envelhecer(Object.values(c.elenco.jogadores), rng);
  c.elenco.jogadores = Object.fromEntries(jogadores.map((j) => [j.id, j]));
  c.elenco.titulares = c.elenco.titulares.map((id) => (c.elenco.jogadores[id] ? id : null));
  c.elenco = completarTitulares(c.elenco);
  c.exJogadores.push(...aposentados.map((j) => j.id));
  c.transferencias = {
    fila: [...aposentados.map(() => ({ tipo: 'reposicao', obrigatoria: true })), ...roletasDoFimDeTemporada(posicao, titulos)],
    atual: null,
    aposentados,
  };
  c.fase = 'transferencias';
}

// ---------- Transferências ----------

export function girarTransferencia(carreira, dados) {
  exigirFase(carreira, 'transferencias');
  const tr = carreira.transferencias;
  if (tr.atual) throw new Error('Resolva a roleta atual antes de girar de novo');
  if (!tr.fila.length) throw new Error('Não há mais roletas nesta janela');
  return alterar(carreira, (c, rng) => {
    const { tipo } = c.transferencias.fila[0];
    const atual = girarRoleta(dados.elencos, rng, {
      tipo: tipo === 'reposicao' ? 'boa' : tipo,
      excluirJogadores: [...Object.keys(c.elenco.jogadores), ...c.exJogadores],
    });
    if (atual) c.transferencias.atual = atual;
    else c.transferencias.fila.shift(); // nada para oferecer: a roleta se perde
  });
}

// saiId: quem deixa o elenco (obrigatório quando o elenco já tem 15; proibido quando tem menos)
export function aceitarTransferencia(carreira, jogadorId, saiId = null) {
  exigirFase(carreira, 'transferencias');
  const tr = carreira.transferencias;
  const escolhido = tr.atual?.opcoes.find((j) => j.id === jogadorId);
  if (!escolhido) throw new Error('Esse jogador não está na roleta atual');
  const cheio = Object.keys(carreira.elenco.jogadores).length >= TAMANHO_ELENCO;
  if (cheio && !saiId) throw new Error('Elenco cheio: escolha quem sai');
  if (!cheio && saiId) throw new Error('O elenco tem vaga: ninguém precisa sair');
  if (saiId && !carreira.elenco.jogadores[saiId]) throw new Error('Quem sai precisa ser do elenco');
  const c = structuredClone(carreira);
  if (saiId) {
    delete c.elenco.jogadores[saiId];
    c.elenco.titulares = c.elenco.titulares.map((id) => (id === saiId ? escolhido.id : id));
    c.exJogadores.push(saiId);
  }
  c.elenco.jogadores[escolhido.id] = novoJogadorDoElenco(escolhido);
  c.elenco = completarTitulares(c.elenco);
  c.transferencias.fila.shift();
  c.transferencias.atual = null;
  return c;
}

export function recusarTransferencia(carreira) {
  exigirFase(carreira, 'transferencias');
  const tr = carreira.transferencias;
  if (!tr.atual) throw new Error('Gire a roleta antes de recusar');
  if (tr.fila[0].obrigatoria) throw new Error('Esta roleta é obrigatória');
  const c = structuredClone(carreira);
  c.transferencias.fila.shift();
  c.transferencias.atual = null;
  return c;
}

export function concluirTransferencias(carreira, dados) {
  exigirFase(carreira, 'transferencias');
  if (carreira.transferencias.fila.length) throw new Error('Ainda há roletas para resolver');
  return iniciarTemporada(carreira, dados);
}

// ---------- Tática ----------

// titulares: 11 ids do elenco (ou null), alinhados às vagas da formação
export function definirTatica(carreira, { formacao, postura, titulares } = {}) {
  if (!['temporada', 'transferencias'].includes(carreira.fase)) throw new Error('Tática só durante a temporada');
  const c = structuredClone(carreira);
  if (formacao) { vagasDaFormacao(formacao); c.elenco.formacao = formacao; }
  if (postura) {
    if (!POSTURAS.includes(postura)) throw new Error('Postura inválida');
    c.elenco.postura = postura;
  }
  if (titulares) {
    const ids = titulares.filter(Boolean);
    if (titulares.length !== 11) throw new Error('São 11 titulares');
    if (new Set(ids).size !== ids.length) throw new Error('Jogador repetido na escalação');
    if (!ids.every((id) => c.elenco.jogadores[id])) throw new Error('Jogador fora do elenco');
    c.elenco.titulares = [...titulares];
  }
  return c;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/engine/carreira.test.js`
Expected: PASS (24 testes, ~3 s — a carreira de 5 temporadas simula ~350 datas).

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: 15 arquivos, 177 testes, todos passando.

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures/dados.js src/engine/carreira.js tests/engine/carreira.test.js
git commit -m "feat(engine): carreira (draft, temporadas, transferências, tática)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
