import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { lerPaginaLogs } from '@/lib/persistencia/logs-paginados';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  try {
    const pagina = await lerPaginaLogs(ctx, req, 'treino');
    if (!pagina) return NextResponse.json({ error: 'cursor_invalido' }, { status: 400 });
    return NextResponse.json({ sessoes: pagina.linhas.map((r) => r.payload), nextCursor: pagina.nextCursor });
  } catch { return NextResponse.json({ error: 'falha_leitura' }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ error: 'atualizacao_necessaria' }, { status: 426 });
}
