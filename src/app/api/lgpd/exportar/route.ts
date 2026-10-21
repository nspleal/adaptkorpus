import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { barreiraDados } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';
import { lerColecaoCompleta, lerRecibosCompletos, lerRevisaoExportacao } from '@/lib/persistencia/exportacao';
import { createAdminClient } from '@/lib/supabase/admin';
const limitador = criarRateLimit({ limite: 6, janelaMs: 60 * 60_000 });
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  const barra = barreiraDados(ctx.user.id, limitador); if (barra) return barra;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'persistencia_indisponivel' }, { status: 503 });
  const admin = createAdminClient();
  const nomes = ['profile','plans','logs','feedback','subscription','eventos','plano_cas','rascunho','recibos'] as const;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    let antes: string;
    try { antes = await lerRevisaoExportacao(admin, ctx.user.id); }
    catch { return NextResponse.json({ error: 'falha_consistencia' }, { status: 503 }); }
    // A revisão transacional detecta mudanças. Não omitir dados por diferença de relógio.
    const limite = 'infinity';
    const resultados = await Promise.allSettled([
      ctx.supabase.from('profile').select('*').eq('id',ctx.user.id).maybeSingle().then(({ data, error }) => { if (error) throw error; return data; }),
      lerColecaoCompleta(ctx,'plans',limite), lerColecaoCompleta(ctx,'logs',limite), lerColecaoCompleta(ctx,'feedback',limite),
      ctx.supabase.from('subscription').select('*').eq('user_id',ctx.user.id).maybeSingle().then(({ data, error }) => { if (error) throw error; return data; }),
      lerColecaoCompleta(ctx,'eventos',limite),
      ctx.supabase.from('plano_cas').select('*').eq('user_id',ctx.user.id).maybeSingle().then(({ data, error }) => { if (error) throw error; return data; }),
      (async () => {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('indisponivel');
        const { data, error } = await admin.rpc('ler_rascunho_sync_v2', { p_user_id: ctx.user.id });
        if (error) throw error; return data;
      })(),
      (async () => {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('indisponivel');
        return lerRecibosCompletos(admin, ctx.user.id, limite);
      })(),
    ]);
    const falharam = resultados.flatMap((r,i) => r.status === 'rejected' ? [nomes[i]] : []);
    if (falharam.length) return NextResponse.json({ error: 'falha_leitura', secoes: falharam }, { status: 503 });
    try { if (await lerRevisaoExportacao(admin, ctx.user.id) !== antes) continue; }
    catch { return NextResponse.json({ error: 'falha_consistencia' }, { status: 503 }); }
    return NextResponse.json({
      exportadoEm: new Date().toISOString(), consistencia: { revision: antes }, usuario: { id: ctx.user.id, email: ctx.user.email ?? null },
      ...Object.fromEntries(resultados.map((r,i) => [nomes[i], r.status === 'fulfilled' ? r.value : null])),
    }, { headers: { 'cache-control': 'no-store' } });
  }
  return NextResponse.json({ error: 'exportacao_alterada_tente_novamente' }, { status: 503, headers: { 'cache-control': 'no-store' } });
}
