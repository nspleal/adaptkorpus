/**
 * GET/PUT /api/dados/perfil — perfil do usuário LOGADO (Ownership-1, RLS).
 * GET usa o client do usuário; PUT autentica com `getUser()` e só então chama o CAS por um
 * client server-only. O `id` nasce de `getUser()` (regra 4.2.3), nunca do body. O e-mail
 * NUNCA vem do body — no escritor server-only, ele nasce da sessão autenticada; o trigger
 * 0006 ainda protege os writers que usam JWT de usuário.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { barreiraDados } from '@/lib/auth/guard';
import { criarRateLimit } from '@/lib/rate-limit';
import { payloadCabe } from '@/lib/validation/api';
import { linhaComConsentimentos, linhaParaPerfil, perfilParaLinha, type ProfileRow } from '@/lib/persistencia/perfil-profile';
import { consentimentosSchema, perfilResumoSchema } from '@/lib/validation/perfil-resumo';
import type { PerfilResumo } from '@/components/painel/Painel';
import { entradaPlanoVisivelSchema } from '@/lib/validation/plano-entrada';
import { comandoCommitDePlano, aggregateIdDePlano } from '@/lib/plano-cas-comando';
import { leituraAtomicaDoPlanoCas, leituraParaCorrecaoDoPlanoCas } from '@/lib/persistencia/leitura-plano-atomica';
import { persistirPlanoComCAS } from '@/lib/persistencia/plano-cas';
import { RepositorioSupabasePlanoCAS, type ClienteSupabaseCAS } from '@/lib/persistencia/plano-cas-supabase';
import { FORMULA_DURACAO_VERSION } from '@/lib/engine';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 🔴 OS DOIS GUARDS QUE FALTAVAM NESTA ROTA (auditoria de segurança 2026-08-14).
 *
 * `dados/*` e `lgpd/*` ganharam limitador na auditoria de 2026-07-29 e ESTA escapou —
 * justamente a escrita mais cara do app: upsert de `profile` + desativa os `plans` ativos +
 * DOIS inserts permanentes por save. Sem teto, um laço autenticado engorda `plans` sem fim.
 *
 * 30 em 5 min é folgado para o uso real (salvar o perfil é ato deliberado; "Editar perfil →
 * recalcular" em rajada não passa de alguns por minuto) e fecha o laço automatizado.
 */
const limitador = criarRateLimit({ limite: 30, janelaMs: 5 * 60_000 });

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  // Um snapshot C1 já contém perfil + opções no mesmo payload cuja revisão o CAS confirmou.
  // Ler `profile` e `plano_cas` em duas queries independentes pode cruzar os dois lados de
  // uma transação concorrente (perfil antigo com revisão nova). Para C1, nunca devolvemos essa
  // combinação híbrida; legado sem linha CAS continua no caminho separado de revisão zero.
  const { data: cas, error: erroCas } = await ctx.supabase
    .from('plano_cas')
    .select('revision, payload')
    .eq('aggregate_id', aggregateIdDePlano(ctx.user.id))
    .maybeSingle();
  if (erroCas) return NextResponse.json({ error: 'falha_leitura' }, { status: 500 });
  if (cas) {
    const leitura = leituraAtomicaDoPlanoCas(cas) ?? leituraParaCorrecaoDoPlanoCas(cas);
    if (!leitura) return NextResponse.json({ error: 'snapshot_plano_invalido' }, { status: 500 });
    return NextResponse.json(leitura);
  }

  const { data, error } = await ctx.supabase.from('profile').select('*').eq('id', ctx.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'falha_leitura' }, { status: 500 });
  // Linha inexistente OU criada sem o bloco de preferências (parcial) = sem perfil usável.
  if (!data || (!data.sexo && !data.preferencias)) {
    return NextResponse.json({ error: 'sem_perfil' }, { status: 404 });
  }
  // Legado sem C1 continua legível; o primeiro save o promove ao contrato novo.
  return NextResponse.json({
    perfil: linhaParaPerfil(data as ProfileRow),
    revision: 0,
  });
}

export async function PUT(req: NextRequest) {
  const ctx = await contextoUsuario();
  if (ctx instanceof NextResponse) return ctx;
  const barra = barreiraDados(ctx.user.id, limitador);
  if (barra) return barra;
  const body = (await req.json().catch(() => null)) as {
    perfil?: unknown;
    consentimentos?: unknown;
    expectedRevision?: unknown;
    entradaPlano?: unknown;
  } | null;
  /**
   * 🔒 TETO DE BYTES antes do zod (flanco declarado no cofre em 2026-08-13, Passo 0.2 do
   * editor guiado). O schema limita CAMPOS conhecidos, não o TAMANHO do que chega: o perfil
   * carrega jsonb livre (`rotinaCustom`, `preferencias`) e sem teto o corpo entra inteiro no
   * `profile` e é copiado de novo no snapshot de `plans` — o mesmo dado inflado, duas vezes.
   * Mesmo `payloadCabe`/64KB das outras rotas: uma régua só para todas.
   */
  if (!payloadCabe(body)) return NextResponse.json({ error: 'payload_grande' }, { status: 413 });
  const parsed = perfilResumoSchema.safeParse(body?.perfil);
  if (!parsed.success) return NextResponse.json({ error: 'entrada inválida' }, { status: 400 });
  const perfil = parsed.data as PerfilResumo;
  const expectedRevision = body?.expectedRevision;
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) {
    return NextResponse.json({ error: 'revisao_invalida' }, { status: 400 });
  }
  const entrada = body?.entradaPlano == null
    ? undefined // compatibilidade de onboarding/cliente pré-C1.1-C; o construtor usa defaults explícitos.
    : entradaPlanoVisivelSchema.safeParse(body.entradaPlano);
  if (entrada && !entrada.success) return NextResponse.json({ error: 'entrada_plano_invalida' }, { status: 400 });
  const consent = body?.consentimentos == null ? undefined : consentimentosSchema.safeParse(body.consentimentos);
  if (consent && !consent.success) return NextResponse.json({ error: 'consentimentos_invalidos' }, { status: 400 });
  const linhaBase = consent?.success
    ? linhaComConsentimentos(perfilParaLinha(perfil), consent.data, new Date().toISOString())
    : perfilParaLinha(perfil);
  // Uma única RPC substitui "upsert + tentativa best-effort de snapshot": perfil, metadados
  // CAS e os dois planos entram juntos, ou a transação inteira é desfeita.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'persistencia_indisponivel' }, { status: 503 });
  }
  const comando = comandoCommitDePlano(ctx.user.id, perfil, expectedRevision as number, entrada?.data, linhaBase);
  // A RPC não é exposta ao navegador: o JWT do usuário só autentica esta rota; o serviço
  // confiável recebe a identidade já validada e é o único papel com EXECUTE no banco.
  const repo = new RepositorioSupabasePlanoCAS(
    createAdminClient() as unknown as ClienteSupabaseCAS,
    ctx.user.id,
    ctx.user.email ?? null,
  );
  let resultado;
  try {
    resultado = await persistirPlanoComCAS(repo, comando, FORMULA_DURACAO_VERSION);
  } catch {
    return NextResponse.json({ error: 'falha_atomica' }, { status: 500 });
  }
  if (resultado.tipo === 'COMMIT_CONFIRMADO') {
    return NextResponse.json({ ok: true, revision: resultado.revision, entradaPlano: comando.aggregate.entrada.opcoes });
  }
  if (resultado.tipo === 'CONFLITO_REVISAO') {
    return NextResponse.json({ error: 'conflito_revisao', revisaoAtual: resultado.revisaoAtual }, { status: 409 });
  }
  if (resultado.tipo === 'CONFLITO_VERSAO_OU_HASH') {
    return NextResponse.json({ error: 'conflito_versao_ou_hash', motivo: resultado.motivo }, { status: 409 });
  }
  return NextResponse.json({ error: 'falha_atomica' }, { status: 500 });
}
