/**
 * POST /api/treino — monta o treino (gate herdado → prescrição FITT → rotina).
 * Body: perfil de treino (ver perfilTreinoSchema). Resposta: { gate, prescricao, rotina }.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { gerarTreino } from '@/lib/engine';
import { EXERCISES } from '@/lib/data/exercises';
import { perfilTreinoSchema } from '@/lib/validation/api';
import type { PerfilTreino } from '@/lib/engine';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = perfilTreinoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'entrada inválida', detalhes: parsed.error.issues }, { status: 400 });
  }
  const perfil = parsed.data as PerfilTreino;
  const resultado = gerarTreino(perfil, { exercises: EXERCISES });
  return NextResponse.json(resultado);
}
