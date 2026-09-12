/**
 * GET /api/catalogo/exercicios — lista o catálogo inteiro da biblioteca (168 exercícios,
 * cardio incluído), sem filtro de nível, de equipamento ou de banidos: o recorte por pessoa
 * é de cada tela, e `total` vem do próprio array para nunca divergir do que foi enviado.
 * 🔴 Não repetir a contagem em prosa noutro lugar — era o comentário "163" que ficou velho
 * quando a leva `e164`–`e168` entrou (2026-08-15).
 */
import { NextResponse } from 'next/server';
import { EXERCISES } from '@/lib/data/exercises';

export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json({ total: EXERCISES.length, exercicios: EXERCISES });
}
