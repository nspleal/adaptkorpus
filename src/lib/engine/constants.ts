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
export const GORDURA_CLAMP = { minFracao: 0.2, maxFracao: 0.3 } as const; // 20–30% das kcal

/** kcal por grama (Atwater) — SÓ para alocar a meta, nunca para medir alimento. */
export const KCAL_POR_G = { proteina: 4, carboidrato: 4, gordura: 9 } as const;

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
