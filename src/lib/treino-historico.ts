'use client';

import type { ResumoSessao } from '@/components/painel/SessaoTreino';
import { diaLocalISO } from '@/lib/dia-local';

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
  /**
   * Entradas de EVENTO (não são treino; ausente = sessão de treino normal, legado ok):
   *  - 'calibracao' = calibração manual ("Muito fácil" / "Assumir este degrau" — cofre
   *    DF #13/B2, 2026-07-04);
   *  - 'sinal_fadiga' = botão "estou exausto/muito dolorido" (v2 §2/§6, DF 2026-07-08):
   *    dispara o deload REATIVO; NÃO conta como dia de treino (fora da Chama/Cargas).
   */
  tipo?: 'calibracao' | 'sinal_fadiga';
}

/**
 * Só as sessões de TREINO (exclui entradas de evento — calibração, sinal de fadiga):
 * salvaguarda travada do B2/v2 — evento não conta dia de treino (Chama/marcos) nem
 * alimenta o gráfico de Cargas.
 */
export function sessoesTreino(historico: readonly SessaoHistorico[]): SessaoHistorico[] {
  return historico.filter((s) => !s.tipo);
}

/**
 * A sessão RECÉM-GRAVADA de um histórico devolvido por `registrarSessao(Em)`/
 * `salvarCalibracao`: é a de maior `n` (o contador é `max(n)+1`, único e crescente).
 * Insumo do write-through p/ o servidor (um gancho cobre guiada/manual/calibração).
 */
export function novaSessaoDe(historico: readonly SessaoHistorico[]): SessaoHistorico | null {
  let max: SessaoHistorico | null = null;
  for (const s of historico) if (!max || s.n > max.n) max = s;
  return max;
}

const KEY = 'evk_treinos';

/** Dia atual em ISO (só na UI) — dia LOCAL do usuário, não UTC (às 21h de Brasília,
 *  toISOString() já viraria "amanhã" e inflaria o dedupe do contador). Reusa `diaLocalISO`. */
export function hojeISO(agora: Date = new Date()): string {
  return diaLocalISO(agora);
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
  resumo: ResumoSessao, dataISO: string, extra?: { manual?: boolean; hora?: string; obs?: string; tipo?: SessaoHistorico['tipo'] },
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

/**
 * Substitui o histórico local pela cópia do SERVIDOR (hidratação logada: o servidor
 * vence; o localStorage vira cache — regra do write-through da persistência). Reordena
 * decrescente por data (empate: n maior primeiro), o invariante de `lerHistorico`.
 */
export function substituirHistorico(sessoes: readonly SessaoHistorico[]): SessaoHistorico[] {
  const ordenado = [...sessoes].sort((a, b) => b.dataISO.localeCompare(a.dataISO) || b.n - a.n);
  try { localStorage.setItem(KEY, JSON.stringify(ordenado)); } catch { /* storage indisponível */ }
  return ordenado;
}

/**
 * Grava uma CALIBRAÇÃO manual como evento no histórico (B2 — DF 2026-07-04): o alvo
 * continua sendo função pura do `evk_treinos`. Um item por exercício calibrado, com a
 * nova base no payload `calibracao`. `series: 0` + `tipo: 'calibracao'` deixam a entrada
 * fora da Chama e das Cargas (via `sessoesTreino`).
 */
export function salvarCalibracao(
  itens: readonly { id: string; nome: string; calibracao: NonNullable<ResumoSessao['exercicios'][number]['calibracao']> }[],
  agora: Date = new Date(),
): SessaoHistorico[] {
  const resumo: ResumoSessao = {
    dia: 'Calibração manual',
    series: 0,
    volumeKg: 0,
    feedback: {},
    exercicios: itens.map((it) => ({ id: it.id, nome: it.nome, loaded: false, fb: null, sets: [], calibracao: it.calibracao })),
  };
  return registrarSessaoEm(resumo, hojeISO(agora), { tipo: 'calibracao' });
}

/**
 * Grava um SINAL DE FADIGA ("estou exausto/muito dolorido" — v2 §2/§6, DF 2026-07-08)
 * como evento no histórico: dispara o deload REATIVO (o `estadoDoCiclo` antecipa a
 * semana 6 e reancora o ciclo). `tipo: 'sinal_fadiga'` deixa a entrada fora da Chama,
 * das Cargas e da progressão (não é treino). Sincroniza pelo mesmo funil das sessões.
 */
export function registrarSinalFadiga(agora: Date = new Date()): SessaoHistorico[] {
  const resumo: ResumoSessao = { dia: 'Sinal de fadiga', series: 0, volumeKg: 0, feedback: {}, exercicios: [] };
  return registrarSessaoEm(resumo, hojeISO(agora), { tipo: 'sinal_fadiga' });
}

/**
 * Há sinal de fadiga RECENTE (janela de 7 dias)? Alimenta o gatilho reativo do deload
 * (v2 §2). Determinístico: `hojeISO` injetado; a janela de 7 dias casa com a duração da
 * semana de alívio (o sinal "se consome" quando o ciclo novo começa).
 */
export function temSinalFadigaRecente(historico: readonly SessaoHistorico[], hojeISO: string): boolean {
  const limite = Date.parse(`${hojeISO}T00:00:00Z`) - 7 * 86_400_000;
  if (!Number.isFinite(limite)) return false;
  const limiteISO = new Date(limite).toISOString().slice(0, 10);
  return historico.some((s) => s.tipo === 'sinal_fadiga' && s.dataISO >= limiteISO && s.dataISO <= hojeISO);
}
