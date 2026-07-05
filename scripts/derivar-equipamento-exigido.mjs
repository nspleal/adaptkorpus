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
 *  - "Halter(es) / Kettlebell" (goblet, farmer): ANY-OF (`ou`) — DF V8.5 2026-07-04:
 *    `equipamentoExigidoQualquerUm: [halteres, kettlebell]` (algum marcado satisfaz).
 *  - Inclinados (supino/crucifixo/rosca inclinada) exigem banco → [halteres, banco].
 *  - e11 Supino reto c/ halteres: floor press (chão) EQUIVALE → só [halteres]
 *    (DF V8.5 2026-07-04). Crucifixo/pullover (e55/e125) SEGUEM [halteres, banco]
 *    (no chão limitam amplitude — mesma DF).
 *  - e139 Rolo de punho: DF V8.5 2026-07-04 — NÃO criar 8º item; fica [halteres]
 *    (usa o peso do halter como resistência).
 *
 * Uso: node scripts/derivar-equipamento-exigido.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ALVO = new URL('../src/lib/data/exercises.ts', import.meta.url).pathname;

/** id → { eq?, ou?, ambiguo? } — a TABELA (`eq` = E/⊆; `ou` = any-of, V8.5). */
export const TABELA = {
  e8: { eq: ['roda_abdominal'] },
  e11: { eq: ['halteres'] }, // DF V8.5: floor press equivale — banco NÃO exigido
  e12: { eq: ['halteres', 'banco'] },
  e19: { eq: ['halteres'] },
  e20: { eq: ['elastico'] },
  e21: { eq: ['barra_fixa'] },
  e22: { eq: ['barra_fixa'] },
  e33: { ou: ['halteres', 'kettlebell'] }, // DF V8.5: goblet = halteres OU kettlebell
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
  e109: { ou: ['halteres', 'kettlebell'] }, // DF V8.5: farmer walk = halteres OU kettlebell
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
  e139: { eq: ['halteres'] }, // DF V8.5: sem 8º item — rolo de punho fica em halteres
  e140: { ou: ['halteres', 'kettlebell'] }, // DF V8.5: farmer hold = halteres OU kettlebell
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
for (const [id, { eq, ou }] of Object.entries(TABELA)) {
  const anchor = `"id": "${id}",`;
  const start = out.indexOf(anchor);
  const nextId = out.indexOf('"id": "e', start + anchor.length);
  const end = nextId === -1 ? out.length : nextId;
  let bloco = out.slice(start, end);
  // Idempotência: remove os campos existentes e reinjeta a partir da TABELA.
  bloco = bloco.replace(/\s*"equipamentoExigido(?:QualquerUm)?": \[[^\]]*\],/g, '');
  const m = bloco.match(/("local": "casa_com",\n)(\s*)/);
  if (!m) { console.error(`FALHA: âncora local não achada em ${id}`); process.exit(1); }
  const linhas = [];
  if (eq) linhas.push(`"equipamentoExigido": ${JSON.stringify(eq).replace(/,/g, ', ')},`);
  if (ou) linhas.push(`"equipamentoExigidoQualquerUm": ${JSON.stringify(ou).replace(/,/g, ', ')},`);
  bloco = bloco.replace(m[0], `${m[1]}${linhas.map((l) => `${m[2]}${l}\n`).join('')}${m[2]}`);
  out = out.slice(0, start) + bloco + out.slice(end);
  injetados++;
}
if (injetados !== 53) { console.error(`FALHA: ${injetados}/53`); process.exit(1); }
writeFileSync(ALVO, out);

// Emite a tabela p/ o handoff (aprovação do cofre).
console.log(`OK: equipamentoExigido injetado em ${injetados}/53 casa_com.`);
console.log('\n| id | equipamentoExigido (E) | any-of (OU) | ⚠️ ambíguo |');
console.log('|---|---|---|---|');
for (const [id, { eq, ou, ambiguo }] of Object.entries(TABELA)) {
  console.log(`| ${id} | ${eq ? eq.join(' + ') : '—'} | ${ou ? ou.join(' ou ') : '—'} | ${ambiguo ?? '—'} |`);
}
