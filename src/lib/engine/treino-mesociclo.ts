/**
 * Mesociclo v2 — semana do ciclo, rampa de volume e RIR descendente.
 * Fonte: cofre parametros-motor-treino-adaptkorpus §"v2 — decisões travadas" +
 * outputs/handoff-motor-treino-v2-2026-07-08 (DFs 2026-07-08).
 *
 * Puro e determinístico: o relógio ("hoje") entra SEMPRE por parâmetro.
 * Ciclo = 6 semanas (5 de rampa + 1 de deload); a derivação dá wrap sozinha
 * (dia 42 → semana 1), então o reinício do ciclo não exige escrita.
 */
import {
  MESOCICLO_SEMANAS,
  RAMPA_BANDA_LARGA,
  RIR_ALVO_POR_SEMANA,
} from './treino-constants';
import type { Faixa, FeedbackGrupo, SemanaCiclo } from './treino-types';

/** Dias inteiros entre duas datas ISO (b − a); NaN-safe → 0. */
function diasEntreISO(aISO: string, bISO: string): number {
  const a = Date.parse(`${aISO}T00:00:00Z`);
  const b = Date.parse(`${bISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Data ISO deslocada em `dias` (negativo = passado). Pura (sem relógio). */
export function isoMaisDias(iso: string, dias: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return iso;
  return new Date(t + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Semana do mesociclo (1–6) — conta as semanas em que a pessoa REALMENTE TREINOU:
 *
 *   semana = ((nº de semanas-calendário com ≥ 1 sessão registrada, ANTERIORES à corrente) % 6) + 1
 *
 * Mitigação interina aprovada (DF 2026-07-26, cofre `parametros-motor-treino` §"Fiquei
 * doente" + `plano-pos-feedback-beta` §Leva 1B). O v2 avançava por CALENDÁRIO puro, o que
 * violava um trilho travado desta mesma página — *"é a execução real que dispara a
 * progressão"*: quem parava 2 semanas voltava com volume rampado e RIR mais baixo, sem ter
 * treinado. Continua **função pura** de (âncora, hoje, datas de sessão): sem estado novo,
 * sem migração, e **autocorrige retroativamente** quem já está em uso.
 *
 * A semana CORRENTE é excluída de propósito: se contasse, a prescrição saltaria no instante
 * em que a 1ª sessão da semana fosse registrada.
 *
 * ⚠️ O que ela NÃO faz: quem parou 3 meses volta na MESMA semana, com o MESMO volume. Ela
 * impede a rampa de subir sozinha (o defeito), mas **não é retomada suave** — isso é a spec
 * 2.3 ("fiquei doente"), que depende da pesquisa de destreino.
 *
 * `datasSessao` = datas ISO de sessões de TREINO (o chamador filtra eventos com
 * `sessoesTreino`; sessão manual conta igual à guiada — DF 2026-07-02).
 * Âncora no futuro / ISO inválida → semana 1.
 */
export function semanaDoCiclo(
  inicioISO: string,
  hojeISO: string,
  datasSessao: readonly string[] = [],
): SemanaCiclo {
  const dias = diasEntreISO(inicioISO, hojeISO);
  if (!Number.isFinite(dias) || dias < 0) return 1;
  const semanaCorrente = Math.floor(dias / 7);
  const ativas = new Set<number>();
  for (const data of datasSessao) {
    const d = diasEntreISO(inicioISO, data);
    if (!Number.isFinite(d) || d < 0) continue; // sessão anterior à âncora não conta
    const bucket = Math.floor(d / 7);
    if (bucket < semanaCorrente) ativas.add(bucket); // só as ANTERIORES à corrente
  }
  return ((ativas.size % MESOCICLO_SEMANAS) + 1) as SemanaCiclo;
}

/**
 * Volume-alvo (séries/grupo/semana) da semana da rampa, DENTRO da banda do v1
 * (tabela 1.2 — sem tabela nova): semana 1 = piso; +1/sem (+2 se banda larga) até o
 * topo na semana 5; nunca ultrapassa o topo. `fb === 'segura'` (feedback agregado do
 * grupo) usa o alvo da semana ANTERIOR (piso respeitado). Semana 6 é deload — o corte
 * de volume vem de `aplicarDeload`, não daqui.
 */
export function alvoDaSemana(banda: Faixa, semana: SemanaCiclo, fb: FeedbackGrupo = 'ok'): number {
  const passo = banda.max - banda.min > RAMPA_BANDA_LARGA ? 2 : 1;
  const semanaEfetiva = fb === 'segura' ? Math.max(1, semana - 1) : semana;
  return Math.min(banda.min + (semanaEfetiva - 1) * passo, banda.max);
}

/**
 * RIR-alvo da semana (rampa 3→1; deload volta a 3). O piso da prescrição entra por
 * cima (iniciante ≥ 2; objetivo saúde ≥ 2) — nunca 0 por construção.
 */
export function rirAlvoDaSemana(rir: Faixa, semana: SemanaCiclo): number {
  const base = semana >= 6 ? RIR_ALVO_POR_SEMANA[0]! : RIR_ALVO_POR_SEMANA[semana - 1]!;
  return Math.max(base, rir.min);
}

/** Duração da semana de alívio disparada pelo gatilho REATIVO (fadiga). */
const DELOAD_REATIVO_DIAS = 7;

export interface EstadoCiclo {
  semanaEfetiva: SemanaCiclo;
  /** true na semana 6 (agendado, TODOS os níveis — DF 2026-07-08) ou por gatilho reativo. */
  deload: boolean;
  /**
   * Quando presente, o chamador (Painel) deve PERSISTIR esta âncora no perfil:
   * 1º uso → hoje; deload REATIVO → o FIM do alívio (hoje + 7 d), para que o ciclo novo
   * comece do piso quando o alívio terminar — inclusive se a pessoa treinar durante ele
   * (senão aquele bucket contaria como semana de rampa).
   */
  novaAncoraISO?: string;
  /**
   * Marca explícita do deload REATIVO (persistir junto): enquanto `hoje < deloadAte`, a
   * semana é 6 e o alívio vale. Substitui o truque do `hoje − 35 d`, que só funcionava com
   * derivação por calendário — com contagem por atividade ele não derivaria mais semana 6.
   * Semântica melhor: "fadiga → alívio agora → ciclo novo".
   */
  novoDeloadAteISO?: string;
}

/**
 * Estado do mesociclo desta semana. Junta o gatilho AGENDADO (semana 6) com o REATIVO
 * (≥ 3 "difícil" em ~2 semanas OU sinal explícito de fadiga — v2 §2, precedência: o
 * reativo antecipa o deload e reancora o ciclo). O deload agendado vale para todos os
 * níveis (mesociclo universal — DF 2026-07-08; substitui o "iniciante só reativo" do v1).
 */
export function estadoDoCiclo(args: {
  mesocicloInicioISO: string | null | undefined;
  hojeISO: string;
  sinaisFadiga: boolean;
  /** Datas ISO das sessões de TREINO (já sem eventos) — o relógio agora as conta. */
  datasSessao?: readonly string[];
  /** Marca do deload reativo em curso (persistida); expira sozinha quando hoje a alcança. */
  deloadAteISO?: string | null;
}): EstadoCiclo {
  const { mesocicloInicioISO, hojeISO, sinaisFadiga, datasSessao = [], deloadAteISO } = args;

  // 1) Alívio REATIVO em curso: a marca manda enquanto vale, e nada é reancorado de novo
  //    (a âncora do fim do alívio já foi gravada quando ele começou).
  if (deloadAteISO && hojeISO < deloadAteISO) {
    return { semanaEfetiva: 6, deload: true };
  }

  /** Dispara o alívio reativo: 7 dias de semana 6 e o ciclo novo começa do piso depois. */
  const reativo = (): EstadoCiclo => {
    const fim = isoMaisDias(hojeISO, DELOAD_REATIVO_DIAS);
    return { semanaEfetiva: 6, deload: true, novaAncoraISO: fim, novoDeloadAteISO: fim };
  };

  // 2) 1º uso / conta migrada do v1: ancora HOJE (semana 1); fadiga já ativa antecipa.
  if (!mesocicloInicioISO) {
    return sinaisFadiga ? reativo() : { semanaEfetiva: 1, deload: false, novaAncoraISO: hojeISO };
  }

  // 3) Derivação normal, agora por semanas TREINADAS.
  const semana = semanaDoCiclo(mesocicloInicioISO, hojeISO, datasSessao);
  if (sinaisFadiga && semana !== 6) return reativo();
  return { semanaEfetiva: semana, deload: semana === 6 };
}
