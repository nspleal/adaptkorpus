/**
 * Validação de entrada (zod) — defesa na borda.
 * Toda entrada de usuário é validada ANTES de tocar no motor ou no banco.
 * 18+ é obrigatório (gate legal); faixas plausíveis batem com o backstop do motor.
 */
import { z } from 'zod';

export const perfilSchema = z.object({
  sexo: z.enum(['masculino', 'feminino']),
  pesoKg: z.coerce.number().min(30, 'Peso fora da faixa').max(300, 'Peso fora da faixa'),
  alturaCm: z.coerce.number().min(100, 'Altura fora da faixa').max(250, 'Altura fora da faixa'),
  idade: z.coerce
    .number()
    .int()
    .min(18, 'O app é exclusivo para maiores de 18 anos.')
    .max(100, 'Idade fora da faixa'),
  nivelAtividade: z.enum(['sedentario', 'leve', 'moderado', 'intenso', 'muito_intenso']),
  objetivo: z.enum(['emagrecimento', 'massa', 'saude']),
  flagsSaude: z.object({
    gestacaoAmamentacao: z.boolean(),
    renal: z.boolean(),
    cardiaca: z.boolean(),
    lesao: z.boolean(),
    diabetes: z.boolean(),
  }),
  preferenciaAlimentar: z.enum(['vegano', 'vegetariano']).nullable().optional(),
  alergenos: z.array(z.string()).default([]),
});

export type PerfilInput = z.infer<typeof perfilSchema>;

/** Consentimentos obrigatórios (LGPD + 18+) para gerar/persistir plano. */
export const consentimentoSchema = z.object({
  aceite18: z.literal(true, {
    errorMap: () => ({ message: 'É necessário confirmar que você tem 18 anos ou mais.' }),
  }),
  aceiteTermos: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar o termo de conscientização e o disclaimer.' }),
  }),
  aceiteLgpd: z.literal(true, {
    errorMap: () => ({ message: 'É necessário consentir o tratamento de dados (LGPD).' }),
  }),
});
