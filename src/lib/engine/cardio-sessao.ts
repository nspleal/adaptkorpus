/**
 * 🔒 C1 — PRIMITIVA ÚNICA de capacidade/uso de cardio na origem (spec §4.2, handoff §4.2).
 *
 * `calcularUsosCardioNaOrigem` é a ÚNICA fórmula de capacidade/uso de cardio. O avaliador de
 * sessão (via gerador) e o construtor semanal (`distribuicao-cardio-semana.ts`) DEVEM consumir
 * ESTA primitiva — é proibida uma segunda fórmula local (§8.1, mutação "usar fórmula local de
 * capacidade/uso"). Puro e determinístico: sem rede/relógio/IO.
 *
 * Semântica (spec §4.2):
 *  - a capacidade do dia é COMPARTILHADA por todas as prescrições daquele dia;
 *  - consome-se em `ordem_prescricao` crescente: `usada_i = min(prescrita_i, restante)`;
 *  - proibido `min(prescrita_i, B)` isolado por prescrição e proibido rateio proporcional;
 *  - capacidade INCALCULÁVEL (B ou MAX_RESISTIDA desconhecidos no automático) ⇒ uso `0` e a
 *    prescrição inteira vira saldo (restante = prescrita), com motivo estruturado no chamador;
 *  - domínios: `duracao_prescrita` inteiro seguro `> 0`; `ordem_prescricao` inteiro seguro `>= 0`,
 *    única no dia. Domínio inválido ⇒ prescrição não é alocada (uso `0`) e recebe motivo.
 */

const intSeguro = (n: number): boolean => Number.isSafeInteger(n);

/** Capacidade de cardio do dia — calculável (>= 0) ou incalculável (B/MAX_RESISTIDA desconhecidos). */
export type CapacidadeCardio =
  | { tipo: 'CALCULAVEL'; segundos: number }
  | { tipo: 'INCALCULAVEL'; motivo: string };

/** Uma prescrição de cardio originada num dia. */
export interface PrescricaoCardioDia {
  prescricaoId: string;
  /** Inteiro seguro `>= 0`, único entre prescrições do mesmo dia de origem (spec §2). */
  ordemPrescricao: number;
  /** Inteiro seguro `> 0`. */
  duracaoPrescritaSegundos: number;
}

/** Uso individual de uma prescrição na sua origem (preserva prescrito × usado × restante). */
export interface UsoCardioOrigem {
  prescricaoId: string;
  ordemPrescricao: number;
  duracaoPrescritaSegundos: number;
  /** `>= 0`. min(prescrita, capacidade compartilhada restante). `0` se capacidade incalculável/inválida. */
  duracaoUsadaNaSessaoSegundos: number;
  /** `prescrita - usada`. Vira saldo para redistribuição. */
  restanteAposOrigemSegundos: number;
  /** Motivo se a prescrição foi rejeitada por domínio inválido (não alocada). */
  motivoInvalido?: string;
}

export interface ResultadoUsosCardioOrigem {
  capacidade: CapacidadeCardio;
  usos: UsoCardioOrigem[];
  /** Σ das durações usadas na origem = CARDIO_ORIGEM_NO_DIA (parte do materializado). */
  cardioOrigemNoDiaSegundos: number;
  /** true se alguma prescrição foi rejeitada por domínio inválido. */
  temPrescricaoInvalida: boolean;
}

/**
 * Resolve a capacidade compartilhada de cardio de um dia (spec §4.2):
 *  - dia exclusivo de cardio (sem musculação): capacidade = B (se B calculável);
 *  - dia com musculação: capacidade = max(B - MAX_RESISTIDA, 0) (se ambos calculáveis);
 *  - B ou MAX_RESISTIDA incalculáveis ⇒ INCALCULAVEL (uso 0, prescrição vira saldo).
 */
export function capacidadeCardioDoDia(params: {
  temMusculacao: boolean;
  orcamentoSegundos: number | undefined;
  /** MAX_RESISTIDA do dia; `null`/`undefined` ⇒ incalculável (ex.: sessão NAO_AVALIADO). */
  maxResistidaSegundos: number | null | undefined;
}): CapacidadeCardio {
  const { temMusculacao, orcamentoSegundos: b, maxResistidaSegundos: maxR } = params;
  if (b === undefined || !intSeguro(b) || !(b > 0)) {
    return { tipo: 'INCALCULAVEL', motivo: 'ORCAMENTO_AUSENTE' };
  }
  if (!temMusculacao) {
    // dia exclusivo de cardio: capacidade = B inteiro.
    return { tipo: 'CALCULAVEL', segundos: b };
  }
  if (maxR == null || !intSeguro(maxR) || maxR < 0) {
    return { tipo: 'INCALCULAVEL', motivo: 'MAX_RESISTIDA_INCALCULAVEL' };
  }
  return { tipo: 'CALCULAVEL', segundos: Math.max(b - maxR, 0) };
}

/**
 * 🔒 PRIMITIVA ÚNICA. Distribui a capacidade compartilhada do dia entre suas prescrições, em
 * `ordem_prescricao` crescente. Não aplica B isolado por prescrição nem rateio proporcional.
 */
export function calcularUsosCardioNaOrigem(
  capacidade: CapacidadeCardio,
  prescricoes: readonly PrescricaoCardioDia[],
): ResultadoUsosCardioOrigem {
  // Ordena por ordem_prescricao (estável, determinística); desempate por prescricaoId.
  const ordenadas = [...prescricoes].sort(
    (a, b) => (a.ordemPrescricao - b.ordemPrescricao) || (a.prescricaoId < b.prescricaoId ? -1 : a.prescricaoId > b.prescricaoId ? 1 : 0),
  );

  const capOk = capacidade.tipo === 'CALCULAVEL';
  let restante = capOk ? capacidade.segundos : 0;

  const usos: UsoCardioOrigem[] = ordenadas.map((p) => {
    const domInvalido =
      !intSeguro(p.ordemPrescricao) || p.ordemPrescricao < 0
        ? 'ordem_prescricao inválida (inteiro seguro >= 0)'
        : !intSeguro(p.duracaoPrescritaSegundos) || !(p.duracaoPrescritaSegundos > 0)
          ? 'duracao_prescrita_segundos inválida (inteiro seguro > 0)'
          : undefined;
    if (domInvalido) {
      return {
        prescricaoId: p.prescricaoId,
        ordemPrescricao: p.ordemPrescricao,
        duracaoPrescritaSegundos: p.duracaoPrescritaSegundos,
        duracaoUsadaNaSessaoSegundos: 0,
        restanteAposOrigemSegundos: 0,
        motivoInvalido: domInvalido,
      };
    }
    // Capacidade incalculável ⇒ uso 0 (prescrição inteira vira saldo). Calculável ⇒ compartilha.
    const usada = capOk ? Math.min(p.duracaoPrescritaSegundos, restante) : 0;
    restante -= usada;
    return {
      prescricaoId: p.prescricaoId,
      ordemPrescricao: p.ordemPrescricao,
      duracaoPrescritaSegundos: p.duracaoPrescritaSegundos,
      duracaoUsadaNaSessaoSegundos: usada,
      restanteAposOrigemSegundos: p.duracaoPrescritaSegundos - usada,
    };
  });

  return {
    capacidade,
    usos,
    cardioOrigemNoDiaSegundos: usos.reduce((s, u) => s + u.duracaoUsadaNaSessaoSegundos, 0),
    temPrescricaoInvalida: usos.some((u) => u.motivoInvalido != null),
  };
}
