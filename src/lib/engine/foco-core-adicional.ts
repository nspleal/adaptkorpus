import type { DiaTreino } from './treino-types';

/** Soma uma única dose semanal aos slots existentes. Não redistribui o baseline,
 * não cede séries de terceiros e não muda descanso, ordem ou frequência.
 * A autoridade do chamador verifica tempo e crédito ponderado a cada série. */
export function adicionarSeriesCore(args: {
  dias: DiaTreino[];
  solicitado: number;
  tetoPorExercicio: number;
  aceita: (dias: readonly DiaTreino[], dia: number) => boolean;
}): { solicitadas: number; entregues: number } {
  let entregues = 0;
  while (entregues < args.solicitado) {
    let avancou = false;
    for (let d = 0; d < args.dias.length && entregues < args.solicitado; d++) {
      for (const slot of args.dias[d]!.slots) {
        if (entregues >= args.solicitado) break;
        if (slot.exercicio.grupoPrimario !== 'core'
          || slot.series == null || slot.series >= args.tetoPorExercicio) continue;
        slot.series++;
        if (args.aceita(args.dias, d)) { entregues++; avancou = true; }
        else slot.series--;
      }
    }
    if (!avancou) break;
  }
  return { solicitadas: args.solicitado, entregues };
}
