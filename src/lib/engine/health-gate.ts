/**
 * Gate de saúde — triagem que roda ANTES dos motores de dieta e treino.
 *
 * Fonte: conceitos/gate-de-saude-evokorpus (DFs travadas 2026-06-27, refinadas 2026-06-28).
 *
 * Vocabulário (mais restritivo → menos):
 *   ROTEAR     = não gera plano; orienta procurar profissional
 *   RESTRINGIR = gera só manutenção (sem déficit/superávit)
 *   PISAR      = clampa no piso de segurança calórico
 *   PERMITIR   = gera normal
 *
 * Precedência travada: ROTEAR > RESTRINGIR > PISAR > PERMITIR (vence o mais restritivo).
 * Postura fail-safe: na dúvida (input implausível) → ROTEAR.
 */
import {
  FATOR_OBJETIVO,
  IMC as IMC_LIMITES,
  PISO_SEGURO,
  PLAUSIBILIDADE,
} from './constants';
import { calcularGET, calcularIMC, calcularTMB } from './formulas';
import type { PerfilUsuario, ResultadoGate } from './types';

function inputImplausivel(p: PerfilUsuario): boolean {
  const pesoOk =
    p.pesoKg >= PLAUSIBILIDADE.pesoKg.min && p.pesoKg <= PLAUSIBILIDADE.pesoKg.max;
  const alturaOk =
    p.alturaCm >= PLAUSIBILIDADE.alturaCm.min &&
    p.alturaCm <= PLAUSIBILIDADE.alturaCm.max;
  const idadeOk =
    p.idade >= PLAUSIBILIDADE.idade.min && p.idade <= PLAUSIBILIDADE.idade.max;
  const numeros = [p.pesoKg, p.alturaCm, p.idade];
  const finitos = numeros.every((n) => Number.isFinite(n));
  return !(pesoOk && alturaOk && idadeOk && finitos);
}

function condicaoClinica(p: PerfilUsuario): string[] {
  const motivos: string[] = [];
  const f = p.flagsSaude;
  if (f.gestacaoAmamentacao) motivos.push('gestação/amamentação');
  if (f.renal) motivos.push('condição renal');
  if (f.cardiaca) motivos.push('condição cardíaca');
  if (f.lesao) motivos.push('lesão/limitação física');
  if (f.diabetes) motivos.push('diabetes');
  return motivos;
}

/**
 * Avalia o gate de saúde. Função PURA e determinística.
 */
export function avaliarGateSaude(perfil: PerfilUsuario): ResultadoGate {
  const pisoSeguro = PISO_SEGURO[perfil.sexo];

  // --- Fail-safe: input implausível → ROTEAR antes de qualquer cálculo. -------
  if (inputImplausivel(perfil)) {
    return {
      comportamento: 'ROTEAR',
      motivos: ['dados fora de faixa plausível (peso/altura/idade)'],
      avisos: ['Confira seus dados; em caso de dúvida, procure um profissional.'],
      derivados: { imc: NaN, tmb: NaN, get: NaN, pisoSeguro },
      objetivoEfetivo: perfil.objetivo,
    };
  }

  const imc = calcularIMC(perfil.pesoKg, perfil.alturaCm);
  const tmb = calcularTMB(
    perfil.sexo,
    perfil.pesoKg,
    perfil.alturaCm,
    perfil.idade,
  );
  const get = calcularGET(tmb, perfil.nivelAtividade);
  const derivados = { imc, tmb, get, pisoSeguro };

  const motivos: string[] = [];
  const avisos: string[] = [];

  // --- Aviso universal: IMC < 18.5 em QUALQUER objetivo. ----------------------
  if (imc < IMC_LIMITES.baixoPeso) {
    avisos.push(
      'Seu IMC indica baixo peso. Recomendamos acompanhamento de um profissional de saúde.',
    );
  }

  // --- Sobrepeso leve (25 ≤ IMC < 30) + massa → SÓ AVISO (não redireciona). ----
  // IMC não distingue gordura de músculo — pode ser ganho legítimo (lean bulk).
  if (
    imc >= IMC_LIMITES.sobrepeso &&
    imc < IMC_LIMITES.obesidade &&
    perfil.objetivo === 'massa'
  ) {
    avisos.push(
      'Seu IMC indica sobrepeso. Como o IMC não distingue gordura de músculo, mantivemos seu objetivo; acompanhe com um profissional se tiver dúvida.',
    );
  }

  // --- Coleta de gatilhos por comportamento. ----------------------------------
  const clinica = condicaoClinica(perfil);

  // ROTEAR
  const rotearTriggers: string[] = [];
  if (clinica.length > 0) {
    rotearTriggers.push(`condição clínica declarada: ${clinica.join(', ')}`);
  }
  if (imc < IMC_LIMITES.magrezaSevera) {
    rotearTriggers.push('IMC < 16 (magreza severa)');
  }
  if (get <= pisoSeguro) {
    rotearTriggers.push('gasto energético (GET) já abaixo do piso de segurança');
  }

  // RESTRINGIR — simetria baixo × alto peso (DF 2026-06-29):
  //   baixo: 16 ≤ IMC < 18.5 + emagrecimento (corte) → manutenção
  //   alto:  IMC ≥ 30 + massa (superávit) → manutenção (sem superávit). Emagrecer no alto
  //          continua PERMITIR; sem ROTEAR no alto (risco clínico já é pego pelo PAR-Q).
  const restringirBaixoPeso =
    imc >= IMC_LIMITES.magrezaSevera &&
    imc < IMC_LIMITES.baixoPeso &&
    perfil.objetivo === 'emagrecimento';
  const restringirAltoPeso =
    imc >= IMC_LIMITES.obesidade && perfil.objetivo === 'massa';
  const restringir = restringirBaixoPeso || restringirAltoPeso;

  // PISAR — só faz sentido no corte: alvo abaixo do piso, mas GET acima do piso.
  // Usa `>=` para bater literalmente com a spec (`GET ≥ piso_seguro`); o caso GET==piso
  // já é capturado pelo ROTEAR acima (`get <= pisoSeguro`), que vence por precedência.
  const kcalAlvoCand = get * FATOR_OBJETIVO[perfil.objetivo];
  const pisar =
    perfil.objetivo === 'emagrecimento' &&
    kcalAlvoCand < pisoSeguro &&
    get >= pisoSeguro;

  // --- Resolução por precedência: ROTEAR > RESTRINGIR > PISAR > PERMITIR. ------
  if (rotearTriggers.length > 0) {
    return {
      comportamento: 'ROTEAR',
      motivos: rotearTriggers,
      avisos,
      derivados,
      objetivoEfetivo: perfil.objetivo,
    };
  }

  if (restringir) {
    if (restringirBaixoPeso) {
      motivos.push('16 ≤ IMC < 18,5 no corte — gera apenas manutenção');
    }
    if (restringirAltoPeso) {
      motivos.push('IMC ≥ 30 com objetivo de ganho de massa — superávit redirecionado para manutenção (saúde)');
      avisos.push(
        'Com IMC elevado, priorizamos saúde/manutenção em vez de superávit calórico. Para um ganho de massa específico, considere um profissional.',
      );
    }
    return {
      comportamento: 'RESTRINGIR',
      motivos,
      avisos,
      derivados,
      objetivoEfetivo: 'saude', // força manutenção (×1.00, sem déficit/superávit)
    };
  }

  if (pisar) {
    motivos.push(
      'alvo de corte abaixo do piso de segurança — ajustado para o mínimo seguro',
    );
    return {
      comportamento: 'PISAR',
      motivos,
      avisos,
      derivados,
      objetivoEfetivo: perfil.objetivo,
    };
  }

  return {
    comportamento: 'PERMITIR',
    motivos,
    avisos,
    derivados,
    objetivoEfetivo: perfil.objetivo,
  };
}
