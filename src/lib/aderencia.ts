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

/** Dia ISO calendário `offset` dias ANTES de `diaISO` (aritmética em UTC-midnight, então
 *  independente de fuso — opera direto sobre a data-calendário). */
function diaAnteriorISO(diaISO: string, offset: number): string {
  const base = Date.parse(`${diaISO}T00:00:00Z`);
  return new Date(base - offset * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Streak de aderência: dias CONSECUTIVOS (de hoje p/ trás) em que ≥ `limiarAderencia(total)`
 * refeições seguiram o plano. É um conceito GLOBAL — não pode ser limitado pela janela
 * visível (bug: mostrava 7 na aba Semana e 11 na aba Mês). Caminha até o 1º furo (dia sem
 * registro OU abaixo do limiar), com teto `maxDias` de segurança.
 *
 * `contagemNoDia(diaISO)` devolve quantas refeições seguiram nesse dia, ou `null` se o dia
 * não tem registro algum (quebra a sequência). Puro e determinístico.
 */
export function streakAderencia(
  hojeISO: string,
  contagemNoDia: (diaISO: string) => number | null,
  total: number,
  maxDias = 400,
): number {
  const limiar = limiarAderencia(total);
  let streak = 0;
  for (let i = 0; i < maxDias; i++) {
    const cnt = contagemNoDia(diaAnteriorISO(hojeISO, i));
    if (cnt === null || cnt < limiar) break;
    streak++;
  }
  return streak;
}

/**
 * Faixa de "calor" do dia no calendário (0 vazio → 4 dia cheio), PROPORCIONAL ao plano —
 * antes travada em `cnt >= 4`, o que impedia um plano de 3 refeições de atingir o tier
 * máximo. `cnt >= total` → 4 (dia cheio); parciais distribuídos em 1..3. Determinístico.
 */
export function faixaTint(cnt: number, total: number): 0 | 1 | 2 | 3 | 4 {
  if (cnt <= 0 || total <= 0) return 0;
  if (cnt >= total) return 4;
  const t = 1 + Math.floor((cnt * 3) / total);
  return Math.min(3, Math.max(1, t)) as 1 | 2 | 3;
}
