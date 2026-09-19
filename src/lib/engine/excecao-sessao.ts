/**
 * 🔵 A EXCEÇÃO AO TETO POR SESSÃO — decisão do autor de 2026-09-17 (2ª volta).
 *
 * 🔑 O que a decisão mudou: **12 séries ponderadas por grupo num mesmo treino continua sendo
 * o limite normal de montagem**, mas deixou de ser obrigação absoluta. Quando o motor
 * ESGOTA as alternativas válidas, a proposta pode ficar acima de 12 — e aí ela é DITA, com
 * grupo, dia, volume ponderado e a referência de 12, antes da confirmação e depois dela.
 *
 * 🔴 Três travas que a decisão impõe, e que este módulo materializa:
 *  ① **nada de busca ilimitada.** As alternativas são enumeradas por regra, não por
 *    tentativa e erro: os slots do dia que alimentam o grupo, e para cada um os exercícios
 *    do MESMO grupo com o MESMO padrão e a MESMA assinatura de custo. O conjunto é finito e
 *    determinístico.
 *  ② **nada de impossibilidade global afirmada a partir de uma tentativa gulosa.** Cada
 *    candidato examinado sai daqui NOMEADO, com o motivo da rejeição (`alternativas`). Quem
 *    lê o relatório vê o que foi tentado, não uma conclusão.
 *  ③ **nada de violar as regras vigentes para caber.** A troca preserva grupo primário,
 *    padrão de movimento e custo de tempo (`mesmoCustoDeSlot` — a mesma régua que a
 *    cobertura anatômica usa para trocar sem mexer no relógio), não repete exercício já no
 *    plano, não empurra ninguém acima de nenhum dos dois tetos e não derruba um grupo que
 *    estava dentro da faixa para baixo do mínimo dela.
 *
 * 🔒 O que este módulo NÃO faz: cortar série de terceiro. A poda (`podarExcessoPonderado`)
 * já tirou o que podia dos slots DIRETOS do próprio grupo, e cobrar de quem não estourou
 * nada segue proibido. A redução por série entra aqui só como alternativa EXAMINADA, com o
 * motivo pelo qual não resolveu.
 *
 * PURO e determinístico: sem relógio, sem rede, sem estado global.
 */
import type { Exercise, GrupoPrimario } from '../data/types';
import { ehReferencia, rankReferencia } from './selecao-referencia';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './alocador';
import { diretosDoExercicio, mesmoCustoDeSlot } from './cobertura-anatomica';
import { PESO_SECUNDARIO, secundariosDe } from './secundarios';
import type { SlotPonderavel, TetoPorGrupo } from './teto-ponderado';

/** Por que uma alternativa examinada não foi aplicada — ou que ela foi. */
export type MotivoAlternativa =
  | 'aplicada'
  | 'sem_candidato_no_catalogo'
  | 'candidato_credita_o_mesmo_grupo'
  | 'candidato_ja_esta_no_plano'
  | 'candidato_com_outro_custo_de_tempo'
  | 'candidato_estoura_outro_limite'
  | 'candidato_derruba_grupo_abaixo_do_minimo'
  | 'slot_escolhido_pela_pessoa'
  | 'sem_outro_dia_com_o_grupo'
  | 'dia_de_destino_sem_espaco'
  | 'dia_de_destino_sem_tempo'
  | 'todos_os_slots_no_piso';

export type TipoAlternativa = 'troca_de_exercicio' | 'mudanca_de_dia' | 'reducao_de_series';

export interface AlternativaExaminada {
  tipo: TipoAlternativa;
  /** O slot do plano que a alternativa mexeria (id do exercício que está lá hoje). */
  slot: string;
  /** O que se examinou pôr no lugar: id do exercício, ou `dia N` na mudança de dia. */
  candidato?: string;
  aceita: boolean;
  motivo: MotivoAlternativa;
}

/** Um excesso que SOBROU depois de esgotadas as alternativas — a exceção autorizada. */
export interface ExcecaoDeSessao {
  grupo: GrupoPrimario;
  /** Índice do dia de treino no plano entregue. */
  dia: number;
  nomeDoDia: string;
  /** Volume ponderado do grupo NAQUELE dia (direta 1,0 + indireta 0,5). */
  ponderado: number;
  /** A referência de montagem: 12 em hipertrofia. */
  teto: number;
  direto: number;
  indireto: number;
  /** De quem vem o crédito indireto, e quanto — o "motivo concreto" que a decisão exige. */
  origensIndiretas: { grupo: GrupoPrimario; credito: number }[];
  /** Tudo o que se tentou antes de aceitar o excesso. */
  alternativas: AlternativaExaminada[];
}

export interface DiaComSlots<S extends SlotPonderavel> {
  nome: string;
  slots: S[];
}

const porId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const tetoDe = (teto: TetoPorGrupo, grupo: GrupoPrimario): number =>
  (typeof teto === 'number' ? teto : teto(grupo));

/** Quanto de crédito um exercício deposita num grupo, por série. 1,0 direto · 0,5 indireto. */
function creditoPorSerie(e: Exercise, grupo: GrupoPrimario): number {
  if (e.grupoPrimario === grupo) return 1;
  return secundariosDe(e).includes(grupo) ? PESO_SECUNDARIO : 0;
}

/**
 * O crédito do grupo num dia, aberto em direto × indireto e por ORIGEM — sem conta própria:
 * a soma bate com `creditoPonderadoDaSemana` do mesmo recorte, por construção.
 */
export function detalharCreditoDoDia(
  slots: readonly SlotPonderavel[],
  grupo: GrupoPrimario,
): { direto: number; indireto: number; origens: { grupo: GrupoPrimario; credito: number }[] } {
  let direto = 0;
  const origens = new Map<GrupoPrimario, number>();
  for (const s of slots) {
    const n = s.series ?? 0;
    if (n <= 0) continue;
    if (s.exercicio.grupoPrimario === grupo) { direto += n; continue; }
    if (!secundariosDe(s.exercicio).includes(grupo)) continue;
    const de = s.exercicio.grupoPrimario;
    if (!de) continue;
    origens.set(de, (origens.get(de) ?? 0) + n * PESO_SECUNDARIO);
  }
  return {
    direto,
    indireto: [...origens.values()].reduce((a, b) => a + b, 0),
    origens: [...origens].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([g, credito]) => ({ grupo: g, credito })),
  };
}

/** Os pares (dia, grupo) acima do teto do dia, na ordem canônica — dia primeiro. */
function acimaDoTeto<S extends SlotPonderavel>(
  dias: readonly DiaComSlots<S>[], teto: number,
): { dia: number; grupo: GrupoPrimario; ponderado: number }[] {
  const fora: { dia: number; grupo: GrupoPrimario; ponderado: number }[] = [];
  dias.forEach((d, dia) => {
    const credito = creditoPonderadoDaSemana(d.slots);
    for (const grupo of GRUPOS_GRANDES) {
      const v = credito.get(grupo) ?? 0;
      if (v > teto) fora.push({ dia, grupo, ponderado: v });
    }
  });
  return fora;
}

export interface ArgsTentativa<S extends SlotPonderavel> {
  dias: readonly DiaComSlots<S>[];
  /** O teto por sessão em vigor (12 em hipertrofia). */
  teto: number;
  /** Os exercícios elegíveis para esta pessoa — já filtrados por equipamento e saúde. */
  pool: readonly Exercise[];
  /** O teto SEMANAL de cada grupo: a troca não pode estourar o outro limite. */
  tetoSemanal: TetoPorGrupo;
  /** O mínimo semanal desejado: a troca não derruba quem estava dentro para fora. */
  pisoSemanal?: number;
  /** Slots que o app pode trocar. O desenho da pessoa, não — ela escolheu os exercícios. */
  trocavel?: (slot: S) => boolean;
  /**
   * 🔒 O dia AINDA cabe no tempo com estes slots? Exigido para a mudança de dia — mover um
   * exercício acrescenta execução, descanso e transição ao destino, e um teto de volume
   * nunca justifica estourar o tempo que a pessoa declarou. Sem esta função a mudança de
   * dia não é aplicada (a troca de exercício não precisa dela: `mesmoCustoDeSlot` já
   * garante que o relógio do dia não muda).
   */
  cabeNoTempo?: (dia: number, slots: readonly S[]) => boolean;
}

export interface Troca {
  dia: number;
  de: string;
  para: string;
  /** O grupo cujo excesso a troca resolveu (parcial ou totalmente). */
  porCausaDe: GrupoPrimario;
}

/**
 * 🔵 A TENTATIVA — roda ANTES das podas, porque a troca não custa série a ninguém e a poda
 * custa. Corrigir a composição primeiro entrega mais volume pelo mesmo limite.
 *
 * Devolve as trocas aplicadas (mutando `slot.exercicio`, como o resto do laço de montagem
 * muta `slot.series`) e o registro de TUDO o que foi examinado.
 */
export function tentarAlternativasDeSessao<S extends SlotPonderavel>(
  args: ArgsTentativa<S>,
): { trocas: Troca[]; alternativas: Map<string, AlternativaExaminada[]> } {
  const { dias, teto, pool, tetoSemanal } = args;
  const trocavel = args.trocavel ?? (() => true);
  const trocas: Troca[] = [];
  const alternativas = new Map<string, AlternativaExaminada[]>();
  const usados = new Set<string>(dias.flatMap((d) => d.slots.map((s) => s.exercicio.id)));
  const registrar = (dia: number, grupo: GrupoPrimario, a: AlternativaExaminada) => {
    const chave = dia + '/' + grupo;
    const lista = alternativas.get(chave) ?? [];
    lista.push(a);
    alternativas.set(chave, lista);
  };

  for (const { dia, grupo } of acimaDoTeto(dias, teto)) {
    const slots = dias[dia]!.slots;
    /**
     * 🔒 Só os slots INDIRETOS entram na troca. Trocar um slot DIRETO por outro do mesmo
     * grupo não muda nada — direto é 1,0 dos dois lados —, e é por isso que a lista começa
     * pelo que o slot deposita no grupo que estourou, do maior para o menor.
     */
    const doadores = slots
      .filter((s) => s.exercicio.grupoPrimario !== grupo && secundariosDe(s.exercicio).includes(grupo))
      .sort((a, b) => (b.series ?? 0) - (a.series ?? 0) || porId(a.exercicio, b.exercicio));

    for (const slot of doadores) {
      if ((creditoPonderadoDaSemana(slots).get(grupo) ?? 0) <= teto) break;
      if (!trocavel(slot)) {
        registrar(dia, grupo, { tipo: 'troca_de_exercicio', slot: slot.exercicio.id, aceita: false, motivo: 'slot_escolhido_pela_pessoa' });
        continue;
      }
      const antigo = slot.exercicio;
      /**
       * 🔒 A cobertura anatômica do dia entra como DESEMPATE, não como filtro: entre dois
       * candidatos igualmente válidos, ganha o que mantém os alvos que só este slot cobre
       * naquele dia. Sem isso a troca desfaria, calada, o passe de cobertura que já rodou.
       */
      const alvosDoDiaSemEste = new Set<string>(
        slots.filter((s) => s !== slot).flatMap((s) => [...diretosDoExercicio(s.exercicio.id)]),
      );
      const exclusivos = [...diretosDoExercicio(antigo.id)].filter((a) => !alvosDoDiaSemEste.has(a));
      const manutencao = (e: Exercise) =>
        [...diretosDoExercicio(e.id)].filter((x) => exclusivos.includes(x)).length;
      const candidatos = pool
        .filter((e) => e.grupoPrimario === antigo.grupoPrimario
          && e.padraoMovimento === antigo.padraoMovimento
          && e.id !== antigo.id)
        .sort((a, b) => creditoPorSerie(a, grupo) - creditoPorSerie(b, grupo)
          || manutencao(b) - manutencao(a)
          // 🔵 2026-09-19: entre equivalentes, a função de referência do grupo primeiro (o
          // agachamento frontal antes do avanço com salto) — a ordem por id desempata.
          || Number(ehReferencia(b)) - Number(ehReferencia(a))
          || rankReferencia(a) - rankReferencia(b)
          || porId(a, b));
      if (candidatos.length === 0) {
        registrar(dia, grupo, { tipo: 'troca_de_exercicio', slot: antigo.id, aceita: false, motivo: 'sem_candidato_no_catalogo' });
        continue;
      }
      for (const cand of candidatos) {
        const rejeitar = (motivo: MotivoAlternativa) =>
          registrar(dia, grupo, { tipo: 'troca_de_exercicio', slot: antigo.id, candidato: cand.id, aceita: false, motivo });
        if (usados.has(cand.id)) { rejeitar('candidato_ja_esta_no_plano'); continue; }
        if (creditoPorSerie(cand, grupo) >= creditoPorSerie(antigo, grupo)) { rejeitar('candidato_credita_o_mesmo_grupo'); continue; }
        if (!mesmoCustoDeSlot(antigo, cand)) { rejeitar('candidato_com_outro_custo_de_tempo'); continue; }
        // Simula: troca, mede os DOIS limites no plano inteiro, e desfaz se piorar algo.
        const semanaAntes = creditoPonderadoDaSemana(dias.flatMap((d) => d.slots));
        const diaAntes = creditoPonderadoDaSemana(slots);
        slot.exercicio = cand;
        const semanaDepois = creditoPonderadoDaSemana(dias.flatMap((d) => d.slots));
        const diaDepois = creditoPonderadoDaSemana(slots);
        const estouraSemana = GRUPOS_GRANDES.some((g) =>
          (semanaDepois.get(g) ?? 0) > tetoDe(tetoSemanal, g)
          && (semanaDepois.get(g) ?? 0) > (semanaAntes.get(g) ?? 0));
        const estouraODia = GRUPOS_GRANDES.some((g) =>
          g !== grupo && (diaDepois.get(g) ?? 0) > teto && (diaDepois.get(g) ?? 0) > (diaAntes.get(g) ?? 0));
        if (estouraSemana || estouraODia) { slot.exercicio = antigo; rejeitar('candidato_estoura_outro_limite'); continue; }
        const piso = args.pisoSemanal;
        if (piso != null && GRUPOS_GRANDES.some((g) =>
          (semanaAntes.get(g) ?? 0) >= piso && (semanaDepois.get(g) ?? 0) < piso)) {
          slot.exercicio = antigo;
          rejeitar('candidato_derruba_grupo_abaixo_do_minimo');
          continue;
        }
        usados.delete(antigo.id);
        usados.add(cand.id);
        trocas.push({ dia, de: antigo.id, para: cand.id, porCausaDe: grupo });
        registrar(dia, grupo, { tipo: 'troca_de_exercicio', slot: antigo.id, candidato: cand.id, aceita: true, motivo: 'aplicada' });
        break;
      }
    }

    /**
     * 🔒 A MUDANÇA DE DIA — examinada, e recusada por uma razão concreta e medida.
     *
     * Mover um slot direto para outro dia só é neutro quando aquele dia JÁ treina o grupo:
     * criar uma sessão nova do grupo mudaria a frequência semanal e o intervalo de 48 h
     * entre sessões do mesmo grupo, que são decisões de outra autoridade e não se alteram
     * para acomodar um teto. Por isso o destino elegível é "outro dia com slot DIRETO do
     * mesmo grupo e com espaço no teto do dia".
     */
    if ((creditoPonderadoDaSemana(slots).get(grupo) ?? 0) > teto) {
      const doador = [...slots]
        .filter((s) => s.exercicio.grupoPrimario === grupo)
        .sort((a, b) => (a.series ?? 0) - (b.series ?? 0) || porId(a.exercicio, b.exercicio))[0];
      if (doador) {
        const destinos = dias
          .map((d, i) => ({ d, i }))
          .filter(({ d, i }) => i !== dia && d.slots.some((s) => s.exercicio.grupoPrimario === grupo));
        if (destinos.length === 0) {
          registrar(dia, grupo, { tipo: 'mudanca_de_dia', slot: doador.exercicio.id, aceita: false, motivo: 'sem_outro_dia_com_o_grupo' });
        } else {
          for (const { d, i } of destinos) {
            const cabeNoDestino = (creditoPonderadoDaSemana([...d.slots, doador]).get(grupo) ?? 0) <= teto;
            if (!cabeNoDestino) {
              registrar(dia, grupo, { tipo: 'mudanca_de_dia', slot: doador.exercicio.id, candidato: 'dia ' + i, aceita: false, motivo: 'dia_de_destino_sem_espaco' });
              continue;
            }
            if (!args.cabeNoTempo || !args.cabeNoTempo(i, [...d.slots, doador])) {
              registrar(dia, grupo, { tipo: 'mudanca_de_dia', slot: doador.exercicio.id, candidato: 'dia ' + i, aceita: false, motivo: 'dia_de_destino_sem_tempo' });
              continue;
            }
            const origem = dias[dia]!;
            origem.slots = origem.slots.filter((s) => s !== doador);
            d.slots = [...d.slots, doador];
            registrar(dia, grupo, { tipo: 'mudanca_de_dia', slot: doador.exercicio.id, candidato: 'dia ' + i, aceita: true, motivo: 'aplicada' });
            break;
          }
        }
      }
    }
  }
  return { trocas, alternativas };
}

/**
 * 🔵 A DECLARAÇÃO — roda DEPOIS das podas, sobre o plano final. O que sobrar aqui é a
 * exceção que a decisão autoriza: ela é nomeada, medida e explicada, e nunca classificada
 * como "dentro de todos os limites".
 */
export function declararExcessoDeSessao<S extends SlotPonderavel>(args: {
  dias: readonly DiaComSlots<S>[];
  teto: number;
  alternativas?: Map<string, AlternativaExaminada[]>;
  /** Slots que a pessoa dosou: a redução por série nunca foi opção neles. */
  dosadoPelaPessoa?: (slot: S) => boolean;
}): ExcecaoDeSessao[] {
  const dosadoPelaPessoa = args.dosadoPelaPessoa ?? (() => false);
  return acimaDoTeto(args.dias, args.teto).map(({ dia, grupo, ponderado }) => {
    const slots = args.dias[dia]!.slots;
    const { direto, indireto, origens } = detalharCreditoDoDia(slots, grupo);
    const examinadas = [...(args.alternativas?.get(dia + '/' + grupo) ?? [])];
    /**
     * A terceira alternativa, sempre registrada: a poda por série. Ela JÁ rodou — o que se
     * registra aqui é por que não bastou, medido no plano final e não suposto.
     */
    for (const s of slots.filter((x) => x.exercicio.grupoPrimario === grupo)) {
      examinadas.push({
        tipo: 'reducao_de_series', slot: s.exercicio.id, aceita: false,
        motivo: dosadoPelaPessoa(s) ? 'slot_escolhido_pela_pessoa' : 'todos_os_slots_no_piso',
      });
    }
    return {
      grupo, dia, nomeDoDia: args.dias[dia]!.nome,
      ponderado: Math.round(ponderado * 10) / 10,
      teto: args.teto, direto, indireto: Math.round(indireto * 10) / 10,
      origensIndiretas: origens, alternativas: examinadas,
    };
  });
}

/**
 * 🔒 A FRASE da exceção — uma autoridade só para o plano, o editor e a prévia.
 *
 * Diz grupo, dia, volume ponderado e a referência de 12; nomeia a origem do crédito
 * indireto quando ela existe; e **não** afirma perigo nem lesão — a decisão é explícita
 * quanto a isso. O verbo é de montagem ("o app monta"), não de saúde.
 */
export const MARCA_EXCECAO_SESSAO = 'que o app usa como limite de um treino só';

const NOME_DA_ALTERNATIVA: Record<TipoAlternativa, string> = {
  troca_de_exercicio: 'trocar o exercício por um equivalente',
  mudanca_de_dia: 'passar o exercício para outro dia',
  reducao_de_series: 'reduzir as séries que o app dosou',
};

/**
 * 🔴 O ESFORÇO DITO É O ESFORÇO FEITO — e por isso mora aqui, numa autoridade só.
 *
 * A frase se monta a partir de `e.alternativas`, que é o registro nominal do que foi
 * examinado. Ela nunca diz "procuramos tudo": a busca deste módulo é um conjunto
 * DELIMITADO e enumerado por regra (os slots daquele dia que alimentam o grupo, e para
 * cada um os exercícios de mesmo grupo, mesmo padrão e mesma assinatura de custo), não
 * uma varredura do espaço de planos possíveis.
 *
 * 🔒 No desenho da pessoa nada é tentado — exercícios, dias e séries são escolha dela —, e
 * afirmar que se procurou seria inventar um esforço que não houve. Uma fórmula fixa na
 * tela ("procuramos outro exercício, outro dia e menos séries") mentiria justamente nesse
 * caso, que é o mais comum. Tela e motor leem esta função; não há segunda redação.
 */
export function esforcoDaExcecao(e: ExcecaoDeSessao): string {
  const tentado = [...new Set(e.alternativas.filter((a) => a.motivo !== 'slot_escolhido_pela_pessoa').map((a) => a.tipo))];
  if (tentado.length === 0) {
    return 'Os exercícios, os dias e as séries deste treino são sua escolha, e o app não mexe neles por conta própria.';
  }
  return 'Entre as alternativas que o app examina, tentamos '
    + tentado.map((t) => NOME_DA_ALTERNATIVA[t]).join(', ')
    + ' — nada disso coube nas suas outras escolhas.';
}

export function frasesDaExcecao(excecoes: readonly ExcecaoDeSessao[], rotulo: (g: GrupoPrimario) => string): string[] {
  return excecoes.map((e) => {
    const origem = e.origensIndiretas.length > 0
      ? ' ' + e.indireto + ' ' + (e.indireto === 1 ? 'vem' : 'vêm') + ' do trabalho indireto de '
        + e.origensIndiretas.map((o) => rotulo(o.grupo).toLowerCase()).join(', ') + ' no mesmo dia.'
      : '';
    return 'Neste plano, ' + rotulo(e.grupo).toLowerCase() + ' fica com ' + e.ponderado
      + ' séries em ' + e.nomeDoDia + ' — acima das ' + e.teto + ' ' + MARCA_EXCECAO_SESSAO
      + ', somando diretas e indiretas.' + origem + ' ' + esforcoDaExcecao(e)
      + ' O plano vai assim, e por isso não dá para dizer que ele está dentro de todos os limites.';
  });
}
