/**
 * GET /api/catalogo/pratos — lista os 56 pratos com macros computadas (soma TACO × gramas).
 */
import { NextResponse } from 'next/server';
import { RECIPES } from '@/lib/data/recipes';
import { FOODS_BY_ID_SEED } from '@/lib/data/seed';
import { macrosDePrato } from '@/lib/data/nutrition';

export const runtime = 'nodejs';

export function GET() {
  const pratos = RECIPES.map((r) => ({ ...r, macros: macrosDePrato(r, FOODS_BY_ID_SEED) }));
  return NextResponse.json({ total: pratos.length, pratos });
}
