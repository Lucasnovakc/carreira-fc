# Carreira FC — Plano 3: Dados reais

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a base real do jogo — 20 clubes da Série A 2026, 8 estaduais de 12 clubes, 56 clubes sul-americanos e os 40 elencos históricos aprovados — num formato validado por testes, e provar que uma carreira de 10 temporadas roda com ela.

**Architecture:** JSONs em `src/data/`, carregados por `src/data/index.js`, que exporta `dados = { clubes, estaduais, estrangeiros, elencos }` no formato que `carreira.js` (Plano 2) já consome. Os elencos ficam em 5 arquivos por época para serem fáceis de revisar e de ampliar (meta futura: 100). Um teste de validação confere a integridade de tudo.

**Tech Stack:** JSON, JavaScript (ES modules), Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-05-carreira-fc-design.md` (seção 7) e a lista de 40 elencos aprovada pelo usuário em 2026-10-05.

**Natureza deste plano:** é autoria de conteúdo. Os arquivos de dados são escritos a partir de conhecimento de futebol seguindo as regras abaixo; o teste de validação (Task 1) é o portão de cada tarefa. Nomes, posições, idades e overalls de elencos antigos são **estimativas** — no fim, entregar ao usuário a lista dos elencos menos confiáveis para conferência (ogol.com.br / Wikipedia).

## Global Constraints

- Branch `plano-3-dados` a partir do `main`, em `C:\Users\User\Desktop\carreira-fc`.
- Ids em minúsculas, sem acento, com hífen (`sao-paulo`, `atletico-mg`, `santos-1962`).
- Notas de clubes (`gol, def, mei, ata`): inteiros de 50 a 90.
- Cores: `["#rrggbb", "#rrggbb"]` (principal, secundária).
- Série A 2026 (fonte: CBF/Band, 2025-12): Athletico-PR, Atlético-MG, Bahia, Botafogo, Bragantino, Chapecoense, Corinthians, Coritiba, Cruzeiro, Flamengo, Fluminense, Grêmio, Internacional, Mirassol, Palmeiras, Remo, Santos, São Paulo, Vasco, Vitória.
- Estaduais: SP, RJ, MG, RS, BA, PR, SC, PA — 12 clubes cada, incluindo todos os da Série A daquele estado.
- Estrangeiros: exatamente 56.
- Jogador de elenco: `{ nome, pos, ovr, idade }`; `pos` ∈ `GOL ZAG LD LE VOL MC MEI PD PE CA`; `ovr` 40–99; `idade` = idade no ano do elenco (16–42).
- Escala de overall: lendas 90–97 (no máximo ~1 por elenco, só os craques históricos); titulares de grandes times 78–89; reservas e elencos "zebra" 60–76. Todo elenco tem pelo menos 1 jogador ≤ 85; a base inteira tem pelo menos 60 jogadores ≤ 68 (roleta ruim).
- Cada elenco: 18–23 jogadores, com ≥ 2 GOL, ≥ 3 ZAG, ≥ 1 LD, ≥ 1 LE, ≥ 3 em VOL/MC/MEI, ≥ 3 em PD/PE/CA; nomes únicos dentro do elenco (apelido de camisa, ex.: "Pelé", "Zé Roberto").
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Clube da Série A ausente do próprio estadual** — a carreira quebraria ao começar com esse clube. Testado na Task 1 ("todo clube da Série A está no estadual do seu estado").
2. **Clássico apontando para clube inexistente ou não recíproco** — "jogo importante" ficaria incoerente. Testado na Task 1.
3. **Elenco sem goleiro reserva ou sem lateral** — o draft ofereceria elencos inúteis para certas vagas e o computador improvisaria demais. Testado na Task 1 (composição mínima por elenco).
4. **Roleta ruim sem opções suficientes** — 3 roletas obrigatórias por temporada precisam de jogadores ≤ 68 espalhados. Testado na Task 1.
5. **Equilíbrio com dados reais** — o time de lendas não pode ser imbatível nem inútil; a Task 4 mede e reporta (sem travar o teste em faixa estreita, pois o ajuste fino é decisão do usuário depois de jogar).

---

### Task 1: Carregador e validação dos dados

**Files:**
- Create: `src/data/index.js`
- Test: `tests/data/dados.test.js`

**Interfaces:**
- Consumes: `POSICOES` (posicoes.js).
- Produces: `dados = { clubes, estaduais, estrangeiros, elencos }` (formato da Interface da Task 6 do Plano 2); arquivos esperados: `src/data/clubes.json`, `src/data/estaduais.json`, `src/data/estrangeiros.json`, `src/data/elencos/1960-1979.json`, `1980-1989.json`, `1990-1999.json`, `2000-2009.json`, `2010-2024.json`.

- [ ] **Step 1: Criar o branch**

Run: `git checkout -b plano-3-dados`

- [ ] **Step 2: Escrever o teste de validação**

`tests/data/dados.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { dados } from '../../src/data/index.js';
import { POSICOES } from '../../src/engine/posicoes.js';

const { clubes, estaduais, estrangeiros, elencos } = dados;

const SERIE_A_2026 = [
  'athletico-pr', 'atletico-mg', 'bahia', 'botafogo', 'bragantino', 'chapecoense', 'corinthians', 'coritiba',
  'cruzeiro', 'flamengo', 'fluminense', 'gremio', 'internacional', 'mirassol', 'palmeiras', 'remo', 'santos',
  'sao-paulo', 'vasco', 'vitoria',
];
const ESTADOS = ['SP', 'RJ', 'MG', 'RS', 'BA', 'PR', 'SC', 'PA'];
const ELENCOS = [
  'santos-1962', 'botafogo-1962', 'atletico-mg-1971', 'palmeiras-1972', 'internacional-1976', 'cruzeiro-1976', 'fluminense-1976', 'guarani-1978',
  'atletico-mg-1980', 'flamengo-1981', 'corinthians-1982', 'gremio-1983', 'coritiba-1985', 'sao-paulo-1986', 'bahia-1988', 'vasco-1989',
  'criciuma-1991', 'sao-paulo-1992', 'palmeiras-1993', 'botafogo-1995', 'gremio-1995', 'vasco-1997', 'juventude-1999', 'corinthians-1999',
  'sao-caetano-2000', 'athletico-pr-2001', 'santos-2002', 'cruzeiro-2003', 'santo-andre-2004', 'sao-paulo-2005', 'internacional-2006', 'sport-2008',
  'santos-2011', 'corinthians-2012', 'fluminense-2012', 'atletico-mg-2013', 'cruzeiro-2014', 'flamengo-2019', 'palmeiras-2021', 'botafogo-2024',
];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COR = /^#[0-9a-f]{6}$/i;
const notaValida = (n) => Number.isInteger(n) && n >= 50 && n <= 90;
const semRepetir = (lista) => new Set(lista).size === lista.length;

describe('clubes', () => {
  it('ids únicos e válidos, cores e notas', () => {
    expect(semRepetir(clubes.map((c) => c.id))).toBe(true);
    for (const c of clubes) {
      expect(c.id).toMatch(ID);
      expect(c.nome.length).toBeGreaterThan(0);
      expect(c.sigla).toMatch(/^[A-Z0-9]{2,4}$/);
      expect(c.cores).toHaveLength(2);
      c.cores.forEach((cor) => expect(cor).toMatch(COR));
      for (const s of ['gol', 'def', 'mei', 'ata']) expect(notaValida(c[s]), `${c.id}.${s}`).toBe(true);
      expect(ESTADOS).toContain(c.estado);
      expect(Array.isArray(c.classicos)).toBe(true);
    }
  });

  it('Série A 2026 exata', () => {
    expect(clubes.filter((c) => c.serieA).map((c) => c.id).sort()).toEqual([...SERIE_A_2026].sort());
  });

  it('clássicos apontam para clubes da Série A e são recíprocos', () => {
    const porId = Object.fromEntries(clubes.map((c) => [c.id, c]));
    for (const c of clubes) {
      for (const r of c.classicos) {
        expect(porId[r]?.serieA, `${c.id} -> ${r}`).toBe(true);
        expect(porId[r].classicos, `${r} não lista ${c.id}`).toContain(c.id);
      }
    }
  });

  it('todo clube da Série A tem pelo menos um clássico', () => {
    for (const c of clubes.filter((x) => x.serieA)) expect(c.classicos.length, c.id).toBeGreaterThan(0);
  });
});

describe('estaduais', () => {
  it('8 estaduais de 12 clubes existentes e do próprio estado', () => {
    expect(Object.keys(estaduais).sort()).toEqual([...ESTADOS].sort());
    const porId = Object.fromEntries(clubes.map((c) => [c.id, c]));
    for (const [uf, e] of Object.entries(estaduais)) {
      expect(e.nome.length).toBeGreaterThan(0);
      expect(e.clubes).toHaveLength(12);
      expect(semRepetir(e.clubes)).toBe(true);
      for (const id of e.clubes) expect(porId[id]?.estado, `${uf}: ${id}`).toBe(uf);
    }
  });

  it('todo clube da Série A está no estadual do seu estado', () => {
    for (const c of clubes.filter((x) => x.serieA)) expect(estaduais[c.estado].clubes).toContain(c.id);
  });

  it('todo clube cadastrado joga algum estadual', () => {
    const todos = new Set(Object.values(estaduais).flatMap((e) => e.clubes));
    for (const c of clubes) expect(todos.has(c.id), c.id).toBe(true);
  });

  it('pelo menos 24 clubes fora da Série A (para completar a Copa do Brasil)', () => {
    expect(clubes.filter((c) => !c.serieA).length).toBeGreaterThanOrEqual(24);
  });
});

describe('estrangeiros', () => {
  it('56 clubes com ids únicos que não colidem com os brasileiros', () => {
    expect(estrangeiros).toHaveLength(56);
    const ids = estrangeiros.map((c) => c.id);
    expect(semRepetir(ids)).toBe(true);
    const br = new Set(clubes.map((c) => c.id));
    for (const c of estrangeiros) {
      expect(c.id).toMatch(ID);
      expect(br.has(c.id), c.id).toBe(false);
      expect(c.pais).toMatch(/^[A-Z]{3}$/);
      expect(c.cores).toHaveLength(2);
      for (const s of ['gol', 'def', 'mei', 'ata']) expect(notaValida(c[s]), `${c.id}.${s}`).toBe(true);
    }
  });
});

describe('elencos', () => {
  it('são exatamente os 40 aprovados', () => {
    expect(elencos.map((e) => e.id).sort()).toEqual([...ELENCOS].sort());
  });

  it.each(ELENCOS)('%s: formato e composição mínima', (id) => {
    const e = elencos.find((x) => x.id === id);
    expect(e, id).toBeDefined();
    expect(e.clube.length).toBeGreaterThan(0);
    expect(Number.isInteger(e.ano)).toBe(true);
    expect(id.endsWith(String(e.ano))).toBe(true);
    expect(e.cores).toHaveLength(2);
    expect(e.jogadores.length).toBeGreaterThanOrEqual(18);
    expect(e.jogadores.length).toBeLessThanOrEqual(23);
    expect(semRepetir(e.jogadores.map((j) => j.nome))).toBe(true);
    const conta = (...ps) => e.jogadores.filter((j) => ps.includes(j.pos)).length;
    expect(conta('GOL'), 'GOL').toBeGreaterThanOrEqual(2);
    expect(conta('ZAG'), 'ZAG').toBeGreaterThanOrEqual(3);
    expect(conta('LD'), 'LD').toBeGreaterThanOrEqual(1);
    expect(conta('LE'), 'LE').toBeGreaterThanOrEqual(1);
    expect(conta('VOL', 'MC', 'MEI'), 'meio').toBeGreaterThanOrEqual(3);
    expect(conta('PD', 'PE', 'CA'), 'ataque').toBeGreaterThanOrEqual(3);
    for (const j of e.jogadores) {
      expect(POSICOES, `${id}: ${j.nome}`).toContain(j.pos);
      expect(Number.isInteger(j.ovr) && j.ovr >= 40 && j.ovr <= 99, `${id}: ${j.nome} ovr`).toBe(true);
      expect(Number.isInteger(j.idade) && j.idade >= 16 && j.idade <= 42, `${id}: ${j.nome} idade`).toBe(true);
    }
    expect(e.jogadores.some((j) => j.ovr <= 85), 'roleta média').toBe(true);
  });

  it('a base tem pelo menos 60 jogadores com overall até 68 (roleta ruim)', () => {
    expect(elencos.flatMap((e) => e.jogadores).filter((j) => j.ovr <= 68).length).toBeGreaterThanOrEqual(60);
  });

  it('lendas são raras: no máximo 25 jogadores com 90+ na base inteira', () => {
    expect(elencos.flatMap((e) => e.jogadores).filter((j) => j.ovr >= 90).length).toBeLessThanOrEqual(25);
  });
});
```

- [ ] **Step 3: Escrever o carregador**

`src/data/index.js`:
```js
import clubes from './clubes.json';
import estaduais from './estaduais.json';
import estrangeiros from './estrangeiros.json';
import e1960 from './elencos/1960-1979.json';
import e1980 from './elencos/1980-1989.json';
import e1990 from './elencos/1990-1999.json';
import e2000 from './elencos/2000-2009.json';
import e2010 from './elencos/2010-2024.json';

// Base completa no formato que carreira.js consome.
export const dados = {
  clubes,
  estaduais,
  estrangeiros,
  elencos: [...e1960, ...e1980, ...e1990, ...e2000, ...e2010],
};
```

- [ ] **Step 4: Criar os 5 arquivos de elencos vazios (`[]`) e rodar**

Criar `src/data/elencos/1960-1979.json`, `1980-1989.json`, `1990-1999.json`, `2000-2009.json`, `2010-2024.json` com `[]`.
Run: `npx vitest run tests/data/dados.test.js`
Expected: FAIL — `Failed to resolve import "./clubes.json"`.

- [ ] **Step 5: Commit**

```bash
git add src/data/index.js src/data/elencos tests/data/dados.test.js
git commit -m "test(dados): validação da base real e carregador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Clubes brasileiros e estaduais

**Files:**
- Create: `src/data/clubes.json`
- Create: `src/data/estaduais.json`

**Interfaces:**
- Produces: `clubes: [{ id, nome, sigla, estado, cores, gol, def, mei, ata, serieA, classicos }]` (96 clubes = 8 × 12); `estaduais: { [UF]: { nome, clubes: id[12] } }`.

**Conteúdo exigido:**

| UF | Estadual | Série A | Demais clubes (completam 12) |
|---|---|---|---|
| SP | Paulistão | Corinthians, Palmeiras, Santos, São Paulo, Bragantino, Mirassol | Novorizontino, Ponte Preta, Guarani, Botafogo-SP, Portuguesa, São Bernardo |
| RJ | Carioca | Flamengo, Fluminense, Botafogo, Vasco | Volta Redonda, Madureira, Bangu, Portuguesa-RJ, Nova Iguaçu, Boavista, Sampaio Corrêa-RJ, Maricá |
| MG | Mineiro | Atlético-MG, Cruzeiro | América-MG, Athletic Club, Tombense, Villa Nova, Pouso Alegre, Uberlândia, Democrata-GV, Ipatinga, Caldense, URT |
| RS | Gauchão | Grêmio, Internacional | Juventude, Caxias, Ypiranga, São José-RS, Brasil de Pelotas, Novo Hamburgo, Avenida, Guarany de Bagé, São Luiz, Pelotas |
| BA | Baianão | Bahia, Vitória | Jacuipense, Atlético de Alagoinhas, Juazeirense, Barcelona de Ilhéus, Bahia de Feira, Jequié, Porto-BA, Colo Colo-BA, Fluminense de Feira, Vitória da Conquista |
| PR | Paranaense | Athletico-PR, Coritiba | Operário-PR, Londrina, Maringá, FC Cascavel, Paraná Clube, Cianorte, Azuriz, Andraus, Rio Branco-PR, Foz do Iguaçu |
| SC | Catarinense | Chapecoense | Avaí, Figueirense, Criciúma, Joinville, Brusque, Marcílio Dias, Concórdia, Barra-SC, Hercílio Luz, Inter de Lages, Camboriú |
| PA | Parazão | Remo | Paysandu, Águia de Marabá, Tuna Luso, Cametá, Castanhal, Bragantino-PA, Capitão Poço, São Raimundo-PA, Canaã, Santa Rosa, Paragominas |

**Notas da Série A (média alvo; distribuir ±3 entre gol/def/mei/ata conforme o perfil do time):** Flamengo 80, Palmeiras 80, Botafogo 77, Cruzeiro 77, Fluminense 76, Atlético-MG 75, Bahia 75, Mirassol 74, Vasco 74, Internacional 74, São Paulo 74, Corinthians 74, Grêmio 73, Bragantino 73, Santos 72, Vitória 70, Athletico-PR 71, Coritiba 70, Chapecoense 67, Remo 67.
**Demais clubes:** tradicionais de Série B/C (Juventude, América-MG, Avaí, Criciúma, Paysandu, Ponte Preta, Guarani, Novorizontino, Operário-PR, Athletic Club, Figueirense, Londrina, Caxias, Volta Redonda) 60–68; os outros 52–60.

**Clássicos (recíprocos):** Corinthians–Palmeiras, Corinthians–São Paulo, Corinthians–Santos, Palmeiras–São Paulo, Palmeiras–Santos, São Paulo–Santos, Bragantino–Mirassol (regional), Flamengo–Fluminense, Flamengo–Vasco, Flamengo–Botafogo, Fluminense–Vasco, Fluminense–Botafogo, Vasco–Botafogo, Atlético-MG–Cruzeiro, Grêmio–Internacional, Bahia–Vitória, Athletico-PR–Coritiba, e, por serem os únicos do estado na Série A, os rivais regionais **Chapecoense–Grêmio** e **Remo–Vitória**. Clubes fora da Série A: `classicos: []`.

- [ ] **Step 1: Escrever `src/data/clubes.json` e `src/data/estaduais.json` com o conteúdo acima**
- [ ] **Step 2: Rodar**

Run: `npx vitest run tests/data/dados.test.js -t "clubes|estaduais"`
Expected: PASS em `clubes` e `estaduais` (os demais grupos ainda falham por falta de arquivos/elencos).

- [ ] **Step 3: Commit**

```bash
git add src/data/clubes.json src/data/estaduais.json
git commit -m "feat(dados): Série A 2026 e 8 estaduais

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Clubes sul-americanos

**Files:**
- Create: `src/data/estrangeiros.json`

**Conteúdo exigido (56):**
- **ARG (14):** Boca Juniors, River Plate, Racing, Independiente, San Lorenzo, Estudiantes, Vélez Sarsfield, Talleres, Lanús, Argentinos Juniors, Rosario Central, Newell's Old Boys, Defensa y Justicia, Huracán.
- **URU (5):** Peñarol, Nacional, Liverpool-URU, Defensor Sporting, Danubio.
- **CHI (5):** Colo-Colo, Universidad de Chile, Universidad Católica, Palestino, Cobresal.
- **COL (7):** Atlético Nacional, Millonarios, Junior, América de Cali, Santa Fe, Deportes Tolima, Once Caldas.
- **PAR (6):** Olimpia, Cerro Porteño, Libertad, Guaraní, Nacional-PAR, Sportivo Luqueño.
- **ECU (6):** LDU Quito, Barcelona SC, Independiente del Valle, Emelec, Aucas, Universidad Católica-EQU.
- **PER (5):** Universitario, Alianza Lima, Sporting Cristal, Melgar, Cienciano.
- **BOL (4):** Bolívar, The Strongest, Always Ready, Blooming.
- **VEN (4):** Caracas, Deportivo Táchira, Monagas, Carabobo.

**Notas (média alvo):** River/Boca 78; Racing, Estudiantes, Vélez, Talleres, LDU, Independiente del Valle, Peñarol, Nacional, Atlético Nacional 72–75; demais argentinos, uruguaios, colombianos e paraguaios grandes 66–71; chilenos, peruanos, equatorianos menores 62–67; bolivianos e venezuelanos 58–63. Ids com o país quando houver ambiguidade (`nacional-uru`, `nacional-par`, `universidad-catolica-chi`, `universidad-catolica-equ`, `liverpool-uru`).

- [ ] **Step 1: Escrever `src/data/estrangeiros.json`**
- [ ] **Step 2: Rodar**

Run: `npx vitest run tests/data/dados.test.js -t "estrangeiros"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/data/estrangeiros.json
git commit -m "feat(dados): 56 clubes sul-americanos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Os 40 elencos históricos

**Files:**
- Modify: `src/data/elencos/1960-1979.json`, `1980-1989.json`, `1990-1999.json`, `2000-2009.json`, `2010-2024.json`

**Formato:** `{ "id": "santos-1962", "clube": "Santos", "sigla": "SAN", "ano": 1962, "cores": ["#ffffff", "#000000"], "jogadores": [{ "nome": "Pelé", "pos": "CA", "ovr": 97, "idade": 21 }, ...] }`.

**Regras de autoria:**
- Titulares conhecidos do ano + reservas que efetivamente fizeram parte do elenco, até 18–23 nomes. Se um reserva não for lembrado com segurança, preferir um nome real do clube em anos vizinhos a inventar.
- `idade` = ano do elenco − ano de nascimento.
- Overall pela escala dos Global Constraints; jogadores consagrados em seleção ~85–89; craques históricos 90+.
- Posição real do jogador naquele time (ex.: Júnior 1981 = LE; Falcão 1976 = VOL/MC; Ronaldinho 2013 = MEI).

**Lotes (um commit por lote):**
- **1960-1979:** santos-1962, botafogo-1962, atletico-mg-1971, palmeiras-1972, internacional-1976, cruzeiro-1976, fluminense-1976, guarani-1978.
- **1980-1989:** atletico-mg-1980, flamengo-1981, corinthians-1982, gremio-1983, coritiba-1985, sao-paulo-1986, bahia-1988, vasco-1989.
- **1990-1999:** criciuma-1991, sao-paulo-1992, palmeiras-1993, botafogo-1995, gremio-1995, vasco-1997, juventude-1999, corinthians-1999.
- **2000-2009:** sao-caetano-2000, athletico-pr-2001, santos-2002, cruzeiro-2003, santo-andre-2004, sao-paulo-2005, internacional-2006, sport-2008.
- **2010-2024:** santos-2011, corinthians-2012, fluminense-2012, atletico-mg-2013, cruzeiro-2014, flamengo-2019, palmeiras-2021, botafogo-2024.

- [ ] **Step 1: Lote 1960-1979** — escrever o arquivo; rodar `npx vitest run tests/data/dados.test.js -t "elencos"`; os 8 ids do lote passam no teste de formato; commit `feat(dados): elencos 1960-1979`.
- [ ] **Step 2: Lote 1980-1989** — idem; commit `feat(dados): elencos 1980-1989`.
- [ ] **Step 3: Lote 1990-1999** — idem; commit `feat(dados): elencos 1990-1999`.
- [ ] **Step 4: Lote 2000-2009** — idem; commit `feat(dados): elencos 2000-2009`.
- [ ] **Step 5: Lote 2010-2024** — idem; agora o teste inteiro passa.

Run: `npx vitest run tests/data/dados.test.js`
Expected: PASS em todos (≈ 52 testes).

Commit (cada lote): `git add src/data/elencos/<arquivo>.json && git commit -m "feat(dados): elencos <época>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 5: Carreira completa com a base real

**Files:**
- Test: `tests/data/carreira-real.test.js`

**Interfaces:**
- Consumes: `dados` (Task 1), `novaCarreira`, `girarDraft`, `usarCuringa`, `escolherNoDraft`, `jogarData`, `girarTransferencia`, `aceitarTransferencia`, `recusarTransferencia`, `concluirTransferencias` (Plano 2), `vagasDaFormacao` (elenco.js), `ovrEfetivo` (posicoes.js).

- [ ] **Step 1: Escrever o teste**

`tests/data/carreira-real.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { dados } from '../../src/data/index.js';
import { ovrEfetivo } from '../../src/engine/posicoes.js';
import { vagasDaFormacao } from '../../src/engine/elenco.js';
import {
  novaCarreira, girarDraft, escolherNoDraft, jogarData,
  girarTransferencia, aceitarTransferencia, recusarTransferencia, concluirTransferencias,
} from '../../src/engine/carreira.js';

// Draft "esperto": em cada giro, o jogador que mais rende numa vaga livre (titular) ou o melhor (banco).
function draftEsperto(c) {
  const vagas = vagasDaFormacao(c.elenco.formacao);
  while (c.fase === 'draft') {
    c = girarDraft(c, dados);
    const livres = vagas.map((v, i) => i).filter((i) => !c.elenco.titulares[i]);
    let melhor = null;
    for (const j of c.draft.atual.opcoes) {
      for (const i of livres) {
        const v = ovrEfetivo(j, vagas[i]);
        if (!melhor || v > melhor.v) melhor = { id: j.id, destino: i, v };
      }
      if (!livres.length && (!melhor || j.ovr > melhor.v)) melhor = { id: j.id, destino: 'banco', v: j.ovr };
    }
    c = escolherNoDraft(c, dados, melhor.id, melhor.destino);
  }
  return c;
}

function janela(c) {
  while (c.transferencias.fila.length) {
    c = girarTransferencia(c, dados);
    if (!c.transferencias.atual) continue;
    const { obrigatoria } = c.transferencias.fila[0];
    const cheio = Object.keys(c.elenco.jogadores).length >= 15;
    const pior = Object.values(c.elenco.jogadores).sort((a, b) => a.ovr - b.ovr)[0];
    const melhor = [...c.transferencias.atual.opcoes].sort((a, b) => b.ovr - a.ovr)[0];
    if (!obrigatoria && (!cheio || melhor.ovr <= pior.ovr)) {
      c = cheio ? recusarTransferencia(c) : aceitarTransferencia(c, melhor.id);
      continue;
    }
    c = aceitarTransferencia(c, melhor.id, cheio ? pior.id : null);
  }
  return concluirTransferencias(c, dados);
}

describe('carreira com a base real', () => {
  it.each(['flamengo', 'remo', 'gremio'])('10 temporadas com %s rodam até o fim', (clubeId) => {
    let c = draftEsperto(novaCarreira({ dados, clubeId, duracao: 10, semente: 2026 }));
    while (c.fase !== 'fim') {
      while (c.fase === 'temporada') c = jogarData(c, dados);
      if (c.fase === 'transferencias') c = janela(c);
    }
    expect(c.historico).toHaveLength(10);
    const titulos = c.historico.flatMap((h) => h.titulos);
    const posicoes = c.historico.map((h) => h.posicaoBrasileirao);
    console.log(clubeId, 'posições:', posicoes.join(' '), '| títulos:', titulos.length, titulos.join(', '));
  }, 120000);
});
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run tests/data/carreira-real.test.js`
Expected: PASS (3 testes). Ler as linhas `console.log` e reportar ao usuário: posição média no Brasileirão e títulos em 10 temporadas. Referência de equilíbrio para conversa (não é trava): um draft esperto deve brigar no topo, mas não ganhar tudo todo ano.

- [ ] **Step 3: Suíte inteira e commit**

Run: `npm test` — todos passando.
```bash
git add tests/data/carreira-real.test.js
git commit -m "test(dados): carreira de 10 temporadas com a base real

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
