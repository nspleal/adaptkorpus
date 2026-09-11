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
import type { RegistroPeso, SessaoHistorico } from '@/lib/treino-historico';
import type { Consentimentos } from '@/lib/persistencia/perfil-profile';
import type { EntradaPlanoVisivel } from '@/lib/plano-cas-comando';

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
export type PerfilServidor = {
  perfil: PerfilResumo;
  revision: number;
  entradaPlano?: EntradaPlanoVisivel;
};

/** Resultado explícito: conflito nunca vira falso silencioso nem sobrescrita implícita. */
export type ResultadoSalvarPerfil =
  | { tipo: 'CONFIRMADO'; revision: number; entradaPlano: EntradaPlanoVisivel }
  | { tipo: 'CONFLITO_REVISAO'; revisaoAtual: number }
  | { tipo: 'CONFLITO_VERSAO_OU_HASH' }
  | { tipo: 'FALHA' };

export async function carregarPerfilServidor(): Promise<PerfilServidor | 'sem_perfil' | null> {
  if (!supabaseConfigurado()) return null;
  const r = await fetchComRetry401('/api/dados/perfil', { cache: 'no-store' });
  if (!r) return null;
  if (r.status === 404) return 'sem_perfil';
  if (!r.ok) return null;
  try {
    const j = (await r.json()) as Partial<PerfilServidor>;
    if (!j.perfil || !Number.isInteger(j.revision) || (j.revision as number) < 0) return null;
    return { perfil: j.perfil, revision: j.revision as number, ...(j.entradaPlano ? { entradaPlano: j.entradaPlano } : {}) };
  } catch { return null; }
}
export async function salvarPerfilServidor(
  perfil: PerfilResumo,
  expectedRevision: number,
  entradaPlano?: EntradaPlanoVisivel,
  consentimentos?: Consentimentos,
): Promise<ResultadoSalvarPerfil> {
  if (!supabaseConfigurado()) return { tipo: 'FALHA' };
  const r = await fetchComRetry401('/api/dados/perfil', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ perfil, expectedRevision, ...(entradaPlano ? { entradaPlano } : {}), ...(consentimentos ? { consentimentos } : {}) }),
  });
  if (!r) return { tipo: 'FALHA' };
  try {
    const j = (await r.json()) as { revision?: unknown; entradaPlano?: EntradaPlanoVisivel; revisaoAtual?: unknown; error?: string };
    if (r.ok && Number.isInteger(j.revision) && j.entradaPlano) {
      return { tipo: 'CONFIRMADO', revision: j.revision as number, entradaPlano: j.entradaPlano };
    }
    if (r.status === 409 && j.error === 'conflito_revisao' && Number.isInteger(j.revisaoAtual)) {
      return { tipo: 'CONFLITO_REVISAO', revisaoAtual: j.revisaoAtual as number };
    }
    if (r.status === 409 && j.error === 'conflito_versao_ou_hash') return { tipo: 'CONFLITO_VERSAO_OU_HASH' };
  } catch { /* payload inválido = falha tratável */ }
  return { tipo: 'FALHA' };
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
export async function carregarPesosServidor(): Promise<RegistroPeso[] | null> {
  // 🔒 A série carrega DATA desde a Leva D — sem ela não há janela de 7 dias.
  const r = await getJson<{ pesos: RegistroPeso[] }>('/api/dados/peso');
  return r?.pesos ?? null;
}
export type ResultadoPesoServidor =
  /** Primeiro registro do dia — aceito e gravado. */
  | { tipo: 'REGISTRADO' }
  /** Reenvio do MESMO peso no MESMO dia: nada duplicou e nada falhou. */
  | { tipo: 'IDEMPOTENTE'; pesoKg: number }
  /** Segunda tentativa do dia com peso diferente: o servidor RECUSOU e manteve o primeiro. */
  | { tipo: 'RECUSADO_DIA'; pesoKg: number | null }
  /** Rede/backend indisponível — o registro local permanece pendente, sem perda. */
  | { tipo: 'FALHA' };

/**
 * 🔒 `dataISO` vai junto (Leva D). O caso que obriga: a re-subida das pesagens que ficaram
 * só no navegador. Sem a data, todas chegariam carimbadas com o dia da sincronização e a
 * janela de 7 dias leria uma série que não aconteceu. Ausente = o banco usa `current_date`.
 *
 * 🔒 O retorno deixou de ser booleano (2026-09-11): com um registro por dia, "não gravou"
 * passou a ter DOIS significados opostos — recusa legítima e falha de rede. Colapsá-los em
 * `false` é exatamente como uma sincronização perde um registro em silêncio.
 */
export async function registrarPesoServidor(pesoKg: number, dataISO?: string | null): Promise<ResultadoPesoServidor> {
  if (!supabaseConfigurado()) return { tipo: 'FALHA' };
  const r = await fetchComRetry401('/api/dados/peso', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pesoKg, ...(dataISO ? { dataISO } : {}) }),
  });
  if (!r) return { tipo: 'FALHA' };
  const corpo = await r.json().catch(() => null) as
    { estado?: string; pesoKg?: unknown } | null;
  if (r.status === 409 || corpo?.estado === 'RECUSADO_DIA') {
    const kg = Number(corpo?.pesoKg);
    return { tipo: 'RECUSADO_DIA', pesoKg: Number.isFinite(kg) ? kg : null };
  }
  if (!r.ok) return { tipo: 'FALHA' };
  if (corpo?.estado === 'IDEMPOTENTE') {
    const kg = Number(corpo?.pesoKg);
    return { tipo: 'IDEMPOTENTE', pesoKg: Number.isFinite(kg) ? kg : pesoKg };
  }
  return { tipo: 'REGISTRADO' };
}

// ---- acesso (allowlist/assinatura) -------------------------------------------
export async function consultarAcesso(): Promise<{ liberado: boolean; via: string | null } | null> {
  return getJson<{ liberado: boolean; via: string | null }>('/api/acesso');
}
