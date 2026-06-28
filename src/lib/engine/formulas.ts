/**
 * Fórmulas puras do motor — Mifflin-St Jeor, GET, IMC.
 * Espelham parametros-motor-dieta-evokorpus (spec A3) e logica-de-dieta.
 */
import { PAL } from './constants';
import type { NivelAtividade, Sexo } from './types';

/** TMB — Mifflin-St Jeor (kcal/dia). */
export function calcularTMB(
  sexo: Sexo,
  pesoKg: number,
  alturaCm: number,
  idade: number,
): number {
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade;
  return sexo === 'masculino' ? base + 5 : base - 161;
}

/** GET = TMB × PAL. */
export function calcularGET(tmb: number, nivel: NivelAtividade): number {
  return tmb * PAL[nivel];
}

/** IMC = peso_kg / (altura_m)². */
export function calcularIMC(pesoKg: number, alturaCm: number): number {
  const alturaM = alturaCm / 100;
  return pesoKg / (alturaM * alturaM);
}
