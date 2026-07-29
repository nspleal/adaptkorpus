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
  equipamento: z.enum(['nenhum', 'casa', 'academia']), // 'nenhum' = legado (≡ casa + [])
  equipamentosCasa: z.array(z.enum(['halteres', 'barra_fixa', 'elastico', 'banco', 'kettlebell', 'corda_pular', 'roda_abdominal'])).optional(),
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

/** Entrada do formulário de suporte (POST /api/suporte). `site` é honeypot anti-bot:
 *  humano nunca vê/preenche; conteúdo ali = bot (a rota finge sucesso e descarta). */
export const suporteSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  assunto: z.enum(['duvida', 'cobranca', 'privacidade', 'outro']),
  mensagem: z.string().trim().min(10).max(4000),
  site: z.string().max(0).optional(),
});

/** Entrada da substituição de exercício. */
export const subExercicioSchema = z.object({
  exercicioAtualId: z.string().min(1),
  equipamento: z.enum(['nenhum', 'casa', 'academia']), // 'nenhum' = legado (≡ casa + [])
  equipamentosCasa: z.array(z.enum(['halteres', 'barra_fixa', 'elastico', 'banco', 'kettlebell', 'corda_pular', 'roda_abdominal'])).optional(),
  nivelExperiencia: z.enum(['iniciante', 'intermediario', 'avancado']),
  historicoRecenteIds: z.array(z.string()).optional(),
  gostoExcluirIds: z.array(z.string()).optional(),
});


/**
 * 🔒 TETO DE PAYLOAD jsonb (auditoria 2026-07-29). `PUT /api/dados/aderencia` aceitava
 * `logs`/`notes` como object livre e `POST /api/dados/historico` persistia campos extras
 * quaisquer: um usuário autenticado podia gravar megabytes por linha. O RLS impede ler o
 * dado dos outros, não impede encher o próprio balde — e a conta do storage é do dono.
 *
 * 64 KB por linha é ~50× o maior payload real (uma sessão de treino cheia dá ~1,3 KB).
 */
export const LIMITE_PAYLOAD_BYTES = 64 * 1024;

/** O objeto cabe no teto quando serializado? */
export function payloadCabe(valor: unknown, limite = LIMITE_PAYLOAD_BYTES): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(valor)).length <= limite;
  } catch {
    return false; // circular/não-serializável
  }
}

/** Aderência de um dia: mapa slot → status, e slot → nota curta. Raso de propósito. */
export const aderenciaDiaSchema = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data ISO'),
  logs: z.record(z.string().max(40), z.enum(['seguiu', 'fora', 'comi']).nullable()),
  notes: z.record(z.string().max(40), z.string().max(2000)),
});

/** Sessão de treino: só o esqueleto estrutural — o payload varia com a leva. */
export const sessaoHistoricoSchema = z.object({
  dataISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data ISO'),
  n: z.number().int().min(0).max(100_000),
  dia: z.string().max(120).optional(),
  series: z.number().int().min(0).max(1000).optional(),
  volumeKg: z.number().min(0).max(1_000_000).optional(),
  exercicios: z.array(z.unknown()).max(60),
  tipo: z.enum(['calibracao', 'sinal_fadiga', 'cardio']).optional(),
}).passthrough();
