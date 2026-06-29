/**
 * POST /api/dieta — monta o plano de dieta (gate → alvo → macros → cardápio).
 * Body: perfil (ver perfilSchema). Resposta: { gate, plano, cardapio }.
 * Rudimentar: usa a base curada do seed; sem auth ainda (Fase 1). Motor é puro.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { gerarDieta } from '@/lib/engine';
import { FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import { perfilSchema } from '@/lib/validation/profile';
import type { PerfilUsuario } from '@/lib/engine';
import type { Alergeno } from '@/lib/data/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
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
