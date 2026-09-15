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

/**
 * Versão da fórmula — toda avaliação nova a carrega (spec §5.7/§5.8). 🔒 BUMP `tempo-v3` → `tempo-v4`
 * (C1.1-B): os dias do plano final passam a ter identidade real Seg→Dom e o avaliador passa a
 * recusar cardio automático não adaptado, em vez de deixá-lo consumir a tolerância exclusiva da
 * musculação. A versão não pode permanecer silenciosamente igual.
 */
export const FORMULA_DURACAO_VERSION = 'tempo-v4';
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
  | { tipo: 'REPETICOES'; /** legado de transporte: o avaliador deliberadamente ignora este valor. */ segundosEstimadosPorSerie?: number }
  | { tipo: 'ISOMETRIA'; holdSegundosPorSerie: number };

/** Identidade de uma aplicação de técnica materializada (fonte independente do contrato). */
export interface AplicacaoTecnica {
  aplicacaoId: string;
  tecnicaId: string;
}

/**
 * 🔒 C1 (spec §3.8) — estado discriminado de técnica temporal. Cada APLICAÇÃO materializada
 * `{aplicacaoId, tecnicaId}` deve casar EXATAMENTE com um contrato de mesmo par — sem ausente,
 * extra, divergente ou duplicado. O total é derivado UMA vez pela soma dos adicionais.
 */
export type TecnicaTemporal =
  | { tipo: 'SEM_TECNICA' }
  | { tipo: 'CONTRATO_COMPLETO'; aplicacoes: { aplicacaoId: string; tecnicaId: string; adicionalSegundos: number }[] }
  | { tipo: 'CONTRATO_AUSENTE'; aplicacaoIds: string[] };

/** Item resistido (repetições ou isometria). */
export interface ItemResistido {
  tipo: 'RESISTIDO';
  series: number;
  descansoEntreSeriesSeg: number;
  execucao: ExecucaoResistida;
  /** Executado separadamente nos DOIS lados: dobra a execução, nunca o descanso. */
  unilateralDoisLados?: boolean;
  tecnica: TecnicaTemporal;
  /** 🔒 Fonte INDEPENDENTE: técnicas de fato materializadas no item. O contrato é validado
   *  contra ESTA lista, nunca contra si próprio. Ausente = nenhuma técnica materializada. */
  tecnicasMaterializadas?: readonly AplicacaoTecnica[];
}

/**
 * Item contínuo/cardio: duração explícita, sem descanso. 🔒 C1 §3.7: é SEMPRE o último item
 * (ou o único). Em posição não final ⇒ NAO_AVALIADO. O deslocamento até o cardio NÃO conta.
 */
export interface ItemContinuo {
  tipo: 'CONTINUO';
  duracaoTotalSegundos: number;
}

export type ItemDuracao = ItemResistido | ItemContinuo;

export interface EntradaDuracao {
  /** Política14/09: sem os480s de tolerância legada. Não altera a fórmula. */
  limiteEstrito?: boolean;
  itens: readonly ItemDuracao[];
  /** Orçamento em segundos = tempoPorSessaoMin·60. Ausente ⇒ faixa calcula, mas limite = NAO_AVALIADO. */
  orcamentoSegundos?: number;
  /**
   * 🔒 C1 §2 — origem OBRIGATÓRIA na semântica: no AUTOMATICO o cardio já foi ADAPTADO ao tempo
   * (via `calcularUsosCardioNaOrigem`) e nunca é a causa de a sessão cruzar `B`; no EDITADO o
   * cardio informado é apenas MEDIDO e pode exceder — então só o EDITADO recebe as cláusulas
   * CARDIO_EXCEDE_TEMPO_DISPONIVEL / CARDIO_PODE_EXCEDER_TEMPO_DISPONIVEL. Default: EDITADO (mede).
   */
  origemPlano?: 'AUTOMATICO' | 'EDITADO';
  /**
   * 🔒 C1 §4 / fixture 19 — AQUECIMENTO: ACEITO E DELIBERADAMENTE IGNORADO.
   *
   * O override do autor (2026-08-20) exclui o aquecimento da conta: presença, ausência ou duração
   * desconhecida NÃO alteram MIN, MAX nem o estado. O campo existe para que a exclusão seja
   * VERIFICÁVEL por teste (ausente × 0 × positivo ⇒ resultado idêntico) — a mera ausência do campo
   * no tipo não mata a mutação "somar aquecimento". Nunca é lido pela fórmula, nem valida domínio:
   * um aquecimento negativo/fracionário/infinito também não produz `NAO_AVALIADO`.
   */
  aquecimentoSegundos?: number;
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
    // 🔒 F17: o chamador não escolhe a duração. O campo legado de transporte é ignorado,
    // inclusive se ausente, adulterado, fracionário ou infinito.
    return fator * TEMPO_EXECUCAO_SERIE_REPS_SEG;
  }
  const h = it.execucao.holdSegundosPorSerie;
  if (!intSeguro(h) || !(h > 0)) { motivos.push(`item ${idx}: holdSegundosPorSerie deve ser inteiro seguro > 0`); return null; }
  return fator * h;
}

/**
 * Adicional de técnica do item, contado UMA vez, validado contra as técnicas MATERIALIZADAS
 * (fonte independente). Casamento exato por `{aplicacaoId, tecnicaId}` — ausente/extra/
 * divergente/duplicada ⇒ null (NAO_AVALIADO).
 */
function adicionalTecnica(
  tec: TecnicaTemporal,
  materializadas: readonly AplicacaoTecnica[] | undefined,
  motivos: string[],
  idx: number,
): number | null {
  const mat = materializadas ?? [];
  const chave = (a: AplicacaoTecnica) => JSON.stringify([a.aplicacaoId, a.tecnicaId]);
  const matKeys = mat.map(chave).sort();
  if (tec.tipo === 'SEM_TECNICA') {
    if (mat.length > 0) { motivos.push(`item ${idx}: SEM_TECNICA com técnica materializada`); return null; }
    return 0;
  }
  if (tec.tipo === 'CONTRATO_AUSENTE') { motivos.push(`item ${idx}: CONTRATO_AUSENTE`); return null; }
  // CONTRATO_COMPLETO
  for (const a of tec.aplicacoes) {
    if (!intSeguro(a.adicionalSegundos) || !(a.adicionalSegundos >= 0)) {
      motivos.push(`item ${idx}: adicional de técnica deve ser inteiro seguro >= 0`); return null;
    }
  }
  const contratoKeys = tec.aplicacoes.map(chave).sort();
  const materializadasSaoUnicas = new Set(matKeys).size === matKeys.length;
  const contratoTemChavesUnicas = new Set(contratoKeys).size === contratoKeys.length;
  if (
    !materializadasSaoUnicas
    || !contratoTemChavesUnicas
    || contratoKeys.length !== matKeys.length
    || contratoKeys.some((k, i) => k !== matKeys[i])
  ) {
    motivos.push(`item ${idx}: contrato de técnica não casa com as materializadas (ausente/extra/divergente/duplicada)`);
    return null;
  }
  // total derivado UMA vez pela soma dos adicionais (já inclui séries/lados/ocorrências).
  return tec.aplicacoes.reduce((s, a) => s + a.adicionalSegundos, 0);
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
      const adic = adicionalTecnica(it.tecnica, it.tecnicasMaterializadas, motivos, i);
      if (exSerie != null && it.series > 0) execucaoSegundos += it.series * exSerie;
      if (it.series > 0 && it.descansoEntreSeriesSeg >= 0) {
        descansoSegundos += Math.max(it.series - 1, 0) * it.descansoEntreSeriesSeg;
      }
      if (adic != null) adicionalTecnicaSegundos += adic;
      // 🔒 C1 §4 — transição = descanso do item ENCERRADO, SÓ quando o próximo é RESISTIDO.
      // Se o próximo é o cardio final, a passagem NÃO soma deslocamento (transição 0).
      if (!ehUltimo && itens[i + 1]!.tipo === 'RESISTIDO' && it.descansoEntreSeriesSeg >= 0) {
        transicaoSegundos += it.descansoEntreSeriesSeg;
      }
    } else {
      // CONTINUO — 🔒 §3.7: sempre o ÚLTIMO item. Em posição não final ⇒ NAO_AVALIADO.
      if (!ehUltimo) {
        motivos.push(`item ${i}: cardio/contínuo em posição não final (CARDIO_NAO_FINAL)`);
      } else if (!intSeguro(it.duracaoTotalSegundos) || !(it.duracaoTotalSegundos > 0)) {
        motivos.push(`item ${i}: duracaoTotalSegundos deve ser inteiro seguro > 0`);
      } else {
        continuoSegundos += it.duracaoTotalSegundos;
      }
      // cardio não carrega técnica temporal (contribui 0) e não soma transição posterior.
    }
  }

  if (motivos.length > 0) return naoAvaliado(motivos, orcamentoSegundos, motivosLimite);

  // 🔒 C1 §4 — a faixa RESISTIDA (sem cardio) é a base das capacidades de cardio disponível.
  const minResistida = execucaoSegundos + descansoSegundos + adicionalTecnicaSegundos;
  const maxResistida = minResistida + transicaoSegundos;
  const min = minResistida + continuoSegundos;
  const max = maxResistida + continuoSegundos;
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

  const limiteOperacional = orcamentoSegundos + (entrada.limiteEstrito ? 0 : TOLERANCIA_EXCESSO_SEG);

  // 🔒 C1.1-B — só musculação pode usar a tolerância de +480. O cardio automático deveria chegar
  // JÁ adaptado: se chega e empurra MAX acima de B, é falha de fiação, não sessão "na tolerância".
  // Depois vêm as cláusulas do cardio editado, que mede (mas não bloqueia) a escolha manual.
  const origem = entrada.origemPlano ?? 'EDITADO';
  const cardioPrescrito = continuoSegundos;
  const cardioDisponivelOtimista = Math.max(orcamentoSegundos - minResistida, 0);
  const cardioDisponivelPessimista = Math.max(orcamentoSegundos - maxResistida, 0);

  let estadoLimite: EstadoLimite;
  if (origem === 'AUTOMATICO' && cardioPrescrito > 0 && max > orcamentoSegundos) {
    estadoLimite = 'ACIMA_DO_LIMITE_OPERACIONAL';
    motivosLimite.push('CARDIO_AUTOMATICO_NAO_ADAPTADO');
  } else if (origem === 'EDITADO' && cardioPrescrito > 0 && cardioPrescrito > cardioDisponivelOtimista) {
    estadoLimite = 'ACIMA_DO_LIMITE_OPERACIONAL';
    motivosLimite.push('CARDIO_EXCEDE_TEMPO_DISPONIVEL');
  } else if (
    origem === 'EDITADO' &&
    cardioPrescrito > 0 &&
    cardioDisponivelPessimista < cardioPrescrito &&
    cardioPrescrito <= cardioDisponivelOtimista
  ) {
    estadoLimite = 'LIMITE_INDETERMINADO';
    motivosLimite.push('CARDIO_PODE_EXCEDER_TEMPO_DISPONIVEL');
  } else if (max <= orcamentoSegundos) estadoLimite = 'DENTRO_DO_LIMITE';
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
