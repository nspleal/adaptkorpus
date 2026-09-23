import type { GrupoPrimario } from '../data/types';

/** Decisão de Nicolas, 20/09/2026: bíceps e tríceps usam SOMENTE o teto semanal
 * já aprovado para nível/foco, sem mínimo universal. Esta lista é de VOLUME, não de prioridade de
 * retirada: ombros continuam secundários nessa outra classificação.
 */
export const GRUPOS_COM_FAIXA_SEMANAL: readonly GrupoPrimario[] = [
  'peito', 'costas', 'quadriceps', 'posterior', 'gluteos', 'ombros', 'biceps', 'triceps',
];
