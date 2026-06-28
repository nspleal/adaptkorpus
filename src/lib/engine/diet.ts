/**
 * Motor de dieta — caminho após o gate de saúde.
 *
 * Fonte: conceitos/parametros-motor-dieta-evokorpus (spec A3 travada, v10).
 *
 * Ordem determinística e auditável: proteína → gordura (clamp 20–30%) → carboidrato (resto).
 * 4/4/9 (Atwater) é usado SÓ para alocar a meta — nunca para medir alimento (isso é TACO).
 */
import {
  FATOR_OBJETIVO,
  GORDURA_CLAMP,
  GORDURA_G_KG_PONTO,
  JANELA_OBJETIVO,
  KCAL_POR_G,
  PROTEINA_G_KG,
} from './constants';
import type {
  JanelaMontador,
  MetaMacros,
  Objetivo,
  PerfilUsuario,
  PlanoDieta,
  ResultadoGate,
} from './types';

function clamp(valor: number, min: number, max: number): number {
  return Math.min(Math.max(valor, min), max);
}

/** Classe de proteína por objetivo efetivo. */
function classeProteina(objetivo: Objetivo) {
  // emagrecimento e massa protegem músculo (1.8/1.6); manutenção/saúde 1.4/1.2.
  return objetivo === 'saude'
    ? PROTEINA_G_KG.manutencao
    : PROTEINA_G_KG.agressivo;
}

/** kcal-alvo final (já com piso, se aplicável). */
function calcularKcalAlvo(gate: ResultadoGate): number {
  const { get, pisoSeguro } = gate.derivados;
  if (gate.comportamento === 'PISAR') return pisoSeguro;
  return get * FATOR_OBJETIVO[gate.objetivoEfetivo];
}

/** Janela do montador (chão duro no piso quando PISAR). */
function calcularJanela(gate: ResultadoGate): JanelaMontador {
  const { get, pisoSeguro } = gate.derivados;
  if (gate.comportamento === 'PISAR') {
    return { minKcal: pisoSeguro, maxKcal: Math.min(get, pisoSeguro * 1.05) };
  }
  const j = JANELA_OBJETIVO[gate.objetivoEfetivo];
  return { minKcal: get * j.min, maxKcal: get * j.max };
}

/**
 * Calcula os macros na ordem travada, com a guarda defensiva (carbo = 0):
 * se proteína(ponto) + gordura estourarem a kcal-alvo, relaxa a proteína até o piso.
 */
function calcularMacros(
  perfil: PerfilUsuario,
  objetivoEfetivo: Objetivo,
  kcalAlvo: number,
): MetaMacros {
  const peso = perfil.pesoKg;
  const cls = classeProteina(objetivoEfetivo);
  const proteinaPisoG = peso * cls.piso;

  // 1) Proteína (ponto)
  let proteinaG = peso * cls.ponto;
  let kcalProteina = proteinaG * KCAL_POR_G.proteina;

  // 2) Gordura: 0.8 g/kg → clampar a [20%, 30%] da kcal-alvo
  const kcalGordCand = peso * GORDURA_G_KG_PONTO * KCAL_POR_G.gordura;
  const kcalGordura = clamp(
    kcalGordCand,
    GORDURA_CLAMP.minFracao * kcalAlvo,
    GORDURA_CLAMP.maxFracao * kcalAlvo,
  );
  const gorduraG = kcalGordura / KCAL_POR_G.gordura;

  // 3) Carboidrato (resto) — com guarda defensiva
  let kcalCarbo = kcalAlvo - kcalProteina - kcalGordura;
  if (kcalCarbo < 0) {
    // Relaxa a proteína até o piso (caso aritmético extremo; ~inalcançável em adulto real).
    proteinaG = proteinaPisoG;
    kcalProteina = proteinaG * KCAL_POR_G.proteina;
    kcalCarbo = kcalAlvo - kcalProteina - kcalGordura;
  }
  const kcalCarboidrato = Math.max(0, kcalCarbo);
  const carboidratoG = kcalCarboidrato / KCAL_POR_G.carboidrato;

  return {
    proteinaG,
    gorduraG,
    carboidratoG,
    kcalProteina,
    kcalGordura,
    kcalCarboidrato,
    proteinaPisoG,
  };
}

function notaTransparencia(gate: ResultadoGate): string | undefined {
  if (gate.comportamento === 'PISAR') {
    // Honesto (sem promessa de resultado): no PISAR o déficit fica mais suave — não
    // prometemos magnitude. Para um corte mais agressivo com segurança, profissional.
    return 'Ajustamos suas calorias para um mínimo seguro; por isso o déficit fica mais suave que o usual. Para um plano de emagrecimento mais intenso com segurança, procure um profissional.';
  }
  if (gate.comportamento === 'RESTRINGIR') {
    return 'Por segurança, geramos um plano de manutenção (sem déficit). Procure um profissional para um corte seguro.';
  }
  return undefined;
}

/**
 * Gera o plano de dieta (alvo calórico + macros + janela do montador).
 * NÃO deve ser chamado com gate ROTEAR — lança erro (fail-safe).
 */
export function gerarPlanoDieta(
  perfil: PerfilUsuario,
  gate: ResultadoGate,
): PlanoDieta {
  if (gate.comportamento === 'ROTEAR') {
    throw new Error(
      'gerarPlanoDieta não pode ser chamado com gate ROTEAR — nenhum plano deve ser gerado.',
    );
  }

  const kcalAlvo = calcularKcalAlvo(gate);
  const macros = calcularMacros(perfil, gate.objetivoEfetivo, kcalAlvo);
  const janela = calcularJanela(gate);

  return {
    comportamento: gate.comportamento,
    kcalAlvo,
    macros,
    janela,
    derivados: gate.derivados,
    notaTransparencia: notaTransparencia(gate),
    motivos: gate.motivos,
    avisos: gate.avisos,
  };
}
