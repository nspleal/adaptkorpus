'use client';

/**
 * Sessão local do Evokorpus (transitória — sem backend ainda).
 *
 * Persiste o **perfil do onboarding** em localStorage para que a área logada (`/app`)
 * sobreviva a reload e navegação de volta, sem jogar a pessoa de volta ao cadastro de
 * perfil. O **plano** (dieta + treino) NÃO é persistido: o motor é determinístico
 * (mesmo input → mesma saída), então recomputamos a partir do perfil salvo — fonte única
 * de verdade, sempre coerente se o motor evoluir.
 *
 * ⚠️ Transitório: quando o backend chegar (Supabase Auth + RLS), o perfil — que inclui
 * dado de saúde (flagsSaude) — migra para o servidor com RLS/minimização (ver
 * docs/security-lgpd.md e as tarefas Ownership/LGPD). Hoje não há backend; localStorage é
 * a única persistência possível e é consistente com o resto do app (evk_aderencia, etc.).
 */

import { useEffect, useState } from 'react';
import { gerarDieta, gerarTreino } from '@/lib/engine';
import type { PerfilTreino, PerfilUsuario, ResultadoMotor, ResultadoTreino } from '@/lib/engine';
import { EXERCISES_SEED, FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import type { PerfilResumo } from '@/components/painel/Painel';

const KEY = 'evk_sessao';
const VERSAO = 1;

/** Grava o perfil da sessão (após gerar o plano, ou ao editar o perfil). */
export function salvarSessao(perfil: PerfilResumo): void {
  try { localStorage.setItem(KEY, JSON.stringify({ v: VERSAO, perfil })); } catch { /* storage indisponível */ }
}

/** Lê o perfil da sessão; null se não houver (ou se corrompido/versão antiga). */
export function lerSessao(): PerfilResumo | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as { v?: number; perfil?: PerfilResumo };
    if (!obj || obj.v !== VERSAO || !obj.perfil) return null;
    return obj.perfil;
  } catch { return null; }
}

/** Encerra a sessão local (logout). */
export function limparSessao(): void {
  try { localStorage.removeItem(KEY); } catch { /* storage indisponível */ }
}

/** True se há uma sessão salva (uso síncrono em event handlers no cliente). */
export function temSessao(): boolean {
  return lerSessao() !== null;
}

/**
 * Recomputa dieta + treino a partir do perfil salvo. Determinístico — produz exatamente
 * o mesmo plano que o onboarding gerou. Fonte única do mapeamento PerfilResumo → motor.
 */
export function recomputarPlano(perfil: PerfilResumo): { dieta: ResultadoMotor; treino: ResultadoTreino } {
  const perfilU: PerfilUsuario = {
    sexo: perfil.sexo, pesoKg: perfil.pesoKg, alturaCm: perfil.alturaCm, idade: perfil.idade,
    nivelAtividade: perfil.nivelAtividade, objetivo: perfil.objetivo, flagsSaude: perfil.flagsSaude,
  };
  const perfilT: PerfilTreino = {
    pesoKg: perfil.pesoKg, alturaCm: perfil.alturaCm, idade: perfil.idade, flagsSaude: perfil.flagsSaude,
    objetivo: perfil.objetivo, nivelExperiencia: perfil.nivelExperiencia, equipamento: perfil.equipamento,
    diasDisponiveis: perfil.diasDisponiveis, tempoPorSessaoMin: perfil.tempoPorSessaoMin,
  };
  const restricoes = { alergenos: perfil.alergenos, preferencia: perfil.preferencia };
  return {
    dieta: gerarDieta(perfilU, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes }),
    treino: gerarTreino(perfilT, { exercises: EXERCISES_SEED }),
  };
}

/**
 * Hook: há sessão salva? Começa `false` (SSR/1ª pintura) e resolve no efeito — evita
 * mismatch de hidratação. Use para alternar destinos/labels de "voltar" e CTAs.
 */
export function useTemSessao(): boolean {
  const [tem, setTem] = useState(false);
  useEffect(() => { setTem(lerSessao() !== null); }, []);
  return tem;
}
