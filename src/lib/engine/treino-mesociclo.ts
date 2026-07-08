/**
 * Mesociclo v2 — semana do ciclo, rampa de volume e RIR descendente.
 * Fonte: cofre parametros-motor-treino-evokorpus §"v2 — decisões travadas" +
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
 * Semana do mesociclo (1–6) derivada da âncora. Wrap automático: dia 42 → semana 1.
 * Âncora no futuro / ISO inválida → semana 1 (guard obrigatório: em JS `-1 % 6 === -1`).
 */
export function semanaDoCiclo(inicioISO: string, hojeISO: string): SemanaCiclo {
  const dias = diasEntreISO(inicioISO, hojeISO);
  if (!Number.isFinite(dias) || dias < 0) return 1;
  return ((Math.floor(dias / 7) % MESOCICLO_SEMANAS) + 1) as SemanaCiclo;
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

export interface EstadoCiclo {
  semanaEfetiva: SemanaCiclo;
  /** true na semana 6 (agendado, TODOS os níveis — DF 2026-07-08) ou por gatilho reativo. */
  deload: boolean;
  /**
   * Quando presente, o chamador (Painel) deve PERSISTIR esta âncora no perfil:
   * 1º uso → hoje (todo mundo começa o v2 na semana 1); deload reativo → hoje − 35 d
   * (a derivação cai na semana 6 agora e na semana 1 em exatamente 7 dias).
   */
  novaAncoraISO?: string;
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
}): EstadoCiclo {
  const { mesocicloInicioISO, hojeISO, sinaisFadiga } = args;
  if (!mesocicloInicioISO) {
    // 1º uso / conta migrada do v1: ancora HOJE (semana 1); fadiga já ativa antecipa.
    return sinaisFadiga
      ? { semanaEfetiva: 6, deload: true, novaAncoraISO: isoMaisDias(hojeISO, -35) }
      : { semanaEfetiva: 1, deload: false, novaAncoraISO: hojeISO };
  }
  const semana = semanaDoCiclo(mesocicloInicioISO, hojeISO);
  if (sinaisFadiga && semana !== 6) {
    return { semanaEfetiva: 6, deload: true, novaAncoraISO: isoMaisDias(hojeISO, -35) };
  }
  return { semanaEfetiva: semana, deload: semana === 6 };
}
