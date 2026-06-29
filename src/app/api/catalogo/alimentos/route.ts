/** GET /api/catalogo/alimentos — lista os 125 alimentos curados (TACO). */
import { NextResponse } from 'next/server';
import { FOODS } from '@/lib/data/foods';

export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json({ total: FOODS.length, alimentos: FOODS });
}
