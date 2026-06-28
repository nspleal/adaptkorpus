import { describe, expect, it } from 'vitest';
import { avaliarGateSaude } from './health-gate';
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
    objetivo: 'saude',
    flagsSaude: semFlags,
    ...over,
  };
}

describe('gate de saúde', () => {
  it('ROTEIA qualquer condição clínica declarada (Princípio 3)', () => {
    const r = avaliarGateSaude(
      perfil({ flagsSaude: { ...semFlags, diabetes: true } }),
    );
    expect(r.comportamento).toBe('ROTEAR');
    expect(r.motivos.join(' ')).toContain('diabetes');
  });

  it('ROTEIA gestação/amamentação', () => {
    const r = avaliarGateSaude(
      perfil({ flagsSaude: { ...semFlags, gestacaoAmamentacao: true } }),
    );
    expect(r.comportamento).toBe('ROTEAR');
  });

  it('ROTEIA IMC < 16 em qualquer objetivo', () => {
    // 45 kg / 175 cm → IMC ≈ 14,7
    const r = avaliarGateSaude(
      perfil({ pesoKg: 45, alturaCm: 175, objetivo: 'massa' }),
    );
    expect(r.comportamento).toBe('ROTEAR');
    expect(r.motivos.join(' ')).toContain('IMC < 16');
  });

  it('exemplo do cofre: mulher 40/150/65 no corte → precedência leva a ROTEAR', () => {
    const r = avaliarGateSaude(
      perfil({
        sexo: 'feminino',
        pesoKg: 40,
        alturaCm: 150,
        idade: 65,
        nivelAtividade: 'sedentario',
        objetivo: 'emagrecimento',
      }),
    );
    // TMB = 851,5 · GET = 1021,8 ≤ piso 1250 → ROTEAR (vence RESTRINGIR do IMC 17,8)
    expect(r.derivados.tmb).toBeCloseTo(851.5, 1);
    expect(r.derivados.get).toBeCloseTo(1021.8, 1);
    expect(r.comportamento).toBe('ROTEAR');
  });

  it('RESTRINGE (16 ≤ IMC < 18,5) no corte quando GET > piso', () => {
    // 50 kg / 170 cm → IMC ≈ 17,3 ; GET moderado ≈ 1939,8 > 1250
    const r = avaliarGateSaude(
      perfil({
        sexo: 'feminino',
        pesoKg: 50,
        alturaCm: 170,
        idade: 30,
        nivelAtividade: 'moderado',
        objetivo: 'emagrecimento',
      }),
    );
    expect(r.comportamento).toBe('RESTRINGIR');
    expect(r.objetivoEfetivo).toBe('saude');
    expect(r.avisos.length).toBeGreaterThan(0); // aviso universal IMC < 18,5
  });

  it('PISA quando o alvo de corte cai abaixo do piso mas o GET está acima', () => {
    // feminino 60/160/55 sedentário, corte → GET ≈ 1396,8 ; cand ≈ 1152 < 1250
    const r = avaliarGateSaude(
      perfil({
        sexo: 'feminino',
        pesoKg: 60,
        alturaCm: 160,
        idade: 55,
        nivelAtividade: 'sedentario',
        objetivo: 'emagrecimento',
      }),
    );
    expect(r.comportamento).toBe('PISAR');
  });

  it('PERMITE caso saudável padrão', () => {
    const r = avaliarGateSaude(perfil({ objetivo: 'massa' }));
    expect(r.comportamento).toBe('PERMITIR');
    expect(r.avisos).toHaveLength(0);
  });

  it('ROTEIA (fail-safe) input implausível', () => {
    const r = avaliarGateSaude(perfil({ pesoKg: 5 }));
    expect(r.comportamento).toBe('ROTEAR');
    expect(r.motivos.join(' ')).toContain('plausível');
  });

  it('aviso universal de baixo peso dispara em qualquer objetivo (não só no corte)', () => {
    // IMC ≈ 17,3, objetivo massa → não RESTRINGE, mas avisa
    const r = avaliarGateSaude(
      perfil({
        sexo: 'feminino',
        pesoKg: 50,
        alturaCm: 170,
        idade: 30,
        nivelAtividade: 'moderado',
        objetivo: 'massa',
      }),
    );
    expect(r.avisos.length).toBeGreaterThan(0);
    expect(['PERMITIR', 'PISAR']).toContain(r.comportamento);
  });
});
