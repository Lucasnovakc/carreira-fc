# Carreira FC — Plano 1: Motor da partida e competições

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o motor do jogo em JavaScript puro e testado: sorteio com semente, posições e penalidades, força do time, simulação de partida (com intervalo, cansaço, lesões, vermelhos, VAR e prorrogação), pênaltis, pontos corridos, mata-mata e fase de grupos.

**Architecture:** Módulos ES em `src/engine/`, sem React e sem estado global. Toda função recebe dados e devolve dados novos (sem mutar a entrada); toda aleatoriedade vem de um `rng` passado por parâmetro. A UI (Plano 3) e a carreira (Plano 2) só chamam essas funções.

**Tech Stack:** Node 24, JavaScript (ES modules), Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-05-carreira-fc-design.md` (seções 4, 5.2–5.4 e 8–9).

Este é o 1º de 4 planos. Os próximos: **2** — dados, calendário, classificação, envelhecimento, roletas e estado da carreira; **3** — telas React (nova carreira, draft, painel, partida ao vivo); **4** — fim de temporada/carreira, save/export/import e deploy no GitHub Pages.

## Global Constraints

- Projeto em `C:\Users\User\Desktop\carreira-fc` (já é um repositório git com o spec commitado). Rodar todos os comandos nessa pasta.
- Código, nomes e mensagens em **português** (ex.: `criarRng`, `ordenarTabela`, `'Máximo de 4 substituições'`).
- `package.json` com `"type": "module"`; imports relativos com extensão `.js`.
- Posições válidas: `GOL, ZAG, LD, LE, VOL, MC, MEI, PD, PE, CA`.
- Penalidade fora de posição: natural 1.00 · vizinha 0.92 · distante 0.80 · goleiro↔linha 0.50.
- Postura: ofensiva ATA +4 / DEF −4; defensiva DEF +4 / ATA −4. Mando de campo: +2 em todos os setores.
- Partida: 18 lances de 5 min; lesão ~1,5% por jogador por jogo (fora 1–3 jogos); vermelho ~3% por time por jogo; máximo de 4 substituições; cansaço reduz até −10% no fim do 2º tempo e zera entre jogos.
- Calibração: média ~2,5 gols/jogo; time 10 pontos melhor vence ~60–65%.
- Pênaltis: base 75%, ajustada por ATA × GOL; 5 cobranças e depois alternadas.
- Desempate de pontos corridos: pontos, vitórias, saldo, gols pró.
- Mata-mata ida e volta sem gol fora de casa; empate no agregado vai para pênaltis.
- Libertadores/Sul-Americana: 32 times, 8 grupos de 4, 2 primeiros avançam.
- Funções do engine nunca mutam os argumentos.
- Commits terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Time reduzido a poucos jogadores** (vários vermelhos/lesões sem reserva) — a partida precisa terminar sem `NaN` e com o time desfalcado perdendo; setor sem ninguém vale `SETOR_VAZIO` (40). Testado na Task 4 ("time muito desfalcado") e Task 3 ("setor sem ninguém").
2. **Goleiro expulso ou lesionado sem reserva de goleiro** — o setor GOL cai para 40 (ou o reserva de linha entra com 50%) e o time passa a tomar mais gols; não pode quebrar. Coberto pelos mesmos testes do item 1.
3. **Intervalo com jogador que já saiu** (expulso/lesionado no 1º tempo) — tentar substituí-lo ou escalá-lo deve lançar erro claro, não corromper a escalação. Testado na Task 4 ("rejeita escalação com jogador que não está em campo").
4. **Mesmo `rng` compartilhado entre muitas partidas** — resultados determinísticos e reproduzíveis pela semente. Testado nas Tasks 1 e 4.
5. **Disputa de pênaltis longa** — com a probabilidade mínima de 55% a alternância sempre termina; o placar nunca empata no fim. Testado na Task 5.

---

### Task 1: Projeto base e sorteio com semente

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `src/engine/rng.js`
- Test: `tests/engine/rng.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `criarRng(semente: number) → { next(): number /*[0,1)*/, int(min, max): number /*inclusivo*/, chance(p): boolean, pick(lista): item, embaralhar(lista): novaLista, estado(): number }`. `criarRng(rng.estado())` continua a sequência exatamente de onde parou.

- [ ] **Step 1: Criar `package.json` e `.gitignore`**

`package.json`:
```json
{
  "name": "carreira-fc",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`.gitignore`:
```
node_modules
dist
```

- [ ] **Step 2: Instalar o Vitest**

Run: `npm install -D vitest@^3`
Expected: `package.json` ganha `"devDependencies": { "vitest": "^3.x" }` e aparece `package-lock.json`.

- [ ] **Step 3: Escrever o teste que falha**

`tests/engine/rng.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';

describe('criarRng', () => {
  it('mesma semente gera a mesma sequência', () => {
    const a = criarRng(123), b = criarRng(123);
    const sa = Array.from({ length: 5 }, () => a.next());
    const sb = Array.from({ length: 5 }, () => b.next());
    expect(sa).toEqual(sb);
  });

  it('sementes diferentes geram sequências diferentes', () => {
    expect(criarRng(1).next()).not.toBe(criarRng(2).next());
  });

  it('next fica em [0, 1)', () => {
    const r = criarRng(7);
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int é inclusivo nas duas pontas', () => {
    const r = criarRng(9);
    const vistos = new Set();
    for (let i = 0; i < 2000; i++) vistos.add(r.int(1, 3));
    expect([...vistos].sort()).toEqual([1, 2, 3]);
  });

  it('retoma a sequência a partir do estado salvo', () => {
    const a = criarRng(55);
    a.next(); a.next();
    const b = criarRng(a.estado());
    expect(b.next()).toBe(a.next());
  });

  it('embaralhar não altera a lista original e mantém os itens', () => {
    const r = criarRng(3);
    const lista = [1, 2, 3, 4, 5];
    const e = r.embaralhar(lista);
    expect(lista).toEqual([1, 2, 3, 4, 5]);
    expect([...e].sort()).toEqual(lista);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run tests/engine/rng.test.js`
Expected: FAIL — `Failed to resolve import "../../src/engine/rng.js"`.

- [ ] **Step 5: Implementar**

`src/engine/rng.js`:
```js
// Gerador pseudoaleatório com semente (mulberry32). O estado é um inteiro,
// então dá para salvar e retomar a sequência exatamente de onde parou.
export function criarRng(semente) {
  let s = semente >>> 0;
  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (lista) => lista[Math.floor(next() * lista.length)],
    embaralhar: (lista) => {
      const copia = [...lista];
      for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }
      return copia;
    },
    estado: () => s,
  };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run tests/engine/rng.test.js`
Expected: PASS (6 testes).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore src/engine/rng.js tests/engine/rng.test.js
git commit -m "feat(engine): projeto base e rng com semente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Posições e penalidade fora de posição

**Files:**
- Create: `src/engine/posicoes.js`
- Test: `tests/engine/posicoes.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `POSICOES: string[]` — as 10 posições.
  - `SETOR: { [pos]: 'gol' | 'def' | 'mei' | 'ata' }`.
  - `FATOR = { natural: 1, vizinha: 0.92, distante: 0.8, goleiro: 0.5 }`.
  - `fatorPosicao(natural: string, vaga: string) → number`.
  - `ovrEfetivo(jogador: { ovr, pos }, vaga: string) → number` (inteiro, arredondado).

- [ ] **Step 1: Escrever o teste que falha**

`tests/engine/posicoes.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { POSICOES, SETOR, fatorPosicao, ovrEfetivo } from '../../src/engine/posicoes.js';

describe('fatorPosicao', () => {
  it('posição natural vale 100%', () => {
    for (const p of POSICOES) expect(fatorPosicao(p, p)).toBe(1);
  });

  it.each([
    ['VOL', 'MC'], ['MC', 'VOL'], ['MC', 'MEI'], ['LD', 'ZAG'], ['LE', 'ZAG'],
    ['ZAG', 'VOL'], ['PE', 'CA'], ['PD', 'CA'], ['PE', 'MEI'], ['PD', 'MEI'],
    ['LD', 'PD'], ['LE', 'PE'],
  ])('%s em %s é vizinha (92%%)', (nat, vaga) => {
    expect(fatorPosicao(nat, vaga)).toBe(0.92);
  });

  it.each([
    ['ZAG', 'MEI'], ['LD', 'PE'], ['LD', 'LE'], ['PD', 'PE'], ['VOL', 'CA'], ['ZAG', 'CA'],
  ])('%s em %s é distante (80%%)', (nat, vaga) => {
    expect(fatorPosicao(nat, vaga)).toBe(0.8);
  });

  it('goleiro na linha e linha no gol valem 50%', () => {
    expect(fatorPosicao('GOL', 'CA')).toBe(0.5);
    expect(fatorPosicao('ZAG', 'GOL')).toBe(0.5);
  });
});

describe('ovrEfetivo', () => {
  it('arredonda o overall com o fator', () => {
    expect(ovrEfetivo({ ovr: 90, pos: 'CA' }, 'CA')).toBe(90);
    expect(ovrEfetivo({ ovr: 90, pos: 'PE' }, 'CA')).toBe(83); // 82.8
    expect(ovrEfetivo({ ovr: 90, pos: 'ZAG' }, 'MEI')).toBe(72);
    expect(ovrEfetivo({ ovr: 90, pos: 'GOL' }, 'CA')).toBe(45);
  });
});

describe('SETOR', () => {
  it('toda posição tem setor', () => {
    for (const p of POSICOES) expect(['gol', 'def', 'mei', 'ata']).toContain(SETOR[p]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/posicoes.test.js`
Expected: FAIL — `Failed to resolve import "../../src/engine/posicoes.js"`.

- [ ] **Step 3: Implementar**

`src/engine/posicoes.js`:
```js
export const POSICOES = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'CA'];

export const SETOR = {
  GOL: 'gol',
  ZAG: 'def', LD: 'def', LE: 'def',
  VOL: 'mei', MC: 'mei', MEI: 'mei',
  PD: 'ata', PE: 'ata', CA: 'ata',
};

// Pares de posições vizinhas (a ordem não importa).
const VIZINHOS = [
  ['ZAG', 'LD'], ['ZAG', 'LE'], ['ZAG', 'VOL'],
  ['LD', 'PD'], ['LE', 'PE'],
  ['VOL', 'MC'], ['MC', 'MEI'],
  ['MEI', 'PD'], ['MEI', 'PE'],
  ['PD', 'CA'], ['PE', 'CA'],
];

const chave = (a, b) => [a, b].sort().join('-');
const VIZINHOS_SET = new Set(VIZINHOS.map(([a, b]) => chave(a, b)));

export const FATOR = { natural: 1, vizinha: 0.92, distante: 0.8, goleiro: 0.5 };

export function fatorPosicao(natural, vaga) {
  if (natural === vaga) return FATOR.natural;
  if (natural === 'GOL' || vaga === 'GOL') return FATOR.goleiro;
  if (VIZINHOS_SET.has(chave(natural, vaga))) return FATOR.vizinha;
  return FATOR.distante;
}

export function ovrEfetivo(jogador, vaga) {
  return Math.round(jogador.ovr * fatorPosicao(jogador.pos, vaga));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/engine/posicoes.test.js`
Expected: PASS (22 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/posicoes.js tests/engine/posicoes.test.js
git commit -m "feat(engine): posições e penalidade fora de posição

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Formações e força do time

**Files:**
- Create: `src/data/formacoes.json`
- Create: `src/engine/forca.js`
- Test: `tests/engine/forca.test.js`

**Interfaces:**
- Consumes: `SETOR`, `ovrEfetivo` (Task 2).
- Produces:
  - `formacoes.json`: `[{ id: '4-3-3', descricao, vagas: string[11] }]` — 7 formações, cada uma com exatamente 1 `GOL`.
  - Constantes: `SETOR_VAZIO = 40`, `BONUS_POSTURA = 4`, `BONUS_MANDO = 2`, `FATOR_DESFALQUE = 0.92`, `QUEDA_MAX_CANSACO = 0.1`.
  - `setoresDaEscalacao(escalacao: [{ jogador, vaga }], cansaco?: { [jogadorId]: 0..100 }, progresso?: 0..1) → { gol, def, mei, ata }` — média do overall efetivo por setor; `progresso` é quanto do 2º tempo já passou.
  - `aplicarModificadores(setores, { postura?, mandante?, desfalques? }) → setores` — novo objeto.
  - `setoresDoLado(lado, { mandante?, progresso? }) → setores` — `lado` é `{ setoresBase?, escalacao?, cansaco, postura, desfalques }`; usa `escalacao` se existir, senão `setoresBase` (adversário do computador).

- [ ] **Step 1: Criar as formações**

`src/data/formacoes.json`:
```json
[
  { "id": "4-3-3", "descricao": "Equilíbrio total com três pontas.", "vagas": ["GOL", "LD", "ZAG", "ZAG", "LE", "VOL", "MC", "MC", "PD", "CA", "PE"] },
  { "id": "4-4-2", "descricao": "Clássico, com dois atacantes e alas.", "vagas": ["GOL", "LD", "ZAG", "ZAG", "LE", "VOL", "MC", "PD", "PE", "CA", "CA"] },
  { "id": "4-2-3-1", "descricao": "Dois volantes e um meia armador.", "vagas": ["GOL", "LD", "ZAG", "ZAG", "LE", "VOL", "VOL", "PD", "MEI", "PE", "CA"] },
  { "id": "4-2-4", "descricao": "Ofensivo à moda antiga.", "vagas": ["GOL", "LD", "ZAG", "ZAG", "LE", "VOL", "MC", "PD", "CA", "CA", "PE"] },
  { "id": "4-2-2-2", "descricao": "O quadrado mágico.", "vagas": ["GOL", "LD", "ZAG", "ZAG", "LE", "VOL", "VOL", "MEI", "MEI", "CA", "CA"] },
  { "id": "4-5-1", "descricao": "Meio-campo povoado, um homem na frente.", "vagas": ["GOL", "LD", "ZAG", "ZAG", "LE", "VOL", "MC", "MC", "MEI", "MEI", "CA"] },
  { "id": "4-3-1-2", "descricao": "Losango com camisa 10.", "vagas": ["GOL", "LD", "ZAG", "ZAG", "LE", "VOL", "MC", "MC", "MEI", "CA", "CA"] }
]
```

- [ ] **Step 2: Escrever o teste que falha**

`tests/engine/forca.test.js`:
```js
import { describe, it, expect } from 'vitest';
import formacoes from '../../src/data/formacoes.json';
import { POSICOES } from '../../src/engine/posicoes.js';
import { setoresDaEscalacao, aplicarModificadores, setoresDoLado, SETOR_VAZIO } from '../../src/engine/forca.js';

const j = (id, pos, ovr) => ({ id, nome: id, pos, ovr, idade: 25 });

function escalacaoNatural(ovr = 80) {
  const vagas = formacoes.find((f) => f.id === '4-3-3').vagas;
  return vagas.map((vaga, i) => ({ jogador: j(`p${i}`, vaga, ovr), vaga }));
}

describe('formacoes.json', () => {
  it('toda formação tem 11 vagas válidas e exatamente 1 GOL', () => {
    expect(formacoes.length).toBe(7);
    for (const f of formacoes) {
      expect(f.vagas).toHaveLength(11);
      for (const v of f.vagas) expect(POSICOES).toContain(v);
      expect(f.vagas.filter((v) => v === 'GOL')).toHaveLength(1);
    }
  });
});

describe('setoresDaEscalacao', () => {
  it('média por setor com todos na posição natural', () => {
    expect(setoresDaEscalacao(escalacaoNatural(80))).toEqual({ gol: 80, def: 80, mei: 80, ata: 80 });
  });

  it('jogador fora de posição puxa o setor para baixo', () => {
    const esc = escalacaoNatural(80);
    esc[0] = { jogador: j('zag', 'ZAG', 80), vaga: 'GOL' }; // zagueiro no gol: 40
    expect(setoresDaEscalacao(esc).gol).toBe(40);
  });

  it('setor sem ninguém vale SETOR_VAZIO', () => {
    const esc = escalacaoNatural(80).filter((e) => e.vaga !== 'GOL');
    expect(setoresDaEscalacao(esc).gol).toBe(SETOR_VAZIO);
  });

  it('cansaço só pesa conforme o progresso do 2º tempo', () => {
    const esc = escalacaoNatural(80);
    const cansaco = Object.fromEntries(esc.map((e) => [e.jogador.id, 100]));
    expect(setoresDaEscalacao(esc, cansaco, 0).ata).toBe(80);
    expect(setoresDaEscalacao(esc, cansaco, 1).ata).toBeCloseTo(72);
    expect(setoresDaEscalacao(esc, cansaco, 0.5).ata).toBeCloseTo(76);
  });
});

describe('aplicarModificadores', () => {
  const base = { gol: 70, def: 70, mei: 70, ata: 70 };
  it('ofensiva troca defesa por ataque', () => {
    expect(aplicarModificadores(base, { postura: 'ofensiva' })).toEqual({ gol: 70, def: 66, mei: 70, ata: 74 });
  });
  it('defensiva troca ataque por defesa', () => {
    expect(aplicarModificadores(base, { postura: 'defensiva' })).toEqual({ gol: 70, def: 74, mei: 70, ata: 66 });
  });
  it('mandante ganha +2 em tudo', () => {
    expect(aplicarModificadores(base, { mandante: true })).toEqual({ gol: 72, def: 72, mei: 72, ata: 72 });
  });
  it('cada desfalque multiplica por 0.92', () => {
    expect(aplicarModificadores(base, { desfalques: 1 }).mei).toBeCloseTo(64.4);
  });
  it('não altera o objeto original', () => {
    aplicarModificadores(base, { postura: 'ofensiva', mandante: true });
    expect(base).toEqual({ gol: 70, def: 70, mei: 70, ata: 70 });
  });
});

describe('setoresDoLado', () => {
  it('usa setoresBase quando não há escalação (adversário do computador)', () => {
    const lado = { setoresBase: { gol: 75, def: 76, mei: 77, ata: 78 }, postura: 'equilibrada', desfalques: 0 };
    expect(setoresDoLado(lado)).toEqual({ gol: 75, def: 76, mei: 77, ata: 78 });
  });
  it('usa a escalação quando existe', () => {
    const lado = { escalacao: escalacaoNatural(85), cansaco: {}, postura: 'equilibrada', desfalques: 0 };
    expect(setoresDoLado(lado, { mandante: true }).ata).toBe(87);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/engine/forca.test.js`
Expected: FAIL — `Failed to resolve import "../../src/engine/forca.js"`.

- [ ] **Step 4: Implementar**

`src/engine/forca.js`:
```js
import { SETOR, ovrEfetivo } from './posicoes.js';

export const SETOR_VAZIO = 40;
export const BONUS_POSTURA = 4;
export const BONUS_MANDO = 2;
export const FATOR_DESFALQUE = 0.92;
export const QUEDA_MAX_CANSACO = 0.1;

// escalacao: [{ jogador: { id, ovr, pos }, vaga }]
// cansaco: { [jogadorId]: 0..100 }; progresso: 0..1 dentro do 2º tempo
export function setoresDaEscalacao(escalacao, cansaco = {}, progresso = 0) {
  const soma = { gol: 0, def: 0, mei: 0, ata: 0 };
  const qtd = { gol: 0, def: 0, mei: 0, ata: 0 };
  for (const { jogador, vaga } of escalacao) {
    const setor = SETOR[vaga];
    const queda = QUEDA_MAX_CANSACO * ((cansaco[jogador.id] ?? 0) / 100) * progresso;
    soma[setor] += ovrEfetivo(jogador, vaga) * (1 - queda);
    qtd[setor] += 1;
  }
  const r = {};
  for (const s of Object.keys(soma)) r[s] = qtd[s] ? soma[s] / qtd[s] : SETOR_VAZIO;
  return r;
}

export function aplicarModificadores(setores, { postura = 'equilibrada', mandante = false, desfalques = 0 } = {}) {
  const r = { ...setores };
  if (postura === 'ofensiva') { r.ata += BONUS_POSTURA; r.def -= BONUS_POSTURA; }
  if (postura === 'defensiva') { r.def += BONUS_POSTURA; r.ata -= BONUS_POSTURA; }
  const fator = FATOR_DESFALQUE ** desfalques;
  for (const s of Object.keys(r)) {
    if (mandante) r[s] += BONUS_MANDO;
    r[s] *= fator;
  }
  return r;
}

// lado: { setoresBase?, escalacao?, cansaco, postura, desfalques }
export function setoresDoLado(lado, { mandante = false, progresso = 0 } = {}) {
  const base = lado.escalacao
    ? setoresDaEscalacao(lado.escalacao, lado.cansaco, progresso)
    : lado.setoresBase;
  return aplicarModificadores(base, { postura: lado.postura, mandante, desfalques: lado.desfalques });
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/engine/forca.test.js`
Expected: PASS (12 testes).

- [ ] **Step 6: Commit**

```bash
git add src/data/formacoes.json src/engine/forca.js tests/engine/forca.test.js
git commit -m "feat(engine): formações e força do time por setor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Simulação da partida

**Files:**
- Create: `src/engine/partida.js`
- Test: `tests/engine/partida.test.js`

**Interfaces:**
- Consumes: `criarRng` (Task 1), `SETOR`, `ovrEfetivo` (Task 2), `setoresDoLado` (Task 3), `formacoes.json` (só nos testes).
- Produces:
  - `CONST` — constantes calibradas (`K = 0.0055`, `BASE_CHANCE = 0.4`, `BASE_GOL = 0.35`, `MAX_TROCAS = 4`, …).
  - `criarLado({ id, nome, setoresBase?, escalacao?, banco?, postura? }) → lado` — `escalacao: [{ jogador: { id, nome, pos, ovr, idade }, vaga }]`, `banco: jogador[]`. O chamador já entrega só jogadores disponíveis (sem lesionados/suspensos).
  - `iniciarPartida({ casa, fora, neutro? }) → estado` com `{ casa, fora, neutro, tempo: 0, placar: { casa, fora }, eventos: [], lesoes: [], expulsos: [], acrescimos: null }`.
  - `simularPrimeiroTempo(estado, rng) → estado` (tempo 1; gera `lado.cansaco`).
  - `aplicarIntervalo(estado, 'casa' | 'fora', { trocas?: [{ saiId, entraId }], escalacao?: [{ jogadorId, vaga }], postura? }) → estado` — lança `Error` se inválido.
  - `intervaloAutomatico(estado, 'casa' | 'fora') → estado`.
  - `simularSegundoTempo(estado, rng) → estado` (tempo 2).
  - `simularProrrogacao(estado, rng) → estado` (tempo 3; minutos 91–120).
  - `simularPartida({ casa, fora, neutro?, prorrogacao? }, rng) → estado` — jogo completo sem pausa.
  - Evento: `{ minuto, tipo: 'gol' | 'chance' | 'var' | 'vermelho' | 'lesao' | 'troca', lado: 'casa' | 'fora', jogadorId, nome, entraId?, entraNome?, jogos? }`. Gol de time sem elenco tem `nome: null`.
  - `estado.lesoes: [{ lado, jogadorId, jogos }]`, `estado.expulsos: [{ lado, jogadorId }]` — o Plano 2 usa para lesões e suspensões entre jogos.

- [ ] **Step 1: Escrever o teste que falha**

`tests/engine/partida.test.js`:
```js
import { describe, it, expect } from 'vitest';
import formacoes from '../../src/data/formacoes.json';
import { criarRng } from '../../src/engine/rng.js';
import {
  CONST, criarLado, iniciarPartida, simularPrimeiroTempo, aplicarIntervalo,
  intervaloAutomatico, simularSegundoTempo, simularProrrogacao, simularPartida,
} from '../../src/engine/partida.js';

const VAGAS_433 = formacoes.find((f) => f.id === '4-3-3').vagas;

function timeComElenco(prefixo, ovr = 80, idade = 25) {
  const escalacao = VAGAS_433.map((vaga, i) => ({
    jogador: { id: `${prefixo}${i}`, nome: `${prefixo} ${i}`, pos: vaga, ovr, idade },
    vaga,
  }));
  const banco = ['GOL', 'ZAG', 'MC', 'CA'].map((pos, i) => ({
    id: `${prefixo}b${i}`, nome: `${prefixo} reserva ${i}`, pos, ovr, idade: 22,
  }));
  return criarLado({ id: prefixo, nome: prefixo, escalacao, banco });
}

const timeCpu = (id, n) => criarLado({ id, nome: id, setoresBase: { gol: n, def: n, mei: n, ata: n } });

function estatisticas(casa, fora, n, semente = 1) {
  const rng = criarRng(semente);
  let gols = 0, v = 0, e = 0;
  for (let i = 0; i < n; i++) {
    const r = simularPartida({ casa, fora, neutro: true }, rng);
    gols += r.placar.casa + r.placar.fora;
    if (r.placar.casa > r.placar.fora) v++;
    else if (r.placar.casa === r.placar.fora) e++;
  }
  return { gols: gols / n, vitorias: v / n, empates: e / n };
}

describe('calibração', () => {
  it('times iguais: ~2,5 gols por jogo e 20–30% de empates', () => {
    const s = estatisticas(timeCpu('A', 75), timeCpu('B', 75), 10000);
    expect(s.gols).toBeGreaterThan(2.3);
    expect(s.gols).toBeLessThan(2.8);
    expect(s.empates).toBeGreaterThan(0.2);
    expect(s.empates).toBeLessThan(0.3);
  });

  it('time 10 pontos melhor vence entre 57% e 68%', () => {
    const s = estatisticas(timeCpu('A', 85), timeCpu('B', 75), 10000);
    expect(s.vitorias).toBeGreaterThan(0.57);
    expect(s.vitorias).toBeLessThan(0.68);
  });

  it('mando de campo ajuda', () => {
    const rng = criarRng(5);
    let vCasa = 0, vFora = 0;
    for (let i = 0; i < 10000; i++) {
      const r = simularPartida({ casa: timeCpu('A', 75), fora: timeCpu('B', 75) }, rng);
      if (r.placar.casa > r.placar.fora) vCasa++;
      if (r.placar.fora > r.placar.casa) vFora++;
    }
    expect(vCasa).toBeGreaterThan(vFora);
  });
});

describe('fluxo da partida', () => {
  it('é determinística com a mesma semente', () => {
    const a = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 78) }, criarRng(42));
    const b = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 78) }, criarRng(42));
    expect(a).toEqual(b);
  });

  it('não altera os lados recebidos', () => {
    const casa = timeComElenco('A');
    const copia = structuredClone(casa);
    simularPartida({ casa, fora: timeCpu('B', 78) }, criarRng(1));
    expect(casa).toEqual(copia);
  });

  it('gols no placar batem com os eventos de gol', () => {
    const rng = criarRng(8);
    for (let i = 0; i < 200; i++) {
      const r = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }, rng);
      expect(r.eventos.filter((e) => e.tipo === 'gol' && e.lado === 'casa')).toHaveLength(r.placar.casa);
      expect(r.eventos.filter((e) => e.tipo === 'gol' && e.lado === 'fora')).toHaveLength(r.placar.fora);
    }
  });

  it('eventos do 1º tempo vão até 45 e do 2º até 90', () => {
    const rng = criarRng(3);
    let e = simularPrimeiroTempo(iniciarPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }), rng);
    expect(e.eventos.every((ev) => ev.minuto >= 1 && ev.minuto <= 45)).toBe(true);
    const n1 = e.eventos.length;
    e = simularSegundoTempo(e, rng);
    expect(e.eventos.slice(n1).every((ev) => ev.minuto >= 46 && ev.minuto <= 90)).toBe(true);
  });

  it('gol do time com elenco tem autor; gol do computador não', () => {
    const rng = criarRng(11);
    for (let i = 0; i < 100; i++) {
      const r = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }, rng);
      for (const ev of r.eventos.filter((x) => x.tipo === 'gol')) {
        if (ev.lado === 'casa') expect(ev.nome).toMatch(/^A /);
        else expect(ev.nome).toBeNull();
      }
    }
  });

  it('respeita a ordem dos tempos', () => {
    const rng = criarRng(1);
    const e0 = iniciarPartida({ casa: timeCpu('A', 70), fora: timeCpu('B', 70) });
    expect(() => simularSegundoTempo(e0, rng)).toThrow();
    expect(() => simularProrrogacao(e0, rng)).toThrow();
    const e1 = simularPrimeiroTempo(e0, rng);
    expect(() => simularPrimeiroTempo(e1, rng)).toThrow();
  });

  it('prorrogação só acontece se pedida e empatado', () => {
    const rng = criarRng(21);
    let houve = 0;
    for (let i = 0; i < 300; i++) {
      const r = simularPartida({ casa: timeCpu('A', 75), fora: timeCpu('B', 75), prorrogacao: true }, rng);
      if (r.tempo === 3) {
        houve++;
        expect(r.eventos.filter((ev) => ev.minuto > 90).every((ev) => ev.minuto <= 120)).toBe(true);
      }
    }
    expect(houve).toBeGreaterThan(0);
  });
});

describe('intervalo', () => {
  const primeiroTempo = (semente = 2) =>
    simularPrimeiroTempo(iniciarPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }), criarRng(semente));

  it('gera cansaço para os titulares no fim do 1º tempo', () => {
    const e = primeiroTempo();
    for (const { jogador } of e.casa.escalacao) {
      expect(e.casa.cansaco[jogador.id]).toBeGreaterThanOrEqual(0);
      expect(e.casa.cansaco[jogador.id]).toBeLessThanOrEqual(100);
    }
  });

  it('veteranos cansam mais que jovens na média', () => {
    const rng = criarRng(4);
    let velhos = 0, jovens = 0;
    for (let i = 0; i < 200; i++) {
      const v = simularPrimeiroTempo(iniciarPartida({ casa: timeComElenco('V', 80, 34), fora: timeCpu('B', 80) }), rng);
      const j = simularPrimeiroTempo(iniciarPartida({ casa: timeComElenco('J', 80, 22), fora: timeCpu('B', 80) }), rng);
      velhos += v.casa.cansaco[v.casa.escalacao[5].jogador.id];
      jovens += j.casa.cansaco[j.casa.escalacao[5].jogador.id];
    }
    expect(velhos).toBeGreaterThan(jovens);
  });

  it('troca jogador do banco na mesma vaga', () => {
    const e = primeiroTempo();
    const sai = e.casa.escalacao.find((x) => x.vaga === 'CA');
    if (!sai) return; // CA pode ter sido expulso nesta semente
    const e2 = aplicarIntervalo(e, 'casa', { trocas: [{ saiId: sai.jogador.id, entraId: 'Ab3' }] });
    expect(e2.casa.escalacao.find((x) => x.jogador.id === 'Ab3').vaga).toBe('CA');
    expect(e2.casa.banco.some((j) => j.id === 'Ab3')).toBe(false);
    expect(e2.casa.trocas).toBe(e.casa.trocas + 1);
    expect(e2.eventos.at(-1)).toMatchObject({ tipo: 'troca', minuto: 45, entraId: 'Ab3' });
  });

  it('muda formação e postura', () => {
    const e = primeiroTempo();
    const nova = e.casa.escalacao.map((x) => ({ jogadorId: x.jogador.id, vaga: x.vaga === 'PE' ? 'MEI' : x.vaga }));
    const e2 = aplicarIntervalo(e, 'casa', { escalacao: nova, postura: 'defensiva' });
    expect(e2.casa.postura).toBe('defensiva');
    expect(e2.casa.escalacao.some((x) => x.vaga === 'MEI')).toBe(true);
  });

  it('rejeita escalação com jogador que não está em campo', () => {
    const e = primeiroTempo();
    const nova = e.casa.escalacao.map((x) => ({ jogadorId: x.jogador.id, vaga: x.vaga }));
    nova[0] = { jogadorId: 'Ab0', vaga: 'GOL' };
    expect(() => aplicarIntervalo(e, 'casa', { escalacao: nova })).toThrow();
  });

  it(`rejeita mais de ${CONST.MAX_TROCAS} trocas e jogador fora do banco`, () => {
    const e = primeiroTempo();
    const ids = e.casa.escalacao.map((x) => x.jogador.id);
    const cinco = ['Ab0', 'Ab1', 'Ab2', 'Ab3', 'X'].map((entraId, i) => ({ saiId: ids[i], entraId }));
    expect(() => aplicarIntervalo(e, 'casa', { trocas: cinco })).toThrow();
    expect(() => aplicarIntervalo(e, 'casa', { trocas: [{ saiId: ids[0], entraId: 'nao-existe' }] })).toThrow();
  });

  it('não dá para mexer fora do intervalo', () => {
    const e0 = iniciarPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) });
    expect(() => aplicarIntervalo(e0, 'casa', { postura: 'ofensiva' })).toThrow();
  });

  it('intervalo automático só troca cansados por reservas que rendem igual ou mais', () => {
    const e = primeiroTempo();
    for (const id of Object.keys(e.casa.cansaco)) e.casa.cansaco[id] = 90;
    const e2 = intervaloAutomatico(e, 'casa');
    expect(e2.casa.trocas).toBeGreaterThan(0);
    expect(e2.casa.trocas).toBeLessThanOrEqual(CONST.MAX_TROCAS);
  });
});

describe('lesões e cartões', () => {
  it('taxas próximas de 1,5% por jogador e 3% por time', () => {
    const rng = criarRng(77);
    const N = 4000;
    let lesoes = 0, vermelhos = 0;
    for (let i = 0; i < N; i++) {
      const r = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }, rng);
      lesoes += r.lesoes.length;
      vermelhos += r.eventos.filter((ev) => ev.tipo === 'vermelho' && ev.lado === 'casa').length;
    }
    expect(lesoes / (N * 11)).toBeGreaterThan(0.01);
    expect(lesoes / (N * 11)).toBeLessThan(0.025);
    expect(vermelhos / N).toBeGreaterThan(0.02);
    expect(vermelhos / N).toBeLessThan(0.045);
  });

  it('lesionado sai de campo e fica 1 a 3 jogos fora', () => {
    const rng = criarRng(99);
    for (let i = 0; i < 500; i++) {
      const r = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }, rng);
      for (const l of r.lesoes) {
        expect(l.jogos).toBeGreaterThanOrEqual(1);
        expect(l.jogos).toBeLessThanOrEqual(3);
        expect(r.casa.escalacao.some((e) => e.jogador.id === l.jogadorId)).toBe(false);
      }
    }
  });

  it('expulso sai de campo e o time fica com menos gente', () => {
    const rng = criarRng(13);
    let viu = false;
    for (let i = 0; i < 2000 && !viu; i++) {
      const r = simularPartida({ casa: timeComElenco('A'), fora: timeCpu('B', 80) }, rng);
      if (r.expulsos.length) {
        viu = true;
        const { jogadorId } = r.expulsos[0];
        expect(r.casa.escalacao.some((e) => e.jogador.id === jogadorId)).toBe(false);
        expect(r.casa.desfalques).toBeGreaterThanOrEqual(1);
      }
    }
    expect(viu).toBe(true);
  });

  it('VAR anula gols às vezes', () => {
    const rng = criarRng(31);
    let anulados = 0;
    for (let i = 0; i < 1000; i++) {
      anulados += simularPartida({ casa: timeCpu('A', 80), fora: timeCpu('B', 80) }, rng)
        .eventos.filter((ev) => ev.tipo === 'var').length;
    }
    expect(anulados).toBeGreaterThan(0);
  });
});

describe('time muito desfalcado', () => {
  it('com só 3 jogadores e sem banco a partida termina sem NaN', () => {
    const casa = timeComElenco('A');
    casa.escalacao = casa.escalacao.slice(8); // sobram PD, CA, PE — sem goleiro nem defesa
    casa.banco = [];
    casa.desfalques = 8;
    const r = simularPartida({ casa, fora: timeCpu('B', 75) }, criarRng(6));
    expect(Number.isInteger(r.placar.casa)).toBe(true);
    expect(Number.isInteger(r.placar.fora)).toBe(true);
    expect(r.placar.fora).toBeGreaterThan(r.placar.casa);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/partida.test.js`
Expected: FAIL — `Failed to resolve import "../../src/engine/partida.js"`.

- [ ] **Step 3: Implementar**

`src/engine/partida.js`:
```js
import { SETOR, ovrEfetivo } from './posicoes.js';
import { setoresDoLado } from './forca.js';

export const CONST = {
  TICKS_TEMPO: 9, // 9 lances de 5 minutos por tempo
  TICKS_PRORROGACAO: 6,
  K: 0.0055, // sensibilidade à diferença de força (calibrada)
  BASE_CHANCE: 0.4,
  BASE_GOL: 0.35,
  P_LESAO_JOGO: 0.015, // por jogador por jogo
  P_VERMELHO_JOGO: 0.03, // por time por jogo
  P_VAR: 0.04, // chance de um gol ser anulado
  MAX_TROCAS: 4,
};

const TICKS_JOGO = CONST.TICKS_TEMPO * 2;
const PESO_AUTOR = { ata: 5, mei: 2, def: 1, gol: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function criarLado({ id, nome, setoresBase = null, escalacao = null, banco = [], postura = 'equilibrada' }) {
  return {
    id, nome, setoresBase, postura,
    escalacao: escalacao ? escalacao.map((e) => ({ ...e })) : null,
    banco: [...banco],
    desfalques: 0,
    trocas: 0,
    cansaco: {},
  };
}

export function iniciarPartida({ casa, fora, neutro = false }) {
  return {
    casa: structuredClone(casa),
    fora: structuredClone(fora),
    neutro,
    tempo: 0, // 0 = não começou, 1 = fim do 1º, 2 = fim do 2º, 3 = fim da prorrogação
    placar: { casa: 0, fora: 0 },
    eventos: [],
    lesoes: [], // { lado, jogadorId, jogos }
    expulsos: [], // { lado, jogadorId }
    acrescimos: null,
  };
}

function melhorReserva(lado, vaga) {
  let melhor = null;
  for (const j of lado.banco) {
    if (!melhor || ovrEfetivo(j, vaga) > ovrEfetivo(melhor, vaga)) melhor = j;
  }
  return melhor;
}

function substituir(estado, chave, saiId, entra, minuto) {
  const lado = estado[chave];
  const idx = lado.escalacao.findIndex((e) => e.jogador.id === saiId);
  const sai = lado.escalacao[idx];
  lado.escalacao[idx] = { jogador: entra, vaga: sai.vaga };
  lado.banco = lado.banco.filter((j) => j.id !== entra.id);
  lado.trocas += 1;
  estado.eventos.push({
    minuto, tipo: 'troca', lado: chave,
    jogadorId: sai.jogador.id, nome: sai.jogador.nome, entraId: entra.id, entraNome: entra.nome,
  });
}

function escolherAutor(lado, rng) {
  if (!lado.escalacao) return null;
  const pesos = lado.escalacao.map((e) => PESO_AUTOR[SETOR[e.vaga]]);
  const total = pesos.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  let r = rng.next() * total;
  for (let i = 0; i < pesos.length; i++) {
    r -= pesos[i];
    if (r < 0) return lado.escalacao[i].jogador;
  }
  return null;
}

function incidentes(estado, chave, rng, minuto) {
  const lado = estado[chave];
  if (lado.escalacao) {
    const pLesao = CONST.P_LESAO_JOGO / TICKS_JOGO;
    for (const { jogador, vaga } of [...lado.escalacao]) {
      if (!rng.chance(pLesao)) continue;
      const jogos = rng.int(1, 3);
      estado.lesoes.push({ lado: chave, jogadorId: jogador.id, jogos });
      estado.eventos.push({ minuto, tipo: 'lesao', lado: chave, jogadorId: jogador.id, nome: jogador.nome, jogos });
      const reserva = lado.trocas < CONST.MAX_TROCAS ? melhorReserva(lado, vaga) : null;
      if (reserva) {
        substituir(estado, chave, jogador.id, reserva, minuto);
      } else {
        lado.escalacao = lado.escalacao.filter((e) => e.jogador.id !== jogador.id);
        lado.desfalques += 1;
      }
    }
  }
  if (rng.chance(CONST.P_VERMELHO_JOGO / TICKS_JOGO)) {
    let jogador = null;
    if (lado.escalacao && lado.escalacao.length) {
      jogador = rng.pick(lado.escalacao).jogador;
      lado.escalacao = lado.escalacao.filter((e) => e.jogador.id !== jogador.id);
      estado.expulsos.push({ lado: chave, jogadorId: jogador.id });
    }
    lado.desfalques += 1;
    estado.eventos.push({ minuto, tipo: 'vermelho', lado: chave, jogadorId: jogador?.id ?? null, nome: jogador?.nome ?? null });
  }
}

function lance(estado, rng, tick, progresso) {
  const minuto = tick * 5 + rng.int(1, 5);
  const sc = setoresDoLado(estado.casa, { mandante: !estado.neutro, progresso });
  const sf = setoresDoLado(estado.fora, { progresso });
  const pCasa = clamp(0.5 + (sc.mei - sf.mei) * CONST.K, 0.2, 0.8);
  const [chave, at, df] = rng.chance(pCasa) ? ['casa', sc, sf] : ['fora', sf, sc];
  const pChance = clamp(CONST.BASE_CHANCE + (at.ata - df.def) * CONST.K, 0.1, 0.8);
  if (rng.chance(pChance)) {
    const autor = escolherAutor(estado[chave], rng);
    const base = { minuto, lado: chave, jogadorId: autor?.id ?? null, nome: autor?.nome ?? null };
    const pGol = clamp(CONST.BASE_GOL + (at.ata - df.gol) * CONST.K, 0.08, 0.7);
    if (!rng.chance(pGol)) {
      estado.eventos.push({ ...base, tipo: 'chance' });
    } else if (rng.chance(CONST.P_VAR)) {
      estado.eventos.push({ ...base, tipo: 'var' });
    } else {
      estado.placar[chave] += 1;
      estado.eventos.push({ ...base, tipo: 'gol' });
    }
  }
  incidentes(estado, 'casa', rng, minuto);
  incidentes(estado, 'fora', rng, minuto);
}

function gerarCansaco(lado, rng) {
  if (!lado.escalacao) return;
  for (const { jogador } of lado.escalacao) {
    let c = 50 + rng.int(-10, 10);
    if (jogador.idade >= 32) c += 15;
    if (lado.postura === 'ofensiva') c += 10;
    lado.cansaco[jogador.id] = clamp(c, 0, 100);
  }
}

export function simularPrimeiroTempo(estadoAnterior, rng) {
  if (estadoAnterior.tempo !== 0) throw new Error('O 1º tempo já foi jogado');
  const estado = structuredClone(estadoAnterior);
  estado.acrescimos = { primeiro: rng.int(1, 4), segundo: rng.int(2, 7) };
  for (let t = 0; t < CONST.TICKS_TEMPO; t++) lance(estado, rng, t, 0);
  gerarCansaco(estado.casa, rng);
  gerarCansaco(estado.fora, rng);
  estado.tempo = 1;
  return estado;
}

// trocas: [{ saiId, entraId }]
// escalacao (opcional): [{ jogadorId, vaga }] com exatamente os jogadores em campo depois das trocas
export function aplicarIntervalo(estadoAnterior, chave, { trocas = [], escalacao = null, postura = null } = {}) {
  if (estadoAnterior.tempo !== 1) throw new Error('Só dá para mexer no time no intervalo');
  const estado = structuredClone(estadoAnterior);
  const lado = estado[chave];
  if (!lado.escalacao) throw new Error('Este time não tem escalação');
  if (lado.trocas + trocas.length > CONST.MAX_TROCAS) throw new Error(`Máximo de ${CONST.MAX_TROCAS} substituições`);
  for (const { saiId, entraId } of trocas) {
    if (!lado.escalacao.some((e) => e.jogador.id === saiId)) throw new Error(`Jogador ${saiId} não está em campo`);
    const entra = lado.banco.find((j) => j.id === entraId);
    if (!entra) throw new Error(`Jogador ${entraId} não está no banco`);
    substituir(estado, chave, saiId, entra, 45);
  }
  if (escalacao) {
    const emCampo = new Map(lado.escalacao.map((e) => [e.jogador.id, e.jogador]));
    const ids = escalacao.map((e) => e.jogadorId);
    const valida = ids.length === emCampo.size && new Set(ids).size === ids.length && ids.every((id) => emCampo.has(id));
    if (!valida) throw new Error('A nova escalação precisa ter exatamente os jogadores em campo');
    lado.escalacao = escalacao.map(({ jogadorId, vaga }) => ({ jogador: emCampo.get(jogadorId), vaga }));
  }
  if (postura) lado.postura = postura;
  return estado;
}

// O computador troca jogadores muito cansados por reservas que rendam pelo menos o mesmo no 2º tempo.
export function intervaloAutomatico(estado, chave) {
  const lado = estado[chave];
  if (!lado.escalacao || estado.tempo !== 1) return estado;
  const trocas = [];
  const banco = [...lado.banco];
  const cansados = lado.escalacao
    .filter((e) => (lado.cansaco[e.jogador.id] ?? 0) >= 60)
    .sort((a, b) => lado.cansaco[b.jogador.id] - lado.cansaco[a.jogador.id]);
  for (const { jogador, vaga } of cansados) {
    if (lado.trocas + trocas.length >= CONST.MAX_TROCAS) break;
    const rendimento = ovrEfetivo(jogador, vaga) * (1 - 0.05 * (lado.cansaco[jogador.id] / 100));
    let melhor = null;
    for (const r of banco) {
      const v = ovrEfetivo(r, vaga);
      if (v >= rendimento && (!melhor || v > ovrEfetivo(melhor, vaga))) melhor = r;
    }
    if (melhor) {
      trocas.push({ saiId: jogador.id, entraId: melhor.id });
      banco.splice(banco.indexOf(melhor), 1);
    }
  }
  return trocas.length ? aplicarIntervalo(estado, chave, { trocas }) : estado;
}

export function simularSegundoTempo(estadoAnterior, rng) {
  if (estadoAnterior.tempo !== 1) throw new Error('O 2º tempo vem depois do 1º');
  const estado = structuredClone(estadoAnterior);
  for (let i = 0; i < CONST.TICKS_TEMPO; i++) {
    lance(estado, rng, CONST.TICKS_TEMPO + i, (i + 1) / CONST.TICKS_TEMPO);
  }
  estado.tempo = 2;
  return estado;
}

export function simularProrrogacao(estadoAnterior, rng) {
  if (estadoAnterior.tempo !== 2) throw new Error('Prorrogação só depois dos 90 minutos');
  const estado = structuredClone(estadoAnterior);
  for (let i = 0; i < CONST.TICKS_PRORROGACAO; i++) lance(estado, rng, TICKS_JOGO + i, 1);
  estado.tempo = 3;
  return estado;
}

// Partida inteira sem pausa: o computador decide o intervalo dos dois lados.
export function simularPartida({ casa, fora, neutro = false, prorrogacao = false }, rng) {
  let e = simularPrimeiroTempo(iniciarPartida({ casa, fora, neutro }), rng);
  e = intervaloAutomatico(intervaloAutomatico(e, 'casa'), 'fora');
  e = simularSegundoTempo(e, rng);
  if (prorrogacao && e.placar.casa === e.placar.fora) e = simularProrrogacao(e, rng);
  return e;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/engine/partida.test.js`
Expected: PASS (23 testes, ~2–3 s por causa da calibração com 10.000 jogos). Se algum teste de calibração falhar, **não** afrouxe a faixa: ajuste `CONST.K` (mais alto = favorito vence mais) ou `BASE_CHANCE`/`BASE_GOL` (mais alto = mais gols) e rode de novo.

- [ ] **Step 5: Commit**

```bash
git add src/engine/partida.js tests/engine/partida.test.js
git commit -m "feat(engine): simulação da partida com intervalo, cansaço, lesões e VAR

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Disputa de pênaltis

**Files:**
- Create: `src/engine/penaltis.js`
- Test: `tests/engine/penaltis.test.js`

**Interfaces:**
- Consumes: `criarRng` (Task 1, só nos testes).
- Produces:
  - `probConversao(ataBatedor, golAdversario) → number` entre 0.55 e 0.92.
  - `disputarPenaltis(casa: { ata, gol }, fora: { ata, gol }, rng) → { casa: number, fora: number, vencedor: 'casa' | 'fora', cobrancas: [{ lado, convertido }] }`. O chamador passa os setores já calculados (`setoresDoLado`).

- [ ] **Step 1: Escrever o teste que falha**

`tests/engine/penaltis.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { disputarPenaltis, probConversao } from '../../src/engine/penaltis.js';

const s = (ata, gol) => ({ ata, gol });

describe('probConversao', () => {
  it('75% com forças iguais e limitada entre 55% e 92%', () => {
    expect(probConversao(80, 80)).toBeCloseTo(0.75);
    expect(probConversao(99, 20)).toBe(0.92);
    expect(probConversao(20, 99)).toBe(0.55);
  });
});

describe('disputarPenaltis', () => {
  it('sempre tem vencedor e o placar bate com as cobranças', () => {
    const rng = criarRng(1);
    for (let i = 0; i < 2000; i++) {
      const r = disputarPenaltis(s(80, 80), s(80, 80), rng);
      expect(r.casa).not.toBe(r.fora);
      expect(r.vencedor).toBe(r.casa > r.fora ? 'casa' : 'fora');
      expect(r.cobrancas.filter((c) => c.lado === 'casa' && c.convertido)).toHaveLength(r.casa);
      expect(r.cobrancas.filter((c) => c.lado === 'fora' && c.convertido)).toHaveLength(r.fora);
    }
  });

  it('para cedo quando um lado não alcança mais o outro', () => {
    const rng = criarRng(2);
    for (let i = 0; i < 2000; i++) {
      const r = disputarPenaltis(s(80, 80), s(80, 80), rng);
      const nCasa = r.cobrancas.filter((c) => c.lado === 'casa').length;
      const nFora = r.cobrancas.filter((c) => c.lado === 'fora').length;
      if (nCasa <= 5) expect(nFora).toBeLessThanOrEqual(5);
      // nunca há uma cobrança desnecessária: depois de decidido nos 5, ninguém bate de novo
      if (nCasa < 5 || nFora < 5) {
        const restamCasa = 5 - nCasa, restamFora = 5 - nFora;
        expect(r.casa + restamCasa < r.fora || r.fora + restamFora < r.casa).toBe(true);
      }
    }
  });

  it('é equilibrado entre times iguais e favorece o melhor batedor', () => {
    const rng = criarRng(3);
    let casaIgual = 0, casaForte = 0;
    for (let i = 0; i < 5000; i++) {
      if (disputarPenaltis(s(80, 80), s(80, 80), rng).vencedor === 'casa') casaIgual++;
      if (disputarPenaltis(s(95, 80), s(70, 80), rng).vencedor === 'casa') casaForte++;
    }
    expect(casaIgual / 5000).toBeGreaterThan(0.45);
    expect(casaIgual / 5000).toBeLessThan(0.55);
    expect(casaForte / 5000).toBeGreaterThan(0.6);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/penaltis.test.js`
Expected: FAIL — `Failed to resolve import "../../src/engine/penaltis.js"`.

- [ ] **Step 3: Implementar**

`src/engine/penaltis.js`:
```js
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function probConversao(ataBatedor, golAdversario) {
  return clamp(0.75 + (ataBatedor - golAdversario) * 0.005, 0.55, 0.92);
}

// casa / fora: setores { ata, gol }. Cinco cobranças alternadas, depois alternadas até desempatar.
export function disputarPenaltis(casa, fora, rng) {
  const pCasa = probConversao(casa.ata, fora.gol);
  const pFora = probConversao(fora.ata, casa.gol);
  const placar = { casa: 0, fora: 0 };
  const cobrancas = [];
  const bater = (lado, p) => {
    const convertido = rng.chance(p);
    if (convertido) placar[lado] += 1;
    cobrancas.push({ lado, convertido });
  };

  for (let i = 0; i < 5; i++) {
    bater('casa', pCasa);
    if (placar.casa > placar.fora + (5 - i) || placar.fora > placar.casa + (4 - i)) break;
    bater('fora', pFora);
    const restam = 4 - i;
    if (Math.abs(placar.casa - placar.fora) > restam) break;
  }
  while (placar.casa === placar.fora) {
    bater('casa', pCasa);
    bater('fora', pFora);
  }
  return { casa: placar.casa, fora: placar.fora, vencedor: placar.casa > placar.fora ? 'casa' : 'fora', cobrancas };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/engine/penaltis.test.js`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/penaltis.js tests/engine/penaltis.test.js
git commit -m "feat(engine): disputa de pênaltis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pontos corridos

**Files:**
- Create: `src/engine/liga.js`
- Test: `tests/engine/liga.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `criarTabela(ids: string[]) → [{ id, j, v, e, d, gp, gc, pts }]`.
  - `registrarResultado(tabela, { casa, fora, golsCasa, golsFora }) → tabela` (nova).
  - `ordenarTabela(tabela) → tabela` ordenada por pontos, vitórias, saldo, gols pró, id.
  - `gerarRodadas(ids, { idaEVolta? }) → [[{ casa, fora }]]` — turno único tem `n − 1` rodadas; ida e volta espelha o mando no returno; com número ímpar, um time folga por rodada.

- [ ] **Step 1: Escrever o teste que falha**

`tests/engine/liga.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarTabela, registrarResultado, ordenarTabela, gerarRodadas } from '../../src/engine/liga.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `t${i}`);

describe('gerarRodadas', () => {
  it.each([4, 12, 20])('%i times: turno único, todos se enfrentam uma vez', (n) => {
    const rodadas = gerarRodadas(ids(n));
    expect(rodadas).toHaveLength(n - 1);
    const pares = new Set();
    for (const jogos of rodadas) {
      expect(jogos).toHaveLength(n / 2);
      const naRodada = jogos.flatMap((j) => [j.casa, j.fora]);
      expect(new Set(naRodada).size).toBe(n); // ninguém joga duas vezes na rodada
      for (const { casa, fora } of jogos) pares.add([casa, fora].sort().join('-'));
    }
    expect(pares.size).toBe((n * (n - 1)) / 2);
  });

  it('20 times ida e volta: 38 rodadas e cada confronto com um mando para cada lado', () => {
    const rodadas = gerarRodadas(ids(20), { idaEVolta: true });
    expect(rodadas).toHaveLength(38);
    const mandos = new Map();
    for (const jogos of rodadas) for (const { casa, fora } of jogos) mandos.set(`${casa}>${fora}`, true);
    expect(mandos.size).toBe(20 * 19);
  });

  it('mando equilibrado no turno: ninguém tem mais que n/2 jogos em casa', () => {
    const n = 20;
    const emCasa = Object.fromEntries(ids(n).map((id) => [id, 0]));
    for (const jogos of gerarRodadas(ids(n))) for (const { casa } of jogos) emCasa[casa]++;
    for (const v of Object.values(emCasa)) {
      expect(v).toBeGreaterThanOrEqual(n / 2 - 1);
      expect(v).toBeLessThanOrEqual(n / 2);
    }
  });

  it('número ímpar: cada time folga uma vez', () => {
    const rodadas = gerarRodadas(ids(5));
    expect(rodadas).toHaveLength(5);
    for (const jogos of rodadas) expect(jogos).toHaveLength(2);
  });
});

describe('tabela', () => {
  it('registra vitória, empate e derrota', () => {
    let t = criarTabela(['a', 'b', 'c']);
    t = registrarResultado(t, { casa: 'a', fora: 'b', golsCasa: 2, golsFora: 0 });
    t = registrarResultado(t, { casa: 'b', fora: 'c', golsCasa: 1, golsFora: 1 });
    const por = Object.fromEntries(t.map((l) => [l.id, l]));
    expect(por.a).toMatchObject({ j: 1, v: 1, pts: 3, gp: 2, gc: 0 });
    expect(por.b).toMatchObject({ j: 2, v: 0, e: 1, d: 1, pts: 1, gp: 1, gc: 3 });
    expect(por.c).toMatchObject({ j: 1, e: 1, pts: 1 });
  });

  it('não altera a tabela original', () => {
    const t = criarTabela(['a', 'b']);
    registrarResultado(t, { casa: 'a', fora: 'b', golsCasa: 1, golsFora: 0 });
    expect(t[0].j).toBe(0);
  });

  it('desempata por pontos, vitórias, saldo e gols pró', () => {
    const l = (id, pts, v, gp, gc) => ({ id, j: 0, e: 0, d: 0, pts, v, gp, gc });
    const ordem = ordenarTabela([
      l('saldo-pior', 10, 3, 5, 5),
      l('mais-pontos', 11, 3, 0, 0),
      l('mais-vitorias', 10, 4, 0, 0),
      l('saldo-melhor-mais-gols', 10, 3, 8, 6),
      l('saldo-melhor', 10, 3, 4, 2),
    ]).map((x) => x.id);
    expect(ordem).toEqual(['mais-pontos', 'mais-vitorias', 'saldo-melhor-mais-gols', 'saldo-melhor', 'saldo-pior']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/liga.test.js`
Expected: FAIL — `Failed to resolve import "../../src/engine/liga.js"`.

- [ ] **Step 3: Implementar**

`src/engine/liga.js`:
```js
// Pontos corridos: rodadas, tabela e ordenação.

export function criarTabela(ids) {
  return ids.map((id) => ({ id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }));
}

function somar(linha, pro, contra) {
  const v = pro > contra ? 1 : 0, e = pro === contra ? 1 : 0, d = pro < contra ? 1 : 0;
  return {
    ...linha,
    j: linha.j + 1, v: linha.v + v, e: linha.e + e, d: linha.d + d,
    gp: linha.gp + pro, gc: linha.gc + contra, pts: linha.pts + 3 * v + e,
  };
}

// resultado: { casa, fora, golsCasa, golsFora }
export function registrarResultado(tabela, { casa, fora, golsCasa, golsFora }) {
  return tabela.map((l) => {
    if (l.id === casa) return somar(l, golsCasa, golsFora);
    if (l.id === fora) return somar(l, golsFora, golsCasa);
    return l;
  });
}

// Desempate: pontos, vitórias, saldo, gols pró, id (para ser estável).
export function ordenarTabela(tabela) {
  return [...tabela].sort((a, b) =>
    b.pts - a.pts || b.v - a.v || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp || (a.id < b.id ? -1 : 1));
}

// Método do círculo. Retorna [[{ casa, fora }]]; com número ímpar, quem "folga" fica de fora da rodada.
export function gerarRodadas(ids, { idaEVolta = false } = {}) {
  const lista = ids.length % 2 ? [...ids, null] : [...ids];
  const n = lista.length;
  const turno = [];
  for (let r = 0; r < n - 1; r++) {
    const jogos = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lista[i], b = lista[n - 1 - i];
      if (a === null || b === null) continue;
      // alterna o mando para ninguém jogar sempre em casa
      const inverter = i === 0 ? r % 2 === 1 : i % 2 === 1;
      jogos.push(inverter ? { casa: b, fora: a } : { casa: a, fora: b });
    }
    turno.push(jogos);
    lista.splice(1, 0, lista.pop()); // gira todos menos o primeiro
  }
  if (!idaEVolta) return turno;
  return [...turno, ...turno.map((jogos) => jogos.map(({ casa, fora }) => ({ casa: fora, fora: casa })))];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/engine/liga.test.js`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/liga.js tests/engine/liga.test.js
git commit -m "feat(engine): pontos corridos (rodadas, tabela e desempate)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Mata-mata e fase de grupos

**Files:**
- Create: `src/engine/mataMata.js`
- Create: `src/engine/grupos.js`
- Test: `tests/engine/mataMata.test.js`
- Test: `tests/engine/grupos.test.js`

**Interfaces:**
- Consumes: `criarRng` (Task 1), `criarTabela`, `registrarResultado`, `ordenarTabela` (Task 6).
- Produces:
  - `decidirIdaVolta(ida, volta) → { vencedor: id | null, agregado: { [id]: gols }, precisaPenaltis: boolean }` — `volta` precisa inverter o mando da `ida`, senão lança `Error`.
  - `decidirJogoUnico(jogo) → { vencedor: id | null, precisaPenaltis: boolean }` — o jogo já vem com a prorrogação, se houve.
  - `emparelhar(ids) → [[a, b], ...]`; `sortearChave(ids, rng) → [[a, b], ...]`.
  - `sortearGrupos(idsPorForca, rng, nGrupos = 8) → string[][]` — um time de cada pote por grupo.
  - `classificadosDoGrupo(tabela, n = 2) → string[]`.
  - `cruzarOitavas([[1º, 2º], ...]) → [[2ºB, 1ºA], [2ºA, 1ºB], ...]` — o 1º colocado é o segundo do par (decide em casa).

- [ ] **Step 1: Escrever os testes que falham**

`tests/engine/mataMata.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { decidirIdaVolta, decidirJogoUnico, emparelhar, sortearChave } from '../../src/engine/mataMata.js';

const jogo = (casa, fora, golsCasa, golsFora) => ({ casa, fora, golsCasa, golsFora });

describe('decidirIdaVolta', () => {
  it('soma o agregado e aponta o vencedor', () => {
    const r = decidirIdaVolta(jogo('A', 'B', 2, 1), jogo('B', 'A', 1, 0));
    expect(r.agregado).toEqual({ A: 2, B: 2 });
    expect(r.precisaPenaltis).toBe(true);
    expect(r.vencedor).toBeNull();
  });

  it('vencedor pelo agregado, sem gol fora de casa', () => {
    expect(decidirIdaVolta(jogo('A', 'B', 0, 1), jogo('B', 'A', 0, 2)).vencedor).toBe('A');
    // 1x1 fora e 0x0 em casa: empate no agregado, gol fora não vale
    expect(decidirIdaVolta(jogo('A', 'B', 0, 0), jogo('B', 'A', 1, 1)).precisaPenaltis).toBe(true);
  });

  it('rejeita volta sem inverter o mando', () => {
    expect(() => decidirIdaVolta(jogo('A', 'B', 1, 0), jogo('A', 'B', 1, 0))).toThrow();
  });
});

describe('decidirJogoUnico', () => {
  it('vencedor direto ou pênaltis', () => {
    expect(decidirJogoUnico(jogo('A', 'B', 0, 1))).toEqual({ vencedor: 'B', precisaPenaltis: false });
    expect(decidirJogoUnico(jogo('A', 'B', 2, 2))).toEqual({ vencedor: null, precisaPenaltis: true });
  });
});

describe('emparelhar e sortearChave', () => {
  it('emparelha em ordem', () => {
    expect(emparelhar(['a', 'b', 'c', 'd'])).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('rejeita número ímpar', () => {
    expect(() => emparelhar(['a', 'b', 'c'])).toThrow();
  });

  it('sorteio usa todos os times uma vez', () => {
    const ids = Array.from({ length: 32 }, (_, i) => `t${i}`);
    const pares = sortearChave(ids, criarRng(4));
    expect(pares).toHaveLength(16);
    expect(pares.flat().sort()).toEqual([...ids].sort());
  });
});
```

`tests/engine/grupos.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { criarRng } from '../../src/engine/rng.js';
import { criarTabela, registrarResultado } from '../../src/engine/liga.js';
import { sortearGrupos, classificadosDoGrupo, cruzarOitavas } from '../../src/engine/grupos.js';

const ids = Array.from({ length: 32 }, (_, i) => `t${String(i).padStart(2, '0')}`);

describe('sortearGrupos', () => {
  it('8 grupos de 4, com um time de cada pote', () => {
    const grupos = sortearGrupos(ids, criarRng(1));
    expect(grupos).toHaveLength(8);
    for (const g of grupos) {
      expect(g).toHaveLength(4);
      g.forEach((id, pote) => expect(ids.indexOf(id)).toBeGreaterThanOrEqual(pote * 8));
      g.forEach((id, pote) => expect(ids.indexOf(id)).toBeLessThan((pote + 1) * 8));
    }
    expect(grupos.flat().sort()).toEqual(ids);
  });

  it('rejeita quantidade que não divide nos grupos', () => {
    expect(() => sortearGrupos(ids.slice(0, 30), criarRng(1))).toThrow();
  });
});

describe('classificadosDoGrupo', () => {
  it('pega os 2 primeiros pela tabela', () => {
    let t = criarTabela(['a', 'b', 'c', 'd']);
    t = registrarResultado(t, { casa: 'c', fora: 'a', golsCasa: 3, golsFora: 0 });
    t = registrarResultado(t, { casa: 'd', fora: 'b', golsCasa: 1, golsFora: 0 });
    t = registrarResultado(t, { casa: 'c', fora: 'd', golsCasa: 1, golsFora: 1 });
    expect(classificadosDoGrupo(t)).toEqual(['c', 'd']);
  });
});

describe('cruzarOitavas', () => {
  it('1º de um grupo pega o 2º do grupo vizinho e decide em casa', () => {
    const classificados = [['1A', '2A'], ['1B', '2B'], ['1C', '2C'], ['1D', '2D']];
    expect(cruzarOitavas(classificados)).toEqual([['2B', '1A'], ['2A', '1B'], ['2D', '1C'], ['2C', '1D']]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/mataMata.test.js tests/engine/grupos.test.js`
Expected: FAIL — `Failed to resolve import "../../src/engine/mataMata.js"` e `"../../src/engine/grupos.js"`.

- [ ] **Step 3: Implementar o mata-mata**

`src/engine/mataMata.js`:
```js
// Mata-mata: quem passa em ida e volta (agregado) ou jogo único.
// Os pênaltis são decididos por quem chama (penaltis.js), aqui só se diz se são necessários.

// ida: { casa: A, fora: B, golsCasa, golsFora }; volta: { casa: B, fora: A, golsCasa, golsFora }
export function decidirIdaVolta(ida, volta) {
  if (ida.casa !== volta.fora || ida.fora !== volta.casa) throw new Error('A volta precisa inverter o mando da ida');
  const a = ida.casa, b = ida.fora;
  const agregado = { [a]: ida.golsCasa + volta.golsFora, [b]: ida.golsFora + volta.golsCasa };
  if (agregado[a] === agregado[b]) return { vencedor: null, agregado, precisaPenaltis: true };
  return { vencedor: agregado[a] > agregado[b] ? a : b, agregado, precisaPenaltis: false };
}

// jogo: { casa, fora, golsCasa, golsFora } (já com a prorrogação, se houve)
export function decidirJogoUnico(jogo) {
  if (jogo.golsCasa === jogo.golsFora) return { vencedor: null, precisaPenaltis: true };
  return { vencedor: jogo.golsCasa > jogo.golsFora ? jogo.casa : jogo.fora, precisaPenaltis: false };
}

// [a, b, c, d] -> [[a, b], [c, d]]
export function emparelhar(ids) {
  if (ids.length % 2) throw new Error('Mata-mata precisa de número par de times');
  const pares = [];
  for (let i = 0; i < ids.length; i += 2) pares.push([ids[i], ids[i + 1]]);
  return pares;
}

export function sortearChave(ids, rng) {
  return emparelhar(rng.embaralhar(ids));
}
```

- [ ] **Step 4: Implementar os grupos**

`src/engine/grupos.js`:
```js
import { ordenarTabela } from './liga.js';

// idsPorForca: do mais forte ao mais fraco. Cada pote tem nGrupos times e cada grupo recebe um de cada pote.
export function sortearGrupos(idsPorForca, rng, nGrupos = 8) {
  if (idsPorForca.length % nGrupos) throw new Error('O número de times precisa ser múltiplo do número de grupos');
  const grupos = Array.from({ length: nGrupos }, () => []);
  for (let i = 0; i < idsPorForca.length; i += nGrupos) {
    const pote = rng.embaralhar(idsPorForca.slice(i, i + nGrupos));
    pote.forEach((id, g) => grupos[g].push(id));
  }
  return grupos;
}

export function classificadosDoGrupo(tabela, n = 2) {
  return ordenarTabela(tabela).slice(0, n).map((l) => l.id);
}

// classificados: [[1º, 2º] do grupo A, [1º, 2º] do grupo B, ...]
// Cruzamento: 1A x 2B, 1B x 2A, 1C x 2D, 1D x 2C, ... (o 1º decide em casa: fica como segundo do par)
export function cruzarOitavas(classificados) {
  if (classificados.length % 2) throw new Error('Número de grupos precisa ser par');
  const pares = [];
  for (let g = 0; g < classificados.length; g += 2) {
    const [p1, s1] = classificados[g];
    const [p2, s2] = classificados[g + 1];
    pares.push([s2, p1], [s1, p2]);
  }
  return pares;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/engine/mataMata.test.js tests/engine/grupos.test.js`
Expected: PASS (7 + 4 testes).

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: 8 arquivos, 87 testes, todos passando.

- [ ] **Step 7: Commit**

```bash
git add src/engine/mataMata.js src/engine/grupos.js tests/engine/mataMata.test.js tests/engine/grupos.test.js
git commit -m "feat(engine): mata-mata (ida e volta, jogo único) e fase de grupos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
