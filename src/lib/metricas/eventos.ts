/**
 * TELEMETRIA DE PRODUTO — os 7 eventos (Leva C2).
 * 🔒 Spec travada: cofre `conceitos/metricas-de-produto-evokorpus` (DF 2026-07-31).
 *
 * **Por que existe:** o app não media nada. O colapso do beta — zero treinos, zero pesos,
 * zero refeições — só apareceu quando o cofre foi ler o banco à mão. Enquanto isso não
 * existir, toda decisão de produto é opinião.
 *
 * Princípios herdados, não novos:
 *  1. 🔒 **Primeira parte, nunca terceiro.** Vai para a tabela `eventos` do próprio Supabase,
 *     sob RLS. Nada de comportamento por conta sai para serviço externo.
 *  2. 🔒 **Minimização.** Só o que responde uma métrica da spec. Na dúvida, não coleta.
 *  3. 🔒 **Nunca dado de saúde no payload** — peso, IMC, resposta do gate, condição, dor.
 *     A `DENYLIST` abaixo é varrida por um guard que FALHA O BUILD.
 *  4. 🔒 **Medir não é exibir.** Nenhuma métrica volta à tela como número sobre a pessoa.
 *  5. 🔒 **O denominador é DERIVADO, não registrado** — sai do plano + datas, e não vira
 *     evento. Abandono idem: é `sessao_iniciada` sem `sessao_concluida`.
 *
 * PURO quanto ao formato: montar e validar payload não toca rede. O envio fica em
 * `registrar.ts`, que é o único com efeito.
 */

/** Os 7 tipos. Espelha o `check` da migration `0009` — tipo fora daqui o BANCO rejeita. */
export const TIPOS_EVENTO = [
  'app_aberto',
  'plano_gerado',
  'sessao_iniciada',
  'sessao_concluida',
  'exercicio_substituido',
  'refeicao_marcada',
  'cardio_registrado',
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/**
 * 🔒 Payload FECHADO por evento. Não é "pelo menos isto" — é **só isto**. Um campo a mais
 * é coleta que ninguém autorizou, e a minimização da LGPD não admite "já que estamos aqui".
 */
export interface PayloadPorEvento {
  app_aberto: { rota: string };
  plano_gerado: { plano_id: string; objetivo: string; nivel: string; local: string; dias_declarados: number };
  sessao_iniciada: { sessao_id: string; data_agendada: string; semana_ciclo: number };
  sessao_concluida: { sessao_id: string; duracao_real_min: number; exercicios_feitos: number; exercicios_planejados: number };
  exercicio_substituido: { de_id: string; para_id: string; motivo: string };
  refeicao_marcada: { refeicao: string; seguiu: boolean };
  cardio_registrado: { modalidade: string; minutos: number; origem: string };
}

/** As chaves permitidas de cada evento — derivadas da spec, usadas para PODAR o payload. */
export const CHAVES_PERMITIDAS: Readonly<Record<TipoEvento, readonly string[]>> = {
  app_aberto: ['rota'],
  plano_gerado: ['plano_id', 'objetivo', 'nivel', 'local', 'dias_declarados'],
  sessao_iniciada: ['sessao_id', 'data_agendada', 'semana_ciclo'],
  sessao_concluida: ['sessao_id', 'duracao_real_min', 'exercicios_feitos', 'exercicios_planejados'],
  exercicio_substituido: ['de_id', 'para_id', 'motivo'],
  refeicao_marcada: ['refeicao', 'seguiu'],
  cardio_registrado: ['modalidade', 'minutos', 'origem'],
};

/**
 * 🔴 DENYLIST — chaves que NUNCA podem estar num payload de telemetria.
 *
 * Cofre: *"Peso · IMC · resposta do gate · condição de saúde · dor/sintoma · texto livre de
 * qualquer campo · conteúdo de refeição · e-mail ou nome."* Dado de saúde é categoria
 * sensível na LGPD e vive onde já vive, com o tratamento que já tem — telemetria não é lugar
 * para ele.
 *
 * 🔒 O guard varre isto contra `CHAVES_PERMITIDAS` **e** contra todo payload em runtime, e
 * **falha o build**. É o espírito do `CHAVES_LOCAIS`: guard vence revisão — foi a varredura
 * da constante única que achou a 9ª chave que duas auditorias não viram.
 */
export const DENYLIST_SAUDE: readonly string[] = [
  'peso', 'peso_kg', 'pesokg', 'pesoKg', 'imc', 'altura', 'altura_cm', 'alturacm',
  'gate', 'gate_resultado', 'comportamento', 'flags_saude', 'flagssaude', 'condicao',
  'condicoes', 'doenca', 'gestacao', 'renal', 'cardiaca', 'diabetes', 'lesao',
  'dor', 'sintoma', 'medicamento',
  'nome', 'email', 'e_mail', 'telefone', 'cpf',
  'nota', 'notas', 'observacao', 'obs', 'texto', 'comentario', 'mensagem',
  'alimento', 'alimentos', 'prato', 'pratos', 'ingrediente', 'ingredientes', 'kcal', 'calorias',
];

/** Normaliza para comparar: minúsculas, sem acento, sem separador. */
export function normalizarChave(k: string): string {
  return k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-\s]/g, '');
}

const DENY_NORMALIZADA: ReadonlySet<string> = new Set(DENYLIST_SAUDE.map(normalizarChave));

/** A chave é proibida? Compara normalizado, para `peso_kg` e `pesoKg` caírem juntos. */
export function chaveProibida(k: string): boolean {
  return DENY_NORMALIZADA.has(normalizarChave(k));
}

/**
 * Monta o payload FINAL de um evento: mantém só as chaves permitidas daquele tipo, descarta
 * `undefined`, e **lança** se alguma chave proibida aparecer.
 *
 * ⚠️ Lançar, e não podar em silêncio, é deliberado: uma chave de saúde chegando aqui é
 * defeito de quem chamou, e podar sem avisar deixaria o defeito vivo até alguém ler o banco.
 * O chamador (`registrar.ts`) captura — telemetria nunca derruba a tela do usuário.
 */
export function montarPayload<T extends TipoEvento>(
  tipo: T,
  bruto: Record<string, unknown>,
): Record<string, unknown> {
  for (const k of Object.keys(bruto)) {
    if (chaveProibida(k)) {
      throw new Error(`telemetria: chave proibida "${k}" em ${tipo} (denylist de saúde/PII)`);
    }
  }
  const permitidas = new Set(CHAVES_PERMITIDAS[tipo]);
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bruto)) {
    if (permitidas.has(k) && v !== undefined) saida[k] = v;
  }
  return saida;
}

/** Retenção da telemetria, em meses (§Retenção). `logs` NÃO tem prazo — é o histórico. */
export const RETENCAO_EVENTOS_MESES = 12;
