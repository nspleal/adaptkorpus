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
import { EQUIPAMENTOS_CASA } from '@/lib/engine';
import { diasPadrao } from '@/lib/semana';
import { pratosCansadosAtivos } from '@/lib/rotacao-pratos';
import type { PerfilResumo } from '@/components/painel/Painel';
import { chaveLocal, limparDadoPessoalLocal } from '@/lib/escopo-local';

// Mapeamento PerfilResumo → motor extraído p/ módulo PURO (o servidor também recomputa
// o plano no PUT do perfil — snapshot auditável em `plans`). Re-export mantém a API.
export { recomputarPlano } from '@/lib/plano';

const KEY = 'evk_sessao' as const;
const VERSAO = 1;

/** Grava o perfil da sessão (após gerar o plano, ou ao editar o perfil). */
export function salvarSessao(perfil: PerfilResumo): void {
  try { localStorage.setItem(chaveLocal(KEY), JSON.stringify({ v: VERSAO, perfil })); } catch { /* storage indisponível */ }
}

/**
 * Migra um blob de sessão bruto — política travada (DF 2026-07-05): **NUNCA descartar o
 * perfil num bump de versão**. Um `v` mais ANTIGO (`<= versaoAtual`) é MIGRADO via
 * `normalizarPerfil` (que já faz as migrações aditivas: nenhum→casa+[], backfill de
 * `equipamentosCasa`/`favoritos`/`treinoDias`, poda de `pratosCansados`). Só o irrecuperável
 * vira `null`: JSON quebrado, sem `perfil`, ou `v` ausente/futuro (`> versaoAtual`, ex.: app
 * mais novo abriu em app mais velho). Puro/testável (`versaoAtual` injetável).
 *
 * `migrou` sinaliza que o blob veio de uma versão antiga → o chamador re-carimba (`salvarSessao`).
 * Seam p/ futuro: se um campo mudar de tipo/renomear, um pré-transform por versão entra ANTES
 * do `normalizarPerfil` (hoje desnecessário — todas as mudanças são aditivas).
 */
export function migrarSessao(
  raw: string | null,
  versaoAtual = VERSAO,
): { perfil: PerfilResumo; migrou: boolean } | null {
  if (!raw) return null;
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const { v, perfil } = obj as { v?: unknown; perfil?: unknown };
  if (typeof v !== 'number' || v > versaoAtual || !perfil || typeof perfil !== 'object') return null;
  return { perfil: normalizarPerfil(perfil as PerfilResumo), migrou: v !== versaoAtual };
}

/** Lê o perfil da sessão; null se não houver ou se irrecuperável. Migra versões antigas
 *  (sem descartar) e re-carimba o storage para a VERSAO atual. */
export function lerSessao(): PerfilResumo | null {
  try {
    const res = migrarSessao(localStorage.getItem(chaveLocal(KEY)));
    if (!res) return null;
    if (res.migrou) salvarSessao(res.perfil); // upgrade persistido — não perde o perfil
    return res.perfil;
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
  // Modelo de equipamento 2 NÍVEIS (DF 2026-07-04) — migração não-destrutiva:
  //   nenhum   → casa + checklist vazio (byte-idêntico ao antigo `nenhum`);
  //   casa     → casa + TODOS os 7 marcados (preserva o acesso ao casa-com; revisável);
  //   academia → academia.
  let equipamento = p.equipamento;
  let equipamentosCasa = Array.isArray(p.equipamentosCasa) ? p.equipamentosCasa : undefined;
  if (equipamento === 'nenhum') {
    equipamento = 'casa';
    equipamentosCasa = [];
  } else if (equipamentosCasa === undefined) {
    equipamentosCasa = equipamento === 'casa' ? [...EQUIPAMENTOS_CASA] : [];
  }
  return { ...p, equipamento, equipamentosCasa, treinoDias, naoCurto, favoritos, pratosCansados, diasDisponiveis: treinoDias.length };
}

/** Encerra a sessão local (logout). Só o perfil — o resto sai por `limparDadosLocais`. */
export function limparSessao(): void {
  try { localStorage.removeItem(chaveLocal(KEY)); } catch { /* storage indisponível */ }
}

/**
 * Limpa TODO dado pessoal local. Usado na EXCLUSÃO DE CONTA (LGPD) e, desde a auditoria de
 * 2026-07-29, também no LOGOUT — por minimização de dado em repouso.
 *
 * 🔒 A lista NÃO é redigitada aqui: vem de `CHAVES_LOCAIS` (fonte única). A versão manual
 * anterior prometia "todos os dados locais" e esquecia três — `evk_email`, `evk_freq_periodo`
 * e `evk_privacy_ack_v1`. A função da exclusão de conta é a que menos pode mentir.
 */
export function limparDadosLocais(): void {
  limparDadoPessoalLocal();
}

/** True se há uma sessão salva (uso síncrono em event handlers no cliente). */
export function temSessao(): boolean {
  return lerSessao() !== null;
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
