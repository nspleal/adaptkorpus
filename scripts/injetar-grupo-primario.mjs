/**
 * Injeta `grupoPrimario` nos 163 exercícios de src/lib/data/exercises.ts, a partir do
 * campo `grupo` normalizado do motor standalone do autor (curadoria aprovada — cofre
 * `parametros-motor-substituicao-adaptkorpus` §2, DF 2026-07-04: vocabulário derivado da
 * 1ª entrada da coluna de grupo muscular da A1).
 *
 * Mapeamento lossless: id numérico N (standalone) ↔ "eN" (app). Edita por âncora
 * (`"id": "eN"`), insere `"grupoPrimario"` logo após `"grupoMuscular"`, preserva o
 * resto byte a byte. Aborta se qualquer um dos 163 não casar (zero adivinhação).
 * Idempotente: roda de novo → atualiza o valor no lugar, sem duplicar.
 *
 * Uso: node scripts/injetar-grupo-primario.mjs <caminho-do-exercicios-data-standalone.ts>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FONTE = process.argv[2];
if (!FONTE) {
  console.error('uso: node scripts/injetar-grupo-primario.mjs <exercicios-data-standalone.ts>');
  process.exit(1);
}
const ALVO = new URL('../src/lib/data/exercises.ts', import.meta.url).pathname;

// 1) Lê o standalone: pares { id numérico → grupo }.
const src = readFileSync(FONTE, 'utf8');
const porId = new Map();
// Entradas do standalone: `{ id: 12, nome: '...', grupo: 'peito', ... }`
const re = /id:\s*(\d+)\s*,[^}]*?grupo:\s*'([^']+)'/gs;
for (const m of src.matchAll(re)) porId.set(Number(m[1]), m[2]);
if (porId.size !== 163) {
  console.error(`FALHA: standalone tem ${porId.size} entradas com grupo (esperado 163).`);
  process.exit(1);
}

// 2) Injeta no exercises.ts, ancorado em "id": "eN" e "grupoMuscular".
let out = readFileSync(ALVO, 'utf8');
let injetados = 0;
for (const [n, grupo] of [...porId.entries()].sort((a, b) => a[0] - b[0])) {
  // Bloco da entrada: da linha `"id": "eN",` até o próximo `"id":` (ou fim).
  const anchor = `"id": "e${n}",`;
  const start = out.indexOf(anchor);
  if (start === -1) {
    console.error(`FALHA: id "e${n}" não encontrado no exercises.ts.`);
    process.exit(1);
  }
  const nextId = out.indexOf('"id": "e', start + anchor.length);
  const end = nextId === -1 ? out.length : nextId;
  let bloco = out.slice(start, end);

  if (bloco.includes('"grupoPrimario"')) {
    // idempotência: atualiza no lugar
    bloco = bloco.replace(/"grupoPrimario": "[^"]*"/, `"grupoPrimario": "${grupo}"`);
  } else {
    const gm = bloco.match(/("grupoMuscular": "[^"]*",\n)(\s*)/);
    if (!gm) {
      console.error(`FALHA: "grupoMuscular" não encontrado no bloco de e${n}.`);
      process.exit(1);
    }
    bloco = bloco.replace(gm[0], `${gm[1]}${gm[2]}"grupoPrimario": "${grupo}",\n${gm[2]}`);
  }
  out = out.slice(0, start) + bloco + out.slice(end);
  injetados++;
}

if (injetados !== 163) {
  console.error(`FALHA: injetados ${injetados}/163.`);
  process.exit(1);
}
// 3) Verificação final: 163 ocorrências, vocabulário fechado.
const injected = [...out.matchAll(/"grupoPrimario": "([^"]+)"/g)].map((m) => m[1]);
if (injected.length !== 163) {
  console.error(`FALHA pós-injeção: ${injected.length} ocorrências (esperado 163).`);
  process.exit(1);
}
const vocab = new Set([...porId.values()]);
for (const g of injected) {
  if (!vocab.has(g)) {
    console.error(`FALHA: valor fora do vocabulário: "${g}".`);
    process.exit(1);
  }
}
writeFileSync(ALVO, out);
console.log(`OK: grupoPrimario injetado em 163/163 exercícios (${vocab.size} valores distintos).`);
