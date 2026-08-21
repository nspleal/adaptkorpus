/**
 * 🔒 C1 — ADAPTADOR do plano real → itens da fórmula canônica (fonte única, spec §5.2/§5.6).
 *
 * O gerador e o crítico usam ESTE adaptador para materializar um plano em `ItemDuracao[]` e
 * chamar `avaliarDuracaoSessao` — nenhum dos dois copia a aritmética. Assim gerador e crítico
 * avaliam o MESMO objeto de plano final pela MESMA função.
 *
 * 🔑 Fronteiras do modelo de dados atual (medidas em `44f0ee0`, honestas por design):
 *  - **Lateralidade:** vem do campo curado `Exercise.execucao` (data/lateralidade.ts). Só
 *    `UNILATERAL_DOIS_LADOS` dobra a execução; `ALTERNADO`/`BILATERAL` não. Sem regex em runtime.
 *  - **Técnica avançada (superset/dropset):** o modelo não carrega marcador — todo item é
 *    `SEM_TECNICA`. Superset/circuito são fronteira explícita (exigem contrato temporal próprio).
 *  - **Isometria:** os 5 ids `REP_UNIT_SEGUNDOS` usam o HOLD (proibido 40 s). Como o slot final
 *    não carrega o hold prescrito (mora no estado de progressão), o hold de PLANEJAMENTO v1 é o
 *    PISO da faixa do nível (`faixaSegundos(id,nivel).min`) — calibrável, como os 40 s dos reps.
 *  - **Cardio:** vive em `diasCardio` (array próprio), nunca dentro de uma sessão de força; por
 *    isso este adaptador cobre só itens RESISTIDOS. A avaliação de dia de cardio é do seu campo
 *    `minutos` e não passa por aqui.
 */
import {
  avaliarDuracaoSessao, FORMULA_DURACAO_VERSION, TEMPO_EXECUCAO_SERIE_REPS_SEG,
  type ExecucaoResistida, type ItemDuracao, type ResultadoDuracao,
} from './duracao-sessao';
import { faixaSegundos, PISO_HOLD_SEG, repUnitDe } from './isometricos';
import type { Exercise } from '../data/types';
import type { NivelExperiencia } from './treino-types';

/** O mínimo que o adaptador lê de um slot/exercício do plano final. */
export interface SlotParaDuracao {
  exercicio: Exercise;
  /** Séries FINAIS do plano. Ausente ⇒ o dado obrigatório falta ⇒ NAO_AVALIADO. */
  series?: number;
  /** Descanso FINAL entre séries (s). Ausente ⇒ NAO_AVALIADO. */
  descansoSeg?: number;
  /** 🔒 HOLD FINAL (s) TRANSPORTADO — obrigatório em isométrico; ausente ⇒ NAO_AVALIADO. */
  holdSeg?: number;
}

/**
 * 🔒 C1 — Execução por série de PLANEJAMENTO (custoDia projeta itens): reps=40; isométrico usa o
 * hold projetado da faixa do nível. ⚠️ NÃO é o caminho de CERTIFICAÇÃO — a certificação lê o
 * `holdSeg` REAL transportado ao slot (ver `itensResistidosDeSlots`), sem fallback.
 */
export function execucaoResistidaDe(ex: Exercise, nivel: NivelExperiencia): ExecucaoResistida {
  if (repUnitDe(ex.id) === 'segundos') {
    const hold = faixaSegundos(ex.id, nivel)?.min ?? PISO_HOLD_SEG;
    return { tipo: 'ISOMETRIA', holdSegundosPorSerie: hold };
  }
  return { tipo: 'REPETICOES', segundosEstimadosPorSerie: TEMPO_EXECUCAO_SERIE_REPS_SEG };
}

/**
 * Constrói os itens canônicos a partir dos slots resistidos do plano final. Se QUALQUER slot
 * não tiver séries/descanso, sinaliza `faltou` — a sessão inteira vira NAO_AVALIADO (nunca se
 * soma um plano parcial, e nunca se inventa 1 série / 90 s).
 */
export function itensResistidosDeSlots(
  slots: readonly SlotParaDuracao[],
  // 🔒 C1 — o hold agora vem TRANSPORTADO no slot; o nível não é mais usado na certificação.
  _nivel?: NivelExperiencia,
): { itens: ItemDuracao[]; faltou: string[] } {
  const itens: ItemDuracao[] = [];
  const faltou: string[] = [];
  slots.forEach((s, i) => {
    if (s.series == null || s.descansoSeg == null) {
      faltou.push(`slot ${i} (${s.exercicio.id}): ${s.series == null ? 'séries' : 'descanso'} ausente`);
      return;
    }
    let execucao: ExecucaoResistida;
    if (repUnitDe(s.exercicio.id) === 'segundos') {
      // 🔒 C1 — isométrico usa o HOLD REAL transportado ao slot; ausente ⇒ NAO_AVALIADO
      // (HOLD_AUSENTE). Proibido faixaSegundos.min / 40 s / 90 s aqui.
      if (s.holdSeg == null) { faltou.push(`slot ${i} (${s.exercicio.id}): HOLD_AUSENTE (isométrico sem hold prescrito no plano)`); return; }
      execucao = { tipo: 'ISOMETRIA', holdSegundosPorSerie: s.holdSeg };
    } else {
      execucao = { tipo: 'REPETICOES', segundosEstimadosPorSerie: TEMPO_EXECUCAO_SERIE_REPS_SEG };
    }
    itens.push({
      tipo: 'RESISTIDO',
      series: s.series,
      descansoEntreSeriesSeg: s.descansoSeg,
      execucao,
      // 🔒 C1 — só UNILATERAL_DOIS_LADOS dobra a execução; ALTERNADO/BILATERAL não. Vem do campo
      // curado `execucao` (data/lateralidade.ts), nunca de regex em nome/descrição.
      unilateralDoisLados: s.exercicio.execucao === 'UNILATERAL_DOIS_LADOS',
      tecnica: { tipo: 'SEM_TECNICA' },
    });
  });
  return { itens, faltou };
}

/**
 * Avalia a duração de uma sessão RESISTIDA (a via do gerador e do crítico). Dado faltante ⇒
 * NAO_AVALIADO estruturado (sem fallback silencioso).
 */
export function avaliarDuracaoResistida(
  slots: readonly SlotParaDuracao[],
  nivel: NivelExperiencia,
  orcamentoSegundos?: number,
): ResultadoDuracao {
  const { itens, faltou } = itensResistidosDeSlots(slots, nivel);
  if (faltou.length > 0) {
    return {
      estadoCalculo: 'NAO_AVALIADO',
      estadoLimite: 'NAO_AVALIADO',
      orcamentoSegundos,
      formulaVersion: FORMULA_DURACAO_VERSION,
      motivosNaoAvaliados: faltou,
    };
  }
  return avaliarDuracaoSessao({ itens, orcamentoSegundos });
}
