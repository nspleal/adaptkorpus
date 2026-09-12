/**
 * F1 e F2 do fechamento dirigido de `7a8f2c2`.
 *
 * ── F1: o 500 de `PUT /api/dados/aderencia` ────────────────────────────────────────────
 * 🔴 **Não houve defeito de código.** Causa determinada com evidência nos logs do projeto
 * (leitura, sem escrita, sem dado pessoal): a chamada
 * `POST /rest/v1/rpc/registrar_aderencia_dia` voltou **504** do gateway do Supabase em
 * 2026-09-12T00:00:56.333Z, e no MESMO intervalo `GET /auth/v1/user` também voltou 504 três
 * vezes (4 × 504 em dois serviços diferentes, contra 6 × 204 da mesma RPC e 74 × 200 do
 * auth). Os `postgrest_logs` do intervalo registram `Warp server error: Thread killed by
 * timeout manager` (3×), e o **Postgres não registrou nenhum ERROR** — nem
 * `autenticacao_obrigatoria`, nem violação de RLS, nem `ON CONFLICT` sem índice. Um timeout
 * de gateway não chega ao banco; se a RPC tivesse levantado exceção, haveria ERROR no log.
 *
 * Portanto: rota, RPC, permissões e este lote estão fora da causa, e **nada foi "consertado"
 * aqui** — inventar mudança para fechar um item é pior que declarar a causa. O que este
 * arquivo trava é o CONTRATO que a QA temia ver violado: a rota **não mascara** falha de
 * escrita como sucesso, e a cópia local sobrevive ao 500 (offline-first), de modo que o PUT
 * seguinte converge. A prova bruta está em `provas/f1-aderencia-504-*.log`.
 *
 * ── F2: reprodutibilidade dos grants ──────────────────────────────────────────────────
 * 🔴 `revoke all on function … from public` **não** remove o EXECUTE que os DEFAULT
 * PRIVILEGES do Supabase concedem a `anon` **nominalmente**. Medido no banco em 2026-09-11:
 * `registrar_peso_dia` já estava sem `anon=X` (correção aplicada à mão), mas
 * `registrar_aderencia_dia` **ainda tinha** — mesma causa, ainda aberta, e o SQL versionado
 * não reproduzia nenhuma das duas. A migration `0020` fecha as duas de forma incremental e
 * idempotente. Aqui a régua é de REPOSITÓRIO: se alguém reintroduzir o grant ou apagar a
 * revogação nominal, o teste quebra. A prova em Postgres real está em
 * `supabase/tests/rpc_anon_sem_execute.sql` (runner próprio).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const MIGRACOES = 'supabase/migrations';
const sql = (arq: string) => readFileSync(`${MIGRACOES}/${arq}`, 'utf8');
const semComentariosSql = (s: string) => s.replace(/^\s*--.*$/gm, '');

// ────────────────────────────────── F1 ──────────────────────────────────────
vi.mock('../lib/supabase/env', () => ({ supabaseConfigurado: () => true }));
const { salvarAderenciaDia } = await import('../lib/persistencia/sync');
afterEach(() => vi.unstubAllGlobals());

describe('F1 — a rota de aderência não mascara falha de escrita como sucesso', () => {
  it('a rota devolve 500 `falha_gravacao` quando a RPC erra, e nada além disso', () => {
    const rota = readFileSync('src/app/api/dados/aderencia/route.ts', 'utf8');
    // O ramo de erro existe e responde 500 — nenhum `ok: true` antes de conferir o erro.
    expect(rota).toContain("if (error) return NextResponse.json({ error: 'falha_gravacao' }, { status: 500 });");
    const put = rota.slice(rota.indexOf('export async function PUT'));
    const posErro = put.indexOf("'falha_gravacao'");
    const posOk = put.indexOf('{ ok: true }');
    expect(posErro, 'o ramo de erro desapareceu do PUT').toBeGreaterThan(-1);
    expect(posOk, 'o sucesso é respondido ANTES de conferir o erro da RPC').toBeGreaterThan(posErro);
  });

  it('a garantia de concorrência segue no lugar: RPC atômica com o predicado do índice', () => {
    const rota = readFileSync('src/app/api/dados/aderencia/route.ts', 'utf8');
    expect(rota).toContain("rpc('registrar_aderencia_dia'");
    const m = semComentariosSql(sql('0018_aderencia_uma_linha_por_dia.sql'));
    expect(m).toContain('create unique index if not exists logs_refeicao_por_dia_unico');
    expect(m).toMatch(/on conflict \(user_id, tipo, data\) where tipo = 'refeicao'/);
    expect(m, 'a trava de autenticação dentro da função saiu').toContain("raise exception 'autenticacao_obrigatoria'");
  });

  it('500 do servidor NÃO é reportado como gravado ao cliente (offline-first preservado)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'falha_gravacao' }), { status: 500 }),
    ));
    // `false` = a cópia local continua sendo a fonte; nada é descartado.
    expect(await salvarAderenciaDia('2026-09-12', {}, {})).toBe(false);
  });

  it('504 do gateway (o caso medido) também chega como não-gravado, não como sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 504 })));
    expect(await salvarAderenciaDia('2026-09-12', {}, {})).toBe(false);
  });

  it('e o PUT seguinte grava — a escrita é idempotente por dia, então converge', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    expect(await salvarAderenciaDia('2026-09-12', {}, {})).toBe(true);
    const m = semComentariosSql(sql('0018_aderencia_uma_linha_por_dia.sql'));
    expect(m, 'reenviar o dia deixou de ser idempotente').toContain('do update set payload = excluded.payload');
  });
});

// ────────────────────────────────── F2 ──────────────────────────────────────
const RPCS = [
  { rotulo: 'peso', assinatura: 'public.registrar_peso_dia(date, numeric)' },
  { rotulo: 'aderência', assinatura: 'public.registrar_aderencia_dia(date, jsonb)' },
] as const;

describe('F2 — o SQL versionado reproduz a restrição aplicada no banco', () => {
  const m0020 = semComentariosSql(sql('0020_rpc_revogar_anon_nominal.sql'));

  // Comparação por TEXTO da linha inteira: a assinatura faz parte do contrato (mudá-la é
  // outra função), então montar regex sobre ela só acrescentaria modo de falha ao teste.
  it.each(RPCS)('0020 revoga `anon` NOMINALMENTE em $rotulo', ({ assinatura }) => {
    expect(m0020).toContain(`revoke all on function ${assinatura} from anon;`);
  });

  it.each(RPCS)('0020 revoga PUBLIC e reafirma EXECUTE para `authenticated` em $rotulo', ({ assinatura }) => {
    expect(m0020).toContain(`revoke all on function ${assinatura} from public;`);
    expect(m0020).toContain(`grant execute on function ${assinatura} to authenticated;`);
  });

  it('0020 falha em vez de passar em silêncio: guarda por `has_function_privilege`', () => {
    expect(m0020).toContain("has_function_privilege('anon'");
    expect(m0020).toContain("has_function_privilege('authenticated'");
    expect(m0020).toContain('anon_ainda_executa');
    expect(m0020).toContain('authenticated_perdeu_execute');
  });

  it('0020 é idempotente por construção: só REVOKE/GRANT, nenhum DDL destrutivo', () => {
    expect(/drop\s+(function|table|index|policy)/i.test(m0020), '0020 ganhou DDL destrutivo').toBe(false);
    expect(/create\s+or\s+replace\s+function/i.test(m0020), '0020 passou a redefinir função').toBe(false);
    expect(/alter\s+table/i.test(m0020), '0020 passou a alterar tabela').toBe(false);
  });

  it('nenhuma migration CONCEDE execute a `anon` nessas RPCs (varredura de todas)', () => {
    const arquivos = readdirSync(MIGRACOES).filter((f) => f.endsWith('.sql'));
    expect(arquivos.length, 'a varredura não achou migration nenhuma').toBeGreaterThan(10);
    for (const arq of arquivos) {
      const corpo = semComentariosSql(sql(arq));
      for (const { assinatura } of RPCS) {
        const fn = assinatura.replace('public.', '').replace(/\(.*/, '');
        const concede = new RegExp(`grant[^;]*execute[^;]*${fn}[^;]*to[^;]*\\banon\\b`, 'i');
        expect(concede.test(corpo), `${arq} concede EXECUTE a anon em ${fn}`).toBe(false);
      }
    }
  });

  it('a revogação nominal vem DEPOIS da criação das funções (0018/0019 < 0020)', () => {
    expect(semComentariosSql(sql('0018_aderencia_uma_linha_por_dia.sql'))).toContain('create or replace function public.registrar_aderencia_dia');
    expect(semComentariosSql(sql('0019_peso_um_por_dia.sql'))).toContain('create or replace function public.registrar_peso_dia');
    const arquivos = readdirSync(MIGRACOES).filter((f) => f.endsWith('.sql')).sort();
    expect(arquivos.indexOf('0020_rpc_revogar_anon_nominal.sql')).toBeGreaterThan(arquivos.indexOf('0019_peso_um_por_dia.sql'));
  });

  it('existe prova em Postgres real, com runner próprio (não só régua de texto)', () => {
    const teste = readFileSync('supabase/tests/rpc_anon_sem_execute.sql', 'utf8');
    // O teste reproduz o estado defeituoso ANTES de migrar — é isso que o torna prova.
    expect(teste).toContain('grant execute on function public.registrar_peso_dia(date, numeric) to anon;');
    expect(teste).toContain('grant execute on function public.registrar_aderencia_dia(date, jsonb) to anon;');
    expect(teste).toContain('\\ir ../migrations/0020_rpc_revogar_anon_nominal.sql');
    expect(teste).toContain('insufficient_privilege');
    expect(teste, 'a prova de que authenticated grava sob RLS saiu').toContain('authenticated nao gravou sob RLS');
    expect(readFileSync('supabase/tests/run-rpc-anon-test.sh', 'utf8')).toContain('rpc_anon_sem_execute.sql');
  });
});
