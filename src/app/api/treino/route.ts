/**
 * POST /api/treino — monta o treino (gate herdado → prescrição FITT → rotina).
 * Body: perfil de treino (ver perfilTreinoSchema). Resposta: { gate, prescricao, rotina }.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { gerarTreino } from '@/lib/engine';
import { EXERCISES } from '@/lib/data/exercises';
import { perfilTreinoSchema, payloadCabe } from '@/lib/validation/api';
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
  /**
   * 🔒 Teto de bytes ANTES do zod (régua única de `validation/api`). O schema limita os
   * CAMPOS, mas só depois que o `JSON.parse` já pagou o custo do corpo inteiro — sem teto,
   * um corpo de dezenas de MB é aceito e parseado antes de qualquer validação. O rate limit
   * acima limita a FREQUÊNCIA; este limita o TAMANHO. São flancos diferentes.
   */
  if (!payloadCabe(body)) return NextResponse.json({ error: 'payload_grande' }, { status: 413 });
  const parsed = perfilTreinoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'entrada inválida', detalhes: parsed.error.issues }, { status: 400 });
  }
  const perfil = parsed.data as PerfilTreino;
  const resultado = gerarTreino(perfil, { exercises: EXERCISES });
  return NextResponse.json(resultado);
}
