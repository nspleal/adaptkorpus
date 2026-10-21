/**
 * POST /api/metricas — telemetria de produto do usuário LOGADO (Leva C2).
 * 🔒 Cofre: `conceitos/metricas-de-produto-adaptkorpus` (DF 2026-07-31).
 *
 * Grava na tabela `eventos`, sob RLS, no próprio Supabase. **Primeira parte, nunca
 * terceiro** — nada de comportamento por conta sai daqui para serviço externo.
 *
 * 🔴 `eventos` é tabela PRÓPRIA, separada de `logs`. `logs` guarda peso/treino/refeição — o
 * histórico da pessoa — e continua fechado em 3 tipos. Ver o cabeçalho da migration `0009`.
 *
 * Só POST: telemetria é append-only. Ninguém lê os próprios eventos por aqui (a leitura é do
 * autor, no banco); o que o usuário tem direito de ver sai no export LGPD.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { barreiraDados } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';
import { payloadCabe } from '@/lib/validation/api';
import { TIPOS_EVENTO, chaveProibida, montarPayload, type TipoEvento } from '@/lib/metricas/eventos';

// Telemetria é mais frequente que dado — `app_aberto` sai a cada navegação. Teto alto o
// bastante para uso normal e baixo o bastante para não virar canal de escrita livre.
const limitador = criarRateLimit({ limite: 240, janelaMs: 5 * 60_000 });

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  const barra = barreiraDados(ctx.user.id, limitador);
  if (barra) return barra;

  const body = (await req.json().catch(() => null)) as { tipo?: unknown; payload?: unknown } | null;
  const tipo = body?.tipo;
  if (typeof tipo !== 'string' || !(TIPOS_EVENTO as readonly string[]).includes(tipo)) {
    return NextResponse.json({ error: 'tipo_invalido' }, { status: 400 });
  }
  const bruto = body?.payload;
  if (bruto == null || typeof bruto !== 'object' || Array.isArray(bruto)) {
    return NextResponse.json({ error: 'payload_invalido' }, { status: 400 });
  }

  /**
   * 🔴 A denylist é aplicada NO SERVIDOR também, não só no cliente. O cliente é código que
   * o usuário controla — confiar nele para a regra de dado sensível seria repetir o erro que
   * o RLS existe para não cometer.
   */
  for (const k of Object.keys(bruto as Record<string, unknown>)) {
    if (chaveProibida(k)) return NextResponse.json({ error: 'chave_proibida' }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = montarPayload(tipo as TipoEvento, bruto as Record<string, unknown>);
  } catch {
    return NextResponse.json({ error: 'chave_proibida' }, { status: 400 });
  }
  if (!payloadCabe(payload)) return NextResponse.json({ error: 'payload_grande' }, { status: 413 });

  const { error } = await ctx.supabase
    .from('eventos').insert({ user_id: ctx.user.id, tipo, payload });
  if (error) return NextResponse.json({ error: 'falha_escrita' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
