/**
 * 🔒 C1 — FONTE ÚNICA DE DURAÇÃO ESTIMADA DA SESSÃO (norma ratificada pelo autor 2026-08-20).
 *
 * Uma ÚNICA função canônica estima a ocupação de tempo de uma sessão. O gerador e o crítico
 * chamam ESTA função sobre o MESMO plano final (séries, descansos, holds e técnicas realmente
 * prescritos). O orçamento em slots (`orcamentoSlotsDoDia`) segue como heurística inicial de
 * montagem — deixa de certificar que o plano cabe no tempo. A certificação final é aqui.
 *
 * 🔴 Override do autor (2026-08-20): o AQUECIMENTO **não** conta como tempo de treino — não
 * entra na duração nem gera `NAO_AVALIADO`. Por isso não há campo de aquecimento nesta entrada.
 *
 * Regras normativas (DEVE/NÃO DEVE/SOMENTE):
 *  - execução por série de REPETIÇÕES usa a constante única `TEMPO_EXECUCAO_SERIE_REPS_SEG=40`;
 *    ISOMETRIA usa o hold prescrito (proibido substituir por 40 s);
 *  - descanso da sessão = Σ max(S-1,0)·descanso — o descanso APÓS A ÚLTIMA série NÃO conta;
 *  - unilateral executado nos dois lados dobra SOMENTE a execução, nunca o descanso;
 *  - cardio/contínuo usa a duração prescrita, sem descanso fictício de 90 s;
 *  - faltou dado obrigatório ⇒ `NAO_AVALIADO` (proibidos os fallbacks `série=1`/`descanso=90`);
 *  - a faixa [MIN, MAX] separa transição de descanso: MAX usa como reserva de transição o
 *    descanso do item encerrado, SÓ quando há outro item depois.
 *
 * Fonte normativa: `especificacao-c1-duracao-sessao.md` + overrides 2026-08-20.
 */

/** Versão da fórmula — toda avaliação nova a carrega (spec §5.7). */
export const FORMULA_DURACAO_VERSION = 'tempo-v1';
/** Execução estimada por série de REPETIÇÕES (proxy v1, não medição — calibrável por telemetria). */
export const TEMPO_EXECUCAO_SERIE_REPS_SEG = 40;
/** Tolerância absoluta de excesso por sessão (política de produto: +8 min). */
export const TOLERANCIA_EXCESSO_SEG = 480;

export type EstadoCalculo = 'CALCULADO' | 'NAO_AVALIADO';

export type EstadoLimite =
  | 'DENTRO_DO_LIMITE'
  | 'DENTRO_DA_TOLERANCIA'
  | 'ACIMA_DO_LIMITE_OPERACIONAL'
  | 'LIMITE_INDETERMINADO'
  | 'NAO_AVALIADO';

/** Descrição de execução de um item resistido — exatamente uma das duas. */
export type ExecucaoResistida =
  | { tipo: 'REPETICOES'; segundosEstimadosPorSerie: number }
  | { tipo: 'ISOMETRIA'; holdSegundosPorSerie: number };

/** Estado discriminado de técnica temporal (superset/dropset/etc. — fronteira explícita). */
export type TecnicaTemporal =
  | { tipo: 'SEM_TECNICA' }
  | { tipo: 'CONTRATO_COMPLETO'; parcelasAdicionaisSegundos: number[]; adicionalTecnicaTotalSegundos: number }
  | { tipo: 'CONTRATO_AUSENTE'; tecnicaIds: string[] };

/** Item resistido (repetições ou isometria). */
export interface ItemResistido {
  tipo: 'RESISTIDO';
  series: number;
  descansoEntreSeriesSeg: number;
  execucao: ExecucaoResistida;
  /** Executado separadamente nos DOIS lados: dobra a execução, nunca o descanso. */
  unilateralDoisLados?: boolean;
  tecnica: TecnicaTemporal;
}

/** Item contínuo/cardio: duração explícita, sem descanso; reserva de transição própria. */
export interface ItemContinuo {
  tipo: 'CONTINUO';
  duracaoTotalSegundos: number;
  /** Obrigatória (mesmo `0`) quando NÃO é o último item; ausente antes de outro item ⇒ NAO_AVALIADO. */
  reservaTransicaoAposSeg?: number;
  tecnica?: TecnicaTemporal;
}

export type ItemDuracao = ItemResistido | ItemContinuo;

export interface EntradaDuracao {
  itens: readonly ItemDuracao[];
  /** Orçamento em segundos = tempoPorSessaoMin·60. Ausente ⇒ faixa calcula, mas limite = NAO_AVALIADO. */
  orcamentoSegundos?: number;
}

export interface ComponentesDuracao {
  execucaoSegundos: number;
  descansoSegundos: number;
  continuoSegundos: number;
  adicionalTecnicaSegundos: number;
  transicaoSegundos: number;
}

export interface ResultadoDuracao {
  estadoCalculo: EstadoCalculo;
  estadoLimite: EstadoLimite;
  duracaoMinimaEstimadaSegundos?: number;
  duracaoMaximaEstimadaSegundos?: number;
  orcamentoSegundos?: number;
  limiteOperacionalSegundos?: number;
  formulaVersion: string;
  componentes?: ComponentesDuracao;
  /** Por que NÃO há cálculo confiável (HOLD_AUSENTE, domínio inválido, técnica sem contrato…). */
  motivosNaoAvaliados: string[];
  /** 🔒 C1 — dimensão INDEPENDENTE: o que não pôde ser comparado ao limite (ORCAMENTO_AUSENTE,
   *  CARDIO_EXCEDE_TEMPO_DISPONIVEL, …). Nunca esconde nem é escondido por `motivosNaoAvaliados`. */
  motivosLimite: string[];
}

/** Inteiro finito e seguro (proíbe fracionário/infinito/inseguro — spec §3.6). */
const intSeguro = (n: number): boolean => Number.isSafeInteger(n);

const naoAvaliado = (motivos: string[], orcamentoSegundos: number | undefined, motivosLimite: string[]): ResultadoDuracao => ({
  estadoCalculo: 'NAO_AVALIADO',
  estadoLimite: 'NAO_AVALIADO',
  orcamentoSegundos,
  formulaVersion: FORMULA_DURACAO_VERSION,
  motivosNaoAvaliados: motivos,
  motivosLimite,
});

/** Execução por série já com o fator de lateralidade (2× só na execução). */
function execucaoPorSerie(it: ItemResistido, motivos: string[], idx: number): number | null {
  const fator = it.unilateralDoisLados === true ? 2 : 1;
  if (it.execucao.tipo === 'REPETICOES') {
    const s = it.execucao.segundosEstimadosPorSerie;
    if (!intSeguro(s) || !(s > 0)) { motivos.push(`item ${idx}: segundosEstimadosPorSerie deve ser inteiro seguro > 0`); return null; }
    return fator * s;
  }
  const h = it.execucao.holdSegundosPorSerie;
  if (!intSeguro(h) || !(h > 0)) { motivos.push(`item ${idx}: holdSegundosPorSerie deve ser inteiro seguro > 0`); return null; }
  return fator * h;
}

/** Adicional de técnica do item (contado UMA vez — já inclui séries/lados/ocorrências). */
function adicionalTecnica(tec: TecnicaTemporal | undefined, motivos: string[], idx: number): number | null {
  if (!tec || tec.tipo === 'SEM_TECNICA') return 0;
  if (tec.tipo === 'CONTRATO_AUSENTE') {
    motivos.push(`item ${idx}: técnica sem contrato temporal (CONTRATO_AUSENTE)`);
    return null;
  }
  // CONTRATO_COMPLETO
  for (const p of tec.parcelasAdicionaisSegundos) {
    if (!intSeguro(p) || !(p >= 0)) { motivos.push(`item ${idx}: parcela de técnica deve ser inteiro seguro >= 0`); return null; }
  }
  const soma = tec.parcelasAdicionaisSegundos.reduce((a, b) => a + b, 0);
  if (tec.adicionalTecnicaTotalSegundos !== soma) {
    motivos.push(`item ${idx}: adicionalTecnicaTotalSegundos (${tec.adicionalTecnicaTotalSegundos}) ≠ soma das parcelas (${soma})`);
    return null;
  }
  if (!(tec.adicionalTecnicaTotalSegundos >= 0)) { motivos.push(`item ${idx}: adicional de técnica < 0`); return null; }
  return tec.adicionalTecnicaTotalSegundos;
}

/**
 * Avaliador canônico da duração da sessão. Puro e determinístico.
 * A entrada traz itens JÁ MATERIALIZADOS (séries, descanso, hold, lateralidade, técnica reais).
 */
export function avaliarDuracaoSessao(entrada: EntradaDuracao): ResultadoDuracao {
  const motivos: string[] = [];
  const { itens, orcamentoSegundos } = entrada;
  const n = itens.length;

  // 🔒 C1 — `motivos_limite` é dimensão INDEPENDENTE: ORCAMENTO_AUSENTE entra aqui mesmo que o
  // cálculo falhe por outro motivo, e nunca migra para `motivos_nao_avaliados`.
  const motivosLimite: string[] = [];
  if (orcamentoSegundos === undefined) motivosLimite.push('ORCAMENTO_AUSENTE');
  else if (!intSeguro(orcamentoSegundos) || !(orcamentoSegundos > 0)) {
    motivos.push('orçamento presente deve ser inteiro seguro > 0');
  }

  let execucaoSegundos = 0;
  let descansoSegundos = 0;
  let continuoSegundos = 0;
  let adicionalTecnicaSegundos = 0;
  let transicaoSegundos = 0;

  for (let i = 0; i < n; i += 1) {
    const it = itens[i]!;
    const ehUltimo = i === n - 1;

    if (it.tipo === 'RESISTIDO') {
      if (!intSeguro(it.series) || !(it.series > 0)) {
        motivos.push(`item ${i}: series deve ser inteiro seguro > 0`);
      }
      if (!intSeguro(it.descansoEntreSeriesSeg) || !(it.descansoEntreSeriesSeg >= 0)) {
        motivos.push(`item ${i}: descansoEntreSeriesSeg deve ser inteiro seguro >= 0`);
      }
      const exSerie = execucaoPorSerie(it, motivos, i);
      const adic = adicionalTecnica(it.tecnica, motivos, i);
      if (exSerie != null && it.series > 0) execucaoSegundos += it.series * exSerie;
      if (it.series > 0 && it.descansoEntreSeriesSeg >= 0) {
        descansoSegundos += Math.max(it.series - 1, 0) * it.descansoEntreSeriesSeg;
      }
      if (adic != null) adicionalTecnicaSegundos += adic;
      // Transição: o descanso vigente do item resistido, só se houver item depois.
      if (!ehUltimo && it.descansoEntreSeriesSeg >= 0) transicaoSegundos += it.descansoEntreSeriesSeg;
    } else {
      // CONTINUO
      if (!intSeguro(it.duracaoTotalSegundos) || !(it.duracaoTotalSegundos > 0)) {
        motivos.push(`item ${i}: duracaoTotalSegundos deve ser inteiro seguro > 0`);
      } else {
        continuoSegundos += it.duracaoTotalSegundos;
      }
      const adic = adicionalTecnica(it.tecnica, motivos, i);
      if (adic != null) adicionalTecnicaSegundos += adic;
      if (!ehUltimo) {
        if (it.reservaTransicaoAposSeg === undefined) {
          motivos.push(`item ${i}: item contínuo antes de outro item exige reservaTransicaoAposSeg explícita`);
        } else if (!intSeguro(it.reservaTransicaoAposSeg) || !(it.reservaTransicaoAposSeg >= 0)) {
          motivos.push(`item ${i}: reservaTransicaoAposSeg deve ser inteiro seguro >= 0`);
        } else {
          transicaoSegundos += it.reservaTransicaoAposSeg;
        }
      }
    }
  }

  if (motivos.length > 0) return naoAvaliado(motivos, orcamentoSegundos, motivosLimite);

  const min = execucaoSegundos + descansoSegundos + continuoSegundos + adicionalTecnicaSegundos;
  const max = min + transicaoSegundos;
  // 🔒 total derivado inseguro (overflow) ⇒ NAO_AVALIADO, nunca arredonda em silêncio.
  if (!intSeguro(min) || !intSeguro(max)) {
    return naoAvaliado([`total derivado inseguro (min=${min}, max=${max})`], orcamentoSegundos, motivosLimite);
  }
  const componentes: ComponentesDuracao = {
    execucaoSegundos, descansoSegundos, continuoSegundos, adicionalTecnicaSegundos, transicaoSegundos,
  };

  // Orçamento ausente: faixa calculável, mas limite indeterminável por falta de referência.
  if (orcamentoSegundos === undefined) {
    return {
      estadoCalculo: 'CALCULADO',
      estadoLimite: 'NAO_AVALIADO',
      duracaoMinimaEstimadaSegundos: min,
      duracaoMaximaEstimadaSegundos: max,
      formulaVersion: FORMULA_DURACAO_VERSION,
      componentes,
      motivosNaoAvaliados: [],
      motivosLimite, // contém ORCAMENTO_AUSENTE
    };
  }

  const limiteOperacional = orcamentoSegundos + TOLERANCIA_EXCESSO_SEG;
  let estadoLimite: EstadoLimite;
  if (max <= orcamentoSegundos) estadoLimite = 'DENTRO_DO_LIMITE';
  else if (max <= limiteOperacional) estadoLimite = 'DENTRO_DA_TOLERANCIA';
  else if (min > limiteOperacional) estadoLimite = 'ACIMA_DO_LIMITE_OPERACIONAL';
  else estadoLimite = 'LIMITE_INDETERMINADO'; // min <= limiteOperacional < max

  return {
    estadoCalculo: 'CALCULADO',
    estadoLimite,
    duracaoMinimaEstimadaSegundos: min,
    duracaoMaximaEstimadaSegundos: max,
    orcamentoSegundos,
    limiteOperacionalSegundos: limiteOperacional,
    formulaVersion: FORMULA_DURACAO_VERSION,
    componentes,
    motivosNaoAvaliados: [],
    motivosLimite,
  };
}
