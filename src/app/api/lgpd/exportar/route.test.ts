import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));

/**
 * 🔴 D8c (verificação de 2026-09-07, reconfirmada no diagnóstico de 2026-09-10, §6.9.3) —
 * a exportação LGPD respondia **200 com um JSON incompleto** quando uma consulta falhava.
 *
 * A rota lia só `.data` das seis consultas (`profile.data ?? null`, `plans.data ?? []`, …) e
 * nunca olhava `.error`. Uma falha de leitura virava seção vazia, e o arquivo baixado dizia,
 * pelo silêncio, que aquela pessoa não tem plano/histórico/telemetria. Numa rota de
 * PORTABILIDADE isso é o pior tipo de erro: a resposta parece completa.
 *
 * ⚠️ O teste tem de exercitar o caminho de SUCESSO também — senão ele prova só que a rota
 * sabe dar erro, e a linha que importa (a checagem por consulta) nunca roda.
 */

type Resposta = { data: unknown; error: unknown };

/** Uma consulta encadeada do supabase-js: `.select().order()` e `.select().maybeSingle()`. */
function consulta(resposta: Resposta) {
  let consumida = false;
  const encadeavel = {
    select: () => encadeavel,
    eq: () => encadeavel,
    lte: () => encadeavel,
    order: () => encadeavel,
    limit: () => encadeavel,
    or: () => encadeavel,
    then: (resolver: (v: Resposta) => unknown) => { const r = consumida && !resposta.error ? { data: [], error: null } : resposta; consumida = true; return Promise.resolve(r).then(resolver); },
    maybeSingle: () => Promise.resolve(resposta),
  };
  return encadeavel;
}

const respostas = new Map<string, Resposta>();
const lidas = new Set<string>();
const OK: Resposta = { data: null, error: null };

vi.mock('@/lib/persistencia/servidor', () => ({
  contextoUsuario: async () => ({
    user: { id: 'u1', email: 'a@b.c' },
    supabase: { from: (tabela: string) => { const r = respostas.get(tabela) ?? OK; const pagina = lidas.has(tabela) && !r.error ? { data: [], error: null } : r; lidas.add(tabela); return consulta(pagina); } },
  }),
}));

vi.mock('@/lib/auth/guard', () => ({ barreiraDados: () => null }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: async (nome: string) => nome === 'ler_revisao_exportacao_sync_v2' ? { data: { subject: 'u1', revision: '0' }, error: null } : respostas.get(nome === 'ler_rascunho_sync_v2' ? 'rascunho' : 'recibos') ?? OK }) }));

const TABELAS = ['profile', 'plans', 'logs', 'feedback', 'subscription', 'eventos', 'plano_cas', 'rascunho', 'recibos'] as const;

async function exportar() {
  const { GET } = await import('./route');
  const res = await GET(new NextRequest('http://localhost/api/lgpd/exportar'));
  return { status: res.status, corpo: await res.json() as Record<string, unknown> };
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-placeholder');
  respostas.clear(); lidas.clear();
  for (const t of TABELAS) respostas.set(t, { data: t === 'profile' || t === 'subscription' ? { x: 1 } : [{ x: 1, id: '11111111-1111-4111-8111-111111111111', created_at: '2026-10-18T00:00:00Z' }], error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/lgpd/exportar — consulta que falha não vira seção vazia', () => {
  it('caminho de SUCESSO: 200 com todas as nove seções preenchidas (senão nada abaixo prova nada)', async () => {
    const { status, corpo } = await exportar();
    expect(status).toBe(200);
    for (const t of TABELAS) expect(corpo[t], `seção ${t} veio vazia no caminho feliz`).toBeTruthy();
    expect(corpo.usuario).toMatchObject({ id: 'u1' });
  });

  it.each(TABELAS)('%s falhando ⇒ a resposta NÃO é 200 e diz qual seção falhou', async (tabela) => {
    respostas.set(tabela, { data: null, error: { message: 'boom' } });
    const { status, corpo } = await exportar();
    expect(status, `a exportação respondeu sucesso com ${tabela} falhando`).not.toBe(200);
    expect(status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(corpo), `a resposta não nomeia a seção que falhou`).toContain(tabela);
  });

  it('falha não devolve export parcial junto (nada de 500 com metade dos dados)', async () => {
    respostas.set('logs', { data: null, error: { message: 'boom' } });
    const { corpo } = await exportar();
    expect(corpo.plans, 'a resposta de erro veio com dados dentro').toBeUndefined();
    expect(corpo.profile).toBeUndefined();
  });

  it('seção legitimamente vazia continua 200 (ausência de dado não é falha)', async () => {
    for (const t of TABELAS) respostas.set(t, { data: null, error: null });
    const { status, corpo } = await exportar();
    expect(status).toBe(200);
    expect(corpo.plans).toEqual([]);
    expect(corpo.profile).toBeNull();
  });
});
