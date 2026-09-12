#!/usr/bin/env node
/**
 * gerar-erros-comuns.mjs — converte a página do cofre "erros-comuns-exercicios-adaptkorpus"
 * (markdown, 163 linhas de tabela `# | Exercício | Erros comuns`) em
 * `src/lib/data/erros-comuns.ts` = `Record<string, string[]>` (`e{n}` → lista de "erro → correção").
 *
 *   node scripts/gerar-erros-comuns.mjs <erros-comuns-exercicios-adaptkorpus.md>
 *
 * Regras (cofre: conceitos/erros-comuns-exercicios-adaptkorpus):
 * - `#` da tabela = chave da biblioteca A1 e casa com `EXERCISES[e{#}]` (e1=Flexão=#1, e3=Agachamento=#3).
 * - VALIDA (hard-fail, nada é escrito): 163 linhas · a coluna "Exercício" bate EXATAMENTE com
 *   `EXERCISES[e{#}].nomePt` (pega reordenação/dessincronia com a biblioteca) · nenhuma célula vazia.
 * - Cada célula é dividida por " · " em itens; o prefixo "❌ " é REMOVIDO (o marcador visual é da UI,
 *   não do dado — vermelho só é reservado a erro/segurança no app) e sobra "erro → correção".
 * - A markdown NÃO é commitada (é do cofre, fonte de verdade externa); só o TS gerado entra no repo —
 *   mesma prática do gerar-seed.mjs (xlsx do autor).
 * - Emissão determinística → re-rodar produz diff vazio.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [mdPath] = process.argv.slice(2);
if (!mdPath) {
  console.error('uso: node scripts/gerar-erros-comuns.mjs <erros-comuns-exercicios-adaptkorpus.md>');
  process.exit(1);
}

const ESPERADO_LINHAS = 163;
const erros = [];
const falhar = (msg) => erros.push(msg);

// ── nomes canônicos da biblioteca (fonte de verdade da chave `e{#}`) ─────────────────────────
const seedSrc = readFileSync(resolve(RAIZ, 'src/lib/data/exercises.ts'), 'utf8');
const nomePorId = {};
const reSeed = /"id": "e(\d+)"[\s\S]*?"nomePt": "([^"]+)"/g;
let ms;
while ((ms = reSeed.exec(seedSrc))) nomePorId[Number(ms[1])] = ms[2];

// ── parse da tabela markdown ─────────────────────────────────────────────────────────────────
const md = readFileSync(resolve(mdPath), 'utf8');
const linhaTabela = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|$/;
const errosPorId = {};
let total = 0;

for (const linha of md.split('\n')) {
  const m = linha.match(linhaTabela);
  if (!m) continue;
  const n = Number(m[1]);
  const nome = m[2].trim();
  const celula = m[3].trim();
  total++;

  if (nomePorId[n] === undefined) { falhar(`#${n}: sem exercício e${n} na biblioteca`); continue; }
  if (nomePorId[n] !== nome) { falhar(`#${n}: nome divergente — seed "${nomePorId[n]}" ≠ cofre "${nome}"`); continue; }

  const itens = celula.split(' · ').map((s) => s.replace(/^❌\s*/, '').trim()).filter(Boolean);
  if (itens.length === 0) { falhar(`#${n} ("${nome}"): célula de erros vazia`); continue; }
  for (const it of itens) {
    if (!it.includes('→')) falhar(`#${n} ("${nome}"): item sem "→ correção": «${it}»`);
  }
  errosPorId[`e${n}`] = itens;
}

// ── validações globais ───────────────────────────────────────────────────────────────────────
if (total !== ESPERADO_LINHAS) falhar(`linhas na tabela: ${total} ≠ ${ESPERADO_LINHAS}`);
for (let n = 1; n <= ESPERADO_LINHAS; n++) {
  if (!errosPorId[`e${n}`]) falhar(`faltando erros para e${n} ("${nomePorId[n] ?? '?'}")`);
}

if (erros.length) {
  console.error(`\n✗ ${erros.length} erro(s) — NADA foi escrito:\n` + erros.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

// ── emissão determinística (chaves e1..e163 em ordem numérica) ───────────────────────────────
const cabecalho = `/**
 * GERADO da página do cofre "erros-comuns-exercicios-adaptkorpus" — NÃO editar à mão. Regenerar:
 *   node scripts/gerar-erros-comuns.mjs <erros-comuns-exercicios-adaptkorpus.md>
 * Chave = id da biblioteca A1 (e{#}); cada string é "erro → correção". O marcador visual
 * (neutro, nunca vermelho — vermelho só p/ erro/segurança) é responsabilidade da UI.
 * Trava do cofre: dica educacional e geral, nunca promete "prevenir lesão"/"corrigir postura".
 */
`;
const corpo = [];
for (let n = 1; n <= ESPERADO_LINHAS; n++) {
  const id = `e${n}`;
  const lista = errosPorId[id].map((s) => `    ${JSON.stringify(s)}`).join(',\n');
  corpo.push(`  "${id}": [\n${lista},\n  ]`);
}
const saida = `${cabecalho}\nexport const ERROS_COMUNS: Record<string, string[]> = {\n${corpo.join(',\n')},\n};\n`;
writeFileSync(resolve(RAIZ, 'src/lib/data/erros-comuns.ts'), saida);

console.log(`✓ erros-comuns gerado: ${total} exercícios · ${Object.values(errosPorId).reduce((a, l) => a + l.length, 0)} itens`);
