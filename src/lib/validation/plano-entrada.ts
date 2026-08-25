/**
 * Borda do certificado C1.1-C. Esta é a versão serializável das entradas transitórias
 * que alteram o plano exibido; Map/Set nunca entram no request nem no hash.
 */
import { z } from 'zod';

const weekdaySchema = z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
const grupoSchema = z.enum([
  'antebraco', 'biceps', 'core', 'costas', 'gluteos', 'lombar',
  'ombros', 'panturrilha', 'peito', 'posterior', 'quadriceps', 'triceps',
]);
const execucaoSchema = z.enum(['BILATERAL', 'UNILATERAL_ALTERNADO', 'UNILATERAL_DOIS_LADOS']);

/** Aceita somente a forma transportável que o motor reconstrói de modo determinístico. */
export const entradaPlanoVisivelSchema = z.object({
  pesoEfetivoKg: z.number().finite().min(30).max(300),
  diasOferecidosCardio: z.array(weekdaySchema).max(7),
  semanaCiclo: z.object({
    semana: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
    feedbackGrupos: z.array(z.tuple([grupoSchema, z.enum(['ok', 'segura'])])).max(12),
    retomada: z.object({
      semana: z.number().int().min(1).max(6),
      fator: z.number().finite().min(0).max(1),
      volumeReferencia: z.number().finite().min(0).max(100),
      exerciciosRecentes: z.array(z.string().min(1).max(80)).max(200),
    }).optional(),
  }),
  escolhasExecucao: z.array(z.tuple([z.string().min(1).max(80), execucaoSchema])).max(300),
}).strict();

export type EntradaPlanoVisivelValidada = z.infer<typeof entradaPlanoVisivelSchema>;
