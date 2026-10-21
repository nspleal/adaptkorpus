import 'server-only';
import type { ContextoUsuario } from './servidor';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Chave estável, snapshot de tempo e páginas limitadas. Falha de qualquer página rejeita
 * a seção inteira; nunca apresenta o teto padrão do PostgREST como exportação completa. */
export async function lerColecaoCompleta(ctx: ContextoUsuario, tabela: 'plans' | 'logs' | 'feedback' | 'eventos', limite = new Date().toISOString()) {
  const linhas: Record<string, unknown>[] = [];
  let fim: { created_at: string; id: string } | undefined;
  for (;;) {
    let q = ctx.supabase.from(tabela).select('*').eq('user_id', ctx.user.id).lte('created_at', limite)
      .order('created_at', { ascending: true }).order('id', { ascending: true }).limit(500);
    if (fim) q = q.or(`created_at.gt.${fim.created_at},and(created_at.eq.${fim.created_at},id.gt.${fim.id})`);
    const { data, error } = await q;
    if (error) throw new Error('falha_leitura');
    linhas.push(...data ?? []);
    if (!data?.length) return linhas;
    const ultima = data.at(-1) as { created_at: string; id: string };
    const proximo = { created_at: ultima.created_at.replace(/\+00:00$/, 'Z'), id: ultima.id };
    if (fim && proximo.created_at === fim.created_at && proximo.id === fim.id) throw new Error('cursor_sem_avanco');
    fim = proximo;
  }
}

/** RPC somente de servidor: o UUID vem do contexto autenticado, nunca do corpo. */
export async function lerRecibosCompletos(admin: Pick<SupabaseClient, 'rpc'>, subject: string, limite = new Date().toISOString()) {
  const linhas: Record<string, unknown>[] = [];
  let depois: string | null = null;
  for (;;) {
    const { data, error } = await admin.rpc('exportar_recibos_sync_v2', { p_user_id: subject, p_after: depois, p_limite: limite });
    if (error || (data !== null && !Array.isArray(data))) throw new Error('falha_leitura');
    const pagina = (data ?? []) as Record<string, unknown>[];
    linhas.push(...pagina);
    if (pagina.length < 500) return linhas;
    const proximo = pagina.at(-1)?.operation_id;
    if (typeof proximo !== 'string' || (depois && proximo <= depois)) throw new Error('cursor_sem_avanco');
    depois = proximo;
  }
}

/** String decimal evita perder precisão do bigint. Qualquer erro impede o download. */
export async function lerRevisaoExportacao(admin: Pick<SupabaseClient, 'rpc'>, subject: string): Promise<string> {
  const { data, error } = await admin.rpc('ler_revisao_exportacao_sync_v2', { p_user_id: subject });
  if (error || !data || data.subject !== subject || typeof data.revision !== 'string' || !/^\d+$/.test(data.revision)) throw new Error('revisao_indisponivel');
  return data.revision;
}
