/**
 * O DIA DE CARDIO do plano (spec §🏃 de `parametros-motor-treino-adaptkorpus`): a duração de
 * cada dia OFERECIDO para cardio e o seu teto. O cardio é independente da musculação e sai
 * só dos dias oferecidos (DEC-007) — dia vago da agenda de força é recuperação.
 *
 * PURO e determinístico: sem relógio, sem rede, sem estado. Tudo aqui é regra já travada
 * recombinada — **nenhum número novo entra por esta porta**.
 */
import type { ModalidadeCardio } from './cardio';

/** Modalidade default do dia de cardio — 🔒 caminhada (spec §🏃). */
export const MODALIDADE_PADRAO_DIA: ModalidadeCardio = 'caminhada';

/**
 * 🔴 TETO DE 90 min POR DIA DE CARDIO — 🏷️ **POLÍTICA DECLARADA, não evidência**
 * (DF 2026-08-01, §🏃). A fonte **não dá teto de sessão**; este número é nosso.
 *
 * O defeito que ele fecha, medido na implementação: a fórmula `meta ÷ dias` **não tinha
 * teto e o denominador 1 a quebra** — saúde com 1 dia de cardio → **150 ÷ 1 = 150 min**, duas horas e meia de caminhada num dia. A meta da OMS
 * é **desenhada para ser distribuída** (30 × 5); concentrá-la num dia troca uma meta de
 * saúde por uma prova de resistência — e o app não prescreve o que a pessoa vai falhar.
 *
 * 🔑 Por que 90: **escolhido para ser INERTE onde a fórmula se comporta e cortar só onde ela
 * quebra.** 2 dias de cardio → 75 (abaixo do teto, inalterado) · 3 dias → 50 · **só o caso
 * de 1 dia é tocado** (150 → 90). O teto corta o caso patológico, não redesenha os saudáveis.
 *
 * 🔒 E a honestidade que vem junto: quando o teto morde, o app **não afirma que a meta
 * semanal está coberta** — mostra o que prescreve. Espalhar o cardio por dias que a pessoa
 * **não ofereceu** seria prescrever em dia que ela não deu, e isso o motor não faz.
 */
export const TETO_MIN_DIA_CARDIO = 90;

/**
 * A duração de UM dia de cardio: meta semanal ÷ dias, arredondada a 5 (empate para cima) e
 * limitada pelo teto. 🔒 FONTE ÚNICA — o montador e o crítico chamam esta função;
 * se cada um dividisse por sua conta, o teto poderia valer num caminho e não no outro.
 */
export function duracaoDoDiaDeCardio(metaSemanalMin: number, dias: number): number {
  if (!Number.isFinite(metaSemanalMin) || metaSemanalMin <= 0 || dias < 1) return 0;
  return Math.min(arredondar5(metaSemanalMin / dias), TETO_MIN_DIA_CARDIO);
}

/** Arredonda a 5 min — a granularidade que a tela de cardio já usa. Piso de 5. */
export function arredondar5(min: number): number {
  if (!Number.isFinite(min) || min <= 0) return 0;
  return Math.max(5, Math.round(min / 5) * 5);
}
