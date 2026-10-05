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
    // Como um jogador sensato: troca alguém da mesma posição e nunca fica com menos de 2 goleiros.
    const { obrigatoria } = c.transferencias.fila[0];
    const elenco = Object.values(c.elenco.jogadores);
    const cheio = elenco.length >= 15;
    const melhor = [...c.transferencias.atual.opcoes].sort((a, b) => b.ovr - a.ovr)[0];
    const mesmaPos = elenco.filter((j) => j.pos === melhor.pos).sort((a, b) => a.ovr - b.ovr);
    const goleiros = elenco.filter((j) => j.pos === 'GOL').length;
    const vendiveis = elenco.filter((j) => j.pos !== 'GOL' || goleiros > 2).sort((a, b) => a.ovr - b.ovr);
    const vale = mesmaPos[0] && mesmaPos[0].ovr < melhor.ovr;
    if (!obrigatoria) {
      if (!cheio) c = aceitarTransferencia(c, melhor.id);
      else c = vale ? aceitarTransferencia(c, melhor.id, mesmaPos[0].id) : recusarTransferencia(c);
      continue;
    }
    const sai = cheio ? (mesmaPos[0] ?? vendiveis[0]).id : null;
    c = aceitarTransferencia(c, melhor.id, sai);
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
