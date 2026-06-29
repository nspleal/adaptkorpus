/**
 * POST /api/substituir/prato — troca um prato no mesmo slot (F.2).
 * Body: { perfil, totaisDiaAtual, pratoAtualId, slot, restricoes?, gosto? }.
 * O plano (janela do dia + piso de proteína) é recomputado do perfil → consistente.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { gerarDieta, substituirPrato } from '@/lib/engine';
import { FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import { subPratoSchema } from '@/lib/validation/api';
import type { PerfilUsuario } from '@/lib/engine';
import type { Alergeno } from '@/lib/data/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = subPratoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'entrada inválida', detalhes: parsed.error.issues }, { status: 400 });
  }
  const { perfil: pf, totaisDiaAtual, pratoAtualId, slot, restricoes, gosto } = parsed.data;

  const perfil: PerfilUsuario = {
    sexo: pf.sexo,
    pesoKg: pf.pesoKg,
    alturaCm: pf.alturaCm,
    idade: pf.idade,
    nivelAtividade: pf.nivelAtividade,
    objetivo: pf.objetivo,
    flagsSaude: pf.flagsSaude,
  };
  const { plano } = gerarDieta(perfil);
  if (!plano) {
    return NextResponse.json({ error: 'gate roteia para profissional — sem plano para substituir' }, { status: 409 });
  }
  const pratoAtual = RECIPES_SEED.find((r) => r.id === pratoAtualId);
  if (!pratoAtual) {
    return NextResponse.json({ error: 'pratoAtualId não encontrado' }, { status: 404 });
  }

  const resultado = substituirPrato({
    pratoAtual,
    slot,
    recipes: RECIPES_SEED,
    foodsById: FOODS_BY_ID_SEED,
    plano,
    totaisDiaAtual,
    restricoes: {
      alergenos: (restricoes?.alergenos ?? []) as Alergeno[],
      preferencia: restricoes?.preferencia ?? null,
    },
    gosto,
  });
  return NextResponse.json(resultado);
}
