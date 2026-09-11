/**
 * Validação do PerfilResumo na borda do PUT /api/dados/perfil (zod). Enxuta de
 * propósito: os CHECKs do banco (0001) são o backstop dos números, e a validação forte
 * de entrada já acontece na borda do onboarding (`perfilSchema`). Espelha o shape de
 * `PerfilResumo` (components/painel/Painel.tsx).
 */
import { z } from 'zod';
import { SERIES_MANUAIS_MAX } from '@/lib/engine/treino-constants';

/**
 * 🔴 Grupos primários (12 valores anatômicos — DF 2026-07-27). Espelho de `GrupoPrimario`
 * (`data/types.ts`); o zod não deriva de union TS, então a lista vive aqui e o teste do fio
 * (`plano-fio.test.ts`) trava a igualdade com a fonte.
 */
const grupoPrimario = z.enum([
  'antebraco', 'biceps', 'core', 'costas', 'gluteos', 'lombar',
  'ombros', 'panturrilha', 'peito', 'posterior', 'quadriceps', 'triceps',
]);

/**
 * 🔒 D6 (2026-09-10) — os quatro blocos de TREINO que entram por HIDRATAÇÃO, extraídos para
 * consts próprias. Eles já eram validados no `PUT /api/dados/perfil`; o que faltava era um
 * jeito de aplicar a MESMA régua nas duas bordas que recebem o dado cru — o blob do
 * `localStorage` (`session · normalizarPerfil`) e o jsonb da linha `profile`
 * (`persistencia/perfil-profile · linhaParaPerfil`). São referências, não cópias: uma régua
 * nova aqui vale para as três bordas de uma vez.
 */
export const preferenciasTreinoSchema = z.object({
  trocas: z.array(z.object({ de: z.string(), para: z.string() })),
  banidos: z.array(z.string()),
});

export const focoSchema = z.object({
  grupo: grupoPrimario,
  compensa: grupoPrimario,
  semana: z.number().int().min(1),
});

export const divisaoPreferidaSchema = z.enum(['auto', 'superior-inferior', 'prioridades']);

export const rotinaCustomSchema = z.object({
  origem: z.literal('usuario'),
  dias: z.array(z.object({
    nome: z.string().max(60),
    /** Ausente só em rotinas legadas; novas gravações carregam o dia real. */
    diaId: z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']).optional(),
    exercicioIds: z.array(z.string().max(24)).max(20),
    seriesPorExercicio: z.record(z.string().max(24), z.number().int().min(1).max(SERIES_MANUAIS_MAX)).optional(),
  })).max(7),
}).superRefine((rotina, ctx) => {
  // C1.1/Parte 3: nesta versão, uma sessão de musculação ocupa no máximo um dia real.
  // A compatibilidade legada permanece: dia ausente será derivado pela agenda no montador.
  const vistos = new Set<string>();
  rotina.dias.forEach((dia, indice) => {
    if (dia.diaId == null) return;
    if (vistos.has(dia.diaId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dias', indice, 'diaId'],
        message: 'cada dia da semana pode ter apenas um treino',
      });
    }
    vistos.add(dia.diaId);
  });
});

/**
 * Forma mínima da `rotinaCustom` para HIDRATAÇÃO. Igual à de escrita menos a faixa dos
 * valores de série — ver a nota em `BLOCOS_DE_TREINO`.
 */
export const rotinaCustomHidratacaoSchema = z.object({
  origem: z.literal('usuario'),
  dias: z.array(z.object({
    nome: z.string().max(60),
    diaId: z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']).optional(),
    exercicioIds: z.array(z.string().max(24)).max(20),
    seriesPorExercicio: z.record(z.string().max(24), z.number()).optional(),
  })).max(7),
});

/**
 * 🔴 D6 — SANEAMENTO DA HIDRATAÇÃO. Medido no SHA `34b2ede`: `preferencias: { banidos: [] }`
 * vindo de um storage velho fazia `recomputarPlano` lançar `TypeError` e o app ficava **sem
 * plano nenhum**, sem mensagem. Aqui o bloco que não passa na sua régua é REMOVIDO — o perfil
 * segue, o plano sai, e o que some é a preferência inválida, não a sessão inteira.
 *
 * Preferências parciais conservam as escolhas válidas. Campo inválido usa o default de
 * ausência, acompanhado de aviso de recuperação; o usuário não perde escolhas em silêncio.
 */
const BLOCOS_DE_TREINO = {
  preferencias: preferenciasTreinoSchema,
  foco: focoSchema,
  divisaoPreferida: divisaoPreferidaSchema,
  /**
   * 🔴 O DESENHO DO USUÁRIO SE VALIDA PELA FORMA, NÃO PELO VALOR (medido no navegador,
   * 2026-09-10). Com o schema de ESCRITA aqui, um único `seriesPorExercicio` fora de 1–99
   * derrubava a `rotinaCustom` INTEIRA na hidratação: a pessoa recarregava e o treino que ela
   * montou simplesmente sumia, sem uma palavra. Isso troca um defeito por outro pior.
   *
   * 🔒 A régua da hidratação é só a que evita QUEBRA (`dias` que não é array, ausente, etc.).
   * Valor de série fora de faixa atravessa e morre onde tem quem explique: o montador recusa
   * a entrada e emite o aviso nomeando o exercício (D3). Escrita nova continua barrada pelo
   * `perfilResumoSchema`, que segue com a faixa.
   */
  rotinaCustom: rotinaCustomHidratacaoSchema,
} as const;

export function sanearBlocosDeTreino<T extends Record<string, unknown>>(perfil: T): T {
  let saneado = perfil;
  const rotulos: Record<keyof typeof BLOCOS_DE_TREINO, string> = {
    preferencias: 'preferências de exercícios', foco: 'foco muscular',
    divisaoPreferida: 'divisão de treino', rotinaCustom: 'desenho do treino',
  };
  const mensagens = Object.fromEntries(Object.entries(rotulos).map(([k, rotulo]) => [k,
    `Não foi possível recuperar todas as suas escolhas de ${rotulo}. Mantivemos o que pôde ser lido; confira essas opções antes de treinar.`,
  ]));
  const avisos = new Set<string>(Array.isArray(perfil.avisosHidratacao)
    ? perfil.avisosHidratacao.filter((v): v is string => typeof v === 'string' && Object.values(mensagens).includes(v))
    : []);
  for (const [chave, schema] of Object.entries(BLOCOS_DE_TREINO)) {
    if (saneado[chave] == null) continue;
    if (schema.safeParse(saneado[chave]).success) continue;
    avisos.add(mensagens[chave]!);
    const bruto = saneado[chave];
    if (chave === 'preferencias' && bruto && typeof bruto === 'object' && !Array.isArray(bruto)) {
      const p = bruto as Record<string, unknown>;
      // Ausência de trocas não invalida banimentos; um item inválido não apaga os irmãos.
      const trocas = Array.isArray(p.trocas) ? p.trocas.flatMap(v => {
        const parsed = preferenciasTreinoSchema.shape.trocas.element.safeParse(v);
        return parsed.success ? [parsed.data] : [];
      }) : [];
      const banidos = Array.isArray(p.banidos) ? p.banidos.filter((v): v is string => typeof v === 'string') : [];
      saneado = { ...saneado, preferencias: { trocas, banidos } };
    } else {
      const { [chave]: _descartado, ...resto } = saneado;
      saneado = resto as T;
    }
  }
  return avisos.size > 0 ? { ...saneado, avisosHidratacao: [...avisos] } : saneado;
}

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
  preferencias: preferenciasTreinoSchema.optional(),
  foco: focoSchema.optional(),
  tecnicasAvancadas: z.boolean().optional(),
  /**
   * 🏃 C2 — a MODALIDADE preferida de cardio. A spec já previa modalidade escolhida (default
   * caminhada; as 6 do registro) — faltava só o campo. Alimenta o slot do dia excedente.
   */
  cardioFavorito: z.enum(['caminhada', 'corrida', 'bike', 'pular_corda', 'lutas', 'outro']).optional(),
  // 💰 Leva H — teto de custo da dieta. `null` ≡ ausente (sem restrição); o vocabulário é o
  // interno ('baixo'|'medio'|'alto'), nunca o rótulo de tela (DF 2026-08-10).
  orcamento: z.enum(['baixo', 'medio', 'alto']).nullable().optional(),
  // 🎛️ v4 · DF③ — divisão preferida (leva B consome; a persistência entra já na leva A).
  divisaoPreferida: divisaoPreferidaSchema.optional(),
  /**
   * 🧭 Editor guiado — o desenho do usuário. Limites de forma são TRAVA DE TAMANHO, não
   * regra de treino: 7 dias, 20 exercícios por dia e id curto. O que é bom ou ruim para o
   * treino é dito pelo CRÍTICO (aviso que não trava — DF①), nunca recusado na borda.
   */
  rotinaCustom: rotinaCustomSchema.optional(),
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
