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

export interface DiaDaSemana {
  idx: number;            // 0=Seg … 6=Dom
  weekday: Weekday;
  abbr: string;
  full: string;
  isTraining: boolean;
  isToday: boolean;
  sessionIdx?: number;    // índice em rotina.dias (só em dia de treino) — abre a sessão
  sessionLabel?: string;  // nome da sessão vindo do motor (só em dia de treino)
}

/**
 * Monta os 7 dias (Seg→Dom). As sessões do motor são distribuídas nos dias de treino, na
 * ordem da semana (round-robin defensivo se contagens divergirem). `hojeIdx` vem da UI.
 */
export function montarSemana(treinoDias: readonly Weekday[], sessoesNomes: readonly string[], hojeIdx: number): DiaDaSemana[] {
  const treino = new Set(treinoDias);
  const n = sessoesNomes.length;
  let li = 0;
  return ORDEM_SEMANA.map((weekday, idx) => {
    const isTraining = treino.has(weekday);
    const base: DiaDaSemana = { idx, weekday, abbr: DIA_LABEL[weekday].abbr, full: DIA_LABEL[weekday].full, isTraining, isToday: idx === hojeIdx };
    if (isTraining && n > 0) {
      const sessionIdx = li % n;
      li++;
      return { ...base, sessionIdx, sessionLabel: sessoesNomes[sessionIdx] };
    }
    return base;
  });
}

/** Índice (0–6) do próximo dia de treino a partir de hoje (exclui hoje); -1 se nenhum. */
export function proximoTreinoIdx(semana: readonly DiaDaSemana[], hojeIdx: number): number {
  for (let k = 1; k <= 7; k++) {
    const idx = (hojeIdx + k) % 7;
    if (semana[idx]?.isTraining) return idx;
  }
  return -1;
}
