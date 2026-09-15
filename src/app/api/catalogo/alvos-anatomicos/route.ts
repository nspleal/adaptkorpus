/**
 * GET /api/catalogo/alvos-anatomicos        → proveniência + os 44 alvos + limites de discriminação
 * GET /api/catalogo/alvos-anatomicos?id=eN  → os alvos de um id, com papel, condição, regra,
 *                                             fontes, descritores, ênfases contextuais e limite.
 *
 * 🔒 Rota PRÓPRIA (mesmo desenho da integração muscular anterior, `/api/catalogo/musculatura`):
 * fontes, justificativas e ênfases pesam ~76 KB e não têm por que viajar em toda abertura da
 * biblioteca. O motor já tem o que precisa no bundle (`alvos-anatomicos-dados`); isto aqui é
 * só a camada de leitura humana.
 *
 * 🔴 Esta rota NÃO participa de nenhuma decisão de treino. O plano fecha sem ela.
 */
import { NextResponse } from 'next/server';
import {
  ALVOS_ANATOMICOS, PROCEDENCIA_ANATOMICA, RESSALVA_COBERTURA, alvosDoExercicio, anatomiaDe,
} from '@/lib/data/alvos-anatomicos';
import {
  DETALHE_ANATOMICO, FONTES_ANATOMICAS, LIMITES_DE_DISCRIMINACAO, REGRAS_ANATOMICAS,
} from '@/lib/data/alvos-anatomicos-fontes';

export const runtime = 'nodejs';

export function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');

  if (!id) {
    return NextResponse.json({
      procedencia: PROCEDENCIA_ANATOMICA,
      alvos: ALVOS_ANATOMICOS,
      limitesDeDiscriminacao: LIMITES_DE_DISCRIMINACAO,
      ressalva: RESSALVA_COBERTURA,
    });
  }

  const anatomia = anatomiaDe(id);
  const detalhe = DETALHE_ANATOMICO[id];
  if (!anatomia || !detalhe) {
    // 🔴 404 significa "sem classificação neste mapa", NUNCA "este exercício não trabalha nada".
    return NextResponse.json({
      id,
      classificado: false,
      motivo: 'Este id não está no mapa vigente. Isso não afirma nada sobre o que o exercício trabalha.',
    }, { status: 404 });
  }

  const regra = REGRAS_ANATOMICAS[anatomia.regra]!;
  const consulta = alvosDoExercicio(id);
  return NextResponse.json({
    id,
    classificado: true,
    nome: detalhe.nome,
    uso: anatomia.uso,
    descricaoAcao: detalhe.descricaoAcao,
    /** Alvos incondicionais, já com a ficha do alvo resolvida — a tela não cruza chaves. */
    alvos: consulta.alvos.map((a) => ({ ...a, ficha: ALVOS_ANATOMICOS[a.alvo]! })),
    /** Ramos que dependem de execução declarada. Pendente não cobre e não nega. */
    condicionaisNaoResolvidas: consulta.condicionaisNaoResolvidas.map((c) => ({
      ...c, fichas: c.alvos.map((t) => ALVOS_ANATOMICOS[t]!),
    })),
    regra: { id: anatomia.regra, ...regra, fichas: regra.fontes.map((f) => FONTES_ANATOMICAS[f]!) },
    descritores: detalhe.descritores,
    enfasesContextuais: detalhe.enfasesContextuais.map((e) => ({ ...e, ficha: FONTES_ANATOMICAS[e.fonte]! })),
    limitacao: detalhe.limitacao,
    definicaoDeAlvoDireto: PROCEDENCIA_ANATOMICA.definicaoDeAlvoDireto,
    ressalva: RESSALVA_COBERTURA,
  });
}
