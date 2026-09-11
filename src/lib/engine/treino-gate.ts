/**
 * Gate de saúde — caminho do TREINO (herdado do gate compartilhado).
 * Fonte: parametros-motor-treino-evokorpus §"Passo 0" + gate-de-saude-evokorpus.
 *
 * Diferenças vs. a dieta: NÃO há `PISAR` (piso é só calórico). `RESTRINGIR` no treino
 * = 16≤IMC<18.5 + emagrecimento → redireciona objetivo p/ Saúde (treino conservador).
 * Precedência: ROTEAR > RESTRINGIR > PERMITIR. Fail-safe: input implausível → ROTEAR.
 */
import { DOMINIOS, flagsSaudeLegiveis, noDominio, PLAUSIBILIDADE } from './constants';
import { calcularIMC } from './formulas';
import { IMC_LIMITES } from './treino-constants';
import type { PerfilTreino, ResultadoGateTreino } from './treino-types';

/** 🔴 D11 — espelho de `health-gate · categoricosIlegiveis` para os campos do treino. */
function categoricosIlegiveis(p: PerfilTreino): string[] {
  const fora: string[] = [];
  if (!noDominio(p.objetivo, DOMINIOS.objetivo)) fora.push('objetivo');
  if (!noDominio(p.nivelExperiencia, DOMINIOS.nivelExperiencia)) fora.push('experiência de treino');
  if (!noDominio(p.equipamento, DOMINIOS.equipamento)) fora.push('onde você treina');
  if (!flagsSaudeLegiveis(p.flagsSaude)) fora.push('condições de saúde');
  return fora;
}

function inputImplausivel(p: PerfilTreino): boolean {
  const okPeso = p.pesoKg >= PLAUSIBILIDADE.pesoKg.min && p.pesoKg <= PLAUSIBILIDADE.pesoKg.max;
  const okAltura =
    p.alturaCm >= PLAUSIBILIDADE.alturaCm.min && p.alturaCm <= PLAUSIBILIDADE.alturaCm.max;
  const okIdade = p.idade >= PLAUSIBILIDADE.idade.min && p.idade <= PLAUSIBILIDADE.idade.max;
  const finitos = [p.pesoKg, p.alturaCm, p.idade].every((n) => Number.isFinite(n));
  return !(okPeso && okAltura && okIdade && finitos);
}

function condicaoClinica(p: PerfilTreino): string[] {
  const f = p.flagsSaude;
  const m: string[] = [];
  if (f == null) return m;
  if (f.gestacaoAmamentacao) m.push('gestação/amamentação');
  if (f.renal) m.push('condição renal');
  if (f.cardiaca) m.push('condição cardíaca');
  if (f.lesao) m.push('lesão/limitação física');
  if (f.diabetes) m.push('diabetes');
  return m;
}

/** Avalia o gate de treino. Função PURA e determinística. */
export function avaliarGateTreino(perfil: PerfilTreino): ResultadoGateTreino {
  const ilegiveis = categoricosIlegiveis(perfil);
  if (ilegiveis.length > 0) {
    return {
      comportamento: 'ROTEAR',
      objetivoEfetivo: perfil.objetivo,
      motivos: [`dados do perfil ilegíveis: ${ilegiveis.join(', ')}`],
      avisos: ['Confira os dados do seu perfil antes de gerar um plano.'],
      derivados: { imc: NaN },
    };
  }
  if (inputImplausivel(perfil)) {
    return {
      comportamento: 'ROTEAR',
      objetivoEfetivo: perfil.objetivo,
      motivos: ['dados fora de faixa plausível (peso/altura/idade)'],
      avisos: ['Confira seus dados; em caso de dúvida, procure um profissional.'],
      derivados: { imc: NaN },
    };
  }

  const imc = calcularIMC(perfil.pesoKg, perfil.alturaCm);
  const avisos: string[] = [];
  if (imc < IMC_LIMITES.baixoPeso) {
    avisos.push('Seu IMC indica baixo peso. Recomendamos acompanhamento de um profissional.');
  }

  const clinica = condicaoClinica(perfil);
  if (clinica.length > 0 || imc < IMC_LIMITES.magrezaSevera) {
    const motivos =
      clinica.length > 0
        ? [`condição clínica declarada: ${clinica.join(', ')}`]
        : ['IMC < 16 (magreza severa)'];
    return { comportamento: 'ROTEAR', objetivoEfetivo: perfil.objetivo, motivos, avisos, derivados: { imc } };
  }

  // 16 ≤ IMC < 18.5 (baixo peso não-severo)
  if (imc < IMC_LIMITES.baixoPeso) {
    if (perfil.objetivo === 'emagrecimento') {
      return {
        comportamento: 'RESTRINGIR',
        objetivoEfetivo: 'saude', // redireciona p/ treino conservador de saúde
        motivos: ['16 ≤ IMC < 18,5 no corte — treino redirecionado para Saúde (conservador)'],
        avisos,
        derivados: { imc },
      };
    }
    // massa/saúde: massa é apropriada p/ baixo peso — só avisa
    return { comportamento: 'PERMITIR', objetivoEfetivo: perfil.objetivo, motivos: [], avisos, derivados: { imc } };
  }

  // Simetria do alto peso (DF 2026-06-29): espelha o baixo peso, sem ROTEAR.
  //   IMC ≥ 30 + massa → RESTRINGIR → treino conservador de saúde + aviso.
  //   25 ≤ IMC < 30 + massa → só aviso (pode ser músculo). Emagrecer sempre PERMITIR.
  if (perfil.objetivo === 'massa' && imc >= IMC_LIMITES.obesidade) {
    return {
      comportamento: 'RESTRINGIR',
      objetivoEfetivo: 'saude',
      motivos: ['IMC ≥ 30 com objetivo de ganho de massa — treino redirecionado para Saúde (conservador)'],
      avisos: [
        ...avisos,
        'Com IMC elevado, priorizamos um treino de saúde/conservador. Para hipertrofia específica, considere um profissional.',
      ],
      derivados: { imc },
    };
  }
  if (perfil.objetivo === 'massa' && imc >= IMC_LIMITES.sobrepeso) {
    return {
      comportamento: 'PERMITIR',
      objetivoEfetivo: perfil.objetivo,
      motivos: [],
      avisos: [
        ...avisos,
        'Seu IMC indica sobrepeso. Como o IMC não distingue gordura de músculo, mantivemos seu objetivo; acompanhe com um profissional se tiver dúvida.',
      ],
      derivados: { imc },
    };
  }

  return { comportamento: 'PERMITIR', objetivoEfetivo: perfil.objetivo, motivos: [], avisos, derivados: { imc } };
}
