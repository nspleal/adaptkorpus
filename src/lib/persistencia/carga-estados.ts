import type { Feedback } from '@/lib/engine/treino-types';

/** Contrato de fatos, não uma regra de progressão. Decisão do autor e67139fe (19/10/2026).
 * ACK só confirma transporte; nenhuma função daqui calcula ou promove uma carga. */
export interface DesempenhoRegistrado {
  schemaVersion: 1;
  tentativaId: string;
  recomendadaKg?: number;
  unidade: 'kg';
  convencao: 'nao_informada' | 'total' | 'por_lado';
  resultado: 'escolhida' | 'incompleta' | 'falhou' | 'dor' | 'concluida';
  feedbackConfirmado: boolean;
  feedbackTentativaId?: string;
  series: { id: string; escolhidaKg?: number; estado: 'escolhida' | 'executada' | 'falhou' }[];
}

export interface SerieDeclarada {
  reps: string;
  kg: string;
  done: boolean;
  falhou?: boolean;
}

export function registrarDesempenho(
  tentativaId: string,
  series: readonly SerieDeclarada[],
  feedback: Feedback | null,
  dor = false,
  recomendadaKg?: number,
): DesempenhoRegistrado {
  const executadas = series.filter((s) => s.done && Number(s.reps) > 0).length;
  const falhou = series.some((s) => s.falhou);
  const resultado = dor ? 'dor' : falhou ? 'falhou'
    : executadas === series.length && executadas > 0 ? 'concluida'
      : executadas > 0 ? 'incompleta' : 'escolhida';
  return {
    schemaVersion: 1, tentativaId, unidade: 'kg', convencao: 'nao_informada',
    ...(Number.isFinite(recomendadaKg) ? { recomendadaKg } : {}),
    resultado,
    feedbackConfirmado: feedback !== null,
    ...(feedback !== null ? { feedbackTentativaId: tentativaId } : {}),
    series: series.map((s, i) => ({
      id: `${tentativaId}:${i}`,
      ...(s.kg !== '' && Number.isFinite(Number(s.kg)) ? { escolhidaKg: Number(s.kg) } : {}),
      estado: s.falhou ? 'falhou' : s.done && Number(s.reps) > 0 ? 'executada' : 'escolhida',
    })),
  };
}

/** Uma declaração vinculada e completa pode ser entregue ao motor EXISTENTE.
 * Não significa que a progressão aprovará aumento. Legado sem contrato continua desconhecido. */
export function execucaoEFeedbackDeclarados(
  desempenho: DesempenhoRegistrado | undefined,
  feedback: Feedback | null | undefined,
): boolean {
  return !!desempenho && desempenho.schemaVersion === 1
    && desempenho.resultado === 'concluida'
    && desempenho.feedbackConfirmado
    && desempenho.feedbackTentativaId === desempenho.tentativaId
    && !!feedback
    && desempenho.series.length > 0
    && desempenho.series.every((s) => s.estado === 'executada');
}
