/**
 * Agenda semanal — mapeia as sessões do motor (rotina.dias) sobre os **dias da semana
 * escolhidos** e resolve "hoje". Vive FORA do motor (o motor é determinístico e não lê
 * relógio): a UI passa o índice do dia atual; estas funções são puras.
 *
 * Contrato do handoff "Dias e Preferências" (§4): dias em ordem fixa Seg→Dom; dias
 * SELECIONADOS = treino, os demais = descanso; o rótulo da sessão vem do motor (não inventar).
 */

export type Weekday = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export const ORDEM_SEMANA: Weekday[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export const DIA_LABEL: Record<Weekday, { abbr: string; full: string }> = {
  seg: { abbr: 'Seg', full: 'segunda-feira' },
  ter: { abbr: 'Ter', full: 'terça-feira' },
  qua: { abbr: 'Qua', full: 'quarta-feira' },
  qui: { abbr: 'Qui', full: 'quinta-feira' },
  sex: { abbr: 'Sex', full: 'sexta-feira' },
  sab: { abbr: 'Sáb', full: 'sábado' },
  dom: { abbr: 'Dom', full: 'domingo' },
};

/** Índice do dia atual na ordem Seg(0)…Dom(6). Só na UI (usa relógio). */
export function weekdayHojeIdx(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7; // getDay: 0=Dom…6=Sáb → Seg=0…Dom=6
}

/** Distribuição padrão de N dias de treino na semana (espaçada). Usado como valor inicial
 * do seletor e como retrocompat quando só existe o número de dias. */
export function diasPadrao(n: number): Weekday[] {
  const mapas: Record<number, Weekday[]> = {
    0: [],
    1: ['qua'],
    2: ['seg', 'qui'],
    3: ['seg', 'qua', 'sex'],
    4: ['seg', 'ter', 'qui', 'sex'],
    5: ['seg', 'ter', 'qua', 'qui', 'sex'],
    6: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
    7: [...ORDEM_SEMANA],
  };
  return (mapas[Math.max(0, Math.min(7, Math.round(n)))] ?? mapas[3]!).slice();
}

/** treino = sessão de força do motor · recuperacao = dia ativo excedente (cardio/recuperação
 * que o motor prescreve — `diasCardioRecuperacao`) · descanso = folga. */
export type DiaTipo = 'treino' | 'recuperacao' | 'descanso';

export interface DiaDaSemana {
  idx: number;            // 0=Seg … 6=Dom
  weekday: Weekday;
  abbr: string;
  full: string;
  isTraining: boolean;    // dia ativo (treino OU recuperação)
  isToday: boolean;
  tipo: DiaTipo;
  sessionIdx?: number;    // índice em rotina.dias (só tipo 'treino') — abre a sessão
  sessionLabel?: string;  // 'treino' → nome da sessão do motor; 'recuperacao' → 'Recuperação'
}

/**
 * Monta os 7 dias (Seg→Dom). As `n` sessões de FORÇA do motor vão nos primeiros `n` dias de
 * treino (ordem da semana); os dias ativos EXCEDENTES viram **recuperação** (cardio/recuperação
 * que o motor prescreve como `diasCardioRecuperacao`) — nunca repetimos uma sessão de força nem
 * rotulamos errado. `hojeIdx` vem da UI (relógio), fora do motor.
 */
export function montarSemana(treinoDias: readonly Weekday[], sessoesNomes: readonly string[], hojeIdx: number): DiaDaSemana[] {
  const treino = new Set(treinoDias);
  const n = sessoesNomes.length;
  let li = 0;
  return ORDEM_SEMANA.map((weekday, idx) => {
    const ativo = treino.has(weekday);
    const base = { idx, weekday, abbr: DIA_LABEL[weekday].abbr, full: DIA_LABEL[weekday].full, isTraining: ativo, isToday: idx === hojeIdx };
    if (!ativo) return { ...base, tipo: 'descanso' as const };
    if (li < n) { const sessionIdx = li; li++; return { ...base, tipo: 'treino' as const, sessionIdx, sessionLabel: sessoesNomes[sessionIdx] }; }
    li++;
    return { ...base, tipo: 'recuperacao' as const, sessionLabel: 'Recuperação' };
  });
}

/** Índice (0–6) do próximo dia de FORÇA a partir de hoje (exclui hoje); -1 se nenhum. */
export function proximoTreinoIdx(semana: readonly DiaDaSemana[], hojeIdx: number): number {
  for (let k = 1; k <= 7; k++) {
    const idx = (hojeIdx + k) % 7;
    if (semana[idx]?.tipo === 'treino') return idx;
  }
  return -1;
}
