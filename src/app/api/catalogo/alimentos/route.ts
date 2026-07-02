/** GET /api/catalogo/alimentos — lista os 167 alimentos curados (TACO, V2 limpa). */
import { NextResponse } from 'next/server';
import { FOODS } from '@/lib/data/foods';

export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json({ total: FOODS.length, alimentos: FOODS });
}
