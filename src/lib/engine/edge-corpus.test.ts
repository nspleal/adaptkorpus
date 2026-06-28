/**
 * ERROR-HUNT — corpus de bordas (conjunto de regressão) do motor.
 *
 * Metodologia: cofre → outputs/jornada-caca-a-erros-error-hunt.
 *   - recalcula TODO número de forma INDEPENDENTE da spec travada (os números abaixo são
 *     reescritos do cofre, NÃO importados de constants.ts — para cruzar de verdade);
 *   - sonda os EXTREMOS populacionais (produto cartesiano), corpos plausíveis;
 *   - testa INVARIANTES como desigualdade (banda ⊇ ponto, piso, clamp, carbo≥0, precedência);
 *   - corpus = REGRESSÃO: roda inteiro a cada conserto;
 *   - postura de falsificação: cada caso tenta QUEBRAR o motor.
 *
 * Fonte de verdade (números): conceitos/parametros-motor-dieta-evokorpus + gate-de-saude.
 */
import { describe, expect, it } from 'vitest';
import { avaliarGateSaude } from './health-gate';
import { gerarPlanoDieta } from './diet';
import { gerarDieta } from './index';
import { RECIPES } from '../data/recipes';
import { FOODS_BY_ID_SEED } from '../data/seed';
import type {
  FlagsSaude,
  NivelAtividade,
  Objetivo,
  PerfilUsuario,
  Sexo,
} from './types';

// --- Spec REESCRITA do cofre (independente do motor) -------------------------
const PAL_SPEC: Record<NivelAtividade, number> = {
  sedentario: 1.2, leve: 1.375, moderado: 1.55, intenso: 1.725, muito_intenso: 1.9,
};
const FATOR_SPEC: Record<Objetivo, number> = { emagrecimento: 0.825, massa: 1.125, saude: 1.0 };
const PISO_SPEC: Record<Sexo, number> = { feminino: 1250, masculino: 1550 };
const EPS = 1e-6;

function tmbSpec(s: Sexo, p: number, a: number, i: number) {
  return 10 * p + 6.25 * a - 5 * i + (s === 'masculino' ? 5 : -161);
}
function imcSpec(p: number, a: number) {
  return p / ((a / 100) * (a / 100));
}

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

// --- Corpus: produto cartesiano dos extremos ---------------------------------
const SEXOS: Sexo[] = ['masculino', 'feminino'];
const PESOS = [40, 48, 55, 80, 120, 200];
const ALTURAS = [150, 160, 175, 190, 200];
const IDADES = [18, 30, 50, 75, 90];
const NIVEIS: NivelAtividade[] = ['sedentario', 'moderado', 'muito_intenso'];
const OBJETIVOS: Objetivo[] = ['emagrecimento', 'massa', 'saude'];

function* corpus(): Generator<PerfilUsuario> {
  for (const sexo of SEXOS)
    for (const pesoKg of PESOS)
      for (const alturaCm of ALTURAS)
        for (const idade of IDADES)
          for (const nivelAtividade of NIVEIS)
            for (const objetivo of OBJETIVOS)
              yield { sexo, pesoKg, alturaCm, idade, nivelAtividade, objetivo, flagsSaude: SEM };
}

function rotulo(p: PerfilUsuario) {
  return `${p.sexo} ${p.pesoKg}kg ${p.alturaCm}cm ${p.idade}a ${p.nivelAtividade} ${p.objetivo}`;
}

describe('error-hunt: corpus de bordas do gate + dieta', () => {
  it('recálculo independente + invariantes em todos os extremos', () => {
    const viol: string[] = [];
    const contagem: Record<string, number> = { ROTEAR: 0, RESTRINGIR: 0, PISAR: 0, PERMITIR: 0 };
    let guardaCarboFirou = 0;

    for (const p of corpus()) {
      const imc = imcSpec(p.pesoKg, p.alturaCm);
      const tmb = tmbSpec(p.sexo, p.pesoKg, p.alturaCm, p.idade);
      const get = tmb * PAL_SPEC[p.nivelAtividade];
      const piso = PISO_SPEC[p.sexo];

      const gate = avaliarGateSaude(p);
      contagem[gate.comportamento]++;

      // Cat 1 — aritmética: derivados batem com o recálculo independente.
      if (Math.abs(gate.derivados.tmb - tmb) > 1e-4) viol.push(`TMB ${rotulo(p)}: ${gate.derivados.tmb} vs ${tmb}`);
      if (Math.abs(gate.derivados.get - get) > 1e-4) viol.push(`GET ${rotulo(p)}: ${gate.derivados.get} vs ${get}`);
      if (Math.abs(gate.derivados.imc - imc) > 1e-4) viol.push(`IMC ${rotulo(p)}: ${gate.derivados.imc} vs ${imc}`);

      // Cat 4/6 — comportamento esperado (precedência ROTEAR>RESTRINGIR>PISAR>PERMITIR).
      const cand = get * FATOR_SPEC[p.objetivo];
      let esperado: string;
      if (imc < 16 || get <= piso) esperado = 'ROTEAR';
      else if (imc >= 16 && imc < 18.5 && p.objetivo === 'emagrecimento') esperado = 'RESTRINGIR';
      else if (p.objetivo === 'emagrecimento' && cand < piso && get > piso) esperado = 'PISAR';
      else esperado = 'PERMITIR';
      if (gate.comportamento !== esperado) {
        viol.push(`COMPORTAMENTO ${rotulo(p)}: motor=${gate.comportamento} esperado=${esperado} (imc=${imc.toFixed(1)} get=${get.toFixed(0)} cand=${cand.toFixed(0)} piso=${piso})`);
        continue;
      }

      // Invariante: aviso universal IMC<18.5.
      if (imc < 18.5 && gate.avisos.length === 0) viol.push(`AVISO ausente p/ IMC<18.5 ${rotulo(p)}`);

      if (gate.comportamento === 'ROTEAR') {
        if (gerarDieta(p).plano !== null) viol.push(`ROTEAR gerou plano ${rotulo(p)}`);
        continue;
      }

      const plano = gerarPlanoDieta(p, gate);
      const objEf = gate.objetivoEfetivo;

      // kcal-alvo esperada.
      const kcalEsp = gate.comportamento === 'PISAR' ? piso : get * FATOR_SPEC[objEf];
      if (Math.abs(plano.kcalAlvo - kcalEsp) > 1e-4) viol.push(`KCALALVO ${rotulo(p)}: ${plano.kcalAlvo} vs ${kcalEsp}`);

      // Invariante: kcal-alvo nunca abaixo do piso (não-ROTEAR).
      if (plano.kcalAlvo < piso - EPS) viol.push(`KCAL<PISO ${rotulo(p)}: ${plano.kcalAlvo} < ${piso}`);

      // Invariante: banda ⊇ ponto (kcalAlvo dentro da janela).
      if (plano.kcalAlvo < plano.janela.minKcal - EPS || plano.kcalAlvo > plano.janela.maxKcal + EPS)
        viol.push(`BANDA⊉PONTO ${rotulo(p)}: alvo=${plano.kcalAlvo.toFixed(0)} janela=[${plano.janela.minKcal.toFixed(0)},${plano.janela.maxKcal.toFixed(0)}]`);

      // Invariante: PISAR → minKcal = piso (chão duro).
      if (gate.comportamento === 'PISAR' && Math.abs(plano.janela.minKcal - piso) > EPS)
        viol.push(`PISAR chão ${rotulo(p)}: min=${plano.janela.minKcal} != ${piso}`);

      // Invariante: gordura clampada em [20%,30%] da kcal-alvo.
      const kg = plano.macros.kcalGordura;
      if (kg < 0.2 * plano.kcalAlvo - 1e-3 || kg > 0.3 * plano.kcalAlvo + 1e-3)
        viol.push(`GORDURA fora 20-30% ${rotulo(p)}: ${kg.toFixed(1)} vs alvo ${plano.kcalAlvo.toFixed(0)}`);

      // Invariante: proteína entre piso e ponto (g/kg do objetivo efetivo).
      const protPonto = objEf === 'saude' ? 1.4 : 1.8;
      const protPiso = objEf === 'saude' ? 1.2 : 1.6;
      if (plano.macros.proteinaG > p.pesoKg * protPonto + 1e-3 || plano.macros.proteinaG < p.pesoKg * protPiso - 1e-3)
        viol.push(`PROTEINA fora [piso,ponto] ${rotulo(p)}: ${plano.macros.proteinaG.toFixed(1)}`);

      // Invariante: carbo nunca negativo.
      if (plano.macros.carboidratoG < -EPS) viol.push(`CARBO<0 ${rotulo(p)}: ${plano.macros.carboidratoG}`);
      if (plano.macros.carboidratoG === 0) guardaCarboFirou++;

      // Invariante: soma das kcal dos macros = kcal-alvo (quando carbo>0).
      const soma = plano.macros.kcalProteina + plano.macros.kcalGordura + plano.macros.kcalCarboidrato;
      if (plano.macros.carboidratoG > 0 && Math.abs(soma - plano.kcalAlvo) > 1e-3)
        viol.push(`SOMA≠ALVO ${rotulo(p)}: ${soma.toFixed(1)} vs ${plano.kcalAlvo.toFixed(1)}`);
    }

    // Relatório (visível mesmo limpo).

    console.log('error-hunt corpus:', JSON.stringify(contagem), '| carbo=0 firou em', guardaCarboFirou, 'casos');
    expect(viol).toEqual([]);
  });

  it('cada comportamento do gate é alcançável (sem regra morta)', () => {
    const vistos = new Set<string>();
    for (const p of corpus()) vistos.add(avaliarGateSaude(p).comportamento);
    // condição clínica → ROTEAR (exercita o ramo clínico)
    vistos.add(avaliarGateSaude({ sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado', objetivo: 'saude', flagsSaude: { ...SEM, diabetes: true } }).comportamento);
    expect(vistos).toEqual(new Set(['ROTEAR', 'RESTRINGIR', 'PISAR', 'PERMITIR']));
  });

  it('condição clínica → ROTEAR em qualquer objetivo (cat 4/11)', () => {
    for (const objetivo of OBJETIVOS) {
      for (const flag of ['renal', 'cardiaca', 'lesao', 'diabetes', 'gestacaoAmamentacao'] as const) {
        const g = avaliarGateSaude({ sexo: 'feminino', pesoKg: 70, alturaCm: 165, idade: 30, nivelAtividade: 'moderado', objetivo, flagsSaude: { ...SEM, [flag]: true } });
        expect(g.comportamento).toBe('ROTEAR');
      }
    }
  });
});

describe('error-hunt: montador com base real (subconjunto + invariantes de segurança)', () => {
  const casos: PerfilUsuario[] = [
    { sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado', objetivo: 'emagrecimento', flagsSaude: SEM },
    { sexo: 'feminino', pesoKg: 60, alturaCm: 165, idade: 30, nivelAtividade: 'leve', objetivo: 'massa', flagsSaude: SEM },
    { sexo: 'masculino', pesoKg: 95, alturaCm: 178, idade: 45, nivelAtividade: 'sedentario', objetivo: 'saude', flagsSaude: SEM },
  ];

  it('alérgeno NUNCA aparece no cardápio (filtro absoluto), em vários conjuntos', () => {
    const conjuntos = [['origem_animal'], ['gluten', 'lactose'], ['soja', 'gergelim', 'coco'], ['peixe_frutos_do_mar', 'ovo']] as const;
    for (const p of casos) {
      for (const alergenos of conjuntos) {
        const r = gerarDieta(p, { recipes: RECIPES, foodsById: FOODS_BY_ID_SEED, restricoes: { alergenos: [...alergenos], preferencia: null } });
        if (!r.cardapio) continue;
        for (const it of r.cardapio.itens)
          for (const a of alergenos)
            expect(it.prato.contemAlergenos).not.toContain(a);
      }
    }
  });

  it('determinístico + nunca crasha + ids distintos', () => {
    for (const p of casos) {
      const a = gerarDieta(p, { recipes: RECIPES, foodsById: FOODS_BY_ID_SEED, restricoes: { alergenos: [], preferencia: null } });
      const b = gerarDieta(p, { recipes: RECIPES, foodsById: FOODS_BY_ID_SEED, restricoes: { alergenos: [], preferencia: null } });
      expect(a.cardapio!.itens.map((i) => i.prato.id)).toEqual(b.cardapio!.itens.map((i) => i.prato.id));
      const ids = a.cardapio!.itens.map((i) => i.prato.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(['ok', 'fora_da_janela', 'sem_candidatos']).toContain(a.cardapio!.status);
    }
  });

  it('preferência vegana só entrega pratos veganos', () => {
    for (const p of casos) {
      const r = gerarDieta(p, { recipes: RECIPES, foodsById: FOODS_BY_ID_SEED, restricoes: { alergenos: [], preferencia: 'vegano' } });
      if (r.cardapio?.status === 'ok' || r.cardapio?.status === 'fora_da_janela')
        for (const it of r.cardapio.itens) expect(it.prato.tipo).toBe('vegano');
    }
  });
});
