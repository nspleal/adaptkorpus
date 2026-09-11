import type { SlotExercicio } from './engine/treino-types';

/**
 * 🔒 FONTE ÚNICA das séries exibidas: o número que a tela mostra é o que o MOTOR decidiu
 * para aquele slot. Nada de piso, de máximo com o estado da progressão, nem de régua de
 * deload aqui.
 *
 * 🔴 D9 (diagnóstico 2026-09-10, §6.1): esta função era a SEGUNDA autoridade sobre séries.
 * Ela tinha regra própria de alívio (`ceil(base/2)` ≈ −50 %), divergente da registrada no
 * cofre (`DELOAD_REDUCAO_VOLUME = 0.45`), e dois pisos silenciosos —
 * `prescricao.seriesPorExercicio.min` e `progresso.estado.series` (que é *sempre* esse mesmo
 * mínimo: nada em `treino-progressao` o altera). Os três juntos faziam a tela levantar de
 * volta qualquer número que o motor tivesse reduzido, inclusive o do deload.
 *
 * Onde cada uma dessas regras passou a viver: a redução do alívio em
 * `engine/treino · aplicarDeload`, chamada uma única vez por `treino-montador`; a decisão de
 * quantas séries cada slot recebe, na rampa do mesociclo do próprio montador.
 *
 * `?? 0` é ausência HONESTA, não piso: depois de D2/D7 todo slot do fluxo do app chega com
 * série decidida. Se algum dia voltar a chegar sem, a tela mostra zero em vez de inventar.
 */
export function seriesDoSlot(slot: SlotExercicio): number {
  return slot.series ?? 0;
}
