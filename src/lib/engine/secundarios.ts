/**
 * 🔢 v4 — GRUPOS SECUNDÁRIOS POR EXERCÍCIO (leva B, handoff-motor-volume-v4-2026-08-12).
 *
 * 🔑 P0.2 do handoff, verificado em 2026-08-13: **a biblioteca TEM os secundários** — a
 * coluna `grupoMuscular` da A1 é a lista completa ("Peito, tríceps, ombros"), e o
 * `grupoPrimario` já é a 1ª entrada normalizada (DF 2026-07-27). Por isso o mapa
 * padrão→secundários do handoff NÃO é usado: *"se tem, use-os"*.
 *
 * O que este módulo faz é só NORMALIZAR a string livre para os 12 valores anatômicos:
 *  · parênteses são QUALIFICADORES ("Ombros (posterior)", "Peito (superior)") e são
 *    descartados ANTES da vírgula — sem isso, "(posterior)" viraria crédito para
 *    posterior de coxa em elevação posterior de ombro. Custo conhecido e aceito: o e7
 *    "Core (abdômen, lombar)" perde o lombar parentético (1 exercício);
 *  · tokens fora dos 12 grupos (trapézio, adutores, equilíbrio, cardio, "pernas"…) são
 *    descartados de propósito — não são grupo do vocabulário e crédito neles seria
 *    número inventado.
 *
 * 🏷️ curadoria · v4.0 · 2026-08-12 (a tabela de tokens é mecânica de transliteração, não
 * decisão de treino — a decisão "0,5 por secundário" é a DF① do autor).
 *
 * PURO e determinístico.
 */
import type { Exercise, GrupoPrimario } from '../data/types';

/** Peso do crédito de volume de um grupo SECUNDÁRIO (DF① 2026-08-12 — convenção da
 *  pesquisa de 29/07; nunca exibido ao usuário como "meia série"). */
export const PESO_SECUNDARIO = 0.5;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Token normalizado → grupo canônico; `null` = descarte consciente (não é grupo dos 12). */
const TOKEN_PARA_GRUPO: Readonly<Record<string, GrupoPrimario | null>> = {
  'peito': 'peito',
  'triceps': 'triceps',
  'ombros': 'ombros',
  'costas': 'costas',
  'dorsais': 'costas',
  'biceps': 'biceps',
  'antebraco': 'antebraco',
  'antebracos': 'antebraco',
  'quadriceps': 'quadriceps',
  'gluteos': 'gluteos',
  'gluteo medio': 'gluteos',
  'posterior de coxa': 'posterior',
  'posterior': 'posterior', // fora de parênteses é a cadeia posterior ("Glúteos, posterior, core")
  'lombar': 'lombar',
  'panturrilha': 'panturrilha',
  'panturrilhas': 'panturrilha',
  'abdomen': 'core',
  'abdomen inferior': 'core',
  'core': 'core',
  'obliquos': 'core',
  'trapezio': null,
  'adutores': null,
  'abdutores': null,
  'equilibrio': null,
  'estabilidade': null,
  'cardio': null,
  'pegada': null,
  'pernas': null,
  'corpo inteiro': null,
};

/**
 * Grupos SECUNDÁRIOS do exercício: a lista da A1 sem a 1ª entrada (o primário), sem
 * duplicatas e sem o próprio primário. Token desconhecido é descartado (e o teste de
 * cobertura da biblioteca trava que nenhum token novo entre sem decisão).
 */
export function secundariosDe(e: Exercise): GrupoPrimario[] {
  const semParenteses = e.grupoMuscular.replace(/\([^)]*\)/g, '');
  const tokens = semParenteses.split(',').map(norm).filter(Boolean);
  const grupos = tokens
    .slice(1) // a 1ª entrada é o primário (já vive em `grupoPrimario`)
    .map((t) => TOKEN_PARA_GRUPO[t])
    .filter((g): g is GrupoPrimario => g != null && g !== e.grupoPrimario);
  return [...new Set(grupos)];
}

/** Tokens da biblioteca que o mapa NÃO conhece (para o guard de cobertura da curadoria). */
export function tokensDesconhecidos(exercises: readonly Exercise[]): string[] {
  const fora = new Set<string>();
  for (const e of exercises) {
    for (const t of e.grupoMuscular.replace(/\([^)]*\)/g, '').split(',').map(norm).filter(Boolean)) {
      if (!(t in TOKEN_PARA_GRUPO)) fora.add(t);
    }
  }
  return [...fora].sort();
}
