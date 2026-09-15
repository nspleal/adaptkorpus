/**
 * 🦴 CONTRATO da classificação ANATÔMICA PRÁTICA dos 168 ids — tipos e vocabulário.
 *
 * Escrito à mão. Os dados vivem em `alvos-anatomicos-dados.ts` (motor) e
 * `alvos-anatomicos-fontes.ts` (tela), ambos GERADOS de `MAPA-MOTOR.json` do pacote
 * `mapa-consumo-motor-168-20260915`. A leitura tipada é `alvos-anatomicos.ts`.
 *
 * A separação existe porque `exercises.ts` é gerado do xlsx do cofre: a classificação vive
 * FORA dele e sobrevive à próxima geração do catálogo. (É a mesma arquitetura da integração
 * muscular anterior — `musculatura-tipos`/`-dados`/`musculatura` —, aqui aplicada a outro
 * contrato: aquele responde "o que a pesquisa sustenta sobre este exercício"; este responde
 * "quais alvos a AÇÃO deste exercício aborda".)
 *
 * 🔒 O que este contrato preserva, e por quê (CONTRATO.md do pacote):
 *  · **tipos anatômicos separados** — `cabeca`, `porcao`, `musculo`, `grupo_muscular` e
 *    `regiao_corporal` não são subdivisões equivalentes e não podem ser contados como se
 *    fossem. Peitoral tem duas cabeças no contrato; não existe terceira quota inferior;
 *  · **papéis distintos** — `direto` é a ação principal compatível com a anatomia;
 *    `auxiliar` participa sem fechar cobertura direta (e não mexe nos créditos parciais de
 *    volume que o motor já tem); `informativo_cardio` nunca vira série de hipertrofia;
 *  · **condição não presumida** — e104 (extensão de coluna × dobradiça de quadril), e139
 *    (ação do punho) e e85/e88/e89 (retroversão pélvica) só resolvem com execução declarada.
 *    Sem informação, o alvo condicional fica PENDENTE — nunca coberto, nunca negado;
 *  · **inferência ≠ medição** — `base` é sempre `inferencia_anatomica`. Nada aqui certifica
 *    predominância medida, dose suficiente ou preferência regional.
 *
 * 🔴 O que este contrato NÃO é: dose. Não define série, frequência, descanso, duração, teto,
 * foco, peso de ativação/hipertrofia, equivalência entre exercícios nem substituição. A
 * cobertura anatômica é critério de ESCOLHA dentro das restrições que já existem.
 */

/** Chave estável de um alvo (ex.: `pc`, `bl`, `tl`, `lat`). Domínio: `ALVOS_ANATOMICOS`. */
export type AlvoId = string;

/**
 * 🔒 Nível anatômico do alvo. A distinção é o ponto: uma `cabeca` do bíceps e o
 * `grupo_muscular` dos adutores não são a mesma unidade, e somar os dois como "dois alvos"
 * seria inventar uma escala que o pacote não tem.
 */
export type TipoDeAlvo = 'cabeca' | 'porcao' | 'musculo' | 'grupo_muscular' | 'regiao_corporal';

/**
 * Papel do alvo na ação do exercício.
 *
 * 🔴 `direto` é classificação FUNCIONAL pela tarefa — não é sinônimo de maior EMG, de
 * exclusividade nem de estímulo suficiente. `auxiliar` NÃO fecha cobertura direta por si.
 * `informativo_cardio` é visível e nunca conta como alvo abordado.
 */
export type PapelDoAlvo = 'direto' | 'auxiliar' | 'informativo_cardio';

/** Como o pacote classificou o id: consulta normal, só-cardio, ou dependente de execução. */
export type UsoAnatomico = 'consulta_anatomica' | 'somente_informativo_cardio' | 'condicional';

/** Um dos 44 alvos, com o nível anatômico que o qualifica. */
export interface AlvoAnatomico {
  nome: string;
  /** Grupo do alvo. 🔴 Vocabulário do PACOTE, não os 12 `GrupoPrimario` do catálogo. */
  grupo: string;
  musculo: string;
  /** Porção/cabeça dentro do músculo, quando há. `null` quando o alvo é o músculo inteiro. */
  parte: string | null;
  tipo: TipoDeAlvo;
}

/**
 * Condição de EXECUÇÃO declarada pelo chamador.
 *
 * 🔒 Só as chaves e os valores que o pacote declarou são aceitos — chave desconhecida, valor
 * fora do vocabulário ou tipo errado (a string `'false'`, o número `1`) são recusados, como
 * em `consulta.py`. `retroversaoPelvica: false` é aceito e resolve a condição NEGATIVA:
 * declarar que não houve retroversão é informação, e informação nega; silêncio não.
 */
export type CondicaoExecucao = Readonly<Record<string, string | boolean>>;

/** Ramo condicional: quando a execução for esta, estes alvos ganham este papel. */
export interface CondicionalAnatomica {
  quando: CondicaoExecucao;
  alvos: readonly AlvoId[];
  papel: PapelDoAlvo;
}

/** A classificação de UM id — o lado que o motor lê. */
export interface ExercicioAnatomico {
  /** Regra que classificou (chave em `REGRAS_ANATOMICAS`, com ação, natureza e fontes). */
  regra: string;
  uso: UsoAnatomico;
  /** Pares [alvo, papel] incondicionais. */
  alvos: readonly (readonly [AlvoId, PapelDoAlvo])[];
  condicionais: readonly CondicionalAnatomica[];
  /**
   * Descritores mecânicos DECLARADOS pelo catálogo (inclinação, pegada, posição do ombro, do
   * quadril e do joelho, trajetória, apoio). Ausente nos 126 ids que não declaram nenhum — e
   * ausência de descritor é ausência de DECLARAÇÃO, nunca ausência de característica.
   *
   * 🔴 Vivem no lado do MOTOR porque a complementaridade mecânica da seleção automática os lê.
   * Continuam sendo DESCRITORES: distinguem TAREFA, não medem eficiência, e a magnitude nunca
   * é usada — `positiva_angulo_nao_fixado` declara a orientação, não o ângulo.
   */
  descritores?: Readonly<Record<string, string>>;
}

/** Um alvo já resolvido para um id, com o papel que vale naquela consulta. */
export interface AlvoResolvido {
  alvo: AlvoId;
  papel: PapelDoAlvo;
  /** Sempre `'inferencia_anatomica'`. Existe para a tela não poder omiti-lo. */
  base: 'inferencia_anatomica';
  /** `true` quando o alvo só entrou porque uma condição de execução foi declarada. */
  porCondicao: boolean;
}

/** Resultado de `alvosDoExercicio`. */
export interface ConsultaAnatomica {
  id: string;
  regra: string;
  uso: UsoAnatomico;
  alvos: readonly AlvoResolvido[];
  /** Ramos cuja execução não foi declarada. 🔴 Pendente ≠ ausente: não cobre e não nega. */
  condicionaisNaoResolvidas: readonly CondicionalAnatomica[];
}

/** Diagnóstico de cobertura de um conjunto de ids contra um conjunto de alvos desejados. */
export interface CoberturaAnatomica {
  /** alvo → ids que o abordam diretamente (por inferência anatômica). */
  abordadosPorInferencia: Readonly<Record<AlvoId, readonly string[]>>;
  /** alvo → ids em que ele participa como auxiliar. 🔴 Não fecha cobertura direta. */
  participacaoAuxiliar: Readonly<Record<AlvoId, readonly string[]>>;
  /** alvo → ramos que dependem de execução não declarada, com a condição que os resolveria. */
  condicionaisNaoResolvidas: Readonly<Record<AlvoId, readonly { id: string; quando: CondicaoExecucao; papel: PapelDoAlvo }[]>>;
  /** alvo → ids de cardio em que ele aparece. 🔴 Informativo; nunca é série de hipertrofia. */
  participacaoCardio: Readonly<Record<AlvoId, readonly string[]>>;
  /** Alvos desejados que NENHUM id do conjunto aborda diretamente. Ordenado. */
  semAlvoDiretoNesteConjunto: readonly AlvoId[];
  /** A ressalva que acompanha qualquer leitura deste resultado. Não é opcional. */
  mensagem: string;
}

// ── Lado da tela (carregado sob demanda; nenhuma decisão o lê) ───────────────

/**
 * Ficha de fonte operacional. O pacote tem TRÊS formatos, e eles não foram uniformizados de
 * propósito — normalizar exigiria eleger qual campo "é o texto", e isso seria interpretação:
 *  · referência anatômica (StatPearls e afins): `fatoAnatomico` + `natureza`;
 *  · CABRAL2022: idem, mais `doi` e `aliasOrigem` (o mesmo estudo tem dois códigos na origem
 *    e conta como UMA obra);
 *  · PR24_*: ficha de procedência do complemento de 24 ids — `extraido` + `tipo`, sem fato
 *    anatômico próprio.
 * Campo ausente é ausência de CAMPO na ficha, nunca ausência de pesquisa.
 */
export interface FonteAnatomica {
  titulo: string;
  url: string;
  local: string;
  acesso: string;
  fatoAnatomico?: string;
  natureza?: string;
  doi?: string;
  /** Códigos alternativos da MESMA obra na pesquisa de origem. Não são obras distintas. */
  aliasOrigem?: readonly string[];
  extraido?: string;
  tipo?: string;
}

/** Uma das 59 regras de classificação. */
export interface RegraAnatomica {
  acao: string;
  natureza: string;
  justificativa: string;
  fontes: readonly string[];
}

/**
 * Ênfase CONTEXTUAL — a comparação de Cabral 2022 recuperada pelo pacote.
 * 🔴 `usarComoPesoAutomatico` é `false` e o motor não a lê: distribuição espacial de EMG sob
 * um protocolo específico não é prova de hipertrofia nem preferência universal.
 */
export interface EnfaseContextual {
  alvo: AlvoId;
  fonte: string;
  tipo: string;
  protocolo: Readonly<Record<string, unknown>>;
  aplicacao: string;
  resultado: string;
  limite: string;
  usarComoPesoAutomatico: false;
}

/**
 * Detalhe por id para a tela: ação descrita, ênfases e a limitação declarada.
 * 🔴 Sem `descritores`: eles moram em `ExercicioAnatomico` (lado do motor) e a rota os lê de
 * lá. Duplicá-los criaria duas verdades para o mesmo campo.
 */
export interface DetalheAnatomico {
  nome: string;
  grupoCatalogo: string | null;
  descricaoAcao: string;
  enfasesContextuais: readonly EnfaseContextual[];
  limitacao: string;
}

/** Distinção que a pesquisa NÃO autoriza. Resultado explícito, não lacuna a preencher. */
export interface LimiteDeDiscriminacao {
  alvo: string;
  estado: string;
  motivo: string;
}
