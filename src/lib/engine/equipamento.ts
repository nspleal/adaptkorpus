/**
 * Disponibilidade de exercício — modelo de equipamento "2 NÍVEIS" (DF 2026-07-04, cofre
 * log "modelo de equipamento: 2 níveis"). Substitui a leitura grossa de 3 níveis:
 *
 *   - `academia`  → tudo liberado (como antes);
 *   - `casa`      → `casa_sem` SEMPRE + `casa_com` quando `equipamentoExigido ⊆
 *                   equipamentosCasa` (checklist do perfil); `academia` (local) NUNCA;
 *   - `nenhum`    → LEGADO aceito em runtime ≡ casa + checklist vazio (só `casa_sem`).
 *
 * Retrocompat: `equipamentosCasa === undefined` (chamadas antigas) preserva o
 * comportamento anterior de `casa` = todo `casa_com` liberado. O checklist vazio (`[]`)
 * é a leitura NOVA e estrita — e é byte-idêntica ao antigo `nenhum` (invariante testada).
 * Filtro DURO: nunca relaxado (F.2 §2 #1). Puro e determinístico.
 */
import type { EquipamentoCasa, EquipamentoDisp, Exercise } from '../data/types';
import { repUnitDe } from './isometricos';

/** Os 7 do vocabulário (ordem estável p/ UI). Barbell fora de propósito (≈ academia). */
export const EQUIPAMENTOS_CASA: readonly EquipamentoCasa[] = [
  'halteres', 'barra_fixa', 'elastico', 'banco', 'kettlebell', 'corda_pular', 'roda_abdominal',
];

export const ROTULO_EQUIPAMENTO_CASA: Record<EquipamentoCasa, string> = {
  halteres: 'Halteres',
  barra_fixa: 'Barra fixa',
  elastico: 'Elástico',
  banco: 'Banco',
  kettlebell: 'Kettlebell',
  corda_pular: 'Corda de pular',
  roda_abdominal: 'Roda abdominal',
};

/**
 * O exercício está disponível para este perfil de equipamento?
 * `equipamentosCasa`: checklist do modelo novo; `undefined` = chamada legada (casa antiga).
 */
export function exercicioDisponivel(
  ex: Pick<Exercise, 'local' | 'equipamentoExigido' | 'equipamentoExigidoQualquerUm'>,
  equipamento: EquipamentoDisp,
  equipamentosCasa?: readonly EquipamentoCasa[],
): boolean {
  if (equipamento === 'academia') return true;
  if (equipamento === 'nenhum') return ex.local === 'casa_sem'; // legado ≡ casa + []
  // equipamento === 'casa'
  if (ex.local === 'academia') return false;
  if (ex.local === 'casa_sem') return true;
  if (equipamentosCasa === undefined) return true; // legado: casa = todo casa_com
  const exigido = ex.equipamentoExigido;
  const qualquerUm = ex.equipamentoExigidoQualquerUm;
  if (!exigido && !qualquerUm) return false; // casa_com sem curadoria → fail-closed
  // E (⊆): todos os exigidos marcados; ANY-OF (V8.5): algum da lista alternativa marcado.
  const eOk = !exigido || exigido.every((eq) => equipamentosCasa.includes(eq));
  const ouOk = !qualquerUm || qualquerUm.length === 0 || qualquerUm.some((eq) => equipamentosCasa.includes(eq));
  return eOk && ouOk;
}

/* ════════════════ Improviso doméstico × academia ════════════════ */

/**
 * 🔵 IMPROVISO DOMÉSTICO — o exercício existe só para quem não tem equipamento nenhum e
 * monta o aparelho com móvel da casa (relato 2026-09-19: um treino de ACADEMIA recebeu
 * *"Remada invertida com cabo de vassoura"* ao lado de máquinas e polias).
 *
 * 🔒 A MARCA JÁ EXISTE NO CATÁLOGO, e não é inventada aqui: `local: 'casa_sem'` (cenário
 * doméstico sem equipamento) MAIS a anotação de montagem entre parênteses em
 * `equipamentoDetalhe` — a mesma convenção que `RE_PESO_CORPORAL` documenta logo abaixo,
 * onde o parêntese "descreve COMO montar o exercício, não carga externa". Hoje são sete:
 * apoio no sofá, 2 cadeiras firmes, mesa firme, mesa firme + cadeira, cabo de vassoura.
 *
 * ⚠️ NÃO é "peso corporal". `Peso corporal` puro (flexão, barra fixa, paralelas, prancha,
 * agachamento livre) continua inteiro — peso corporal não é improviso nem é inferior; o que
 * sai é a IMPROVISAÇÃO DO APARELHO, que na academia tem o equipamento de verdade no lugar.
 * `Peso corporal / Halteres` também fica: ali a carga externa é alternativa legítima.
 */
export function ehImprovisoDomestico(ex: Pick<Exercise, 'local' | 'equipamentoDetalhe'>): boolean {
  return ex.local === 'casa_sem' && /^Peso corporal \(.*\)$/.test(ex.equipamentoDetalhe ?? '');
}

/**
 * O exercício serve à SELEÇÃO AUTOMÁTICA deste equipamento? Filtro do motor quando é ELE que
 * escolhe — geração, complementares, cobertura, exceções e fallbacks. Na academia exclui o
 * improviso doméstico; nos demais perfis não tira nada.
 *
 * 🔒 Separado de `exercicioDisponivel` de propósito: elegibilidade (o que a pessoa PODE ter
 * no plano, inclusive por escolha manual) e seleção automática (o que o app escolhe sozinho)
 * são perguntas diferentes. Juntá-las apagaria do desenho manual um exercício que a pessoa
 * pôs ali de propósito.
 */
export function servePelaSelecaoAutomatica(
  ex: Pick<Exercise, 'local' | 'equipamentoDetalhe'>,
  equipamento: EquipamentoDisp,
): boolean {
  return equipamento !== 'academia' || !ehImprovisoDomestico(ex);
}

/* ════════════════════ Predicado de CARGA ════════════════════ */

/**
 * 🔒 FONTE ÚNICA do "esse exercício tem carga externa?" (Leva A, DF 2026-07-31).
 *
 * Estava em **4 cópias inline**, em **2 variantes**: `treino-montador.ts` (retomada),
 * `treino.ts` (progressão), `SessaoTreino.tsx` e `RegistrarTreino.tsx`. Quatro lugares que
 * decidem a mesma coisa é quatro lugares para divergir — foi assim que a 9ª chave de
 * `localStorage` apareceu, e a lição vale igual aqui.
 *
 * ⚠️ **As duas variantes NÃO se colapsam.** A diferença é real: um isométrico com carga
 * (prancha com anilha) **tem** carga, mas não tem carga **progressível** — a progressão dele
 * é em SEGUNDOS (±5 s), não em quilos. Unificar mudaria o comportamento de exatamente um dos
 * quatro pontos (`treino-montador.ts:292`, que computa o IRV da retomada e precisa da
 * leitura crua), **em silêncio**. Por isso são duas funções, a segunda derivada da primeira.
 */

/**
 * "Peso corporal" pura — sozinha OU com uma ANOTAÇÃO de setup entre parênteses
 * (`Peso corporal (mesa firme)`, `(2 cadeiras firmes)`, `(cabo de vassoura)`). O parêntese
 * descreve COMO montar o exercício, não carga externa — não se progride em quilos numa
 * remada na mesa; progride-se por variação (a escada) ou reps.
 * 🔴 NÃO cobre `Peso corporal / Halteres` (a barra é ALTERNATIVA com carga — `e17`/`e152`):
 * esses aceitam quilo de verdade e continuam `temCarga = true`.
 */
const RE_PESO_CORPORAL = /^Peso corporal( \(.*\))?$/;

/**
 * Tem carga externa? A leitura crua do equipamento — sem olhar a unidade de repetição.
 * 🔒 Relação ESTRUTURAL, não igualdade (DF do autor 2026-08-15): a igualdade
 * `!== 'Peso corporal'` dava falso-positivo para `Peso corporal (mesa firme)` e punha 7
 * exercícios de puro peso corporal em `modo='carga'` — o app oferecia +peso onde não há
 * peso. Ver guard `temCarga com anotação`.
 */
export function temCarga(ex: Exercise): boolean {
  return !RE_PESO_CORPORAL.test(ex.equipamentoDetalhe ?? '');
}

/**
 * Tem carga que a PROGRESSÃO move em quilos? Exclui o isométrico: ele progride em segundos
 * (`INCREMENTO_SEG`), então tratá-lo como "modo carga" faria a dupla progressão empurrar
 * quilo num exercício que registra tempo.
 */
export function temCargaProgressivel(ex: Exercise): boolean {
  return temCarga(ex) && repUnitDe(ex.id) !== 'segundos';
}
