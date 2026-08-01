/**
 * DIA EXCEDENTE = DIA DE CARDIO (Leva E, spec §🏃 de `parametros-motor-treino-evokorpus`,
 * 2026-07-31).
 *
 * 🔴 O gap que isto fecha: o Passo 3 sempre mandou "dias excedentes → cardio/recuperação", e
 * o app **contava** esses dias (`diasCardioRecuperacao`) sem **construir** nada. A pessoa era
 * informada de N dias de cardio e não recebia item nenhum — e é isso que mantém a entrada
 * unificada de cardio **dormente** desde a Leva 2.
 *
 * PURO e determinístico: sem relógio, sem rede, sem estado. Tudo aqui é regra já travada
 * recombinada — **nenhum número novo entra por esta porta**.
 */
import type { MetaCardio, ModalidadeCardio } from './cardio';

/** Modalidade default do dia excedente — 🔒 caminhada (spec §🏃). */
export const MODALIDADE_PADRAO_DIA: ModalidadeCardio = 'caminhada';

/**
 * O que o dia excedente é.
 *
 * `minutos: null` é o dia de cardio **sem alvo de duração** — o caso do objetivo massa, cuja
 * meta é em SESSÕES. Dizer "30 min" ali seria inventar um número que a spec não dá.
 * `recuperacao` **não prescreve nada**: só diz que o dia está livre.
 */
export type ConteudoDiaExcedente =
  | { tipo: 'cardio'; minutos: number | null; modalidade: ModalidadeCardio }
  | { tipo: 'recuperacao' };

export const DIA_DE_RECUPERACAO: ConteudoDiaExcedente = { tipo: 'recuperacao' };

/** Arredonda a 5 min — a granularidade que a tela de cardio já usa. Piso de 5. */
export function arredondar5(min: number): number {
  if (!Number.isFinite(min) || min <= 0) return 0;
  return Math.max(5, Math.round(min / 5) * 5);
}

/**
 * Conteúdo do dia excedente. 🔒 Regras travadas, todas da spec §🏃:
 *
 *  · **duração = meta semanal ÷ nº de dias excedentes**, arredondada a 5 min;
 *  · **massa não tem meta em minutos** (são 1–2 *sessões*): o dia é cardio **sem duração**
 *    enquanto faltarem sessões e, **batidas as sessões, vira recuperação** — que não
 *    prescreve nada;
 *  · **`ROTEAR` (modo diário) não recebe dia de cardio** — não há meta para quem o gate
 *    excluiu; ele registra o que fizer;
 *  · **na rampa**, a meta já chega multiplicada (`metaCardioComRetomada`) → o dia existe com
 *    duração menor, **sem regra nova aqui**.
 */
export function conteudoDoDiaExcedente(args: {
  /** Meta semanal JÁ escalada pela rampa quando houver (`metaCardioComRetomada`). */
  meta: MetaCardio | null;
  /** Quantos dias excedentes a semana tem (`rotina.diasCardioRecuperacao`). */
  diasExcedentes: number;
  /** O gate roteou (modo diário)? */
  roteado: boolean;
  /** Sessões de cardio JÁ registradas na semana — só a meta em sessões (massa) usa. */
  sessoesFeitas?: number;
  modalidade?: ModalidadeCardio;
}): ConteudoDiaExcedente {
  const { meta, diasExcedentes, roteado } = args;
  const modalidade = args.modalidade ?? MODALIDADE_PADRAO_DIA;
  if (roteado || diasExcedentes < 1 || !meta) return DIA_DE_RECUPERACAO;

  if (meta.tipo === 'sessoes') {
    const feitas = Number.isFinite(args.sessoesFeitas) ? (args.sessoesFeitas as number) : 0;
    if (feitas >= meta.alvo) return DIA_DE_RECUPERACAO;
    return { tipo: 'cardio', minutos: null, modalidade };
  }

  if (meta.alvo <= 0) return DIA_DE_RECUPERACAO;
  const minutos = arredondar5(meta.alvo / diasExcedentes);
  return minutos > 0 ? { tipo: 'cardio', minutos, modalidade } : DIA_DE_RECUPERACAO;
}
