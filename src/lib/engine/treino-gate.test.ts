import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import type { FlagsSaude } from './types';
import type { NivelExperiencia, PerfilTreino } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return {
    pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM,
    objetivo: 'massa', nivelExperiencia: 'intermediario' as NivelExperiencia,
    equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
    ...over,
  };
}

describe('gate de treino', () => {
  it('condição clínica → ROTEAR em qualquer objetivo', () => {
    for (const objetivo of ['saude', 'massa', 'emagrecimento'] as const) {
      const r = avaliarGateTreino(perfil({ objetivo, flagsSaude: { ...SEM, cardiaca: true } }));
      expect(r.comportamento).toBe('ROTEAR');
    }
  });

  it('IMC < 16 → ROTEAR em qualquer objetivo', () => {
    const r = avaliarGateTreino(perfil({ pesoKg: 45, alturaCm: 175, objetivo: 'massa' }));
    expect(r.comportamento).toBe('ROTEAR');
  });

  it('16 ≤ IMC < 18.5 + emagrecimento → RESTRINGIR (redireciona p/ Saúde)', () => {
    // 50/170 → IMC 17.3
    const r = avaliarGateTreino(perfil({ pesoKg: 50, alturaCm: 170, objetivo: 'emagrecimento' }));
    expect(r.comportamento).toBe('RESTRINGIR');
    expect(r.objetivoEfetivo).toBe('saude');
    expect(r.avisos.length).toBeGreaterThan(0);
  });

  it('16 ≤ IMC < 18.5 + massa → PERMITIR + aviso (massa é apropriada p/ baixo peso)', () => {
    const r = avaliarGateTreino(perfil({ pesoKg: 50, alturaCm: 170, objetivo: 'massa' }));
    expect(r.comportamento).toBe('PERMITIR');
    expect(r.objetivoEfetivo).toBe('massa');
    expect(r.avisos.length).toBeGreaterThan(0);
  });

  it('caso saudável → PERMITIR sem aviso', () => {
    const r = avaliarGateTreino(perfil({ objetivo: 'massa' }));
    expect(r.comportamento).toBe('PERMITIR');
    expect(r.avisos).toHaveLength(0);
  });

  it('input implausível → ROTEAR (fail-safe)', () => {
    expect(avaliarGateTreino(perfil({ pesoKg: 5 })).comportamento).toBe('ROTEAR');
  });

  it('nunca usa PISAR (não existe no treino)', () => {
    const comportamentos = new Set<string>();
    for (const objetivo of ['saude', 'massa', 'emagrecimento'] as const)
      for (const [peso, altura] of [[40, 150], [50, 170], [80, 180], [120, 175]] as const)
        comportamentos.add(avaliarGateTreino(perfil({ objetivo, pesoKg: peso, alturaCm: altura })).comportamento);
    expect(comportamentos.has('PISAR' as never)).toBe(false);
    expect([...comportamentos].every((c) => ['ROTEAR', 'RESTRINGIR', 'PERMITIR'].includes(c))).toBe(true);
  });
});

// Corpus cruzado {6 bandas de IMC} × {3 objetivos} — simetria baixo × alto peso (DF 2026-06-29).
// O treino não tem PISAR/ROTEAR calórico, então o nível de atividade é irrelevante aqui.
describe('gate de treino — simetria baixo × alto peso (corpus IMC × objetivo)', () => {
  const bandas = [
    { nome: '<16', peso: 43 },
    { nome: '16-18.5', peso: 49 },
    { nome: '18.5-25', peso: 64 },
    { nome: '25-30', peso: 78 },
    { nome: '30-35', peso: 92 },
    { nome: '>=35', peso: 107 },
  ] as const;
  const objetivos = ['emagrecimento', 'saude', 'massa'] as const;
  type Obj = (typeof objetivos)[number];

  function esperado(banda: string, obj: Obj): [string, Obj | 'saude'] {
    if (banda === '<16') return ['ROTEAR', obj];
    if (banda === '16-18.5') return obj === 'emagrecimento' ? ['RESTRINGIR', 'saude'] : ['PERMITIR', obj];
    if (banda === '18.5-25' || banda === '25-30') return ['PERMITIR', obj];
    return obj === 'massa' ? ['RESTRINGIR', 'saude'] : ['PERMITIR', obj];
  }

  for (const b of bandas) {
    for (const obj of objetivos) {
      it(`IMC ${b.nome} + ${obj} → ${esperado(b.nome, obj)[0]}`, () => {
        const r = avaliarGateTreino(perfil({ pesoKg: b.peso, alturaCm: 170, idade: 30, objetivo: obj }));
        const [comp, objEf] = esperado(b.nome, obj);
        expect(r.comportamento).toBe(comp);
        expect(r.objetivoEfetivo).toBe(objEf);
      });
    }
  }

  it('25 ≤ IMC < 30 + massa → PERMITIR com aviso; IMC ≥ 30 + massa → RESTRINGIR→saúde', () => {
    const sobre = avaliarGateTreino(perfil({ pesoKg: 78, alturaCm: 170, objetivo: 'massa' }));
    expect(sobre.comportamento).toBe('PERMITIR');
    expect(sobre.avisos.join(' ').toLowerCase()).toContain('sobrepeso');
    const obeso = avaliarGateTreino(perfil({ pesoKg: 92, alturaCm: 170, objetivo: 'massa' }));
    expect(obeso.comportamento).toBe('RESTRINGIR');
    expect(obeso.objetivoEfetivo).toBe('saude');
  });
});
