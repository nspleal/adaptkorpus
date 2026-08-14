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

/**
 * Os tipos. Espelha o `check` das migrations `0009` (os 7 originais) e `0010` (os 2 do v3 ·
 * Bloco A) — tipo fora daqui o BANCO rejeita, e como a telemetria engole erro por decisão, a
 * rejeição seria SILENCIOSA. Evento novo entra em par com a migration, sempre.
 */
export const TIPOS_EVENTO = [
  'app_aberto',
  'plano_gerado',
  'sessao_iniciada',
  'sessao_concluida',
  'exercicio_substituido',
  'refeicao_marcada',
  'cardio_registrado',
  // 🎛️ v3 · Bloco A (2026-08-04): a instrumentação nasce COM o bloco, não depois — sem ela
  // o default declarado nunca vira evidência.
  'preferencia_criada',
  'preferencia_recusada',
  // 🎛️ v3 · Bloco B (2026-08-05)
  'foco_ativado',
  'foco_encerrado',
  // 🎛️ v3 · Bloco C (2026-08-05)
  'tecnica_elegivel',
  'tecnica_ativada',
  'tecnica_feedback',
  /** 💰 Leva H (2026-08-06) — escolha/mudança do teto de custo. Migration 0013. */
  'orcamento_escolhido',
  /**
   * 🧭 EDITOR GUIADO (2026-08-13) — migration 0014. `aviso_risco_mostrado` é o EVENTO
   * ADVERSO da leva: a DF① decidiu que aviso não trava, e sem medir quantos aparecem (e
   * quantos são ignorados no salvamento) a decisão nunca vira evidência.
   */
  'editor_aberto',
  'treino_custom_salvo',
  'aviso_risco_mostrado',
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
  /**
   * 💰 `valor`: 'baixo' | 'medio' | 'alto' | 'nenhum'. `nenhum` distingue "não quis escolher"
   * de "quis sem restrição" (`alto`) — é a diferença que a leitura de adoção precisa.
   */
  orcamento_escolhido: { valor: string };
  refeicao_marcada: { refeicao: string; seguiu: boolean };
  cardio_registrado: { modalidade: string; minutos: number; origem: string };
  /** `tipo`: 'troca' | 'banimento'. Sem nome de exercício em texto — só ids do catálogo. */
  preferencia_criada: { tipo: string; de_id: string; para_id: string };
  /** 🔑 O EVENTO ADVERSO: sem ele mede-se só o caminho feliz. `motivo` é vocabulário fechado. */
  preferencia_recusada: { tipo: string; motivo: string; de_id: string; para_id: string };
  /**
   * `entrega`: 'volume' (havia folga até o MRV) | 'ordem' (o grupo já estava no topo).
   * 🔑 É este campo que diz se o teto duro morde na população real ou só na teoria.
   */
  foco_ativado: { grupo: string; compensa: string; entrega: string; delta: number };
  /** Sem ele não se mede DURAÇÃO — e a janela de 4–6 semanas nunca vira evidência. */
  foco_encerrado: { grupo: string; semanas: number; motivo: string };
  /** O portão abriu: mede quantos CHEGAM lá — o denominador honesto de qualquer adoção. */
  tecnica_elegivel: { sessoes: number; nivel: string };
  tecnica_ativada: { tecnica: string; exercicio_id: string };
  /**
   * 🔑 O EVENTO ADVERSO desta feature. As técnicas foram reabertas por RECONHECIMENTO, não
   * por eficácia — o que precisa ser vigiado é o custo em esforço percebido.
   */
  tecnica_feedback: { tecnica: string; esforco: string };
  /** 🧭 `origem`: 'plano' (editou o gerado) | 'vazio' (montou do zero). O denominador. */
  editor_aberto: { origem: string };
  /**
   * 🔑 `avisos_ativos` é o campo que dá sentido aos outros dois: sem ele não se distingue
   * "montou bem" de "montou contra todos os avisos" — e a DF① fica sem evidência de efeito.
   */
  treino_custom_salvo: { dias: number; exercicios: number; avisos_ativos: number };
  /** `codigo`: vocabulário fechado de `engine/critico.ts`. `contexto`: 'editor' | 'plano'. */
  aviso_risco_mostrado: { codigo: string; contexto: string };
}

/** As chaves permitidas de cada evento — derivadas da spec, usadas para PODAR o payload. */
export const CHAVES_PERMITIDAS: Readonly<Record<TipoEvento, readonly string[]>> = {
  app_aberto: ['rota'],
  plano_gerado: ['plano_id', 'objetivo', 'nivel', 'local', 'dias_declarados'],
  sessao_iniciada: ['sessao_id', 'data_agendada', 'semana_ciclo'],
  sessao_concluida: ['sessao_id', 'duracao_real_min', 'exercicios_feitos', 'exercicios_planejados'],
  exercicio_substituido: ['de_id', 'para_id', 'motivo'],
  /** 💰 Só o valor escolhido — preferência de montagem, nada de saúde, nada de dinheiro. */
  orcamento_escolhido: ['valor'],
  refeicao_marcada: ['refeicao', 'seguiu'],
  cardio_registrado: ['modalidade', 'minutos', 'origem'],
  preferencia_criada: ['tipo', 'de_id', 'para_id'],
  preferencia_recusada: ['tipo', 'motivo', 'de_id', 'para_id'],
  foco_ativado: ['grupo', 'compensa', 'entrega', 'delta'],
  foco_encerrado: ['grupo', 'semanas', 'motivo'],
  tecnica_elegivel: ['sessoes', 'nivel'],
  tecnica_ativada: ['tecnica', 'exercicio_id'],
  tecnica_feedback: ['tecnica', 'esforco'],
  // 🧭 Editor guiado: só contagens e vocabulário fechado — nada de nome de exercício.
  editor_aberto: ['origem'],
  treino_custom_salvo: ['dias', 'exercicios', 'avisos_ativos'],
  aviso_risco_mostrado: ['codigo', 'contexto'],
};

/**
 * 🔒 A DESCRIÇÃO PÚBLICA de cada evento — o trecho que a `/privacidade` precisa conter.
 *
 * ⚠️ POR QUE ESTE MAPA EXISTE, e por que é `Record<TipoEvento, …>`. O guard da página era uma
 * LISTA LITERAL dos 7 atos originais: quando o v3 acrescentou 5 eventos, a lista seguiu verde
 * e a página ficou defasada por três levas. Consertá-la para a contagem nova só re-armaria a
 * mesma doença — lista própria de guard é uma TERCEIRA cópia da verdade.
 *
 * Aqui a enumeração DERIVA do registro canônico: tipo novo sem descrição NÃO COMPILA (o
 * `Record` exige exaustividade), e descrição sem correspondência na página derruba a suíte.
 * A regra do descompasso (2026-07-27) passa a valer por construção, nas duas direções.
 *
 * Vários eventos compartilham o mesmo trecho de propósito: a página fala em ATOS da pessoa,
 * não em nomes internos de evento (iniciar e concluir sessão é um ato só para quem lê).
 */
export const DESCRICAO_PUBLICA: Readonly<Record<TipoEvento, string>> = {
  app_aberto: 'abre o app',
  plano_gerado: 'gera um plano',
  sessao_iniciada: 'inicia e conclui',
  sessao_concluida: 'inicia e conclui',
  exercicio_substituido: 'troca um exercício',
  refeicao_marcada: 'marca uma refeição',
  cardio_registrado: 'registra um cardio',
  preferencia_criada: 'preferências de treino',
  preferencia_recusada: 'preferências de treino',
  foco_ativado: 'grupo em foco',
  foco_encerrado: 'grupo em foco',
  tecnica_elegivel: 'técnica avançada',
  tecnica_ativada: 'técnica avançada',
  tecnica_feedback: 'esforço dela',
  orcamento_escolhido: 'limite de orçamento',
  // 🧭 A página fala em ATOS: montar o próprio treino é um só, com o aviso que ele mostra.
  editor_aberto: 'monta o próprio treino',
  treino_custom_salvo: 'monta o próprio treino',
  aviso_risco_mostrado: 'monta o próprio treino',
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
