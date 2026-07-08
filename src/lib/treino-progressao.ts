'use client';

import {
  ACAO_RECALIBRADO,
  estadoAposHistorico,
  feedbackRefinado,
  precisaDeload,
  repUnitDe,
  sugerirProximaVariacao,
  sugerirVariacaoAnterior,
  type EstadoExercicio,
  type EventoProgressao,
  type Feedback,
  type FeedbackGrupo,
  type PrescricaoFITT,
} from '@/lib/engine';
import { DELOAD_SEMANAS_DEFAULT } from '@/lib/engine/treino-constants';
import type { EquipamentoCasa, EquipamentoDisp, Exercise, GrupoPrimario } from '@/lib/data/types';
import { temSinalFadigaRecente, type SessaoHistorico } from '@/lib/treino-historico';

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

/** Evento de treino + os números da sessão (RIR/reps por série — v2 §3) p/ o refinamento. */
type EventoComNumeros = EventoProgressao & { repsMax?: number; rirMin?: number; rirAlvoSessao?: number };

/** Extrai do exercício da sessão o pior RIR e o maior nº de reps registrados nas séries. */
function numerosDaSessao(ex: SessaoHistorico['exercicios'][number]): { repsMax?: number; rirMin?: number } {
  let repsMax: number | undefined;
  let rirMin: number | undefined;
  for (const s of ex.sets) {
    const reps = Number(s.reps);
    if (Number.isFinite(reps) && reps > 0) repsMax = Math.max(repsMax ?? 0, reps);
    const rir = s.rir != null && s.rir !== '' ? Number(s.rir) : NaN;
    if (Number.isFinite(rir) && rir >= 0) rirMin = Math.min(rirMin ?? Infinity, rir);
  }
  return { ...(repsMax != null ? { repsMax } : {}), ...(rirMin != null ? { rirMin } : {}) };
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
  /** Checklist de casa (modelo 2 níveis): o hint respeita o equipamento marcado. */
  equipamentosCasa?: readonly EquipamentoCasa[],
): Record<string, ProgressoExercicio> {
  // Ordem cronológica real (o histórico vem mais-recente-primeiro; empate no dia → nº de sessão).
  const asc = [...historico].sort((a, b) => (a.dataISO < b.dataISO ? -1 : a.dataISO > b.dataISO ? 1 : a.n - b.n));

  // Eventos por exercício: treino (feedback; customs têm id '' e caem fora) + CALIBRAÇÃO
  // (sessões `tipo:'calibracao'` viram o evento correspondente — B2, ordem cronológica real).
  const eventosPorId = new Map<string, EventoComNumeros[]>();
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
      // Números da sessão (RIR por série — v2 §3) acompanham o evento p/ o refinamento
      // adiante (feedbackRefinado, quando o Exercise/faixa está resolvido).
      arr.push({
        fb,
        ...(cargaMaxKg > 0 ? { cargaMaxKg } : {}),
        ...numerosDaSessao(ex),
        ...(s.rirAlvo != null ? { rirAlvoSessao: s.rirAlvo } : {}),
      });
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
    const prox = exercises && equipamento ? sugerirProximaVariacao(idEfetivo, exercises, equipamento, equipamentosCasa) : null;
    const proximaVariacao = prox && prox[0] ? { id: prox[0], nome: exercicioPorId(prox[0])?.nomePt ?? prox[0] } : null;
    const ant = exercises && equipamento ? sugerirVariacaoAnterior(idEfetivo, exercises, equipamento, equipamentosCasa) : null;
    const variacaoAnterior = ant && ant[0] ? { id: ant[0], nome: exercicioPorId(ant[0])?.nomePt ?? ant[0] } : null;
    // Autorregulação (v2 §3): o RIR numérico por série REFINA o feedback qualitativo antes
    // da dobra — `progredirExercicio` fica intocado (trilhos do v1 preservados). Isométricos
    // ficam de fora (segundos, sem RIR). Âncora = RIR-alvo gravado na sessão; sessões
    // antigas caem no piso da prescrição (conservador).
    const esSeg = repUnitDe(id) === 'segundos';
    const faixa = exercicio.padraoMovimento === 'isolado' ? prescricao.repsIsolado : prescricao.repsComposto;
    const eventosRefinados: EventoProgressao[] = eventos.map((ev) => {
      if (ev.tipo === 'calibracao' || esSeg) return ev;
      return {
        ...ev,
        fb: feedbackRefinado({
          fb: ev.fb,
          faixa,
          rirAlvo: ev.rirAlvoSessao ?? prescricao.rir.min,
          repsMax: ev.repsMax,
          rirMin: ev.rirMin,
          modoForca: prescricao.modoForca === true && exercicio.padraoMovimento !== 'isolado',
        }),
      };
    });
    const r = estadoAposHistorico(exercicio, prescricao, eventosRefinados);
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

  const sinaisFadiga = sinaisFadigaDoHistorico(historico, hojeISO);
  const semanaDeAlivio = semanas > 0 && semanas % DELOAD_SEMANAS_DEFAULT === 0;
  return precisaDeload({ nivel, semanasDesdeUltimoDeload: semanaDeAlivio ? DELOAD_SEMANAS_DEFAULT : 0, sinaisFadiga });
}

/**
 * Sinal REATIVO de fadiga (v2 §2, DF 2026-07-08): ≥ 3 "difícil" nas últimas ~2 semanas
 * (regra do v1) OU sinal explícito de fadiga (botão "estou exausto/muito dolorido") nos
 * últimos 7 dias. Alimenta `estadoDoCiclo` (deload reativo, que antecipa a semana 6).
 */
export function sinaisFadigaDoHistorico(historico: readonly SessaoHistorico[], hojeISO: string): boolean {
  const limite = Date.parse(`${hojeISO}T00:00:00Z`) - 14 * 86_400_000;
  const limiteISO = Number.isFinite(limite) ? new Date(limite).toISOString().slice(0, 10) : hojeISO;
  const dificeisRecentes = historico
    .filter((s) => !s.tipo && s.dataISO >= limiteISO)
    .reduce((n, s) => n + Object.values(s.feedback ?? {}).filter((f) => f === 'dificil').length, 0);
  return dificeisRecentes >= 3 || temSinalFadigaRecente(historico, hojeISO);
}

/**
 * Feedback AGREGADO por grupo muscular (v2 §6): grupo com ≥ 2 "difícil" nos últimos 7 dias
 * → 'segura' (o montador NÃO aplica o incremento da semana àquele grupo; alvo = semana
 * anterior). Ausente do mapa = 'ok'. Determinístico: `hojeISO` injetado; janela de 7 dias
 * = a semana corrente do ciclo. Interpretação registrada no handoff ('segura' sem memória).
 */
export function feedbackAgregadoPorGrupo(
  historico: readonly SessaoHistorico[],
  hojeISO: string,
  exercicioPorId: (id: string) => Exercise | undefined,
): Map<GrupoPrimario, FeedbackGrupo> {
  const limite = Date.parse(`${hojeISO}T00:00:00Z`) - 7 * 86_400_000;
  const out = new Map<GrupoPrimario, FeedbackGrupo>();
  if (!Number.isFinite(limite)) return out;
  const limiteISO = new Date(limite).toISOString().slice(0, 10);
  const dificeis = new Map<GrupoPrimario, number>();
  for (const s of historico) {
    if (s.tipo || !s.dataISO || s.dataISO < limiteISO || s.dataISO > hojeISO) continue;
    for (const ex of s.exercicios) {
      if (!ex.id) continue;
      const fb = (s.feedback?.[ex.id] ?? ex.fb ?? null) as Feedback | null;
      if (fb !== 'dificil') continue;
      const grupo = exercicioPorId(ex.id)?.grupoPrimario;
      if (!grupo) continue;
      dificeis.set(grupo, (dificeis.get(grupo) ?? 0) + 1);
    }
  }
  for (const [grupo, n] of dificeis) if (n >= 2) out.set(grupo, 'segura');
  return out;
}
