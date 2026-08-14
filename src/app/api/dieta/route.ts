/**
 * POST /api/dieta — monta o plano de dieta (gate → alvo → macros → cardápio).
 * Body: perfil (ver perfilSchema). Resposta: { gate, plano, cardapio }.
 * Rudimentar: usa a base curada do seed; sem auth ainda (Fase 1). Motor é puro.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { gerarDieta } from '@/lib/engine';
import { FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import { perfilSchema } from '@/lib/validation/profile';
import { barreiraCompute } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';
import { payloadCabe } from '@/lib/validation/api';
import type { PerfilUsuario } from '@/lib/engine';
import type { Alergeno } from '@/lib/data/types';

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
  const parsed = perfilSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'entrada inválida', detalhes: parsed.error.issues }, { status: 400 });
  }
  const p = parsed.data;
  const perfil: PerfilUsuario = {
    sexo: p.sexo,
    pesoKg: p.pesoKg,
    alturaCm: p.alturaCm,
    idade: p.idade,
    nivelAtividade: p.nivelAtividade,
    objetivo: p.objetivo,
    flagsSaude: p.flagsSaude,
  };
  const resultado = gerarDieta(perfil, {
    recipes: RECIPES_SEED,
    foodsById: FOODS_BY_ID_SEED,
    restricoes: { alergenos: p.alergenos as Alergeno[], preferencia: p.preferenciaAlimentar ?? null },
  });
  return NextResponse.json(resultado);
}
