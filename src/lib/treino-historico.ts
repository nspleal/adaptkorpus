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
