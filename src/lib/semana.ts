import { formatarDuracaoMinutos } from '@/lib/formatar-duracao';
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

/**
 * `treino` = sessão de FORÇA do motor (o dia misto carrega o cardio em `cardio`) · `cardio` =
 * dia só de cardio, um dia oferecido em que o motor emitiu item · `recuperacao` = dia vago da
 * agenda de força, sem item ·
 * `sem_sessao` = dia de força planejado que o motor declarou não atendido (D14) — não é
 * recuperação nem folga programada · `descanso` = folga.
 *
 * 🔴 `cardio` é rótulo PRÓPRIO, e essa é a metade visível do guard ①: chamar o dia de
 * `'treino'` faria cada um deles abrir a sessão guiada — e abrir cardio como sessão de
 * força corromperia a métrica de ATIVAÇÃO (`sessao_iniciada`), que acabou de ser medida
 * pela primeira vez em produção.
 */
export type DiaTipo = 'treino' | 'cardio' | 'recuperacao' | 'sem_sessao' | 'descanso';

export interface DiaDaSemana {
  idx: number;            // 0=Seg … 6=Dom
  weekday: Weekday;
  abbr: string;
  full: string;
  isTraining: boolean;    // dia ativo (treino, cardio ou recuperação)
  isToday: boolean;
  tipo: DiaTipo;
  sessionIdx?: number;    // índice em rotina.dias (só tipo 'treino') — abre a sessão
  sessionLabel?: string;  // 'treino' → nome da sessão do motor; 'recuperacao' → 'Recuperação'
  /**
   * 🔒 Índice em `rotina.diasCardio` — ARRAY SEPARADO de propósito. Nunca é `sessionIdx`:
   * quem consome `sessionIdx` abre a sessão guiada e dispara `sessao_iniciada`.
   */
  cardioIdx?: number;
  /** O item do dia de cardio (modalidade + duração), quando houver. */
  cardio?: { modalidade: string; minutos: number | null };
}

/**
 * Monta os 7 dias (Seg→Dom). As `n` sessões de FORÇA do motor vão nos primeiros `n` dias de
 * treino (ordem da semana), ou no dia explícito de cada uma; o cardio fica no dia que o motor
 * emitiu; os dias vagos da agenda viram **recuperação** — nunca repetimos uma sessão de força
 * nem rotulamos errado. `hojeIdx` vem da UI (relógio), fora do motor.
 */
export function montarSemana(
  treinoDias: readonly Weekday[],
  sessoesNomes: readonly string[],
  hojeIdx: number,
  /**
   * Dias de cardio EMITIDOS pelo motor (`rotina.diasCardio`), cada um no seu dia. Ausente =
   * nenhum cardio: o dia vago vira `recuperacao`, sem item.
   */
  diasCardio: readonly { modalidade: string; minutos: number | null; diaId?: string; ordemNoHorizonte?: number }[] = [],
  sessoesDias: readonly (Weekday | undefined)[] = [],
  /** Dias de força planejados que o motor declarou não atendidos (`rotina.diasNaoAtendidos`). */
  naoAtendidos: readonly { diaId?: string; nome: string }[] = [],
): DiaDaSemana[] {
  // A sessão explícita não muda de dia quando a disponibilidade do perfil muda.
  if (sessoesNomes.length > 0 && sessoesDias.length === sessoesNomes.length && sessoesDias.every(d => d != null)) {
    const semana = montarSemana(treinoDias, [], hojeIdx, diasCardio, [], naoAtendidos);
    return semana.map(d => {
      const sessionIdx = sessoesDias.indexOf(d.weekday);
      return sessionIdx < 0 ? d : { ...d, tipo: 'treino' as const, isTraining: true, sessionIdx, sessionLabel: sessoesNomes[sessionIdx] };
    });
  }
  const treino = new Set(treinoDias);
  const n = sessoesNomes.length;
  const cardioPorDia = new Map<Weekday, { item: (typeof diasCardio)[number]; indice: number }>();
  diasCardio.forEach((item, indice) => {
    // `ordemNoHorizonte` é a posição na semana (seg = 0), a mesma do motor e do crítico — não
    // a posição entre os dias de treino, que só coincide numa agenda contígua a partir de seg.
    // Item sem dia não tem onde ficar: o cardio nunca ocupa um dia vago por conta própria.
    const dia = item.diaId ?? (item.ordemNoHorizonte != null ? ORDEM_SEMANA[item.ordemNoHorizonte] : undefined);
    if (dia != null && (ORDEM_SEMANA as readonly string[]).includes(dia)) cardioPorDia.set(dia as Weekday, { item, indice });
  });
  let li = 0;
  return ORDEM_SEMANA.map((weekday, idx) => {
    const ativo = treino.has(weekday);
    const cardioExato = cardioPorDia.get(weekday);
    const base = {
      idx, weekday, abbr: DIA_LABEL[weekday].abbr, full: DIA_LABEL[weekday].full,
      isTraining: ativo || cardioExato != null, isToday: idx === hojeIdx,
    };
    // 🔒 As `n` sessões de FORÇA primeiro, sempre. Cardio canônico pode coexistir no MESMO dia,
    // mas nunca recebe `sessionIdx` próprio nem desloca a musculação.
    if (ativo && li < n) {
      const sessionIdx = li++;
      return {
        ...base, tipo: 'treino' as const, sessionIdx, sessionLabel: sessoesNomes[sessionIdx],
        ...(cardioExato ? { cardioIdx: cardioExato.indice, cardio: cardioExato.item } : {}),
      };
    }
    // Dia só de cardio: o dia oferecido em que o motor emitiu item. 🔴 Nunca `sessionIdx` — o
    // índice é do outro array.
    if (cardioExato) {
      const item = cardioExato.item;
      return {
        ...base, tipo: 'cardio' as const, cardioIdx: cardioExato.indice, cardio: item,
        sessionLabel: item.minutos != null ? `Cardio · ${formatarDuracaoMinutos(item.minutos)}` : 'Cardio',
      };
    }
    if (!ativo) return { ...base, tipo: 'descanso' as const };
    // 🔴 D14 — o dia pedido que ficou sem sessão não vira recuperação na faixa.
    const naoAtendido = naoAtendidos.find((d) => d.diaId === weekday);
    if (naoAtendido) return { ...base, isTraining: false, tipo: 'sem_sessao' as const, sessionLabel: naoAtendido.nome };
    // Dia vago da agenda de força: recuperação, que não prescreve nada.
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

/**
 * 🔒 A SESSÃO DE FORÇA DE **HOJE** — `null` quando hoje não é dia de treino.
 *
 * 🔴 Existe porque a tela Hoje se contradizia (DF 2026-08-04, varredura de produção): o
 * cartão "Treino de hoje" lia `rotinaDias[0]` — a **primeira sessão da rotina, sempre** —
 * enquanto a faixa "Sua semana" mapeava o dia do calendário. Numa terça de `seg/ter/qui/sex`
 * a faixa dizia *Lower A* e o cartão dizia *Upper A*; o cartão só acertava no dia que calha
 * de mapear para a sessão 0, **1 em 7**, e num dia de descanso anunciava treino nenhum.
 *
 * 🔑 **Fonte única, e por isso esta função existe em vez de um `[0]` corrigido:** ela deriva
 * de `montarSemana`, a MESMA que desenha a faixa. Duas leituras do "treino de hoje" são duas
 * verdades para o mesmo dia — e foi assim que o defeito nasceu.
 */
export function sessaoDeHojeIdx(
  treinoDias: readonly Weekday[],
  sessoesNomes: readonly string[],
  hojeIdx: number,
  diasCardio: readonly { modalidade: string; minutos: number | null; diaId?: string; ordemNoHorizonte?: number }[] = [],
  sessoesDias: readonly (Weekday | undefined)[] = [],
): number | null {
  return montarSemana(treinoDias, sessoesNomes, hojeIdx, diasCardio, sessoesDias)[hojeIdx]?.sessionIdx ?? null;
}
