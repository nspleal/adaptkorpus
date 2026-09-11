/**
 * 🔒 IDENTIDADE CANÔNICA DE EXERCÍCIO e trava de duplicata POR DIA.
 *
 * Por que `id` e não o nome: o catálogo curado tem 168 entradas com `id` único e estável
 * (`eN`, verbatim do cofre) — é ele que viaja no plano (`rotinaCustom.exercicioIds`), no
 * histórico (`ResumoSessao.exercicios[].id`) e nas famílias de equivalência. O nome é
 * RÓTULO: muda quando se esclarece uma ambiguidade (ver D20) e por isso não pode ser
 * identidade. `data.test.ts` e o guard abaixo travam a unicidade que sustenta essa escolha.
 *
 * Por que NÃO a família (`familiaDe`): família é "mesmo movimento, outro implemento" —
 * puxada alta, puxada triângulo e puxada unilateral são a MESMA família e mesmo assim são
 * variantes legitimamente distintas. Travar por família proibiria escolhas válidas; a
 * trava é de DUPLICATA, não de similaridade.
 *
 * Escopo: a trava vale dentro de UM dia. O mesmo exercício em outro dia é uso normal do
 * plano e continua permitido. Duplicatas já gravadas no passado são PRESERVADAS: a trava
 * impede a inclusão nova, nunca reescreve o que já existe.
 */

/** Qualquer coisa que carregue a identidade: o próprio exercício, ou o id cru. */
export type RefExercicio = { readonly id: string } | string;

/**
 * Identidade canônica comparável. Normaliza só espaços e caixa — o id do catálogo já é
 * canônico; a normalização protege contra id vindo de payload legado com espaço/caixa.
 */
export function identidadeCanonica(ref: RefExercicio): string {
  const id = typeof ref === 'string' ? ref : ref.id;
  return id.trim().toLowerCase();
}

/** Conjunto de identidades de uma lista — o que a biblioteca marca como "já neste treino". */
export function identidadesDe(itens: readonly RefExercicio[]): Set<string> {
  const s = new Set<string>();
  for (const item of itens) {
    const id = identidadeCanonica(item);
    if (id) s.add(id);
  }
  return s;
}

/** true se `candidato` já está na lista do dia (comparação por identidade, nunca por nome). */
export function jaNesteTreino(doDia: readonly RefExercicio[], candidato: RefExercicio): boolean {
  const alvo = identidadeCanonica(candidato);
  return alvo !== '' && doDia.some((item) => identidadeCanonica(item) === alvo);
}

export interface ResultadoInclusao<T> {
  /** Lista final do dia: os atuais (intocados) + os aceitos, na ordem de chegada. */
  lista: T[];
  /** O que entrou de fato. */
  adicionados: T[];
  /** O que a trava recusou — já estava no dia, ou repetido dentro do próprio lote. */
  bloqueados: T[];
}

/**
 * Trava única da operação de ADICIONAR — a mesma para o clique individual e para
 * "Adicionar selecionados". A aparência do botão é consequência disto, não substituto:
 * mesmo que a UI ofereça, esta função recusa.
 *
 * `atuais` sai inalterado, inclusive se já contiver duplicatas históricas.
 */
export function adicionarSemDuplicar<T extends RefExercicio>(
  atuais: readonly T[],
  novos: readonly T[],
): ResultadoInclusao<T> {
  const vistos = identidadesDe(atuais);
  const adicionados: T[] = [];
  const bloqueados: T[] = [];
  for (const novo of novos) {
    const id = identidadeCanonica(novo);
    if (id === '' || vistos.has(id)) { bloqueados.push(novo); continue; }
    vistos.add(id);
    adicionados.push(novo);
  }
  return { lista: [...atuais, ...adicionados], adicionados, bloqueados };
}
