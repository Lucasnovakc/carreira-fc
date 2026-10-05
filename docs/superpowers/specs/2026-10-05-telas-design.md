# Carreira FC — Design das telas (Plano 4)

> Complementa `2026-10-05-carreira-fc-design.md` (seção 3). Decidido com o usuário em 2026-10-05, com mockups no navegador.

## 1. Objetivo

Dar ao motor já pronto (Planos 1–3 + equilíbrio) uma interface jogável no celular: criar carreira, fazer o draft, jogar a temporada (ao vivo ou simulando), passar pelas janelas de transferência e ver a sala de troféus. Ao fim deste plano, o usuário consegue jogar uma carreira inteira no navegador, com a carreira salva automaticamente.

**Fora deste plano (Plano 5):** exportar/importar save, publicar no GitHub Pages, sons, PWA/instalação.

## 2. Direção visual (escolhida nos mockups)

- **Estilo B — transmissão de TV:** fundo escuro (`#0c1410`), superfícies `#13241b`/`#1d3527`, texto `#e8f5ec`, secundário `#9fb8a8`, destaque verde-limão `#c6ff00`, vermelho `#e74c3c` para cartões/derrotas, verde de campo `#1f6338`. Tipografia do sistema, números em peso 800–900.
- **Distintivo de clube:** círculo/escudo simples com a **sigla** nas duas cores do clube (`cores` dos dados). Mesmo componente para clubes atuais, estrangeiros e elencos históricos (sigla + ano).
- **Mobile-first:** largura de referência 360–420 px, alvos de toque ≥ 44 px, nada de rolagem horizontal da página; funciona no desktop centralizado (largura máx. ~480 px).
- Variáveis CSS em `:root`; um único tema (escuro).

## 3. Arquitetura

- **React + Vite** (a instalar neste plano — hoje o projeto só tem Vitest), **CSS próprio** com variáveis (sem Tailwind, sem roteador).
- **Telas guiadas pela `fase`** da carreira: `inicio` (sem carreira) → `draft` → `temporada` → `transferencias` → `temporada` … → `fim`. O componente raiz escolhe a tela pela fase; não há como abrir tela fora de hora.
- **Estado:** um `useReducer`/contexto (`CarreiraProvider`) guarda `carreira` e expõe ações que chamam as funções puras do motor (`girarDraft`, `jogarData`, …). `dados` vem de `src/data/index.js` e nunca é salvo.
- **Salvamento automático:** depois de cada ação, `carreira` é gravada no `localStorage` (chave `carreira-fc:save`), dentro de `try/catch`; ao abrir, carrega se existir. Interface `storage` (`salvar`, `carregar`, `apagar`) para o Plano 5 trocar/estender.
- **Partida ao vivo** é estado local da tela de partida (não vai para o save até terminar); ao terminar, chama `jogarData(carreira, dados, { partidaUsuario, penaltisUsuario })`.
- **Lógica de tela testável** em módulos puros em `src/ui/logica/` (narração, pressão, revelação por relógio, cansaço em faixas, comparação de vaga) — testados com Vitest. Componentes visuais conferidos rodando o app.

## 4. Telas

### 4.1 Início
"Continuar" (clube, temporada X de N, títulos) se houver save; "Nova carreira". Nova carreira com save existente pede confirmação ("A carreira atual será apagada").

### 4.2 Nova carreira
Uma tela rolando: grade dos 20 clubes da Série A (distintivo + estado) · duração 5/10 · dificuldade Clássico/Olheiro · formação (7, com campinho) · postura. Botão "Bora girar a roleta!". Semente aleatória (`crypto.getRandomValues`, inteiro).

### 4.3 Draft
- Topo: campinho com as 11 vagas + 4 vagas de banco; contador "N/15 · curingas: K".
- Roleta: faixa horizontal de elencos (sigla, ano, cor) que gira e desacelera ~2 s até o elenco sorteado (resultado já decidido pelo motor; a animação só revela).
- Lista do elenco sorteado: nome, posição, idade, overall (oculto no Olheiro).
- Fluxo: toca no jogador → as vagas livres mostram o overall efetivo ("89 (−8%)"; no Olheiro, "natural / vizinha / distante") → toca na vaga ou no banco → confirma.
- "Usar curinga (K)". Com 15 jogadores a temporada começa (o motor faz isso).

### 4.4 Painel da temporada — abas no rodapé
Topo fixo: "Temporada T de N · Data d/D" e 🏆 total.
- **Jogo:** cartão do próximo jogo (competição/fase/perna, distintivos, mando, placar da ida no mata-mata, selo "Importante"); botões **▶ Assistir**, **Simular**, **⏩ Até o próximo importante**; avisos de 🚑/🟥 com "Ajustar escalação" (abre a aba Elenco); data sem jogo do usuário → "seu time não joga" + "Avançar"; últimos 5 resultados (V/E/D).
- **Tabelas:** seletor das competições da temporada; pontos corridos com linha do usuário destacada e faixas (G4 / Sul-Americana / Z4 no Brasileirão; classificados no estadual e grupos); mata-mata com ida, volta, agregado e pênaltis por fase.
- **Elenco:** campinho com titulares (toque em dois para trocar de lugar, inclusive titular ↔ reserva), lista dos 15 (posição, idade, overall/oculto, 🚑/🟥, gols na temporada), formação e postura. Usa `definirTatica`.
- **Calendário:** as datas da temporada com competição, adversário e resultado; próxima destacada; datas sem jogo do usuário esmaecidas.
- **"Até o próximo importante":** joga datas em sequência até a próxima com `importante` (ou fim da temporada) e mostra um resumo dos jogos simulados.

### 4.5 Partida ao vivo (sobrepõe o painel)
- Placar de TV (distintivos, placar, relógio com acréscimos "45+3'").
- **Barra de pressão:** fração das chances (`chance`, `gol`, `var`) de cada lado nos últimos 15 minutos de jogo revelados; 50/50 sem dados. Embaixo: "Chances X x Y".
- **Destaque grande** por ~1,5 s para `gol` (GOOOL! + nome + minuto), `var` (VAR… GOL ANULADO), `vermelho` (EXPULSO), `lesao` (LESÃO + troca automática, se houve).
- **Feed curto** dos últimos lances com narração variada (2–4 frases por tipo de evento; escolha determinística pelo minuto para não mudar ao re-renderizar). Gol de clube sem elenco: "Gol do Palmeiras".
- **Relógio:** cada tempo leva ~15 s (1'→45'); eventos aparecem quando o relógio passa do minuto deles. Botão **⏩ Pular** revela o resto do tempo.
- **Intervalo (única pausa):** cansaço de cada titular em faixa (verde < 50, amarelo 50–69, vermelho ≥ 70); trocas (até 4 no jogo, contando as automáticas); formação e postura; "Começar o 2º tempo". Usa `aplicarIntervalo`.
- **Prorrogação** (quando `jogo.prorrogacao` e empate): segue sozinha 91'→120'.
- **Pênaltis** (quando `precisaDePenaltis`): tela própria; disputa calculada com `disputarPenaltis(setoresDoLado(casa,{progresso:1}), setoresDoLado(fora,{progresso:1}), rngDaPartida(c))`; cobranças reveladas uma a uma (⚽/❌) e placar.
- **Resumo final:** placar, gols (autor e minuto), cartões, lesões; no mata-mata "Classificado!"/"Eliminado"; "Continuar" chama `jogarData` e volta ao painel.
- **Simular:** chama `jogarData` direto e mostra um resumo rápido do resultado.

### 4.6 Fim de temporada / janela de transferências
- Resumo: títulos (troféus grandes ou "Sem títulos desta vez"), campanha por competição (`historico[].campanhas`), artilheiro, competições da próxima temporada (de `vagas`).
- Evolução do elenco (`transferencias.envelhecimento`): ↑ verde / ↓ vermelho / aposentados com despedida.
- Fila de roletas como fichas (boa 🟢, média 🟡, ruim 🔴 "obrigatória", reposição ⚪). Cada roleta gira como no draft; escolher jogador e, se o elenco estiver cheio, quem sai; comparação "Entra X (ovr) · Sai Y (ovr)"; "Recusar" só nas opcionais.
- "Começar a temporada T+1" (`concluirTransferencias`).

### 4.7 Fim da carreira
Sala de troféus agrupada por competição com as temporadas ("🏆 Brasileirão ×2: T3, T7"); linha do tempo da posição no Brasileirão; artilheiro de cada temporada; **artilheiro da história do clube**; "Nova carreira".

## 5. Ajustes no motor exigidos por este plano

- **Gols na carreira:** somar os gols de cada jogador ao longo da carreira (`carreira.golsNaCarreira: { [jogadorId]: { nome, gols } }`), atualizado no fim de cada temporada, para o "artilheiro da história". Teste no motor.

## 6. Testes

- Vitest para `src/ui/logica/*` (narração, pressão, revelação por relógio, faixas de cansaço, comparação de vaga, resumo de datas simuladas) e para o ajuste do motor (§5).
- Teste do `storage` com `localStorage` simulado (salvar/carregar/erro).
- Verificação manual rodando `npm run dev` no celular/desktop: criar carreira, draft completo, jogar uma partida ao vivo com intervalo, simular até importante, ver tabelas, passar por uma janela.
