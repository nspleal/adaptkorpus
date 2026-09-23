import { afterEach, expect, it, vi } from 'vitest';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import type { PerfilResumo } from '@/components/painel/Painel';
import { recomputarPlano } from './plano';
import { lerSessao, salvarSessao } from './session';
import { compararRecalculoTreino } from './comparar-recalculo-treino';

const perfil: PerfilResumo = {
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado', objetivo: 'massa',
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  alergenos: [], preferencia: null, naoCurto: [], pratosCansados: [], favoritos: [],
  nivelExperiencia: 'iniciante', equipamento: 'academia', equipamentosCasa: [], diasDisponiveis: 4,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado', divisaoPreferida: 'superior-inferior',
};
const opcoes = { semanaCiclo: { semana: 3 as const } };
afterEach(() => vi.unstubAllGlobals());

it('salvarSessao → lerSessao → recomputarPlano preserva o automático copiado', () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  const original = recomputarPlano(perfil, opcoes).treino.rotina!;
  const rotinaCustom = paraRotinaCustom(doPlano(original.dias, perfil.treinoDias));
  salvarSessao({ ...perfil, rotinaCustom });
  const recarregado = lerSessao()!;
  expect(recarregado.rotinaCustom).toEqual(rotinaCustom);
  const final = recomputarPlano(recarregado, opcoes).treino.rotina!;
  expect(final).not.toBeNull();
  expect(compararRecalculoTreino(original, final)).toEqual([]);
  expect(final.duracaoResistidaDias).toEqual(original.duracaoResistidaDias);
});

it('remover um exercício obrigatório informa o conflito e não completa nem corta o desenho', () => {
  const original = recomputarPlano(perfil, opcoes).treino.rotina!;
  const dias = doPlano(original.dias, perfil.treinoDias);
  dias[0]!.exercicios = dias[0]!.exercicios.filter(e => e.grupoPrimario !== 'biceps');
  const rotinaCustom = paraRotinaCustom(dias);
  const final = recomputarPlano({ ...perfil, rotinaCustom }, opcoes).treino.rotina!;
  expect(final.resultadoGeracao?.tipo).toBe('MINIMOS_NAO_ATENDIDOS');
  expect(final.avisos.some(a => a.includes('Bíceps') && a.includes('mínimo'))).toBe(true);
  expect(final.dias.map(d => d.slots.map(s => s.exercicio.id))).toEqual(rotinaCustom.dias.map(d => d.exercicioIds));
});

it('mudança de perfil apresenta diferenças concretas de descanso/duração, sem mutar o salvo', () => {
  const original = recomputarPlano(perfil, opcoes).treino.rotina!;
  const rotinaCustom = paraRotinaCustom(doPlano(original.dias, perfil.treinoDias));
  const salvo = JSON.stringify(rotinaCustom);
  const final = recomputarPlano({ ...perfil, rotinaCustom, tempoPorSessaoMin: 60 }, opcoes).treino.rotina!;
  const delta = compararRecalculoTreino(original, final);
  expect(delta.some(d => d.includes('descanso') && d.includes('→'))).toBe(true);
  expect(delta.some(d => d.includes('duração') && d.includes('→'))).toBe(true);
  expect(JSON.stringify(rotinaCustom)).toBe(salvo);
});
