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

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch com UMA nova tentativa em 401 (fix bloqueador 2026-07-08): no boot várias
 * requisições paralelas disputam a rotação do refresh-token no middleware — a 1ª renova
 * o cookie e as demais podem chegar com o token já consumido (401 intermitente). Na 2ª
 * ida (~600 ms depois) o cookie renovado já está no browser. 401 persistente → null.
 */
async function fetchComRetry401(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    let r = await fetch(url, init);
    if (r.status === 401) {
      await espera(600);
      r = await fetch(url, init);
    }
    return r;
  } catch { return null; }
}

async function getJson<T>(url: string): Promise<T | null> {
  if (!supabaseConfigurado()) return null;
  const r = await fetchComRetry401(url, { cache: 'no-store' });
  if (!r || !r.ok) return null;
  try { return (await r.json()) as T; } catch { return null; }
}

async function enviarJson(url: string, method: 'PUT' | 'POST', body: unknown): Promise<boolean> {
  if (!supabaseConfigurado()) return false;
  const r = await fetchComRetry401(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r?.ok ?? false;
}

// ---- perfil -----------------------------------------------------------------
/**
 * Tri-estado (fix 2026-07-08): distingue "a conta NÃO tem perfil no servidor"
 * (`'sem_perfil'` — 404 da rota; é o único caso em que o boot deve MIGRAR o local p/
 * cima) de FALHA de chamada (`null` — 401/rede/500; o boot usa o local SEM subir, senão
 * um cache velho regride o perfil do servidor gravado por outro device).
 */
export async function carregarPerfilServidor(): Promise<PerfilResumo | 'sem_perfil' | null> {
  if (!supabaseConfigurado()) return null;
  const r = await fetchComRetry401('/api/dados/perfil', { cache: 'no-store' });
  if (!r) return null;
  if (r.status === 404) return 'sem_perfil';
  if (!r.ok) return null;
  try {
    const j = (await r.json()) as { perfil?: PerfilResumo };
    return j.perfil ?? null;
  } catch { return null; }
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
