/**
 * Aderência (dieta) — limiar do streak PROPORCIONAL ao plano do dia.
 * Fonte TRAVADA: cofre `conceitos/registro-de-aderencia-evokorpus` (DF 2026-07-04):
 * um dia conta para a sequência quando ≥ ¾ das refeições do plano foram seguidas,
 * ARREDONDADO ("3 fixo" rejeitado: num plano de 3 refeições seria exigir 100%).
 * Ex.: 3 refeições → 2 · 4 → 3 · 5 → 4. Puro e determinístico.
 */
export function limiarAderencia(totalRefeicoes: number): number {
  return Math.max(1, Math.round(totalRefeicoes * 0.75));
}
