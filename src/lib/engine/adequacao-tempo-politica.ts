import type { GrupoPrimario } from '../data/types';
import type { DiaTreino, NivelExperiencia, SlotExercicio } from './treino-types';
import { avaliarDuracaoResistida } from './duracao-plano';
import { adequarInicioFullUpperLower } from './adequacao-tempo-inicial';

export type TipoSessaoTemporal = 'upper' | 'lower' | 'full-body' | 'segmentada';
export const PRINCIPAIS_TEMPO: readonly GrupoPrimario[] = ['peito', 'costas', 'quadriceps', 'posterior', 'gluteos'];
export const SECUNDARIOS_TEMPO: readonly GrupoPrimario[] = ['ombros', 'biceps', 'triceps'];
const COMPLEMENTARES: readonly GrupoPrimario[] = ['core', 'panturrilha', 'antebraco'];
export const MINIMOS_TEMPO = {
  upper: { peito: 2, costas: 2, ombros: 1, biceps: 1, triceps: 1 },
  lower: { quadriceps: 2, posterior: 2, gluteos: 2 },
  'full-body': { peito: 1, costas: 1, ombros: 1, biceps: 1, triceps: 1, quadriceps: 1, posterior: 1, gluteos: 1 },
} as const;

/** Lê o recorte efetivo, depois do calendário, não a quantidade de dias disponíveis. */
export function tipoSessaoTemporal(nome: string, grupos: readonly GrupoPrimario[], nomesDaSemana: readonly string[]): TipoSessaoTemporal {
  if (/^full[ -]?body/i.test(nome)) return 'full-body';
  if (/^(upper|superiores)(\b|\s)/i.test(nome)) return 'upper';
  if (/^(lower|inferiores)(\b|\s)/i.test(nome)) return 'lower';
  if (nome === 'Pernas' && nomesDaSemana.length === 2 && nomesDaSemana.includes('Superiores')) return 'lower';
  // Calendário pode escrever os grupos por extenso ao redistribuir exposições.
  if (Object.keys(MINIMOS_TEMPO['full-body']).every(g => grupos.includes(g as GrupoPrimario))) return 'full-body';
  if (Object.keys(MINIMOS_TEMPO.upper).every(g => grupos.includes(g as GrupoPrimario))
    && !['quadriceps', 'posterior', 'gluteos'].some(g => grupos.includes(g as GrupoPrimario))) return 'upper';
  return 'segmentada';
}

/** Política autorizada em 20/09. Só reduz uma composição já selecionada.
 * Contagem por grupoPrimario: não confundir alvos anatômicos e crédito indireto com
 * número de exercícios. Ausências são reportadas, nunca preenchidas com crédito.
 * A proteção de função vem do chamador, que conhece o restante da semana.
 */
export function adequarSessaoPorTempo(args: {
  dia: DiaTreino; nivel: NivelExperiencia; limiteSeg?: number;
  tipo: TipoSessaoTemporal; gruposObrigatorios: readonly GrupoPrimario[];
  podeRetirar: (slot: SlotExercicio, restantes: readonly SlotExercicio[]) => boolean;
}) {
  const { nivel, limiteSeg, tipo } = args;
  const inicio = tipo === 'segmentada' ? null : adequarInicioFullUpperLower(args.dia, nivel, limiteSeg);
  const dia = inicio?.dia ?? { ...args.dia, slots: args.dia.slots.map(s => ({ ...s })) };
  const removidos = [...(inicio?.removidos ?? [])];
  const series: { exercicioId: string; de: number; para: number; etapa: string }[] = [];
  const medir = () => avaliarDuracaoResistida(dia.slots, nivel, limiteSeg);
  const excede = () => limiteSeg !== undefined && medir().estadoCalculo === 'CALCULADO'
    && medir().duracaoMaximaEstimadaSegundos! > limiteSeg;
  const reduzirSeries = (piso: number, etapa: string) => {
    for (let i = dia.slots.length - 1; i >= 0 && excede(); i--) {
      const s = dia.slots[i]!;
      while ((s.series ?? 0) > piso && excede()) {
        const de = s.series!;
        if (s.seriesAntesDoCorteDeTempo == null) s.seriesAntesDoCorteDeTempo = de;
        s.series = de - 1;
        series.push({ exercicioId: s.exercicio.id, de, para: s.series, etapa });
      }
    }
  };
  const conta = (g: GrupoPrimario) => dia.slots.filter(s => s.exercicio.grupoPrimario === g).length;
  const minimo = (g: GrupoPrimario, regraB = true) => {
    if (tipo !== 'segmentada') return (MINIMOS_TEMPO[tipo] as Partial<Record<GrupoPrimario, number>>)[g] ?? 0;
    if (!args.gruposObrigatorios.includes(g)) return 0;
    return PRINCIPAIS_TEMPO.includes(g) ? (regraB ? 2 : 3) : SECUNDARIOS_TEMPO.includes(g) ? (regraB ? 1 : 2) : 0;
  };
  const retirarUm = (grupos: readonly GrupoPrimario[], regraB: boolean) => {
    // Mais redundância no grupo primeiro; desempate pela ordem final inversa.
    const candidatos = dia.slots.map((s, i) => ({ s, i }))
      .filter(({ s }) => s.exercicio.grupoPrimario != null && grupos.includes(s.exercicio.grupoPrimario)
        && conta(s.exercicio.grupoPrimario) > minimo(s.exercicio.grupoPrimario, regraB)
        && (COMPLEMENTARES.includes(s.exercicio.grupoPrimario) || args.podeRetirar(s, dia.slots)))
      .sort((a, b) => conta(b.s.exercicio.grupoPrimario!) - conta(a.s.exercicio.grupoPrimario!) || b.i - a.i);
    if (!candidatos[0]) return false;
    removidos.push(...dia.slots.splice(candidatos[0].i, 1));
    return true;
  };
  if (tipo === 'segmentada') {
    reduzirSeries(3, 'segmentada-ate-tres');
    while (excede() && retirarUm(COMPLEMENTARES, true)) { /* um por operação */ }
    for (const regraB of [false, true]) {
      while (excede()) {
        const principal = retirarUm(PRINCIPAIS_TEMPO, regraB);
        const secundario = excede() && retirarUm(SECUNDARIOS_TEMPO, regraB);
        if (!principal && !secundario) break;
      }
    }
  } else {
    reduzirSeries(2, 'fb-ul-ate-duas');
    for (const grupos of [PRINCIPAIS_TEMPO, SECUNDARIOS_TEMPO]) {
      while (excede() && retirarUm(grupos, true)) { /* para assim que couber */ }
    }
  }
  reduzirSeries(1, 'piso-uma');
  const grupos = tipo === 'segmentada' ? args.gruposObrigatorios
    : Object.keys(MINIMOS_TEMPO[tipo]) as GrupoPrimario[];
  const faltas = grupos.filter(g => conta(g) < minimo(g)).map(g => ({ grupo: g, minimo: minimo(g), entregue: conta(g) }));
  return { dia, removidos, series, descansos: inicio?.descansos ?? [], faltas, duracao: medir() };
}
