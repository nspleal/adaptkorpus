'use client';

/**
 * Sync client → servidor (Ownership-1): wrappers finos sobre as rotas /api/dados/*.
 * Regra de arquitetura (write-through, offline-first): o localStorage continua sendo
 * escrito primeiro e segue funcionando sozinho; quando há backend (supabaseConfigurado)
 * e sessão, cada escrita também sobe (fire-and-forget) e a HIDRATAÇÃO prefere o
 * servidor. Sem backend (modo mock) tudo aqui é no-op/null. Erros de rede são
 * engolidos — nunca derrubam a UI nem logam conteúdo (dado de saúde).
 */
import { supabaseConfigurado } from '@/lib/supabase/env';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { SessaoHistorico } from '@/lib/treino-historico';
import type { Consentimentos } from '@/lib/persistencia/perfil-profile';

async function getJson<T>(url: string): Promise<T | null> {
  if (!supabaseConfigurado()) return null;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

async function enviarJson(url: string, method: 'PUT' | 'POST', body: unknown): Promise<boolean> {
  if (!supabaseConfigurado()) return false;
  try {
    const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.ok;
  } catch { return false; }
}

// ---- perfil -----------------------------------------------------------------
export async function carregarPerfilServidor(): Promise<PerfilResumo | null> {
  const r = await getJson<{ perfil: PerfilResumo }>('/api/dados/perfil');
  return r?.perfil ?? null;
}
export async function salvarPerfilServidor(perfil: PerfilResumo, consentimentos?: Consentimentos): Promise<boolean> {
  return enviarJson('/api/dados/perfil', 'PUT', { perfil, ...(consentimentos ? { consentimentos } : {}) });
}

// ---- histórico de treino ----------------------------------------------------
export async function carregarHistoricoServidor(): Promise<SessaoHistorico[] | null> {
  const r = await getJson<{ sessoes: SessaoHistorico[] }>('/api/dados/historico');
  return r?.sessoes ?? null;
}
export async function enviarSessaoTreino(sessao: SessaoHistorico | null): Promise<boolean> {
  if (!sessao) return false;
  return enviarJson('/api/dados/historico', 'POST', { sessao });
}

// ---- aderência (refeições, por dia local) -----------------------------------
export type DiaAderencia = { logs: Record<string, unknown>; notes: Record<string, string> };
export async function carregarAderenciaServidor(): Promise<Record<string, DiaAderencia> | null> {
  const r = await getJson<{ dias: Record<string, DiaAderencia> }>('/api/dados/aderencia');
  return r?.dias ?? null;
}
export async function salvarAderenciaDia(dia: string, logs: Record<string, unknown>, notes: Record<string, string>): Promise<boolean> {
  return enviarJson('/api/dados/aderencia', 'PUT', { dia, logs, notes });
}

// ---- peso ---------------------------------------------------------------------
export async function carregarPesosServidor(): Promise<number[] | null> {
  const r = await getJson<{ pesos: number[] }>('/api/dados/peso');
  return r?.pesos ?? null;
}
export async function registrarPesoServidor(pesoKg: number): Promise<boolean> {
  return enviarJson('/api/dados/peso', 'POST', { pesoKg });
}

// ---- acesso (allowlist/assinatura) -------------------------------------------
export async function consultarAcesso(): Promise<{ liberado: boolean; via: string | null } | null> {
  return getJson<{ liberado: boolean; via: string | null }>('/api/acesso');
}
