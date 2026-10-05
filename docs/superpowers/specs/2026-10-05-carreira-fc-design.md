# Carreira FC — Design (v1)

> Nome provisório. Projeto pessoal, sem ligação com o Barão. Público: o autor e amigos.

## 1. Objetivo

Jogo web inspirado na mecânica do Boleirou (roleta de elencos históricos + penalidade fora de posição + suspense da simulação), mas com um **modo carreira**: o jogador monta um elenco pela roleta e disputa **5 ou 10 temporadas** do calendário do futebol brasileiro com o mesmo clube, tentando acumular o máximo de títulos.

**Sucesso da v1:** é possível jogar uma carreira completa de 10 temporadas no celular, com save que sobrevive a fechar o navegador, e os resultados parecem críveis (favorito costuma ganhar, zebras acontecem).

## 2. Fora do escopo da v1 (versões futuras)

- Mundial de Clubes (exige base de clubes de outros continentes)
- Rebaixamento / Série B
- Elencos com nome para os clubes adversários (v1: só notas)
- Save em nuvem, login, ranking entre amigos (Supabase)
- Acúmulo de cartões amarelos, rodízio/cansaço entre jogos
- Expansão de 40 para 100+ elencos na roleta

## 3. Fluxo de telas

1. **Nova carreira** — escolhe clube (os 20 da Série A atual), duração (5 ou 10 temporadas), dificuldade (**Clássico**: overall visível; **Olheiro**: overall oculto), formação inicial e postura.
2. **Draft** — 15 giros de roleta (11 titulares + 4 reservas). Cada giro para num elenco histórico (ex.: "Santos 1962"); o jogador escolhe **um** atleta desse elenco e a vaga (posição da formação ou banco). Mostra o overall efetivo na vaga já com penalidade. **3 curingas** por draft para descartar um giro. Um elenco sorteado não se repete no mesmo draft.
3. **Painel da temporada** — próximo jogo em destaque com botões **Assistir**, **Simular** e **Simular até o próximo jogo importante**. Abas: Calendário, Tabelas (estadual, Brasileirão, chaves da Copa do Brasil e continental), Elenco (overall, idade, lesionados, suspensos).
4. **Pré-jogo** — aviso de lesionados/suspensos; ajusta escalação ou confirma a sugerida.
5. **Partida ao vivo** — relógio acelerado (~15 s por tempo), feed de eventos (chances, gols, cartões, VAR, lesões). Lesão em jogo → troca automática pelo reserva mais adequado; sem reserva disponível, joga com 10. **Intervalo** é a única pausa: mostra cansaço, permite trocar jogadores (até 4), mudar formação e postura. Prorrogação e pênaltis quando a regra exigir.
6. **Fim de temporada** — resumo (títulos, posições), competições da próxima temporada, envelhecimento (quem subiu/caiu/aposentou), roletas de transferência.
7. **Fim da carreira** — sala de troféus, artilheiros por temporada, melhor jogador da história do clube.

"Simular" faz o computador escalar e substituir por você com escolhas sensatas.

## 4. Motor da partida

### 4.1 Jogador e posições
Jogador: `nome`, `pos` natural, `ovr`, `idade`.
Posições: `GOL, ZAG, LD, LE, VOL, MC, MEI, PD, PE, CA`.

### 4.2 Penalidade fora de posição (multiplica o overall)

| Situação | Fator |
|---|---|
| Posição natural | 1.00 |
| Vizinha (ex.: VOL↔MC, MC↔MEI, LD↔ZAG, LE↔ZAG, PE↔CA, PD↔CA, PE↔MEI, PD↔MEI, ZAG↔VOL) | 0.92 |
| Distante (qualquer outra linha↔linha) | 0.80 |
| Goleiro na linha ou linha no gol | 0.50 |

A tabela exata de vizinhança fica num único módulo (`posicoes`) e é coberta por testes.

### 4.3 Força do time
Quatro setores, cada um a média dos overalls efetivos das vagas da formação naquele setor:
- **GOL**: GOL · **DEF**: ZAG, LD, LE · **MEI**: VOL, MC, MEI · **ATA**: PD, PE, CA

Adversários controlados pelo computador já têm `gol, def, mei, ata` cadastrados.

**Postura:** Ofensiva = ATA +4, DEF −4; Defensiva = DEF +4, ATA −4; Equilibrada = nada.
**Mando de campo:** +2 em todos os setores do mandante.

### 4.4 Simulação
18 lances de 5 minutos (+ acréscimos narrativos). Em cada lance:
1. Posse decidida por MEI × MEI.
2. Quem tem a posse cria chance com probabilidade função de ATA × DEF adversária.
3. Chance vira gol com probabilidade função de ATA × GOL adversário.

Constantes calibradas por teste para os alvos:
- ~2,5 gols por jogo em média
- time 10 pontos melhor vence ~60–65%
- empates ~25%

### 4.5 Cansaço
Cada titular chega ao intervalo com cansaço 0–100 (maior para idade ≥ 32 e postura ofensiva). No 2º tempo o overall efetivo cai proporcionalmente ao cansaço, até −10% no fim do jogo. Quem entra no intervalo começa descansado. **O cansaço zera entre jogos.**

### 4.6 Lesões e cartões
- Lesão: ~1,5% por jogador por jogo; fora 1–3 jogos.
- Vermelho: ~3% por time por jogo; time joga com os setores reduzidos pelo resto da partida; expulso suspenso no próximo jogo.
- Sem acúmulo de amarelos.

### 4.7 Pênaltis
Cobrança base 75%, ajustada por ATA do batedor × GOL adversário. 5 cobranças, depois alternadas.

### 4.8 VAR e acréscimos
Apenas narrativos; ocasionalmente um gol é anulado pelo VAR (decidido antes de contabilizar).

### 4.9 Aleatoriedade
Todo sorteio usa um **RNG com semente** (`engine/rng`). Testes são determinísticos e o save guarda só a semente + estado.

## 5. Competições e calendário

### 5.1 Estadual (todas as temporadas)
Estadual do estado do clube escolhido. Formato padrão: 12 clubes, turno único (11 jogos), 4 primeiros → semifinal em jogo único → final em ida e volta. Clubes pequenos com nome real e notas 60–70.

### 5.2 Brasileirão
20 clubes, pontos corridos, 38 rodadas. Desempate: pontos, vitórias, saldo, gols pró.

### 5.3 Copa do Brasil (a partir da temporada 2)
32 clubes (20 da Série A + 12 vindos dos estaduais). Mata-mata ida e volta: 16 avos, oitavas, quartas, semi, final. Empate no agregado → pênaltis (sem gol fora).

### 5.4 Libertadores e Sul-Americana (mesmo formato)
32 clubes, 8 grupos de 4 (6 jogos), 2 primeiros avançam. Oitavas, quartas e semi ida e volta; **final em jogo único** (campo neutro). Clubes estrangeiros: pool de ~40 sul-americanos; os mais fortes vão à Libertadores, os demais à Sul-Americana.

### 5.5 Regras de classificação (para a temporada seguinte)

| Resultado na temporada anterior | Continental |
|---|---|
| 1º–4º no Brasileirão | Libertadores |
| Campeão da Copa do Brasil | Libertadores |
| Campeão da Libertadores | Libertadores |
| Campeão da Sul-Americana | Libertadores |
| 5º–10º no Brasileirão | Sul-Americana |
| 11º–20º | nenhum |

Temporada 1: só Estadual + Brasileirão. Os clubes do computador seguem as mesmas regras (vagas brasileiras completadas pela tabela). Se as vagas brasileiras extras (campeões de copa) excederem o limite, as vagas descem pela tabela — o mesmo critério para todos.

### 5.6 Calendário
Lista ordenada de datas por temporada: bloco do estadual, depois as 38 rodadas do Brasileirão com datas de meio de semana para Copa do Brasil e continental intercaladas. Jogos que não envolvem o usuário são simulados instantaneamente em segundo plano.

### 5.7 Oscilação dos adversários
No início de cada temporada, cada nota de cada clube do computador varia ±3 (limitada a 50–90).

### 5.8 Jogo importante
Qualquer mata-mata, finais, clássicos do clube do usuário e as 5 últimas rodadas do Brasileirão.

## 6. Progressão entre temporadas

### 6.1 Envelhecimento (fim de temporada, todos +1 ano)

| Idade (após o aniversário) | Δ overall |
|---|---|
| ≤ 23 | +3 |
| 24–27 | +1 |
| 28–31 | 0 |
| 32–33 | −2 |
| ≥ 34 | −4 |

Overall limitado a 40–99. Idade inicial = idade do atleta no ano daquele elenco.
**Aposentadoria:** a partir de 35 anos, 40% de chance por temporada; aos 37, obrigatória. Cada aposentado gera uma roleta de reposição obrigatória (elenco volta a 15).

### 6.2 Roletas de transferência (pela posição no Brasileirão)

| Resultado | Roletas |
|---|---|
| Campeão | 3 boas, opcionais |
| 2º–4º | 2 boas, opcionais |
| 5º–10º | 1 boa, opcional |
| 11º–16º | nenhuma |
| 17º–20º | 3 ruins, **obrigatórias** |

**Bônus por título de copa** (soma com a tabela acima): +1 roleta boa opcional para cada título de **Copa do Brasil**, **Sul-Americana** e **Libertadores** conquistado na temporada. Estadual não dá bônus. Ex.: 3º no Brasileirão + campeão da Copa do Brasil = 3 roletas boas. Um time entre os 4 últimos que ganhe uma copa recebe as 3 ruins obrigatórias **e** a boa do título.

- **Boa:** sorteia um elenco; o usuário escolhe um atleta e quem sai, ou recusa.
- **Ruim:** sorteia apenas atletas com overall ≤ 68 de qualquer elenco da base; o usuário é obrigado a aceitar e escolhe quem sai.
- **Reposição (aposentadoria):** igual à boa, mas obrigatória.
- Atleta já presente no elenco do usuário não pode ser sorteado de novo.

## 7. Dados (JSON editáveis em `src/data/`)

- `elencos.json` — 40 elencos históricos da roleta: `{ id, clube, sigla, ano, cores, jogadores: [{ nome, pos, ovr, idade }] }`, ~20 jogadores por elenco. Gerados pelo Claude a partir de conhecimento próprio e revisados pelo autor (fontes de conferência: ogol.com.br, Wikipedia, Transfermarkt).
- `clubes.json` — clubes brasileiros atuais: `{ id, nome, sigla, estado, cores, gol, def, mei, ata, serieA, classicos: [ids] }`.
- `estaduais.json` — `{ estado: { nome, clubes: [ids] } }`.
- `estrangeiros.json` — ~40 clubes sul-americanos com as 4 notas e país.
- `formacoes.json` — formações (4-3-3, 4-4-2, 4-2-3-1, 4-2-4, 4-2-2-2, 4-5-1, 4-3-1-2) com as 11 vagas.

## 8. Arquitetura

React + Vite, publicado no GitHub Pages (repositório próprio, pasta `C:\Users\User\Desktop\carreira-fc`).

```
src/
  engine/        # JS puro, sem React, 100% testável
    rng.js
    posicoes.js       # vizinhança e fator de penalidade
    forca.js          # setores do time a partir de formação + escalação + postura
    partida.js        # simulação lance a lance, eventos, cansaço, lesão, vermelho
    penaltis.js
    liga.js           # pontos corridos e tabela
    mataMata.js       # ida e volta, jogo único, agregado
    grupos.js         # fase de grupos
    calendario.js     # monta a lista de datas da temporada
    classificacao.js  # regras da seção 5.5 e 6.2
    envelhecimento.js
    roleta.js         # draft, boa, ruim, reposição, curingas
    carreira.js       # estado da carreira e avanço de data
  storage/
    index.js          # interface save/load/export/import
    localStorage.js   # implementação v1
  ui/                 # telas React
  data/               # JSONs
```

**Estado:** um objeto `carreira` serializável (semente, temporada, data atual, elenco, tabelas, histórico de títulos). A UI só lê o estado e chama funções do engine.

**Save:** gravação automática no `localStorage` após cada jogo e cada decisão; botões **Exportar** (baixa arquivo `.json`) e **Importar**. A interface `storage` permite trocar por Supabase depois sem mudar o resto.

**Mobile-first:** layout pensado para tela de celular, funcional no desktop.

## 9. Testes

Vitest, focado no `engine/`:
- Fatores de penalidade por posição.
- Cálculo de setores com formação, postura e mando.
- Calibração: 10.000 partidas simuladas checando média de gols e taxa de vitória do favorito dentro das faixas da seção 4.4.
- Tabela de pontos corridos e critérios de desempate.
- Mata-mata ida e volta com agregado e pênaltis.
- Regras de classificação (5.5) e roletas por posição (6.2).
- Envelhecimento e aposentadoria.
- Calendário: quantidade de jogos por temporada coerente com as competições disputadas.
- Save/load: estado exportado e importado é idêntico.

## 10. Ordem sugerida de construção

1. Engine de partida + calibração (sem tela).
2. Competições (liga, mata-mata, grupos) e calendário.
3. Dados iniciais: formações, clubes, estaduais, estrangeiros e os 40 elencos.
4. Telas: nova carreira → draft → painel → partida ao vivo.
5. Fim de temporada, envelhecimento, transferências, fim de carreira.
6. Save/export/import e publicação no GitHub Pages.
