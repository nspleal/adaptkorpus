import type { DiaTreino, PerfilTreino } from './treino-types';

/** Fotografia do automático; nunca representa um descanso escolhido manualmente. */
export interface ReferenciaDescanso {
  versao: 1;
  contexto: string;
  diaId: string;
  minimos?: Record<string, number>;
  escolhas: Record<string, number>;
  slots: { id: string; series: number; descansoSeg: number }[];
}

function ordenar(valor: unknown): unknown {
  if (valor instanceof Set) return [...valor].sort().map(ordenar);
  if (valor instanceof Map) return ordenar(Object.fromEntries(valor));
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor && typeof valor === 'object') return Object.fromEntries(
    Object.entries(valor).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, ordenar(v)]),
  );
  return valor;
}

export function contextoDosDescansos(perfil: PerfilTreino, semana: unknown, prescricao: unknown): string {
  const { rotinaCustom: _custom, ...contexto } = perfil;
  void _custom;
  const semanaPublica = semana && typeof semana === 'object'
    ? Object.fromEntries(Object.entries(semana).filter(([k]) => !['planejamentoCicloInterno','idsDoCiclo','complementaresDoCiclo'].includes(k))) : semana;
  return JSON.stringify(ordenar({ perfil: { ...contexto, divisaoPreferida: contexto.divisaoPreferida ?? 'auto' }, semana: semanaPublica, prescricao }));
}

export function fotografarDescansos(dia: DiaTreino, contexto: string): ReferenciaDescanso | undefined {
  if (!dia.diaId || dia.slots.some(s => s.series == null || s.descansoSeg == null)) return undefined;
  return { versao: 1, contexto, diaId: dia.diaId,
    escolhas: Object.fromEntries(dia.slots.map(s => [s.exercicio.id, s.seriesAntesDoDeload ?? s.series!])),
    slots: dia.slots.map(s => ({ id: s.exercicio.id, series: s.series!, descansoSeg: s.descansoSeg! })),
  };
}

/** A edição invalida a fotografia inteira do dia; nenhuma redução automática é aplicada. */
export function restaurarDescansos(dia: DiaTreino, ref: ReferenciaDescanso | undefined,
  escolhas: Record<string, number> | undefined, contexto: string): boolean {
  if (!ref || ref.versao !== 1 || ref.contexto !== contexto || ref.diaId !== dia.diaId
    || !Array.isArray(ref.slots) || ref.slots.length !== dia.slots.length || !ref.escolhas) return false;
  if (!dia.slots.every((s, i) => {
    const r = ref.slots[i];
    return r && r.id === s.exercicio.id && escolhas?.[r.id] === ref.escolhas[r.id]
      && Number.isInteger(r.series) && r.series >= 1 && r.series <= 99
      && Number.isInteger(r.descansoSeg) && r.descansoSeg >= 0 && r.descansoSeg <= 600;
  })) return false;
  dia.slots.forEach((s, i) => { s.series = ref.slots[i]!.series; s.descansoSeg = ref.slots[i]!.descansoSeg; });
  return true;
}
