'use client';

import {
  estadoAposHistorico,
  precisaDeload,
  sugerirProximaVariacao,
  type EstadoExercicio,
  type EventoProgressao,
  type Feedback,
  type PrescricaoFITT,
} from '@/lib/engine';
import { DELOAD_SEMANAS_DEFAULT } from '@/lib/engine/treino-constants';
import type { EquipamentoDisp, Exercise } from '@/lib/data/types';
import type { SessaoHistorico } from '@/lib/treino-historico';

/**
 * Adaptador client da progressão (Passo 2 / Bloco B). Deriva o alvo ATUAL de cada exercício
 * do histórico persistido (`evk_treinos`) — guiada E manual, em ordem cronológica real —
 * dobrando o motor puro `estadoAposHistorico` sobre os feedbacks. Sem `localStorage` novo:
 * a progressão é função pura do histórico (determinismo auditável). O relógio ("hoje") entra
 * por parâmetro; o motor segue clock-free.
 */

export interface ProgressoExercicio {
  estado: EstadoExercicio;
  /** Última ação da progressão (para o hint "subiu de A→B" na UI); null se nunca progrediu. */
  ultimaAcao: string | null;
  /**
   * Hint "sobe de variação" (escada de peso corporal, cofre §Escadas): o próximo degrau
   * da malha, já filtrado por equipamento. `null` quando o exercício está no topo, tem
   * carga, sai da malha, ou o próximo degrau exige implemento indisponível. Só é populado
   * quando `exercises`+`equipamento` são passados a `progressoDosExercicios`.
   */
  proximaVariacao?: { id: string; nome: string } | null;
}

/** Dias inteiros entre duas datas ISO (b − a); NaN-safe → 0. */
function diasEntreISO(aISO: string, bISO: string): number {
  const a = Date.parse(`${aISO}T00:00:00Z`);
  const b = Date.parse(`${bISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Maior carga (kg) logada para um exercício numa sessão (0 se não houver). */
function cargaMaxDaSessao(s: SessaoHistorico, exId: string): number {
  const ex = s.exercicios.find((e) => e.id === exId);
  if (!ex) return 0;
  return ex.sets.reduce((m, r) => Math.max(m, Number(r.kg) || 0), 0);
}

/**
 * Alvo atual de cada exercício (id → estado + última ação), derivado do histórico.
 * `exercicioPorId` resolve o `Exercise` (para o motor saber modo/faixa) — ex.: EXERCISES_SEED.
 */
export function progressoDosExercicios(
  historico: readonly SessaoHistorico[],
  prescricao: PrescricaoFITT,
  exercicioPorId: (id: string) => Exercise | undefined,
  /** Biblioteca + equipamento: quando passados, popula `proximaVariacao` (hint de escada). */
  exercises?: readonly Exercise[],
  equipamento?: EquipamentoDisp,
): Record<string, ProgressoExercicio> {
  // Ordem cronológica real (o histórico vem mais-recente-primeiro; empate no dia → nº de sessão).
  const asc = [...historico].sort((a, b) => (a.dataISO < b.dataISO ? -1 : a.dataISO > b.dataISO ? 1 : a.n - b.n));

  // Eventos por exercício (só exercícios da biblioteca com feedback; customs têm id '' e caem fora).
  const eventosPorId = new Map<string, EventoProgressao[]>();
  for (const s of asc) {
    for (const ex of s.exercicios) {
      const fb = (s.feedback?.[ex.id] ?? ex.fb ?? null) as Feedback | null;
      if (!ex.id || !fb) continue;
      const arr = eventosPorId.get(ex.id) ?? [];
      const cargaMaxKg = cargaMaxDaSessao(s, ex.id);
      arr.push(cargaMaxKg > 0 ? { fb, cargaMaxKg } : { fb });
      eventosPorId.set(ex.id, arr);
    }
  }

  const out: Record<string, ProgressoExercicio> = {};
  for (const [id, eventos] of eventosPorId) {
    const exercicio = exercicioPorId(id);
    if (!exercicio) continue; // exercício saiu da biblioteca — ignora (nunca aplica a outro)
    // Hint de escada (só peso corporal, respeita equipamento). `sugerirProximaVariacao`
    // já devolve null p/ exercícios com carga, no topo, ou fora da malha.
    const prox = exercises && equipamento ? sugerirProximaVariacao(id, exercises, equipamento) : null;
    const proximaVariacao = prox && prox[0] ? { id: prox[0], nome: exercicioPorId(prox[0])?.nomePt ?? prox[0] } : null;
    out[id] = { ...estadoAposHistorico(exercicio, prescricao, eventos), proximaVariacao };
  }
  return out;
}

/**
 * Precisa de "semana de alívio" (deload) esta semana? Deriva do histórico (cofre §Deload):
 * - REATIVO (qualquer nível): fadiga acumulada = ≥3 "difícil" nas últimas ~2 semanas.
 * - AGENDADO (intermediário/avançado): a cada 6 semanas desde a 1ª sessão (iniciante é só reativo).
 * Determinístico e sem estado persistido — reusa `precisaDeload` do motor.
 */
export function precisaDeloadDoHistorico(
  historico: readonly SessaoHistorico[],
  nivel: PrescricaoFITT['nivel'],
  hojeISO: string,
): boolean {
  const datas = historico.map((s) => s.dataISO).filter(Boolean).sort();
  if (datas.length === 0) return false;
  const semanas = Math.floor(diasEntreISO(datas[0]!, hojeISO) / 7);

  const limite = Date.parse(`${hojeISO}T00:00:00Z`) - 14 * 86_400_000;
  const limiteISO = Number.isFinite(limite) ? new Date(limite).toISOString().slice(0, 10) : hojeISO;
  const dificeisRecentes = historico
    .filter((s) => s.dataISO >= limiteISO)
    .reduce((n, s) => n + Object.values(s.feedback ?? {}).filter((f) => f === 'dificil').length, 0);
  const sinaisFadiga = dificeisRecentes >= 3;

  const semanaDeAlivio = semanas > 0 && semanas % DELOAD_SEMANAS_DEFAULT === 0;
  return precisaDeload({ nivel, semanasDesdeUltimoDeload: semanaDeAlivio ? DELOAD_SEMANAS_DEFAULT : 0, sinaisFadiga });
}
