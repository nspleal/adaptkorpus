/**
 * POST /api/treino — monta o treino (gate herdado → prescrição FITT → rotina).
 * Body: perfil de treino (ver perfilTreinoSchema). Resposta: { gate, prescricao, rotina }.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { gerarTreino } from '@/lib/engine';
import { EXERCISES } from '@/lib/data/exercises';
import { LIMITE_PAYLOAD_BYTES, payloadCabe, perfilTreinoSchema } from '@/lib/validation/api';
import { barreiraCompute } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';
import type { PerfilTreino } from '@/lib/engine';
import { opcoesDeEntradaPlano } from '@/lib/plano-cas-comando';

export const runtime = 'nodejs';

// Auth (inerte até o Supabase existir) + rate-limit por instância (Hardening-1).
const limitador = criarRateLimit({ limite: 30, janelaMs: 60_000 });

export async function POST(req: NextRequest) {
  const barra = await barreiraCompute(req, limitador);
  if (barra) return barra;
  const declarado = Number(req.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > LIMITE_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'payload_grande' }, { status: 413 });
  }
  // Mede os bytes recebidos mesmo sem Content-Length, antes de montar/parsear o JSON.
  const leitura = await lerJsonLimitado(req);
  if (leitura.grande) return NextResponse.json({ error: 'payload_grande' }, { status: 413 });
  const body = leitura.body;
  if (!payloadCabe(body)) return NextResponse.json({ error: 'payload_grande' }, { status: 413 });
  const parsed = perfilTreinoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'entrada inválida', detalhes: parsed.error.issues }, { status: 400 });
  }
  const { favoritos, pesoEfetivoKg, semanaCiclo, diasOferecidosCardio, escolhasExecucao, ...perfil } = parsed.data;
  /**
   * 🔴 D5 — a rota entrega o plano DO PRODUTO. Antes ela chamava `gerarTreino` com o perfil
   * podado e nenhuma opção: split diferente, exercícios diferentes e — sem `semanaCiclo` —
   * rotina sem séries nem descanso, com um motivo "séries ausente" por slot.
   *
   * 🔒 As opções são montadas como em `lib/plano · recomputarPlano`, e a semana ausente cai
   * em 1 pela mesma razão que `normalizarEntradaPlanoVisivel` faz isso no app: não existe
   * plano certificável sem semana do ciclo.
   */
  const { pesoEfetivoKg: pesoResolvido, ...opcoes } = opcoesDeEntradaPlano({
    pesoEfetivoKg: pesoEfetivoKg ?? perfil.pesoKg,
    diasOferecidosCardio: diasOferecidosCardio ?? [],
    semanaCiclo: { semana: 1, ...semanaCiclo, feedbackGrupos: semanaCiclo?.feedbackGrupos ?? [] },
    escolhasExecucao: escolhasExecucao ?? [],
  });
  const resultado = gerarTreino({ ...perfil, pesoKg: pesoResolvido } as PerfilTreino, {
    exercises: EXERCISES,
    favoritos: new Set(favoritos ?? []),
    ...opcoes,
  });
  return NextResponse.json(resultado);
}

/** Leitor limitado: o máximo acumulado é 64 KiB, inclusive espaço em branco do JSON. */
async function lerJsonLimitado(req: NextRequest): Promise<{ grande: boolean; body: unknown }> {
  const reader = req.body?.getReader();
  if (!reader) return { grande: false, body: null };
  const decoder = new TextDecoder();
  let bytes = 0;
  let texto = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > LIMITE_PAYLOAD_BYTES) {
        void reader.cancel().catch(() => undefined);
        return { grande: true, body: null };
      }
      texto += decoder.decode(value, { stream: true });
    }
    return { grande: false, body: JSON.parse(texto + decoder.decode()) as unknown };
  } catch {
    return { grande: false, body: null };
  } finally {
    reader.releaseLock();
  }
}
