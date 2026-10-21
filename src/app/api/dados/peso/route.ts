import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { lerPaginaLogs } from '@/lib/persistencia/logs-paginados';
import { pesoKgDaResposta } from '@/lib/peso-dominio';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  try {
    const pagina = await lerPaginaLogs(ctx, req, 'peso');
    if (!pagina) return NextResponse.json({ error: 'cursor_invalido' }, { status: 400 });
    const pesos = pagina.linhas.map((r) => {
      const declarada = typeof r.data === 'string' ? r.data : null;
      const recebida = typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : null;
      return { dataISO: declarada ?? recebida, kg: pesoKgDaResposta((r.payload as { pesoKg?: unknown })?.pesoKg) };
    }).filter((r) => r.kg !== null);
    return NextResponse.json({ pesos, nextCursor: pagina.nextCursor });
  } catch { return NextResponse.json({ error: 'falha_leitura' }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const ctx = await contextoUsuario(req, true);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ error: 'atualizacao_necessaria' }, { status: 426 });
}
