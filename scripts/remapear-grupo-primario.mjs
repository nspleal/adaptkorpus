/**
 * Remapeia `grupoPrimario` para o vocabulário de 12 valores ANATÔMICOS
 * (cofre `parametros-motor-treino-evokorpus` §Frequência por grupo — DF 2026-07-27,
 * destinos de `trapezio`/`adutores` RATIFICADOS em 2026-07-28).
 *
 * O campo vira NULLABLE: `cardio` (5) e `corpo-inteiro` (7) saem da anatomia — são **tipo**,
 * que já existe como campo próprio — e passam a contar só pelo padrão de movimento.
 *
 * Edita por âncora (`"id": "eN"`), preserva o resto byte a byte, e é IDEMPOTENTE: rodar de
 * novo não muda nada (os valores já remapeados não casam com nenhuma regra de origem).
 *
 * Uso: node scripts/remapear-grupo-primario.mjs [--check]
 *   --check  não escreve; só relata o diff (usado para conferir antes de aplicar).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ALVO = new URL('../src/lib/data/exercises.ts', import.meta.url).pathname;
const CHECK = process.argv.includes('--check');

/** Valores finais permitidos (12) — nada fora daqui pode sobrar no catálogo. */
export const VOCABULARIO = [
  'peito', 'costas', 'ombros', 'biceps', 'triceps', 'antebraco',
  'core', 'lombar', 'gluteos', 'quadriceps', 'posterior', 'panturrilha',
];

/** Regra 1 — por GRUPO de origem (vale para todo exercício que o tenha). */
const POR_GRUPO = {
  abdomen: 'core',          // `core` absorve: a fronteira nunca foi documentada
  cardio: null,             // não é grupo muscular — é tipo
  'corpo-inteiro': null,    // idem
};

/** Regra 2 — por EXERCÍCIO (absorções e a dissolução de `pernas`, ratificadas). */
const POR_ID = {
  e97: 'costas',       // Encolhimento (trapézio) — o campo é anatomia, não colocação de split
  e129: 'gluteos',     // Cadeira adutora — a máquina isola em adução, não em extensão
  e143: 'quadriceps',  // Avanço com salto — padrão agachar, quadríceps-dominante
  e163: 'quadriceps',  // Agachamento com salto — idem
  // e151 Patinador: proposto `gluteos` (glúteo médio é o motor do plano frontal) e
  // RE-RATIFICADO em `quadriceps` (2026-07-28) quando o catálogo mostrou o custo — ele é o
  // ÚNICO pliométrico com padrão `cardio`, e separá-lo do Avanço/Agachamento com salto o
  // deixava sem grupo NEM padrão em comum: 6 vazios novos na substituição, contra a
  // invariante travada de "EXATAMENTE 3 (o furo do e116), igual ao motor standalone".
  // Salto unilateral lateral: o quadríceps faz propulsão e aterrissagem junto com o glúteo.
  e151: 'quadriceps',
};

let out = readFileSync(ALVO, 'utf8');
const blocos = [...out.matchAll(/"id": "(e\d+)",[\s\S]*?"grupoPrimario": (?:"([^"]+)"|null)/g)];
if (blocos.length !== 163) {
  console.error(`FALHA: casei ${blocos.length} exercícios (esperado 163). Nada foi escrito.`);
  process.exit(1);
}

const diff = [];
for (const m of blocos) {
  const [, id, atual] = m;
  if (atual == null) continue;                       // já nulo (idempotência)
  const novo = id in POR_ID ? POR_ID[id] : (atual in POR_GRUPO ? POR_GRUPO[atual] : atual);
  if (novo === atual) continue;
  diff.push({ id, de: atual, para: novo });
  // Substitui SÓ dentro do bloco deste id.
  const anchor = `"id": "${id}",`;
  const start = out.indexOf(anchor);
  const prox = out.indexOf('"id": "e', start + anchor.length);
  const fim = prox === -1 ? out.length : prox;
  const bloco = out.slice(start, fim);
  const trocado = bloco.replace(`"grupoPrimario": "${atual}"`, `"grupoPrimario": ${novo === null ? 'null' : `"${novo}"`}`);
  if (trocado === bloco) {
    console.error(`FALHA: não achei grupoPrimario de ${id}. Nada foi escrito.`);
    process.exit(1);
  }
  out = out.slice(0, start) + trocado + out.slice(fim);
}

// Verificação final: nenhum valor fora do vocabulário de 12 (null é permitido).
const finais = [...out.matchAll(/"grupoPrimario": (?:"([^"]+)"|null)/g)];
const fora = [...new Set(finais.map((m) => m[1]).filter((g) => g != null && !VOCABULARIO.includes(g)))];
if (fora.length > 0) {
  console.error(`FALHA: valores fora do vocabulário: ${fora.join(', ')}. Nada foi escrito.`);
  process.exit(1);
}

const nulos = finais.filter((m) => m[1] == null).length;
const dist = {};
for (const m of finais) if (m[1] != null) dist[m[1]] = (dist[m[1]] ?? 0) + 1;

console.log(`${diff.length} exercícios mudam de valor · ${nulos} ficam null · ${finais.length - nulos} com grupo`);
for (const d of diff) console.log(`  ${d.id.padEnd(5)} ${d.de.padEnd(13)} → ${d.para ?? 'null'}`);
console.log('\ndistribuição final:');
for (const g of VOCABULARIO) console.log(`  ${g.padEnd(12)} ${String(dist[g] ?? 0).padStart(3)}`);

if (CHECK) { console.log('\n--check: nada foi escrito.'); process.exit(0); }
writeFileSync(ALVO, out);
console.log('\nescrito em src/lib/data/exercises.ts');
