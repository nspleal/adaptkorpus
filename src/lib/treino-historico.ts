'use client';

import type { ResumoSessao } from '@/components/painel/SessaoTreino';
import { diaLocalISO } from '@/lib/dia-local';
import { chaveLocal } from '@/lib/escopo-local';

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
   * Classificação da entrada (ausente = sessão de treino RESISTIDO, o caso legado):
   *  - 'calibracao' = calibração manual ("Muito fácil" / "Assumir este degrau" — cofre
   *    DF #13/B2, 2026-07-04);
   *  - 'sinal_fadiga' = botão "estou exausto/muito dolorido" (v2 §2/§6, DF 2026-07-08);
   *  - 'cardio' = sessão de CARDIO (Leva 2 · Bloco 1). É treino para a Chama, mas **não**
   *    para o relógio do mesociclo nem para a rampa de retomada.
   */
  tipo?: 'calibracao' | 'sinal_fadiga' | 'cardio';
  /** Payload do cardio (só em `tipo: 'cardio'`) — ver `lib/engine/cardio`. */
  cardio?: { modalidade: string; intensidade: string; minutos: number; met: number; kcal: number };
}

/** Entradas que NÃO são treino nenhum (não contam dia, não entram em progressão). */
const EVENTOS = new Set(['calibracao', 'sinal_fadiga']);

/**
 * Sessões que contam como DIA DE TREINO — para a Chama e o histórico. Inclui o CARDIO
 * (🔒 "cardio conta para a Chama, sem piso de duração": a DF "dia de treino = qualquer
 * treino registrado" nasceu inclusiva, e excluir cardio faria a Chama dizer "isso não foi
 * treino"). Exclui só as entradas de evento (calibração, sinal de fadiga).
 */
export function sessoesTreino(historico: readonly SessaoHistorico[]): SessaoHistorico[] {
  return historico.filter((s) => !s.tipo || !EVENTOS.has(s.tipo));
}

/**
 * Sessões de treino RESISTIDO — o balde que move o **relógio do mesociclo** e a **rampa de
 * retomada**. 🔒 Cardio fica de fora de propósito (armadilha 2 do handoff da Leva 2): se
 * caísse no mesmo balde, uma pedalada subiria a rampa de volume da musculação e desfaria o
 * fix `9ebf1bd` que está em produção. Cardio também **não encerra a pausa** da retomada.
 */
export function sessoesResistidas(historico: readonly SessaoHistorico[]): SessaoHistorico[] {
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

const KEY = 'evk_treinos' as const;

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
    const arr = JSON.parse(localStorage.getItem(chaveLocal(KEY)) || '[]');
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
  resumo: ResumoSessao, dataISO: string,
  extra?: { manual?: boolean; hora?: string; obs?: string; tipo?: SessaoHistorico['tipo']; cardio?: SessaoHistorico['cardio'] },
): SessaoHistorico[] {
  const hist = lerHistorico();
  // n único = maior n existente + 1 (length+1 duplicaria após qualquer entrada descartada).
  const nova: SessaoHistorico = { ...resumo, ...extra, n: hist.reduce((m, s) => Math.max(m, s.n), 0) + 1, dataISO };
  const i = hist.findIndex((s) => s.dataISO <= dataISO);
  const todo = i === -1 ? [...hist, nova] : [...hist.slice(0, i), nova, ...hist.slice(i)];
  try { localStorage.setItem(chaveLocal(KEY), JSON.stringify(todo)); } catch { /* storage indisponível */ }
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
  try { localStorage.setItem(chaveLocal(KEY), JSON.stringify(ordenado)); } catch { /* storage indisponível */ }
  return ordenado;
}

/** Chave estável de uma sessão p/ reconciliação local × servidor. */
function chaveSessao(s: SessaoHistorico): string {
  return `${s.dataISO}|${s.n}|${s.tipo ?? 'treino'}`;
}

/**
 * Reconciliação local × servidor (fix do bug bloqueador 2026-07-08 — cofre
 * outputs/bug-persistencia-e-avatar): a hidratação NUNCA destrói dado local.
 *  - Chaves compartilhadas → o SERVIDOR vence (regra do write-through; 2º device coerente).
 *  - Sessões SÓ-locais (write-through silenciosamente perdido — ex.: 401 intermitente)
 *    sobrevivem na união e saem em `faltantes` p/ o chamador RE-SUBIR ao servidor
 *    (a re-migração é o retry — paridade com o self-heal do profile no boot).
 * Em particular: servidor `[]` + local não-vazio ⇒ união = local e tudo é faltante
 * (antes: `substituirHistorico([])` gravava '[]' e APAGAVA o evk_treinos).
 * Pura e determinística; a união sai na ordem canônica de `substituirHistorico`.
 */
export function reconciliarHistorico(
  locais: readonly SessaoHistorico[],
  doServidor: readonly SessaoHistorico[],
): { uniao: SessaoHistorico[]; faltantes: SessaoHistorico[] } {
  const noServidor = new Set(doServidor.map(chaveSessao));
  const faltantes = locais.filter((s) => !noServidor.has(chaveSessao(s)));
  const uniao = [...doServidor, ...faltantes].sort((a, b) => b.dataISO.localeCompare(a.dataISO) || b.n - a.n);
  return { uniao, faltantes };
}

// ---- Pesos registrados (evk_pesos) ------------------------------------------
// Fix 2026-07-08: pesos eram SÓ memória (resetavam a cada reload se o write-through
// falhasse). Passam a ter cópia local, mesmo padrão offline-first dos demais dados.

const KEY_PESOS = 'evk_pesos' as const;

/**
 * 🔒 A série de pesos passa a carregar DATA (Leva D, DF 2026-07-31).
 *
 * 🔴 O bloqueio que isto remove: `evk_pesos` era `number[]` e a rota devolvia `number[]`,
 * descartando o `data`/`created_at` que a tabela `logs` guarda. **Sem data não existe janela
 * de 7 dias** — e a suavização é o que impede pesagem crua de bater no gate.
 *
 * ⚠️ NÃO se contorna assumindo "uma pesagem por dia, a mais recente é hoje": isso produz a
 * média de uma série que não aconteceu, e quem lê essa média é o GATE. Dado fabricado no
 * eixo do tempo, no lugar em que menos se pode errar.
 *
 * **Retrocompatível:** entrada antiga (número puro) entra com `dataISO: null` — **não conta
 * na janela** (conservador) **mas continua no gráfico**: é peso válido, só sem eixo de tempo
 * utilizável. Perder o ponto trocaria um defeito por outro.
 */
export interface RegistroPeso {
  /** Dia declarado da pesagem. `null` = registro legado, sem data. */
  dataISO: string | null;
  kg: number;
}

/** Aceita `number` (legado) e `{dataISO,kg}` (novo), devolvendo sempre o novo. */
function normalizarRegistroPeso(v: unknown): RegistroPeso | null {
  if (Number.isFinite(v)) return { dataISO: null, kg: v as number };
  if (v && typeof v === 'object') {
    const o = v as { dataISO?: unknown; kg?: unknown };
    if (Number.isFinite(o.kg)) {
      return { dataISO: typeof o.dataISO === 'string' ? o.dataISO : null, kg: o.kg as number };
    }
  }
  return null;
}

/** Lê a série de pesos (ordem de registro). Robusto a storage ausente/corrompido/legado. */
export function lerPesos(): RegistroPeso[] {
  if (typeof window === 'undefined') return [];
  try {
    const arr = JSON.parse(localStorage.getItem(chaveLocal(KEY_PESOS)) || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizarRegistroPeso).filter((r): r is RegistroPeso => r !== null);
  } catch {
    return [];
  }
}

/** Só os valores, para quem desenha o gráfico (inclui os legados, sem data). */
export function lerPesosKg(): number[] {
  return lerPesos().map((r) => r.kg);
}

/**
 * Acrescenta um peso à cópia local, com a data do dia. Write-through: o servidor recebe em
 * paralelo. A gravação já migra o formato — os legados são reescritos com `dataISO: null`,
 * sem perder ponto nenhum.
 */
export function registrarPesoLocal(pesoKg: number, dataISO: string = hojeISO()): RegistroPeso[] {
  const todos = [...lerPesos(), { dataISO, kg: pesoKg }];
  try { localStorage.setItem(chaveLocal(KEY_PESOS), JSON.stringify(todos)); } catch { /* storage indisponível */ }
  return todos;
}

/** Substitui a cópia local pela série do SERVIDOR (hidratação com servidor não-vazio). */
export function substituirPesos(pesos: readonly (RegistroPeso | number)[]): RegistroPeso[] {
  const arr = pesos.map(normalizarRegistroPeso).filter((r): r is RegistroPeso => r !== null);
  try { localStorage.setItem(chaveLocal(KEY_PESOS), JSON.stringify(arr)); } catch { /* storage indisponível */ }
  return arr;
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
 * Grava uma sessão de CARDIO (Leva 2 · Bloco 1, DF 2026-07-27) como entrada própria do
 * histórico. 🔒 `tipo: 'cardio'` é o que a mantém FORA do balde do relógio do mesociclo
 * (`sessoesResistidas`) e DENTRO da Chama (`sessoesTreino`) — as duas travas da spec.
 * `series: 0` / `volumeKg: 0` deixam o gráfico de Cargas intacto.
 */
export function registrarCardioEm(
  payload: NonNullable<SessaoHistorico['cardio']>,
  dataISO: string,
  hora?: string,
): SessaoHistorico[] {
  const resumo: ResumoSessao = { dia: 'Cardio', series: 0, volumeKg: 0, feedback: {}, exercicios: [] };
  return registrarSessaoEm(resumo, dataISO, { tipo: 'cardio', ...(hora ? { hora } : {}), cardio: payload });
}

/** Cardio de hoje (carimba dia local + hora — o relógio fica aqui, na UI). */
export function registrarCardio(
  payload: NonNullable<SessaoHistorico['cardio']>,
  agora: Date = new Date(),
): SessaoHistorico[] {
  const hh = String(agora.getHours()).padStart(2, '0');
  const mm = String(agora.getMinutes()).padStart(2, '0');
  return registrarCardioEm(payload, hojeISO(agora), `${hh}:${mm}`);
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
