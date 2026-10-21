'use client';
import { supabaseConfigurado, supabaseUrl } from '@/lib/supabase/env';
import { continuacaoDaConta, invalidarContinuacoesConta } from './persistencia/continuidade-conta';

/** Registro fechado de chaves. s2 separa a geração do beta sem importar dados antigos. */
export const CHAVES_LOCAIS = [
  'evk_sessao', 'evk_treinos', 'evk_pesos', 'evk_peso_plano', 'evk_aderencia',
  'evk_aba', 'evk_cardio_planejado_v1', 'evk_freq_periodo', 'evk_privacy_ack_v1', 'evk_instalar_ack_v1',
] as const;
export type ChaveLocal = (typeof CHAVES_LOCAIS)[number];
export const CHAVES_SESSAO = ['evk_email'] as const;
export const CHAVES_APOSENTADAS = ['evk_notif'] as const;
const SEM_ESCOPO: ReadonlySet<string> = new Set(['evk_privacy_ack_v1', 'evk_instalar_ack_v1']);
const COM_DADO_PESSOAL = [...CHAVES_LOCAIS.filter((k) => !SEM_ESCOPO.has(k)), ...CHAVES_APOSENTADAS];
let escopo: string | null = null;

export function definirEscopoLocal(userId: string | null): number {
  const proximo = userId && userId.length > 0 ? userId : null;
  if (proximo !== escopo) invalidarContinuacoesConta();
  escopo = proximo;
  return 0; // legado desconhecido fica isolado, sem leitura/importação/limpeza automática
}
export function escopoLocal(): string | null { return escopo; }
export function chaveLocal(base: ChaveLocal): string {
  if (!escopo || SEM_ESCOPO.has(base)) return base;
  const projeto = supabaseConfigurado() ? new URL(supabaseUrl()).hostname : 'mock';
  return `${base}:s2:${projeto}:${escopo}`;
}
/** Eliminação local explícita: só esta conta, incluindo o sufixo antigo conhecido.
 * Nunca varre dados de outras contas, cookies, caches ou armazenamento de outros apps. */
export function limparDadoPessoalLocal(subject: string | null = escopo): void {
  if (typeof window === 'undefined') return;
  let falhou = false;
  for (const base of COM_DADO_PESSOAL) {
    const projeto = supabaseConfigurado() ? new URL(supabaseUrl()).hostname : 'mock';
    const chaves = subject ? [`${base}:${subject}`, `${base}:s2:${subject}`, `${base}:s2:${projeto}:${subject}`] : [base];
    for (const k of chaves) { try { localStorage.removeItem(k); } catch { falhou = true; } }
  }
  if (!subject || escopo === subject) {
    for (const k of CHAVES_SESSAO) { try { sessionStorage.removeItem(k); } catch { falhou = true; } }
  }
  if (falhou) throw new Error('limpeza_local_incompleta');
}
/** Sessão local escolhe a gaveta offline; somente o getUser do servidor autoriza envio. */
export async function resolverEscopoLocal(): Promise<string | null> {
  const ativo = continuacaoDaConta(escopoLocal);
  const { supabaseConfigurado } = await import('@/lib/supabase/env');
  if (!ativo()) return escopoLocal();
  if (!supabaseConfigurado()) { definirEscopoLocal(null); return null; }
  try {
    const { createClient } = await import('@/lib/supabase/client');
    if (!ativo()) return escopoLocal();
    const { data: { session } } = await createClient().auth.getSession();
    if (!ativo()) return escopoLocal();
    const id = session?.user?.id ?? null; definirEscopoLocal(id); return id;
  } catch { if (ativo()) definirEscopoLocal(null); return escopoLocal(); }
}
