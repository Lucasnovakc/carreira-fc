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
