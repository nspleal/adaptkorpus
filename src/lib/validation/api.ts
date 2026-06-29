/**
 * Schemas de validação (zod) das ENTRADAS das rotas de API.
 * Defesa na borda: toda entrada é validada antes de tocar o motor.
 */
import { z } from 'zod';
import { perfilSchema } from './profile';

/** Entrada do motor de treino. */
export const perfilTreinoSchema = z.object({
  pesoKg: z.coerce.number().finite().min(30).max(300),
  alturaCm: z.coerce.number().finite().min(100).max(250),
  idade: z.coerce.number().finite().int().min(18, 'O app é 18+').max(100),
  flagsSaude: z.object({
    gestacaoAmamentacao: z.boolean(),
    renal: z.boolean(),
    cardiaca: z.boolean(),
    lesao: z.boolean(),
    diabetes: z.boolean(),
  }),
  objetivo: z.enum(['emagrecimento', 'massa', 'saude']),
  nivelExperiencia: z.enum(['iniciante', 'intermediario', 'avancado']),
  equipamento: z.enum(['nenhum', 'casa', 'academia']),
  diasDisponiveis: z.coerce.number().int().min(1).max(7),
  tempoPorSessaoMin: z.coerce.number().int().min(10).max(180),
});

const macrosSchema = z.object({
  kcal: z.coerce.number().finite().nonnegative(),
  proteinaG: z.coerce.number().finite().nonnegative(),
  carboidratoG: z.coerce.number().finite().nonnegative(),
  gorduraG: z.coerce.number().finite().nonnegative(),
});

const restricoesSchema = z
  .object({
    alergenos: z.array(z.string()).default([]),
    preferencia: z.enum(['vegano', 'vegetariano']).nullable().optional(),
  })
  .optional();

/** Entrada da substituição de prato. */
export const subPratoSchema = z.object({
  perfil: perfilSchema,
  totaisDiaAtual: macrosSchema,
  /** Escala do pratoAtual no cardápio (1 = porção-base). */
  escalaAtual: z.coerce.number().finite().positive().optional(),
  pratoAtualId: z.string().min(1),
  slot: z.enum(['cafe', 'almoco', 'jantar', 'lanche']),
  restricoes: restricoesSchema,
  gosto: z
    .object({
      excluirPratoIds: z.array(z.string()).optional(),
      excluirAlimentoIds: z.array(z.string()).optional(),
    })
    .optional(),
});

/** Entrada da substituição de exercício. */
export const subExercicioSchema = z.object({
  exercicioAtualId: z.string().min(1),
  equipamento: z.enum(['nenhum', 'casa', 'academia']),
  nivelExperiencia: z.enum(['iniciante', 'intermediario', 'avancado']),
  historicoRecenteIds: z.array(z.string()).optional(),
  gostoExcluirIds: z.array(z.string()).optional(),
});
