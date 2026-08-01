/**
 * GET/POST /api/dados/peso — registros de peso do usuário LOGADO (`logs` tipo `peso`,
 * payload = { pesoKg }). Antes do backend o peso era só memória (resetava no reload) —
 * esta rota o torna persistente de verdade.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { barreiraDados } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';

const limitador = criarRateLimit({ limite: 60, janelaMs: 5 * 60_000 });

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.supabase
    .from('logs').select('payload, data, created_at').eq('tipo', 'peso').order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'falha_leitura' }, { status: 500 });
  /**
   * 🔒 A DATA VOLTA COM O PESO (Leva D, DF 2026-07-31). Antes esta rota devolvia só o número
   * e jogava fora as duas colunas de data que `logs` já guardava — sem elas não existe janela
   * de 7 dias, e a suavização (que é o que protege o gate) era impossível de calcular.
   *
   * ⚠️ ORDEM TRAVADA: a `data` DECLARADA vence; `created_at` é só reserva. As duas divergem
   * na pesagem feita offline e sincronizada dias depois — e a certa é o dia em que a pessoa
   * se pesou, não o dia em que a rede voltou.
   */
  const pesos = (data ?? []).map((r) => {
    const kg = Number((r.payload as { pesoKg?: unknown } | null)?.pesoKg);
    const declarada = typeof r.data === 'string' ? r.data : null;
    const recebida = typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : null;
    return { dataISO: declarada ?? recebida, kg };
  }).filter((p) => Number.isFinite(p.kg));
  return NextResponse.json({ pesos });
}

export async function POST(req: NextRequest) {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const barra = barreiraDados(ctx.user.id, limitador);
  if (barra) return barra;
  const body = (await req.json().catch(() => null)) as { pesoKg?: unknown; dataISO?: unknown } | null;
  const v = Number(body?.pesoKg);
  if (!Number.isFinite(v) || v < 30 || v > 300) {
    return NextResponse.json({ error: 'entrada inválida' }, { status: 400 });
  }
  /**
   * 🔒 O DIA DA PESAGEM é do cliente, não do servidor (Leva D). Sem isto, a re-subida das
   * pesagens que ficaram só no navegador (retry offline-first) carimbaria todas com o dia em
   * que a REDE voltou — uma semana inteira virando um ponto só, e a média de uma série que
   * não aconteceu. ⚠️ Só o PASSADO recente é aceito: data futura ou fora de faixa cai no
   * `default current_date` do banco, que é o comportamento anterior.
   */
  const d = typeof body?.dataISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dataISO)
    ? body.dataISO : null;
  const hoje = new Date().toISOString().slice(0, 10);
  const dataOk = d && d <= hoje && d >= '2020-01-01' ? d : null;
  const { error } = await ctx.supabase
    .from('logs').insert({
      user_id: ctx.user.id, tipo: 'peso', payload: { pesoKg: v },
      ...(dataOk ? { data: dataOk } : {}),
    });
  if (error) return NextResponse.json({ error: 'falha_gravacao' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
