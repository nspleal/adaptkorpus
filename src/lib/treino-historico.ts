'use client';

import type { ResumoSessao } from '@/components/painel/SessaoTreino';

/**
 * Histórico de treinos concluídos — persistido em localStorage (transitório, mesmo padrão de
 * `evk_aderencia`/`evk_sessao`; migra p/ Supabase na fase de backend, com RLS/minimização).
 *
 * Alimenta os **marcos de constância** (dias distintos de treino) e a **progressão de carga**
 * por exercício. A data (`dataISO`) é carimbada aqui, na UI — o motor segue clock-free.
 */

export interface SessaoHistorico extends ResumoSessao {
  n: number;        // nº sequencial (1 = primeira sessão registrada)
  dataISO: string;  // 'YYYY-MM-DD' — dia em que a sessão foi concluída
  manual?: boolean; // true = registro rápido "treinei por fora" (sem séries/volume/feedback)
}

const KEY = 'evk_treinos';

/** Dia atual em ISO (só na UI). */
export function hojeISO(agora: Date = new Date()): string {
  return agora.toISOString().slice(0, 10);
}

/** Lê o histórico (mais recente primeiro). Robusto a storage ausente/corrompido. */
export function lerHistorico(): SessaoHistorico[] {
  if (typeof window === 'undefined') return [];
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? (arr as SessaoHistorico[]).filter((s) => s && typeof s.dataISO === 'string') : [];
  } catch {
    return [];
  }
}

/** Registra uma sessão concluída (carimba data + nº). Retorna o histórico atualizado. */
export function registrarSessao(resumo: ResumoSessao, agora: Date = new Date()): SessaoHistorico[] {
  const hist = lerHistorico();
  const nova: SessaoHistorico = { ...resumo, n: hist.length + 1, dataISO: hojeISO(agora) };
  const todo = [nova, ...hist];
  try { localStorage.setItem(KEY, JSON.stringify(todo)); } catch { /* storage indisponível */ }
  return todo;
}

/**
 * Registro rápido "treinei por fora" — decisão do cofre (registro-de-aderencia-evokorpus §Marcos,
 * 2026-07-02): "dia de treino registrado" conta QUALQUER treino registrado, não só a sessão guiada.
 * Marca o dia como treinado (sem séries/volume/feedback) → entra na contagem de dias distintos dos
 * marcos, igual a uma sessão concluída. Chamador deve evitar duplicar o mesmo dia (ver `treinouEm`).
 */
export function registrarTreinoManual(agora: Date = new Date()): SessaoHistorico[] {
  const hist = lerHistorico();
  const nova: SessaoHistorico = { dia: 'Treino registrado', series: 0, volumeKg: 0, feedback: {}, exercicios: [], n: hist.length + 1, dataISO: hojeISO(agora), manual: true };
  const todo = [nova, ...hist];
  try { localStorage.setItem(KEY, JSON.stringify(todo)); } catch { /* storage indisponível */ }
  return todo;
}

/** Já existe algum treino (guiado ou manual) registrado nesta data ISO? */
export function treinouEm(hist: SessaoHistorico[], dataISO: string): boolean {
  return hist.some((s) => s.dataISO === dataISO);
}
