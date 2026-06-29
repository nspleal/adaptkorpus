/** GET /api/catalogo/exercicios — lista os 163 exercícios da biblioteca. */
import { NextResponse } from 'next/server';
import { EXERCISES } from '@/lib/data/exercises';

export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json({ total: EXERCISES.length, exercicios: EXERCISES });
}
