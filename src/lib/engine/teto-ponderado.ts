/**
 * 🔴 O TETO DURO NA CONTA CANÔNICA (correção 2026-09-15).
 *
 * 🔑 O defeito que este módulo fecha, medido em `3d86cbf`: o MRV era cobrado em DUAS moedas
 * diferentes no mesmo motor.
 *  · `alocador.alvoPonderado` mira `banda.max` na conta PONDERADA (direto 1,0 + secundário 0,5);
 *  · o guard de cobertura do montador compara `mev` contra a conta PONDERADA;
 *  · o crítico do editor compara `mrv` contra a conta PONDERADA;
 *  · mas a rampa (`alvoDaSemana`) e o bloco adicional do foco decidiam SÉRIES DIRETAS e nunca
 *    reconferiam o total ponderado.
 * Resultado medido: peito 17 contra teto 16 com foco (3 dos 3 casos do relato), e costas 21
 * contra teto 20 **sem foco nenhum**, em 212 de 3 888 combinações. Quem montava e quem
 * criticava liam o mesmo número em unidades diferentes.
 *
 * 🔒 Este módulo NÃO tem fórmula de volume própria. Ele chama `creditoPonderadoDaSemana`
 * — a mesma função do alocador v4, do guard de cobertura e do crítico — e recebe a faixa
 * já decidida por quem tem autoridade sobre ela (`prescricaoDaSemana.volumePorGrupoSemana`).
 * Uma segunda conta aqui seria exatamente a segunda verdade que o defeito criou.
 *
 * 🔒 Só os GRANDES têm faixa (DF②: os pequenos têm piso de presença, não banda) — é o mesmo
 * recorte de `GRUPOS_GRANDES` que o placar do crítico usa. Cobrar teto de quem não tem faixa
 * inventaria um limite que o cofre não tem.
 *
 * PURO e determinístico: sem relógio, sem rede, sem estado.
 */
import type { Exercise, GrupoPrimario } from '../data/types';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './alocador';
import { PESO_SECUNDARIO, secundariosDe } from './secundarios';

/** Um slot, como o montador o tem na mão: exercício + séries já decididas. */
export interface SlotPonderavel {
  exercicio: Exercise;
  series?: number;
}

const ehGrande = (g: GrupoPrimario | null | undefined): g is GrupoPrimario =>
  g != null && (GRUPOS_GRANDES as readonly string[]).includes(g);

/**
 * 🔵 O TETO É POR GRUPO (decisão 2026-09-17) — um número só deixou de bastar.
 *
 * Com a margem de 3, o grupo EM FOCO tem teto cheio (13/19/21) e os demais param no máximo
 * automático (10/16/18) NA MESMA semana. Um teto escalar obrigaria quem chama a rodar a poda
 * duas vezes, com dois conjuntos de slots — e o crédito ponderado é do plano INTEIRO, então
 * o total de cada passada seria falso. Quem decide o teto de cada grupo é `tetoSemanalDoGrupo`
 * (em `trilhos.ts`); aqui só se lê o que ele devolve.
 *
 * O número simples continua aceito: é o mesmo teto para todos os grupos.
 */
export type TetoPorGrupo = number | ((grupo: GrupoPrimario) => number);

const tetoDe = (teto: TetoPorGrupo, grupo: GrupoPrimario): number =>
  (typeof teto === 'number' ? teto : teto(grupo));

/** O crédito ponderado atual, na conta canônica. Reexportado para o chamador não duplicar import. */
export function creditoAtual(slots: readonly SlotPonderavel[]): Map<GrupoPrimario, number> {
  return creditoPonderadoDaSemana(slots);
}

/**
 * Quanto cada grande AINDA cabe antes do teto. Negativo = já estourou (o caso que a poda
 * abaixo resolve). Grupos sem faixa não aparecem: eles não têm teto para gastar.
 */
export function folgaAteOTeto(
  credito: ReadonlyMap<GrupoPrimario, number>,
  teto: TetoPorGrupo,
): Map<GrupoPrimario, number> {
  const folga = new Map<GrupoPrimario, number>();
  for (const g of GRUPOS_GRANDES) folga.set(g, tetoDe(teto, g) - (credito.get(g) ?? 0));
  return folga;
}

/**
 * Quantas séries um slot NOVO pode receber sem levar nenhum grande acima do teto —
 * contando o crédito indireto que ele distribui (0,5 por secundário), não só o direto.
 *
 * Devolve 0 quando nem uma série cabe: aí o slot não entra. É o degrau que a DF de
 * 2026-07-31 já previa — *"quem já está no topo não ganha volume; ganha ORDEM"*.
 */
export function seriesQueCabemNoTeto(
  exercicio: Exercise,
  desejadas: number,
  credito: ReadonlyMap<GrupoPrimario, number>,
  teto: TetoPorGrupo,
): number {
  const primario = exercicio.grupoPrimario;
  const secundarios = secundariosDe(exercicio).filter(ehGrande);
  for (let n = Math.max(0, Math.trunc(desejadas)); n > 0; n -= 1) {
    const cabePrimario = !ehGrande(primario) || (credito.get(primario) ?? 0) + n <= tetoDe(teto, primario);
    const cabeIndireto = secundarios.every((g) => (credito.get(g) ?? 0) + n * PESO_SECUNDARIO <= tetoDe(teto, g));
    if (cabePrimario && cabeIndireto) return n;
  }
  return 0;
}

/**
 * 🔒 QUEM barrou o slot — a frase da tela precisa nomear o grupo certo.
 *
 * ⚠️ Nasceu de um erro medido no QA desta correção: com peito em 18/20 e OMBROS em 19,5/20, o
 * bloco de peito era recusado (cada série de peito credita 0,5 a ombros) e a mensagem dizia
 * *"o volume de Peito já está no máximo"* — afirmando do focado o que era verdade do terceiro.
 * Devolve os grandes sem espaço para UMA série deste exercício, na ordem canônica.
 */
export function gruposSemEspaco(
  exercicio: Exercise,
  credito: ReadonlyMap<GrupoPrimario, number>,
  teto: TetoPorGrupo,
): GrupoPrimario[] {
  const primario = exercicio.grupoPrimario;
  const sem: GrupoPrimario[] = [];
  if (ehGrande(primario) && (credito.get(primario) ?? 0) + 1 > tetoDe(teto, primario)) sem.push(primario);
  for (const g of secundariosDe(exercicio)) {
    if (ehGrande(g) && (credito.get(g) ?? 0) + PESO_SECUNDARIO > tetoDe(teto, g) && !sem.includes(g)) sem.push(g);
  }
  return sem;
}

/** Soma ao crédito o que um slot de `n` séries entrega — direto 1,0 e secundário 0,5. */
export function creditar(
  credito: Map<GrupoPrimario, number>,
  exercicio: Exercise,
  n: number,
): void {
  if (n <= 0) return;
  const g = exercicio.grupoPrimario;
  if (g) credito.set(g, (credito.get(g) ?? 0) + n);
  for (const sec of secundariosDe(exercicio)) credito.set(sec, (credito.get(sec) ?? 0) + n * PESO_SECUNDARIO);
}

/**
 * 🔒 A MARCA da frase da poda — uma constante, não um literal repetido.
 *
 * A semana de deload monta o plano-base internamente (`rotinaBaseDoDeload`) e só aproveita
 * os DIAS dele; os avisos daquela montagem são descartados. Sem esta marca, a semana 6 não
 * teria como saber que o base já tinha sido podado — e entregaria menos séries sem dizer
 * por quê (medido: 40 das 3 888 células, todas S6). Quem emite e quem detecta leem daqui.
 */
export const MARCA_PODA_TETO = 'para não passar do máximo desta semana';

export interface PodaPonderada {
  /** Grupos que estavam acima do teto e quantas séries diretas foram devolvidas. */
  podados: { grupo: GrupoPrimario; series: number }[];
  /** Grupos que continuaram acima do teto porque todos os slots já estavam no piso do nível. */
  irredutiveis: GrupoPrimario[];
}

/**
 * 🔒 A PODA DO BASELINE — tira o excesso PONDERADO de um grande, e só dele.
 *
 * ⚠️ Três travas, para a poda não virar outro defeito:
 *  · tira série **apenas dos slots diretos do próprio grupo** que estourou — nenhum terceiro
 *    paga por um teto que não é dele;
 *  · nunca abaixo de `seriesMinimas` (o piso por exercício do nível): abaixo disso o conserto
 *    de um trilho quebraria outro;
 *  · o slot escolhido é sempre o de MAIS séries (desempate: primeiro no plano), então a poda é
 *    determinística e distribui o corte em vez de zerar um exercício.
 *
 * Se nem assim couber, o grupo entra em `irredutiveis` — o excesso FICA e o crítico continua
 * dizendo. Silenciar aqui seria esconder no montador o que o editor existe para mostrar.
 *
 * Muta `series` dos slots recebidos, como o resto do laço de séries do montador.
 */
export function podarExcessoPonderado(
  slots: readonly SlotPonderavel[],
  teto: TetoPorGrupo,
  seriesMinimas: number,
  /**
   * 🔒 Quem PODE ceder série. Recebe TODOS os slots (o crédito ponderado é do plano
   * inteiro — filtrar a entrada daria um total falso) e decide, slot a slot, quem está
   * disponível para a poda. O desenho da pessoa usa isto para proteger as séries que ela
   * mesma escolheu: o app corrige o número que o app decidiu, nunca o dela.
   */
  podavel: (slot: SlotPonderavel) => boolean = () => true,
): PodaPonderada {
  const podados = new Map<GrupoPrimario, number>();
  const irredutiveis: GrupoPrimario[] = [];
  /**
   * Limite de voltas: cada volta ou tira UMA série, ou marca UM grupo como irredutível.
   *
   * ⚠️ O `+ GRUPOS_GRANDES.length` foi medido, não precaução: com TODOS os slots protegidos
   * (o desenho da pessoa inteiro dosado por ela), o orçamento antigo era 0 + 1 = 1 volta, e a
   * função devolvia só o PRIMEIRO grupo estourado — com peito, costas e ombros a 24 contra 16,
   * `irredutiveis` vinha com peito sozinho. Termina sempre, e nunca antes da hora.
   */
  const maxVoltas = slots.reduce((n, s) => n + (podavel(s) ? Math.max(0, (s.series ?? 0) - seriesMinimas) : 0), 0)
    + GRUPOS_GRANDES.length + 1;
  for (let volta = 0; volta < maxVoltas; volta += 1) {
    const credito = creditoPonderadoDaSemana(slots);
    const excedido = GRUPOS_GRANDES.find(
      (g) => (credito.get(g) ?? 0) > tetoDe(teto, g) && !irredutiveis.includes(g),
    );
    if (!excedido) break;
    const candidatos = slots.filter(
      (s) => s.exercicio.grupoPrimario === excedido && (s.series ?? 0) > seriesMinimas && podavel(s),
    );
    if (candidatos.length === 0) {
      irredutiveis.push(excedido);
      continue;
    }
    const alvo = candidatos.reduce((a, b) => ((b.series ?? 0) > (a.series ?? 0) ? b : a));
    alvo.series = (alvo.series ?? 0) - 1;
    podados.set(excedido, (podados.get(excedido) ?? 0) + 1);
  }
  return {
    podados: [...podados].map(([grupo, series]) => ({ grupo, series })),
    irredutiveis,
  };
}

/**
 * 🔒 A MARCA da frase da poda POR SESSÃO — irmã de `MARCA_PODA_TETO`, e separada de
 * propósito: os dois limites valem ao mesmo tempo e a pessoa precisa saber QUAL mordeu.
 */
export const MARCA_PODA_SESSAO = 'para não passar do máximo de um treino só';

export interface PodaPorSessao {
  /** Grupos podados, com o índice do dia em que o excesso estava. */
  podados: { grupo: GrupoPrimario; series: number; dia: number }[];
  /** Grupos que continuaram acima do teto do dia (todos os slots no piso ou protegidos). */
  irredutiveis: { grupo: GrupoPrimario; dia: number }[];
}

/**
 * 🔵 O TETO POR SESSÃO — 12 séries ponderadas por grupo em UM dia (decisão 2026-09-17).
 *
 * 🔑 É a MESMA poda do teto semanal, aplicada ao recorte do DIA: o crédito ponderado de um
 * dia é o do plano inteiro restrito àquele dia, então basta rodar `podarExcessoPonderado`
 * sobre os slots de cada dia. Uma segunda implementação aqui seria a segunda verdade que
 * este arquivo existe para não criar.
 *
 * 🔒 Os dois limites valem SIMULTANEAMENTE: um plano pode estar dentro do semanal e estourar
 * o diário (iniciante com 11 num dia respeita o teto do dia e viola o máximo semanal de 10;
 * intermediário em foco com 13 num dia respeita o semanal de 19 e viola o do dia). Por isso
 * as duas passadas existem, e nenhuma substitui a outra.
 *
 * 🔴 Não há margem de 3 aqui — a margem é só do teto SEMANAL dos grupos sem foco. E o teto
 * do dia é o mesmo para quem está em foco e para quem não está.
 */
export function podarExcessoPonderadoNaSessao(
  dias: readonly (readonly SlotPonderavel[])[],
  teto: TetoPorGrupo,
  seriesMinimas: number,
  podavel: (slot: SlotPonderavel) => boolean = () => true,
): PodaPorSessao {
  const podados: PodaPorSessao['podados'] = [];
  const irredutiveis: PodaPorSessao['irredutiveis'] = [];
  dias.forEach((slots, dia) => {
    const r = podarExcessoPonderado(slots, teto, seriesMinimas, podavel);
    for (const p of r.podados) podados.push({ ...p, dia });
    for (const g of r.irredutiveis) irredutiveis.push({ grupo: g, dia });
  });
  return { podados, irredutiveis };
}
