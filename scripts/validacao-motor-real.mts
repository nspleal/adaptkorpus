/**
 * Validação do motor de exercícios contra os DADOS REAIS do app (exercises.ts, 163).
 * Espelha o harness standalone do autor (validacao-motor.ts), mas aponta para:
 *   - as ESCADAS integradas (src/lib/engine/escadas.ts) — mecânica travada nova;
 *   - a SUBSTITUIÇÃO que o app JÁ tem (src/lib/engine/substituicao.ts) — mesma spec F.2.
 * Roda: `npx tsx scripts/validacao-motor-real.mts`
 */
import { EXERCISES } from '../src/lib/data/exercises.ts';
import {
  ESCADAS_DIFICULDADE, sugerirProximaVariacao, sugerirVariacaoAnterior, posicaoNaEscada,
} from '../src/lib/engine/escadas.ts';
import { substituirExercicio, listarSubstituicoesExercicio } from '../src/lib/engine/substituicao.ts';
import { locaisPermitidos } from '../src/lib/engine/treino-montador.ts';
import type { EquipamentoDisp } from '../src/lib/data/types.ts';
import { FAMILIAS } from '../src/lib/engine/familias.ts';


const byId = new Map(EXERCISES.map((e) => [e.id, e]));
const nome = (id: string) => `${id} ${byId.get(id)?.nomePt ?? '???'}`;
let falhas = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) falhas++;
};

console.log(`\n═══ DADOS REAIS: ${EXERCISES.length} exercícios (esperado 163) ═══`);
check(EXERCISES.length === 163, '163 exercícios na biblioteca real');

// ── Escadas (mecânica travada nova) contra dados reais ──────────────────────
console.log('\n═══ ESCADAS — integridade contra a biblioteca real ═══');
let ok = true;
const comImplemento: string[] = [];
for (const [escada, degraus] of Object.entries(ESCADAS_DIFICULDADE))
  for (const d of degraus) for (const id of d) {
    const e = byId.get(id);
    if (!e) { ok = false; console.log(`  ❌ ${escada}: ${id} não existe`); }
    else if (e.local !== 'casa_sem') comImplemento.push(`${escada}: ${nome(id)} [${e.local}]`);
  }
check(ok, 'todos os ids das escadas existem na biblioteca real');
const ids = Object.values(ESCADAS_DIFICULDADE).flat(2);
check(new Set(ids).size === ids.length, 'nenhum exercício em duas escadas');
check(ids.length === 38, `malha travada cobre ${ids.length} exercícios (doc-prosa diz 35 — nit reportado)`);
console.log('   degraus com implemento (hint respeita equipamento):');
for (const c of comImplemento) console.log('     ·', c);
check(comImplemento.length === 5, '5 degraus com implemento');

console.log('\n═══ ESCADAS — hints (cofre C6) sobre dados reais ═══');
check(JSON.stringify(sugerirProximaVariacao('e1')) === '["e113"]', 'e1 Flexão → e113 Diamante');
check(JSON.stringify(sugerirProximaVariacao('e16')) === '["e78"]', 'e16 Afundo → e78 Búlgaro (degrau agrupado)');
check(sugerirProximaVariacao('e145') === null, 'e145 Pistol = topo → sem hint');
check(sugerirProximaVariacao('e9') === null, 'e9 Supino (carga) fora da malha → sem hint');
check(JSON.stringify(sugerirVariacaoAnterior('e83')) === '["e86"]', 'regressão e83 Nórdica → e86');
check(JSON.stringify(posicaoNaEscada('e1')) === '{"degrau":3,"total":6,"escada":"empurrarHorizontal"}', 'e1 = degrau 3 de 6');
check(sugerirProximaVariacao('e116', EXERCISES, 'nenhum') === null, 'e116 casa-sem: chin-up exige barra → sem hint');
check(JSON.stringify(sugerirProximaVariacao('e116', EXERCISES, 'casa')) === '["e22"]', 'e116 casa → e22 chin-up');

// ── Substituição REAL (app substituicao.ts) — cenários do autor ─────────────
const troca = (atualId: string, eq: EquipamentoDisp, nivel: 'iniciante'|'intermediario'|'avancado', n = 3) => {
  const atual = byId.get(atualId)!;
  return listarSubstituicoesExercicio(
    { exercicioAtual: atual, equipamento: eq, nivelExperiencia: nivel, exercises: EXERCISES }, n,
  ).map((r) => r.exercicio!.id);
};

console.log('\n═══ SUBSTITUIÇÃO REAL (app) — C1: iniciante · nenhum · troca e1 Flexão ═══');
const r1 = troca('e1', 'nenhum', 'iniciante');
console.log('   →', r1.map(nome).join(' · ') || '(vazio)');
check(r1.length > 0, 'devolve sugestões (não vazio)');
check(r1.every((id) => byId.get(id)!.local === 'casa_sem' && byId.get(id)!.nivel === 'iniciante'),
  'todas casa_sem + iniciante (filtros duros)');

console.log('\n═══ SUBSTITUIÇÃO REAL — C2: intermediário · academia · troca e9 Supino reto ═══');
const r2 = troca('e9', 'academia', 'intermediario', 5);
console.log('   →', r2.map(nome).join(' · ') || '(vazio)');
check(!r2.some((id) => byId.get(id)!.nivel === 'avancado'), 'nenhum avançado (dificuldade ≤ liberada)');
check(r2.join(',') === 'e11,e15,e10,e12,e13',
  'FAMÍLIAS LIGADAS (DF 2026-07-04): supino-horizontal primeiro (e11, e15), depois inclinados');

console.log('\n═══ SUBSTITUIÇÃO REAL — C3: intermediário · nenhum · troca e151 Skater ═══');
const r3 = troca('e151', 'nenhum', 'intermediario', 4);
console.log('   →', r3.map(nome).join(' · ') || '(vazio)');
check(r3.every((id) => byId.get(id)!.padraoMovimento === 'cardio' || byId.get(id)!.tipo === 'pliometrico'),
  'só padrão cardio ou pliométrico (refino skater)');

console.log('\n═══ SUBSTITUIÇÃO REAL — C4: iniciante · nenhum · troca e116 Remada invertida ═══');
const r4 = troca('e116', 'nenhum', 'iniciante');
console.log('   →', r4.map(nome).join(' · ') || '(vazio)');
check(r4.length === 0, 'FILTRO DURO LIGADO (DF 2026-07-04): e116 → VAZIO sinalizado honesto');

// ── Determinismo ────────────────────────────────────────────────────────────
console.log('\n═══ Determinismo (mesma entrada 100×) ═══');
const base = JSON.stringify(troca('e9', 'academia', 'intermediario', 5));
let det = true;
for (let i = 0; i < 100; i++) if (JSON.stringify(troca('e9', 'academia', 'intermediario', 5)) !== base) det = false;
check(det, '100 execuções → saída idêntica');

// ── Robustez: varredura 163 × 3 níveis × 3 equipamentos ─────────────────────
console.log('\n═══ Robustez: 163 × 3 níveis × 3 equipamentos ═══');
const vazios: string[] = [];
for (const e of EXERCISES)
  for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
    for (const eq of ['nenhum', 'casa', 'academia'] as const) {
      if (!locaisPermitidos(eq).includes(e.local)) continue; // usuário nem vê o exercício
      const r = substituirExercicio({ exercicioAtual: e, equipamento: eq, nivelExperiencia: nivel, exercises: EXERCISES });
      if (r.status === 'sinalizado') vazios.push(`${nome(e.id)} [${nivel}·${eq}]`);
    }
console.log(`   combinações sem candidato: ${vazios.length}`);
for (const v of vazios.slice(0, 15)) console.log('     ·', v);
// Assert DURO de propósito: quando o conteúdo 164+ (puxar casa-sem) chegar, isto quebra
// e força revisão — o furo deve SUMIR, não crescer.
check(vazios.length === 3 && vazios.every((v) => v.startsWith('e116 ')),
  'EXATAMENTE 3 vazios = o furo conhecido do e116 (igual ao motor standalone)');

// ── Famílias (proposta dormente) — cobertura contra dados reais ─────────────
console.log('\n═══ FAMÍLIAS (engine — aprovadas DF 2026-07-04) — cobertura ═══');
let famOk = true;
for (const [fam, fids] of Object.entries(FAMILIAS))
  for (const id of fids) if (!byId.has(id)) { famOk = false; console.log(`  ❌ ${fam}: ${id} não existe`); }
check(famOk, 'todos os ids das 20 famílias existem na biblioteca real');
const cobertos = new Set(Object.values(FAMILIAS).flat());
console.log(`   famílias cobrem ${cobertos.size} exercícios distintos`);

console.log(`\n${'═'.repeat(60)}`);
console.log(falhas === 0 ? '✅ TODAS as checagens passaram' : `❌ ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
