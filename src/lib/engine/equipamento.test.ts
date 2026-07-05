import { describe, expect, it } from 'vitest';
import { EQUIPAMENTOS_CASA, exercicioDisponivel } from './equipamento';
import { montarRotina } from './treino-montador';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { listarSubstituicoesExercicio, substituirExercicio } from './substituicao';
import { sugerirProximaVariacao } from './escadas';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';
import type { FlagsSaude } from './types';

/**
 * Modelo de equipamento 2 NÍVEIS (DF 2026-07-04, cofre log "modelo de equipamento").
 * Invariante central travada: `casa + []` é BYTE-IDÊNTICO ao antigo `nenhum`; o furo do
 * e116 continua vazio honesto nesse piso e FECHA quando `barra_fixa` está marcada.
 */
const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({ pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over });
const rotina = (over: Partial<PerfilTreino>) => {
  const p = perfil(over);
  return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES);
};
const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;

describe('exercicioDisponivel — modelo 2 níveis', () => {
  it('academia → tudo; casa+[] → só casa_sem; local academia NUNCA em casa', () => {
    expect(exercicioDisponivel(byId('e9'), 'academia')).toBe(true); // academia-only
    expect(exercicioDisponivel(byId('e9'), 'casa', EQUIPAMENTOS_CASA)).toBe(false); // nem com tudo marcado
    expect(exercicioDisponivel(byId('e1'), 'casa', [])).toBe(true); // casa_sem sempre
    expect(exercicioDisponivel(byId('e22'), 'casa', [])).toBe(false); // casa_com sem checklist
  });

  it('casa_com exige o subconjunto marcado (⊆): e22 barra · e12 halteres+banco', () => {
    expect(exercicioDisponivel(byId('e22'), 'casa', ['barra_fixa'])).toBe(true);
    expect(exercicioDisponivel(byId('e22'), 'casa', ['halteres'])).toBe(false);
    expect(exercicioDisponivel(byId('e12'), 'casa', ['halteres'])).toBe(false); // falta banco
    expect(exercicioDisponivel(byId('e12'), 'casa', ['halteres', 'banco'])).toBe(true);
  });

  it('legado: nenhum ≡ casa+[]; casa SEM checklist (undefined) = casa antiga (todo casa_com)', () => {
    for (const e of EXERCISES) {
      expect(exercicioDisponivel(e, 'nenhum')).toBe(exercicioDisponivel(e, 'casa', []));
      expect(exercicioDisponivel(e, 'casa')).toBe(e.local !== 'academia');
    }
  });

  it('curadoria: TODOS os 53 casa_com têm exigência não-vazia (E ou any-of) no vocabulário', () => {
    const casaCom = EXERCISES.filter((e) => e.local === 'casa_com');
    expect(casaCom).toHaveLength(53);
    for (const e of casaCom) {
      const exigido = e.equipamentoExigido ?? [];
      const qualquerUm = e.equipamentoExigidoQualquerUm ?? [];
      expect(exigido.length + qualquerUm.length, `${e.id} sem exigência de equipamento`).toBeGreaterThan(0);
      for (const eq of [...exigido, ...qualquerUm]) expect(EQUIPAMENTOS_CASA).toContain(eq);
    }
    // casa_sem/academia não carregam os campos
    for (const e of EXERCISES.filter((x) => x.local !== 'casa_com')) {
      expect(e.equipamentoExigido, `${e.id} não devia ter equipamentoExigido`).toBeUndefined();
      expect(e.equipamentoExigidoQualquerUm, `${e.id} não devia ter any-of`).toBeUndefined();
    }
  });

  it('any-of (V8.5): goblet/farmer (e33/e109/e140) = halteres OU kettlebell; e11 sem banco', () => {
    for (const id of ['e33', 'e109', 'e140']) {
      const e = byId(id);
      expect(e.equipamentoExigidoQualquerUm).toEqual(['halteres', 'kettlebell']);
      expect(e.equipamentoExigido).toBeUndefined();
      expect(exercicioDisponivel(e, 'casa', ['kettlebell']), `${id} só kettlebell`).toBe(true);
      expect(exercicioDisponivel(e, 'casa', ['halteres']), `${id} só halteres`).toBe(true);
      expect(exercicioDisponivel(e, 'casa', []), `${id} checklist vazio`).toBe(false);
      expect(exercicioDisponivel(e, 'casa', ['banco', 'elastico']), `${id} sem os dois`).toBe(false);
    }
    // e11 supino reto: floor press equivale (DF V8.5) → só halteres; e139 fica [halteres] (sem 8º item)
    expect(byId('e11').equipamentoExigido).toEqual(['halteres']);
    expect(exercicioDisponivel(byId('e11'), 'casa', ['halteres'])).toBe(true);
    expect(byId('e139').equipamentoExigido).toEqual(['halteres']);
    // e55/e125 (crucifixo/pullover) SEGUEM exigindo banco (chão limita amplitude — DF V8.5)
    expect(byId('e55').equipamentoExigido).toEqual(['halteres', 'banco']);
    expect(byId('e125').equipamentoExigido).toEqual(['halteres', 'banco']);
  });
});

describe('INVARIANTE: casa+[] byte-idêntico ao antigo nenhum (rotina e trocas)', () => {
  it('montador: mesma rotina', () => {
    const antiga = rotina({ equipamento: 'nenhum', nivelExperiencia: 'iniciante' });
    const nova = rotina({ equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: 'iniciante' });
    expect(JSON.stringify(nova)).toBe(JSON.stringify(antiga));
  });

  it('montador: casa+TODOS os 7 ≡ casa legada (migração preserva o acesso ao casa-com)', () => {
    const legada = rotina({ equipamento: 'casa', nivelExperiencia: 'intermediario' }); // sem checklist = legado
    const migrada = rotina({ equipamento: 'casa', equipamentosCasa: [...EQUIPAMENTOS_CASA], nivelExperiencia: 'intermediario' });
    expect(JSON.stringify(migrada)).toBe(JSON.stringify(legada));
  });

  it('troca: mesmas sugestões p/ e1 (casa+[] vs nenhum)', () => {
    const args = (eq: 'nenhum' | 'casa') => ({
      exercicioAtual: byId('e1'), equipamento: eq, ...(eq === 'casa' ? { equipamentosCasa: [] as never[] } : {}),
      nivelExperiencia: 'iniciante' as const, exercises: EXERCISES,
    });
    const antiga = listarSubstituicoesExercicio(args('nenhum'), 3).map((r) => r.exercicio!.id);
    const nova = listarSubstituicoesExercicio(args('casa'), 3).map((r) => r.exercicio!.id);
    expect(nova).toEqual(antiga);
  });
});

describe('o furo do e116 no modelo novo (puxar × casa)', () => {
  it('casa+[] → continua VAZIO honesto (piso "nenhum" mantém 1 puxar, por decisão)', () => {
    const r = substituirExercicio({ exercicioAtual: byId('e116'), equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: 'iniciante', exercises: EXERCISES });
    expect(r.status).toBe('sinalizado');
  });

  it('barra_fixa marcada → o furo FECHA (e22 chin-up vira troca do e116)', () => {
    const lista = listarSubstituicoesExercicio(
      { exercicioAtual: byId('e116'), equipamento: 'casa', equipamentosCasa: ['barra_fixa'], nivelExperiencia: 'intermediario', exercises: EXERCISES }, 3,
    ).map((r) => r.exercicio!.id);
    expect(lista).toContain('e22');
  });

  it('varredura casa+[]: EXATAMENTE os 3 vazios do e116 (assert duro preservado)', () => {
    const vazios: string[] = [];
    for (const e of EXERCISES) {
      if (!exercicioDisponivel(e, 'casa', [])) continue; // usuário nem vê
      for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
        const r = substituirExercicio({ exercicioAtual: e, equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: nivel, exercises: EXERCISES });
        if (r.status === 'sinalizado') vazios.push(`${e.id}·${nivel}`);
      }
    }
    expect(vazios).toEqual(['e116·iniciante', 'e116·intermediario', 'e116·avancado']);
  });

  it('varredura casa+TODOS: zero vazios (e o mesmo p/ academia)', () => {
    for (const cfg of [
      { equipamento: 'casa' as const, equipamentosCasa: [...EQUIPAMENTOS_CASA] },
      { equipamento: 'academia' as const, equipamentosCasa: [] as never[] },
    ]) {
      for (const e of EXERCISES) {
        if (!exercicioDisponivel(e, cfg.equipamento, cfg.equipamentosCasa)) continue;
        for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
          const r = substituirExercicio({ exercicioAtual: e, ...cfg, nivelExperiencia: nivel, exercises: EXERCISES });
          expect(r.status, `${e.id}·${nivel}·${cfg.equipamento}`).toBe('ok');
        }
      }
    }
  });
});

describe('escadas: o hint respeita o CHECKLIST ("barra fixa exige barra_fixa marcada")', () => {
  it('e116 → e22 só com barra_fixa marcada', () => {
    expect(sugerirProximaVariacao('e116', EXERCISES, 'casa', [])).toBeNull();
    expect(sugerirProximaVariacao('e116', EXERCISES, 'casa', ['barra_fixa'])).toEqual(['e22']);
    expect(sugerirProximaVariacao('e116', EXERCISES, 'casa', ['halteres'])).toBeNull();
  });

  it('e146 → e8 Roda abdominal só com roda_abdominal marcada', () => {
    expect(sugerirProximaVariacao('e146', EXERCISES, 'casa', [])).toBeNull();
    expect(sugerirProximaVariacao('e146', EXERCISES, 'casa', ['roda_abdominal'])).toEqual(['e8']);
  });

  it('retrocompat: chamadas sem checklist mantêm o comportamento antigo', () => {
    expect(sugerirProximaVariacao('e116', EXERCISES, 'nenhum')).toBeNull();
    expect(sugerirProximaVariacao('e116', EXERCISES, 'casa')).toEqual(['e22']);
  });
});
