/**
 * Validação do PerfilResumo na borda do PUT /api/dados/perfil (zod). Enxuta de
 * propósito: os CHECKs do banco (0001) são o backstop dos números, e a validação forte
 * de entrada já acontece na borda do onboarding (`perfilSchema`). Espelha o shape de
 * `PerfilResumo` (components/painel/Painel.tsx).
 */
import { z } from 'zod';

/**
 * 🔴 Grupos primários (12 valores anatômicos — DF 2026-07-27). Espelho de `GrupoPrimario`
 * (`data/types.ts`); o zod não deriva de union TS, então a lista vive aqui e o teste do fio
 * (`plano-fio.test.ts`) trava a igualdade com a fonte.
 */
const grupoPrimario = z.enum([
  'antebraco', 'biceps', 'core', 'costas', 'gluteos', 'lombar',
  'ombros', 'panturrilha', 'peito', 'posterior', 'quadriceps', 'triceps',
]);

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
  // Mesociclo v2 (§7, DF 2026-07-08): âncora ISO + modo força.
  // 🔻 O "espelho da semana" SAIU na correção 3.5 (2026-08-01): era cache sem consumidor —
  // a semana sempre foi derivada de `mesocicloInicio` + hoje + sessões, e o único read do
  // campo comparava o valor contra ele mesmo. Validar um campo que ninguém lê só dava ao
  // fóssil aparência de dado legítimo. A poda do legado vive em `persistencia/perfil-profile`.
  mesocicloInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data ISO').optional(),
  deloadAte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data ISO').optional(),
  modoForca: z.boolean().optional(),
  // "Fiquei doente" (Leva 2 · Bloco 4, DF 2026-07-27): SÓ o carimbo ISO 8601 do
  // reconhecimento. 🔴 Motive-free por LGPD — nunca motivo, sintoma ou data de volta;
  // um campo que gravasse "doente" seria dado de saúde (categoria sensível).
  reconhecidoEm: z.string().datetime().optional(),
  /**
   * 🔴 O FIO DO v3 — leva A do v4 (handoff-motor-volume-v4-2026-08-12).
   *
   * Estes campos existiam no `PerfilResumo` e NÃO estavam declarados aqui — e zod descarta
   * chave não declarada. Consequência medida (relatorio-medicao-v3-2026-08-12): o PUT do
   * perfil os apagava no servidor, e o boot server-first (`app/page.tsx`) sobrescrevia o
   * cache local com o perfil sem eles. Banimento, troca, foco, técnicas e orçamento
   * morriam no primeiro reload com backend vivo.
   */
  preferencias: z.object({
    trocas: z.array(z.object({ de: z.string(), para: z.string() })),
    banidos: z.array(z.string()),
  }).optional(),
  foco: z.object({
    grupo: grupoPrimario,
    compensa: grupoPrimario,
    semana: z.number().int().min(1),
  }).optional(),
  tecnicasAvancadas: z.boolean().optional(),
  // 💰 Leva H — teto de custo da dieta. `null` ≡ ausente (sem restrição); o vocabulário é o
  // interno ('baixo'|'medio'|'alto'), nunca o rótulo de tela (DF 2026-08-10).
  orcamento: z.enum(['baixo', 'medio', 'alto']).nullable().optional(),
  // 🎛️ v4 · DF③ — divisão preferida (leva B consome; a persistência entra já na leva A).
  divisaoPreferida: z.enum(['auto', 'superior-inferior', 'prioridades']).optional(),
  /**
   * 🧭 Editor guiado — o desenho do usuário. Limites de forma são TRAVA DE TAMANHO, não
   * regra de treino: 7 dias, 20 exercícios por dia e id curto. O que é bom ou ruim para o
   * treino é dito pelo CRÍTICO (aviso que não trava — DF①), nunca recusado na borda.
   */
  rotinaCustom: z.object({
    origem: z.literal('usuario'),
    dias: z.array(z.object({
      nome: z.string().max(60),
      exercicioIds: z.array(z.string().max(24)).max(20),
    })).max(7),
  }).optional(),
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
