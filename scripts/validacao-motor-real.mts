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

// FAMÍLIAS_PROPOSTA fica FORA do engine (é proposta dormente — precisa DF do autor).
// Inlined aqui só para validar cobertura contra os dados reais. IDs no formato "eN".
const FAMILIAS_PROPOSTA: Record<string, string[]> = {
  flexao: ['e157', 'e156', 'e1', 'e113', 'e2', 'e100'],
  'supino-horizontal': ['e15', 'e11', 'e9'],
  'supino-inclinado': ['e12', 'e10'],
  desenvolvimento: ['e43', 'e44', 'e42', 'e41', 'e111', 'e155'],
  'remada-horizontal': ['e47', 'e48', 'e46', 'e162', 'e120', 'e84', 'e45', 'e154'],
  'puxada-vertical': ['e49', 'e50', 'e51'],
  'barra-fixa': ['e116', 'e22', 'e21'],
  'agachamento-bilateral': ['e3', 'e33', 'e34', 'e28', 'e141', 'e32', 'e121'],
  afundo: ['e16', 'e160', 'e17', 'e18', 'e79', 'e61', 'e78', 'e143'],
  'ponte-hip-thrust': ['e57', 'e58', 'e59', 'e161', 'e153'],
  'stiff-terra': ['e80', 'e81', 'e82', 'e26', 'e27', 'e117'],
  'flexora-posterior': ['e64', 'e65', 'e66', 'e87', 'e86', 'e123'],
  'rosca-biceps': ['e19', 'e20', 'e72', 'e74', 'e75', 'e77', 'e112', 'e122', 'e124', 'e76', 'e136'],
  'triceps-extensao': ['e68', 'e69', 'e71', 'e133', 'e134', 'e67', 'e135', 'e40'],
  'elevacao-lateral': ['e52', 'e53', 'e54'],
  'crucifixo-peito': ['e14', 'e55', 'e130', 'e131', 'e132', 'e56'],
  'crucifixo-invertido': ['e106', 'e107', 'e119'],
  'panturrilha-em-pe': ['e36', 'e37', 'e38', 'e39'],
  'abdominal-flexao': ['e4', 'e5', 'e6', 'e149', 'e159'],
  'cardio-continuo': ['e24', 'e29', 'e31', 'e93'],
};

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
console.log('   ACHADO (motiva FAMÍLIAS): 1ª sugestão =', nome(r2[0] ?? '—'),
  '— com grupoMuscular por texto-livre o resultado difere do motor normalizado.');

console.log('\n═══ SUBSTITUIÇÃO REAL — C3: intermediário · nenhum · troca e151 Skater ═══');
const r3 = troca('e151', 'nenhum', 'intermediario', 4);
console.log('   →', r3.map(nome).join(' · ') || '(vazio)');
check(r3.every((id) => byId.get(id)!.padraoMovimento === 'cardio' || byId.get(id)!.tipo === 'pliometrico'),
  'só padrão cardio ou pliométrico (refino skater)');

console.log('\n═══ SUBSTITUIÇÃO REAL — C4: iniciante · nenhum · troca e116 Remada invertida ═══');
const r4 = troca('e116', 'nenhum', 'iniciante');
console.log('   →', r4.map(nome).join(' · ') || '(vazio)');
console.log('   ⚠️ DIVERGÊNCIA-CHAVE: o motor sinalizaria VAZIO (único puxar casa-sem INI).');
console.log('   O app devolve exercícios que NÃO preservam grupo NEM padrão (empurrar/agachar) —');
console.log('   substituicao.ts usa preservação só como desempate no sort, não como filtro DURO.');
console.log('   Causa raiz: `grupoMuscular` é texto-livre composto; o app não tem grupo PRIMÁRIO');
console.log('   normalizado que a trava F.2 §2 exige. → decisão de dados/autor (ver relatório).');

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
check(vazios.length < 15, 'degradações totais raras e conhecidas (pontos magros do doc)');

// ── Famílias (proposta dormente) — cobertura contra dados reais ─────────────
console.log('\n═══ FAMÍLIAS_PROPOSTA — cobertura (dormente, precisa DF) ═══');
let famOk = true;
for (const [fam, fids] of Object.entries(FAMILIAS_PROPOSTA))
  for (const id of fids) if (!byId.has(id)) { famOk = false; console.log(`  ❌ ${fam}: ${id} não existe`); }
check(famOk, 'todos os ids das 20 famílias existem na biblioteca real');
const cobertos = new Set(Object.values(FAMILIAS_PROPOSTA).flat());
console.log(`   famílias cobrem ${cobertos.size} exercícios distintos`);

console.log(`\n${'═'.repeat(60)}`);
console.log(falhas === 0 ? '✅ TODAS as checagens passaram' : `❌ ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
