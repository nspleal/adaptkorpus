import { ROTULO_MODALIDADE, type ModalidadeCardio } from './engine/cardio';
import { ORDEM_SEMANA, type Weekday } from './semana';
import { chaveLocal } from './escopo-local';

export type DiaCardioPlanejado = { diaId: Weekday; modalidade: ModalidadeCardio; minutos: number };

/** Rascunho local, separado dos registros de sessões realizadas e da meta do motor. */
export function normalizarCardioPlanejado(value: unknown): DiaCardioPlanejado[] {
  if (!Array.isArray(value)) return [];
  const dias = new Map<Weekday, DiaCardioPlanejado>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { diaId, modalidade, minutos } = item;
    if (!ORDEM_SEMANA.includes(diaId) || typeof modalidade !== 'string'
      || !Object.prototype.hasOwnProperty.call(ROTULO_MODALIDADE, modalidade)
      || !Number.isSafeInteger(minutos) || minutos <= 0) continue;
    dias.set(diaId, { diaId, modalidade: modalidade as ModalidadeCardio, minutos });
  }
  return ORDEM_SEMANA.flatMap(d => dias.has(d) ? [dias.get(d)!] : []);
}

export function lerCardioPlanejado(): DiaCardioPlanejado[] {
  return normalizarCardioPlanejado(JSON.parse(localStorage.getItem(chaveLocal('evk_cardio_planejado_v1')) ?? '[]'));
}

export function salvarCardioPlanejado(dias: DiaCardioPlanejado[]): void {
  localStorage.setItem(chaveLocal('evk_cardio_planejado_v1'), JSON.stringify(normalizarCardioPlanejado(dias)));
}
