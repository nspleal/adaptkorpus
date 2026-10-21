import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { linhaParaPerfil, type ProfileRow } from '@/lib/persistencia/perfil-profile';
import { aggregateIdDePlano } from '@/lib/plano-cas-comando';
import { leituraAtomicaDoPlanoCas, leituraParaCorrecaoDoPlanoCas } from '@/lib/persistencia/leitura-plano-atomica';
import { versoesDaConta, type LinhaConta } from '@/lib/persistencia/sync-servidor';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  const { data: cas, error: erroCas } = await ctx.supabase.from('plano_cas').select('revision,payload').eq('aggregate_id', aggregateIdDePlano(ctx.user.id)).maybeSingle();
  if (erroCas) return NextResponse.json({ error: 'falha_leitura' }, { status: 500 });
  if (cas) {
    const leitura = leituraAtomicaDoPlanoCas(cas) ?? leituraParaCorrecaoDoPlanoCas(cas);
    if (!leitura) return NextResponse.json({ error: 'snapshot_plano_invalido' }, { status: 500 });
    return NextResponse.json({ ...leitura, versoesTreino: versoesDaConta(cas as LinhaConta) }, { headers: { 'cache-control': 'no-store' } });
  }
  const { data, error } = await ctx.supabase.from('profile').select('*').eq('id', ctx.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'falha_leitura' }, { status: 500 });
  if (!data || (!data.sexo && !data.preferencias)) return NextResponse.json({ error: 'sem_perfil' }, { status: 404 });
  return NextResponse.json({ perfil: linhaParaPerfil(data as ProfileRow), revision: 0 });
}
/** Cliente antigo conserva sua cópia local, mas não pode repovoar o beta pelo autosave. */
export async function PUT(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ error: 'atualizacao_necessaria' }, { status: 426 });
}
