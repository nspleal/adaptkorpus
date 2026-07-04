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
import { diasPadrao } from '@/lib/semana';
import { pratosCansadosAtivos } from '@/lib/rotacao-pratos';
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
    return normalizarPerfil(obj.perfil);
  } catch { return null; }
}

/** Retrocompat: sessões antigas não tinham treinoDias/naoCurto/pratosCansados — deriva
 *  defaults sensatos. Também poda os pratos cujo descanso de 21 dias já expirou (retorno
 *  automático): o storage se autolimpa a cada leitura. */
function normalizarPerfil(p: PerfilResumo): PerfilResumo {
  const treinoDias = Array.isArray(p.treinoDias) && p.treinoDias.length > 0 ? p.treinoDias : diasPadrao(p.diasDisponiveis ?? 3);
  const naoCurto = Array.isArray(p.naoCurto) ? p.naoCurto : [];
  const favoritos = Array.isArray(p.favoritos) ? p.favoritos : []; // V8.2 (DF #12) — sessões antigas: []
  const ativos = new Set(pratosCansadosAtivos(p.pratosCansados));
  const pratosCansados = Array.isArray(p.pratosCansados) ? p.pratosCansados.filter((c) => c && ativos.has(c.id)) : [];
  return { ...p, treinoDias, naoCurto, favoritos, pratosCansados, diasDisponiveis: treinoDias.length };
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
  // A agenda (treinoDias) é a fonte de verdade; o motor de treino usa a CONTAGEM de dias.
  const diasDisponiveis = perfil.treinoDias?.length ?? perfil.diasDisponiveis;
  const perfilT: PerfilTreino = {
    pesoKg: perfil.pesoKg, alturaCm: perfil.alturaCm, idade: perfil.idade, flagsSaude: perfil.flagsSaude,
    objetivo: perfil.objetivo, nivelExperiencia: perfil.nivelExperiencia, equipamento: perfil.equipamento,
    diasDisponiveis, tempoPorSessaoMin: perfil.tempoPorSessaoMin,
  };
  // Preferências relaxáveis na geração do cardápio: "não curto" (nível do alimento) +
  // "Cansei deste prato" (nível do prato, só os ainda em descanso — o retorno de 21 dias é
  // resolvido aqui, fora do motor). Ambas cedem antes de deixar o cardápio sem fechar.
  const restricoes = {
    alergenos: perfil.alergenos, preferencia: perfil.preferencia,
    excluirAlimentoIds: perfil.naoCurto ?? [],
    excluirPratoIds: pratosCansadosAtivos(perfil.pratosCansados),
  };
  return {
    dieta: gerarDieta(perfilU, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes }),
    // Favoritos (DF #12): viés determinístico do montador — preferidos no slot, isentos
    // da variedade; filtros duros e invariantes intactos.
    treino: gerarTreino(perfilT, { exercises: EXERCISES_SEED, favoritos: new Set(perfil.favoritos ?? []) }),
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
