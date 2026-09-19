import type { DiaTreino, SlotExercicio } from './treino-types';
import type { GrupoPrimario } from '../data/types';
import { creditoPonderadoDaSemana } from './alocador';
import { diretosDoExercicio, tracosMecanicos } from './cobertura-anatomica';

/** Consolida dose redundante, sem teto novo de quantidade de exercícios. Só remove
 * um slot não favorito se sua dose couber nos mantidos, sem perder crédito, alvos
 * ou traços documentais. Não aumenta séries totais nem viola orçamento de tempo
 * ou tetos. O descanso do exercício que recebe a dose é recalculado. Mesmo dia/grupo.
 */
export function consolidarPequenos(args: {
  dias: DiaTreino[]; maxSeries: number; tetoSemana: (g: GrupoPrimario) => number;
  cabe: (antes: readonly SlotExercicio[], depois: SlotExercicio[], dia: number) => boolean;
}): number {
  let removidos = 0;
  const alvos = (ss: readonly SlotExercicio[]) => new Set(ss.flatMap(s => [...diretosDoExercicio(s.exercicio.id)]));
  const tracos = (ss: readonly SlotExercicio[]) => new Set(ss.flatMap(s => [...tracosMecanicos(s.exercicio.id)]));
  for (let d = 0; d < args.dias.length; d++) for (const g of ['biceps', 'triceps'] as const) {
    const dia = args.dias[d]!;
    let mudou = true;
    while (mudou) {
      mudou = false;
      const antes = dia.slots;
      const indices = antes.flatMap((s, i) => s.exercicio.grupoPrimario === g ? [i] : []);
      if (indices.length < 2) break;
      const credito = creditoPonderadoDaSemana(args.dias.flatMap(x => x.slots));
      const cobertos = alvos(antes), funcoes = tracos(antes);
      for (const sai of [...indices].reverse()) {
        if (antes[sai]!.incluidoPorPreferencia || antes[sai]!.series == null) continue;
        const mantidos = antes.filter((_, i) => i !== sai).map(s => ({ ...s }));
        if ([...cobertos].some(a => !alvos(mantidos).has(a)) || [...funcoes].some(a => !tracos(mantidos).has(a))) continue;
        const recebem = mantidos.filter(s => s.exercicio.grupoPrimario === g && (s.series ?? 0) < args.maxSeries);
        if (recebem.reduce((n, s) => n + args.maxSeries - s.series!, 0) < antes[sai]!.series!) continue;
        let escolhido: SlotExercicio[] | undefined;
        const visitar = (k: number, saldo: number) => {
          if (escolhido) return;
          if (k === recebem.length) {
            if (saldo !== 0) return;
            const depois = creditoPonderadoDaSemana(args.dias.flatMap((x, i) => i === d ? mantidos : x.slots));
            if ([...credito].some(([grupo, n]) => (depois.get(grupo) ?? 0) < n)) return;
            if ([...depois].some(([grupo, n]) => n > args.tetoSemana(grupo) && n > (credito.get(grupo) ?? 0))) return;
            if (!args.cabe(antes, mantidos, d)) return;
            escolhido = mantidos.map(s => ({ ...s })); return;
          }
          const s = recebem[k]!, original = s.series!;
          for (let n = 0; n <= Math.min(saldo, args.maxSeries - original); n++) {
            s.series = original + n; visitar(k + 1, saldo - n);
          }
          s.series = original;
        };
        visitar(0, antes[sai]!.series!);
        if (escolhido) { dia.slots = escolhido; removidos++; mudou = true; break; }
      }
    }
  }
  return removidos;
}
