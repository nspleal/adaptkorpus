'use client';

import {
  ACAO_RECALIBRADO,
  estadoAposHistorico,
  precisaDeload,
  sugerirProximaVariacao,
  sugerirVariacaoAnterior,
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
  /** Regressão (V8.3 Estado 5): o degrau ANTERIOR, filtrado por equipamento. */
  variacaoAnterior?: { id: string; nome: string } | null;
  /**
   * true logo após o 2º "difícil" seguido ter disparado regressão no fold — gatilho do
   * cartão de DESCIDA. Derivado dos rótulos LITERAIS de `ultimaAcao` de regressão
   * (`progredirExercicio`): '−10% carga e reconstrói' · '−N s' · '−2 reps' · 'desce 1 variação'.
   * O próximo feedback não-regressivo o limpa naturalmente.
   */
  sugereDescida: boolean;
  /**
   * Degrau ASSUMIDO (B3 — "Assumir este degrau" / calibração por escada): id do exercício
   * efetivo que a sessão/montador devem exibir no lugar do planejado. null = sem adoção.
   * Vem do último evento de calibração com `degrauId` (histórico = fonte única).
   */
  degrauAdotadoId?: string | null;
  /**
   * true quando o ÚLTIMO evento do exercício é uma calibração (B7): a próxima sessão
   * guiada mostra "Sua meta foi recalibrada…" e o hint se consome sozinho quando o
   * feedback seguinte chegar (semântica derivada — sem flag persistida).
   */
  recalibrado: boolean;
}

/** Rótulos de `ultimaAcao` que significam REGRESSÃO (fonte: progredirExercicio). */
const ACOES_REGRESSAO = /^(−|desce 1 variação)/;

/**
 * Exercício EFETIVO a exibir (B3): o degrau adotado quando houver, senão o planejado.
 * Overlay de render — a rotina/chaves de progressão continuam no id original.
 */
export function exercicioEfetivo(
  id: string,
  progresso: Record<string, ProgressoExercicio> | undefined,
  exercicioPorId: (id: string) => Exercise | undefined,
): Exercise | undefined {
  const adotado = progresso?.[id]?.degrauAdotadoId;
  return (adotado ? exercicioPorId(adotado) : undefined) ?? exercicioPorId(id);
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

  // Eventos por exercício: treino (feedback; customs têm id '' e caem fora) + CALIBRAÇÃO
  // (sessões `tipo:'calibracao'` viram o evento correspondente — B2, ordem cronológica real).
  const eventosPorId = new Map<string, EventoProgressao[]>();
  const degrauAdotadoPorId = new Map<string, string>();
  for (const s of asc) {
    for (const ex of s.exercicios) {
      if (!ex.id) continue;
      if (s.tipo === 'calibracao') {
        if (!ex.calibracao) continue; // entrada de calibração sem payload → inerte
        const arr = eventosPorId.get(ex.id) ?? [];
        arr.push({ tipo: 'calibracao', ...ex.calibracao });
        eventosPorId.set(ex.id, arr);
        if (ex.calibracao.degrauId) degrauAdotadoPorId.set(ex.id, ex.calibracao.degrauId);
        continue;
      }
      const fb = (s.feedback?.[ex.id] ?? ex.fb ?? null) as Feedback | null;
      if (!fb) continue; // sessão sem feedback (ex.: só pausado por dor) não progride nada
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
    // Hints de escada ancorados no exercício EFETIVO (degrau adotado quando houver — B3/B6:
    // o degrau absoluto oficial é o do exercício que a pessoa de fato faz).
    const degrauAdotadoId = degrauAdotadoPorId.get(id) ?? null;
    const idEfetivo = degrauAdotadoId ?? id;
    const prox = exercises && equipamento ? sugerirProximaVariacao(idEfetivo, exercises, equipamento) : null;
    const proximaVariacao = prox && prox[0] ? { id: prox[0], nome: exercicioPorId(prox[0])?.nomePt ?? prox[0] } : null;
    const ant = exercises && equipamento ? sugerirVariacaoAnterior(idEfetivo, exercises, equipamento) : null;
    const variacaoAnterior = ant && ant[0] ? { id: ant[0], nome: exercicioPorId(ant[0])?.nomePt ?? ant[0] } : null;
    const r = estadoAposHistorico(exercicio, prescricao, eventos);
    out[id] = {
      ...r,
      proximaVariacao,
      variacaoAnterior,
      sugereDescida: r.ultimaAcao !== null && ACOES_REGRESSAO.test(r.ultimaAcao),
      degrauAdotadoId,
      recalibrado: r.ultimaAcao === ACAO_RECALIBRADO,
    };
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
