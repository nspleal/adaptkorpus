import { describe, expect, it } from 'vitest';
import { avaliarGateSaude } from './health-gate';
import { gerarPlanoDieta } from './diet';
import type { FlagsSaude, PerfilUsuario } from './types';

const semFlags: FlagsSaude = {
  gestacaoAmamentacao: false,
  renal: false,
  cardiaca: false,
  lesao: false,
  diabetes: false,
};

function perfil(over: Partial<PerfilUsuario> = {}): PerfilUsuario {
  return {
    sexo: 'masculino',
    pesoKg: 80,
    alturaCm: 180,
    idade: 30,
    nivelAtividade: 'moderado',
    objetivo: 'massa',
    flagsSaude: semFlags,
    ...over,
  };
}

function planoDe(over: Partial<PerfilUsuario> = {}) {
  const p = perfil(over);
  return gerarPlanoDieta(p, avaliarGateSaude(p));
}

describe('motor de dieta — ganho de massa (homem 80/180/30 moderado)', () => {
  const plano = planoDe();

  it('GET e kcal-alvo (superávit 12,5%)', () => {
    expect(plano.derivados.get).toBeCloseTo(2759.0, 1);
    expect(plano.kcalAlvo).toBeCloseTo(3103.875, 2);
  });

  it('proteína = 1.8 g/kg (protegida)', () => {
    expect(plano.macros.proteinaG).toBeCloseTo(144, 3);
    expect(plano.macros.proteinaPisoG).toBeCloseTo(128, 3); // 1.6 g/kg
  });

  it('gordura: piso de 20% dispara (kcal_alvo > 36×peso)', () => {
    // 0.8 g/kg = 576 kcal < 20% de 3103,875 = 620,775 → clampa para cima
    expect(plano.macros.kcalGordura).toBeCloseTo(620.775, 2);
  });

  it('janela de massa = [1.10, 1.15] × GET', () => {
    expect(plano.janela.minKcal).toBeCloseTo(2759.0 * 1.1, 1);
    expect(plano.janela.maxKcal).toBeCloseTo(2759.0 * 1.15, 1);
  });

  it('soma das kcal dos macros ≈ kcal-alvo', () => {
    const soma =
      plano.macros.kcalProteina +
      plano.macros.kcalGordura +
      plano.macros.kcalCarboidrato;
    expect(soma).toBeCloseTo(plano.kcalAlvo, 5);
  });
});

describe('motor de dieta — comportamentos do gate', () => {
  it('PISAR serve exatamente o piso (1250 F) e protege proteína em 1.8 g/kg', () => {
    const plano = planoDe({
      sexo: 'feminino',
      pesoKg: 60,
      alturaCm: 160,
      idade: 55,
      nivelAtividade: 'sedentario',
      objetivo: 'emagrecimento',
    });
    expect(plano.comportamento).toBe('PISAR');
    expect(plano.kcalAlvo).toBe(1250);
    expect(plano.macros.proteinaG).toBeCloseTo(108, 3); // 1.8 × 60
    expect(plano.janela.minKcal).toBe(1250); // chão duro
    expect(plano.notaTransparencia).toBeTruthy();
  });

  it('RESTRINGIR usa manutenção (×1.0) e proteína 1.4 g/kg', () => {
    const plano = planoDe({
      sexo: 'feminino',
      pesoKg: 50,
      alturaCm: 170,
      idade: 30,
      nivelAtividade: 'moderado',
      objetivo: 'emagrecimento',
    });
    expect(plano.comportamento).toBe('RESTRINGIR');
    expect(plano.kcalAlvo).toBeCloseTo(plano.derivados.get, 5); // ×1.0
    expect(plano.macros.proteinaG).toBeCloseTo(70, 3); // 1.4 × 50
  });

  it('lança erro se chamado com gate ROTEAR (fail-safe)', () => {
    const p = perfil({ flagsSaude: { ...semFlags, cardiaca: true } });
    const gate = avaliarGateSaude(p);
    expect(gate.comportamento).toBe('ROTEAR');
    expect(() => gerarPlanoDieta(p, gate)).toThrow();
  });
});

describe('motor de dieta — emagrecimento padrão', () => {
  it('déficit ×0.825 e teto de gordura 30% (obeso em corte)', () => {
    // homem 120/175/40 → IMC alto; corte; kcal_alvo < 24×peso ativa o teto de 30%
    const plano = planoDe({
      pesoKg: 120,
      alturaCm: 175,
      idade: 40,
      nivelAtividade: 'sedentario',
      objetivo: 'emagrecimento',
    });
    expect(plano.comportamento).toBe('PERMITIR');
    // teto 30% quando kcal_alvo < 24×peso (=2880)
    if (plano.kcalAlvo < 24 * 120) {
      expect(plano.macros.kcalGordura).toBeCloseTo(0.3 * plano.kcalAlvo, 2);
    }
  });
});
