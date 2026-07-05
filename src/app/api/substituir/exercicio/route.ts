/**
 * POST /api/substituir/exercicio — troca um exercício (F.2).
 * Body: { exercicioAtualId, equipamento, nivelExperiencia, historicoRecenteIds?, gostoExcluirIds? }.
 * Dor/lesão NÃO entra aqui (isso é pausa + aviso no fluxo de treino).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { substituirExercicio } from '@/lib/engine';
import { EXERCISES } from '@/lib/data/exercises';
import { subExercicioSchema } from '@/lib/validation/api';
import { barreiraCompute } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Auth (inerte até o Supabase existir) + rate-limit por instância (Hardening-1).
const limitador = criarRateLimit({ limite: 30, janelaMs: 60_000 });

export async function POST(req: NextRequest) {
  const barra = await barreiraCompute(req, limitador);
  if (barra) return barra;
  const body = await req.json().catch(() => null);
  const parsed = subExercicioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'entrada inválida', detalhes: parsed.error.issues }, { status: 400 });
  }
  const { exercicioAtualId, equipamento, equipamentosCasa, nivelExperiencia, historicoRecenteIds, gostoExcluirIds } = parsed.data;
  const exercicioAtual = EXERCISES.find((e) => e.id === exercicioAtualId);
  if (!exercicioAtual) {
    return NextResponse.json({ error: 'exercicioAtualId não encontrado' }, { status: 404 });
  }
  const resultado = substituirExercicio({
    exercicioAtual,
    equipamento,
    equipamentosCasa, // checklist de casa (modelo 2 níveis; ausente = legado)
    nivelExperiencia,
    exercises: EXERCISES,
    historicoRecenteIds,
    gostoExcluirIds,
  });
  return NextResponse.json(resultado);
}
