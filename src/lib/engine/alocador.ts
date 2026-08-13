/**
 * 🔢 v4 — ALOCADOR POR VOLUME PONDERADO (leva B, handoff-motor-volume-v4-2026-08-12).
 *
 * O defeito que substitui (relatorio-medicao-v3-2026-08-12): o nº de slots era
 * `d.padroes.length` — uma lista de PADRÕES escrita à mão — e nenhuma linha do motor
 * perguntava "este grupo foi coberto?". Resultado medido: 14 slots/semana fixos, 7 de 12
 * grupos com ZERO séries, iniciante com MAIS slots que avançado.
 *
 * O que entra no lugar, pelas 3 DFs do autor (2026-08-12):
 *  · **DF① contagem ponderada** — primário 1,0 · secundário 0,5 (`secundarios.ts`), nunca
 *    exibida ao usuário como "meia série";
 *  · **DF② cobertura** — grandes na banda; pequenos (bíceps/tríceps/panturrilha) com piso
 *    direto de 1–2 exercícios/semana; core mantém a invariante própria (2–3×/sem);
 *    lombar/antebraço SÓ por indireto;
 *  · **DF③ divisões** — Sup/Inf como padrão; divisão por prioridades como OPÇÃO
 *    (`divisaoPreferida`); `auto` = padrão por dias disponíveis.
 *
 * O template do dia vira uma lista de GRUPOS-ALVO (dados, não código); os slots do dia vêm
 * do orçamento de tempo (`orcamentoSlotsDoDia`); cada slot é dado ao grupo do template com
 * MAIOR déficit ponderado. As séries continuam sendo decididas pela rampa do mesociclo
 * (`alvoDaSemana`) no montador — o alocador muda ONDE elas moram, não a progressão.
 *
 * 🏷️ politica · v4.0 · 2026-08-12 · origem: §1.2 + DFs ①②③.
 *
 * PURO e determinístico.
 */
import type { Exercise, GrupoPrimario, PadraoMovimento } from '../data/types';
import type { DivisaoPreferida, NivelExperiencia } from './treino-types';
import { PESO_SECUNDARIO, secundariosDe } from './secundarios';

/** DF②: quem é banda, quem é piso, quem é só-indireto. */
export const GRUPOS_GRANDES: readonly GrupoPrimario[] = ['peito', 'costas', 'quadriceps', 'posterior', 'gluteos', 'ombros'];
export const GRUPOS_PEQUENOS_PISO: readonly GrupoPrimario[] = ['biceps', 'triceps', 'panturrilha'];
export const GRUPOS_SO_INDIRETO: readonly GrupoPrimario[] = ['lombar', 'antebraco'];

/** Piso direto dos pequenos (DF②: "1–2 exercícios/semana") e teto que o acompanha. */
export const PEQUENOS_PISO_DIRETO = 1;
export const PEQUENOS_TETO_DIRETO = 2;
/** Nas prioridades o usuário COMPROU o dia de braços (ex. do autor: 3 bíceps + 3 tríceps,
 *  além do dia de costas+bíceps) — o teto semanal acompanha a escolha. */
/** Na divisão por prioridades o dia de braços do autor pede 2–3 por grupo (aceite B). */
export const PEQUENOS_TETO_DIRETO_PRIORIDADES = 5;

/**
 * 🔒 Orçamento de slots do dia = f(tempo) — handoff B1.1, substituindo o
 * `Math.min(d.padroes.length, …)` (defeito E3: a tabela velha saturava em 4).
 * Pontos dados: ≤20→3 · 25–30→4 · 35–45→5 · 50–60→6 · ≥75→7. As lacunas (21–24, 61–74)
 * resolvem para o degrau de CIMA do teto ≤: 21–24→4 · 61–74→6.
 */
export function orcamentoSlotsDoDia(tempoMin: number): number {
  if (tempoMin <= 20) return 3;
  if (tempoMin <= 30) return 4;
  if (tempoMin <= 45) return 5;
  if (tempoMin <= 60) return 6;
  if (tempoMin < 75) return 6;
  return 7;
}

export interface TemplateDia {
  nome: string;
  /** Grupos-ALVO do dia, em ordem de prioridade (desempate do déficit). */
  grupos: readonly GrupoPrimario[];
}

// ── Templates por divisão (DF③ — dados, não código) ─────────────────────────
// Sup/Inf ×2 é transcrição LITERAL do handoff B1.2. Full-body em variantes A/B/C para a
// rotação variar exercícios entre os dias.
const FULL_A: TemplateDia = { nome: 'Full-body A', grupos: ['peito', 'costas', 'quadriceps', 'posterior', 'core', 'ombros', 'gluteos', 'biceps', 'panturrilha', 'triceps'] };
const FULL_B: TemplateDia = { nome: 'Full-body B', grupos: ['costas', 'peito', 'posterior', 'quadriceps', 'gluteos', 'ombros', 'core', 'triceps', 'panturrilha', 'biceps'] };
// ⚠️ costas ANTES de quadriceps no C: o desempate por ordem do template decide os últimos
// slots da semana, e o puxar é o padrão que a trava do empurrar precisa ver coberto.
const FULL_C: TemplateDia = { nome: 'Full-body C', grupos: ['costas', 'quadriceps', 'peito', 'posterior', 'ombros', 'core', 'gluteos', 'panturrilha', 'biceps', 'triceps'] };
const UPPER_A: TemplateDia = { nome: 'Upper A', grupos: ['peito', 'costas', 'ombros', 'biceps'] };
const LOWER_A: TemplateDia = { nome: 'Lower A', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha', 'core'] };
const UPPER_B: TemplateDia = { nome: 'Upper B', grupos: ['peito', 'costas', 'ombros', 'triceps'] };
const LOWER_B: TemplateDia = { nome: 'Lower B', grupos: ['posterior', 'quadriceps', 'gluteos', 'core', 'panturrilha'] };
const PUSH_A: TemplateDia = { nome: 'Push A', grupos: ['peito', 'ombros', 'triceps'] };
const PULL_A: TemplateDia = { nome: 'Pull A', grupos: ['costas', 'biceps', 'core'] };
const LEGS_A: TemplateDia = { nome: 'Legs A', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha'] };
const PUSH_B: TemplateDia = { nome: 'Push B', grupos: ['peito', 'ombros', 'triceps'] };
const PULL_B: TemplateDia = { nome: 'Pull B', grupos: ['costas', 'biceps', 'core'] };
const LEGS_B: TemplateDia = { nome: 'Legs B', grupos: ['posterior', 'quadriceps', 'gluteos', 'panturrilha', 'core'] };
/** Prioridades (DF③ — exemplo do autor, 4 dias): peito+ombros / costas+bíceps(+antebraço
 *  se déficit — com a DF② ele nunca tem alvo direto, então fica documental) / pernas
 *  completas / braços+core. */
const PRIORIDADES_4: TemplateDia[] = [
  { nome: 'Peito + Ombros', grupos: ['peito', 'ombros'] },
  { nome: 'Costas + Bíceps', grupos: ['costas', 'biceps', 'antebraco'] },
  { nome: 'Pernas', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha'] },
  { nome: 'Braços + Core', grupos: ['biceps', 'triceps', 'core'] },
];

function templatesAuto(diasForca: number, nivel: NivelExperiencia): { split: string; dias: TemplateDia[] } {
  switch (diasForca) {
    case 1: return { split: 'Full-body', dias: [{ ...FULL_A, nome: 'Full-body' }] };
    case 2: return { split: 'Full-body ×2', dias: [FULL_A, FULL_B] };
    case 3:
      return nivel === 'iniciante'
        ? { split: 'Full-body ×3', dias: [FULL_A, FULL_B, FULL_C] }
        : { split: 'Upper / Lower / Full', dias: [{ ...UPPER_A, nome: 'Upper' }, { ...LOWER_A, nome: 'Lower' }, { ...FULL_C, nome: 'Full-body' }] };
    case 4: return { split: 'Upper / Lower ×2', dias: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] };
    case 5: return { split: 'PPL + Upper/Lower', dias: [{ ...PUSH_A, nome: 'Push' }, { ...PULL_A, nome: 'Pull' }, { ...LEGS_A, nome: 'Legs' }, { nome: 'Upper', grupos: ['peito', 'costas', 'ombros', 'biceps', 'triceps'] }, { nome: 'Lower', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha', 'core'] }] };
    default: return { split: 'Push / Pull / Legs ×2', dias: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B] };
  }
}

function templatesSupInf(diasForca: number): { split: string; dias: TemplateDia[] } | null {
  switch (diasForca) {
    case 2: return { split: 'Upper / Lower', dias: [{ ...UPPER_A, nome: 'Upper' }, { ...LOWER_A, nome: 'Lower' }] };
    case 3: return { split: 'Upper / Lower / Full', dias: [{ ...UPPER_A, nome: 'Upper' }, { ...LOWER_A, nome: 'Lower' }, { ...FULL_C, nome: 'Full-body' }] };
    case 4: return { split: 'Upper / Lower ×2', dias: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] };
    case 5: return { split: 'Upper / Lower ×2 + Full', dias: [UPPER_A, LOWER_A, UPPER_B, LOWER_B, { ...FULL_C, nome: 'Full-body' }] };
    case 6: return { split: 'Upper / Lower ×3', dias: [UPPER_A, LOWER_A, UPPER_B, LOWER_B, { nome: 'Upper C', grupos: ['peito', 'costas', 'ombros', 'biceps', 'triceps'] }, { nome: 'Lower C', grupos: ['quadriceps', 'posterior', 'gluteos', 'panturrilha', 'core'] }] };
    default: return null; // 1 dia: Sup/Inf não existe — cai no auto (full-body)
  }
}

/** Os templates da semana pela divisão escolhida (DF③). `auto` = padrão por dias. */
export function templatesDaSemana(
  diasForca: number,
  nivel: NivelExperiencia,
  divisao: DivisaoPreferida = 'auto',
): { split: string; dias: TemplateDia[] } {
  if (divisao === 'superior-inferior') {
    const t = templatesSupInf(diasForca);
    if (t) return t;
  }
  if (divisao === 'prioridades') {
    // A DF③ definiu o exemplo de 4 dias; os demais caem no auto (documentado no handoff
    // como derivação futura — sem template travado, não se inventa um).
    if (diasForca === 4) return { split: 'Prioridades (4 dias)', dias: PRIORIDADES_4 };
  }
  return templatesAuto(diasForca, nivel);
}

// ── O alocador ───────────────────────────────────────────────────────────────

export interface SlotAlocado {
  grupo: GrupoPrimario;
  exercicio: Exercise;
  /** true quando o exercício entrou pelo trilho dos favoritos/preferidos/recentes. */
  favorito: boolean;
}

export interface DiaAlocado {
  nome: string;
  slots: SlotAlocado[];
}

export interface ArgsAlocacao {
  templates: readonly TemplateDia[];
  /** Slots que cabem no dia (f do tempo por sessão). */
  budgetPorDia: number;
  /** Pool JÁ filtrado (equipamento + nível + banidos/preteridos), ordenado (tier↑, id). */
  pool: readonly Exercise[];
  /** Favoritos efetivos (favoritos + preferidos de troca + recentes da retomada). */
  favoritos: ReadonlySet<string>;
  /** Alvo semanal PONDERADO por grupo — banda.max do nível/objetivo (estável no ciclo). */
  alvoPonderado: ReadonlyMap<GrupoPrimario, number>;
  /** Séries de planejamento por slot (seriesPorExercicio.max — pior caso da rampa). */
  seriesPlanejamento: number;
  /** Teto de slots DIRETOS do grupo na semana (pequenos: DF②; demais: sem teto). */
  tetoSlotsSemana: (g: GrupoPrimario) => number;
  /** Invariante própria do core (2–3 slots/semana — travada). */
  coreMin: number;
  coreMax: number;
  /**
   * Prioridades (DF③): o dia por tema preenche até o orçamento MESMO sem déficit — o
   * usuário comprou o tema do dia, e o crédito indireto vindo de outros dias não pode
   * esvaziá-lo. Fora das prioridades o dia para quando os déficits acabam.
   */
  preencherAteOrcamento?: boolean;
}

/** Um dia comporta reservar um acessório além do core? (≥ 3 slots livres p/ os grandes —
 *  em orçamento curto o piso do acessório cede ao tempo, nunca o contrário.) */
const RESERVA_MINIMO_GRANDES = 3;

/**
 * Aloca os slots da semana por déficit ponderado. Determinístico por construção: os
 * empates resolvem pela ordem do template, e a escolha de exercício pela ordem do pool
 * (tier↑, id) com cursor de rotação POR GRUPO (favoritos primeiro, isentos da rotação —
 * DF #12 preservada).
 */
export function alocarSemana(args: ArgsAlocacao): DiaAlocado[] {
  const { templates, budgetPorDia, pool, favoritos, alvoPonderado, seriesPlanejamento } = args;

  // Pools por grupo. 🔒 Padrão 'cardio' fica FORA dos slots de força (como sempre ficou:
  // o alocador velho nunca listava 'cardio' nos templates; o e151 pliométrico continua
  // entrando só pelo dia de cardio).
  const porGrupo = new Map<GrupoPrimario, Exercise[]>();
  const favPorGrupo = new Map<GrupoPrimario, Exercise[]>();
  for (const e of pool) {
    if (e.grupoPrimario == null || e.padraoMovimento === 'cardio') continue;
    const alvo = favoritos.has(e.id) ? favPorGrupo : porGrupo;
    const arr = alvo.get(e.grupoPrimario) ?? [];
    arr.push(e);
    alvo.set(e.grupoPrimario, arr);
  }
  const temPool = (g: GrupoPrimario) => (porGrupo.get(g)?.length ?? 0) + (favPorGrupo.get(g)?.length ?? 0) > 0;

  const cursor = new Map<GrupoPrimario, number>();
  /**
   * Próximo exercício do grupo: favoritos primeiro (sem repetir no dia), depois rotação.
   *  `prefira` — preferência BRANDA (dobradiça): tenta com ela, cai sem ela;
   *  `proiba` — trava DURA (puxar ≥ empurrar): candidato proibido nunca sai daqui —
   *  vale inclusive para favorito, porque favorito nunca fura invariante (DF #12).
   */
  function escolher(
    g: GrupoPrimario,
    usadosDia: ReadonlySet<string>,
    opts?: { prefira?: (e: Exercise) => boolean; proiba?: (e: Exercise) => boolean },
  ): Exercise | null {
    // Favorito é ISENTO da trava (`proiba`): a DF #12 o quer em toda sessão em que couber,
    // e o balanço puxar≥empurrar fecha nos picks não-favoritos (verificação post-hoc avisa
    // se um caso de borda não fechar).
    for (const f of favPorGrupo.get(g) ?? []) {
      if (usadosDia.has(f.id)) continue;
      return f;
    }
    const arr = porGrupo.get(g);
    if (!arr || arr.length === 0) return null;
    const i0 = cursor.get(g) ?? 0;
    // 1ª passada com a preferência (se houver); 2ª sem — nunca se deixa de preencher o
    // slot por causa de uma preferência de padrão.
    for (const comPreferencia of opts?.prefira ? [true, false] : [false]) {
      for (let k = 0; k < arr.length; k += 1) {
        const e = arr[(i0 + k) % arr.length]!;
        if (usadosDia.has(e.id)) continue;
        if (opts?.proiba?.(e)) continue;
        if (comPreferencia && opts?.prefira && !opts.prefira(e)) continue;
        cursor.set(g, i0 + k + 1);
        return e;
      }
    }
    return null;
  }

  // Crédito ponderado PLANEJADO (séries de planejamento × peso) — a moeda do déficit.
  const credito = new Map<GrupoPrimario, number>();
  const soma = (g: GrupoPrimario, v: number) => credito.set(g, (credito.get(g) ?? 0) + v);
  const creditar = (e: Exercise) => {
    if (e.grupoPrimario) soma(e.grupoPrimario, seriesPlanejamento);
    for (const g of secundariosDe(e)) soma(g, seriesPlanejamento * PESO_SECUNDARIO);
  };
  const deficit = (g: GrupoPrimario) => (alvoPonderado.get(g) ?? 0) - (credito.get(g) ?? 0);

  const slotsDiretos = new Map<GrupoPrimario, number>();
  const contaPadrao = new Map<PadraoMovimento, number>();
  const dias: DiaAlocado[] = templates.map((t) => ({ nome: t.nome, slots: [] }));

  const coreSlots = () => slotsDiretos.get('core') ?? 0;
  const podeReceber = (g: GrupoPrimario): boolean => {
    if (!temPool(g)) return false;
    if ((slotsDiretos.get(g) ?? 0) >= args.tetoSlotsSemana(g)) return false;
    return deficit(g) > 0;
  };

  function registrar(diaIdx: number, g: GrupoPrimario, e: Exercise, usadosDia: Set<string>): void {
    dias[diaIdx]!.slots.push({ grupo: g, exercicio: e, favorito: favoritos.has(e.id) });
    usadosDia.add(e.id);
    creditar(e);
    slotsDiretos.set(g, (slotsDiretos.get(g) ?? 0) + 1);
    contaPadrao.set(e.padraoMovimento, (contaPadrao.get(e.padraoMovimento) ?? 0) + 1);
  }

  /**
   * Tenta dar o slot ao grupo `g`.
   *
   * 🔒 puxar ≥ empurrar POR CONSTRUÇÃO (invariante travada — saúde do ombro): enquanto os
   * empurrares alcançam os puxares, nenhum exercício de `empurrar` entra — o grupo entra
   * com um exercício de OUTRO padrão (peito/ombros têm isolado de sobra), e o próximo
   * puxar colocado libera a trava. É a recusa do alocador velho, no nível novo (exercício,
   * não padrão). ⚠️ Uma versão que ADIAVA o grupo bloqueado (em vez de desviar o padrão)
   * saiu: ela transferia sistematicamente os slots do peito para quem nunca bloqueia, e o
   * peito fechava abaixo da banda. Favorito é isento no pick (ver `escolher`); o balanço
   * semanal segue verificado no montador.
   */
  function colocar(diaIdx: number, g: GrupoPrimario, usadosDia: Set<string>): boolean {
    // O teto de slots diretos vale por QUALQUER porta (rodadas, reservas, preenchimento):
    // sem esta checagem aqui, a reserva do piso furava o teto dos pequenos.
    if ((slotsDiretos.get(g) ?? 0) >= args.tetoSlotsSemana(g)) return false;
    // Garantia da cadeia posterior: enquanto a semana não tem dobradiça, os grupos que ela
    // serve preferem um exercício de dobradiça (a invariante vinha de graça no alocador
    // velho, que montava por padrão; aqui ela vira preferência explícita).
    const deveDobradica = (contaPadrao.get('dobradica_quadril') ?? 0) === 0 && (g === 'posterior' || g === 'gluteos' || g === 'lombar');
    /**
     * Preferências BRANDAS de escolha dentro do grupo (nunca deixam slot vazio):
     *  · lombar/antebraço descobertos (DF②: cobertura SÓ por indireto) — a rosca que pega
     *    antebraço vence a rosca simples;
     *  · SÓ nos acessórios (pequenos): o exercício que credita um GRANDE ainda deficitário
     *    vence o que não credita nada — é o tríceps-que-toca-peito fechando a banda do
     *    peito quando os slots diretos acabaram. Estreita de propósito: aplicada aos
     *    grandes ela reordenava escolhas demais e desestabilizava fixtures travadas.
     */
    const alvos = new Set<GrupoPrimario>(GRUPOS_SO_INDIRETO.filter((x) => (credito.get(x) ?? 0) <= 0));
    if ((GRUPOS_PEQUENOS_PISO as readonly string[]).includes(g)) {
      for (const grande of GRUPOS_GRANDES) if (deficit(grande) > 0) alvos.add(grande);
    }
    const prefira = deveDobradica
      ? (x: Exercise) => x.padraoMovimento === 'dobradica_quadril'
      : alvos.size > 0
        ? (x: Exercise) => secundariosDe(x).some((s) => alvos.has(s))
        : undefined;
    const travaEmpurrar = (contaPadrao.get('empurrar') ?? 0) >= (contaPadrao.get('puxar') ?? 0);
    const e = escolher(g, usadosDia, {
      prefira,
      proiba: travaEmpurrar ? (x) => x.padraoMovimento === 'empurrar' : undefined,
    });
    if (!e) return false;
    registrar(diaIdx, g, e, usadosDia);
    return true;
  }

  const diasComGrupoNoTemplate = (g: GrupoPrimario) =>
    templates.map((t, i) => ({ t, i })).filter(({ t }) => t.grupos.includes(g)).map(({ i }) => i);

  /**
   * ── Passo 1: RESERVA do core (invariante 2–3×/semana, travada) ─────────────
   * O core não disputa déficit: cada dia cujo template o lista (até `coreMax` dias) reserva
   * 1 slot, preenchido DEPOIS do passo 2 — core fecha a sessão, como sempre fechou. Isso
   * também torna a contagem de core determinística por template (U/L ×2 → 2 · FB ×3 → 3),
   * em vez de refém da disputa de déficit.
   */
  const reservadosCore = new Set(diasComGrupoNoTemplate('core').slice(0, args.coreMax));

  /**
   * ── Passo 1b: RESERVA do piso dos pequenos (DF② — ≥ 1 exercício direto/semana) ─────
   * Igual ao core: bíceps/tríceps/panturrilha não disputam a banda com os grandes — cada
   * um reserva 1 slot num dia cujo template o lista, preenchido depois. A reserva só
   * existe onde o orçamento comporta (dia com ≥ 3 slots livres para os grandes): em tempo
   * curto o piso do acessório cede ao tempo, nunca o contrário.
   */
  const reservaPequeno = new Map<number, GrupoPrimario[]>();
  for (const g of GRUPOS_PEQUENOS_PISO) {
    if (!temPool(g)) continue;
    const candidatosDia = diasComGrupoNoTemplate(g)
      .map((d) => ({ d, ocupadas: (reservadosCore.has(d) ? 1 : 0) + (reservaPequeno.get(d)?.length ?? 0) }))
      .filter(({ ocupadas }) => budgetPorDia - ocupadas - 1 >= RESERVA_MINIMO_GRANDES)
      .sort((a, b) => a.ocupadas - b.ocupadas || a.d - b.d);
    const alvo = candidatosDia[0];
    if (!alvo) continue;
    reservaPequeno.set(alvo.d, [...(reservaPequeno.get(alvo.d) ?? []), g]);
  }
  const reservasDoDia = (d: number) => (reservadosCore.has(d) ? 1 : 0) + (reservaPequeno.get(d)?.length ?? 0);

  // ── Passo 2: rodadas — cada dia recebe 1 slot por vez, pelo MAIOR déficit ──
  // Round-robin entre os dias (e não dia a dia até encher) para a trava do empurrar
  // enxergar a semana inteira: o puxar do dia de Pull libera o empurrar do dia de Push.
  const usadosPorDia: Set<string>[] = templates.map(() => new Set<string>());
  for (let rodada = 0; rodada < budgetPorDia; rodada += 1) {
    for (let d = 0; d < templates.length; d += 1) {
      const cap = budgetPorDia - reservasDoDia(d);
      if (dias[d]!.slots.length >= cap) continue;
      if (args.preencherAteOrcamento) {
        /**
         * PRIORIDADES (DF③): o dia é POR TEMA — o usuário o comprou, e o crédito indireto
         * vindo de outros dias não pode esvaziá-lo. Os grupos do tema se BALANCEIAM dentro
         * do dia (menos slots neste dia primeiro; empate pela ordem do template), até o
         * orçamento. Lombar/antebraço seguem a nota do autor ("antebraço só se houver
         * déficit") — e com a DF② eles nunca têm alvo direto, então nunca entram.
         */
        const noDia = (g: GrupoPrimario) => dias[d]!.slots.filter((s) => s.grupo === g).length;
        const tema = templates[d]!.grupos
          .filter((g) => g !== 'core' && temPool(g)
            && (slotsDiretos.get(g) ?? 0) < args.tetoSlotsSemana(g)
            && (!(GRUPOS_SO_INDIRETO as readonly string[]).includes(g) || deficit(g) > 0))
          .sort((a, b) => noDia(a) - noDia(b) || templates[d]!.grupos.indexOf(a) - templates[d]!.grupos.indexOf(b));
        for (const g of tema) {
          if (colocar(d, g, usadosPorDia[d]!)) break;
        }
        continue;
      }
      /**
       * 🔒 DF②: "GRANDES na banda + pequenos com PISO direto". Os grandes disputam a banda
       * por déficit; os pequenos têm o piso garantido por RESERVA (passo 1b) e só disputam
       * déficit quando os grandes do dia estão satisfeitos (o 2º exercício deles, até o
       * teto) — sem isso a panturrilha (zero crédito indireto) drenava o 3º de costas.
       */
      const elegiveis = templates[d]!.grupos.filter((g) => g !== 'core' && podeReceber(g));
      const grandes = elegiveis.filter((g) => (GRUPOS_GRANDES as readonly string[]).includes(g));
      const candidatos = grandes.length > 0 ? grandes : elegiveis;
      // argmax do déficit; empate resolve pela ordem do template (estável).
      candidatos.sort((a, b) => deficit(b) - deficit(a) || templates[d]!.grupos.indexOf(a) - templates[d]!.grupos.indexOf(b));
      for (const g of candidatos) {
        if (colocar(d, g, usadosPorDia[d]!)) break;
      }
    }
  }

  // ── Passo 2b: os pequenos reservados entram (piso da DF②) ──────────────────
  for (const [d, gs] of reservaPequeno) {
    for (const g of gs) colocar(d, g, usadosPorDia[d]!);
  }

  // ── Passo 3: o core reservado entra, fechando o dia ─────────────────────────
  // Mesma preferência branda por indireto descoberto: p/ intermediário, a ÚNICA fonte de
  // crédito de lombar é um exercício de core ("Core, lombar") — sem a preferência aqui, a
  // lombar ficaria a zero em todo perfil não-avançado.
  const prefiraCore = (): ((x: Exercise) => boolean) | undefined => {
    const semIndireto = GRUPOS_SO_INDIRETO.filter((x) => (credito.get(x) ?? 0) <= 0);
    return semIndireto.length > 0 ? (x) => secundariosDe(x).some((s) => (semIndireto as readonly string[]).includes(s)) : undefined;
  };
  for (const d of reservadosCore) {
    if (coreSlots() >= args.coreMax) break;
    const e = escolher('core', usadosPorDia[d]!, { prefira: prefiraCore() });
    if (!e) continue;
    dias[d]!.slots.push({ grupo: 'core', exercicio: e, favorito: favoritos.has(e.id) });
    usadosPorDia[d]!.add(e.id);
    creditar(e);
    slotsDiretos.set('core', coreSlots() + 1);
    contaPadrao.set(e.padraoMovimento, (contaPadrao.get(e.padraoMovimento) ?? 0) + 1);
  }
  // Piso do core (2): quando o template dá menos de 2 dias com core (ex.: prioridades),
  // a invariante vence o template — o core entra noutro dia com orçamento, ou substitui
  // o último slot do grupo mais coberto.
  if (templates.length >= 2 && coreSlots() < args.coreMin && temPool('core')) {
    for (let d = templates.length - 1; d >= 0 && coreSlots() < args.coreMin; d -= 1) {
      if (dias[d]!.slots.some((s) => s.grupo === 'core')) continue;
      const e = escolher('core', usadosPorDia[d]!);
      if (!e) continue;
      if (dias[d]!.slots.length < budgetPorDia) {
        dias[d]!.slots.push({ grupo: 'core', exercicio: e, favorito: favoritos.has(e.id) });
      } else {
        const idx = [...dias[d]!.slots.keys()].reverse()
          .sort((a, b) => (slotsDiretos.get(dias[d]!.slots[b]!.grupo) ?? 0) - (slotsDiretos.get(dias[d]!.slots[a]!.grupo) ?? 0))[0];
        if (idx == null) continue;
        const sai = dias[d]!.slots[idx]!;
        slotsDiretos.set(sai.grupo, (slotsDiretos.get(sai.grupo) ?? 1) - 1);
        contaPadrao.set(sai.exercicio.padraoMovimento, (contaPadrao.get(sai.exercicio.padraoMovimento) ?? 1) - 1);
        dias[d]!.slots[idx] = { grupo: 'core', exercicio: e, favorito: favoritos.has(e.id) };
      }
      usadosPorDia[d]!.add(e.id);
      creditar(e);
      slotsDiretos.set('core', coreSlots() + 1);
      contaPadrao.set(e.padraoMovimento, (contaPadrao.get(e.padraoMovimento) ?? 0) + 1);
    }
  }

  // ── Passo 5: dobradiça PRESENTE (invariante travada — cadeia posterior). Em orçamento
  // curto o déficit pode nunca chegar aos grupos que a servem; aí a invariante vence: um
  // exercício de dobradiça substitui o último slot do grupo mais coberto num dia cujo
  // template tenha posterior/glúteos/lombar.
  if (templates.length >= 2 && (contaPadrao.get('dobradica_quadril') ?? 0) === 0) {
    busca:
    for (const gDob of ['posterior', 'gluteos', 'lombar'] as const) {
      for (const d of diasComGrupoNoTemplate(gDob)) {
        const e = escolher(gDob, usadosPorDia[d]!, { prefira: (x) => x.padraoMovimento === 'dobradica_quadril' });
        if (!e || e.padraoMovimento !== 'dobradica_quadril') continue;
        if (dias[d]!.slots.length < budgetPorDia) {
          registrar(d, gDob, e, usadosPorDia[d]!);
          break busca;
        }
        // vítima: o slot (não-core — o core tem invariante própria) do grupo mais coberto.
        const idx = [...dias[d]!.slots.keys()]
          .filter((i) => dias[d]!.slots[i]!.grupo !== 'core')
          .sort((a, b) => (slotsDiretos.get(dias[d]!.slots[b]!.grupo) ?? 0) - (slotsDiretos.get(dias[d]!.slots[a]!.grupo) ?? 0) || b - a)[0];
        if (idx == null) continue;
        const sai = dias[d]!.slots[idx]!;
        slotsDiretos.set(sai.grupo, (slotsDiretos.get(sai.grupo) ?? 1) - 1);
        contaPadrao.set(sai.exercicio.padraoMovimento, (contaPadrao.get(sai.exercicio.padraoMovimento) ?? 1) - 1);
        dias[d]!.slots.splice(idx, 1);
        registrar(d, gDob, e, usadosPorDia[d]!);
        break busca;
      }
    }
  }

  /**
   * ── Passo 6: garantia dos FAVORITOS (DF #12 — "aparece em toda sessão em que o padrão
   * tem slot"). No alocador por padrão isso saía de graça (favoritos preenchiam o slot do
   * padrão primeiro); no alocador por grupo um dia pode fechar sem o GRUPO do favorito
   * mesmo tendo slot do PADRÃO dele. A garantia repõe: em cada dia que tem slot do padrão
   * do favorito e não o tem, o favorito substitui um slot — do MESMO grupo se houver
   * (cobertura intacta), senão do MESMO padrão (contagem de padrões intacta → as
   * invariantes não se movem). Favorito continua sem ADICIONAR slot (DF #12).
   */
  for (const [, favs] of favPorGrupo) {
    for (const f of favs) {
      for (let d = 0; d < dias.length; d += 1) {
        const slots = dias[d]!.slots;
        if (usadosPorDia[d]!.has(f.id)) continue;
        const temPadrao = slots.some((s) => s.exercicio.padraoMovimento === f.padraoMovimento);
        if (!temPadrao) continue;
        // preferência: último slot do mesmo GRUPO não-favorito; senão, do mesmo PADRÃO.
        const doGrupo = [...slots.keys()].reverse().find((i) => slots[i]!.grupo === f.grupoPrimario && !slots[i]!.favorito);
        const doPadrao = doGrupo ?? [...slots.keys()].reverse().find((i) => slots[i]!.exercicio.padraoMovimento === f.padraoMovimento && !slots[i]!.favorito);
        if (doPadrao == null) continue;
        const sai = slots[doPadrao]!;
        // troca de grupo diferente só se o PADRÃO for o mesmo (invariantes por construção).
        if (sai.grupo !== f.grupoPrimario && sai.exercicio.padraoMovimento !== f.padraoMovimento) continue;
        slotsDiretos.set(sai.grupo, (slotsDiretos.get(sai.grupo) ?? 1) - 1);
        contaPadrao.set(sai.exercicio.padraoMovimento, (contaPadrao.get(sai.exercicio.padraoMovimento) ?? 1) - 1);
        slots[doPadrao] = { grupo: f.grupoPrimario ?? sai.grupo, exercicio: f, favorito: true };
        usadosPorDia[d]!.add(f.id);
        creditar(f);
        slotsDiretos.set(f.grupoPrimario ?? sai.grupo, (slotsDiretos.get(f.grupoPrimario ?? sai.grupo) ?? 0) + 1);
        contaPadrao.set(f.padraoMovimento, (contaPadrao.get(f.padraoMovimento) ?? 0) + 1);
      }
    }
  }

  return dias;
}

/**
 * Crédito PONDERADO real de uma semana já montada (séries decididas): direto 1,0 +
 * secundário 0,5. É a régua do guard de cobertura (grande < MEV ⇒ aviso) e do relatório.
 */
export function creditoPonderadoDaSemana(
  slots: readonly { exercicio: Exercise; series?: number }[],
): Map<GrupoPrimario, number> {
  const m = new Map<GrupoPrimario, number>();
  for (const s of slots) {
    const n = s.series ?? 0;
    if (n <= 0) continue;
    const g = s.exercicio.grupoPrimario;
    if (g) m.set(g, (m.get(g) ?? 0) + n);
    for (const sec of secundariosDe(s.exercicio)) m.set(sec, (m.get(sec) ?? 0) + n * PESO_SECUNDARIO);
  }
  return m;
}
