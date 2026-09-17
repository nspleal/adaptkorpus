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

/**
 * 🔵 DECISÃO DO AUTOR 2026-09-16, AMPLIADA EM 2026-09-17 — ordem de DISPENSA no full-body de
 * um dia que não cabe no tempo escolhido. Entra como **E5** da sequência única de redução
 * (`ajuste-tempo-estrutura.ts`): depois de o descanso estar no piso, de os extras do foco
 * terem saído, de as três séries virarem duas e de os exercícios redundantes terem sido
 * retirados. Pára assim que couber; grupo ausente é pulado.
 *
 * 🔒 A ampliação de 17/09 acrescentou **glúteos** à lista. Ela **não** foi generalizada para
 * outras divisões: continua sendo a exceção do full-body curto, e o chamador é quem decide
 * habilitá-la (`permitirDispensa`). Fora dela, o único exercício de cada grupo não sai.
 *
 * 🔒 `antebraco` está aqui por ordem do autor, mas NÃO é um dos dez grupos do full-body
 * vigente (ele é só-indireto, acima): a entrada existe para fixar a ordem caso ele passe a
 * ser coberto, e hoje é sempre pulada — jamais acrescentado só para depois ser retirado.
 *
 * ⚠️ É prioridade de produto para sessão curta. Não é afirmação sobre a importância
 * biológica destes músculos, e a interface não usa essa expressão.
 */
export const GRUPOS_DISPENSAVEIS_FULLBODY_CURTO: readonly GrupoPrimario[] = ['core', 'antebraco', 'panturrilha', 'gluteos'];

/** Piso direto dos pequenos (DF②: "1–2 exercícios/semana") e teto que o acompanha. */
export const PEQUENOS_PISO_DIRETO = 1;
export const PEQUENOS_TETO_DIRETO = 2;
/**
 * Nas prioridades o usuário COMPROU o dia de braços — o teto SEMANAL acompanha a escolha.
 * O 5 é a soma do exemplo do autor: 3 bíceps no dia de braços + 2 no dia de costas+bíceps
 * (`PRIORIDADES_4` lista bíceps em dois dias). ⚠️ Havia aqui um segundo doc-comment dizendo
 * "2–3 por grupo" — número de UM dia, que não explica o teto da semana e contradizia este;
 * saiu na auditoria de 2026-08-14 por não bater com o valor implementado.
 */
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
  /**
   * Slots que o template PEDIU e nenhum grupo do dia pôde preencher. 🔒 Existe para o corte
   * ser DITO — a regra do pedido-casa-dia-curto: "slot pedido não morre em silêncio".
   */
  naoPreenchidos: number;
  /**
   * POR QUE o dia ficou curto — o montador precisa disso para não mentir a causa:
   *  · `catalogo` — nenhum grupo-alvo do dia tem exercício no inventário da pessoa (é o
   *    caso de casa/só peso do corpo: peito/ombros/tríceps só têm `empurrar`, e a invariante
   *    `puxar ≥ empurrar` fecha a porta). Aí a copy fala de equipamento;
   *  · `teto` — há exercício de sobra, mas os grupos do dia já bateram o teto SEMANAL de
   *    slots diretos (academia/avançado/6d: `Pull B` fecha em 4 porque costas e bíceps já
   *    encheram a semana). Aí falar de equipamento seria falso.
   */
  motivoCurto: 'catalogo' | 'teto' | null;
}

export interface ArgsAlocacao {
  templates: readonly TemplateDia[];
  /** Foco estrutural: reservar sua presença por sessão antes de consumir a semana. */
  prioritarios?: readonly GrupoPrimario[];
  /** Complementos já filtrados pelo calendário, somente para lacunas reais. */
  complementosPorDia?: readonly (readonly GrupoPrimario[])[];
  /** Banda vigente: retirar redundância planejada sem furar seu piso. */
  pisoPonderado?: number;
  /** Slots que cabem no dia (f do tempo por sessão). */
  budgetPorDia: number;
  /**
   * 🔒 Degrau ② da cascata do foco (DF 2026-08-14): UM slot sai do compensador e entra no
   * focado, **dentro de um dia que os dois dividem** — slots não atravessam dias. Quem decide
   * se isto acontece é `decidirFoco`, no montador; aqui só se executa a troca já autorizada.
   */
  transferirSlot?: { de: GrupoPrimario; para: GrupoPrimario };
  /**
   * 🔒 C6 — SAÍDA opcional do degrau ②: como a troca autorizada realmente terminou. O
   * montador precisa distinguir "não coube" de "cabia, mas derrubaria `puxar ≥ empurrar`" —
   * só o segundo caso desce o degrau para ORDEM por equilíbrio. Preenchida pelo alocador;
   * ausente preserva as chamadas que não se importam com o desfecho.
   */
  relatoTransferencia?: { executada: boolean; recusadaPeloEquilibrio: boolean };
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
  /**
   * 🔵 O TETO PONDERADO POR SESSÃO, COBRADO NA COMPOSIÇÃO (decisão 2026-09-17). Ausente ⇒
   * nenhum teto de sessão, que é o comportamento de sempre (e o de todo objetivo que não
   * declara um).
   *
   * 🔑 Por que ele mora AQUI e não só na dose: o teto de 12 ponderadas por grupo num dia é
   * cobrado sobre as séries, e cada slot tem PISO de dose (`seriesPorExercicio.min`). Se o dia
   * receber slots demais do mesmo grupo, ele NASCE acima do teto e nenhuma poda o conserta sem
   * furar o piso por exercício. Medido em avançado 6d/90min: 5 slots de peito no mesmo dia
   * (15 no piso, contra 12), e depois 4 slots (12 diretas + 2 indiretas = 14).
   *
   * 🔒 A conta é o PISO do dia: cada slot já colocado vale `seriesPiso` direto e
   * `seriesPiso × 0,5` em cada secundário. Se acrescentar este exercício levasse algum grupo
   * acima do teto JÁ NO PISO, o dia seria indosável — e o slot não entra.
   *
   * 🔒 É COMPOSIÇÃO, não dose: nada aqui muda quantas séries um slot recebe. A dose continua
   * sendo decidida pela rampa, e o excesso que sobra (acima do piso) segue sendo podado lá.
   */
  tetoPonderadoDia?: { teto: number; seriesPiso: number };
  /** Invariante própria do core (2–3 slots/semana — travada). */
  coreMin: number;
  coreMax: number;
  /**
   * Prioridades (DF③): o dia por tema preenche até o orçamento MESMO sem déficit — o
   * usuário comprou o tema do dia, e o crédito indireto vindo de outros dias não pode
   * esvaziá-lo. Fora das prioridades o dia para quando os déficits acabam.
   */
  preencherAteOrcamento?: boolean;
  /** Calendário automático: nenhuma reserva/troca pode sair dos grupos admitidos. */
  respeitarGruposDoDia?: boolean;
  /**
   * Cobertura mínima do plano temporal. Ausente preserva a alocação v4 normal. Quando fornecida,
   * estes padrões ocupam os primeiros slots disponíveis antes das reservas acessórias.
   */
  coberturaTemporalObrigatoria?: readonly ('puxar' | 'empurrar' | 'agachar')[];
  /**
   * 🔁 VARIAÇÃO DA MONTAGEM — o deslocamento INICIAL do cursor de rotação por grupo.
   *
   * 🔒 O que ela faz: começa a rotação de cada grupo noutro ponto do MESMO pool já elegível.
   * 🔴 O que ela NÃO faz: não relaxa filtro nenhum. Equipamento, nível, banidos/preteridos,
   * favoritos, `proiba` (puxar ≥ empurrar), `exigir` (reserva de cobertura), tetos, déficit e
   * templates decidem exatamente como decidiam — a variação só muda por ONDE a varredura de
   * um pool já aprovado começa. Um candidato que a regra recusa continua recusado.
   *
   * 🔒 Determinismo preservado: ela é ENTRADA. Mesmo perfil + mesma variação ⇒ mesma saída,
   * byte a byte. Ausente ou 0 ⇒ o comportamento de sempre.
   */
  variacao?: number;
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

  /** Algum exercício de `puxar` disponível para este grupo? */
  const temPuxar = (g: GrupoPrimario) =>
    (porGrupo.get(g) ?? []).some((x) => x.padraoMovimento === 'puxar')
    || (favPorGrupo.get(g) ?? []).some((x) => x.padraoMovimento === 'puxar');
  /** O dia SÓ consegue colocar `empurrar`? (é ele que a trava mata quando chega cedo) */
  const soEmpurrar = (d: number) => {
    const alvo = templates[d]!.grupos.filter((g) => g !== 'core' && temPool(g));
    if (alvo.length === 0) return false;
    return alvo.every((g) => {
      const opcoes = [...(porGrupo.get(g) ?? []), ...(favPorGrupo.get(g) ?? [])];
      return opcoes.length > 0 && opcoes.every((x) => x.padraoMovimento === 'empurrar');
    });
  };

  /**
   * 🔁 Ponto de partida da rotação. `variacao` desloca o início da varredura do pool de TODO
   * grupo; 0 (o default) reproduz a alocação de sempre. Normalizado para inteiro não-negativo
   * aqui, e não no chamador, para que nenhuma borda (negativo, fracionário, NaN) escape.
   */
  const inicioRotacao = Number.isFinite(args.variacao)
    ? Math.max(0, Math.trunc(args.variacao as number)) : 0;
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
    opts?: {
      prefira?: (e: Exercise) => boolean;
      proiba?: (e: Exercise) => boolean;
      /** Filtro duro inclusive para favoritos; usado somente pela reserva de cobertura. */
      exigir?: (e: Exercise) => boolean;
    },
  ): Exercise | null {
    // Favorito é ISENTO da trava (`proiba`): a DF #12 o quer em toda sessão em que couber,
    // e o balanço puxar≥empurrar fecha nos picks não-favoritos (verificação post-hoc avisa
    // se um caso de borda não fechar).
    for (const f of favPorGrupo.get(g) ?? []) {
      if (usadosDia.has(f.id)) continue;
      if (opts?.exigir && !opts.exigir(f)) continue;
      return f;
    }
    const arr = porGrupo.get(g);
    if (!arr || arr.length === 0) return null;
    const i0 = cursor.get(g) ?? inicioRotacao;
    // 1ª passada com a preferência (se houver); 2ª sem — nunca se deixa de preencher o
    // slot por causa de uma preferência de padrão.
    for (const comPreferencia of opts?.prefira ? [true, false] : [false]) {
      for (let k = 0; k < arr.length; k += 1) {
        const e = arr[(i0 + k) % arr.length]!;
        if (usadosDia.has(e.id)) continue;
        if (opts?.exigir && !opts.exigir(e)) continue;
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
  const dias: DiaAlocado[] = templates.map((t) => ({ nome: t.nome, slots: [], naoPreenchidos: 0, motivoCurto: null }));
  const usadosPorDia: Set<string>[] = templates.map(() => new Set<string>());

  const coreSlots = () => slotsDiretos.get('core') ?? 0;
  const podeReceber = (g: GrupoPrimario): boolean => {
    if (!temPool(g)) return false;
    if ((slotsDiretos.get(g) ?? 0) >= args.tetoSlotsSemana(g)) return false;
    return deficit(g) > 0;
  };

  /** Crédito PONDERADO do dia calculado no PISO da dose — o menor que o dia pode ter. */
  const pisoPorDia: Map<GrupoPrimario, number>[] = templates.map(() => new Map<GrupoPrimario, number>());
  const pisoDoDia = (diaIdx: number) => pisoPorDia[diaIdx]!;
  /** Acrescentar `e` neste dia manteria todos os grupos dentro do teto ponderado da sessão? */
  function cabeNoPisoDoDia(diaIdx: number, e: Exercise): boolean {
    if (!args.tetoPonderadoDia) return true;
    const { teto, seriesPiso } = args.tetoPonderadoDia;
    const piso = pisoDoDia(diaIdx);
    const primario = e.grupoPrimario;
    if (primario && (piso.get(primario) ?? 0) + seriesPiso > teto) return false;
    for (const sec of secundariosDe(e)) {
      if ((piso.get(sec) ?? 0) + seriesPiso * PESO_SECUNDARIO > teto) return false;
    }
    return true;
  }
  function descreditarPiso(diaIdx: number, e: Exercise): void {
    if (!args.tetoPonderadoDia) return;
    const { seriesPiso } = args.tetoPonderadoDia;
    const piso = pisoDoDia(diaIdx);
    const primario = e.grupoPrimario;
    if (primario) piso.set(primario, Math.max(0, (piso.get(primario) ?? 0) - seriesPiso));
    for (const sec of secundariosDe(e)) piso.set(sec, Math.max(0, (piso.get(sec) ?? 0) - seriesPiso * PESO_SECUNDARIO));
  }
  function creditarPiso(diaIdx: number, e: Exercise): void {
    if (!args.tetoPonderadoDia) return;
    const { seriesPiso } = args.tetoPonderadoDia;
    const piso = pisoDoDia(diaIdx);
    const primario = e.grupoPrimario;
    if (primario) piso.set(primario, (piso.get(primario) ?? 0) + seriesPiso);
    for (const sec of secundariosDe(e)) piso.set(sec, (piso.get(sec) ?? 0) + seriesPiso * PESO_SECUNDARIO);
  }

  function registrar(diaIdx: number, g: GrupoPrimario, e: Exercise, usadosDia: Set<string>): void {
    dias[diaIdx]!.slots.push({ grupo: g, exercicio: e, favorito: favoritos.has(e.id) });
    usadosDia.add(e.id);
    creditar(e);
    creditarPiso(diaIdx, e);
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
    // 🔵 …e o teto PONDERADO do dia, pela mesma porta e pelo mesmo motivo (ver `tetoPonderadoDia`).
    // A checagem final (com o exercício já escolhido) fica em `registrar`; aqui só se descarta
    // o grupo cujo piso no dia já está no teto — o caso barato e mais comum.
    if (args.tetoPonderadoDia) {
      const { teto, seriesPiso } = args.tetoPonderadoDia;
      if ((pisoDoDia(diaIdx).get(g) ?? 0) + seriesPiso > teto) return false;
    }
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
      // 🔵 Teto ponderado da sessão: DURO, inclusive para favorito (um favorito nunca fura
      // invariante — a mesma leitura da DF #12 que já vale para `puxar ≥ empurrar`).
      exigir: (x) => cabeNoPisoDoDia(diaIdx, x),
    });
    if (!e) return false;
    // Cobertura antes de redundância: não gastar todos os empurrares permitidos
    // repetindo peito quando outro grupo direto (ex.: ombros sem equipamento)
    // ainda depende desse mesmo padrão para entrar. Não antecipa crédito de puxar.
    if(args.pisoPonderado!=null && (slotsDiretos.get(g)??0)>0 && e.padraoMovimento==='empurrar'
      && GRUPOS_GRANDES.some(outro=>outro!==g&&(slotsDiretos.get(outro)??0)===0&&temPool(outro)
        && templates.some(t=>t.grupos.includes(outro))
        && [...(porGrupo.get(outro)??[]),...(favPorGrupo.get(outro)??[])].some(x=>x.padraoMovimento==='empurrar')))return false;
    registrar(diaIdx, g, e, usadosDia);
    return true;
  }

  const diasComGrupoNoTemplate = (g: GrupoPrimario) =>
    templates.map((t, i) => ({ t, i })).filter(({ t }) => t.grupos.includes(g)).map(({ i }) => i);

  /**
   * C1 · segunda passagem coverage-first. O montador só ativa esta reserva quando a alocação normal
   * falhou na cobertura temporal. `agachar` aceita também dobradiça, igual ao invariante canônico.
   */
  const correspondeCobertura = (padrao: 'puxar' | 'empurrar' | 'agachar', e: Exercise): boolean =>
    e.padraoMovimento === padrao || (padrao === 'agachar' && e.padraoMovimento === 'dobradica_quadril');
  for (const padrao of args.coberturaTemporalObrigatoria ?? []) {
    if ([...contaPadrao].some(([p, n]) => n > 0 && (p === padrao || (padrao === 'agachar' && p === 'dobradica_quadril')))) continue;
    reservar:
    for (let d = 0; d < templates.length; d += 1) {
      if (dias[d]!.slots.length >= budgetPorDia) continue;
      for (const g of templates[d]!.grupos) {
        if (g === 'core' || !temPool(g)) continue;
        const e = escolher(g, usadosPorDia[d]!, { exigir: (x) => correspondeCobertura(padrao, x) && cabeNoPisoDoDia(d, x) });
        if (!e) continue;
        registrar(d, g, e, usadosPorDia[d]!);
        break reservar;
      }
    }
  }

  /**
   * ── Passo 1: RESERVA do core (invariante 2–3×/semana, travada) ─────────────
   * O core não disputa déficit: cada dia cujo template o lista (até `coreMax` dias) reserva
   * 1 slot, preenchido DEPOIS do passo 2 — core fecha a sessão, como sempre fechou. Isso
   * também torna a contagem de core determinística por template (U/L ×2 → 2 · FB ×3 → 3),
   * em vez de refém da disputa de déficit.
   */
  const reservadosCore = new Set(
    diasComGrupoNoTemplate('core').filter((d) => dias[d]!.slots.length < budgetPorDia).slice(0, args.coreMax),
  );

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
      .map((d) => ({ d, ocupadas: dias[d]!.slots.length + (reservadosCore.has(d) ? 1 : 0) + (reservaPequeno.get(d)?.length ?? 0) }))
      // 🔒 O `- PEQUENOS_PISO_DIRETO` é o piso da DF② entrando na conta pelo NOME. Era um
      // `- 1` cravado, com a constante da spec órfã ao lado: dois lugares para o mesmo
      // número, e nada obrigando os dois a concordarem (auditoria 2026-08-14).
      .filter(({ ocupadas }) => budgetPorDia - ocupadas - PEQUENOS_PISO_DIRETO >= RESERVA_MINIMO_GRANDES)
      .sort((a, b) => a.ocupadas - b.ocupadas || a.d - b.d);
    const alvo = candidatosDia[0];
    if (!alvo) continue;
    reservaPequeno.set(alvo.d, [...(reservaPequeno.get(alvo.d) ?? []), g]);
  }
  /**
   * ── Passo 1c: RESERVA de PUXAR (DF do autor, 2026-08-15) ────────────────────────────
   *
   * 🔴 O defeito que fecha, medido depois de importar os 5 puxar de casa: o dia de `Pull`
   * consumia todos, e o `Push` — primeiro da lista — tentava ANTES de o Pull repor `puxar`
   * naquela rodada. A trava `puxar ≥ empurrar` o bloqueava toda vez e ele terminava com
   * **ZERO exercícios** (casa-vazio/avançado/5d). Em casa sem equipamento 100% de
   * peito/ombros/tríceps é `empurrar`, então o dia inteiro morria.
   *
   * 🔒 RESERVA, NUNCA CRÉDITO. A primeira tentativa foi um lookahead — liberar `empurrar`
   * contra o `puxar` que os dias seguintes *poderiam* colocar. Medido: matou os dias vazios
   * (2 → 0) e **quebrou a invariante em 45 combinações**, inclusive em academia, que não
   * tinha defeito nenhum. Promessa não cumprida vira invariante violada no fim da semana, e
   * `puxar ≥ empurrar` é saúde do ombro: não tem tolerância.
   * Aqui o `puxar` é COLOCADO antes das rodadas. Quando o dia só-de-empurrar chega, a conta
   * já está paga — nada é liberado contra o que ainda não existe.
   *
   * BOUND: reserva-se um `puxar` por dia só-de-empurrar (é o que a demanda exige), nunca
   * mais, e só onde existe dia que consiga colocá-lo. Se não couber, o dia encurta — e o
   * corte é DITO pelo montador, como já é regra.
   */
  const reservaPuxar = new Set<number>();
  const quantosSoEmpurrar = templates.map((_, d) => d).filter(soEmpurrar).length;
  if (quantosSoEmpurrar > 0) {
    const diasQuePodemPuxar = templates
      .map((t, d) => ({ d, t }))
      .filter(({ d, t }) => !soEmpurrar(d) && t.grupos.some((g) => g !== 'core' && temPuxar(g)))
      .map(({ d }) => d);
    for (const d of diasQuePodemPuxar.slice(0, quantosSoEmpurrar)) {
      // Só reserva onde ainda sobra orçamento para os grandes do dia — mesma regra do 1b:
      // em tempo curto a reserva cede ao tempo, nunca o contrário.
      const ocupadas = dias[d]!.slots.length + (reservadosCore.has(d) ? 1 : 0) + (reservaPequeno.get(d)?.length ?? 0);
      if (budgetPorDia - ocupadas - 1 < RESERVA_MINIMO_GRANDES) continue;
      reservaPuxar.add(d);
    }
  }

  /**
   * ── Passo 1d: o `puxar` reservado ENTRA, antes das rodadas de déficit ────────────────
   * É o que torna a reserva real: o slot está colocado quando o dia só-de-empurrar chega.
   */
  for (const d of reservaPuxar) {
    const grupoPuxar = templates[d]!.grupos.find((g) => g !== 'core' && temPuxar(g) && podeReceber(g));
    if (!grupoPuxar) continue;
    const e = escolher(grupoPuxar, usadosPorDia[d]!, { prefira: (x) => x.padraoMovimento === 'puxar', exigir: (x) => cabeNoPisoDoDia(d, x) });
    if (!e || e.padraoMovimento !== 'puxar') continue;
    registrar(d, grupoPuxar, e, usadosPorDia[d]!);
  }

  // Decisões 13/09: a sessão do foco precisa existir no plano alocado.
  // Reserva dentro do orçamento e tetos existentes; não altera o alvo de séries.
  // Antebraço explícito pode ocupar um bloco (decisão 25), sem criar banda nova.
  for(const g of args.prioritarios??[])for(const d of diasComGrupoNoTemplate(g)){
    if(g==='core'||dias[d]!.slots.some(s=>s.grupo===g))continue;
    const reservadas=(reservadosCore.has(d)?1:0)+(reservaPequeno.get(d)?.filter(x=>x!==g).length??0);
    if(dias[d]!.slots.length+reservadas>=budgetPorDia)continue;
    if(colocar(d,g,usadosPorDia[d]!))reservaPequeno.set(d,(reservaPequeno.get(d)??[]).filter(x=>x!==g));
  }

  const reservasDoDia = (d: number) => (reservadosCore.has(d) ? 1 : 0) + (reservaPequeno.get(d)?.length ?? 0);

  // ── Passo 2: rodadas — cada dia recebe 1 slot por vez, pelo MAIOR déficit ──
  // Round-robin entre os dias (e não dia a dia até encher) para a trava do empurrar
  // enxergar a semana inteira: o puxar do dia de Pull libera o empurrar do dia de Push.
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
      const ordenar = (lista: GrupoPrimario[]) =>
        [...lista].sort((a, b) => deficit(b) - deficit(a) || templates[d]!.grupos.indexOf(a) - templates[d]!.grupos.indexOf(b));
      /**
       * 🔴 SLOT PEDIDO NÃO MORRE EM SILÊNCIO (pedido-casa-dia-curto-2026-08-13).
       *
       * O defeito medido em CASA: os GRANDES do dia podiam falhar todos — pool do grupo
       * vazio (em "só peso do corpo" ombros/bíceps/antebraço não têm UM exercício) ou o
       * `escolher` bloqueado pela trava `puxar ≥ empurrar` (o pool de puxar tem 1 item, então
       * o empurrar trava cedo) — e o slot simplesmente sumia: `Push A` com 1 de 3 pedidos.
       *
       * 🔒 O conserto é a CASCATA: grandes primeiro (a banda é deles), depois os pequenos do
       * MESMO template. Fora do template não se procura — converter um dia de Push em
       * full-body seria inventar uma divisão que o usuário não pediu; quando nem os pequenos
       * preenchem, o corte é CONTADO e DITO pelo montador (nunca engolido).
       */
      const cascata = [...ordenar(grandes), ...ordenar(elegiveis.filter((g) => !grandes.includes(g)))];
      for (const g of cascata) {
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
      if (args.respeitarGruposDoDia && !templates[d]!.grupos.includes('core')) continue;
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
          if (!cabeNoPisoDoDia(d, e)) continue;
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
        // 🔵 O piso do dia acompanha a troca: sem isto o slot que SAIU seguiria ocupando teto.
        descreditarPiso(d, sai.exercicio);
        if (!cabeNoPisoDoDia(d, e)) { creditarPiso(d, sai.exercicio); dias[d]!.slots.splice(idx, 0, sai);
          slotsDiretos.set(sai.grupo, (slotsDiretos.get(sai.grupo) ?? 0) + 1);
          contaPadrao.set(sai.exercicio.padraoMovimento, (contaPadrao.get(sai.exercicio.padraoMovimento) ?? 0) + 1);
          continue; }
        registrar(d, gDob, e, usadosPorDia[d]!);
        break busca;
      }
    }
  }

  // Decisão 34: completar uma sessão do foco curta só com grupo ainda descoberto,
  // deficitário e compatível. Sem repetir variantes para gastar todo o orçamento.
  for(let d=0;d<dias.length;d++)for(const g of args.complementosPorDia?.[d]??[]){
    if(dias[d]!.slots.length>=budgetPorDia)break;
    if((slotsDiretos.get(g)??0)>0||!podeReceber(g))continue;
    colocar(d,g,usadosPorDia[d]!);
  }

  // As novas divisões não autorizam exceder a banda ponderada existente.
  // Retira apenas slot redundante; nunca aumenta séries nem elimina um grupo.
  const diasSemRedundancia=new Set<number>();
  if(args.pisoPonderado!=null){
    const medir=()=>creditoPonderadoDaSemana(dias.flatMap(d=>d.slots.map(s=>({exercicio:s.exercicio,series:seriesPlanejamento}))));
    let mudou=true;
    while(mudou){
      mudou=false;const antes=medir();
      for(const g of GRUPOS_GRANDES){
        if((antes.get(g)??0)<=(alvoPonderado.get(g)??Infinity))continue;
        // Antes de podar, tente trocar uma contribuição indireta excedente no
        // mesmo grupo/padrão. Pool já elegível; sem reduzir crédito de terceiros,
        // mexer em favoritos, calendário, séries ou quantidade de slots.
        substituicao:for(const dia of dias)for(const slot of dia.slots){
          if(slot.favorito||!secundariosDe(slot.exercicio).includes(g))continue;
          const original=slot.exercicio;
          for(const alternativa of porGrupo.get(slot.grupo)??[]){
            if(alternativa.padraoMovimento!==original.padraoMovimento
              ||dia.slots.some(s=>s.exercicio.id===alternativa.id))continue;
            slot.exercicio=alternativa;const depois=medir();
            if((depois.get(g)??0)<(antes.get(g)??0)
              &&(depois.get(g)??0)>=Math.min(antes.get(g)??0,args.pisoPonderado!)
              &&[...new Set([...antes.keys(),...depois.keys()])].every(x=>x===g||(depois.get(x)??0)===(antes.get(x)??0))){
              mudou=true;break substituicao;
            }
            slot.exercicio=original;
          }
        }
        if(mudou)break;
        busca:for(let d=dias.length-1;d>=0;d--)for(let i=dias[d]!.slots.length-1;i>=0;i--){
          const slot=dias[d]!.slots[i]!;
          if(slot.grupo!==g||dias[d]!.slots.filter(s=>s.grupo===g).length<2||slot.favorito)continue;
          dias[d]!.slots.splice(i,1);const depois=medir();
          const seguro=GRUPOS_GRANDES.every(x=>(depois.get(x)??0)>=Math.min(antes.get(x)??0,args.pisoPonderado!))
            && dias.flatMap(x=>x.slots).filter(s=>s.exercicio.padraoMovimento==='puxar').length>=dias.flatMap(x=>x.slots).filter(s=>s.exercicio.padraoMovimento==='empurrar').length;
          if(seguro && (slot.exercicio.padraoMovimento!=='dobradica_quadril'||dias.some(dia=>dia.slots.some(s=>s.exercicio.padraoMovimento==='dobradica_quadril')))){slotsDiretos.set(g,(slotsDiretos.get(g)??1)-1);diasSemRedundancia.add(d);mudou=true;break busca;}
          dias[d]!.slots.splice(i,0,slot);
        }
        if(mudou)break;
      }
    }
  }

  // A cascata seguinte usa o saldo real após completar/retirar redundância.
  // Nada desta etapa muda os slots depois da transferência contabilizada por C6.
  if(args.pisoPonderado!=null){
    credito.clear();slotsDiretos.clear();contaPadrao.clear();
    for(let d=0;d<dias.length;d++){
      usadosPorDia[d]!.clear();
      for(const s of dias[d]!.slots){creditar(s.exercicio);usadosPorDia[d]!.add(s.exercicio.id);
        slotsDiretos.set(s.grupo,(slotsDiretos.get(s.grupo)??0)+1);
        contaPadrao.set(s.exercicio.padraoMovimento,(contaPadrao.get(s.exercicio.padraoMovimento)??0)+1);
      }
    }
  }

  /**
   * ── Passo 5b: TRANSFERÊNCIA DE SLOT do foco (degrau ② da cascata, DF 2026-08-14).
   *
   * O slot muda de mão DENTRO de um dia que os dois grupos dividem — é a única troca
   * possível, porque o orçamento de slots é por DIA. Sem esta trava, a 1ª tentativa tirou o
   * slot de quem dividia o dia com o focado (glúteos) e zerou o grupo, enquanto o
   * compensador que o usuário nomeou (peito, que treina noutro dia) ficava intocado.
   */
  if (args.transferirSlot) {
    const { de, para } = args.transferirSlot;
    for (let d = 0; d < dias.length; d += 1) {
      if (!templates[d]!.grupos.includes(para)) continue;
      const idx = [...dias[d]!.slots.keys()].reverse().find((i) => dias[d]!.slots[i]!.grupo === de);
      if (idx == null) continue;
      const sai = dias[d]!.slots[idx]!;
      /**
       * 🔒 C6 — A TROCA RESPEITA `puxar ≥ empurrar` COMO TODA OUTRA PORTA DO ALOCADOR.
       *
       * 🔴 O defeito que fecha (fila histórica C6; verificação de 2026-08-17 em `44f0ee0`,
       * ainda viva em `67f5fd9c`): aqui o pick era `escolher(para, …)` SEM trava nenhuma,
       * enquanto `colocar()` aplica `proiba` em todas as outras portas. Medido: foco em
       * `peito` cedido por `biceps` tirava `e74[biceps/isolado]` e punha `e2[peito/empurrar]`
       * — a semana ia de `puxar 2 / empurrar 2` para `2 / 3`, e o montador só AVISAVA
       * depois. A troca é a ÚNICA porta que mexe nos dois lados da conta ao mesmo tempo, por
       * isso a trava aqui é LÍQUIDA (desconta o que sai antes de medir o que entra) em vez
       * da `travaEmpurrar` de `colocar`, que só olha o que entra.
       *
       * ⚠️ `exigir` e não `proiba`: `proiba` isenta favorito (DF #12), e um favorito de
       * `empurrar` entrando aqui quebraria a invariante do mesmo jeito. Favorito não perde
       * slot que já tinha — apenas não ganha um por uma troca que derrubaria o equilíbrio.
       *
       * Sem candidato que preserve o equilíbrio o dia é pulado; esgotados os dias, a troca
       * não acontece e o montador desce o degrau para ORDEM (DF 2026-08-17).
       */
      const puxarSemSaida = (contaPadrao.get('puxar') ?? 0) - (sai.exercicio.padraoMovimento === 'puxar' ? 1 : 0);
      const empurrarSemSaida = (contaPadrao.get('empurrar') ?? 0) - (sai.exercicio.padraoMovimento === 'empurrar' ? 1 : 0);
      const preservaEquilibrio = (x: Exercise) =>
        puxarSemSaida + (x.padraoMovimento === 'puxar' ? 1 : 0)
        >= empurrarSemSaida + (x.padraoMovimento === 'empurrar' ? 1 : 0);
      /**
       * Distingue os dois motivos de recusa SEM mexer no cursor de `escolher`: se havia
       * candidato livre no dia e nenhum preserva o equilíbrio, a recusa é do equilíbrio.
       */
      const livresNoDia = [...(favPorGrupo.get(para) ?? []), ...(porGrupo.get(para) ?? [])]
        .filter((x) => !usadosPorDia[d]!.has(x.id));
      if (livresNoDia.length > 0 && !livresNoDia.some(preservaEquilibrio) && args.relatoTransferencia) {
        args.relatoTransferencia.recusadaPeloEquilibrio = true;
      }
      const e = escolher(para, usadosPorDia[d]!, { exigir: preservaEquilibrio });
      if (!e) continue;
      slotsDiretos.set(sai.grupo, (slotsDiretos.get(sai.grupo) ?? 1) - 1);
      contaPadrao.set(sai.exercicio.padraoMovimento, (contaPadrao.get(sai.exercicio.padraoMovimento) ?? 1) - 1);
      dias[d]!.slots[idx] = { grupo: para, exercicio: e, favorito: favoritos.has(e.id) };
      usadosPorDia[d]!.add(e.id);
      creditar(e);
      slotsDiretos.set(para, (slotsDiretos.get(para) ?? 0) + 1);
      contaPadrao.set(e.padraoMovimento, (contaPadrao.get(e.padraoMovimento) ?? 0) + 1);
      if (args.relatoTransferencia) {
        args.relatoTransferencia.executada = true;
        args.relatoTransferencia.recusadaPeloEquilibrio = false;
      }
      break;
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
        if (args.respeitarGruposDoDia && (f.grupoPrimario == null || !templates[d]!.grupos.includes(f.grupoPrimario))) continue;
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

  /**
   * 🔴 O corte REAL do dia, medido no fim (pedido-casa-dia-curto-2026-08-13).
   *
   * ⚠️ Contar as RODADAS que falharam superestima e foi descartado: uma rodada por déficit
   * pode falhar e o slot ser preenchido depois pela reserva do pequeno ou do core —
   * academia/avançado/6d/60min tem 3 rodadas falhas em `Pull B` e ainda assim fecha o dia
   * cheio. O que o usuário vê — e o que o montador tem direito de DIZER — é o que sobrou
   * vazio no fim: orçamento pedido menos entregue.
   */
  for (let d = 0; d < dias.length; d += 1) {
    const falta = Math.max(0, budgetPorDia - dias[d]!.slots.length);
    dias[d]!.naoPreenchidos = falta;
    if (falta === 0) continue;
    /**
     * A causa, pela MESMA elegibilidade que o alocador usa (`podeReceber` = tem pool, está
     * abaixo do teto semanal E ainda tem déficit) — não uma regra paralela:
     *  · algum grupo do dia AINDA QUERIA volume e mesmo assim o slot ficou vazio ⇒ o que
     *    faltou foi exercício disponível (`catalogo`);
     *  · nenhum grupo do dia queria mais volume ⇒ o dia fechou porque a semana já está paga
     *    (`teto`) — foi o que a medição de 2026-08-13 achou em academia.
     */
    dias[d]!.motivoCurto = !diasSemRedundancia.has(d) && templates[d]!.grupos.some((g) => g !== 'core' && podeReceber(g)) ? 'catalogo' : 'teto';
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
