/**
 * Orçamento na dieta — pedido nº 11 do beta ("a dieta esta muito cara tambem. precisa ter
 * opçao de limite de orçamento"). Módulo PURO: sem relógio, sem rede, sem IA.
 *
 * Fonte: cofre, parametros-motor-dieta-adaptkorpus §`orcamento` e §`custoRelativo`
 * (DF 2026-07-26); handoff-leva-h-orcamento-2026-08-06.
 *
 * 🔴 TETO, NÃO ALVO — é a decisão que define a feature. `baixo` PREFERE a faixa 1, sobe para
 * 2 quando o piso de proteína ou a janela de kcal não fecham, e usa 3 em último caso. Filtro
 * DURO seria implementação errada: a promessa é "nunca mais caro do que precisa", não "só o
 * barato", e excluir em vez de despriorizar quebraria o cardápio de quem precisa de 3550 kcal.
 */
import type { Food, Recipe } from '../data/types';
import { CUSTO_RELATIVO, type CustoRelativo } from '../data/custo-relativo';

/** Entrada do usuário. `alto` = sem restrição (default de quem não escolheu nada). */
export type Orcamento = 'baixo' | 'medio' | 'alto';

/** Teto de faixa PREFERIDO por orçamento — ponto de partida do relaxamento, não filtro. */
export const TETO_PREFERIDO: Readonly<Record<Orcamento, CustoRelativo>> = {
  baixo: 1,
  medio: 2,
  alto: 3,
};

/**
 * Nível de custo do PRATO = MAIOR faixa entre seus ingredientes.
 *
 * 🔑 É a semântica que a curadoria vegana usou para provar o aceite de viabilidade ("100%
 * ingredientes faixa ≤ 2" = max ≤ 2). Trocar a agregação INVALIDA a prova — por isso `max`
 * decide o nível, e a soma (abaixo) só ordena.
 */
export function nivelCustoPrato(receita: Recipe): CustoRelativo {
  let maior: CustoRelativo = 1;
  for (const item of receita.itens) {
    const f = CUSTO_RELATIVO[item.alimentoId];
    if (f !== undefined && f > maior) maior = f;
  }
  return maior;
}

/**
 * Ordenador fino = SOMA simples das faixas dos ingredientes, SEM ponderar por gramas.
 *
 * 🔒 A regra 1 da curadoria é explícita: "Σ ordena pratos, não estima custo". Ponderar por
 * gramas viraria estimativa de custo em dinheiro — que a DF recusa (o app não exibe nem
 * calcula R$).
 */
export function somaCustoPrato(receita: Recipe): number {
  let soma = 0;
  for (const item of receita.itens) soma += CUSTO_RELATIVO[item.alimentoId] ?? 0;
  return soma;
}


/**
 * Sequência de tetos a tentar, do preferido até 3 — o RELAXAMENTO POR NÍVEL.
 *
 * 🔒 Sobe o teto para o DIA INTEIRO e re-monta; nunca prato a prato. Relaxar por prato
 * tornaria o resultado dependente da ordem de busca e quebraria o determinismo travado.
 */
export function tetosEmOrdem(orcamento: Orcamento): CustoRelativo[] {
  const tetos: CustoRelativo[] = [];
  for (let t = TETO_PREFERIDO[orcamento]; t <= 3; t++) tetos.push(t as CustoRelativo);
  return tetos;
}

/**
 * O custo participa da ORDENAÇÃO apenas quando o orçamento é uma escolha real.
 *
 * 🔑 Com `alto` a cadeia fica EXATAMENTE a de hoje — zero mudança de comportamento para quem
 * não escolheu nada. É o que torna o deploy seguro, e vira teste (aceite 5).
 */
export function custoOrdena(orcamento: Orcamento | undefined | null): boolean {
  return orcamento === 'baixo' || orcamento === 'medio';
}

