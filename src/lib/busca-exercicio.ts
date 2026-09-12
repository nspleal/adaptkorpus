/**
 * 🔎 FONTE ÚNICA da BUSCA TEXTUAL do catálogo de exercícios.
 *
 * 🔴 O defeito que obrigou o módulo (auditoria de visibilidade do catálogo, 2026-09-12):
 * existiam DUAS buscas sobre o MESMO catálogo, cada uma cega para um campo diferente.
 *  · A biblioteca (`SeletorExercicio`) lia `nomePt + grupoMuscular` e ignorava `nomeEn`:
 *    medido no componente real, "push-up", "pull-up", "squat", "bench press", "deadlift",
 *    "row", "plank", "lunge", "dip" e "bike" devolviam ZERO e caíam no estado vazio —
 *    e 151 dos 168 exercícios carregam um `nomeEn` que não aparece em nenhum dos dois
 *    campos que ela lia.
 *  · O registro pós-fato (`RegistrarTreino`) lia `nomePt + nomeEn` e ignorava
 *    `grupoMuscular`: "glúteo" achava 4 onde a biblioteca achava 33, "bíceps" achava 1
 *    onde a biblioteca achava 24.
 * Nenhuma das duas escondia exercício por REGRA — as duas escondiam por CAMPO NÃO LIDO,
 * que é o defeito que a auditoria pediu para separar de exclusão legítima.
 *
 * 🔒 A união dos três campos é o contrato, e mora AQUI: duas telas que decidem a mesma
 * coisa são dois lugares para divergir de novo (a mesma lição do `temCarga`, que estava
 * em 4 cópias inline até 2026-07-31).
 *
 * 🔴 O que este módulo NÃO faz: não filtra nível, equipamento, cardio nem banidos. Essas
 * são decisões de FLUXO e continuam de cada tela — a busca nunca é atalho para elas.
 *
 * PURO e determinístico.
 */
import type { Exercise } from './data/types';

/**
 * Caixa e acento fora — NFD e a faixa de diacríticos combinantes (U+0300–U+036F), a mesma
 * normalização que as duas telas já faziam. É ela que faz "flexao" achar "Flexão".
 */
export const normalizarBusca = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** O que a busca precisa de um exercício — nada além dos três campos de texto. */
export type AlvoBusca = Pick<Exercise, 'nomePt' | 'nomeEn' | 'grupoMuscular'>;

/**
 * Os campos lidos, na ordem em que a pessoa os encontra na tela: o nome que ela vê, o nome
 * em inglês que ela ouve na academia, e a lista de músculos do item.
 */
export const camposDeBusca = (ex: AlvoBusca): string =>
  `${ex.nomePt} ${ex.nomeEn ?? ''} ${ex.grupoMuscular}`;

/** Consulta vazia casa com tudo: campo em branco não é filtro. */
export function casaComBusca(ex: AlvoBusca, consulta: string): boolean {
  const q = normalizarBusca(consulta.trim());
  return q === '' || normalizarBusca(camposDeBusca(ex)).includes(q);
}
