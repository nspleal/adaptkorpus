import type { Exercise, GrupoPrimario } from '../data/types';
import type { DiaTreino, PerfilTreino, SlotExercicio } from './treino-types';
import { creditoPonderadoDaSemana } from './alocador';
import { avaliarDuracaoResistida } from './duracao-plano';

/** Usa espaço livre ou troca um complementar por bíceps no caso 4d/30min. */
export function priorizarBicepsCurto(args: {
  perfil: PerfilTreino; dias: DiaTreino[]; pool: readonly Exercise[];
  maxSeries: number; maxSlots: number; limiteSeg: number; tetoDia: number;
  tetoSemana: (grupo: GrupoPrimario) => number;
  materializar: (exercicio: Exercise, series: number, degradacao: 0 | 1 | 2) => SlotExercicio;
}): { sai?: string; entra: string; antes: number; depois: number; serieOmbrosReduzida: boolean } | null {
  const { perfil: p, dias } = args;
  if (p.nivelExperiencia !== 'iniciante' || p.equipamento !== 'academia'
    || p.objetivo !== 'massa' || dias.length !== 4 || p.tempoPorSessaoMin !== 30
    || p.limiteTempoTreino === 'sem_limite') return null;
  const medir = () => creditoPonderadoDaSemana(dias.flatMap(d => d.slots));
  const antes = medir(), bicepsAntes = antes.get('biceps') ?? 0;
  if (bicepsAntes >= 6 || !dias.some(d => d.slots.some(s => s.exercicio.grupoPrimario === 'biceps'))) return null;
  const protegidos: GrupoPrimario[] = ['peito', 'costas', 'quadriceps', 'posterior', 'gluteos', 'biceps', 'triceps'];
  const usados = new Set(dias.flatMap(d => d.slots.map(s => s.exercicio.id)));
  const candidatos = args.pool.filter(e => e.local === 'academia' && e.grupoPrimario === 'biceps'
    && e.execucao === 'BILATERAL' && !usados.has(e.id));
  for (const dia of dias) {
    if (!dia.slots.some(s => s.exercicio.grupoPrimario === 'ombros')
      || dia.slots.some(s => ['quadriceps', 'posterior', 'gluteos'].includes(s.exercicio.grupoPrimario ?? ''))) continue;
    const complementares = dia.slots.filter(s => ['antebraco', 'core', 'panturrilha'].includes(s.exercicio.grupoPrimario ?? '')
      && !s.incluidoPorPreferencia && !s.extraDoFoco);
    const saidas: (SlotExercicio | null)[] = complementares.length ? complementares
      : dia.slots.length < args.maxSlots ? [null] : [];
    for (const antigo of saidas) {
      const indice = antigo ? dia.slots.indexOf(antigo) : dia.slots.length;
      for (const exercicio of candidatos) for (let series = 1; series <= args.maxSeries; series++) {
        for (const degradacao of [0, 1, 2] as const) {
          const novo = args.materializar(exercicio, series, degradacao);
          if (antigo) dia.slots[indice] = novo;
          else dia.slots.push(novo);
          const duracao = () => avaliarDuracaoResistida(dia.slots, p.nivelExperiencia, args.limiteSeg);
          const valido = (serieOmbrosReduzida: boolean) => {
            const depois = medir(), tempo = duracao();
            return (depois.get('biceps') ?? 0) >= 6
              && (depois.get('ombros') ?? 0) >= Math.max(6, (antes.get('ombros') ?? 0) - Number(serieOmbrosReduzida))
              && protegidos.every(g => (depois.get(g) ?? 0) >= (antes.get(g) ?? 0))
              && [...depois].every(([g, n]) => n <= args.tetoSemana(g))
              && [...creditoPonderadoDaSemana(dia.slots).values()].every(n => n <= args.tetoDia)
              && tempo.estadoCalculo === 'CALCULADO' && tempo.duracaoMaximaEstimadaSegundos! <= args.limiteSeg
              && dias.flatMap(d => d.slots).filter(s => s.padrao === 'puxar').length
                >= dias.flatMap(d => d.slots).filter(s => s.padrao === 'empurrar').length;
          };
          const resultado = (serieOmbrosReduzida: boolean) => ({
            ...(antigo ? { sai: antigo.exercicio.nomePt } : {}), entra: exercicio.nomePt,
            antes: bicepsAntes, depois: medir().get('biceps') ?? 0, serieOmbrosReduzida,
          });
          if (valido(false)) return resultado(false);
          if (duracao().duracaoMaximaEstimadaSegundos! > args.limiteSeg) {
            for (const ombro of [...dia.slots].reverse()) {
              if (ombro.exercicio.grupoPrimario !== 'ombros' || (ombro.series ?? 0) <= 1
                || ombro.incluidoPorPreferencia) continue;
              ombro.series = ombro.series! - 1;
              if (valido(true)) {
                ombro.seriesAntesDoCorteDeTempo ??= ombro.series! + 1;
                return resultado(true);
              }
              ombro.series = ombro.series! + 1;
            }
          }
          if (antigo) dia.slots[indice] = antigo;
          else dia.slots.pop();
        }
      }
    }
  }
  return null;
}
