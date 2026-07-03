'use client';

import type { ResumoSessao } from '@/components/painel/SessaoTreino';

/**
 * Histórico de treinos concluídos — persistido em localStorage (transitório, mesmo padrão de
 * `evk_aderencia`/`evk_sessao`; migra p/ Supabase na fase de backend, com RLS/minimização).
 *
 * Alimenta o **contador de treinos** (dias distintos — `chama.ts`) e a **progressão de carga**
 * por exercício. A data (`dataISO`) é carimbada aqui, na UI — o motor segue clock-free.
 * Sessões manuais ("Registrar treino feito") entram NO MESMO formato da sessão guiada
 * (design_handoff_registro_e_contador_treino §Integração) + `manual: true`.
 */

export interface SessaoHistorico extends ResumoSessao {
  n: number;        // nº sequencial (1 = primeira sessão registrada)
  dataISO: string;  // 'YYYY-MM-DD' — dia em que a sessão aconteceu (manual pode ser passado)
  manual?: boolean; // true = registrada pelo formulário "Registrar treino feito"
  hora?: string;    // 'HH:MM' opcional (só registro manual)
  obs?: string;     // observação opcional (só registro manual)
}

const KEY = 'evk_treinos';

/** Dia atual em ISO (só na UI) — dia LOCAL do usuário, não UTC (às 21h de Brasília,
 *  toISOString() já viraria "amanhã" e inflaria o dedupe do contador). */
export function hojeISO(agora: Date = new Date()): string {
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${m}-${d}`;
}

/** Lê o histórico (mais recente primeiro). Robusto a storage ausente/corrompido:
 *  entradas sem os campos estruturais são normalizadas (não derrubam Histórico/Cargas). */
export function lerHistorico(): SessaoHistorico[] {
  if (typeof window === 'undefined') return [];
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(arr)) return [];
    return (arr as SessaoHistorico[])
      .filter((s) => s && typeof s.dataISO === 'string')
      .map((s) => ({
        ...s,
        dia: typeof s.dia === 'string' ? s.dia : 'Treino',
        series: Number.isFinite(s.series) ? s.series : 0,
        volumeKg: Number.isFinite(s.volumeKg) ? s.volumeKg : 0,
        feedback: s.feedback && typeof s.feedback === 'object' ? s.feedback : {},
        exercicios: Array.isArray(s.exercicios) ? s.exercicios : [],
        n: Number.isFinite(s.n) ? s.n : 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Registra uma sessão NA DATA REAL escolhida (regra de produção do handoff: nunca "sempre
 * hoje"). A lista fica em ordem decrescente de data; entre datas iguais, a mais nova entra
 * primeiro. Retorna o histórico atualizado.
 */
export function registrarSessaoEm(
  resumo: ResumoSessao, dataISO: string, extra?: { manual?: boolean; hora?: string; obs?: string },
): SessaoHistorico[] {
  const hist = lerHistorico();
  // n único = maior n existente + 1 (length+1 duplicaria após qualquer entrada descartada).
  const nova: SessaoHistorico = { ...resumo, ...extra, n: hist.reduce((m, s) => Math.max(m, s.n), 0) + 1, dataISO };
  const i = hist.findIndex((s) => s.dataISO <= dataISO);
  const todo = i === -1 ? [...hist, nova] : [...hist.slice(0, i), nova, ...hist.slice(i)];
  try { localStorage.setItem(KEY, JSON.stringify(todo)); } catch { /* storage indisponível */ }
  return todo;
}

/** Registra uma sessão guiada concluída hoje (carimba data + nº). */
export function registrarSessao(resumo: ResumoSessao, agora: Date = new Date()): SessaoHistorico[] {
  return registrarSessaoEm(resumo, hojeISO(agora));
}
