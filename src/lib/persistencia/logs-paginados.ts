import 'server-only';
import type { ContextoUsuario } from './servidor';

type Cursor = { criado: string; id: string; limite: string };
const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Cursor validado antes do filtro PostgREST; limite fixo acompanha todas as páginas. */
export async function lerPaginaLogs(ctx: ContextoUsuario, req: Request | undefined, tipo: 'treino' | 'peso' | 'refeicao') {
  const raw = req ? new URL(req.url).searchParams.get('cursor') : null;
  let cursor: Cursor | undefined;
  if (raw) {
    if (raw.length > 1024) return null;
    try { cursor = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor; } catch { return null; }
    if (!cursor || !iso.test(cursor.criado) || !Number.isFinite(Date.parse(cursor.criado)) || !uuid.test(cursor.id) || !iso.test(cursor.limite)) return null;
  }
  const limite = cursor?.limite ?? new Date().toISOString();
  let q = ctx.supabase.from('logs').select('id,created_at,data,payload').eq('user_id', ctx.user.id).eq('tipo', tipo)
    .lte('created_at', limite).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(500);
  if (cursor) q = q.or(`created_at.gt.${cursor.criado},and(created_at.eq.${cursor.criado},id.gt.${cursor.id})`);
  const { data, error } = await q;
  if (error) throw new Error('falha_leitura');
  const linhas = data ?? [], fim = linhas.at(-1);
  // PostgREST costuma devolver +00:00; normalizar só o fuso, preservando microssegundos.
  const criado = fim?.created_at?.replace(' ','T').replace(/([+-]\d{2})$/, '$1:00').replace(/\+00:00$/, 'Z');
  // O teto efetivo do PostgREST pode ser menor que o solicitado. Só página vazia prova fim.
  const nextCursor = fim && criado ? Buffer.from(JSON.stringify({ criado, id: fim.id, limite })).toString('base64url') : null;
  return { linhas, nextCursor };
}
