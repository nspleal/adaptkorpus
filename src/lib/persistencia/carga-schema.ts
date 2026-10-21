import { z } from 'zod';
import { execucaoEFeedbackDeclarados } from './carga-estados';

const feedback = z.enum(['facil','na_medida','dificil']).nullable();
export const desempenhoSchema = z.object({
  schemaVersion: z.literal(1), tentativaId: z.string().min(1).max(180),
  recomendadaKg: z.number().finite().nonnegative().optional(), unidade: z.literal('kg'),
  convencao: z.enum(['nao_informada','total','por_lado']),
  resultado: z.enum(['escolhida','incompleta','falhou','dor','concluida']),
  feedbackConfirmado: z.boolean(), feedbackTentativaId: z.string().max(180).optional(),
  series: z.array(z.object({ id: z.string().max(200), escolhidaKg: z.number().finite().nonnegative().optional(), estado: z.enum(['escolhida','executada','falhou']) })).max(100),
}).strict();
const exercicio = z.object({
  id: z.string().max(64), fb: feedback,
  sets: z.array(z.object({ reps: z.string().max(16), kg: z.string().max(16), rir: z.string().max(16).optional() })).max(100),
  desempenho: desempenhoSchema,
}).passthrough();
/** Valida a declaração, não atesta execução física. ACK não participa desta verificação. */
export function fatoExercicioValido(raw: unknown, feedbackSessao?: unknown): boolean {
  const r = exercicio.safeParse(raw); if (!r.success) return false;
  const e = r.data, d = e.desempenho;
  if (feedbackSessao !== undefined) {
    const mapa = z.record(feedback).safeParse(feedbackSessao);
    if (!mapa.success || (mapa.data[e.id] !== undefined && mapa.data[e.id] !== e.fb)) return false;
  }
  if (d.feedbackConfirmado !== (e.fb !== null) || (d.feedbackConfirmado && d.feedbackTentativaId !== d.tentativaId)) return false;
  if (new Set(d.series.map((s) => s.id)).size !== d.series.length) return false;
  const executadas = d.series.filter((s) => s.estado === 'executada');
  if (e.sets.length !== executadas.length) return false;
  if (!e.sets.every((s, i) => Number(s.reps) > 0 && Number.isFinite(Number(s.reps)) && (s.kg === '' || (Number.isFinite(Number(s.kg)) && Number(s.kg) >= 0 && Number(s.kg) === executadas[i]!.escolhidaKg)))) return false;
  if (d.resultado === 'escolhida' && d.series.some((s) => s.estado !== 'escolhida')) return false;
  if (d.resultado === 'falhou' && !d.series.some((s) => s.estado === 'falhou')) return false;
  if (d.resultado === 'incompleta' && (!executadas.length || executadas.length === d.series.length || d.series.some((s) => s.estado === 'falhou'))) return false;
  if (d.resultado === 'concluida') {
    if (!d.series.length || !d.series.every((s) => s.estado === 'executada') || e.sets.length !== d.series.length) return false;
    if (e.fb && !execucaoEFeedbackDeclarados(d, e.fb)) return false;
  }
  return true;
}

/** Uma escolha pode ser rascunho, mas não encerra uma sessão de treino. */
export function temTentativaDeclarada(raw: unknown): boolean {
  const r = exercicio.safeParse(raw);
  return r.success && r.data.desempenho.resultado !== 'escolhida';
}
