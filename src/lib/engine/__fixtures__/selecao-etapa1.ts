// Fixture histórica da seleção em 99bef38: somente testes das autoridades numéricas.
import type {GrupoPrimario} from '../../data/types';
import type {TemplateDia} from '../alocador';
import type {PerfilTreino} from '../treino-types';

export interface IntencaoDivisao {
  nome: string;
  /** Cada recorte requer uma sessão distinta; não é uma quota de séries. */
  recortes: readonly (readonly GrupoPrimario[])[];
  adaptada: boolean;
}

/** Possibilidades aprovadas, selecionadas antes do ajuste de calendário/volume.
 * Preferência explícita de divisão e retomada mantêm seus caminhos anteriores.
 */
export function selecionarDivisao(
  legado: {split: string; dias: TemplateDia[]}, perfil: PerfilTreino,
  agregado: 'bracos' | 'pernas' | undefined, retomada: boolean,
): {split: string; dias: TemplateDia[]; intencao?: IntencaoDivisao; preservarRecortes?: boolean} {
  const n = legado.dias.length;
  const preferencia = perfil.divisaoPreferida ?? 'auto';
  // Prioridades fora de quatro dias já cai no automático no contrato existente.
  if (preferencia === 'superior-inferior' || (preferencia === 'prioridades' && n === 4)) return legado;
  let dias: TemplateDia[] | undefined;
  let recortes: GrupoPrimario[][] = [];
  let split = '';
  if (n === 2) {
    split = 'Superiores / Inferiores';
    dias = [
      {nome: 'Superiores', grupos: ['peito','costas','ombros','biceps','triceps','core']},
      {nome: 'Inferiores', grupos: ['quadriceps','posterior','gluteos','panturrilha','core']},
    ];
    recortes = [['peito','costas'], ['quadriceps','posterior']];
  } else if (n === 3 && agregado === 'pernas') {
    split = 'Superiores / Quadríceps / Posteriores';
    dias = [
      {nome: 'Superiores', grupos: ['peito','costas','ombros','biceps','triceps']},
      {nome: 'Quadríceps + complementares', grupos: ['quadriceps','gluteos','panturrilha','core']},
      {nome: 'Posteriores + complementares', grupos: ['posterior','gluteos','panturrilha','core']},
    ];
    recortes = [['quadriceps'], ['posterior']];
  } else if (n === 4 && agregado === 'bracos') {
    split = 'Peito / Costas / Pernas / Braços';
    dias = [
      {nome: 'Peito + Ombros', grupos: ['peito','ombros','core']},
      {nome: 'Costas', grupos: ['costas']},
      {nome: 'Pernas', grupos: ['quadriceps','posterior','gluteos','panturrilha','core']},
      {nome: 'Braços', grupos: ['biceps','triceps']},
    ];
    recortes = [['biceps','triceps']];
  }
  if (!dias) return legado;
  // Não substitui o protocolo vigente de retorno nem impõe divisão avançada ao iniciante.
  const adaptada = retomada || (n > 2 && perfil.nivelExperiencia === 'iniciante');
  return { ...(adaptada ? legado : {split, dias}),
    intencao: {nome: split, recortes, adaptada}, preservarRecortes: !adaptada };
}

/** Quantas sessões distintas do plano final cumprem os recortes principais pedidos.
 * Matching evita contar um único full-body como duas ênfases/sessões entregues.
 */
export function contarRecortesEntregues(recortes: IntencaoDivisao['recortes'], sessoes: readonly (readonly GrupoPrimario[])[]): number {
  const visitar = (i: number, usados: Set<number>): number => {
    if (i === recortes.length) return 0;
    let melhor = visitar(i + 1, usados);
    for (let d = 0; d < sessoes.length; d++) {
      if (usados.has(d) || !recortes[i]!.every(g => sessoes[d]!.includes(g))) continue;
      melhor = Math.max(melhor, 1 + visitar(i + 1, new Set([...usados, d])));
    }
    return melhor;
  };
  return visitar(0, new Set());
}
