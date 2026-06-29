/**
 * Constantes travadas do motor — espelham a spec canônica do cofre.
 * NÃO alterar sem decisão registrada em parametros-motor-dieta / gate-de-saude.
 */
import type { NivelAtividade, Objetivo, Sexo } from './types';

/** PAL — fator de atividade (GET = TMB × PAL). */
export const PAL: Record<NivelAtividade, number> = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  muito_intenso: 1.9,
};

/** Fator por objetivo (o "ponto" exibido). */
export const FATOR_OBJETIVO: Record<Objetivo, number> = {
  emagrecimento: 0.825, // déficit 17,5%
  massa: 1.125, // superávit 12,5%
  saude: 1.0, // manutenção
};

/** Janela do montador por objetivo, como multiplicadores do GET. */
export const JANELA_OBJETIVO: Record<Objetivo, { min: number; max: number }> = {
  emagrecimento: { min: 0.8, max: 0.85 },
  massa: { min: 1.1, max: 1.15 },
  saude: { min: 0.95, max: 1.05 },
};

/** Piso de segurança calórico (kcal/dia) — travado no gate. */
export const PISO_SEGURO: Record<Sexo, number> = {
  feminino: 1250,
  masculino: 1550,
};

/** Proteína g/kg (ponto e piso) por classe de objetivo. */
export const PROTEINA_G_KG = {
  // emagrecimento e massa
  agressivo: { ponto: 1.8, piso: 1.6 },
  // manutenção / saúde / RESTRINGIR
  manutencao: { ponto: 1.4, piso: 1.2 },
} as const;

/** Gordura. */
export const GORDURA_G_KG_PONTO = 0.8;
// Clamp da gordura a 20–30% das kcal. Os "gatilhos" são EMERGENTES do clamp (não há
// código extra): com 0.8 g/kg, o teto de 30% dispara quando kcal_alvo < 24×peso e o piso
// de 20% quando kcal_alvo > 36×peso. Ver parametros-motor-dieta-evokorpus (cofre).
export const GORDURA_CLAMP = { minFracao: 0.2, maxFracao: 0.3 } as const; // 20–30% das kcal

/** kcal por grama (Atwater) — SÓ para alocar a meta, nunca para medir alimento. */
export const KCAL_POR_G = { proteina: 4, carboidrato: 4, gordura: 9 } as const;

/**
 * Escala de porções do montador (Passo 3 — "combinar/ESCALAR pratos do banco").
 * O cofre manda escalar as porções para mirar a janela; NÃO fixa os limites de escala.
 * Estes são DEFAULTS de implementação (Bloco B), não números travados da spec: mantêm a
 * porção em faixa realista (de metade a o triplo da porção-base). Conforme o banco de
 * pratos cresce, a escala necessária diminui. Revisável sem alterar a spec.
 */
export const ESCALA_PORCAO = { min: 0.5, max: 3.0 } as const;

/** Limiares de IMC (gate). */
export const IMC = {
  magrezaSevera: 16, // < 16 → ROTEAR (qualquer objetivo)
  baixoPeso: 18.5, // < 18.5 → aviso universal; no corte → RESTRINGIR
} as const;

/** Faixas de plausibilidade (backstop fail-safe; entrada fora → ROTEAR). */
export const PLAUSIBILIDADE = {
  pesoKg: { min: 30, max: 300 },
  alturaCm: { min: 100, max: 250 },
  idade: { min: 18, max: 100 },
} as const;
