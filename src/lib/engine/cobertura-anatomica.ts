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
import { descansoDoExercicio } from './descanso';
import { faixaSegundos, repUnitDe } from './isometricos';
import { PESO_SECUNDARIO, secundariosDe } from './secundarios';

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

/**
 * 🔒 ASSINATURA DE CUSTO de um exercício — a trava que impede a complementaridade de comprar
 * tempo, dose, volume ou recuperação.
 *
 * 🔴 Ela NÃO usa proxies (`padraoMovimento`, `temCarga`). Usa as AUTORIDADES REAIS: chama
 * `descansoDoExercicio` sobre toda a grade de parâmetros que o montador pode produzir (RIR da
 * semana × modo força × rampa de retomada × degradação do orçamento) e junta a unidade de
 * execução. Dois exercícios com a mesma assinatura ocupam exatamente o mesmo tempo em qualquer
 * semana, qualquer perfil e qualquer degradação — trocar um pelo outro não move duração,
 * certificação, nº de slots, séries, descanso, deload nem a escada de redução de tempo.
 *
 * Isto substitui a classe de intercâmbio anterior, que reprovava por PROXY e bloqueava trocas
 * que custam exatamente o mesmo. Medido no candidato 4576201: de 162 pares de slots do mesmo
 * grupo com a mesma tarefa mecânica no mesmo dia, a classe antiga permitia alternativa em 9 e
 * bloqueava 153 — e em 0 deles faltava alternativa no catálogo. Os eixos que mais bloqueavam
 * (`padrao`, `carga`) são inertes para o custo em boa parte dos casos: `puxar`, `empurrar`,
 * `agachar` e `dobradica_quadril` são todos COMPOSTO e descansam igual; `temCarga` só entra
 * pelo piso do composto de alta exigência e pela força pesada.
 *
 * ⚠️ O custo NUNCA é reaproveitado: a assinatura do candidato é computada do próprio candidato.
 */
const GRADE_RIR: readonly number[] = [0, 1, 2, 3];
const GRADE_RAMPA: readonly (number | null)[] = [null, 1, 2];
const GRADE_DEGRADACAO: readonly (0 | 1 | 2)[] = [0, 1, 2];
const NIVEIS: readonly NivelExperiencia[] = ['iniciante', 'intermediario', 'avancado'];

const CACHE_CUSTO = new Map<string, string>();

export function assinaturaDeCusto(e: Exercise): string {
  const cache = CACHE_CUSTO.get(e.id);
  if (cache !== undefined) return cache;
  const descansos: (number | null)[] = [];
  for (const rirAlvo of GRADE_RIR) {
    for (const modoForca of [false, true]) {
      for (const semanaRampa of GRADE_RAMPA) {
        for (const degradacao of GRADE_DEGRADACAO) {
          descansos.push(descansoDoExercicio({ exercicio: e, rirAlvo, modoForca, semanaRampa, degradacao }));
        }
      }
    }
  }
  // Execução: isometria usa o hold prescrito no lugar dos 40 s/série (faixa por NÍVEL, então
  // os três entram), e `UNILATERAL_DOIS_LADOS` dobra a execução.
  const isometrico = repUnitDe(e.id) === 'segundos';
  const holds = isometrico ? NIVEIS.map((n) => faixaSegundos(e.id, n)?.min ?? 'x').join(',') : '';
  const assinatura = [
    `d:${descansos.join(',')}`,
    isometrico ? `iso:${holds}` : 'reps',
    e.execucao === 'UNILATERAL_DOIS_LADOS' ? 'dois-lados' : 'um-lado',
  ].join('|');
  CACHE_CUSTO.set(e.id, assinatura);
  return assinatura;
}

/** Os dois exercícios ocupam o mesmo tempo no mesmo slot, em qualquer semana e perfil? */
export function mesmoCustoDeSlot(a: Exercise, b: Exercise): boolean {
  return assinaturaDeCusto(a) === assinaturaDeCusto(b);
}

/**
 * 🦴 TRAÇOS MECÂNICOS declarados de um exercício — o vocabulário da complementaridade.
 *
 * Vêm SÓ do contrato, nunca de suposição:
 *  · `acao:<regra>` — a ação classificada do pacote (59 regras, cada uma com `acao`,
 *    `natureza: inferencia_anatomica`, `justificativa` e fontes). É ela que separa
 *    empurrar horizontal de empurrar inclinado, remada de puxada vertical, dobradiça de
 *    flexão de joelho, elevação lateral de desenvolvimento;
 *  · `<chave>:<valor>` de cada DESCRITOR declarado — inclinação, pegada, ombro, quadril,
 *    joelho, trajetória, apoio.
 *
 * 🔴 O que NÃO vira traço, e é o que impede ganho fictício:
 *  · descritor que o catálogo não define — nada é preenchido;
 *  · descritor cujo valor é uma DISJUNÇÃO do próprio pacote (`supinada_ou_execucao_a_confirmar`,
 *    `sentado_ou_deitado_nao_fixado`, `estendido_ou_pouco_flexionado`): ele diz que a execução
 *    não está determinada, e usá-lo como distinção seria afirmar o que o pacote recusa;
 *  · nome, marca, implemento e sinônimo. Supino reto com barra, com halteres e na máquina têm
 *    a MESMA ação e o MESMO descritor — traço idêntico, ganho zero. É de propósito.
 *
 * ⚠️ Magnitude nunca é usada: `positiva_angulo_nao_fixado` diz que a inclinação é positiva —
 * o traço é a orientação, e o ângulo continua não fixado.
 */
const DESCRITOR_INDETERMINADO = /_ou_|_a_confirmar$/;

export function tracosMecanicos(id: string): ReadonlySet<string> {
  const cache = CACHE_TRACOS.get(id);
  if (cache) return cache;
  const anatomia = ANATOMIA_POR_EXERCICIO[id];
  const tracos = new Set<string>();
  if (anatomia) tracos.add(`acao:${anatomia.regra}`);
  for (const [chave, valor] of Object.entries(anatomia?.descritores ?? {})) {
    if (!DESCRITOR_INDETERMINADO.test(valor)) tracos.add(`${chave}:${valor}`);
  }
  CACHE_TRACOS.set(id, tracos);
  return tracos;
}
const CACHE_TRACOS = new Map<string, ReadonlySet<string>>();

/** Todos os traços que os exercícios de uma lista trazem. */
export function tracosDoConjunto(ids: readonly string[]): ReadonlySet<string> {
  const t = new Set<string>();
  for (const id of ids) for (const x of tracosMecanicos(id)) t.add(x);
  return t;
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

/** Por que uma troca aconteceu. Não é peso: é o motivo, dito. */
export type MotivoDaTroca = 'alvo_novo' | 'complementaridade_mecanica';

/** Uma troca efetivamente feita — matéria-prima do diagnóstico e dos testes. */
export interface TrocaAnatomica {
  dia: number;
  slot: number;
  grupo: GrupoPrimario;
  de: string;
  para: string;
  motivo: MotivoDaTroca;
  alvosGanhos: readonly AlvoId[];
  /** Traços mecânicos que o dia passou a ter neste grupo. Vazio quando o ganho foi de alvo. */
  tracosGanhos: readonly string[];
}

/** Restrições de crédito ponderado que a troca não pode violar. */
export interface LimitesDeCredito {
  /** Séries de planejamento por slot — a moeda do crédito (direto 1,0 · secundário 0,5). */
  seriesPlanejamento: number;
  /**
   * Piso de cobertura dos GRUPOS GRANDES (o MEV que o guard do montador usa). Quem estava no
   * piso não pode cair abaixo dele. Ausente ⇒ regra conservadora: nenhum grupo grande pode
   * perder crédito.
   */
  pisoCobertura?: number;
  /**
   * 🔒 Grupos que o passe NÃO toca — na prática, os do FOCO adicional.
   *
   * 🔴 Por quê: o bloco do foco (`bloco-foco-adicional.ts`) roda DEPOIS e escolhe os extras
   * entre os ids do grupo que ainda estão livres na semana. Trocar um slot do grupo focado
   * muda quem está livre, e o bloco passa a pegar outro exercício. Medido em foco/ombros
   * 4d/60: o passe trocava `e41`/`e42` por `e119`/`e95` no dia de ombros, o bloco do foco
   * então encontrava `e41`/`e42` livres e os punha no dia de peito no lugar de `e52`/`e53` —
   * dois compostos de 180 s onde havia dois isolados de 90 s. O dia apertava, a degradação
   * descia um degrau e o DESCANSO de todos os seis outros slots caía de 90 s para 60 s.
   * Recuperação piorando por efeito colateral da seleção não está autorizado.
   *
   * O custo disso é uma limitação declarada: dentro do grupo focado, a complementaridade fica
   * por conta do bloco do foco, e o passe não a acrescenta.
   */
  gruposPreservados?: readonly GrupoPrimario[];
}

/** Crédito ponderado (1,0 direto + 0,5 secundário) de uma lista de exercícios. */
function creditoDe(exercicios: readonly Exercise[], series: number): Map<GrupoPrimario, number> {
  const m = new Map<GrupoPrimario, number>();
  for (const e of exercicios) {
    if (e.grupoPrimario) m.set(e.grupoPrimario, (m.get(e.grupoPrimario) ?? 0) + series);
    for (const sec of secundariosDe(e)) m.set(sec, (m.get(sec) ?? 0) + series * PESO_SECUNDARIO);
  }
  return m;
}

const GRANDES: ReadonlySet<string> = new Set(['peito', 'costas', 'quadriceps', 'posterior', 'gluteos', 'ombros']);
/** Padrões que carregam invariante ou cobertura temporal e não podem sumir da semana. */
const PADROES_CONTADOS: readonly string[] = ['puxar', 'empurrar', 'agachar', 'dobradica_quadril'];

/**
 * 🔒 A troca NUNCA acrescenta crédito ponderado a um GRUPO GRANDE.
 *
 * 🔴 Por que "não ganha", e por que só nos grandes: crédito ponderado não serve só ao
 * alocador — ele também CLASSIFICA o catálogo e alimenta o placar. Os dois consumidores leem
 * exatamente `GRUPOS_GRANDES`:
 *  · `cobertura-teto.ts` mede o pico por (nível × objetivo × equipamento) para decidir se um
 *    grande é *catálogo-limitado*, e é essa classificação que escolhe a frase que a pessoa lê
 *    ("o mínimo é um elástico");
 *  · `placarDaSemana` marca `acima_mrv` a partir do mesmo número.
 *
 * Medido: sem esta trava, o passe levava ombros a fechar o MEV no iniciante casa+elástico, e o
 * app passava a dizer que elástico fecha ombro — decisão de produto trocada de lado por efeito
 * colateral da seleção.
 *
 * ⚠️ Fora dos grandes a trava não existe, de propósito: bíceps, tríceps, antebraço, lombar,
 * panturrilha e core não são lidos por nenhum dos dois consumidores, e travá-los ali bloquearia
 * complementaridade legítima sem proteger nada. O que os protege é `creditoPreservado`, que não
 * deixa nenhum grupo ZERAR.
 */
function creditoGrandeNaoAcrescenta(atual: Exercise, candidato: Exercise): boolean {
  const antes = new Set<string>(secundariosDe(atual));
  return secundariosDe(candidato).every((g) => antes.has(g) || !GRANDES.has(g));
}

/**
 * 🔒 A troca preserva o CRÉDITO PARCIAL já existente?
 *
 * Usa as autoridades reais (`secundariosDe`, `PESO_SECUNDARIO` e o MEV que o montador passa):
 *  · nenhum grupo GRANDE que estava no piso cai abaixo dele — sem piso conhecido, nenhum
 *    grande pode perder crédito, que é a leitura conservadora;
 *  · nenhum grupo com crédito > 0 vai a ZERO: lombar e antebraço só existem por crédito
 *    indireto, e apagá-los seria cobrir um alvo tirando outro.
 */
function creditoPreservado(
  antes: ReadonlyMap<GrupoPrimario, number>,
  depois: ReadonlyMap<GrupoPrimario, number>,
  limites: LimitesDeCredito,
): boolean {
  const grupos = new Set<GrupoPrimario>([...antes.keys(), ...depois.keys()]);
  for (const g of grupos) {
    const a = antes.get(g) ?? 0;
    const d = depois.get(g) ?? 0;
    if (a > 0 && d <= 0) return false;
    if (!GRANDES.has(g)) continue;
    if (limites.pisoCobertura == null) {
      if (d < a) return false;
    } else if (a >= limites.pisoCobertura ? d < limites.pisoCobertura : d < a) return false;
  }
  return true;
}

/**
 * 🔒 As invariantes de PADRÃO da semana continuam valendo depois da troca?
 *
 * `puxar ≥ empurrar` é saúde do ombro e não tem tolerância; e um padrão que a semana cobria
 * não pode sumir (é o que a cobertura temporal obrigatória exige). A troca só muda o padrão
 * quando o custo é idêntico — mas a checagem é explícita, e não deduzida.
 */
function padroesPreservados(antes: readonly Exercise[], depois: readonly Exercise[]): boolean {
  const conta = (lista: readonly Exercise[]) => {
    const m = new Map<string, number>();
    for (const e of lista) m.set(e.padraoMovimento, (m.get(e.padraoMovimento) ?? 0) + 1);
    return m;
  };
  const a = conta(antes);
  const d = conta(depois);
  /**
   * 🔒 O balanço `puxar − empurrar` não pode PIORAR. Absoluto seria errado: quem já estava em
   * dia continua em dia (o balanço não cai abaixo de zero se estava em zero ou acima), e um
   * conjunto que nem tem `puxar` — um dia só de peito, por exemplo — não fica refém de uma
   * invariante que já não valia antes da troca e que a troca não tem como consertar.
   */
  const balanco = (m: Map<string, number>) => (m.get('puxar') ?? 0) - (m.get('empurrar') ?? 0);
  if (balanco(d) < balanco(a)) return false;
  for (const p of PADROES_CONTADOS) if ((a.get(p) ?? 0) > 0 && (d.get(p) ?? 0) === 0) return false;
  return true;
}

/**
 * 🦴 PASSE FINAL: dentro de cada slot JÁ alocado, escolhe o exercício que melhor completa o
 * trabalho do GRUPO naquele dia — por alvo anatômico ainda descoberto ou por tarefa mecânica
 * ainda ausente.
 *
 * 🔒 Por que é um passe final, e não um desempate dentro do alocador: medimos as duas formas.
 * Desempatando dentro de `escolher`, a escolha diferente movia o cursor de rotação e o
 * conjunto de usados do dia, e os slots SEGUINTES caíam em candidatos de outro custo — a
 * semana ganhava slots (32 → 34), séries (124 → 130) e segundos que a cobertura anatômica não
 * tem o direito de comprar. Como passe final, a alocação inteira roda intocada: dia, grupo,
 * quantidade de slots, séries, descanso, tetos, foco, reservas e invariantes já estão
 * decididos quando isto começa.
 *
 * ── O que uma troca exige, cumulativamente ──
 *  1. MESMO grupo do slot e MESMO estado de favorito (DF #12 conta favoritos);
 *  2. id ainda não usado NO DIA;
 *  3. MESMA assinatura de custo — `descansoDoExercicio` idêntico em toda a grade de
 *     parâmetros, mesma unidade de execução e mesma lateralidade;
 *  4. não perde alvo direto: nenhum alvo do dia coberto só pelo exercício atual fica a
 *     descoberto;
 *  5. invariantes de padrão da semana preservadas (`puxar ≥ empurrar`, padrão coberto não some);
 *  6. crédito parcial preservado (piso dos grandes, ninguém zera, ninguém estoura o alvo);
 *  7. e GANHA alguma coisa — um alvo direto novo no dia, ou um traço mecânico que o GRUPO
 *     ainda não tem naquele dia.
 *
 * ── Prioridade ──
 * Cobertura anatômica primeiro, complementaridade mecânica depois: um candidato que abre um
 * alvo novo vence um que só traz tarefa nova. Entre iguais, a ordem do pool (tier↑, id) decide
 * — e empate total mantém o exercício de antes.
 *
 * 🔴 Complementaridade mecânica só conta quando o GRUPO tem mais de um slot no dia E o
 * exercício atual não acrescenta traço nenhum ao que os outros slots do grupo já trazem. Com
 * um slot só não existe repetição a desfazer, e nada é trocado. Diferença de nome, marca ou
 * implemento não produz traço: supino com barra, com halteres e na máquina são a mesma ação
 * com o mesmo descritor, e valem ganho zero.
 *
 * 🔴 Nada aqui é peso: não há coeficiente de ativação, de hipertrofia nem de preferência
 * regional. "Traço novo" é presença/ausência de uma característica declarada pelo pacote.
 *
 * Itera até o ponto fixo. Determinístico: dias, slots e candidatos em ordem.
 *
 * @returns as trocas feitas (vazio quando nada mudou).
 */
export function otimizarCoberturaAnatomica(
  dias: readonly DiaParaCobertura[],
  poolPorGrupo: (g: GrupoPrimario, favorito: boolean) => readonly Exercise[],
  limites: LimitesDeCredito,
): TrocaAnatomica[] {
  const trocas: TrocaAnatomica[] = [];
  const todosOsExercicios = () => dias.flatMap((d) => d.slots.map((s) => s.exercicio));
  /** Cada troca ou abre um alvo ou acrescenta um traço; o teto só existe contra laço infinito. */
  const MAX_RODADAS = 8;

  for (let rodada = 0; rodada < MAX_RODADAS; rodada += 1) {
    let mudou = false;
    for (let d = 0; d < dias.length; d += 1) {
      const dia = dias[d]!;
      const desejados = alvosDesejadosDoDia(dia.grupos);
      if (desejados.size === 0) continue;
      const noDia = new Set(dia.slots.map((s) => s.exercicio.id));

      for (let i = 0; i < dia.slots.length; i += 1) {
        const slot = dia.slots[i]!;
        if (limites.gruposPreservados?.includes(slot.grupo)) continue;
        const atual = slot.exercicio;
        const custo = assinaturaDeCusto(atual);

        /** O que os OUTROS slots do dia já abordam — a régua do ganho real de cobertura. */
        const outrosDoDia = dia.slots.filter((_, k) => k !== i).map((s) => s.exercicio.id);
        const porOutros = abordadosNoDia(outrosDoDia, desejados);
        const ganhoDe = (id: string) => complementoAnatomico(id, desejados, porOutros);
        /** Traços que os outros slots DO MESMO GRUPO já trazem neste dia. */
        const outrosDoGrupo = dia.slots
          .filter((s, k) => k !== i && s.grupo === slot.grupo)
          .map((s) => s.exercicio.id);
        const tracosDoGrupo = tracosDoConjunto(outrosDoGrupo);
        /** O atual já é redundante no grupo? Só então vale trocar por complementaridade. */
        const atualRedundante = outrosDoGrupo.length > 0
          && [...tracosMecanicos(atual.id)].every((t) => tracosDoGrupo.has(t));
        const trazTracoNovo = (id: string) => [...tracosMecanicos(id)].some((t) => !tracosDoGrupo.has(t));

        const ganhoAtual = ganhoDe(atual.id);
        let melhor = atual;
        let melhorGanho = ganhoAtual;
        let melhorTraco = false;

        for (const candidato of poolPorGrupo(slot.grupo, slot.favorito)) {
          if (candidato.id === atual.id || noDia.has(candidato.id)) continue;
          if (assinaturaDeCusto(candidato) !== custo) continue;
          const ganho = ganhoDe(candidato.id);
          if (ganho < ganhoAtual) continue;
          const traco = atualRedundante && trazTracoNovo(candidato.id);
          if (ganho === ganhoAtual && !traco) continue;
          // Cobertura vence complementaridade; entre iguais, o primeiro do pool permanece.
          if (ganho < melhorGanho) continue;
          if (ganho === melhorGanho && melhor !== atual && !(traco && !melhorTraco)) continue;

          if (!creditoGrandeNaoAcrescenta(atual, candidato)) continue;
          const antesLista = todosOsExercicios();
          const depoisLista = antesLista.map((e) => (e === atual ? candidato : e));
          if (!padroesPreservados(antesLista, depoisLista)) continue;
          if (!creditoPreservado(
            creditoDe(antesLista, limites.seriesPlanejamento),
            creditoDe(depoisLista, limites.seriesPlanejamento),
            limites,
          )) continue;

          melhor = candidato;
          melhorGanho = ganho;
          melhorTraco = traco;
        }

        if (melhor.id === atual.id) continue;
        const alvosGanhos = [...diretosDoExercicio(melhor.id)]
          .filter((a) => desejados.has(a) && !porOutros.has(a) && !diretosDoExercicio(atual.id).has(a))
          .sort();
        const tracosGanhos = [...tracosMecanicos(melhor.id)].filter((t) => !tracosDoGrupo.has(t)).sort();
        trocas.push({
          dia: d,
          slot: i,
          grupo: slot.grupo,
          de: atual.id,
          para: melhor.id,
          motivo: alvosGanhos.length > 0 ? 'alvo_novo' : 'complementaridade_mecanica',
          alvosGanhos,
          tracosGanhos: alvosGanhos.length > 0 ? [] : tracosGanhos,
        });
        noDia.delete(atual.id);
        noDia.add(melhor.id);
        slot.exercicio = melhor;
        mudou = true;
      }
    }
    if (!mudou) break;
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

/**
 * Por que dois slots do mesmo grupo ficaram com a MESMA tarefa mecânica. Também não é veredito:
 * repetir uma tarefa não estraga treino nenhum — só não acrescenta a variedade que existia.
 */
export type MotivoRedundancia =
  /** Não há, no catálogo elegível, exercício do grupo com outra tarefa declarada. */
  | 'sem_alternativa_no_catalogo_elegivel'
  /** Existe alternativa, mas ela ocuparia outro tempo no slot (descanso/execução diferentes). */
  | 'alternativa_custaria_outro_tempo'
  /** Existe alternativa de mesmo custo, mas ela acrescentaria crédito ponderado a algum grupo. */
  | 'alternativa_mudaria_credito';

export interface RedundanciaMecanica {
  grupo: GrupoPrimario;
  /** Os ids do grupo que compartilham a mesma tarefa neste dia. */
  ids: readonly string[];
  /** A tarefa repetida, no vocabulário do contrato. */
  tarefa: readonly string[];
  motivo: MotivoRedundancia;
  /** Alternativas elegíveis com outra tarefa — vazio quando o catálogo não oferece nenhuma. */
  alternativasConhecidas: readonly string[];
}

export interface DiagnosticoAnatomicoDia {
  dia: string;
  /** Alvos dos grupos que o template do dia previa. */
  desejados: readonly AlvoId[];
  /** Abordados diretamente pelos exercícios escolhidos. */
  abordados: readonly AlvoId[];
  /** O que não foi identificado, com o motivo. 🔴 Diagnóstico, não veredito. */
  naoIdentificados: readonly AlvoNaoIdentificado[];
  /**
   * Grupos que ficaram com a mesma tarefa mecânica repetida no dia, com o motivo de a
   * complementaridade não ter cabido. 🔴 Registro, não alerta: não vai para `rotina.avisos`,
   * não bloqueia o editor e não promete que o catálogo poderia fazer diferente.
   */
  redundanciasMecanicas: readonly RedundanciaMecanica[];
  /** Participação auxiliar observada nos alvos do dia — visível, e não fecha cobertura. */
  participacaoAuxiliar: readonly AlvoId[];
  ressalva: string;
}

/**
 * Diagnóstico de um dia já montado: o que os alvos previstos pediam, o que a escolha conseguiu
 * abordar dentro das restrições vigentes, e onde a complementaridade mecânica não coube.
 *
 * 🔴 Não propõe exercício novo, não sugere aumentar tempo ou volume e não declara o treino
 * ruim. Diz o que não foi identificado e por quê — nada mais.
 */
export function diagnosticarDia(args: {
  nome: string;
  grupos: readonly GrupoPrimario[];
  /** Os exercícios que o dia ficou tendo, em ordem. */
  escolhidos: readonly Exercise[];
  /** Pool elegível do dia, já filtrado por equipamento/nível/etc. pelo chamador. */
  elegiveis: readonly Exercise[];
  slotsDisponiveis: number;
}): DiagnosticoAnatomicoDia {
  const desejados = alvosDesejadosDoDia(args.grupos);
  const idsEscolhidos = args.escolhidos.map((e) => e.id);
  const abordados = abordadosNoDia(idsEscolhidos, desejados);
  const elegiveis = new Set(args.elegiveis.map((e) => e.id));
  const sobraSlot = idsEscolhidos.length < args.slotsDisponiveis;

  const auxiliares = new Set<AlvoId>();
  for (const id of idsEscolhidos) {
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

  /**
   * ── Redundância mecânica: dois slots do mesmo grupo com a mesma tarefa ──────────────
   * O motivo sai das MESMAS regras que o passe aplica, e na mesma ordem — custo primeiro,
   * crédito depois —, para o diagnóstico nunca contar uma história diferente da decisão.
   */
  const tarefaDe = (e: Exercise) => [...tracosMecanicos(e.id)].sort().join('|');
  const redundanciasMecanicas: RedundanciaMecanica[] = [];
  for (const g of args.grupos) {
    const doGrupo = args.escolhidos.filter((e) => e.grupoPrimario === g);
    if (doGrupo.length < 2) continue;
    const repetida = doGrupo.find((e, i) => doGrupo.findIndex((o) => tarefaDe(o) === tarefaDe(e)) !== i);
    if (!repetida) continue;
    const tarefa = tarefaDe(repetida);
    const iguais = doGrupo.filter((e) => tarefaDe(e) === tarefa);
    const referencia = iguais[0]!;
    const alternativas = args.elegiveis.filter((e) => e.grupoPrimario === g
      && e.padraoMovimento !== 'cardio' && !idsEscolhidos.includes(e.id) && tarefaDe(e) !== tarefa);
    const mesmoCusto = alternativas.filter((e) => assinaturaDeCusto(e) === assinaturaDeCusto(referencia));
    const motivo: MotivoRedundancia = alternativas.length === 0
      ? 'sem_alternativa_no_catalogo_elegivel'
      : mesmoCusto.length === 0 ? 'alternativa_custaria_outro_tempo' : 'alternativa_mudaria_credito';
    redundanciasMecanicas.push({
      grupo: g,
      ids: iguais.map((e) => e.id),
      tarefa: [...tracosMecanicos(referencia.id)].sort(),
      motivo,
      alternativasConhecidas: alternativas.map((e) => e.id),
    });
  }

  return {
    dia: args.nome,
    desejados: [...desejados].sort(),
    abordados: [...abordados].sort(),
    naoIdentificados,
    redundanciasMecanicas,
    participacaoAuxiliar: [...auxiliares].sort(),
    ressalva: RESSALVA_COBERTURA,
  };
}
