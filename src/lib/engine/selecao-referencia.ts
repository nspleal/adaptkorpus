/**
 * 🎯 SELEÇÃO POR FUNÇÃO E EXERCÍCIOS DE REFERÊNCIA — decisão do autor, 2026-09-19.
 *
 * O relato: o gerador entregava três variações de stiff no mesmo dia, duas de crucifixo e uma
 * flexão sem supino elegível, e várias remadas sem puxada. A causa não era o catálogo: era o
 * cursor de rotação do alocador, que só perguntava "qual é o PRÓXIMO do pool?" — nunca "que
 * FUNÇÃO este dia ainda não tem?" nem "qual é a referência deste grupo?".
 *
 * O que este módulo declara, e só isto:
 *  · a FUNÇÃO de um exercício = a família de equivalência do cofre (`familias.ts`, travada)
 *    ou, para quem não tem família, `grupo/padrão` (a extensora e62/e63 vira
 *    `quadriceps/isolado`; o encolhimento e97, `costas/isolado`);
 *  · a ORDEM DE REFERÊNCIA por grupo — as funções que o autor pediu para priorizar
 *    (pernas: agachamento/leg press/hack, extensora, flexora; superiores: supino, puxada e
 *    remadas). É seleção coerente por função, não obrigação de colocar todos os nomes:
 *    agachamento, leg press e hack são a MESMA função (alternativas), e um só basta.
 *
 * 🔒 O que NÃO muda: equipamento, nível, banidos, favoritos, `puxar ≥ empurrar`, tetos e
 * déficit continuam decidindo COMO decidiam. A referência só ordena os candidatos que já
 * passaram por tudo isso. E a variação de "Gerar novo treino" continua existindo — ela
 * desempata DENTRO da mesma função (qual supino, qual remada), sem desmontar a estrutura.
 *
 * 🔴 Nenhuma destas listas é prova científica de superioridade: são a preferência declarada
 * do autor para o exercício de referência de cada grupo, e não alteram a pesquisa anatômica.
 *
 * PURO e determinístico.
 */
import type { Exercise, GrupoPrimario } from '../data/types';
import { familiaDe } from './familias';

/**
 * 🔵 COMPLEMENTARES (decisão do autor, 2026-09-19): core, panturrilha e antebraço têm
 * prioridade INFERIOR aos grupos principais. O trabalho principal é montado e reservado
 * primeiro; cada dia comporta no máximo UM complementar (salvo dia disponível, dedicado a
 * eles); panturrilha fica sempre no dia de pernas e conta como o complementar desse dia.
 */
export const COMPLEMENTARES: readonly GrupoPrimario[] = ['core', 'panturrilha', 'antebraco'];

export function ehComplementar(g: GrupoPrimario | null | undefined): boolean {
  return g != null && (COMPLEMENTARES as readonly string[]).includes(g);
}

/** Grupos cuja presença no template faz do dia um dia de PERNAS (onde a panturrilha mora). */
export const GRUPOS_DE_PERNAS: readonly GrupoPrimario[] = ['quadriceps', 'posterior', 'gluteos'];

export function ehDiaDePernas(grupos: readonly GrupoPrimario[]): boolean {
  return grupos.some((g) => (GRUPOS_DE_PERNAS as readonly string[]).includes(g));
}

/**
 * Dia DISPONÍVEL para complementares: um dia da agenda escolhida cujo template não tem
 * nenhum grupo principal (é o caso do dia "Complementares" das divisões de 5–6 dias). Nele
 * o limite de um complementar por dia não se aplica — o dia existe para eles.
 *
 * 🔒 Nunca inventa dia: só um dia que o template já prevê pode ser disponível.
 */
export function ehDiaDisponivel(grupos: readonly GrupoPrimario[]): boolean {
  return grupos.length > 0 && grupos.every((g) => ehComplementar(g) || g === 'lombar');
}

/** A FUNÇÃO mecânica do exercício — a família do cofre, ou `grupo/padrão` para quem não tem. */
export function funcaoDe(e: Pick<Exercise, 'id' | 'grupoPrimario' | 'padraoMovimento'>): string {
  return familiaDe(e.id) ?? `${e.grupoPrimario ?? 'sem-grupo'}/${e.padraoMovimento}`;
}

/**
 * A ORDEM DE REFERÊNCIA por grupo — índice menor = referência mais forte. Função ausente da
 * lista vem DEPOIS de todas as listadas (nunca é excluída: se for a única elegível, entra).
 *
 * Nomes de família são os do cofre (`FAMILIAS`), verbatim. Os `grupo/padrão` cobrem quem
 * não tem família: a extensora (`quadriceps/isolado`) e o supino fechado (`triceps/empurrar`).
 */
export const REFERENCIA_POR_GRUPO: Readonly<Partial<Record<GrupoPrimario, readonly string[]>>> = {
  // A flexão é o substituto de peso do corpo do supino: entra quando não há supino elegível.
  // `peito/empurrar` é o supino declinado (e13), que não tem família no cofre.
  peito: ['supino-horizontal', 'supino-inclinado', 'peito/empurrar', 'crucifixo-peito', 'flexao'],
  costas: ['puxada-vertical', 'remada-horizontal', 'barra-fixa'],
  quadriceps: ['agachamento-bilateral', 'quadriceps/isolado', 'afundo'],
  posterior: ['flexora-posterior', 'stiff-terra'],
  gluteos: ['ponte-hip-thrust', 'gluteos/isolado', 'stiff-terra'],
  ombros: ['desenvolvimento', 'elevacao-lateral', 'crucifixo-invertido'],
  biceps: ['rosca-biceps'],
  triceps: ['triceps-extensao', 'triceps/empurrar', 'flexao'],
  panturrilha: ['panturrilha', 'panturrilha/isolado'],
};

/** A função do exercício está na lista de referência do seu grupo? (grupo sem lista: sim) */
export function ehReferencia(e: Pick<Exercise, 'id' | 'grupoPrimario' | 'padraoMovimento'>): boolean {
  const lista = e.grupoPrimario ? REFERENCIA_POR_GRUPO[e.grupoPrimario] : undefined;
  return !lista || lista.includes(funcaoDe(e));
}

/** Posição da função do exercício na ordem de referência do seu grupo (desconhecida = última). */
export function rankReferencia(e: Pick<Exercise, 'id' | 'grupoPrimario' | 'padraoMovimento'>): number {
  const lista = e.grupoPrimario ? REFERENCIA_POR_GRUPO[e.grupoPrimario] : undefined;
  if (!lista) return 0;
  const i = lista.indexOf(funcaoDe(e));
  return i < 0 ? lista.length : i;
}

/** Função de referência pedida pelo autor, sem confundir posição no ranking com
 * cobertura. Supinos são alternativas; barra fixa e puxada preservam tração vertical.
 * Só estas funções foram exigidas: outras famílias não viram barreira anatômica.
 */
export function papelReferencia(e: Pick<Exercise, 'id' | 'grupoPrimario' | 'padraoMovimento'>): string | null {
  const f = funcaoDe(e);
  if (e.grupoPrimario === 'peito' && (f.startsWith('supino-') || f === 'peito/empurrar')) return 'supino';
  if (e.grupoPrimario === 'costas') {
    if (f === 'puxada-vertical' || (f === 'barra-fixa' && e.id !== 'e116')) return 'puxada';
    if (f === 'remada-horizontal' || e.id === 'e116') return 'remada';
  }
  if (e.grupoPrimario === 'quadriceps' && f === 'agachamento-bilateral') return 'agachar';
  if (e.grupoPrimario === 'quadriceps' && f === 'quadriceps/isolado') return 'extensora';
  if (e.grupoPrimario === 'posterior' && f === 'flexora-posterior') return 'flexora';
  return null;
}
