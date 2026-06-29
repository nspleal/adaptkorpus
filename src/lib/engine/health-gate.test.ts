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

// Corpus cruzado {6 bandas de IMC} × {3 objetivos} contra a tabela do gate
// (gate-de-saude-evokorpus, DF 2026-06-29 — simetria baixo × alto peso).
// Altura fixa 170 cm, nível MUITO INTENSO (GET bem acima do piso → isola a regra de IMC
// dos gatilhos calóricos PISAR/ROTEAR). Pesos calculados p/ cair no meio de cada banda.
describe('gate de saúde — simetria baixo × alto peso (corpus IMC × objetivo)', () => {
  const bandas = [
    { nome: '<16', peso: 43 }, // IMC 14,9
    { nome: '16-18.5', peso: 49 }, // 17,0
    { nome: '18.5-25', peso: 64 }, // 22,1
    { nome: '25-30', peso: 78 }, // 27,0
    { nome: '30-35', peso: 92 }, // 31,8
    { nome: '>=35', peso: 107 }, // 37,0
  ] as const;
  const objetivos = ['emagrecimento', 'saude', 'massa'] as const;

  type Obj = (typeof objetivos)[number];
  function esperado(banda: string, obj: Obj): [string, Obj | 'saude'] {
    if (banda === '<16') return ['ROTEAR', obj]; // qualquer objetivo
    if (banda === '16-18.5') return obj === 'emagrecimento' ? ['RESTRINGIR', 'saude'] : ['PERMITIR', obj];
    if (banda === '18.5-25' || banda === '25-30') return ['PERMITIR', obj];
    // 30-35 e >=35 (obesidade): massa → RESTRINGIR→saúde; emagrecer/saúde → PERMITIR
    return obj === 'massa' ? ['RESTRINGIR', 'saude'] : ['PERMITIR', obj];
  }

  for (const b of bandas) {
    for (const obj of objetivos) {
      it(`IMC ${b.nome} + ${obj} → ${esperado(b.nome, obj)[0]}`, () => {
        const r = avaliarGateSaude(perfil({ pesoKg: b.peso, alturaCm: 170, idade: 30, nivelAtividade: 'muito_intenso', objetivo: obj }));
        const [comp, objEf] = esperado(b.nome, obj);
        expect(r.comportamento).toBe(comp);
        expect(r.objetivoEfetivo).toBe(objEf);
      });
    }
  }

  it('emagrecer NUNCA é ROTEAR/RESTRINGIR só por IMC alto (continua PERMITIR)', () => {
    for (const peso of [78, 92, 107]) {
      const r = avaliarGateSaude(perfil({ pesoKg: peso, alturaCm: 170, idade: 30, nivelAtividade: 'muito_intenso', objetivo: 'emagrecimento' }));
      expect(r.comportamento).toBe('PERMITIR');
    }
  });

  it('25 ≤ IMC < 30 + massa → PERMITIR com aviso (não redireciona)', () => {
    const r = avaliarGateSaude(perfil({ pesoKg: 78, alturaCm: 170, idade: 30, nivelAtividade: 'muito_intenso', objetivo: 'massa' }));
    expect(r.comportamento).toBe('PERMITIR');
    expect(r.objetivoEfetivo).toBe('massa');
    expect(r.avisos.join(' ').toLowerCase()).toContain('sobrepeso');
  });

  it('IMC ≥ 30 + massa → RESTRINGIR→saúde com aviso', () => {
    const r = avaliarGateSaude(perfil({ pesoKg: 92, alturaCm: 170, idade: 30, nivelAtividade: 'muito_intenso', objetivo: 'massa' }));
    expect(r.comportamento).toBe('RESTRINGIR');
    expect(r.objetivoEfetivo).toBe('saude');
    expect(r.avisos.length).toBeGreaterThan(0);
  });
});
