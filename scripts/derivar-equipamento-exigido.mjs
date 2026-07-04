/**
 * Deriva o 1º PASSO de `equipamentoExigido` para os 53 exercícios `casa_com` e injeta o
 * campo em src/lib/data/exercises.ts (modelo de equipamento "2 níveis", DF 2026-07-04).
 *
 * ⚠️ CURADORIA, não decisão de código: a tabela abaixo é derivada de nome +
 * `equipamentoDetalhe` e VOLTA NO HANDOFF para o autor aprovar no cofre (mesmo fluxo do
 * grupoPrimario). Itens marcados `ambiguo` precisam de DF explícita.
 *
 * Regras aplicadas (documentadas p/ auditoria):
 *  - "Halteres" → [halteres] · "Elástico" → [elastico] · "Barra fixa" → [barra_fixa]
 *  - "Halteres / Barra": barbell está FORA do vocabulário (quase todo barbell é academia)
 *    → a versão com halteres basta → [halteres].
 *  - "Halter(es) / Kettlebell" (goblet, farmer): semântica do filtro é E (⊆), não OU →
 *    1º passo = [halteres] (mais comum) + marcado AMBÍGUO (o modelo não expressa OU).
 *  - Inclinados (supino/crucifixo/rosca inclinada) exigem banco → [halteres, banco].
 *  - Supino reto/crucifixo/pullover com halteres: banco clássico, chão possível (floor
 *    press) → [halteres, banco] + AMBÍGUO.
 *  - e139 Rolo de punho: NÃO cabe no vocabulário de 7 (implemento próprio) → 1º passo
 *    [halteres] (usa peso) + AMBÍGUO/fora-do-vocabulário (candidato a 8º item).
 *
 * Uso: node scripts/derivar-equipamento-exigido.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ALVO = new URL('../src/lib/data/exercises.ts', import.meta.url).pathname;

/** id → { eq, ambiguo? } — a TABELA (volta no handoff p/ aprovação). */
export const TABELA = {
  e8: { eq: ['roda_abdominal'] },
  e11: { eq: ['halteres', 'banco'], ambiguo: 'floor press (chão) é alternativa aceitável?' },
  e12: { eq: ['halteres', 'banco'] },
  e19: { eq: ['halteres'] },
  e20: { eq: ['elastico'] },
  e21: { eq: ['barra_fixa'] },
  e22: { eq: ['barra_fixa'] },
  e33: { eq: ['halteres'], ambiguo: 'OU kettlebell (goblet) — o filtro só expressa E' },
  e41: { eq: ['halteres'] },
  e42: { eq: ['halteres'] },
  e44: { eq: ['elastico'] },
  e45: { eq: ['halteres'] },
  e52: { eq: ['halteres'] },
  e54: { eq: ['halteres'] },
  e55: { eq: ['halteres', 'banco'], ambiguo: 'crucifixo no chão limita amplitude — aceitável?' },
  e56: { eq: ['halteres', 'banco'] },
  e61: { eq: ['halteres'] },
  e67: { eq: ['halteres'] },
  e72: { eq: ['halteres'] },
  e73: { eq: ['halteres'] },
  e74: { eq: ['halteres'] },
  e76: { eq: ['halteres', 'banco'] },
  e80: { eq: ['halteres'] },
  e81: { eq: ['halteres'] },
  e82: { eq: ['halteres'] },
  e84: { eq: ['halteres'] },
  e87: { eq: ['elastico'] },
  e88: { eq: ['barra_fixa'] },
  e92: { eq: ['corda_pular'] },
  e95: { eq: ['halteres'] },
  e96: { eq: ['elastico'] },
  e97: { eq: ['halteres'] },
  e98: { eq: ['halteres'] },
  e102: { eq: ['halteres'] },
  e106: { eq: ['halteres'] },
  e108: { eq: ['kettlebell'] },
  e109: { eq: ['halteres'], ambiguo: 'OU kettlebell (farmer walk)' },
  e111: { eq: ['halteres'] },
  e112: { eq: ['halteres'] },
  e118: { eq: ['barra_fixa'] },
  e119: { eq: ['elastico'] },
  e120: { eq: ['elastico'] },
  e125: { eq: ['halteres', 'banco'], ambiguo: 'pullover no chão limita amplitude — aceitável?' },
  e133: { eq: ['halteres'] },
  e135: { eq: ['halteres'] },
  e136: { eq: ['halteres'] },
  e137: { eq: ['halteres'] },
  e138: { eq: ['halteres'] },
  e139: { eq: ['halteres'], ambiguo: 'FORA DO VOCABULÁRIO: rolo de punho é implemento próprio (candidato a 8º item ou reclassificação)' },
  e140: { eq: ['halteres'], ambiguo: 'OU kettlebell (farmer hold)' },
  e144: { eq: ['halteres'] },
  e158: { eq: ['halteres'], ambiguo: 'ou anilha sobre os joelhos (improviso comum)' },
  e162: { eq: ['elastico'] },
};

let out = readFileSync(ALVO, 'utf8');

// Confere que a tabela cobre EXATAMENTE os casa_com do arquivo.
const casaCom = [...out.matchAll(/"id": "(e\d+)",[\s\S]*?"local": "([^"]+)"/g)]
  .filter((m) => m[2] === 'casa_com').map((m) => m[1]);
const idsTabela = Object.keys(TABELA);
const faltam = casaCom.filter((id) => !idsTabela.includes(id));
const sobram = idsTabela.filter((id) => !casaCom.includes(id));
if (faltam.length || sobram.length) {
  console.error('FALHA: tabela ≠ casa_com do arquivo.', { faltam, sobram });
  process.exit(1);
}

let injetados = 0;
for (const [id, { eq }] of Object.entries(TABELA)) {
  const anchor = `"id": "${id}",`;
  const start = out.indexOf(anchor);
  const nextId = out.indexOf('"id": "e', start + anchor.length);
  const end = nextId === -1 ? out.length : nextId;
  let bloco = out.slice(start, end);
  const valor = JSON.stringify(eq).replace(/,/g, ', ').replace(/\[/, '[').replace(/\]/, ']');
  if (bloco.includes('"equipamentoExigido"')) {
    bloco = bloco.replace(/"equipamentoExigido": \[[^\]]*\]/, `"equipamentoExigido": ${valor}`);
  } else {
    const m = bloco.match(/("local": "casa_com",\n)(\s*)/);
    if (!m) { console.error(`FALHA: âncora local não achada em ${id}`); process.exit(1); }
    bloco = bloco.replace(m[0], `${m[1]}${m[2]}"equipamentoExigido": ${valor},\n${m[2]}`);
  }
  out = out.slice(0, start) + bloco + out.slice(end);
  injetados++;
}
if (injetados !== 53) { console.error(`FALHA: ${injetados}/53`); process.exit(1); }
writeFileSync(ALVO, out);

// Emite a tabela p/ o handoff (aprovação do cofre).
console.log(`OK: equipamentoExigido injetado em ${injetados}/53 casa_com.`);
console.log('\n| id | equipamentoExigido | ⚠️ ambíguo |');
console.log('|---|---|---|');
for (const [id, { eq, ambiguo }] of Object.entries(TABELA)) {
  console.log(`| ${id} | ${eq.join(' + ')} | ${ambiguo ?? '—'} |`);
}
