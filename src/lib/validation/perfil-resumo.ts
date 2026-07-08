/**
 * Validação do PerfilResumo na borda do PUT /api/dados/perfil (zod). Enxuta de
 * propósito: os CHECKs do banco (0001) são o backstop dos números, e a validação forte
 * de entrada já acontece na borda do onboarding (`perfilSchema`). Espelha o shape de
 * `PerfilResumo` (components/painel/Painel.tsx).
 */
import { z } from 'zod';

export const perfilResumoSchema = z.object({
  sexo: z.enum(['masculino', 'feminino']),
  idade: z.coerce.number().int().min(18, '18+').max(100),
  alturaCm: z.coerce.number().min(100).max(250),
  pesoKg: z.coerce.number().min(30).max(300),
  objetivo: z.enum(['emagrecimento', 'massa', 'saude']),
  nivelAtividade: z.enum(['sedentario', 'leve', 'moderado', 'intenso', 'muito_intenso']),
  nivelExperiencia: z.enum(['iniciante', 'intermediario', 'avancado']),
  equipamento: z.enum(['nenhum', 'casa', 'academia']),
  preferencia: z.enum(['vegano', 'vegetariano']).nullable(),
  alergenos: z.array(z.string()).default([]),
  diasDisponiveis: z.number().int().min(1).max(7),
  tempoPorSessaoMin: z.number().int().min(10).max(240),
  treinoDias: z.array(z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])).min(1),
  naoCurto: z.array(z.string()).default([]),
  favoritos: z.array(z.string()).optional(),
  equipamentosCasa: z
    .array(z.enum(['halteres', 'barra_fixa', 'elastico', 'banco', 'kettlebell', 'corda_pular', 'roda_abdominal']))
    .optional(),
  pratosCansados: z.array(z.object({ id: z.string(), ate: z.string() })).default([]),
  // Mesociclo v2 (§7, DF 2026-07-08): âncora ISO + espelho da semana (1–6) + modo força.
  mesocicloInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data ISO').optional(),
  mesocicloSemana: z.number().int().min(1).max(6).optional(),
  modoForca: z.boolean().optional(),
  flagsSaude: z.object({
    gestacaoAmamentacao: z.boolean(),
    renal: z.boolean(),
    cardiaca: z.boolean(),
    lesao: z.boolean(),
    diabetes: z.boolean(),
  }),
});

export const consentimentosSchema = z.object({
  aceite18: z.boolean(),
  aceiteTermos: z.boolean(),
  aceiteLgpd: z.boolean(),
});
