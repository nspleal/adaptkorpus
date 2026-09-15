/**
 * 🦴 COBERTURA ANATÔMICA como critério de ESCOLHA — a ponte entre o mapa dos 168 ids e o
 * alocador.
 *
 * O que ele faz: entre os exercícios que o alocador JÁ considerou elegíveis para um grupo do
 * dia, favorece o que aborda alvos diretos ainda não abordados naquele dia, e evita repetir a
 * mesma ação classificada quando existe alternativa compatível.
 *
 * 🔒 O que ele NÃO faz, e é a razão de ele caber aqui sem reabrir nenhuma regra aprovada:
 *  · não cria slot, série, tempo, descanso, foco, teto nem frequência — entra DEPOIS de o
 *    alocador decidir que um slot existe e a qual grupo ele pertence;
 *  · não muda quem é elegível — equipamento, nível, pool do grupo, trava `puxar ≥ empurrar`,
 *    reserva de core/pequenos/puxar e preferências brandas já existentes continuam decidindo
 *    ANTES; este módulo só desempata entre os que sobreviveram a tudo isso;
 *  · não mexe nos créditos parciais de volume (`PESO_SECUNDARIO`, 0,5): auxiliar continua
 *    valendo o que já valia lá, e cobertura anatômica não é crédito;
 *  · não transforma sinergista em grupo obrigatório. Os alvos desejados de um dia saem dos
 *    grupos que o template JÁ previa — os grupos do pacote que não existem no catálogo
 *    (`adutores`, `flexores_quadril`, `perna_anterior`) nunca viram obrigação;
 *  · não cria peso numérico de ativação ou hipertrofia. O único número é "quantos alvos
 *    novos", uma contagem de presença.
 *
 * 🔴 Ausência de alvo direto NÃO é treino perigoso e NÃO bloqueia nada: vira diagnóstico.
 *
 * PURO e determinístico.
 */
import type { Exercise, GrupoPrimario } from '../data/types';
import type { AlvoId, CondicaoExecucao } from '../data/alvos-anatomicos-tipos';
import type { NivelExperiencia } from './treino-types';
import {
  ALVOS_ANATOMICOS, ANATOMIA_POR_EXERCICIO, RESSALVA_COBERTURA, alvosDoExercicio,
  candidatosParaAlvo,
} from '../data/alvos-anatomicos';
import { temCarga } from './equipamento';
import { faixaSegundos, repUnitDe } from './isometricos';
import { secundariosDe } from './secundarios';

/**
 * 🔒 Os 12 grupos do catálogo têm o MESMO nome no vocabulário de grupos do pacote, e a
 * tradução é a identidade. Escrito como lista explícita (e travado por teste) para que um
 * grupo novo no catálogo, ou um renomeado no pacote, apareça como falha em vez de virar
 * silenciosamente "dia sem alvo nenhum".
 */
export const GRUPOS_COM_ALVOS: readonly GrupoPrimario[] = [
  'antebraco', 'biceps', 'core', 'costas', 'gluteos', 'lombar',
  'ombros', 'panturrilha', 'peito', 'posterior', 'quadriceps', 'triceps',
];

/** grupo do catálogo → alvos daquele grupo, pré-computado (mapa estático; nada muda em runtime). */
const ALVOS_POR_GRUPO: ReadonlyMap<GrupoPrimario, readonly AlvoId[]> = new Map(
  GRUPOS_COM_ALVOS.map((g) => [g, Object.keys(ALVOS_ANATOMICOS).filter((a) => ALVOS_ANATOMICOS[a]!.grupo === g)]),
);

/** id → alvos DIRETOS incondicionais. Condicional fica de fora: sem execução declarada, não cobre. */
const DIRETOS_POR_ID: ReadonlyMap<string, ReadonlySet<AlvoId>> = new Map(
  Object.entries(ANATOMIA_POR_EXERCICIO).map(([id, e]) => [
    id, new Set(e.alvos.filter(([, papel]) => papel === 'direto').map(([alvo]) => alvo)),
  ]),
);

const SEM_ALVO: ReadonlySet<AlvoId> = new Set();

/**
 * Alvos desejados de um dia = os alvos dos grupos que o template do dia JÁ previa.
 *
 * 🔴 Nada é acrescentado: sinergista não vira obrigação, e grupo do pacote que não é grupo do
 * catálogo nunca entra. Id sem grupo (cardio) não chega aqui — o alocador já o exclui dos
 * slots de força.
 */
export function alvosDesejadosDoDia(grupos: readonly GrupoPrimario[]): ReadonlySet<AlvoId> {
  const alvos = new Set<AlvoId>();
  for (const g of grupos) for (const a of ALVOS_POR_GRUPO.get(g) ?? []) alvos.add(a);
  return alvos;
}

/**
 * Alvos DIRETOS incondicionais de um id. Conjunto vazio para id fora do pacote e para e104,
 * cujos alvos são todos condicionais — em nenhum dos dois casos isso afirma que o exercício
 * não trabalha nada.
 */
export function diretosDoExercicio(id: string): ReadonlySet<AlvoId> {
  return DIRETOS_POR_ID.get(id) ?? SEM_ALVO;
}

/** Alvos do dia já abordados diretamente pelos exercícios já colocados nele. */
export function abordadosNoDia(ids: readonly string[], desejados: ReadonlySet<AlvoId>): ReadonlySet<AlvoId> {
  const cobertos = new Set<AlvoId>();
  for (const id of ids) for (const a of diretosDoExercicio(id)) if (desejados.has(a)) cobertos.add(a);
  return cobertos;
}

/**
 * Quantos alvos desejados AINDA NÃO abordados este exercício acrescentaria.
 *
 * 🔴 É contagem de presença, não peso: 2 não significa "o dobro do estímulo". Um exercício
 * pode abordar vários alvos, e não se exige um exercício distinto por cabeça — é exatamente
 * por isso que a conta é de alvos novos, e não de exercícios por alvo.
 */
export function complementoAnatomico(
  id: string,
  desejados: ReadonlySet<AlvoId>,
  jaAbordados: ReadonlySet<AlvoId>,
): number {
  let novos = 0;
  for (const a of diretosDoExercicio(id)) if (desejados.has(a) && !jaAbordados.has(a)) novos += 1;
  return novos;
}

/** A regra (ação classificada) de um id — `null` para id fora do pacote. */
export function regraDoExercicio(id: string): string | null {
  return ANATOMIA_POR_EXERCICIO[id]?.regra ?? null;
}

/**
 * 🔒 CLASSE DE INTERCÂMBIO de um exercício — a trava que impede a cobertura anatômica de
 * comprar tempo, dose, volume ou recuperação.
 *
 * Dois exercícios da MESMA classe são indistinguíveis para todo o resto do motor. Só há seis
 * coisas pelas quais o alocador e o cronômetro enxergam QUEM ocupa um slot (séries, RIR,
 * rampa, degradação e teto são do perfil e da semana, não de quem está no slot):
 *  · `padraoMovimento` — classe de descanso (`descanso.ts`) e TODAS as invariantes de padrão
 *    (`puxar ≥ empurrar`, dobradiça presente, cobertura temporal puxar/empurrar/agachar);
 *  · `tipo` — `pliometrico` é POTENCIA e `cardio` não se aplica, antes do padrão;
 *  · `temCarga` — decide o piso de 180/120 s do composto de alta exigência;
 *  · isometria — usa o hold prescrito no lugar dos 40 s/série (a faixa é por NÍVEL, então a
 *    classe carrega o `min` do nível consultado);
 *  · `UNILATERAL_DOIS_LADOS` — dobra a execução (nunca o descanso);
 *  · **grupos secundários** — são o crédito ponderado de 0,5 (`secundariosDe`, DF① 2026-08-12),
 *    que alimenta o déficit; déficit diferente muda QUANTOS slots cada grupo recebe.
 *
 * 🔴 O sexto item é o que separa "escolher melhor" de "treinar mais". Sem ele, medimos: em
 * Push/Pull/Legs 6d a semana ia de 32 para 34 slots e de 124 para 130 séries — a cobertura
 * anatômica comprando volume que ninguém autorizou. Com ele, o ESQUELETO do plano (dia →
 * grupo → séries → descanso → duração) é idêntico ao de antes, e só a identidade do exercício
 * dentro de cada slot pode mudar.
 *
 * O grupo primário não entra na chave porque o alocador já escolhe dentro de um grupo só.
 */
export function classeDeIntercambio(e: Exercise, nivel: NivelExperiencia): string {
  const isometrico = repUnitDe(e.id) === 'segundos';
  const hold = isometrico ? faixaSegundos(e.id, nivel)?.min ?? 'sem-faixa' : '';
  return [
    e.padraoMovimento,
    e.tipo,
    temCarga(e) ? 'carga' : 'corpo',
    isometrico ? `iso:${hold}` : 'reps',
    e.execucao === 'UNILATERAL_DOIS_LADOS' ? 'dois-lados' : 'um-lado',
    `sec:${[...secundariosDe(e)].sort().join('+')}`,
  ].join('|');
}

function regraNovaNoDia(id: string, regrasNoDia: ReadonlySet<string>): boolean {
  const regra = regraDoExercicio(id);
  return regra != null && !regrasNoDia.has(regra);
}

/** O que o otimizador troca: um slot já alocado (grupo e favorito decididos pelo alocador). */
export interface SlotParaCobertura {
  grupo: GrupoPrimario;
  exercicio: Exercise;
  favorito: boolean;
}

export interface DiaParaCobertura {
  /** Grupos que o TEMPLATE do dia previa — a fonte dos alvos desejados. */
  grupos: readonly GrupoPrimario[];
  slots: SlotParaCobertura[];
}

/** Uma troca efetivamente feita — matéria-prima do diagnóstico e dos testes. */
export interface TrocaAnatomica {
  dia: number;
  slot: number;
  grupo: GrupoPrimario;
  de: string;
  para: string;
  alvosGanhos: readonly AlvoId[];
}

/**
 * 🦴 PASSE FINAL: dentro de cada slot JÁ alocado, escolhe o exercício da MESMA classe de
 * intercâmbio que aumenta a cobertura de alvos diretos do dia.
 *
 * 🔒 Por que é um passe final, e não um desempate dentro do alocador: medimos as duas formas.
 * Desempatando dentro de `escolher`, a escolha diferente movia o cursor de rotação e o
 * conjunto de usados do dia, e os slots SEGUINTES caíam em candidatos de outra classe — a
 * semana ganhava slots (32 → 34), séries (124 → 130) e segundos que a cobertura anatômica não
 * tem o direito de comprar. Como passe final, a alocação inteira roda intocada: dia, grupo,
 * quantidade de slots, séries, descanso, tetos, foco, reservas e invariantes de padrão já
 * estão decididos quando isto começa, e a troca preserva a classe — logo nada disso se move.
 *
 * O que uma troca exige, cumulativamente:
 *  · MESMO grupo do slot (o alocador já decidiu de quem é o slot);
 *  · MESMA classe de intercâmbio (padrão, tipo, carga, isometria, lateralidade, secundários);
 *  · MESMO estado de favorito (DF #12 conta favoritos; a troca não cria nem destrói um);
 *  · id ainda não usado NO DIA (nem nos slots já fixados, nem nos que ainda vêm);
 *  · e **aumentar de verdade** a cobertura do dia — o candidato precisa abordar algum alvo
 *    desejado que NENHUM outro slot do dia aborda.
 *
 * 🔴 MELHORA ESTRITA, e não "empate melhora o desenho". A primeira versão trocava também em
 * empate, usando a ação classificada como critério, e medimos o custo: em Prioridades 4d ela
 * trocava `e22` (barra fixa supinada) por `e162` (remada com elástico) num perfil de academia
 * SEM ganhar um alvo sequer no dia — o pool vem ordenado por popularidade (tier↑, id), e
 * mexer nele de graça piora a escolha do usuário em troca de nada. A ação classificada
 * (`regra`) continua servindo, mas só como DESEMPATE entre candidatos que já ganham o mesmo
 * número de alvos novos: é assim que o dia deixa de repetir a mesma ação quando existe
 * alternativa compatível, sem que "não repetir" vire motivo por si só.
 *
 * Itera até o ponto fixo (cada troca aumenta estritamente a cobertura, então o número de
 * rodadas é limitado pelo número de alvos desejados). Determinístico: dias e slots em ordem,
 * candidatos na ordem do pool, e empate mantém o exercício de antes.
 *
 * @returns as trocas feitas (vazio quando nada mudou).
 */
export function otimizarCoberturaAnatomica(
  dias: readonly DiaParaCobertura[],
  poolPorGrupo: (g: GrupoPrimario, favorito: boolean) => readonly Exercise[],
  nivel: NivelExperiencia,
): TrocaAnatomica[] {
  const trocas: TrocaAnatomica[] = [];
  for (let d = 0; d < dias.length; d += 1) {
    const dia = dias[d]!;
    const desejados = alvosDesejadosDoDia(dia.grupos);
    if (desejados.size === 0) continue;
    const noDia = new Set(dia.slots.map((s) => s.exercicio.id));

    for (let rodada = 0; rodada <= desejados.size; rodada += 1) {
      let mudou = false;
      for (let i = 0; i < dia.slots.length; i += 1) {
        const slot = dia.slots[i]!;
        const atual = slot.exercicio;
        const classe = classeDeIntercambio(atual, nivel);
        /** O que os OUTROS slots do dia já abordam — a régua do ganho real. */
        const porOutros = abordadosNoDia(
          dia.slots.filter((_, k) => k !== i).map((s) => s.exercicio.id), desejados,
        );
        const regrasDosOutros = new Set(dia.slots
          .filter((_, k) => k !== i)
          .map((s) => regraDoExercicio(s.exercicio.id))
          .filter((r): r is string => r != null));
        const ganhoDe = (id: string) => complementoAnatomico(id, desejados, porOutros);

        const referencia = ganhoDe(atual.id);
        let melhor = atual;
        let melhorGanho = referencia;
        let melhorRegraNova = regraNovaNoDia(atual.id, regrasDosOutros);
        for (const candidato of poolPorGrupo(slot.grupo, slot.favorito)) {
          if (candidato.id === atual.id || noDia.has(candidato.id)) continue;
          if (classeDeIntercambio(candidato, nivel) !== classe) continue;
          const ganho = ganhoDe(candidato.id);
          // Só disputa quem melhora de verdade; entre os que melhoram igual, prefere a ação
          // classificada que o dia ainda não tem.
          if (ganho <= referencia) continue;
          const regraNova = regraNovaNoDia(candidato.id, regrasDosOutros);
          if (ganho > melhorGanho || (ganho === melhorGanho && regraNova && !melhorRegraNova)) {
            melhor = candidato; melhorGanho = ganho; melhorRegraNova = regraNova;
          }
        }
        if (melhor.id === atual.id) continue;
        const ganhos = [...diretosDoExercicio(melhor.id)]
          .filter((a) => desejados.has(a) && !porOutros.has(a) && !diretosDoExercicio(atual.id).has(a)).sort();
        trocas.push({ dia: d, slot: i, grupo: slot.grupo, de: atual.id, para: melhor.id, alvosGanhos: ganhos });
        noDia.delete(atual.id);
        noDia.add(melhor.id);
        slot.exercicio = melhor;
        mudou = true;
      }
      if (!mudou) break;
    }
  }
  return trocas;
}

// ── Diagnóstico ─────────────────────────────────────────────────────────────

/** Por que um alvo desejado ficou sem cobertura direta. Nenhum destes é "treino perigoso". */
export type MotivoSemCobertura =
  /** Nenhum exercício do catálogo aborda este alvo diretamente, em condição nenhuma. */
  | 'sem_candidato_no_catalogo'
  /** Existe candidato no catálogo, mas nenhum ficou elegível (equipamento, nível, tempo, teto). */
  | 'sem_candidato_elegivel'
  /** Só candidato CONDICIONAL elegível, e a execução não foi declarada. Não se presume. */
  | 'condicao_de_execucao_nao_declarada'
  /** Havia candidato elegível, e os slots do dia acabaram antes. */
  | 'slots_do_dia_esgotados';

export interface AlvoNaoIdentificado {
  alvo: AlvoId;
  nome: string;
  grupo: string;
  motivo: MotivoSemCobertura;
  /** Ids elegíveis que abordariam o alvo — vazio quando não havia nenhum. */
  candidatosElegiveis: readonly string[];
  /** Condições que resolveriam um candidato condicional elegível, quando é esse o caso. */
  condicoesQueResolveriam: readonly CondicaoExecucao[];
}

export interface DiagnosticoAnatomicoDia {
  dia: string;
  /** Alvos dos grupos que o template do dia previa. */
  desejados: readonly AlvoId[];
  /** Abordados diretamente pelos exercícios escolhidos. */
  abordados: readonly AlvoId[];
  /** O que não foi identificado, com o motivo. 🔴 Diagnóstico, não veredito. */
  naoIdentificados: readonly AlvoNaoIdentificado[];
  /** Participação auxiliar observada nos alvos do dia — visível, e não fecha cobertura. */
  participacaoAuxiliar: readonly AlvoId[];
  ressalva: string;
}

/**
 * Diagnóstico de um dia já montado: o que os alvos previstos pediam e o que a escolha, dentro
 * das restrições vigentes, conseguiu abordar.
 *
 * 🔴 Não propõe exercício novo, não sugere aumentar tempo ou volume e não declara o treino
 * ruim. Diz o que não foi identificado e por quê — nada mais.
 */
export function diagnosticarDia(args: {
  nome: string;
  grupos: readonly GrupoPrimario[];
  idsEscolhidos: readonly string[];
  /** Pool elegível do dia (já filtrado por equipamento/nível/etc. pelo chamador). */
  idsElegiveis: readonly string[];
  slotsDisponiveis: number;
}): DiagnosticoAnatomicoDia {
  const desejados = alvosDesejadosDoDia(args.grupos);
  const abordados = abordadosNoDia(args.idsEscolhidos, desejados);
  const elegiveis = new Set(args.idsElegiveis);
  const sobraSlot = args.idsEscolhidos.length < args.slotsDisponiveis;

  const auxiliares = new Set<AlvoId>();
  for (const id of args.idsEscolhidos) {
    for (const a of alvosDoExercicio(id).alvos) {
      if (a.papel === 'auxiliar' && desejados.has(a.alvo) && !abordados.has(a.alvo)) auxiliares.add(a.alvo);
    }
  }

  const naoIdentificados: AlvoNaoIdentificado[] = [];
  for (const alvo of [...desejados].sort()) {
    if (abordados.has(alvo)) continue;
    const { diretos, condicionais } = candidatosParaAlvo(alvo);
    const diretosElegiveis = diretos.filter((id) => elegiveis.has(id));
    const condicionaisElegiveis = condicionais.filter((id) => elegiveis.has(id));
    const motivo: MotivoSemCobertura =
      diretos.length === 0 && condicionais.length === 0 ? 'sem_candidato_no_catalogo'
        : diretosElegiveis.length === 0 && condicionaisElegiveis.length === 0 ? 'sem_candidato_elegivel'
          : diretosElegiveis.length === 0 ? 'condicao_de_execucao_nao_declarada'
            : sobraSlot ? 'sem_candidato_elegivel' : 'slots_do_dia_esgotados';
    const ficha = ALVOS_ANATOMICOS[alvo]!;
    naoIdentificados.push({
      alvo,
      nome: ficha.nome,
      grupo: ficha.grupo,
      motivo,
      candidatosElegiveis: diretosElegiveis,
      condicoesQueResolveriam: motivo === 'condicao_de_execucao_nao_declarada'
        ? condicionaisElegiveis.flatMap((id) => (ANATOMIA_POR_EXERCICIO[id]!.condicionais)
          .filter((c) => c.papel === 'direto' && c.alvos.includes(alvo))
          .map((c) => c.quando))
        : [],
    });
  }

  return {
    dia: args.nome,
    desejados: [...desejados].sort(),
    abordados: [...abordados].sort(),
    naoIdentificados,
    participacaoAuxiliar: [...auxiliares].sort(),
    ressalva: RESSALVA_COBERTURA,
  };
}
