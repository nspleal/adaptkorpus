/**
 * Escada de MODIFICAÇÕES dos isométricos — mesmo exercício, muda a alavanca.
 * Fonte TRAVADA: cofre `conceitos/parametros-motor-treino-evokorpus` §"Escada de
 * modificações (ordenada)" (B1, DF 2026-07-04). Sequências fácil → base → difícil,
 * com a forma padrão marcada como `base`. NÃO é troca de exercício (a biblioteca tem
 * 1 hold por movimento) — é o insumo do "Corpo C" da calibração manual (V8.1) e da
 * regressão por modificação do Passo 2.
 *
 * Puro, determinístico, sem I/O. Nomes verbatim do cofre.
 */

export interface ModificacaoIsometrico {
  nome: string;
  /** true na forma padrão do exercício (a "base" da escada). Exatamente 1 por hold. */
  base?: true;
}

/** As 5 escadas de modificação travadas (ids dos holds com repUnit = segundos). */
export const MODIFICACOES_ISOMETRICOS: Readonly<Record<string, readonly ModificacaoIsometrico[]>> = {
  // #7 Prancha
  e7: [
    { nome: 'Joelhos no chão' },
    { nome: 'Mãos elevadas (banco/parede)' },
    { nome: 'Prancha padrão', base: true },
    { nome: 'Pés elevados' },
    { nome: 'Tirar um apoio (1 braço ou 1 perna)' },
  ],
  // #90 Prancha lateral
  e90: [
    { nome: 'Joelho de baixo apoiado' },
    { nome: 'Lateral padrão', base: true },
    { nome: 'Pés elevados' },
    { nome: 'Braço/perna de cima estendidos' },
  ],
  // #94 Agachamento na parede
  e94: [
    { nome: 'Ângulo > 90° / mãos na coxa' },
    { nome: '90° padrão', base: true },
    { nome: 'Peso no colo' },
    { nome: 'Uma perna' },
  ],
  // #118 Pendura na barra
  e118: [
    { nome: 'Pés no apoio / faixa elástica' },
    { nome: 'Pendura passiva padrão', base: true },
    { nome: 'Pegada mais estreita' },
    { nome: 'Pendura ativa (ombros ativos)' },
    { nome: 'Uma mão (avançado)' },
  ],
  // #140 Pegada estática (farmer hold) — progride por carga natural
  e140: [
    { nome: 'Menos carga' },
    { nome: 'Carga padrão', base: true },
    { nome: 'Mais carga' },
    { nome: 'Uma mão' },
  ],
};

/** Sequência de modificações do hold, ou null se o exercício não é um dos 5. */
export function modificacoesDe(id: string): readonly ModificacaoIsometrico[] | null {
  return MODIFICACOES_ISOMETRICOS[id] ?? null;
}

/** Índice da forma padrão (base) na escada do hold; -1 se não é um dos 5. */
export function indiceBase(id: string): number {
  const mods = MODIFICACOES_ISOMETRICOS[id];
  if (!mods) return -1;
  return mods.findIndex((m) => m.base === true);
}

export function temModificacoes(id: string): boolean {
  return id in MODIFICACOES_ISOMETRICOS;
}
