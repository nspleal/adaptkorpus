#!/usr/bin/env node
/**
 * gerar-seed.mjs — converte as planilhas do autor (xlsx, cofre "banco-alimentos-evokorpus")
 * em `src/lib/data/foods.ts` + `src/lib/data/recipes.ts`.
 *
 *   node scripts/gerar-seed.mjs <paleta-V2-limpa.xlsx> <pratos-V2.xlsx>
 *
 * Regras (cofre: fontes/banco-alimentos-evokorpus §Expansão V2 + outputs/handoff-pratos-v2):
 * - `id` numérico da planilha vira `a{n}` / `p{n}` — ids PRESERVADOS, gaps permitidos (dedupe).
 * - `rotulo_amigavel` = vocabulário oficial do cofre (exibição); `nome` clínico TACO permanece.
 * - "NA"/"Tr"/vazio → 0 nos macros; `contemAlergenos` é sempre RECOMPUTADO dos ingredientes.
 * - VALIDA TUDO antes de escrever (hard-fail): contagens 167/107/404 · tipos 46/29/32 · ids únicos ·
 *   refs válidas · rótulo 100% e único · Δ=0 (macros do prato = Σ paleta×gramas, tolerância de
 *   arredondamento da planilha) · tipo recomputado por alérgenos = planilha · Atwater ≤ 12%.
 * - Emissão determinística no MESMO estilo dos arquivos v1 (floats sempre com decimal, chaves
 *   citadas, alérgenos ordenados) → re-rodar produz diff vazio; diffs de dados ficam legíveis.
 *
 * As planilhas NÃO são commitadas (artefatos do autor); só o TS gerado entra no repo — mesma
 * prática do v1 (macros TACO com proveniência `fonteTaco`).
 */
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [paletaPath, pratosPath] = process.argv.slice(2);
if (!paletaPath || !pratosPath) {
  console.error('uso: node scripts/gerar-seed.mjs <paleta-V2-limpa.xlsx> <pratos-V2.xlsx>');
  process.exit(1);
}

// ── contagens esperadas (handoff-pratos-v2 + dedupe 2026-07-01) ────────────────────────────
// 🔒 Atualizadas em 2026-08-06 pela leva de importação dos 11 pratos veganos (p97–p107):
//   pratos 96 → 107 · ingredientes 363 → 404 · vegano 35 → 46.
// Enquanto o autor não fizer o merge das abas da planilha-entrega na `pratos-V2.xlsx`,
// regenerar daqui FALHA ALTO — de propósito: é o que impede a regeneração de APAGAR os 11
// em silêncio. A falha é o guard, não um bug.
//
// ⚠️ 404, não 405: a prosa do handoff diz "42 linhas" de composição, mas a tabela tem 41
// (97–100:4 · 101:3 · 102:3 · 103:4 · 104:3 · 105–107:4 = 41). O Δ=0 fecha com as 41 —
// os dados estão certos; o parêntese é que estava um a mais. Reportado ao autor.
const ESPERADO = { foods: 167, recipes: 107, ingredientes: 404, tipos: { vegano: 46, vegetariano: 29, onivoro: 32 } };

// ── vocabulários planilha → app ────────────────────────────────────────────────────────────
const GRUPO = {
  'proteína animal': 'proteina_animal',
  'leguminosa/prot. vegetal': 'leguminosa_proteina_vegetal',
  'verdura/legume': 'verdura_legume',
  'fruta': 'fruta',
  'grão/cereal/tubérculo': 'grao_cereal_tuberculo',
  'gordura': 'gordura',
  'laticínio': 'laticinio',
};
const ALERGENO = {
  'origem animal': 'origem_animal', 'carne': 'carne', 'glúten': 'gluten', 'glúten (malte)': 'gluten',
  'lactose': 'lactose', 'ovo': 'ovo', 'amendoim': 'amendoim', 'castanhas': 'castanhas',
  'gergelim': 'gergelim', 'coco': 'coco', 'soja': 'soja', 'peixe/frutos do mar': 'peixe_frutos_do_mar',
};
const SEM_ALERGENO = new Set(['origem vegetal', '']); // "origem vegetal" = marcador de ausência
const REFEICAO = { 'Café': 'cafe', 'Almoço': 'almoco', 'Jantar': 'jantar', 'Lanche': 'lanche' };
const TIPO = { 'vegano': 'vegano', 'vegetariano': 'vegetariano', 'onívoro': 'onivoro' };

const erros = [];
const avisos = [];
const falhar = (msg) => erros.push(msg);

// ── leitura ────────────────────────────────────────────────────────────────────────────────
const celula = (row, idx) => {
  const v = row.getCell(idx).value;
  if (v == null) return null;
  if (typeof v === 'object' && v.result !== undefined) return v.result; // fórmula
  if (typeof v === 'object' && v.richText) return v.richText.map((r) => r.text).join('');
  return v;
};
const texto = (row, idx) => { const v = celula(row, idx); return v == null ? '' : String(v).trim(); };
const numero = (row, idx, { zeraNA = false } = {}) => {
  const v = celula(row, idx);
  if (v == null || v === '') return zeraNA ? 0 : null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (zeraNA && (s === 'NA' || s === 'Tr' || s === '-')) return 0; // convenção TACO
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : (falhar(`número inválido "${s}"`), 0);
};
const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

async function aba(path, nome) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet(nome);
  if (!ws) { console.error(`aba "${nome}" não encontrada em ${path}`); process.exit(1); }
  // mapa header→índice (parse por NOME de coluna, não posição)
  const idxDe = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (c, i) => { idxDe[String(c.value).trim()] = i; });
  const col = (nomeCol) => {
    if (!(nomeCol in idxDe)) { console.error(`coluna "${nomeCol}" ausente na aba ${nome} (tem: ${Object.keys(idxDe).join(' | ')})`); process.exit(1); }
    return idxDe[nomeCol];
  };
  const linhas = [];
  ws.eachRow((row, n) => { if (n > 1 && texto(row, 1) !== '') linhas.push(row); });
  return { linhas, col };
}

// ── paleta ─────────────────────────────────────────────────────────────────────────────────
const paleta = await aba(resolve(paletaPath), 'Paleta_V2');
const foods = [];
for (const row of paleta.linhas) {
  const c = paleta.col;
  const idNum = numero(row, c('id'));
  const nome = texto(row, c('alimento (PT)'));
  const rotulo = texto(row, c('rotulo_amigavel'));
  const fonte = texto(row, c('fonte + id de origem'));
  const grupoPt = texto(row, c('grupo alimentar'));
  const alergsPt = texto(row, c('restrições / alérgenos'));

  if (!Number.isInteger(idNum)) { falhar(`paleta: id não-inteiro na linha "${nome}"`); continue; }
  if (!rotulo) falhar(`paleta a${idNum} ("${nome}"): rotulo_amigavel vazio`);
  const grupo = GRUPO[grupoPt];
  if (!grupo) falhar(`paleta a${idNum}: grupo desconhecido "${grupoPt}"`);
  // separadores mistos na planilha: vírgula E ponto-mediano ("lactose · origem animal")
  const alergenos = [...new Set(
    alergsPt.split(/[,·]/).map((s) => s.trim()).filter((s) => !SEM_ALERGENO.has(s)).map((s) => {
      if (!(s in ALERGENO)) { falhar(`paleta a${idNum}: alérgeno desconhecido "${s}"`); return null; }
      return ALERGENO[s];
    }).filter(Boolean),
  )].sort();
  const fonteTaco = fonte.match(/#(\d+)/)?.[1];

  const food = {
    id: `a${idNum}`,
    nome,
    rotuloAmigavel: rotulo,
    ...(fonteTaco ? { fonteTaco: Number(fonteTaco) } : {}),
    grupo,
    kcalPor100g: numero(row, c('kcal / 100 g'), { zeraNA: true }),
    proteinaPor100g: numero(row, c('proteína (g) / 100 g'), { zeraNA: true }),
    carboidratoPor100g: numero(row, c('carboidrato (g) / 100 g'), { zeraNA: true }),
    gorduraPor100g: numero(row, c('gordura (g) / 100 g'), { zeraNA: true }),
  };
  const fibra = numero(row, c('fibra (g) / 100 g (opc.)'));
  if (fibra != null) food.fibraPor100g = fibra;
  const medida = texto(row, c('medida caseira'));
  if (medida) food.medidaCaseira = medida;
  const gramasMedida = numero(row, c('gramas da medida (g)'));
  if (gramasMedida != null) food.gramasDaMedida = gramasMedida;
  food.alergenos = alergenos;
  foods.push(food);
}

// ── pratos ─────────────────────────────────────────────────────────────────────────────────
const pratos = await aba(resolve(pratosPath), 'Pratos_V2');
const ingredientes = await aba(resolve(pratosPath), 'Pratos_Ingredientes_V2');

const itensPorPrato = new Map();
let totalIng = 0;
for (const row of ingredientes.linhas) {
  const c = ingredientes.col;
  const pratoId = numero(row, c('prato_id'));
  const alimentoId = numero(row, c('alimento_id (paleta)'));
  const gramas = numero(row, c('gramas'), { zeraNA: true });
  const kcalLinha = numero(row, c('kcal no prato'));
  if (!Number.isInteger(pratoId) || !Number.isInteger(alimentoId)) { falhar(`ingredientes: ids inválidos na linha ${totalIng + 2}`); continue; }
  if (!(gramas > 0)) falhar(`ingredientes: gramas <= 0 no prato p${pratoId} (a${alimentoId})`);
  if (!itensPorPrato.has(pratoId)) itensPorPrato.set(pratoId, []);
  itensPorPrato.get(pratoId).push({ alimentoId: `a${alimentoId}`, gramas, kcalLinha });
  totalIng++;
}

const foodPorId = new Map(foods.map((f) => [f.id, f]));
const recipes = [];
const contagemTipos = { vegano: 0, vegetariano: 0, onivoro: 0 };
for (const row of pratos.linhas) {
  const c = pratos.col;
  const idNum = numero(row, c('id'));
  const nome = texto(row, c('prato'));
  const refeicaoPt = texto(row, c('refeição'));
  const tipoPt = texto(row, c('tipo'));
  const nIng = numero(row, c('nº ingredientes'));
  const macrosPlan = {
    kcal: numero(row, c('kcal'), { zeraNA: true }),
    proteinaG: numero(row, c('proteína (g)'), { zeraNA: true }),
    carboidratoG: numero(row, c('carboidrato (g)'), { zeraNA: true }),
    gorduraG: numero(row, c('gordura (g)'), { zeraNA: true }),
  };

  const refeicoes = refeicaoPt.split('/').map((s) => {
    const r = REFEICAO[s.trim()];
    if (!r) falhar(`prato p${idNum}: refeição desconhecida "${s.trim()}"`);
    return r;
  }).filter(Boolean);
  const tipo = TIPO[tipoPt];
  if (!tipo) { falhar(`prato p${idNum}: tipo desconhecido "${tipoPt}"`); continue; }
  contagemTipos[tipo]++;

  const itens = itensPorPrato.get(idNum) ?? [];
  if (itens.length === 0) falhar(`prato p${idNum} ("${nome}"): sem ingredientes no join`);
  if (nIng != null && itens.length !== nIng) falhar(`prato p${idNum}: nº ingredientes ${itens.length} ≠ coluna ${nIng}`);

  // Δ=0 + contemAlergenos RECOMPUTADOS (nunca confiados da planilha)
  const soma = { kcal: 0, proteinaG: 0, carboidratoG: 0, gorduraG: 0 };
  let somaKcalLinhas = 0;
  const alergSet = new Set();
  let temCarneOuPeixe = false;
  for (const it of itens) {
    const f = foodPorId.get(it.alimentoId);
    if (!f) { falhar(`prato p${idNum}: ref inválida ${it.alimentoId}`); continue; }
    const fator = it.gramas / 100;
    const kcalExata = f.kcalPor100g * fator;
    soma.kcal += kcalExata;
    soma.proteinaG += f.proteinaPor100g * fator;
    soma.carboidratoG += f.carboidratoPor100g * fator;
    soma.gorduraG += f.gorduraPor100g * fator;
    for (const a of f.alergenos) alergSet.add(a);
    // regra do autor (handoff §4): frios novos só têm "origem animal" → o que faz um prato
    // ser onívoro é ter ingrediente do GRUPO proteína animal que não seja OVO (ovo = veg).
    if (f.alergenos.includes('carne') || f.alergenos.includes('peixe_frutos_do_mar')
      || (f.grupo === 'proteina_animal' && !/^ovo\b/i.test(f.nome))) temCarneOuPeixe = true;
    // convenção da planilha: "kcal no prato" = valor da linha arredondado; o kcal do PRATO
    // é a Σ dessas linhas (validação do cofre: "kcal do prato = soma das linhas: 0 erros")
    if (it.kcalLinha != null) {
      if (Math.abs(it.kcalLinha - kcalExata) > 0.5 + 1e-6) {
        falhar(`kcal da linha ≠ paleta×gramas: p${idNum}/${it.alimentoId} linha ${it.kcalLinha} vs exato ${kcalExata.toFixed(2)}`);
      }
      somaKcalLinhas += it.kcalLinha;
    }
    delete it.kcalLinha; // não vai para o seed
  }
  // Δ=0 no contrato da planilha: kcal = Σ linhas arredondadas; macros = Σ exata arredondada a 1 casa
  if (Math.abs(macrosPlan.kcal - somaKcalLinhas) > 0.01) {
    falhar(`Δ≠0 p${idNum} kcal: planilha ${macrosPlan.kcal} vs Σ das linhas ${somaKcalLinhas.toFixed(2)}`);
  }
  for (const k of ['proteinaG', 'carboidratoG', 'gorduraG']) {
    if (Math.abs(macrosPlan[k] - soma[k]) > 0.05 + 1e-6) {
      falhar(`Δ≠0 p${idNum} ${k}: planilha ${macrosPlan[k]} vs Σ ${soma[k].toFixed(2)}`);
    }
  }
  // sanidade extra: a Σ exata não pode fugir da kcal da planilha além do ruído de arredondamento
  if (Math.abs(macrosPlan.kcal - soma.kcal) > 0.5 * itens.length + 1e-6) {
    falhar(`kcal exata fora do ruído p${idNum}: planilha ${macrosPlan.kcal} vs Σ exata ${soma.kcal.toFixed(2)}`);
  }
  // tipo recomputado deve bater com a planilha (grupo+nome, exceção do ovo — handoff §4)
  const tipoRecalc = !alergSet.has('origem_animal') ? 'vegano' : temCarneOuPeixe ? 'onivoro' : 'vegetariano';
  if (tipoRecalc !== tipo) falhar(`tipo divergente p${idNum} ("${nome}"): planilha ${tipo} vs recomputado ${tipoRecalc}`);

  recipes.push({ id: `p${idNum}`, nome, refeicoes, tipo, itens, contemAlergenos: [...alergSet].sort() });
}

// ── validações globais ─────────────────────────────────────────────────────────────────────
if (foods.length !== ESPERADO.foods) falhar(`contagem de alimentos: ${foods.length} ≠ ${ESPERADO.foods}`);
if (recipes.length !== ESPERADO.recipes) falhar(`contagem de pratos: ${recipes.length} ≠ ${ESPERADO.recipes}`);
if (totalIng !== ESPERADO.ingredientes) falhar(`linhas de ingrediente: ${totalIng} ≠ ${ESPERADO.ingredientes}`);
for (const t of Object.keys(ESPERADO.tipos)) {
  if (contagemTipos[t] !== ESPERADO.tipos[t]) falhar(`tipo ${t}: ${contagemTipos[t]} ≠ ${ESPERADO.tipos[t]}`);
}
const dupla = (arr, rotulo) => {
  const vistos = new Set();
  for (const x of arr) { if (vistos.has(x)) falhar(`${rotulo} duplicado: ${x}`); vistos.add(x); }
};
dupla(foods.map((f) => f.id), 'id de alimento');
dupla(recipes.map((r) => r.id), 'id de prato');
dupla(foods.map((f) => normalizar(f.rotuloAmigavel ?? '')), 'rótulo amigável (normalizado)');
for (const f of foods) {
  // Atwater: kcal ≈ 4P + 4C + 9G — pega TROCA DE COLUNA carb↔gordura (desvio absoluto grande).
  // Piso absoluto de 25 kcal: hortaliças/frutas de baixa kcal desviam poucos kcal do 4/4/9
  // (energia metabolizável da TACO conta fibra ≈ 2 kcal/g) — é dado legítimo, não erro
  // (os mesmos valores já estavam no seed v1; cofre: "0 outliers FORTES").
  const atwater = 4 * f.proteinaPor100g + 4 * f.carboidratoPor100g + 9 * f.gorduraPor100g;
  const desvio = Math.abs(f.kcalPor100g - atwater);
  if (f.kcalPor100g > 0 && desvio > Math.max(0.12 * f.kcalPor100g, 25)) {
    falhar(`Atwater fora (±12% e >25 kcal): ${f.id} "${f.nome}" (kcal ${f.kcalPor100g} vs 4/4/9 = ${atwater.toFixed(0)})`);
  }
}

// round-trip advisory vs seed atual (planilha é a fonte de verdade; diffs são informativos)
try {
  const atual = readFileSync(resolve(RAIZ, 'src/lib/data/foods.ts'), 'utf8');
  for (const f of foods) {
    const m = atual.match(new RegExp(`"id": "${f.id}"[\\s\\S]*?"kcalPor100g": ([\\d.]+),\\n\\s*"proteinaPor100g": ([\\d.]+)`));
    if (m && (Number(m[1]) !== f.kcalPor100g || Number(m[2]) !== f.proteinaPor100g)) {
      avisos.push(`${f.id} mudou vs seed atual: kcal ${m[1]}→${f.kcalPor100g} · P ${m[2]}→${f.proteinaPor100g}`);
    }
  }
} catch { /* primeiro uso */ }

if (erros.length) {
  console.error(`\n✗ ${erros.length} erro(s) — NADA foi escrito:\n` + erros.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

// ── emissão (estilo idêntico ao v1: floats com decimal, chaves citadas, 2 espaços) ─────────
const FLOATS = new Set(['kcalPor100g', 'proteinaPor100g', 'carboidratoPor100g', 'gorduraPor100g', 'fibraPor100g', 'gramasDaMedida', 'gramas']);
const num = (k, v) => {
  const limpo = Math.round(v * 1000) / 1000; // mata ruído de float do xlsx
  return FLOATS.has(k) && Number.isInteger(limpo) ? `${limpo}.0` : String(limpo);
};
function imprimir(obj, indent) {
  const pad = ' '.repeat(indent);
  const linhas = Object.entries(obj).map(([k, v]) => {
    if (Array.isArray(v)) {
      if (v.length === 0) return `${pad}"${k}": []`;
      const itens = v.map((x) => typeof x === 'object'
        ? imprimir(x, indent + 4)
        : `${' '.repeat(indent + 2)}${JSON.stringify(x)}`).join(',\n');
      return `${pad}"${k}": [\n${itens}\n${pad}]`;
    }
    if (typeof v === 'number') return `${pad}"${k}": ${num(k, v)}`;
    return `${pad}"${k}": ${JSON.stringify(v)}`;
  });
  return `${' '.repeat(indent - 2)}{\n${linhas.join(',\n')}\n${' '.repeat(indent - 2)}}`;
}
const cabecalho = (tipo) => `/**
 * GERADO a partir dos dados do autor (xlsx) — NÃO editar à mão. Regenerar:
 *   node scripts/gerar-seed.mjs <paleta-V2-limpa.xlsx> <pratos-V2.xlsx>
 * Fonte: cofre (banco-alimentos V2 limpa + pratos V2, 2026-07-01). Validado Δ=0
 * (167 alimentos · 107 pratos · 404 ingredientes · tipos 46/29/32 · Atwater ≤12%).
 */
import type { ${tipo} } from './types';

`;
const corpo = (arr) => arr.map((o) => imprimir(o, 4)).join(',\n');
writeFileSync(resolve(RAIZ, 'src/lib/data/foods.ts'), `${cabecalho('Food')}export const FOODS: Food[] = [\n${corpo(foods)}\n];\n`);
writeFileSync(resolve(RAIZ, 'src/lib/data/recipes.ts'), `${cabecalho('Recipe')}export const RECIPES: Recipe[] = [\n${corpo(recipes)}\n];\n`);

console.log(`✓ seed gerado: ${foods.length} alimentos · ${recipes.length} pratos · ${totalIng} ingredientes`);
console.log(`  tipos: vegano ${contagemTipos.vegano} · vegetariano ${contagemTipos.vegetariano} · onívoro ${contagemTipos.onivoro}`);
if (avisos.length) console.log(`  avisos (dados que mudaram vs seed anterior — planilha manda):\n` + avisos.map((a) => `    · ${a}`).join('\n'));
