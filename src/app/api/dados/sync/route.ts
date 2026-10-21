import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { createAdminClient } from '@/lib/supabase/admin';
import { barreiraDados } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';
import { payloadCabe } from '@/lib/validation/api';
import { comandoSyncSchema, hashComando, prepararPerfil, type LinhaConta } from '@/lib/persistencia/sync-servidor';
import { STORAGE_GENERATION, SYNC_PROTOCOL, type ComandoSync } from '@/lib/persistencia/sync-contrato';
import { aggregateIdDePlano } from '@/lib/plano-cas-comando';
import { mesclarTresVias } from '@/lib/persistencia/mescla';

export const runtime = 'nodejs';
const limitador = criarRateLimit({ limite: 120, janelaMs: 5 * 60_000 });
function protocolo(req: NextRequest) {
  return req.headers.get('x-evk-protocol') === SYNC_PROTOCOL && req.headers.get('x-evk-generation') === STORAGE_GENERATION;
}
export async function GET(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  if (!protocolo(req)) return NextResponse.json({ error: 'atualizacao_necessaria' }, { status: 426 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'persistencia_indisponivel' }, { status: 503 });
  const { data: rascunho, error } = await createAdminClient().rpc('ler_rascunho_sync_v2', { p_user_id: ctx.user.id });
  if (error) return NextResponse.json({ error: 'persistencia_indisponivel' }, { status: 503 });
  return NextResponse.json({ subject: ctx.user.id, generation: STORAGE_GENERATION, rascunho }, { headers: { 'cache-control': 'no-store' } });
}
export async function POST(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  if (!protocolo(req)) return NextResponse.json({ error: 'atualizacao_necessaria' }, { status: 426 });
  // Manutenção/rollback preservam a fila: 503 não é uma recusa definitiva do comando.
  if (process.env.EVK_SYNC_PAUSA_ESCRITAS === '1') return NextResponse.json({ error: 'gravacao_pausada' }, { status: 503 });
  const barra = barreiraDados(ctx.user.id, limitador);
  if (barra) return barra;
  const body: unknown = await req.json().catch(() => null);
  // Comando contém valor e base de comparação; cada entidade continua limitada a 64 KiB.
  if (!payloadCabe(body, 132 * 1024)) return NextResponse.json({ error: 'payload_grande' }, { status: 413 });
  const parsed = comandoSyncSchema.safeParse(body);
  if (!parsed.success) {
    const id = (body as { operationId?: unknown } | null)?.operationId;
    return NextResponse.json({ tipo: 'RECUSADO', operationId: typeof id === 'string' ? id : '', motivo: 'comando_invalido' }, { status: 422 });
  }
  const comando = parsed.data as ComandoSync;
  const entidade = { ...comando.payload }; delete (entidade as { base?: unknown }).base;
  if (!payloadCabe(entidade)) return NextResponse.json({ tipo: 'RECUSADO', operationId: comando.operationId, motivo: 'payload_grande' }, { status: 422 });
  if (comando.subject !== ctx.user.id) return NextResponse.json({ error: 'conta_mudou' }, { status: 409 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'persistencia_indisponivel' }, { status: 503 });
  const admin = createAdminClient();
  let preparado: ReturnType<typeof prepararPerfil> | undefined;
  let sourceRevision = 0;
  let rascunhoPreparado: { estado: Record<string, unknown>; sourceRevision: number } | null = null;
  let erroRascunho: string | null = null;
  if (['PERFIL', 'APLICAR_TREINO', 'DESFAZER_TREINO'].includes(comando.tipo)) {
    const { data, error } = await ctx.supabase.from('plano_cas').select('revision,payload').eq('aggregate_id', aggregateIdDePlano(ctx.user.id)).maybeSingle();
    if (error) return NextResponse.json({ error: 'falha_leitura' }, { status: 503 });
    sourceRevision = data?.revision ?? 0;
    try { preparado = prepararPerfil(ctx.user.id, comando, data as LinhaConta | null); }
    catch { return NextResponse.json({ error: 'validacao_conjunta_falhou' }, { status: 422 }); }
    // Mesmo alvo obsoleto precisa consultar primeiro um recibo anterior dentro da RPC.
  }
  if (comando.tipo === 'RASCUNHO_SESSAO') {
    const { data, error } = await admin.rpc('ler_rascunho_sync_v2', { p_user_id: ctx.user.id });
    if (error) return NextResponse.json({ error: 'falha_leitura' }, { status: 503 });
    const remoto = data as { revision: number; estado?: Record<string, unknown> } | null;
    if (remoto?.estado && comando.payload.base && remoto.estado.sessaoId === comando.payload.estado.sessaoId) {
      const m = mesclarTresVias(comando.payload.base, comando.payload.estado, remoto.estado);
      if (m.conflitos.length) erroRascunho = 'campos_concorrentes';
      else rascunhoPreparado = { estado: m.valor, sourceRevision: remoto.revision };
    } else rascunhoPreparado = { estado: comando.payload.estado, sourceRevision: remoto?.revision ?? 0 };
  }
  const { data, error } = await admin.rpc('executar_comando_sync_v2', {
    p_user_id: ctx.user.id, p_email: ctx.user.email ?? null,
    p_operation_id: comando.operationId, p_hash: hashComando(comando), p_tipo: comando.tipo,
    p_payload: { ...comando.payload, ...(comando.dependsOn ? { dependsOn: comando.dependsOn } : {}) },
    p_preparado: preparado && !('erro' in preparado) ? { sourceRevision, agregado: preparado.payload, formulaVersion: preparado.plano.formulaVersion, canonicalInputHash: preparado.plano.canonicalInputHash } : rascunhoPreparado,
    p_erro: preparado && 'erro' in preparado ? preparado.erro : erroRascunho,
  });
  if (error || !data || typeof data !== 'object') return NextResponse.json({ error: 'falha_atomica' }, { status: 503 });
  const recibo = data as { tipo?: string };
  return NextResponse.json(data, { status: recibo.tipo === 'ACK' ? 200 : recibo.tipo === 'CONFLITO' ? 409 : 422 });
}
