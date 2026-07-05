/**
 * POST /api/treino — monta o treino (gate herdado → prescrição FITT → rotina).
 * Body: perfil de treino (ver perfilTreinoSchema). Resposta: { gate, prescricao, rotina }.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { gerarTreino } from '@/lib/engine';
import { EXERCISES } from '@/lib/data/exercises';
import { perfilTreinoSchema } from '@/lib/validation/api';
import { barreiraCompute } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';
import type { PerfilTreino } from '@/lib/engine';

export const runtime = 'nodejs';

// Auth (inerte até o Supabase existir) + rate-limit por instância (Hardening-1).
const limitador = criarRateLimit({ limite: 30, janelaMs: 60_000 });

export async function POST(req: NextRequest) {
  const barra = await barreiraCompute(req, limitador);
  if (barra) return barra;
  const body = await req.json().catch(() => null);
  const parsed = perfilTreinoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'entrada inválida', detalhes: parsed.error.issues }, { status: 400 });
  }
  const perfil = parsed.data as PerfilTreino;
  const resultado = gerarTreino(perfil, { exercises: EXERCISES });
  return NextResponse.json(resultado);
}
