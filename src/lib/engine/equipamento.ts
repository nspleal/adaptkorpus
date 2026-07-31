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

/** Tem carga externa? A leitura crua do equipamento — sem olhar a unidade de repetição. */
export function temCarga(ex: Exercise): boolean {
  return (ex.equipamentoDetalhe ?? '') !== 'Peso corporal';
}

/**
 * Tem carga que a PROGRESSÃO move em quilos? Exclui o isométrico: ele progride em segundos
 * (`INCREMENTO_SEG`), então tratá-lo como "modo carga" faria a dupla progressão empurrar
 * quilo num exercício que registra tempo.
 */
export function temCargaProgressivel(ex: Exercise): boolean {
  return temCarga(ex) && repUnitDe(ex.id) !== 'segundos';
}
