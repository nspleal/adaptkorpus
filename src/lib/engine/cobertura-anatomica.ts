/**
 * 🦴 COBERTURA ANATÔMICA como critério de ESCOLHA — a ponte entre o mapa dos 168 ids e o
 * alocador.
 *
 * O que ele faz: entre os exercícios que o alocador JÁ considerou elegíveis para um grupo do
 * dia, favorece o que aborda alvos diretos ainda não abordados naquele dia, e evita repetir a
 * mesma ação classificada quando existe alternativa compatível.
 *
 * ── A ORDEM DE ATUAÇÃO (decisão do autor, 2026-09-17) ───────────────────────────────────
 *  ① TROCAR o exercício de um slot por outro do mesmo grupo que abra uma região descoberta;
 *  ② quando a troca sozinha custaria crédito indireto de alguém, procurar um PAR — uma
 *     segunda troca, no MESMO grupo e no MESMO dia, que devolva exatamente o que a primeira
 *     tirou. A regra de volume não é flexibilizada: o par só vale se a semana terminar com o
 *     mesmo crédito ponderado, grupo por grupo;
 *  ③ ACRESCENTAR um exercício, só quando ① e ② não resolvem e existe margem válida em
 *     estrutura, tempo e volume — todas perguntadas ao chamador, nunca decididas aqui;
 *  ④ o que sobrar vira DIAGNÓSTICO com o motivo concreto (`diagnosticarDia`).
 *
 * 🔒 O que ele NÃO faz, e é a razão de ele caber aqui sem reabrir nenhuma regra aprovada:
 *  · não cria série, tempo, descanso, foco, teto nem frequência — entra DEPOIS de o alocador
 *    decidir os slots, e só o `limites.adicao` (injetado, e ausente por padrão) lhe permite
 *    ACRESCENTAR um slot, sempre dentro do orçamento e dos tetos que o alocador já usou;
 *  · não reduz, remove nem redistribui nada para abrir espaço: se não couber, não entra;
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

/**
 * Por que uma troca aconteceu. Não é peso: é o motivo, dito.
 *
 * 🔵 `compensacao` (2026-09-17) marca a SEGUNDA metade de um par: ela não ganha alvo nem traço
 * — existe para devolver, no mesmo dia, o crédito indireto que a primeira metade tirou. Só
 * aparece acompanhada da troca que a motivou.
 */
export type MotivoDaTroca = 'alvo_novo' | 'complementaridade_mecanica' | 'compensacao' | 'adicao_complementar';

/** Uma troca efetivamente feita — matéria-prima do diagnóstico e dos testes. */
export interface TrocaAnatomica {
  dia: number;
  slot: number;
  grupo: GrupoPrimario;
  /** 🔵 `null` numa ADIÇÃO: nada saiu do plano, um slot novo entrou. */
  de: string | null;
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
  /**
   * 🔵 A AUTORIDADE REAL DO TEMPO, injetada pelo chamador (correção 2026-09-17).
   *
   * Recebe o dia e a lista de exercícios que ele teria DEPOIS da troca, e responde se o dia
   * não ficou mais caro. Quem sabe responder isso é o montador — ele tem o orçamento diário,
   * o RIR da semana, o modo força, a rampa e a fórmula canônica de duração. Injetar em vez
   * de importar é o que impede a cobertura de virar uma segunda autoridade de tempo e o que
   * mantém este módulo puro.
   *
   * 🔒 Ausente ⇒ vale o padrão conservador: só troca de ASSINATURA DE CUSTO idêntica. É o que
   * preserva o comportamento para quem chama o passe sem orçamento (testes de unidade).
   */
  custoDoDiaNaoAumenta?: (dia: number, exerciciosDepois: readonly Exercise[]) => boolean;
  /**
   * 🔵 ADIÇÃO CONTROLADA (decisão do autor, 2026-09-17) — o passe pode ACRESCENTAR um
   * exercício quando a troca não resolve e há margem válida.
   *
   * 🔴 Quando a troca não resolve, e por quê: o dia com UM slot de core cobre 5 dos 6 alvos
   * com o bird dog e 3 com a prancha lateral; trocar não fecha o quadrado lombar, apenas
   * MOVE a lacuna para o eretor e o transverso. Medido: 300 das 659 regiões descobertas são
   * desse tipo. A única saída correta é um segundo exercício — ou dizer que não cabe.
   *
   * 🔒 Ausente ⇒ o passe NÃO acrescenta nada, e o contrato antigo ("não cria slot") continua
   * valendo inteiro para quem chama sem esta injeção.
   *
   * 🔒 Os três limites são perguntados ao chamador, que é quem tem as autoridades: estrutura
   * (orçamento de slots do dia), tempo (a fórmula de duração, sem descer degrau de descanso)
   * e volume ponderado (teto da semana e teto da sessão, contando crédito indireto). Nenhum
   * deles é recalculado aqui — a cobertura não vira segunda autoridade de nada.
   */
  adicao?: {
    /** Quantos slots o dia ainda comporta pela ESTRUTURA. 0 ⇒ nada é acrescentado. */
    slotsLivres: (dia: number) => number;
    /**
     * O GRUPO ainda comporta mais um slot na semana, pelos MESMOS tetos que o alocador usou?
     *
     * 🔴 Medido: sem esta pergunta o passe punha um segundo exercício de core num dia que já
     * tinha um, e o avançado 6d saía com quatro slots de core contra o invariante travado de
     * 2–3 por semana. Frequência e teto de slots por grupo são decisão do alocador.
     */
    cabeNoTetoDeSlots: (novo: Exercise) => boolean;
    /** O dia ainda cabe no tempo com este exercício a mais, sem encurtar o descanso de ninguém? */
    cabeNoTempo: (dia: number, exerciciosDepois: readonly Exercise[]) => boolean;
    /** O crédito ponderado deste exercício cabe nos limites da SEMANA e da SESSÃO? */
    cabeNoVolume: (dia: number, novo: Exercise) => boolean;
    /**
     * 🔒 Grupos que a ADIÇÃO não toca — os do FOCO, INCLUSIVE `core`.
     *
     * 🔴 Por que `core` entra aqui e não entra em `gruposPreservados`: para a TROCA, o foco de
     * core é inócuo (ele sobe séries nos slots que já existem). Para a ADIÇÃO, não: um slot de
     * core a mais muda entre quantos exercícios o boost do foco se reparte. Medido — com o foco
     * em core, o total semanal do plano caía de 80 para 78 séries em
     * `intermediario/saude/4d`, e o invariante "o foco de core não muda o volume total" é
     * exatamente o que proíbe isso.
     */
    gruposPreservados?: readonly GrupoPrimario[];
  };
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
 * complementaridade legítima sem proteger nada. O que os protege é `nenhumGrupoPerde`, que não
 * deixa nenhum grupo ZERAR.
 */
function creditoGrandeNaoAcrescenta(delta: ReadonlyMap<GrupoPrimario, number>): boolean {
  for (const [g, n] of delta) if (GRANDES.has(g) && n > 0) return false;
  return true;
}

/**
 * 🔵 O DELTA DE CRÉDITO PONDERADO de um conjunto de trocas (2026-09-17) — a forma que torna
 * a COMPENSAÇÃO possível sem tocar em nenhuma regra de volume.
 *
 * 🔑 Crédito é aditivo, então o efeito de uma troca sobre a semana inteira é exatamente
 * `credito(para) − credito(de)`; somar os deltas de duas trocas dá o efeito do par. Sobre o
 * delta, as duas travas de volume são a MESMA coisa que eram sobre os totais:
 *  · `nenhum grupo perde` ⇔ todo delta ≥ 0;
 *  · `grande não ganha`  ⇔ todo delta de grupo grande ≤ 0.
 * Nada foi afrouxado: o que muda é que um par pode zerar o que uma troca sozinha tirava, e
 * aí a semana termina com exatamente o mesmo crédito de antes, grupo por grupo.
 */
function deltaDaTroca(de: Exercise, para: Exercise, series: number): Map<GrupoPrimario, number> {
  const m = new Map<GrupoPrimario, number>();
  const somar = (g: GrupoPrimario | null | undefined, n: number) => {
    if (!g) return;
    const v = (m.get(g) ?? 0) + n;
    if (v === 0) m.delete(g); else m.set(g, v);
  };
  somar(de.grupoPrimario, -series);
  for (const s of secundariosDe(de)) somar(s, -series * PESO_SECUNDARIO);
  somar(para.grupoPrimario, series);
  for (const s of secundariosDe(para)) somar(s, series * PESO_SECUNDARIO);
  return m;
}

function somarDeltas(
  a: ReadonlyMap<GrupoPrimario, number>,
  b: ReadonlyMap<GrupoPrimario, number>,
): Map<GrupoPrimario, number> {
  const m = new Map(a);
  for (const [g, n] of b) {
    const v = (m.get(g) ?? 0) + n;
    if (v === 0) m.delete(g); else m.set(g, v);
  }
  return m;
}

/** Nenhum grupo perde crédito ponderado (a decisão de 2026-09-15), lida sobre o delta. */
function nenhumGrupoPerde(delta: ReadonlyMap<GrupoPrimario, number>): boolean {
  for (const n of delta.values()) if (n < 0) return false;
  return true;
}

/**
 * 🔒 A troca preserva o CRÉDITO PONDERADO já existente?
 *
 * 🔴 DECISÃO DO AUTOR 2026-09-15 — NENHUM GRUPO PERDE, ponto. Nem direto, nem indireto, e não
 * só os grandes. A régua é a autoridade que já existia (`secundariosDe` + `PESO_SECUNDARIO`,
 * a mesma conta de `creditoPonderadoDaSemana`): não há piso relativo, tolerância nem fórmula
 * nova, e a perda NUNCA é compensada acrescentando série ou exercício — a troca simplesmente
 * não acontece, e o passe procura outro candidato compatível.
 *
 * 🔴 O que isto conserta, medido: a versão anterior protegia apenas os `GRUPOS_GRANDES` (piso
 * do MEV) e o "ninguém zera". Com isso, trocas legítimas em ALVO apagavam crédito indireto de
 * grupo pequeno — `e41` Desenvolvimento → `e95` Remada alta levava o tríceps de 18 para 16
 * séries ponderadas no perfil real, e o painel "Séries por músculo" caía de "4 diretas · 6
 * indiretas" para "4 diretas · 2 indiretas". Complementaridade não se compra com o volume
 * indireto de um vizinho.
 *
 * Consequência aceita e declarada: onde a única alternativa que traria alvo ou traço novo
 * custa crédito de alguém, o exercício anterior fica — a redundância permanece e é o
 * diagnóstico que a explica.
 *
 * 🔵 MEDIDO NA CORREÇÃO DE 2026-09-17, e deixado de pé: esta trava é hoje o maior bloqueio
 * isolado à complementaridade. Das 659 regiões sem exercício identificado em 144 perfis, 148
 * fecharam corrigindo os proxies de CUSTO e de PADRÃO; outras 120 dependiam só desta régua.
 * Ela NÃO foi afrouxada: `credito-nao-regride.test.ts` a trava como invariante global sobre a
 * grade real, e trocá-la por "só perde quem ainda tem trabalho direto" reprovava naquele
 * arquivo inteiro — inclusive no caso do tríceps que deu origem à decisão. Afrouxar isto é
 * decisão de produto do autor, não da cobertura; o que o passe faz é DIZER a lacuna que
 * sobra, com o motivo `alternativa_mudaria_credito`.
 */
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
   * 🔒 A INVARIANTE É `puxar ≥ empurrar`, e é ela que se verifica — não "o balanço não cai".
   *
   * 🔵 Correção 2026-09-17: exigir que o balanço NUNCA caísse era o terceiro proxy do passe, e
   * ele reprovava por um número que a invariante não pede. Uma semana com 8 puxar e 4 empurrar
   * continua em dia com 7 puxar — e era exatamente essa troca que o encolhimento (isolado) ao
   * lado de quatro remadas (puxar) precisava fazer para abrir o trapézio superior. Medido: 148
   * das 659 regiões descobertas fechavam com as duas primeiras travas corrigidas e mais 120
   * ficavam presas só aqui.
   *
   * 🔴 O que continua sendo verdade, e é o que a saúde do ombro exige: depois da troca a semana
   * tem de estar EM DIA (`puxar ≥ empurrar`). Quem já estava fora — um dia só de peito, por
   * exemplo — não fica refém de uma invariante que já não valia; nesse caso só se exige que a
   * troca não piore o que encontrou.
   */
  const balanco = (m: Map<string, number>) => (m.get('puxar') ?? 0) - (m.get('empurrar') ?? 0);
  if (balanco(d) < 0 && balanco(d) < balanco(a)) return false;
  for (const p of PADROES_CONTADOS) if ((a.get(p) ?? 0) > 0 && (d.get(p) ?? 0) === 0) return false;
  return true;
}

/** A segunda metade de um par: o slot que devolve o crédito que a primeira troca tirou. */
interface Compensacao {
  slot: number;
  de: Exercise;
  para: Exercise;
}

/**
 * 🔵 A BUSCA DA COMPENSAÇÃO (2026-09-17) — a segunda troca do par.
 *
 * Procura, no MESMO dia, um outro slot cuja troca devolva o crédito que a primeira tirou, de
 * modo que o delta somado não deixe nenhum grupo para trás. A compensação não precisa ganhar
 * alvo nem traço — o ganho é da primeira metade —, mas está sujeita a TODO o resto:
 *  · não pode sair de um grupo preservado (foco) nem mexer no slot da primeira troca;
 *  · não pode perder cobertura: os alvos que só ela abordava no dia continuam abordados;
 *  · não pode custar mais tempo (mesma pergunta à autoridade de duração, já com a primeira
 *    troca aplicada — o dia é avaliado como ele vai ficar, e não em duas metades);
 *  · não pode repetir id que já está no dia.
 *
 * 🔒 Determinístico: slots em ordem, candidatos na ordem do pool, e o PRIMEIRO par válido
 * vence. Não há otimização de "melhor compensação" — isso criaria um critério novo, e a
 * compensação não é um ganho, é uma devolução.
 */
function procurarCompensacao(args: {
  dia: DiaParaCobertura;
  d: number;
  indice: number;
  candidato: Exercise;
  delta: ReadonlyMap<GrupoPrimario, number>;
  desejados: ReadonlySet<AlvoId>;
  noDia: ReadonlySet<string>;
  limites: LimitesDeCredito;
  poolPorGrupo: (g: GrupoPrimario, favorito: boolean) => readonly Exercise[];
}): Compensacao | null {
  const { dia, d, indice, candidato, delta, desejados, noDia, limites, poolPorGrupo } = args;
  /** O dia como ele fica com a PRIMEIRA troca já aplicada — a base de toda conta daqui. */
  const comPrimeira = dia.slots.map((s, k) => (k === indice ? candidato : s.exercicio));

  /**
   * 🔒 A COMPENSAÇÃO É DENTRO DO PRÓPRIO GRUPO, e isso não é uma otimização — é a regra.
   *
   * Pagar a cobertura de um grupo com um slot de OUTRO grupo seria cobrar de terceiro, que é
   * exatamente o que o motor recusa em todos os outros lugares (foco, deload, tempo). Além
   * disso, medido: com a compensação livre entre grupos, uma troca em ombros liberava uma
   * troca em peito pela conta global de padrões, e o BASELINE passava a depender de haver ou
   * não foco — a regressão que D-01/D-02 existem para impedir. Dentro do grupo, o par é o que
   * ele diz ser: uma REARRUMAÇÃO dos slots daquele grupo naquele dia.
   */
  const grupoDaPrimeira = dia.slots[indice]!.grupo;
  /** Os grupos que ficaram devendo — só um candidato que os CREDITE pode compensar. */
  const devendo = new Set<GrupoPrimario>();
  for (const [g, n] of delta) if (n < 0) devendo.add(g);
  for (let j = 0; j < dia.slots.length; j += 1) {
    if (j === indice) continue;
    const alvo = dia.slots[j]!;
    if (alvo.grupo !== grupoDaPrimeira) continue;
    if (limites.gruposPreservados?.includes(alvo.grupo)) continue;
    const saiu = alvo.exercicio;
    /** O que os OUTROS slots já abordam, na configuração com a primeira troca aplicada. */
    const porOutros = abordadosNoDia(comPrimeira.filter((_, k) => k !== j).map((e) => e.id), desejados);
    const ganhoDoQueSai = complementoAnatomico(saiu.id, desejados, porOutros);

    const jaCreditados = new Set<string>(secundariosDe(saiu));
    for (const c2 of poolPorGrupo(alvo.grupo, alvo.favorito)) {
      if (c2.id === saiu.id || c2.id === candidato.id || noDia.has(c2.id)) continue;
      // 🔒 Filtro barato antes das contas caras: quem não credita nenhum dos grupos devendo
      //    (que `saiu` já não creditasse) não tem como compensar coisa alguma.
      if (!secundariosDe(c2).some((g) => devendo.has(g) && !jaCreditados.has(g))) continue;
      const total = somarDeltas(delta, deltaDaTroca(saiu, c2, limites.seriesPlanejamento));
      if (!nenhumGrupoPerde(total) || !creditoGrandeNaoAcrescenta(total)) continue;
      // 🔒 A compensação não pode abrir buraco: o que só o que sai cobria tem de continuar.
      if (complementoAnatomico(c2.id, desejados, porOutros) < ganhoDoQueSai) continue;
      /**
       * 🔒 A COMPENSAÇÃO NÃO MEXE NO CUSTO DO SEU SLOT — assinatura idêntica, sem exceção.
       *
       * 🔴 Medido: com a compensação livre para custar outro tempo, ela entrava com um
       * `UNILATERAL_DOIS_LADOS` no lugar de um unilateral; o dia ficava mais apertado, a
       * redução por tempo cortava uma série JUSTO do slot que devolvia o crédito, e a semana
       * terminava 0,5 abaixo no bíceps em 12 de 36 perfis. O par tem de ser neutro no
       * resultado, não só na intenção — e a única forma de garantir isso antes de a rampa
       * distribuir as séries é a compensação não mover o tempo do slot dela.
       *
       * ⚠️ A troca que GANHA cobertura continua podendo mudar de classe: é ela que precisa da
       * liberdade, e o dia inteiro é recalculado para ela.
       */
      if (assinaturaDeCusto(c2) !== assinaturaDeCusto(saiu)) continue;
      if (limites.custoDoDiaNaoAumenta) {
        const exsDepois = comPrimeira.map((e, k) => (k === j ? c2 : e));
        if (!limites.custoDoDiaNaoAumenta(d, exsDepois)) continue;
      }
      return { slot: j, de: saiu, para: c2 };
    }
  }
  return null;
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
        let melhorPar: Compensacao | null = null;

        /**
         * 🔒 UMA TROCA VENCE UM PAR. A primeira volta só aceita candidatos que não custam
         * crédito nenhum; a segunda é que admite compensação. Sem esta ordem, um candidato que
         * precisa de par e vem antes no pool ganhava de um equivalente que não precisa de nada,
         * e o dia mexia em dois slots para conseguir o que um resolvia.
         */
        for (const permitirPar of [false, true] as const) {
        if (melhor.id !== atual.id) break;
        for (const candidato of poolPorGrupo(slot.grupo, slot.favorito)) {
          if (candidato.id === atual.id || noDia.has(candidato.id)) continue;
          /**
           * 🔵 O TEMPO É RECALCULADO, NÃO PRESUMIDO (correção 2026-09-17).
           *
           * A assinatura de custo continua valendo como atalho — quando ela é idêntica, o dia
           * comprovadamente não se move e não há o que recalcular. Quando ela difere, a
           * pergunta passa a ser a REAL ("o dia ficou mais caro?"), feita à autoridade de
           * duração do montador, em vez de reprovada por proxy.
           *
           * 🔴 O defeito que isto conserta, medido: de 659 regiões sem exercício identificado
           * em 144 perfis, 585 eram reprovadas AQUI, antes de qualquer conta de cobertura — e
           * a alternativa complementar é quase sempre de outra classe (flexora ao lado da
           * dobradiça, encolhimento ao lado da remada, abdução ao lado da extensão de
           * quadril), que por construção descansa outro tanto. A trava não protegia o dia:
           * ela proibia justamente a classe que fecha a lacuna, inclusive quando a troca sai
           * MAIS BARATA.
           */
          if (assinaturaDeCusto(candidato) !== custo) {
            if (!limites.custoDoDiaNaoAumenta) continue;
            const exsDepois = dia.slots.map((s, k) => (k === i ? candidato : s.exercicio));
            if (!limites.custoDoDiaNaoAumenta(d, exsDepois)) continue;
          }
          const ganho = ganhoDe(candidato.id);
          if (ganho < ganhoAtual) continue;
          const traco = atualRedundante && trazTracoNovo(candidato.id);
          if (ganho === ganhoAtual && !traco) continue;
          // Cobertura vence complementaridade; entre iguais, o primeiro do pool permanece.
          if (ganho < melhorGanho) continue;
          if (ganho === melhorGanho && melhor !== atual && !(traco && !melhorTraco)) continue;

          const delta = deltaDaTroca(atual, candidato, limites.seriesPlanejamento);
          /**
           * 🔵 O PAR COMPENSADO (decisão do autor, 2026-09-17) — quando a única coisa que
           * impede a cobertura é o crédito indireto de um vizinho, o passe procura uma SEGUNDA
           * troca, no mesmo dia, que devolva exatamente o que a primeira tirou.
           *
           * 🔒 A regra de volume NÃO é flexibilizada: o par só é aceito se o delta SOMADO
           * deixar todo grupo em ≥ 0 e nenhum grande em > 0 — isto é, a semana termina com o
           * mesmo crédito ponderado de antes, grupo por grupo. É a mesma invariante que
           * `credito-nao-regride.test.ts` trava; o que muda é que ela passa a ser lida sobre o
           * conjunto final do dia, e não sobre uma troca isolada.
           *
           * 🔴 O caso medido: num dia "Costas + Bíceps" com quatro remadas, o encolhimento
           * abre o trapézio superior mas não credita bíceps como a remada que sai. Sozinha, a
           * troca tirava 0,5 × séries de bíceps e era recusada. Em par com a troca de uma remada
           * sem secundário por outra COM bíceps, o bíceps termina igual — e o trapézio superior
           * deixa de ficar sem exercício identificado.
           */
          let par: Compensacao | null = null;
          if (!nenhumGrupoPerde(delta) || !creditoGrandeNaoAcrescenta(delta)) {
            if (!permitirPar) continue;
            par = procurarCompensacao({
              dia, d, indice: i, candidato, delta, desejados, noDia, limites, poolPorGrupo,
            });
            if (!par) continue;
          }
          const antesLista = todosOsExercicios();
          const depoisLista = antesLista.map((e) => {
            if (e === atual) return candidato;
            if (par && e === par.de) return par.para;
            return e;
          });
          if (!padroesPreservados(antesLista, depoisLista)) continue;

          melhor = candidato;
          melhorGanho = ganho;
          melhorTraco = traco;
          melhorPar = par;
        }
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
        if (melhorPar) {
          const alvoDoPar = dia.slots[melhorPar.slot]!;
          /**
           * 🔒 A ATRIBUIÇÃO QUE ZERA O PAR EM QUALQUER DOSE (correção medida, 2026-09-17).
           *
           * 🔴 O defeito: o par preservava o crédito na moeda de PLANEJAMENTO (todas as séries
           * no máximo), mas a rampa distribui séries DIFERENTES entre slots do mesmo grupo. Com
           * 4 séries no slot que perdia e 3 no que devolvia, a semana terminava 0,5 abaixo —
           * medido em 12 de 36 perfis, todos iniciantes, sempre no bíceps (8 → 7,5).
           *
           * 🔑 O conserto não é uma tolerância: é colocar cada exercício no slot cujo antigo
           * tinha o MESMO perfil de secundários. Aí o delta de cada slot é zero por si, e o
           * crédito fica idêntico com qualquer distribuição de séries. O CONJUNTO do dia é o
           * mesmo nas duas arrumações — a cobertura ganha o mesmo, e o tempo não se move.
           *
           * ⚠️ Só quando os dois slots têm o mesmo estado de FAVORITO: os pools de favorito e
           * não-favorito são distintos (DF #12), e trocar as pontas misturaria os dois.
           */
          const mesmasSec = (a: Exercise, b: Exercise) => {
            const x = new Set(secundariosDe(a)); const y = secundariosDe(b);
            return x.size === y.length && y.every((g) => x.has(g));
          };
          const espelhar = slot.favorito === alvoDoPar.favorito
            && mesmasSec(melhorPar.para, atual) && mesmasSec(melhor, melhorPar.de);
          const paraOSlot = espelhar ? melhorPar.para : melhor;
          const paraOPar = espelhar ? melhor : melhorPar.para;
          slot.exercicio = paraOSlot;
          trocas[trocas.length - 1] = { ...trocas[trocas.length - 1]!, para: paraOSlot.id };
          trocas.push({
            dia: d,
            slot: melhorPar.slot,
            grupo: alvoDoPar.grupo,
            de: melhorPar.de.id,
            para: paraOPar.id,
            motivo: 'compensacao',
            alvosGanhos: [],
            tracosGanhos: [],
          });
          noDia.delete(melhorPar.de.id);
          noDia.add(melhorPar.para.id);
          alvoDoPar.exercicio = paraOPar;
        }
        mudou = true;
      }
    }
    if (!mudou) break;
  }

  /**
   * 🔵 FASE 2 — A ADIÇÃO CONTROLADA (decisão do autor, 2026-09-17).
   *
   * Roda DEPOIS do ponto fixo das trocas, e só onde a troca não resolveu: é a ordem de atuação
   * que o autor pediu — combinação primeiro, troca depois, acrescentar por último.
   *
   * 🔒 Nada aqui decide limite: estrutura, tempo e volume são três perguntas ao chamador,
   * respondidas pelas autoridades que já existem. Sem `limites.adicao` o passe não acrescenta
   * nada, e o contrato antigo continua valendo inteiro.
   *
   * 🔴 Não reduz ninguém para caber: se não couber, o exercício não entra e a região fica
   * pendente — e é o diagnóstico que a explica.
   */
  if (limites.adicao) {
    for (let d = 0; d < dias.length; d += 1) {
      const dia = dias[d]!;
      const desejados = alvosDesejadosDoDia(dia.grupos);
      if (desejados.size === 0) continue;
      let livres = limites.adicao.slotsLivres(d);
      const noDia = new Set(dia.slots.map((s) => s.exercicio.id));
      while (livres > 0) {
        const abordados = abordadosNoDia([...noDia], desejados);
        if (abordados.size === desejados.size) break;
        let escolhido: Exercise | null = null;
        let ganhoEscolhido = 0;
        /**
         * 🔒 SÓ GRUPO QUE JÁ TREINA NESTE DIA. O template do dia lista grupos-ALVO, e o
         * alocador pode não ter dado slot a todos — acrescentar num grupo ausente criaria uma
         * SESSÃO nova daquele grupo, e frequência, recuperação e dias consecutivos são decisão
         * do alocador, não da cobertura.
         *
         * 🔴 Medido: sem esta trava o passe punha core num quarto dia e o avançado 6d saía com
         * `core 4×`, contra o invariante travado de 2–3×/semana. Acrescentar DENTRO de um
         * grupo que já treina naquele dia não move frequência nenhuma.
         */
        const gruposDoDia = new Set(dia.slots.map((s) => s.grupo));
        for (const g of dia.grupos) {
          if (!gruposDoDia.has(g)) continue;
          if (limites.gruposPreservados?.includes(g)) continue;
          if (limites.adicao.gruposPreservados?.includes(g)) continue;
          // 🔒 Adição nunca é favorito: favorito é escolha declarada da pessoa (DF #12), e o
          //    passe não promove ninguém a favorito para fechar cobertura.
          for (const candidato of poolPorGrupo(g, false)) {
            if (noDia.has(candidato.id)) continue;
            const ganho = complementoAnatomico(candidato.id, desejados, abordados);
            if (ganho <= ganhoEscolhido) continue;
            if (!limites.adicao.cabeNoTetoDeSlots(candidato)) continue;
            const exsDepois = [...dia.slots.map((s) => s.exercicio), candidato];
            if (!limites.adicao.cabeNoTempo(d, exsDepois)) continue;
            if (!limites.adicao.cabeNoVolume(d, candidato)) continue;
            if (!padroesPreservados(dia.slots.map((s) => s.exercicio), exsDepois)) continue;
            escolhido = candidato;
            ganhoEscolhido = ganho;
          }
        }
        if (!escolhido) break;
        const ganhos = [...diretosDoExercicio(escolhido.id)]
          .filter((a) => desejados.has(a) && !abordados.has(a)).sort();
        dia.slots.push({ grupo: escolhido.grupoPrimario!, exercicio: escolhido, favorito: false });
        trocas.push({
          dia: d,
          slot: dia.slots.length - 1,
          grupo: escolhido.grupoPrimario!,
          de: null,
          para: escolhido.id,
          motivo: 'adicao_complementar',
          alvosGanhos: ganhos,
          tracosGanhos: [],
        });
        noDia.add(escolhido.id);
        livres -= 1;
      }
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
  | 'slots_do_dia_esgotados'
  /** 🔵 Havia candidato elegível; o dia já está no seu orçamento de exercícios. */
  | 'sem_espaco_na_estrutura'
  /** 🔵 Havia candidato elegível; acrescentá-lo passaria do tempo escolhido para a sessão. */
  | 'sem_espaco_no_tempo'
  /** 🔵 Havia candidato elegível; acrescentá-lo passaria dos limites de volume da semana/dia. */
  | 'sem_espaco_no_volume'
  /**
   * 🔵 Havia candidato elegível e caberia; trocar por ele deixaria OUTRA região descoberta ou
   * tiraria volume indireto de outro grupo, e não houve par que devolvesse.
   */
  | 'trocar_custaria_outra_regiao';

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
  /**
   * 🔵 AS MARGENS REAIS do dia (2026-09-17), quando o chamador as conhece. Sem elas o motivo
   * continua sendo o de antes; com elas, "havia candidato elegível e mesmo assim não entrou"
   * deixa de ser um motivo vago e passa a nomear QUAL limite agiu — que é o que o item 6 do
   * pedido exige e o que o editor precisa para não contar outra história.
   */
  espaco?: {
    slotsLivres: number;
    cabeNoTempo: (novo: Exercise) => boolean;
    cabeNoVolume: (novo: Exercise) => boolean;
    /** Trocar `sai` por `entra` deixaria o dia MAIS CARO? (a mesma pergunta que o passe faz) */
    trocaNaoEncarece: (sai: Exercise, entra: Exercise) => boolean;
  };
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
    /**
     * 🔵 Por que o candidato elegível não entrou — nomeando o limite que de fato agiu, e na
     * ORDEM em que o passe os aplica: estrutura, tempo, volume e, por último, o custo em
     * cobertura ou crédito de trocar alguém por ele.
     */
    const porQueNaoEntrou = (): MotivoSemCobertura => {
      if (!args.espaco) return sobraSlot ? 'sem_candidato_elegivel' : 'slots_do_dia_esgotados';
      const candidatos = diretosElegiveis.map((id) => args.elegiveis.find((e) => e.id === id)!);
      if (args.espaco.slotsLivres <= 0) return 'sem_espaco_na_estrutura';
      const noTempo = candidatos.filter((e) => args.espaco!.cabeNoTempo(e));
      if (noTempo.length === 0) return 'sem_espaco_no_tempo';
      if (!noTempo.some((e) => args.espaco!.cabeNoVolume(e))) return 'sem_espaco_no_volume';
      return 'trocar_custaria_outra_regiao';
    };
    const motivo: MotivoSemCobertura =
      diretos.length === 0 && condicionais.length === 0 ? 'sem_candidato_no_catalogo'
        : diretosElegiveis.length === 0 && condicionaisElegiveis.length === 0 ? 'sem_candidato_elegivel'
          : diretosElegiveis.length === 0 ? 'condicao_de_execucao_nao_declarada'
            : porQueNaoEntrou();
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
    /**
     * 🔵 Correção 2026-09-17: o custo deixou de ser um veto por PROXY, então o motivo
     * também deixa. Quando o chamador traz a autoridade de tempo, "custaria outro tempo" só é
     * dito se NENHUMA alternativa passar pela conta real do dia; sem ela, vale o atalho da
     * assinatura, como antes. O diagnóstico continua contando a mesma história que a decisão.
     */
    const cabeNoTempo = (e: Exercise) => (args.espaco
      ? args.espaco.trocaNaoEncarece(referencia, e)
      : assinaturaDeCusto(e) === assinaturaDeCusto(referencia));
    const motivo: MotivoRedundancia = alternativas.length === 0
      ? 'sem_alternativa_no_catalogo_elegivel'
      : !alternativas.some(cabeNoTempo) ? 'alternativa_custaria_outro_tempo' : 'alternativa_mudaria_credito';
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
