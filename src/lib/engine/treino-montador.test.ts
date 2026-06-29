import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { dificuldadesLiberadas, prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over };
}
function rotina(over: Partial<PerfilTreino> = {}) {
  const p = perfil(over);
  return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES);
}

describe('montador de rotina (base real, 163 exercícios)', () => {
  it('dias de força = min(dias, teto do nível); excedente → cardio/recuperação', () => {
    // iniciante: teto 3. Com 6 dias → 3 de força, 3 de cardio/recuperação.
    const r = rotina({ nivelExperiencia: 'iniciante', diasDisponiveis: 6 });
    expect(r.diasForcaAgendados).toBe(3);
    expect(r.diasCardioRecuperacao).toBe(3);
    expect(r.dias).toHaveLength(3);
  });

  it('todo exercício selecionado respeita equipamento/local e dificuldade liberada', () => {
    for (const equip of ['nenhum', 'casa', 'academia'] as const) {
      for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
        const r = rotina({ equipamento: equip, nivelExperiencia: nivel, diasDisponiveis: 4 });
        const liberadas = new Set(dificuldadesLiberadas(nivel));
        const locais =
          equip === 'nenhum' ? ['casa_sem'] : equip === 'casa' ? ['casa_sem', 'casa_com'] : ['casa_sem', 'casa_com', 'academia'];
        for (const d of r.dias)
          for (const s of d.slots) {
            expect(locais).toContain(s.exercicio.local);
            expect(liberadas.has(s.exercicio.nivel)).toBe(true);
          }
      }
    }
  });

  it('invariante: puxar ≥ empurrar (sem aviso de desequilíbrio)', () => {
    for (const dias of [2, 3, 4, 5, 6]) {
      const r = rotina({ diasDisponiveis: dias, nivelExperiencia: 'avancado' });
      const conta = (p: string) => r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
      expect(conta('puxar')).toBeGreaterThanOrEqual(conta('empurrar'));
    }
  });

  it('dobradiça/quadril presente quando há ≥ 2 dias de força', () => {
    const r = rotina({ diasDisponiveis: 4, nivelExperiencia: 'avancado' });
    const temDobradica = r.dias.some((d) => d.slots.some((s) => s.padrao === 'dobradica_quadril'));
    expect(temDobradica).toBe(true);
  });

  it('tempo curto: nº de exercícios por dia cai (cabe no tempo)', () => {
    const curto = rotina({ tempoPorSessaoMin: 20 });
    const longo = rotina({ tempoPorSessaoMin: 90 });
    const maxSlotsCurto = Math.max(...curto.dias.map((d) => d.slots.length));
    const maxSlotsLongo = Math.max(...longo.dias.map((d) => d.slots.length));
    expect(maxSlotsCurto).toBeLessThanOrEqual(maxSlotsLongo);
  });

  it('peso corporal (equipamento nenhum) gera rotina só com exercícios de casa_sem', () => {
    const r = rotina({ equipamento: 'nenhum', diasDisponiveis: 3, nivelExperiencia: 'iniciante' });
    expect(r.dias.length).toBeGreaterThan(0);
    for (const d of r.dias) for (const s of d.slots) expect(s.exercicio.local).toBe('casa_sem');
  });

  it('é determinístico', () => {
    const a = rotina({ diasDisponiveis: 5, nivelExperiencia: 'avancado' });
    const b = rotina({ diasDisponiveis: 5, nivelExperiencia: 'avancado' });
    const ids = (r: typeof a) => r.dias.map((d) => d.slots.map((s) => s.exercicio.id).join(',')).join('|');
    expect(ids(a)).toBe(ids(b));
  });
});
