# Carreira FC — Plano 4: Telas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interface jogável no celular para o motor já pronto: nova carreira, draft com roleta, painel da temporada (abas Jogo/Tabelas/Elenco/Calendário), partida ao vivo (pressão, destaques, intervalo, prorrogação, pênaltis), fim de temporada com janela de transferências e sala de troféus — com salvamento automático no navegador.

**Architecture:** React 19 + Vite 7, sem roteador: o `App` escolhe a tela pela `fase` da carreira. Um `CarreiraProvider` guarda a carreira, chama as funções puras do motor e salva no `localStorage` a cada ação. A lógica de tela que dá para testar sem navegador fica em `src/ui/logica/*` (Vitest). As telas são verificadas por testes de fumaça que usam o app de verdade em jsdom (`@testing-library/react`).

**Tech Stack:** React 19, Vite 7, @vitejs/plugin-react 5, Vitest 3, jsdom 26, @testing-library/react 16. CSS próprio (sem Tailwind).

**Spec:** `docs/superpowers/specs/2026-10-05-telas-design.md` (e `2026-10-05-carreira-fc-design.md` §3).

## Global Constraints

- Branch `plano-4-telas` a partir do `main`, em `C:\Users\User\Desktop\carreira-fc`.
- Textos de tela, nomes e mensagens em **português**.
- Estilo B: tokens em `:root` de `src/ui/estilo.css` (`--fundo #0c1410`, `--superficie #13241b`, `--destaque #c6ff00`, `--perigo #e74c3c`…); um tema só (escuro).
- Mobile-first: `.app` com largura máx. 480 px e 16 px de margem lateral; alvos de toque ≥ 44 px; sem rolagem horizontal.
- A UI **só chama funções do motor**; nenhuma regra de jogo é reimplementada na tela.
- Modo **Olheiro**: nenhuma tela mostra overall de jogador (draft, elenco, intervalo, janela).
- Salvamento: chave `carreira-fc:save`, sempre em `try/catch`; sem armazenamento o jogo funciona (só não salva).
- Sem `React.StrictMode` (a partida ao vivo consome o rng em efeitos; o modo estrito os dispararia duas vezes em desenvolvimento).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Navegador que bloqueia o armazenamento** (aba anônima, cookies bloqueados) — o jogo precisa abrir e jogar normalmente, só sem salvar. Testado na Task 1 ("se o navegador bloquear o armazenamento, nada quebra").
2. **Reabrir o app depois de terminar o draft ou no meio da temporada** — deve abrir em "Continuar" só para a carreira salva e, depois de criar uma nova, nunca voltar a essa tela. Testado na Task 4 ("com save existente, abre na tela Continuar") e no 1º teste de fumaça (o bug original era voltar ao "Continuar" ao fim do draft).
3. **Fechar o app no meio de uma partida ao vivo** — a partida não é salva; ao reabrir, o jogo volta ao painel antes do jogo e a partida recomeça com o mesmo sorteio (`rngDaPartida` depende só da semente, temporada e data), então não dá para "rolar de novo" o resultado. Coberto pelo determinismo do motor (Plano 2).
4. **Modo Olheiro** — overall escondido em todas as telas. Verificar na revisão (Draft, AbaElenco, Partida/Intervalo, FimTemporada/Janela usam a flag `olheiro`).
5. **Erro do motor numa ação** (ex.: troca inválida) — vira aviso na tela, sem travar o app. `CarreiraProvider.executar` captura e mostra `.aviso-erro`; o intervalo usa `alert` para erros de troca.

---

### Task 1: Vite + React e salvamento no navegador

**Files:**
- Modify: `package.json` (scripts e dependências)
- Create: `vite.config.js`, `index.html`
- Create: `src/storage/index.js`
- Test: `tests/storage/storage.test.js`

**Interfaces:**
- Produces: `CHAVE = 'carreira-fc:save'`; `salvar(carreira) → boolean`; `carregar() → carreira | null` (null se não houver, se estiver corrompido ou se `versao !== 1`); `apagar() → void`. Nenhuma lança erro.

- [ ] **Step 1: Branch e dependências**

```bash
git checkout -b plano-4-telas
npm install react@^19 react-dom@^19
npm install -D vite@^7 @vitejs/plugin-react@^5 jsdom@^26 @testing-library/react@^16 @testing-library/dom@^10
```

Em `package.json`, trocar `scripts` por:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 2: Configuração do Vite e página**

`vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: o mesmo build funciona em qualquer subpasta (GitHub Pages no Plano 5)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
```

`index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0c1410" />
    <title>Carreira FC</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Escrever o teste que falha**

`tests/storage/storage.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { salvar, carregar, apagar, CHAVE } from '../../src/storage/index.js';

function memoria() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    dados,
  };
}

describe('storage', () => {
  let original;
  beforeEach(() => { original = globalThis.localStorage; globalThis.localStorage = memoria(); });
  afterEach(() => { globalThis.localStorage = original; });

  it('salva e carrega a carreira', () => {
    const c = { versao: 1, fase: 'draft', temporada: 0 };
    expect(salvar(c)).toBe(true);
    expect(carregar()).toEqual(c);
  });

  it('sem save, carrega null', () => {
    expect(carregar()).toBeNull();
  });

  it('save corrompido ou de outra versão vira null', () => {
    globalThis.localStorage.setItem(CHAVE, '{quebrado');
    expect(carregar()).toBeNull();
    globalThis.localStorage.setItem(CHAVE, JSON.stringify({ versao: 99 }));
    expect(carregar()).toBeNull();
  });

  it('apagar remove o save', () => {
    salvar({ versao: 1 });
    apagar();
    expect(carregar()).toBeNull();
  });

  it('se o navegador bloquear o armazenamento, nada quebra', () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
      removeItem: () => { throw new Error('bloqueado'); },
    };
    expect(salvar({ versao: 1 })).toBe(false);
    expect(carregar()).toBeNull();
    expect(() => apagar()).not.toThrow();
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run tests/storage`
Expected: FAIL — `Cannot find module '../../src/storage/index.js'`.

- [ ] **Step 5: Implementar**

`src/storage/index.js`:
```js
// Salvamento da carreira no navegador. Toda leitura/escrita fica em try/catch:
// em aba anônima ou com o armazenamento bloqueado, o jogo continua funcionando (só não salva).

export const CHAVE = 'carreira-fc:save';

function armazenamento() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function salvar(carreira) {
  try {
    armazenamento()?.setItem(CHAVE, JSON.stringify(carreira));
    return true;
  } catch {
    return false;
  }
}

export function carregar() {
  try {
    const txt = armazenamento()?.getItem(CHAVE);
    if (!txt) return null;
    const c = JSON.parse(txt);
    return c && c.versao === 1 ? c : null;
  } catch {
    return null;
  }
}

export function apagar() {
  try {
    armazenamento()?.removeItem(CHAVE);
  } catch {
    // nada a fazer
  }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run tests/storage`
Expected: PASS (5 testes). Depois `npm test` — tudo verde (267 + 5).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html src/storage tests/storage
git commit -m "feat(ui): Vite + React e salvamento no navegador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Gols na carreira (motor)

**Files:**
- Modify: `src/engine/carreira.js` (`novaCarreira` e `encerrarTemporada`)
- Test: `tests/engine/carreira.test.js`

**Interfaces:**
- Produces: `carreira.golsNaCarreira: { [jogadorId]: { nome, gols } }` — começa `{}` e soma os gols de `temporadaAtual.gols` no fim de cada temporada (usado pelo "artilheiro da história" na Task 6).

- [ ] **Step 1: Escrever o teste que falha** — acrescentar ao fim de `tests/engine/carreira.test.js`:

```js
describe('gols na carreira', () => {
  it('soma os gols de cada jogador temporada após temporada', () => {
    const c1 = jogarTemporada(draftCompleto(nova()));
    const soma = (o) => Object.values(o).reduce((s, x) => s + x, 0);
    const golsT1 = soma(c1.temporadaAtual.gols);
    expect(Object.values(c1.golsNaCarreira).reduce((s, x) => s + x.gols, 0)).toBe(golsT1);
    for (const [id, g] of Object.entries(c1.temporadaAtual.gols)) {
      expect(c1.golsNaCarreira[id]).toEqual({ nome: c1.elenco.jogadores[id]?.nome ?? expect.any(String), gols: g });
    }
    const c2 = jogarTemporada(resolverJanela(c1));
    const total = Object.values(c2.golsNaCarreira).reduce((s, x) => s + x.gols, 0);
    expect(total).toBe(golsT1 + soma(c2.temporadaAtual.gols));
  });

  it('carreira nova começa sem gols', () => {
    expect(nova().golsNaCarreira).toEqual({});
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/carreira.test.js -t "gols na carreira"`
Expected: FAIL (2) — `golsNaCarreira` é `undefined`.

- [ ] **Step 3: Implementar** — em `src/engine/carreira.js`:

Em `novaCarreira`, logo depois de `exJogadores: [],`:
```js
    golsNaCarreira: {},
```

Em `encerrarTemporada`, logo antes de `c.historico.push({`:
```js
  for (const [id, gols] of Object.entries(t.gols)) {
    const antes = c.golsNaCarreira[id];
    c.golsNaCarreira[id] = { nome: c.elenco.jogadores[id]?.nome ?? antes?.nome ?? id, gols: (antes?.gols ?? 0) + gols };
  }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/engine/carreira.test.js`
Expected: PASS (todos, incluindo os 2 novos).

- [ ] **Step 5: Commit**

```bash
git add src/engine/carreira.js tests/engine/carreira.test.js
git commit -m "feat(engine): gols de cada jogador ao longo da carreira

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lógica de tela (sem navegador)

**Files:**
- Create: `src/ui/logica/partida.js`, `src/ui/logica/escalacao.js`, `src/ui/logica/temporada.js`
- Test: `tests/ui/partida.test.js`, `tests/ui/escalacao.test.js`, `tests/ui/temporada.test.js`

**Interfaces:**
- Consumes: `fatorPosicao`, `ovrEfetivo` (posicoes.js); `NOMES` (competicoes.js); `jogarData`, `proximaData` (carreira.js); fixture `tests/fixtures/dados.js`.
- Produces:
  - `partida.js`: `narrar(evento, { casa, fora }) → string`; `TIPOS_DESTAQUE`; `eventosAte(eventos, minuto)`; `pressao(eventos, minuto, janela = 15) → { casa, fora }` (frações); `contarChances(eventos, minuto) → { casa, fora }`; `faixaCansaco(v) → 'verde' | 'amarelo' | 'vermelho'`; `PERIODOS`; `minutoNoPeriodo(periodo, fracao)`; `rotuloRelogio(minuto, periodo, acrescimos)`.
  - `escalacao.js`: `avaliarVaga(jogador, vaga, dificuldade) → { ovr, fator, texto }`; `reorganizar(jogadores, vagas) → (id | null)[]`; `posicoesNoCampo(vagas) → [{ x, y }]` (%).
  - `temporada.js`: `ORDEM_COMPETICOES`; `nomeCompeticao(compId, carreira, dados)`; `descreverEtapa(comp, etapa)`; `infoProximoJogo(carreira, dados) → { indice, tipo, compId, jogo, importante, titulo, ida, mando, perna }`; `resultadoDoUsuario(jogo, eu) → { letra, meus, deles, penaltis, adversario, emCasa }`; `ultimosResultados(carreira, n = 5)`; `linhasDoCalendario(carreira, dados)`; `simularAteImportante(carreira, dados, limite = 100) → { carreira, jogos }`; `totalTitulos(carreira)`; `competicoesDaProxima(carreira)`; `salaDeTrofeus(carreira)`; `artilheiroDaHistoria(carreira)`.

- [ ] **Step 1: Escrever os testes que falham**

`tests/ui/partida.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  narrar, eventosAte, pressao, contarChances, faixaCansaco, minutoNoPeriodo, rotuloRelogio,
} from '../../src/ui/logica/partida.js';

const nomes = { casa: 'Santos', fora: 'Palmeiras' };

describe('narrar', () => {
  it('gol com autor usa o nome do jogador', () => {
    const t = narrar({ tipo: 'gol', minuto: 64, lado: 'casa', nome: 'Pelé' }, nomes);
    expect(t).toContain('Pelé');
    expect(t).not.toContain('{');
  });

  it('gol sem autor (clube do computador) usa o nome do clube', () => {
    expect(narrar({ tipo: 'gol', minuto: 10, lado: 'fora', nome: null }, nomes)).toMatch(/Palmeiras/);
  });

  it('lesão diz quantos jogos fica fora; troca diz quem entra', () => {
    expect(narrar({ tipo: 'lesao', minuto: 30, lado: 'casa', nome: 'Zito', jogos: 2 }, nomes)).toContain('2 jogos fora');
    expect(narrar({ tipo: 'lesao', minuto: 30, lado: 'casa', nome: 'Zito', jogos: 1 }, nomes)).toContain('1 jogo fora');
    expect(narrar({ tipo: 'troca', minuto: 45, lado: 'casa', nome: 'Zito', entraNome: 'Lima' }, nomes)).toBe('Sai Zito, entra Lima.');
  });

  it('é determinística: mesmo evento, mesma frase', () => {
    const e = { tipo: 'chance', minuto: 33, lado: 'casa', nome: 'Pepe' };
    expect(narrar(e, nomes)).toBe(narrar(e, nomes));
  });

  it('varia a frase conforme o minuto', () => {
    const frases = new Set([1, 2, 3, 4].map((m) => narrar({ tipo: 'gol', minuto: m, lado: 'casa', nome: 'X' }, nomes)));
    expect(frases.size).toBeGreaterThan(1);
  });
});

describe('relógio e eventos', () => {
  const eventos = [
    { tipo: 'chance', minuto: 5, lado: 'casa' },
    { tipo: 'gol', minuto: 20, lado: 'casa' },
    { tipo: 'chance', minuto: 25, lado: 'fora' },
    { tipo: 'troca', minuto: 45, lado: 'casa' },
    { tipo: 'chance', minuto: 60, lado: 'fora' },
  ];

  it('eventosAte revela só o que já aconteceu', () => {
    expect(eventosAte(eventos, 20).map((e) => e.minuto)).toEqual([5, 20]);
  });

  it('pressão olha os últimos 15 minutos e só lances de ataque', () => {
    expect(pressao(eventos, 26)).toEqual({ casa: 0.5, fora: 0.5 });
    expect(pressao(eventos, 22)).toEqual({ casa: 1, fora: 0 });
    expect(pressao(eventos, 50)).toEqual({ casa: 0.5, fora: 0.5 }); // nenhum lance entre 35 e 50
  });

  it('contarChances soma gols e chances de cada lado', () => {
    expect(contarChances(eventos, 90)).toEqual({ casa: 2, fora: 2 });
  });

  it('minutoNoPeriodo vai do início ao fim do período', () => {
    expect(minutoNoPeriodo('primeiro', 0)).toBe(0);
    expect(minutoNoPeriodo('primeiro', 0.5)).toBe(22);
    expect(minutoNoPeriodo('segundo', 1)).toBe(90);
    expect(minutoNoPeriodo('prorrogacao', 2)).toBe(120);
  });

  it('rotuloRelogio mostra os acréscimos no fim de cada tempo', () => {
    const acr = { primeiro: 2, segundo: 5 };
    expect(rotuloRelogio(30, 'primeiro', acr)).toBe("30'");
    expect(rotuloRelogio(45, 'primeiro', acr)).toBe("45+2'");
    expect(rotuloRelogio(90, 'segundo', acr)).toBe("90+5'");
    expect(rotuloRelogio(120, 'prorrogacao', acr)).toBe("120'");
  });
});

describe('faixaCansaco', () => {
  it.each([[0, 'verde'], [49, 'verde'], [50, 'amarelo'], [69, 'amarelo'], [70, 'vermelho'], [100, 'vermelho']])('%i: %s', (v, f) => {
    expect(faixaCansaco(v)).toBe(f);
  });
});
```

`tests/ui/escalacao.test.js`:
```js
import { describe, it, expect } from 'vitest';
import formacoes from '../../src/data/formacoes.json';
import { avaliarVaga, reorganizar, posicoesNoCampo } from '../../src/ui/logica/escalacao.js';

const j = (id, pos, ovr = 80) => ({ id, pos, ovr });

describe('avaliarVaga', () => {
  it('clássico mostra o overall efetivo e a perda', () => {
    expect(avaliarVaga(j('p', 'CA', 97), 'CA')).toMatchObject({ ovr: 97, texto: '97' });
    expect(avaliarVaga(j('p', 'CA', 97), 'PE')).toMatchObject({ ovr: 89, texto: '89 (−8%)' });
    expect(avaliarVaga(j('p', 'ZAG', 80), 'GOL').texto).toBe('40 (−50%)');
  });

  it('olheiro esconde números e mostra só o tipo de encaixe', () => {
    expect(avaliarVaga(j('p', 'CA', 97), 'CA', 'olheiro')).toEqual({ ovr: null, fator: 1, texto: 'posição natural' });
    expect(avaliarVaga(j('p', 'CA', 97), 'PE', 'olheiro').texto).toBe('posição vizinha');
    expect(avaliarVaga(j('p', 'ZAG', 80), 'CA', 'olheiro').texto).toBe('fora de posição');
    expect(avaliarVaga(j('p', 'ZAG', 80), 'GOL', 'olheiro').texto).toBe('improvisado');
  });
});

describe('reorganizar', () => {
  const vagas433 = formacoes.find((f) => f.id === '4-3-3').vagas;

  it('cada jogador vai para a sua posição quando dá', () => {
    const jogadores = vagas433.map((v, i) => j(`j${i}`, v)).reverse();
    const ids = reorganizar(jogadores, vagas433);
    ids.forEach((id, i) => expect(jogadores.find((x) => x.id === id).pos).toBe(vagas433[i]));
  });

  it('o goleiro é escolhido primeiro', () => {
    const jogadores = [j('gol', 'GOL', 70), j('craque', 'CA', 95), ...Array.from({ length: 9 }, (_, i) => j(`z${i}`, 'ZAG', 75))];
    expect(reorganizar(jogadores, vagas433)[0]).toBe('gol');
  });

  it('com menos de 11 jogadores sobram vagas vazias', () => {
    const ids = reorganizar([j('a', 'GOL'), j('b', 'CA')], vagas433);
    expect(ids.filter(Boolean)).toHaveLength(2);
    expect(ids.filter((x) => x === null)).toHaveLength(9);
  });
});

describe('posicoesNoCampo', () => {
  it('goleiro embaixo, centroavante em cima, laterais nas pontas certas', () => {
    const vagas = formacoes.find((f) => f.id === '4-3-3').vagas; // GOL LD ZAG ZAG LE VOL MC MC PD CA PE
    const p = posicoesNoCampo(vagas);
    expect(p).toHaveLength(11);
    expect(p[0].y).toBeGreaterThan(p[9].y);
    expect(p[4].x).toBeLessThan(p[1].x); // LE à esquerda do LD
    expect(p[10].x).toBeLessThan(p[8].x); // PE à esquerda do PD
    for (const { x, y } of p) {
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(100);
      expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(100);
    }
  });

  it('jogadores na mesma linha não se sobrepõem', () => {
    const vagas = formacoes.find((f) => f.id === '4-2-2-2').vagas;
    const p = posicoesNoCampo(vagas);
    const chaves = p.map(({ x, y }) => `${x}-${y}`);
    expect(new Set(chaves).size).toBe(11);
  });
});
```

`tests/ui/temporada.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarDados } from '../fixtures/dados.js';
import { novaCarreira, girarDraft, escolherNoDraft, jogarData, proximaData } from '../../src/engine/carreira.js';
import {
  nomeCompeticao, infoProximoJogo, resultadoDoUsuario, ultimosResultados, linhasDoCalendario,
  simularAteImportante, totalTitulos, competicoesDaProxima, salaDeTrofeus, artilheiroDaHistoria,
} from '../../src/ui/logica/temporada.js';

const dados = criarDados();

function comecar() {
  let c = novaCarreira({ dados, clubeId: 'a0', duracao: 5, semente: 7 });
  for (let i = 0; i < 15; i++) {
    c = girarDraft(c, dados);
    c = escolherNoDraft(c, dados, c.draft.atual.opcoes[0].id, i < 11 ? i : 'banco');
  }
  return c;
}

describe('nomes e próximo jogo', () => {
  it('estadual usa o nome do campeonato do estado do clube', () => {
    expect(nomeCompeticao('estadual', comecar(), dados)).toBe('Campeonato AA');
    expect(nomeCompeticao('brasileirao', comecar(), dados)).toBe('Brasileirão');
  });

  it('infoProximoJogo descreve competição, rodada e mando', () => {
    const info = infoProximoJogo(comecar(), dados);
    expect(info.titulo).toBe('Campeonato AA · Rodada 1');
    expect(['casa', 'fora']).toContain(info.mando);
    expect(info.ida).toBeNull();
    expect(info.perna).toBeNull();
  });

  it('na semifinal do estadual mostra a fase', () => {
    let c = comecar();
    for (let i = 0; i < 11; i++) c = jogarData(c, dados);
    const info = infoProximoJogo(c, dados);
    if (info.jogo) { expect(info.titulo).toBe('Campeonato AA · Semifinal'); expect(info.perna).toBe('unico'); }
    else expect(info.titulo).toBe('Campeonato AA');
  });
});

describe('resultadoDoUsuario', () => {
  it('vitória, derrota e empate do ponto de vista do usuário', () => {
    expect(resultadoDoUsuario({ casa: 'eu', fora: 'x', golsCasa: 2, golsFora: 1 }, 'eu')).toMatchObject({ letra: 'V', meus: 2, deles: 1, adversario: 'x', emCasa: true });
    expect(resultadoDoUsuario({ casa: 'x', fora: 'eu', golsCasa: 2, golsFora: 1 }, 'eu')).toMatchObject({ letra: 'D', meus: 1, deles: 2, emCasa: false });
    expect(resultadoDoUsuario({ casa: 'x', fora: 'eu', golsCasa: 0, golsFora: 0 }, 'eu').letra).toBe('E');
  });

  it('empate decidido nos pênaltis conta como vitória ou derrota', () => {
    const r = resultadoDoUsuario({ casa: 'x', fora: 'eu', golsCasa: 1, golsFora: 1, penaltis: { casa: 3, fora: 4 } }, 'eu');
    expect(r).toMatchObject({ letra: 'V', penaltis: { meus: 4, deles: 3 } });
  });
});

describe('ultimosResultados e calendário', () => {
  it('ultimosResultados traz no máximo 5', () => {
    let c = comecar();
    for (let i = 0; i < 8; i++) c = jogarData(c, dados);
    const r = ultimosResultados(c);
    expect(r).toHaveLength(5);
    for (const x of r) expect(['V', 'E', 'D']).toContain(x.letra);
  });

  it('calendário tem uma linha por data, com resultados no passado e adversário nas rodadas futuras', () => {
    let c = comecar();
    for (let i = 0; i < 3; i++) c = jogarData(c, dados);
    const linhas = linhasDoCalendario(c, dados);
    expect(linhas).toHaveLength(c.temporadaAtual.calendario.length);
    expect(linhas.slice(0, 3).every((l) => l.resultado)).toBe(true);
    expect(linhas[3].atual).toBe(true);
    expect(linhas[3].adversario).toBe(proximaData(c, dados).jogo.casa === 'a0' ? proximaData(c, dados).jogo.fora : proximaData(c, dados).jogo.casa);
    const brasileirao = linhas.filter((l) => l.compId === 'brasileirao');
    expect(brasileirao).toHaveLength(38);
    expect(brasileirao.every((l) => l.adversario)).toBe(true);
  });
});

describe('simularAteImportante', () => {
  it('para antes do próximo jogo importante, sem jogá-lo', () => {
    const c0 = comecar();
    const { carreira, jogos } = simularAteImportante(c0, dados);
    expect(jogos.length).toBeGreaterThan(0);
    if (carreira.fase === 'temporada') expect(proximaData(carreira, dados).importante).toBe(true);
  });

  it('sempre joga pelo menos a data atual', () => {
    const c0 = comecar();
    const { carreira } = simularAteImportante(c0, dados);
    expect(carreira.temporadaAtual.indice).toBeGreaterThan(0);
  });
});

describe('troféus e próxima temporada', () => {
  function temporadaCompleta() {
    let c = comecar();
    while (c.fase === 'temporada') c = jogarData(c, dados);
    return c;
  }

  it('competicoesDaProxima inclui Copa do Brasil e no máximo uma continental', () => {
    const c = temporadaCompleta();
    const lista = competicoesDaProxima(c);
    expect(lista.slice(0, 3)).toEqual(['estadual', 'brasileirao', 'copaDoBrasil']);
    expect(lista.length).toBeLessThanOrEqual(4);
  });

  it('sala de troféus agrupa por competição e soma com totalTitulos', () => {
    const c = { historico: [{ temporada: 1, titulos: ['estadual'] }, { temporada: 2, titulos: ['brasileirao', 'estadual'] }] };
    expect(salaDeTrofeus(c)).toEqual([{ compId: 'brasileirao', temporadas: [2] }, { compId: 'estadual', temporadas: [1, 2] }]);
    expect(totalTitulos(c)).toBe(3);
  });

  it('artilheiro da história é quem tem mais gols na carreira', () => {
    expect(artilheiroDaHistoria({ golsNaCarreira: { a: { nome: 'A', gols: 3 }, b: { nome: 'B', gols: 9 } } })).toEqual({ id: 'b', nome: 'B', gols: 9 });
    expect(artilheiroDaHistoria({ golsNaCarreira: {} })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/ui`
Expected: FAIL — `Cannot find module` para os três arquivos de `src/ui/logica/`.

- [ ] **Step 3: Implementar a lógica da partida**

`src/ui/logica/partida.js`:
```js
// Lógica pura da partida ao vivo: narração, relógio, pressão e cansaço.

const FRASES = {
  gol: ['GOL! {jogador} balança a rede!', 'É GOL! {jogador} não perdoa!', 'Golaço de {jogador}!', '{jogador} manda pro fundo do gol!'],
  golSemNome: ['Gol do {clube}!', 'É gol do {clube}!'],
  chance: ['Chute de {jogador}, pra fora.', 'Defesaça do goleiro na finalização de {jogador}!', '{jogador} cabeceia por cima do gol.', 'Bola na trave! {jogador} quase marca.'],
  chanceSemNome: ['O {clube} assusta.', 'Chance do {clube}, mas a zaga afasta.', 'Finalização do {clube} passa raspando.'],
  var: ['VAR chamado... gol de {jogador} anulado!', 'Impedimento! O VAR anula o gol de {jogador}.'],
  varSemNome: ['VAR anula o gol do {clube}!'],
  vermelho: ['Cartão vermelho! {jogador} está expulso.', 'Entrada dura e {jogador} recebe o vermelho!'],
  vermelhoSemNome: ['Expulsão no {clube}!'],
  lesao: ['{jogador} sente e sai lesionado ({jogos}).'],
  troca: ['Sai {jogador}, entra {entra}.'],
};

const plural = (n) => (n === 1 ? '1 jogo fora' : `${n} jogos fora`);

// nomes: { casa: 'Flamengo', fora: 'Palmeiras' }
export function narrar(evento, nomes) {
  const semNome = !evento.nome && FRASES[`${evento.tipo}SemNome`];
  const lista = semNome || FRASES[evento.tipo] || ['{jogador}'];
  const frase = lista[evento.minuto % lista.length];
  return frase
    .replaceAll('{jogador}', evento.nome ?? '')
    .replaceAll('{clube}', nomes[evento.lado] ?? '')
    .replaceAll('{entra}', evento.entraNome ?? '')
    .replaceAll('{jogos}', plural(evento.jogos ?? 1));
}

export const TIPOS_DESTAQUE = ['gol', 'var', 'vermelho', 'lesao'];

export function eventosAte(eventos, minuto) {
  return eventos.filter((e) => e.minuto <= minuto);
}

const LANCES = ['chance', 'gol', 'var'];

// Fração das chances de cada lado nos últimos `janela` minutos até `minuto`.
export function pressao(eventos, minuto, janela = 15) {
  const recentes = eventos.filter((e) => LANCES.includes(e.tipo) && e.minuto <= minuto && e.minuto > minuto - janela);
  const casa = recentes.filter((e) => e.lado === 'casa').length;
  const fora = recentes.length - casa;
  if (!recentes.length) return { casa: 0.5, fora: 0.5 };
  return { casa: casa / recentes.length, fora: fora / recentes.length };
}

export function contarChances(eventos, minuto) {
  const lances = eventos.filter((e) => LANCES.includes(e.tipo) && e.minuto <= minuto);
  const casa = lances.filter((e) => e.lado === 'casa').length;
  return { casa, fora: lances.length - casa };
}

export function faixaCansaco(valor) {
  if (valor >= 70) return 'vermelho';
  if (valor >= 50) return 'amarelo';
  return 'verde';
}

// Períodos do relógio: { inicio, fim } em minutos de jogo.
export const PERIODOS = {
  primeiro: { inicio: 0, fim: 45 },
  segundo: { inicio: 45, fim: 90 },
  prorrogacao: { inicio: 90, fim: 120 },
};

// fracao 0..1 do tempo real -> minuto de jogo (inteiro)
export function minutoNoPeriodo(periodo, fracao) {
  const { inicio, fim } = PERIODOS[periodo];
  return Math.min(fim, Math.floor(inicio + (fim - inicio) * Math.max(0, Math.min(1, fracao))));
}

export function rotuloRelogio(minuto, periodo, acrescimos) {
  const { fim } = PERIODOS[periodo];
  if (minuto >= fim && acrescimos && periodo !== 'prorrogacao') {
    const extra = periodo === 'primeiro' ? acrescimos.primeiro : acrescimos.segundo;
    return `${fim}+${extra}'`;
  }
  return `${minuto}'`;
}
```

- [ ] **Step 4: Implementar a lógica de escalação**

`src/ui/logica/escalacao.js`:
```js
// Lógica pura de escalação para as telas: encaixe na vaga, reorganização e desenho do campinho.
import { fatorPosicao, ovrEfetivo } from '../../engine/posicoes.js';

const ROTULO = { 1: 'posição natural', 0.92: 'posição vizinha', 0.8: 'fora de posição', 0.5: 'improvisado' };

// { ovr, fator, texto } — no modo olheiro o texto não revela números
export function avaliarVaga(jogador, vaga, dificuldade = 'classico') {
  const fator = fatorPosicao(jogador.pos, vaga);
  const ovr = ovrEfetivo(jogador, vaga);
  if (dificuldade === 'olheiro') return { ovr: null, fator, texto: ROTULO[fator] };
  const perda = Math.round((1 - fator) * 100);
  return { ovr, fator, texto: perda ? `${ovr} (−${perda}%)` : `${ovr}` };
}

// Distribui jogadores nas vagas pelo melhor encaixe (goleiro primeiro). Retorna ids alinhados às vagas
// (null quando faltam jogadores).
export function reorganizar(jogadores, vagas) {
  const livres = [...jogadores];
  const ordem = vagas.map((_, i) => i).sort((a, b) => (vagas[b] === 'GOL') - (vagas[a] === 'GOL'));
  const res = Array(vagas.length).fill(null);
  for (const i of ordem) {
    if (!livres.length) break;
    let melhor = 0;
    for (let k = 1; k < livres.length; k++) {
      if (ovrEfetivo(livres[k], vagas[i]) > ovrEfetivo(livres[melhor], vagas[i])) melhor = k;
    }
    res[i] = livres.splice(melhor, 1)[0].id;
  }
  return res;
}

// Altura (em % do campo, 0 = ataque no topo) e lado preferido de cada posição.
const ALTURA = { GOL: 90, ZAG: 72, LD: 68, LE: 68, VOL: 56, MC: 46, MEI: 34, PD: 20, PE: 20, CA: 11 };
const LADO = { LE: -1, PE: -1, LD: 1, PD: 1 };

// [{ x, y }] em % para cada vaga, espalhando quem divide a mesma linha.
export function posicoesNoCampo(vagas) {
  const linhas = new Map();
  vagas.forEach((v, i) => {
    const y = ALTURA[v];
    if (!linhas.has(y)) linhas.set(y, []);
    linhas.get(y).push(i);
  });
  const pos = [];
  for (const [y, idx] of linhas) {
    const ordenados = [...idx].sort((a, b) => (LADO[vagas[a]] ?? 0) - (LADO[vagas[b]] ?? 0) || a - b);
    ordenados.forEach((i, k) => {
      pos[i] = { x: Math.round(((k + 1) / (ordenados.length + 1)) * 100), y };
    });
  }
  return pos;
}
```

- [ ] **Step 5: Implementar a lógica da temporada**

`src/ui/logica/temporada.js`:
```js
// Lógica pura do painel da temporada: textos, calendário, simulação em sequência e troféus.
import { NOMES } from '../../engine/competicoes.js';
import { jogarData, proximaData } from '../../engine/carreira.js';

export const ORDEM_COMPETICOES = ['brasileirao', 'libertadores', 'copaDoBrasil', 'sulamericana', 'estadual'];

export function nomeCompeticao(compId, carreira, dados) {
  if (compId === 'estadual') {
    const clube = dados.clubes.find((x) => x.id === carreira.config.clubeId);
    return dados.estaduais[clube.estado]?.nome ?? NOMES.estadual;
  }
  return NOMES[compId] ?? compId;
}

export function descreverEtapa(comp, etapa) {
  if (etapa.tipo === 'rodada') {
    const grupos = Object.keys(comp.tabelas).some((k) => k !== 'geral');
    return grupos ? `Fase de grupos · Rodada ${etapa.n + 1}` : `Rodada ${etapa.n + 1}`;
  }
  const nome = comp.fases[etapa.fase].nome;
  if (etapa.perna === 'ida') return `${nome} · Ida`;
  if (etapa.perna === 'volta') return `${nome} · Volta`;
  return nome;
}

// Próximo jogo com textos prontos para o cartão da aba Jogo.
export function infoProximoJogo(carreira, dados) {
  const p = proximaData(carreira, dados);
  const t = carreira.temporadaAtual;
  if (!p.jogo) {
    const nomes = t.calendario[t.indice].comps.map((id) => nomeCompeticao(id, carreira, dados));
    return { ...p, titulo: nomes.join(' / '), ida: null, mando: null, perna: null };
  }
  const comp = t.competicoes[p.compId];
  const etapa = comp.etapas[comp.proxima];
  let ida = null;
  if (etapa.tipo === 'fase' && etapa.perna === 'volta') {
    ida = comp.fases[etapa.fase].idas.find((r) => r.casa === p.jogo.fora && r.fora === p.jogo.casa) ?? null;
  }
  const eu = carreira.config.clubeId;
  const mando = p.jogo.neutro ? 'neutro' : p.jogo.casa === eu ? 'casa' : 'fora';
  const perna = etapa.tipo === 'fase' ? etapa.perna : null;
  return { ...p, titulo: `${nomeCompeticao(p.compId, carreira, dados)} · ${descreverEtapa(comp, etapa)}`, ida, mando, perna };
}

// Resultado de um jogo do ponto de vista do usuário.
export function resultadoDoUsuario(jogo, eu) {
  const emCasa = jogo.casa === eu;
  const meus = emCasa ? jogo.golsCasa : jogo.golsFora;
  const deles = emCasa ? jogo.golsFora : jogo.golsCasa;
  let letra = meus > deles ? 'V' : meus < deles ? 'D' : 'E';
  let penaltis = null;
  if (jogo.penaltis) {
    const pm = emCasa ? jogo.penaltis.casa : jogo.penaltis.fora;
    const pd = emCasa ? jogo.penaltis.fora : jogo.penaltis.casa;
    penaltis = { meus: pm, deles: pd };
  }
  if (letra === 'E' && penaltis) letra = penaltis.meus > penaltis.deles ? 'V' : 'D';
  return { letra, meus, deles, penaltis, adversario: emCasa ? jogo.fora : jogo.casa, emCasa };
}

export function ultimosResultados(carreira, n = 5) {
  const eu = carreira.config.clubeId;
  return carreira.temporadaAtual.jogos.slice(-n).map((j) => ({ ...resultadoDoUsuario(j, eu), compId: j.compId }));
}

// Uma linha por data: { indice, compId, titulo, adversario, resultado, atual, meu }
export function linhasDoCalendario(carreira, dados) {
  const t = carreira.temporadaAtual;
  const eu = carreira.config.clubeId;
  const vezes = {};
  return t.calendario.map((data, indice) => {
    const etapaDe = {};
    for (const id of data.comps) { etapaDe[id] = vezes[id] ?? 0; vezes[id] = etapaDe[id] + 1; }
    const registrado = t.jogos.find((j) => j.indice === indice);
    const base = { indice, atual: indice === t.indice };
    if (registrado) {
      return {
        ...base, compId: registrado.compId, meu: true, titulo: nomeCompeticao(registrado.compId, carreira, dados),
        adversario: resultadoDoUsuario(registrado, eu).adversario, resultado: resultadoDoUsuario(registrado, eu),
      };
    }
    // jogo futuro: só dá para saber o adversário em rodadas de pontos corridos/grupos
    for (const id of data.comps) {
      const comp = t.competicoes[id];
      if (!comp.participantes.includes(eu)) continue;
      const etapa = comp.etapas[etapaDe[id]];
      let adversario = null;
      if (etapa?.tipo === 'rodada') {
        for (const rodadas of Object.values(comp.rodadas)) {
          const j = rodadas[etapa.n]?.find((x) => x.casa === eu || x.fora === eu);
          if (j) adversario = j.casa === eu ? j.fora : j.casa;
        }
      }
      if (indice < t.indice && !adversario) continue; // fase passada sem jogo meu (eliminado)
      return { ...base, compId: id, meu: true, titulo: nomeCompeticao(id, carreira, dados), adversario, resultado: null };
    }
    return { ...base, compId: data.comps[0], meu: false, titulo: data.comps.map((id) => nomeCompeticao(id, carreira, dados)).join(' / '), adversario: null, resultado: null };
  });
}

// Joga datas em sequência até a próxima marcada como importante (sem jogá-la) ou até a temporada acabar.
export function simularAteImportante(carreira, dados, limite = 100) {
  let c = carreira;
  const jogos = [];
  for (let i = 0; i < limite && c.fase === 'temporada'; i++) {
    if (i > 0 && proximaData(c, dados).importante) break;
    const antes = c.temporadaAtual.jogos.length;
    c = jogarData(c, dados);
    if (c.temporadaAtual.jogos.length > antes) jogos.push(c.temporadaAtual.jogos.at(-1));
  }
  return { carreira: c, jogos };
}

export function totalTitulos(carreira) {
  return carreira.historico.reduce((s, h) => s + h.titulos.length, 0);
}

// Competições que o usuário disputa na temporada seguinte (a partir das vagas já calculadas).
export function competicoesDaProxima(carreira) {
  if (!carreira.vagas) return [];
  const eu = carreira.config.clubeId;
  const lista = ['estadual', 'brasileirao', 'copaDoBrasil'];
  if (carreira.vagas.libertadores.includes(eu)) lista.push('libertadores');
  else if (carreira.vagas.sulamericana.includes(eu)) lista.push('sulamericana');
  return lista;
}

// [{ compId, temporadas: [n] }] na ordem de importância
export function salaDeTrofeus(carreira) {
  const por = {};
  for (const h of carreira.historico) for (const t of h.titulos) (por[t] ??= []).push(h.temporada);
  return ORDEM_COMPETICOES.filter((id) => por[id]).map((compId) => ({ compId, temporadas: por[compId] }));
}

export function artilheiroDaHistoria(carreira) {
  const lista = Object.entries(carreira.golsNaCarreira ?? {}).map(([id, x]) => ({ id, ...x }));
  lista.sort((a, b) => b.gols - a.gols);
  return lista[0] ?? null;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run tests/ui`
Expected: PASS (16 + 7 + 12 testes).

- [ ] **Step 7: Commit**

```bash
git add src/ui/logica tests/ui/partida.test.js tests/ui/escalacao.test.js tests/ui/temporada.test.js
git commit -m "feat(ui): lógica de tela (narração, pressão, escalação, calendário, troféus)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Base visual, nova carreira e draft

**Files:**
- Create: `src/ui/estilo.css`, `src/ui/estado/CarreiraContext.jsx`
- Create: `src/ui/componentes/Distintivo.jsx`, `Campinho.jsx`, `Roleta.jsx`
- Create: `src/ui/telas/Inicio.jsx`, `NovaCarreira.jsx`, `Draft.jsx`
- Create: `src/ui/App.jsx` (versão 1), `src/main.jsx`
- Test: `tests/ui/ajuda.jsx`, `tests/ui/app-inicio.test.jsx`

**Interfaces:**
- Consumes: Tasks 1 e 3; motor (`novaCarreira`, `girarDraft`, `usarCuringa`, `escolherNoDraft`, `vagasDaFormacao`, `TAMANHO_BANCO`); `dados` (`src/data/index.js`).
- Produces:
  - `CarreiraProvider({ dados, inicial?, children })` e `useCarreira() → { carreira, dados, executar(fn), encerrar(), erro, limparErro() }`. `executar(fn)` aplica `fn(carreira)`, salva e devolve a nova carreira; em erro mostra aviso e devolve `null`. `inicial` (opcional) substitui o save — usado nos testes.
  - `Distintivo({ sigla, cores, ano?, tamanho })`, `clubeVisual(dados, id) → { sigla, cores, nome }`, `DistintivoClube({ dados, id, tamanho })`.
  - `Campinho({ vagas, ocupantes, selecionada?, alvos?, avaliacao?(i), onVaga?(i), mostrarOvr? })` — cada vaga é um botão com `aria-label` "Vaga X: Nome" ou "Vaga X vazia".
  - `Roleta({ elencos, alvoId, onFim })`, `DURACAO_ROLETA = 2200`.
  - Telas `Inicio({ onContinuar })`, `NovaCarreira()`, `Draft()`.

- [ ] **Step 1: Escrever o apoio e o teste de fumaça que falha**

`tests/ui/ajuda.jsx`:
```jsx
import { vi, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { dados } from '../../src/data/index.js';
import { CarreiraProvider } from '../../src/ui/estado/CarreiraContext.jsx';
import { App } from '../../src/ui/App.jsx';

// Apoio para os testes de fumaça: usam o app de verdade num navegador simulado (jsdom).
export const clicar = (el) => act(() => { fireEvent.click(el); });
export const passar = (ms) => act(() => { vi.advanceTimersByTime(ms); });
export const botoes = () => screen.getAllByRole('button');

export function montar(inicial = null) {
  return render(<CarreiraProvider dados={dados} inicial={inicial}><App /></CarreiraProvider>);
}

// Escolhe o Flamengo e completa o draft pela tela: sempre o 1º jogador, na 1ª vaga livre ou no banco.
export async function fazerDraft() {
  await clicar(screen.getByText('Flamengo'));
  await clicar(screen.getByText('Bora girar a roleta!'));
  expect(screen.getByText('Draft')).toBeTruthy();
  for (let i = 0; i < 15; i++) {
    await clicar(screen.getByText('⚽ Puxar a alavanca'));
    await passar(2500);
    await clicar(botoes().find((b) => /anos/.test(b.textContent)));
    const vagaLivre = botoes().find((b) => /vazia$/.test(b.getAttribute('aria-label') ?? ''));
    if (vagaLivre) await clicar(vagaLivre);
    else await clicar(botoes().find((b) => /no banco$/.test(b.textContent)));
  }
}
```

`tests/ui/app-inicio.test.jsx`:
```jsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { carregar } from '../../src/storage/index.js';
import { clicar, montar, fazerDraft } from './ajuda.jsx';

describe('app: início e draft', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('nova carreira → draft completo → painel da temporada', async () => {
    montar();
    expect(screen.getByText('Nova carreira')).toBeTruthy();
    await fazerDraft();
    expect(screen.getByText(/Temporada 1 de 10/)).toBeTruthy();
  });

  it('com save existente, abre na tela Continuar', async () => {
    const { unmount } = montar();
    await fazerDraft();
    unmount();
    // reabre lendo o save do navegador, como ao abrir o jogo de novo
    const salvo = carregar();
    expect(salvo).not.toBeNull();
    montar(salvo);
    expect(screen.getByText('Continuar')).toBeTruthy();
    await clicar(screen.getByText('Continuar'));
    expect(screen.getByText(/Temporada 1 de 10/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/ui/app-inicio.test.jsx`
Expected: FAIL — `Cannot find module '../../src/ui/estado/CarreiraContext.jsx'`.

- [ ] **Step 3: Tema e estado**

`src/ui/estilo.css`:
```css
/* Estilo B — transmissão de TV */
:root {
  --fundo: #0c1410;
  --superficie: #13241b;
  --superficie-2: #1d3527;
  --borda: #2c4a3a;
  --texto: #e8f5ec;
  --texto-2: #9fb8a8;
  --destaque: #c6ff00;
  --perigo: #e74c3c;
  --aviso: #f5c400;
  --campo: #1f6338;
  --campo-2: #1c5a32;
  --raio: 12px;
  color-scheme: dark;
}

* { box-sizing: border-box; }
html, body { margin: 0; background: var(--fundo); color: var(--texto); }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
button { font: inherit; color: inherit; cursor: pointer; }
button:disabled { opacity: .45; cursor: default; }

.app { max-width: 480px; margin: 0 auto; min-height: 100dvh; padding: 16px 16px 88px; position: relative; }
.tela-titulo { font-size: 22px; font-weight: 900; margin: 4px 0 2px; letter-spacing: .3px; }
.subtitulo { color: var(--texto-2); font-size: 13px; margin: 0 0 14px; }
.secao { margin: 18px 0 8px; font-size: 12px; font-weight: 800; letter-spacing: 1px; color: var(--destaque); text-transform: uppercase; }

.cartao { background: var(--superficie); border-radius: var(--raio); padding: 12px; margin-bottom: 10px; }
.cartao.realce { border-top: 3px solid var(--destaque); }

.botao { display: block; width: 100%; min-height: 48px; border: 0; border-radius: 10px; background: var(--superficie-2); font-weight: 800; font-size: 15px; padding: 12px; }
.botao.primario { background: var(--destaque); color: var(--fundo); }
.botao.perigo { background: var(--perigo); color: #fff; }
.botoes { display: flex; gap: 8px; }
.botoes .botao { flex: 1; font-size: 13px; padding: 10px 6px; }

.chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; background: var(--superficie-2); }
.chip.destaque { background: var(--destaque); color: var(--fundo); }
.chip.perigo { background: var(--perigo); color: #fff; }
.chip.aviso { background: var(--aviso); color: var(--fundo); }

.grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.opcao { background: var(--superficie); border: 2px solid transparent; border-radius: 10px; padding: 10px 6px; text-align: center; font-size: 12px; min-height: 44px; }
.opcao.on { border-color: var(--destaque); background: var(--superficie-2); }
.segmentos { display: flex; gap: 6px; flex-wrap: wrap; }
.segmentos .opcao { flex: 1; min-width: 72px; }

.lista { display: flex; flex-direction: column; gap: 6px; }
.linha { display: flex; align-items: center; gap: 8px; background: var(--superficie); border-radius: 8px; padding: 9px 10px; font-size: 13px; border: 2px solid transparent; text-align: left; width: 100%; }
.linha.on { border-color: var(--destaque); }
.linha .grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pos { font-size: 10px; font-weight: 800; padding: 2px 5px; border-radius: 4px; background: var(--superficie-2); color: var(--texto-2); min-width: 32px; text-align: center; }
.ovr { font-weight: 900; color: var(--destaque); min-width: 26px; text-align: right; }
.muted { color: var(--texto-2); font-size: 12px; }

/* Distintivo */
.distintivo { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50% 50% 46% 46%; font-weight: 900; line-height: 1; border: 2px solid rgba(255,255,255,.25); flex: 0 0 auto; }
.distintivo small { font-size: .55em; font-weight: 700; opacity: .9; margin-top: 2px; }

/* Campinho */
.campinho { position: relative; width: 100%; aspect-ratio: 3 / 4; border-radius: 10px; background: repeating-linear-gradient(0deg, var(--campo) 0 10%, var(--campo-2) 10% 20%); border: 2px solid #2e7d4a; overflow: hidden; }
.campinho::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; border-top: 2px solid rgba(255,255,255,.3); }
.campinho::after { content: ''; position: absolute; left: 50%; top: 50%; width: 22%; aspect-ratio: 1; transform: translate(-50%, -50%); border: 2px solid rgba(255,255,255,.3); border-radius: 50%; }
.vaga { position: absolute; transform: translate(-50%, -50%); z-index: 1; width: 64px; min-height: 44px; border-radius: 8px; border: 2px solid rgba(255,255,255,.5); background: rgba(12,20,16,.78); font-size: 10px; padding: 3px 2px; text-align: center; line-height: 1.15; }
.vaga.vazia { border-style: dashed; color: var(--texto-2); }
.vaga.on { border-color: var(--destaque); box-shadow: 0 0 10px var(--destaque); }
.vaga.alvo { border-color: var(--destaque); }
.vaga b { display: block; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vaga .avaliacao { color: var(--destaque); font-weight: 800; }

/* Roleta */
.roleta { position: relative; overflow: hidden; border-radius: 12px; border: 1px solid #2ecc71; background: linear-gradient(180deg, #15301f, var(--fundo)); padding: 12px 0; }
.roleta-faixa { display: flex; gap: 10px; padding: 0 50%; will-change: transform; }
.roleta-item { flex: 0 0 76px; height: 76px; border-radius: 10px; background: #10201a; border: 1px solid var(--borda); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px; }
.roleta-item.alvo.parou { outline: 2px solid var(--destaque); box-shadow: 0 0 14px var(--destaque); }
.roleta-marca { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: var(--destaque); transform: translateX(-50%); z-index: 1; }

/* Abas no rodapé */
.abas { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; background: var(--superficie); border-top: 1px solid var(--borda); padding-bottom: env(safe-area-inset-bottom); z-index: 5; }
.abas-interno { display: flex; width: 100%; max-width: 480px; }
.abas button { flex: 1; background: none; border: 0; padding: 10px 0 12px; font-size: 11px; color: var(--texto-2); min-height: 56px; }
.abas button span { display: block; font-size: 18px; }
.abas button.on { color: var(--destaque); font-weight: 800; }

.topo { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--texto-2); margin-bottom: 10px; }
.vs { display: flex; align-items: center; justify-content: space-around; margin: 12px 0; font-weight: 900; }
.vs .nome { font-size: 13px; margin-top: 4px; text-align: center; }
.bolinhas { display: flex; gap: 6px; }
.bolinha { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; }
.bolinha.V { background: var(--destaque); color: var(--fundo); }
.bolinha.E { background: var(--superficie-2); }
.bolinha.D { background: var(--perigo); }

/* Tabelas */
.tabela { width: 100%; border-collapse: collapse; font-size: 12px; }
.tabela th { color: var(--texto-2); font-weight: 700; text-align: right; padding: 4px 3px; }
.tabela td { padding: 6px 3px; text-align: right; border-top: 1px solid var(--superficie-2); }
.tabela td:nth-child(2), .tabela th:nth-child(2) { text-align: left; }
.tabela tr.eu td { color: var(--destaque); font-weight: 800; }
.faixa-g4 { box-shadow: inset 3px 0 0 #3fa9f5; }
.faixa-sul { box-shadow: inset 3px 0 0 #f5a623; }
.faixa-z4 { box-shadow: inset 3px 0 0 var(--perigo); }
.faixa-classifica { box-shadow: inset 3px 0 0 var(--destaque); }

/* Partida ao vivo */
.sobreposicao { position: fixed; inset: 0; background: var(--fundo); z-index: 10; overflow-y: auto; }
.sobreposicao .app { padding-bottom: 24px; }
.placar { display: flex; align-items: center; justify-content: space-between; background: var(--superficie); border-radius: 10px; padding: 10px 12px; border-bottom: 3px solid var(--destaque); }
.placar .gols { font-size: 30px; font-weight: 900; letter-spacing: 3px; }
.relogio { text-align: center; color: var(--destaque); font-weight: 800; margin: 8px 0; font-size: 14px; }
.pressao { height: 12px; border-radius: 6px; overflow: hidden; display: flex; background: var(--superficie); }
.pressao div { transition: width .6s ease; }
.destaque-grande { text-align: center; padding: 22px 8px; border-radius: 12px; background: radial-gradient(circle, #2a4d1a, var(--fundo)); margin: 10px 0; animation: pulso .35s ease-out; }
.destaque-grande b { display: block; font-size: 34px; color: var(--destaque); letter-spacing: 3px; }
.destaque-grande.perigo b { color: var(--perigo); }
@keyframes pulso { from { transform: scale(.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.lance { display: flex; gap: 8px; font-size: 13px; background: var(--superficie); border-radius: 8px; padding: 8px 10px; margin-top: 6px; }
.lance .min { color: var(--texto-2); min-width: 30px; }
.lance.gol { border-left: 3px solid var(--destaque); font-weight: 700; }
.lance.vermelho { border-left: 3px solid var(--perigo); }
.cansaco { width: 46px; height: 6px; border-radius: 3px; background: var(--superficie-2); overflow: hidden; }
.cansaco div { height: 100%; }
.cansaco .verde { background: #2ecc71; } .cansaco .amarelo { background: var(--aviso); } .cansaco .vermelho { background: var(--perigo); }
.cobrancas { display: flex; gap: 6px; justify-content: center; font-size: 22px; min-height: 30px; }

.aviso-erro { position: fixed; left: 16px; right: 16px; bottom: 80px; max-width: 448px; margin: 0 auto; background: var(--perigo); color: #fff; border-radius: 10px; padding: 12px; font-size: 13px; z-index: 20; }
.trofeu { font-size: 34px; }
.evolucao-sobe { color: #2ecc71; font-weight: 800; }
.evolucao-cai { color: var(--perigo); font-weight: 800; }
```

`src/ui/estado/CarreiraContext.jsx`:
```jsx
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
```

- [ ] **Step 4: Componentes**

`src/ui/componentes/Distintivo.jsx`:
```jsx
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
```

`src/ui/componentes/Campinho.jsx`:
```jsx
import { posicoesNoCampo } from '../logica/escalacao.js';

// vagas: ['GOL', ...]; ocupantes: [jogador | null] alinhado às vagas
// selecionada: índice destacado; avaliacao(i): texto extra na vaga (ex.: overall efetivo)
export function Campinho({ vagas, ocupantes, selecionada = null, alvos = false, avaliacao, onVaga, mostrarOvr = true }) {
  const pos = posicoesNoCampo(vagas);
  return (
    <div className="campinho">
      {vagas.map((vaga, i) => {
        const j = ocupantes[i];
        const classes = ['vaga', j ? '' : 'vazia', selecionada === i ? 'on' : '', alvos && !j ? 'alvo' : ''].join(' ');
        const extra = avaliacao?.(i);
        return (
          <button key={i} type="button" className={classes} style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%` }}
            onClick={() => onVaga?.(i)} aria-label={`Vaga ${vaga}${j ? `: ${j.nome}` : ' vazia'}`}>
            <span className="muted">{vaga}</span>
            {j ? <b>{j.nome}</b> : <b>—</b>}
            {extra ? <span className="avaliacao">{extra}</span> : j && mostrarOvr && <span className="avaliacao">{j.ovr}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

`src/ui/componentes/Roleta.jsx`:
```jsx
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
```

- [ ] **Step 5: Telas de início, nova carreira e draft**

`src/ui/telas/Inicio.jsx`:
```jsx
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { DistintivoClube, clubeVisual } from '../componentes/Distintivo.jsx';
import { totalTitulos } from '../logica/temporada.js';

// Aparece ao abrir o jogo quando existe carreira salva.
export function Inicio({ onContinuar }) {
  const { carreira, dados, encerrar } = useCarreira();
  const clube = clubeVisual(dados, carreira.config.clubeId);
  return (
    <div className="app">
      <h1 className="tela-titulo">Carreira FC</h1>
      <p className="subtitulo">Monte seu time na roleta e escreva a história do clube.</p>
      <div className="cartao realce">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <DistintivoClube dados={dados} id={carreira.config.clubeId} tamanho={48} />
          <div>
            <b>{clube.nome}</b>
            <div className="muted">
              {carreira.fase === 'draft' ? 'Montando o elenco' : `Temporada ${carreira.temporada} de ${carreira.config.duracao}`}
              {' · '}🏆 {totalTitulos(carreira)}
            </div>
          </div>
        </div>
        <div style={{ height: 12 }} />
        <button className="botao primario" onClick={onContinuar}>Continuar</button>
      </div>
      <button className="botao" onClick={() => {
        if (window.confirm('Começar outra carreira? A carreira atual será apagada.')) encerrar();
      }}>Nova carreira</button>
    </div>
  );
}
```

`src/ui/telas/NovaCarreira.jsx`:
```jsx
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
```

`src/ui/telas/Draft.jsx`:
```jsx
import { useState } from 'react';
import { girarDraft, usarCuringa, escolherNoDraft } from '../../engine/carreira.js';
import { vagasDaFormacao, TAMANHO_BANCO } from '../../engine/elenco.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { Campinho } from '../componentes/Campinho.jsx';
import { Roleta } from '../componentes/Roleta.jsx';
import { avaliarVaga } from '../logica/escalacao.js';

export function Draft() {
  const { carreira, dados, executar } = useCarreira();
  const { draft, elenco, config } = carreira;
  const olheiro = config.dificuldade === 'olheiro';
  const vagas = vagasDaFormacao(elenco.formacao);
  const titulares = elenco.titulares.map((id) => (id ? elenco.jogadores[id] : null));
  const banco = Object.values(elenco.jogadores).filter((j) => !elenco.titulares.includes(j.id));
  const total = Object.keys(elenco.jogadores).length;
  const [revelado, setRevelado] = useState(Boolean(draft.atual)); // false enquanto a roleta gira
  const [escolhido, setEscolhido] = useState(null);
  const jogador = draft.atual?.opcoes.find((j) => j.id === escolhido) ?? null;
  const elencoAtual = draft.atual && dados.elencos.find((e) => e.id === draft.atual.elencoId);

  const girar = () => { setRevelado(false); setEscolhido(null); executar((c) => girarDraft(c, dados)); };
  const colocar = (destino) => {
    if (!jogador) return;
    if (executar((c) => escolherNoDraft(c, dados, jogador.id, destino))) setEscolhido(null);
  };

  return (
    <div className="app">
      <div className="topo"><span>Montando o elenco</span><span>{total}/15 · curingas: {draft.curingas}</span></div>
      <h1 className="tela-titulo">Draft</h1>
      <p className="subtitulo">{jogador ? `Toque numa vaga livre para ${jogador.nome}.` : 'Gire a roleta e escolha um jogador do elenco sorteado.'}</p>

      <Campinho vagas={vagas} ocupantes={titulares} alvos={Boolean(jogador)} mostrarOvr={!olheiro}
        avaliacao={jogador ? (i) => (titulares[i] ? null : avaliarVaga(jogador, vagas[i], config.dificuldade).texto) : undefined}
        onVaga={(i) => !titulares[i] && colocar(i)} />

      <div className="secao">Banco ({banco.length}/{TAMANHO_BANCO})</div>
      <div className="lista">
        {banco.map((j) => (
          <div key={j.id} className="linha"><span className="pos">{j.pos}</span><span className="grow">{j.nome}</span>{!olheiro && <span className="ovr">{j.ovr}</span>}</div>
        ))}
        {jogador && banco.length < TAMANHO_BANCO && (
          <button className="botao" onClick={() => colocar('banco')}>Colocar {jogador.nome} no banco</button>
        )}
      </div>

      <div className="secao">Roleta</div>
      {draft.atual ? (
        <>
          <Roleta elencos={dados.elencos} alvoId={draft.atual.elencoId} onFim={() => setRevelado(true)} />
          {revelado && (
            <>
              <h2 style={{ fontSize: 16, margin: '12px 0 6px' }}>{elencoAtual.clube} {elencoAtual.ano}</h2>
              <div className="lista">
                {draft.atual.opcoes.map((j) => (
                  <button key={j.id} className={`linha ${escolhido === j.id ? 'on' : ''}`} onClick={() => setEscolhido(j.id)}>
                    <span className="pos">{j.pos}</span>
                    <span className="grow">{j.nome} <span className="muted">· {j.idade} anos</span></span>
                    {!olheiro && <span className="ovr">{j.ovr}</span>}
                  </button>
                ))}
              </div>
              <div style={{ height: 10 }} />
              <button className="botao" disabled={draft.curingas === 0} onClick={() => { setEscolhido(null); executar((c) => usarCuringa(c)); }}>
                Usar curinga ({draft.curingas})
              </button>
            </>
          )}
        </>
      ) : (
        <button className="botao primario" onClick={girar}>⚽ Puxar a alavanca</button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: App (versão 1) e ponto de entrada**

`src/ui/App.jsx` — nesta task as fases seguintes ainda não têm tela; mostra só onde a carreira está (substituído nas Tasks 5 e 6):
```jsx
import { useState } from 'react';
import { useCarreira } from './estado/CarreiraContext.jsx';
import { Inicio } from './telas/Inicio.jsx';
import { NovaCarreira } from './telas/NovaCarreira.jsx';
import { Draft } from './telas/Draft.jsx';

function Andamento() {
  const { carreira } = useCarreira();
  return <div className="app"><p className="topo">Temporada {carreira.temporada} de {carreira.config.duracao}</p></div>;
}

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
  else tela = <Andamento />;

  return (
    <>
      {tela}
      {erro && <div className="aviso-erro" role="alert" onClick={limparErro}>{erro} (toque para fechar)</div>}
    </>
  );
}
```

`src/main.jsx`:
```jsx
import { createRoot } from 'react-dom/client';
import { dados } from './data/index.js';
import { CarreiraProvider } from './ui/estado/CarreiraContext.jsx';
import { App } from './ui/App.jsx';
import './ui/estilo.css';

createRoot(document.getElementById('root')).render(
  <CarreiraProvider dados={dados}>
    <App />
  </CarreiraProvider>,
);
```

- [ ] **Step 7: Rodar e ver passar; build**

Run: `npx vitest run tests/ui/app-inicio.test.jsx`
Expected: PASS (2 testes).
Run: `npx vite build`
Expected: `✓ built`.

- [ ] **Step 8: Commit**

```bash
git add src/ui src/main.jsx tests/ui/ajuda.jsx tests/ui/app-inicio.test.jsx
git commit -m "feat(ui): tema, estado salvo, nova carreira e draft com roleta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Painel da temporada e partida ao vivo

**Files:**
- Create: `src/ui/telas/Painel.jsx`, `AbaJogo.jsx`, `AbaTabelas.jsx`, `AbaElenco.jsx`, `AbaCalendario.jsx`, `Partida.jsx`
- Modify: `src/ui/App.jsx` (versão 2)
- Test: `tests/ui/app-temporada.test.jsx`

**Interfaces:**
- Consumes: Tasks 3 e 4; motor (`jogarData`, `definirTatica`, `ladosDoJogo`, `rngDaPartida`, `precisaDePenaltis`, `iniciarPartida`, `simularPrimeiroTempo`, `aplicarIntervalo`, `simularSegundoTempo`, `simularProrrogacao`, `CONST`, `setoresDoLado`, `disputarPenaltis`, `ordenarTabela`).
- Produces: `Painel()`; `Partida({ info, onFechar })` — `info` é o retorno de `infoProximoJogo`; ao "Continuar" chama `jogarData(c, dados, { partidaUsuario, penaltisUsuario })`.

- [ ] **Step 1: Escrever o teste de fumaça que falha**

`tests/ui/app-temporada.test.jsx`:
```jsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { clicar, passar, montar, fazerDraft } from './ajuda.jsx';

describe('app: temporada', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('simular um jogo mostra o resultado e avança a data', async () => {
    montar();
    await fazerDraft();
    await clicar(screen.getByText('Simular'));
    expect(screen.getByText('Resultado')).toBeTruthy();
    expect(screen.getByText(/Data 2\//)).toBeTruthy();
  });

  it('assistir: 1º tempo, intervalo, 2º tempo e volta ao painel', async () => {
    montar();
    await fazerDraft();
    await clicar(screen.getByText('▶ Assistir'));
    await passar(16000);
    expect(screen.getByText('INTERVALO')).toBeTruthy();
    await clicar(screen.getByText('Começar o 2º tempo'));
    await passar(16000);
    await passar(12000); // prorrogação, se houver
    await passar(20000); // pênaltis, se houver
    expect(screen.getByText('FIM DE JOGO')).toBeTruthy();
    await clicar(screen.getByText('Continuar'));
    expect(screen.getByText(/Data 2\//)).toBeTruthy();
  });

  it('as abas Tabelas, Elenco e Calendário abrem', async () => {
    montar();
    await fazerDraft();
    await clicar(screen.getByText('Tabelas'));
    expect(screen.getAllByText('Brasileirão').length).toBeGreaterThan(0);
    await clicar(screen.getByText('Elenco', { selector: 'button' }));
    expect(screen.getByText('Reservas')).toBeTruthy();
    await clicar(screen.getByText('Calendário'));
    expect(screen.getAllByText(/Paulistão|Carioca/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/ui/app-temporada.test.jsx`
Expected: FAIL — `Unable to find an element with the text: Simular` (o App ainda mostra só o andamento).

- [ ] **Step 3: Painel e abas**

`src/ui/telas/Painel.jsx`:
```jsx
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
```

`src/ui/telas/AbaJogo.jsx`:
```jsx
import { useState } from 'react';
import { jogarData } from '../../engine/carreira.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { DistintivoClube, clubeVisual } from '../componentes/Distintivo.jsx';
import { infoProximoJogo, ultimosResultados, resultadoDoUsuario, simularAteImportante, nomeCompeticao } from '../logica/temporada.js';
import { Partida } from './Partida.jsx';

function Resumo({ jogos, onFechar }) {
  const { carreira, dados } = useCarreira();
  const eu = carreira.config.clubeId;
  return (
    <div className="cartao realce">
      <div className="secao" style={{ marginTop: 0 }}>{jogos.length === 1 ? 'Resultado' : `${jogos.length} jogos simulados`}</div>
      <div className="lista">
        {jogos.map((j, i) => {
          const r = resultadoDoUsuario(j, eu);
          return (
            <div key={i} className="linha">
              <span className={`bolinha ${r.letra}`}>{r.letra}</span>
              <span className="grow">{r.meus} x {r.deles} {r.emCasa ? 'vs' : '@'} {clubeVisual(dados, r.adversario).nome}
                {r.penaltis && <span className="muted"> (pên. {r.penaltis.meus}x{r.penaltis.deles})</span>}</span>
              <span className="muted">{nomeCompeticao(j.compId, carreira, dados)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ height: 8 }} />
      <button className="botao" onClick={onFechar}>OK</button>
    </div>
  );
}

export function AbaJogo({ onAjustar }) {
  const { carreira, dados, executar } = useCarreira();
  const [aoVivo, setAoVivo] = useState(false);
  const [resumo, setResumo] = useState(null);
  const info = infoProximoJogo(carreira, dados);
  const eu = carreira.config.clubeId;
  const fora = Object.values(carreira.elenco.jogadores).filter((j) => j.fora || j.suspenso);

  const simular = () => {
    const antes = carreira.temporadaAtual.jogos.length;
    const nova = executar((c) => jogarData(c, dados));
    if (nova && nova.fase === 'temporada' && nova.temporadaAtual.jogos.length > antes) setResumo([nova.temporadaAtual.jogos.at(-1)]);
  };
  const ateImportante = () => {
    let jogos = [];
    const nova = executar((c) => { const r = simularAteImportante(c, dados); jogos = r.jogos; return r.carreira; });
    if (nova && nova.fase === 'temporada' && jogos.length) setResumo(jogos);
  };

  if (aoVivo) return <Partida info={info} onFechar={() => setAoVivo(false)} />;

  return (
    <>
      {resumo && <Resumo jogos={resumo} onFechar={() => setResumo(null)} />}
      <div className="cartao realce">
        <span className="chip destaque">{info.titulo}</span>
        {info.importante && <span className="chip aviso" style={{ marginLeft: 6 }}>Importante</span>}
        {info.jogo ? (
          <>
            <div className="vs">
              <div style={{ textAlign: 'center' }}><DistintivoClube dados={dados} id={info.jogo.casa} tamanho={52} /><div className="nome">{clubeVisual(dados, info.jogo.casa).nome}</div></div>
              <span>x</span>
              <div style={{ textAlign: 'center' }}><DistintivoClube dados={dados} id={info.jogo.fora} tamanho={52} /><div className="nome">{clubeVisual(dados, info.jogo.fora).nome}</div></div>
            </div>
            <p className="muted" style={{ textAlign: 'center', margin: '0 0 10px' }}>
              {info.mando === 'neutro' ? 'Campo neutro' : info.mando === 'casa' ? 'Você joga em casa' : 'Você joga fora'}
              {info.ida && ` · Ida: ${clubeVisual(dados, info.ida.casa).sigla} ${info.ida.golsCasa} x ${info.ida.golsFora} ${clubeVisual(dados, info.ida.fora).sigla}`}
            </p>
            <div className="botoes">
              <button className="botao primario" onClick={() => setAoVivo(true)}>▶ Assistir</button>
              <button className="botao" onClick={simular}>Simular</button>
              <button className="botao" onClick={ateImportante} disabled={info.importante}>⏩ Até importante</button>
            </div>
          </>
        ) : (
          <>
            <p className="subtitulo" style={{ marginTop: 12 }}>Rodada sem jogo do seu time.</p>
            <div className="botoes">
              <button className="botao primario" onClick={simular}>Avançar</button>
              <button className="botao" onClick={ateImportante}>⏩ Até importante</button>
            </div>
          </>
        )}
      </div>

      {fora.length > 0 && (
        <div className="cartao">
          <div className="lista">
            {fora.map((j) => (
              <div key={j.id} className="muted">{j.fora ? `🚑 ${j.nome} fora por ${j.fora} jogo(s)` : `🟥 ${j.nome} suspenso`}</div>
            ))}
          </div>
          <div style={{ height: 8 }} />
          <button className="botao" onClick={onAjustar}>Ajustar escalação</button>
        </div>
      )}

      <div className="secao">Últimos jogos</div>
      <div className="bolinhas">
        {ultimosResultados(carreira).map((r, i) => <span key={i} className={`bolinha ${r.letra}`} title={`${r.meus}x${r.deles}`}>{r.letra}</span>)}
        {carreira.temporadaAtual.jogos.length === 0 && <span className="muted">A temporada ainda não começou.</span>}
      </div>
      <p className="muted" style={{ marginTop: 14 }}>{clubeVisual(dados, eu).nome} · {carreira.elenco.formacao} · postura {carreira.elenco.postura}</p>
    </>
  );
}
```

`src/ui/telas/AbaTabelas.jsx`:
```jsx
import { useState } from 'react';
import { ordenarTabela } from '../../engine/liga.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { clubeVisual } from '../componentes/Distintivo.jsx';
import { nomeCompeticao, ORDEM_COMPETICOES } from '../logica/temporada.js';

function faixa(compId, chave, pos) {
  if (compId === 'brasileirao') {
    if (pos <= 4) return 'faixa-g4';
    if (pos <= 10) return 'faixa-sul';
    if (pos >= 17) return 'faixa-z4';
    return '';
  }
  if (compId === 'estadual') return pos <= 4 ? 'faixa-classifica' : '';
  return chave !== 'geral' && pos <= 2 ? 'faixa-classifica' : '';
}

function Tabela({ compId, chave, linhas }) {
  const { carreira, dados } = useCarreira();
  const eu = carreira.config.clubeId;
  return (
    <table className="tabela">
      <thead><tr><th>#</th><th>Clube</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>GP</th></tr></thead>
      <tbody>
        {ordenarTabela(linhas).map((l, i) => (
          <tr key={l.id} className={`${l.id === eu ? 'eu' : ''} ${faixa(compId, chave, i + 1)}`}>
            <td>{i + 1}</td><td>{clubeVisual(dados, l.id).nome}</td><td><b>{l.pts}</b></td><td>{l.j}</td><td>{l.v}</td><td>{l.e}</td><td>{l.d}</td><td>{l.gp - l.gc}</td><td>{l.gp}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Chave({ fase }) {
  const { carreira, dados } = useCarreira();
  const eu = carreira.config.clubeId;
  const sigla = (id) => clubeVisual(dados, id).sigla;
  return (
    <div className="cartao">
      <div className="secao" style={{ marginTop: 0 }}>{fase.nome}</div>
      <div className="lista">
        {fase.pares.map(([a, b], i) => {
          const ida = fase.idas[i];
          const volta = fase.voltas?.[i];
          const pen = fase.penaltis?.[i];
          const venc = fase.vencedores[i];
          const meu = a === eu || b === eu;
          return (
            <div key={i} className="linha" style={meu ? { borderColor: 'var(--destaque)' } : undefined}>
              <span className="grow">
                <b style={venc === a ? { color: 'var(--destaque)' } : undefined}>{sigla(a)}</b> x <b style={venc === b ? { color: 'var(--destaque)' } : undefined}>{sigla(b)}</b>
              </span>
              <span className="muted">
                {fase.idaEVolta
                  ? `${ida ? `${ida.golsCasa}-${ida.golsFora}` : '–'} / ${volta ? `${volta.golsFora}-${volta.golsCasa}` : '–'}`
                  : volta ? `${volta.golsCasa}-${volta.golsFora}` : '–'}
                {pen && ` (pên. ${pen.casa}-${pen.fora})`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AbaTabelas() {
  const { carreira, dados } = useCarreira();
  const comps = carreira.temporadaAtual.competicoes;
  const ids = ORDEM_COMPETICOES.filter((id) => comps[id]);
  const [sel, setSel] = useState(ids.includes('brasileirao') ? 'brasileirao' : ids[0]);
  const comp = comps[sel];
  const chaves = Object.keys(comp.tabelas).sort();

  return (
    <>
      <div className="segmentos" style={{ marginBottom: 12 }}>
        {ids.map((id) => (
          <button key={id} className={`opcao ${sel === id ? 'on' : ''}`} onClick={() => setSel(id)}>{nomeCompeticao(id, carreira, dados)}</button>
        ))}
      </div>
      {comp.campeao && <div className="cartao realce">🏆 Campeão: <b>{clubeVisual(dados, comp.campeao).nome}</b></div>}
      {chaves.map((k) => (
        <div key={k} className="cartao">
          {k !== 'geral' && <div className="secao" style={{ marginTop: 0 }}>Grupo {k}</div>}
          <Tabela compId={sel} chave={k} linhas={comp.tabelas[k]} />
        </div>
      ))}
      {comp.fases.filter((f) => f.pares).map((f) => <Chave key={f.nome} fase={f} />)}
      {sel === 'brasileirao' && <p className="muted">Azul: Libertadores · Laranja: Sul-Americana · Vermelho: roleta ruim</p>}
    </>
  );
}
```

`src/ui/telas/AbaElenco.jsx`:
```jsx
import { useState } from 'react';
import formacoes from '../../data/formacoes.json';
import { definirTatica } from '../../engine/carreira.js';
import { vagasDaFormacao } from '../../engine/elenco.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { Campinho } from '../componentes/Campinho.jsx';
import { reorganizar } from '../logica/escalacao.js';

// Toque em dois jogadores (no campo ou no banco) para trocá-los de lugar.
export function AbaElenco() {
  const { carreira, executar } = useCarreira();
  const { elenco, config } = carreira;
  const olheiro = config.dificuldade === 'olheiro';
  const vagas = vagasDaFormacao(elenco.formacao);
  const titulares = elenco.titulares.map((id) => (id ? elenco.jogadores[id] : null));
  const reservas = Object.values(elenco.jogadores).filter((j) => !elenco.titulares.includes(j.id));
  const gols = carreira.temporadaAtual?.gols ?? {};
  const [sel, setSel] = useState(null); // { tipo: 'vaga', i } | { tipo: 'reserva', id }

  const tocar = (alvo) => {
    if (!sel) return setSel(alvo);
    const t = [...elenco.titulares];
    if (sel.tipo === 'vaga' && alvo.tipo === 'vaga') [t[sel.i], t[alvo.i]] = [t[alvo.i], t[sel.i]];
    else if (sel.tipo === 'vaga' && alvo.tipo === 'reserva') t[sel.i] = alvo.id;
    else if (sel.tipo === 'reserva' && alvo.tipo === 'vaga') t[alvo.i] = sel.id;
    else return setSel(alvo);
    setSel(null);
    executar((c) => definirTatica(c, { titulares: t }));
  };

  const mudarFormacao = (id) => {
    const jogadoresEmCampo = titulares.filter(Boolean);
    executar((c) => definirTatica(c, { formacao: id, titulares: reorganizar(jogadoresEmCampo, vagasDaFormacao(id)) }));
  };

  return (
    <>
      <p className="subtitulo">Toque em dois jogadores para trocá-los de lugar.</p>
      <Campinho vagas={vagas} ocupantes={titulares} mostrarOvr={!olheiro}
        selecionada={sel?.tipo === 'vaga' ? sel.i : null} onVaga={(i) => tocar({ tipo: 'vaga', i })} />

      <div className="secao">Reservas</div>
      <div className="lista">
        {reservas.map((j) => (
          <button key={j.id} className={`linha ${sel?.id === j.id ? 'on' : ''}`} onClick={() => tocar({ tipo: 'reserva', id: j.id })}>
            <span className="pos">{j.pos}</span><span className="grow">{j.nome}</span>
            {j.fora > 0 && <span>🚑{j.fora}</span>}{j.suspenso > 0 && <span>🟥</span>}
            {!olheiro && <span className="ovr">{j.ovr}</span>}
          </button>
        ))}
      </div>

      <div className="secao">Formação</div>
      <div className="segmentos">
        {formacoes.map((f) => (
          <button key={f.id} className={`opcao ${elenco.formacao === f.id ? 'on' : ''}`} onClick={() => mudarFormacao(f.id)}>{f.id}</button>
        ))}
      </div>

      <div className="secao">Postura</div>
      <div className="segmentos">
        {['defensiva', 'equilibrada', 'ofensiva'].map((p) => (
          <button key={p} className={`opcao ${elenco.postura === p ? 'on' : ''}`} onClick={() => executar((c) => definirTatica(c, { postura: p }))}>
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="secao">Elenco</div>
      <div className="lista">
        {Object.values(elenco.jogadores).map((j) => (
          <div key={j.id} className="linha">
            <span className="pos">{j.pos}</span>
            <span className="grow">{j.nome} <span className="muted">· {j.idade} anos · {j.origem}</span></span>
            {gols[j.id] > 0 && <span className="muted">⚽{gols[j.id]}</span>}
            {j.fora > 0 && <span>🚑{j.fora}</span>}{j.suspenso > 0 && <span>🟥</span>}
            {!olheiro && <span className="ovr">{j.ovr}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
```

`src/ui/telas/AbaCalendario.jsx`:
```jsx
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
```

- [ ] **Step 4: Partida ao vivo**

`src/ui/telas/Partida.jsx`:
```jsx
import { useEffect, useState } from 'react';
import formacoes from '../../data/formacoes.json';
import { iniciarPartida, simularPrimeiroTempo, aplicarIntervalo, simularSegundoTempo, simularProrrogacao, CONST } from '../../engine/partida.js';
import { setoresDoLado } from '../../engine/forca.js';
import { disputarPenaltis } from '../../engine/penaltis.js';
import { ladosDoJogo, rngDaPartida, precisaDePenaltis, jogarData } from '../../engine/carreira.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { DistintivoClube, clubeVisual } from '../componentes/Distintivo.jsx';
import {
  narrar, eventosAte, pressao, contarChances, faixaCansaco, minutoNoPeriodo, rotuloRelogio, TIPOS_DESTAQUE,
} from '../logica/partida.js';
import { reorganizar } from '../logica/escalacao.js';

const DURACAO = { primeiro: 15000, segundo: 15000, prorrogacao: 10000 };
const PASSO = 100;
const ANIMADOS = ['primeiro', 'segundo', 'prorrogacao'];

const TITULO_DESTAQUE = { gol: 'GOOOL!', var: 'VAR · ANULADO', vermelho: 'EXPULSO', lesao: 'LESÃO' };

function Intervalo({ estado, lado, olheiro, onComecar }) {
  const meu = estado[lado];
  const livres = CONST.MAX_TROCAS - meu.trocas;
  const [trocas, setTrocas] = useState([]); // [{ saiId, entraId }]
  const [sai, setSai] = useState(null);
  const [postura, setPostura] = useState(meu.postura);
  const [formacao, setFormacao] = useState(null);
  const saem = new Set(trocas.map((t) => t.saiId));
  const entram = new Set(trocas.map((t) => t.entraId));

  const comecar = () => {
    let escalacao = null;
    if (formacao) {
      const emCampo = meu.escalacao.map((e) => {
        const t = trocas.find((x) => x.saiId === e.jogador.id);
        return t ? meu.banco.find((b) => b.id === t.entraId) : e.jogador;
      });
      const vagas = formacoes.find((f) => f.id === formacao).vagas;
      escalacao = reorganizar(emCampo, vagas).map((id, i) => (id ? { jogadorId: id, vaga: vagas[i] } : null)).filter(Boolean);
    }
    onComecar({ trocas, postura, escalacao });
  };

  return (
    <div className="cartao realce">
      <div className="secao" style={{ marginTop: 0 }}>Intervalo · trocas disponíveis: {livres - trocas.length}</div>
      <p className="muted">Toque em quem sai e depois em quem entra.</p>
      <div className="lista">
        {meu.escalacao.map(({ jogador, vaga }) => {
          const c = meu.cansaco[jogador.id] ?? 0;
          const troca = trocas.find((t) => t.saiId === jogador.id);
          return (
            <button key={jogador.id} className={`linha ${sai === jogador.id ? 'on' : ''}`} disabled={saem.has(jogador.id)}
              onClick={() => setSai(jogador.id)}>
              <span className="pos">{vaga}</span>
              <span className="grow">{jogador.nome}{troca && ` → ${meu.banco.find((b) => b.id === troca.entraId).nome}`}</span>
              <span className="cansaco"><div className={faixaCansaco(c)} style={{ width: `${c}%` }} /></span>
            </button>
          );
        })}
      </div>
      <div className="secao">Banco</div>
      <div className="lista">
        {meu.banco.map((j) => (
          <button key={j.id} className="linha" disabled={!sai || entram.has(j.id) || trocas.length >= livres}
            onClick={() => { setTrocas([...trocas, { saiId: sai, entraId: j.id }]); setSai(null); }}>
            <span className="pos">{j.pos}</span><span className="grow">{j.nome}</span>{!olheiro && <span className="ovr">{j.ovr}</span>}
          </button>
        ))}
        {meu.banco.length === 0 && <span className="muted">Ninguém no banco.</span>}
      </div>
      {trocas.length > 0 && <button className="botao" style={{ marginTop: 8 }} onClick={() => setTrocas([])}>Desfazer trocas</button>}
      <div className="secao">Postura</div>
      <div className="segmentos">
        {['defensiva', 'equilibrada', 'ofensiva'].map((p) => (
          <button key={p} className={`opcao ${postura === p ? 'on' : ''}`} onClick={() => setPostura(p)}>{p}</button>
        ))}
      </div>
      <div className="secao">Formação</div>
      <div className="segmentos">
        {formacoes.map((f) => (
          <button key={f.id} className={`opcao ${formacao === f.id ? 'on' : ''}`} onClick={() => setFormacao(formacao === f.id ? null : f.id)}>{f.id}</button>
        ))}
      </div>
      <div style={{ height: 12 }} />
      <button className="botao primario" onClick={comecar}>Começar o 2º tempo</button>
    </div>
  );
}

export function Partida({ info, onFechar }) {
  const { carreira, dados, executar } = useCarreira();
  const eu = carreira.config.clubeId;
  const { jogo, compId } = info;
  const lado = jogo.casa === eu ? 'casa' : 'fora';
  const nomes = { casa: clubeVisual(dados, jogo.casa).nome, fora: clubeVisual(dados, jogo.fora).nome };

  // rng e 1º tempo criados juntos, uma vez só (o rng é próprio desta partida)
  const [{ rng }] = useState(() => ({ rng: rngDaPartida(carreira) }));
  const [estado, setEstado] = useState(() => {
    const { casa, fora } = ladosDoJogo(carreira, dados, jogo);
    return simularPrimeiroTempo(iniciarPartida({ casa, fora, neutro: jogo.neutro }), rng);
  });
  const [periodo, setPeriodo] = useState('primeiro');
  const [fracao, setFracao] = useState(0);
  const [disputa, setDisputa] = useState(null);
  const [cobrancas, setCobrancas] = useState(0);

  // relógio
  useEffect(() => {
    if (!ANIMADOS.includes(periodo)) return undefined;
    const passo = PASSO / DURACAO[periodo];
    const id = setInterval(() => setFracao((f) => Math.min(1, f + passo)), PASSO);
    return () => clearInterval(id);
  }, [periodo]);

  // fim de cada período
  useEffect(() => {
    if (!ANIMADOS.includes(periodo) || fracao < 1) return;
    if (periodo === 'primeiro') { setPeriodo('intervalo'); return; }
    if (periodo === 'segundo' && jogo.prorrogacao && estado.placar.casa === estado.placar.fora) {
      setEstado(simularProrrogacao(estado, rng));
      setFracao(0);
      setPeriodo('prorrogacao');
      return;
    }
    const resultado = { casa: jogo.casa, fora: jogo.fora, golsCasa: estado.placar.casa, golsFora: estado.placar.fora };
    if (precisaDePenaltis(carreira, compId, resultado)) {
      setDisputa(disputarPenaltis(setoresDoLado(estado.casa, { progresso: 1 }), setoresDoLado(estado.fora, { progresso: 1 }), rng));
      setPeriodo('penaltis');
    } else {
      setPeriodo('fim');
    }
  }, [fracao, periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  // cobranças de pênalti, uma a uma
  useEffect(() => {
    if (periodo !== 'penaltis') return undefined;
    if (cobrancas >= disputa.cobrancas.length) { setPeriodo('fim'); return undefined; }
    const id = setTimeout(() => setCobrancas((n) => n + 1), 800);
    return () => clearTimeout(id);
  }, [periodo, cobrancas, disputa]);

  const periodoRelogio = ANIMADOS.includes(periodo) ? periodo : periodo === 'intervalo' ? 'primeiro' : estado.tempo === 3 ? 'prorrogacao' : 'segundo';
  const minuto = ANIMADOS.includes(periodo) ? minutoNoPeriodo(periodo, fracao) : periodoRelogio === 'primeiro' ? 45 : estado.tempo === 3 ? 120 : 90;
  const revelados = eventosAte(estado.eventos, minuto);
  const placar = {
    casa: revelados.filter((e) => e.tipo === 'gol' && e.lado === 'casa').length,
    fora: revelados.filter((e) => e.tipo === 'gol' && e.lado === 'fora').length,
  };
  const p = pressao(revelados, minuto);
  const chances = contarChances(revelados, minuto);
  const destaque = [...revelados].reverse().find((e) => TIPOS_DESTAQUE.includes(e.tipo) && minuto - e.minuto <= 3);

  const comecarSegundo = (escolhas) => {
    try {
      const e = aplicarIntervalo(estado, lado, escolhas);
      setEstado(simularSegundoTempo(e, rng));
      setFracao(0);
      setPeriodo('segundo');
    } catch (err) {
      window.alert(err.message);
    }
  };

  const concluir = () => {
    const nova = executar((c) => jogarData(c, dados, { partidaUsuario: estado, penaltisUsuario: disputa }));
    if (nova) onFechar();
  };

  // classificação no mata-mata (volta ou jogo único)
  let classificacao = null;
  if (periodo === 'fim' && jogo.mataMata && info.perna !== 'ida') {
    const idaMeus = info.ida ? (info.ida.casa === eu ? info.ida.golsCasa : info.ida.golsFora) : 0;
    const idaDeles = info.ida ? (info.ida.casa === eu ? info.ida.golsFora : info.ida.golsCasa) : 0;
    const meus = estado.placar[lado] + idaMeus;
    const deles = estado.placar[lado === 'casa' ? 'fora' : 'casa'] + idaDeles;
    classificacao = disputa ? disputa.vencedor === lado : meus > deles;
  }

  return (
    <div className="sobreposicao">
      <div className="app">
        <div className="topo"><span>{info.titulo}</span></div>
        <div className="placar">
          <DistintivoClube dados={dados} id={jogo.casa} tamanho={40} />
          <span className="gols">{placar.casa} - {placar.fora}</span>
          <DistintivoClube dados={dados} id={jogo.fora} tamanho={40} />
        </div>
        <div className="relogio">
          {periodo === 'intervalo' ? 'INTERVALO' : periodo === 'penaltis' ? 'PÊNALTIS' : periodo === 'fim' ? 'FIM DE JOGO' : rotuloRelogio(minuto, periodoRelogio, estado.acrescimos)}
        </div>
        <div className="pressao" aria-label="Pressão">
          <div style={{ width: `${p.casa * 100}%`, background: 'var(--destaque)' }} />
          <div style={{ width: `${p.fora * 100}%`, background: '#2e7d4a' }} />
        </div>
        <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span>{nomes.casa}</span><span>Chances {chances.casa} x {chances.fora}</span><span>{nomes.fora}</span>
        </div>

        {destaque && ANIMADOS.includes(periodo) && (
          <div key={`${destaque.tipo}-${destaque.minuto}`} className={`destaque-grande ${destaque.tipo === 'gol' ? '' : 'perigo'}`}>
            <b>{TITULO_DESTAQUE[destaque.tipo]}</b>
            <span>{destaque.nome ?? nomes[destaque.lado]} · {destaque.minuto}'</span>
          </div>
        )}

        {periodo === 'intervalo' && <Intervalo estado={estado} lado={lado} olheiro={carreira.config.dificuldade === 'olheiro'} onComecar={comecarSegundo} />}

        {(periodo === 'penaltis' || (periodo === 'fim' && disputa)) && (
          <div className="cartao realce">
            <div className="secao" style={{ marginTop: 0 }}>Disputa de pênaltis</div>
            {['casa', 'fora'].map((l) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ minWidth: 90 }}>{nomes[l]}</span>
                <div className="cobrancas">
                  {disputa.cobrancas.slice(0, cobrancas).filter((c) => c.lado === l).map((c, i) => <span key={i}>{c.convertido ? '⚽' : '❌'}</span>)}
                </div>
              </div>
            ))}
            {periodo === 'fim' && <b>Pênaltis: {disputa.casa} x {disputa.fora}</b>}
          </div>
        )}

        {periodo === 'fim' && (
          <div className="cartao realce">
            <div className="secao" style={{ marginTop: 0 }}>Fim de jogo</div>
            {classificacao !== null && <p style={{ fontWeight: 900, fontSize: 18, color: classificacao ? 'var(--destaque)' : 'var(--perigo)' }}>{classificacao ? 'Classificado!' : 'Eliminado'}</p>}
            <div className="lista">
              {estado.eventos.filter((e) => ['gol', 'vermelho', 'lesao'].includes(e.tipo)).map((e, i) => (
                <div key={i} className="muted">{e.tipo === 'gol' ? '⚽' : e.tipo === 'vermelho' ? '🟥' : '🚑'} {e.minuto}' {e.nome ?? nomes[e.lado]}</div>
              ))}
            </div>
            <div style={{ height: 10 }} />
            <button className="botao primario" onClick={concluir}>Continuar</button>
          </div>
        )}

        {ANIMADOS.includes(periodo) && <button className="botao" style={{ marginTop: 10 }} onClick={() => setFracao(1)}>⏩ Pular</button>}

        <div style={{ marginTop: 8 }}>
          {[...revelados].reverse().slice(0, 8).map((e, i) => (
            <div key={i} className={`lance ${e.tipo}`}><span className="min">{e.minuto}'</span><span>{narrar(e, nomes)}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: App (versão 2)** — em `src/ui/App.jsx`, importar o painel e usá-lo na fase `temporada`:

Acrescentar o import:
```jsx
import { Painel } from './telas/Painel.jsx';
```
E trocar a linha `else tela = <Andamento />;` por:
```jsx
  else if (carreira.fase === 'temporada') tela = <Painel />;
  else tela = <Andamento />;
```

- [ ] **Step 6: Rodar e ver passar; build**

Run: `npx vitest run tests/ui`
Expected: PASS (inclui os 3 testes de `app-temporada` e os 2 de `app-inicio`).
Run: `npx vite build`
Expected: `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/ui tests/ui/app-temporada.test.jsx
git commit -m "feat(ui): painel da temporada (abas) e partida ao vivo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Fim de temporada, janela de transferências e fim de carreira

**Files:**
- Create: `src/ui/telas/FimTemporada.jsx`, `src/ui/telas/FimCarreira.jsx`
- Modify: `src/ui/App.jsx` (versão final)
- Test: `tests/ui/app-janela.test.jsx`

**Interfaces:**
- Consumes: Tasks 3–5; motor (`girarTransferencia`, `aceitarTransferencia`, `recusarTransferencia`, `concluirTransferencias`, `TAMANHO_ELENCO`).
- Produces: `FimTemporada()` (resumo → janela), `FimCarreira()`; `App` final cobrindo todas as fases.

- [ ] **Step 1: Escrever o teste de fumaça que falha**

`tests/ui/app-janela.test.jsx`:
```jsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { clicar, passar, botoes, montar, fazerDraft } from './ajuda.jsx';

describe('app: fim de temporada', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('temporada inteira → resumo → janela de transferências → temporada 2', async () => {
    montar();
    await fazerDraft();
    for (let i = 0; i < 80 && !screen.queryByText('Ir para a janela de transferências'); i++) {
      const ok = screen.queryByText('OK');
      if (ok) await clicar(ok);
      const avancar = screen.queryByText('Simular') ?? screen.queryByText('Avançar');
      await clicar(avancar);
    }
    expect(screen.getByText(/Temporada 1 de 10/)).toBeTruthy();
    await clicar(screen.getByText('Ir para a janela de transferências'));
    for (let i = 0; i < 20 && !screen.queryByText(/Começar a temporada 2/); i++) {
      await clicar(botoes().find((b) => /^Girar roleta/.test(b.textContent)));
      await passar(2500);
      const recusar = screen.queryByText('Recusar');
      if (recusar) { await clicar(recusar); continue; }
      await clicar(botoes().find((b) => /anos/.test(b.textContent)));
      const confirmar = screen.getByText('Confirmar');
      if (confirmar.disabled) {
        const quemSai = botoes().filter((b) => /anos/.test(b.textContent)).at(-1);
        await clicar(quemSai);
      }
      await clicar(screen.getByText('Confirmar'));
    }
    await clicar(screen.getByText(/Começar a temporada 2/));
    expect(screen.getByText(/Temporada 2 de 10/)).toBeTruthy();
  }, 60000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/ui/app-janela.test.jsx`
Expected: FAIL — `Unable to find an element with the text: Ir para a janela de transferências`.

- [ ] **Step 3: Telas de fim de temporada e de carreira**

`src/ui/telas/FimTemporada.jsx`:
```jsx
import { useState } from 'react';
import { girarTransferencia, aceitarTransferencia, recusarTransferencia, concluirTransferencias } from '../../engine/carreira.js';
import { TAMANHO_ELENCO } from '../../engine/elenco.js';
import { useCarreira } from '../estado/CarreiraContext.jsx';
import { Roleta } from '../componentes/Roleta.jsx';
import { nomeCompeticao, competicoesDaProxima, ORDEM_COMPETICOES } from '../logica/temporada.js';

const FICHA = { boa: '🟢 Boa', media: '🟡 Média', ruim: '🔴 Ruim', reposicao: '⚪ Reposição' };

function Resumo({ onSeguir }) {
  const { carreira, dados } = useCarreira();
  const h = carreira.historico.at(-1);
  const env = carreira.transferencias?.envelhecimento ?? [];
  return (
    <>
      <h1 className="tela-titulo">Temporada {h.temporada} de {carreira.config.duracao}</h1>
      <div className="cartao realce" style={{ textAlign: 'center' }}>
        {h.titulos.length ? (
          <>
            <div className="trofeu">{'🏆'.repeat(h.titulos.length)}</div>
            {h.titulos.map((t) => <div key={t}><b>{nomeCompeticao(t, carreira, dados)}</b></div>)}
          </>
        ) : <p className="subtitulo" style={{ margin: 0 }}>Sem títulos desta vez.</p>}
      </div>
      <div className="secao">Campanha</div>
      <div className="lista">
        {ORDEM_COMPETICOES.filter((id) => h.campanhas[id]).map((id) => (
          <div key={id} className="linha"><span className="grow">{nomeCompeticao(id, carreira, dados)}</span><b>{h.campanhas[id]}</b></div>
        ))}
      </div>
      {h.artilheiro && <p className="muted">Artilheiro: <b>{h.artilheiro.nome}</b> ({h.artilheiro.gols} gols)</p>}
      <div className="secao">Próxima temporada</div>
      <p className="muted">{competicoesDaProxima(carreira).map((id) => nomeCompeticao(id, carreira, dados)).join(' · ')}</p>
      {env.length > 0 && (
        <>
          <div className="secao">Evolução do elenco</div>
          <div className="lista">
            {env.map((e) => (
              <div key={e.id} className="linha">
                <span className="grow">{e.nome} <span className="muted">· {e.idade} anos</span></span>
                {e.aposentou
                  ? <span className="muted">pendurou as chuteiras</span>
                  : e.ovrDepois > e.ovrAntes ? <span className="evolucao-sobe">↑ {e.ovrDepois}</span>
                    : e.ovrDepois < e.ovrAntes ? <span className="evolucao-cai">↓ {e.ovrDepois}</span>
                      : <span className="muted">= {e.ovrDepois}</span>}
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ height: 14 }} />
      <button className="botao primario" onClick={onSeguir}>Ir para a janela de transferências</button>
    </>
  );
}

function Janela() {
  const { carreira, dados, executar } = useCarreira();
  const { transferencias: tr, elenco, config } = carreira;
  const olheiro = config.dificuldade === 'olheiro';
  const [revelado, setRevelado] = useState(Boolean(tr.atual));
  const [entra, setEntra] = useState(null);
  const [sai, setSai] = useState(null);
  const cheio = Object.keys(elenco.jogadores).length >= TAMANHO_ELENCO;
  const atual = tr.fila[0];
  const novo = tr.atual?.opcoes.find((j) => j.id === entra);
  const elencoSorteado = tr.atual && dados.elencos.find((e) => e.id === tr.atual.elencoId);
  const limpar = () => { setEntra(null); setSai(null); };

  if (!tr.fila.length) {
    return (
      <>
        <p className="subtitulo">Janela fechada.</p>
        <button className="botao primario" onClick={() => executar((c) => concluirTransferencias(c, dados))}>
          Começar a temporada {carreira.temporada + 1}
        </button>
      </>
    );
  }

  return (
    <>
      <div className="segmentos" style={{ marginBottom: 10 }}>
        {tr.fila.map((r, i) => <span key={i} className={`chip ${i === 0 ? 'destaque' : ''}`}>{FICHA[r.tipo]}{r.obrigatoria ? ' · obrigatória' : ''}</span>)}
      </div>
      {!tr.atual ? (
        <button className="botao primario" onClick={() => { setRevelado(false); limpar(); executar((c) => girarTransferencia(c, dados)); }}>
          Girar roleta {FICHA[atual.tipo]}
        </button>
      ) : (
        <>
          <Roleta elencos={dados.elencos} alvoId={tr.atual.elencoId} onFim={() => setRevelado(true)} />
          {revelado && (
            <>
              <h2 style={{ fontSize: 16, margin: '12px 0 6px' }}>{elencoSorteado.clube} {elencoSorteado.ano}</h2>
              <div className="lista">
                {tr.atual.opcoes.map((j) => (
                  <button key={j.id} className={`linha ${entra === j.id ? 'on' : ''}`} onClick={() => setEntra(j.id)}>
                    <span className="pos">{j.pos}</span><span className="grow">{j.nome} <span className="muted">· {j.idade} anos</span></span>
                    {!olheiro && <span className="ovr">{j.ovr}</span>}
                  </button>
                ))}
              </div>
              {novo && cheio && (
                <>
                  <div className="secao">Quem sai?</div>
                  <div className="lista">
                    {Object.values(elenco.jogadores).map((j) => (
                      <button key={j.id} className={`linha ${sai === j.id ? 'on' : ''}`} onClick={() => setSai(j.id)}>
                        <span className="pos">{j.pos}</span><span className="grow">{j.nome} <span className="muted">· {j.idade} anos</span></span>
                        {!olheiro && <span className="ovr">{j.ovr}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {novo && (
                <p className="muted">Entra: <b>{novo.nome}</b>{!olheiro && ` (${novo.ovr})`}
                  {sai && <> · Sai: <b>{elenco.jogadores[sai].nome}</b>{!olheiro && ` (${elenco.jogadores[sai].ovr})`}</>}</p>
              )}
              <div className="botoes">
                <button className="botao primario" disabled={!novo || (cheio && !sai)}
                  onClick={() => { if (executar((c) => aceitarTransferencia(c, entra, cheio ? sai : null))) limpar(); }}>
                  Confirmar
                </button>
                {!atual.obrigatoria && <button className="botao" onClick={() => { limpar(); executar((c) => recusarTransferencia(c)); }}>Recusar</button>}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export function FimTemporada() {
  const [etapa, setEtapa] = useState('resumo');
  return (
    <div className="app">
      {etapa === 'resumo' ? <Resumo onSeguir={() => setEtapa('janela')} /> : (
        <>
          <h1 className="tela-titulo">Janela de transferências</h1>
          <Janela />
        </>
      )}
    </div>
  );
}
```

`src/ui/telas/FimCarreira.jsx`:
```jsx
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
```

- [ ] **Step 4: App (versão final)**

`src/ui/App.jsx`:
```jsx
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
```

- [ ] **Step 5: Rodar tudo e build**

Run: `npm test`
Expected: todos passando (≈ 315 testes).
Run: `npx vite build`
Expected: `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add src/ui tests/ui/app-janela.test.jsx
git commit -m "feat(ui): fim de temporada, janela de transferências e sala de troféus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Verificação manual**

Run: `npm run dev -- --host` e abrir o endereço mostrado no celular (mesma rede) e no computador.
Conferir: criar carreira → draft completo → assistir uma partida até o intervalo, trocar alguém e terminar → simular → "até importante" → abas Tabelas/Elenco/Calendário → recarregar a página e ver "Continuar". Anotar o que estiver estranho para ajustar.
