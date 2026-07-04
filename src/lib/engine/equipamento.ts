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
  ex: Pick<Exercise, 'local' | 'equipamentoExigido'>,
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
  if (!exigido) return false; // casa_com sem curadoria → indisponível (fail-closed)
  return exigido.every((eq) => equipamentosCasa.includes(eq));
}
