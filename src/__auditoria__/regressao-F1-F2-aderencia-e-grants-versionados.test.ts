/**
 * F1 e F2 do fechamento dirigido de `7a8f2c2`.
 *
 * ── F1: o 500 de `PUT /api/dados/aderencia` ────────────────────────────────────────────
 * 🔴 **Não foi comprovado defeito de código como causa do incidente.** Evidências dos logs do projeto
 * (leitura, sem escrita, sem dado pessoal): a chamada
 * `POST /rest/v1/rpc/registrar_aderencia_dia` voltou **504** do gateway do Supabase em
 * 2026-09-12T00:00:56.333Z, e no MESMO intervalo `GET /auth/v1/user` também voltou 504 três
 * vezes (4 × 504 em dois serviços diferentes, contra 6 × 204 da mesma RPC e 74 × 200 do
 * auth). Os `postgrest_logs` do intervalo registram `Warp server error: Thread killed by
 * timeout manager` (3×), e o **Postgres não registrou nenhum ERROR** — nem
 * `autenticacao_obrigatoria`, nem violação de RLS, nem `ON CONFLICT` sem índice. Um timeout
 * de gateway, por si só, não permite concluir se o banco iniciou ou concluiu a operação.
 *
 * Retificação da conclusão original: a correlação favorece falha externa, mas a ausência
 * de ERROR não exclui corrida nem comprova a causa interna do timeout. Não há conserto
 * dessa infraestrutura comprovado. O que este
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
import 'fake-indexeddb/auto';
import { OutboxDB } from '../lib/persistencia/outbox-db';
import { drenarOutbox } from '../lib/persistencia/outbox-sync';
import { novoComando,STORAGE_GENERATION } from '../lib/persistencia/sync-contrato';
afterEach(()=>vi.unstubAllGlobals());
describe('F1 — protocolo v2 nunca mascara falha como sucesso',()=>{
  it('a rota só responde ACK após a transação; falha permanece explícita',()=>{
    const r=readFileSync('src/app/api/dados/sync/route.ts','utf8');
    expect(r).toContain("if (error || !data || typeof data !== 'object') return NextResponse.json({ error: 'falha_atomica' }, { status: 503 })");
    expect(r.indexOf('executar_comando_sync_v2')).toBeLessThan(r.indexOf("recibo.tipo === 'ACK' ? 200"));
  });
  it('unicidade por dia e RPC invoker continuam preservadas no SQL versionado',()=>{
    const m=semComentariosSql(sql('0018_aderencia_uma_linha_por_dia.sql'));
    expect(m).toContain('create unique index if not exists logs_refeicao_por_dia_unico');
    expect(m).toMatch(/on conflict \(user_id, tipo, data\) where tipo = 'refeicao'/);
    expect(m).toContain("raise exception 'autenticacao_obrigatoria'");
    expect(sql('0021_sync_v2_candidata.sql')).toContain("where tipo='refeicao'");
  });
  it.each([500,504])('%s não remove cópia durável nem inventa sucesso',async status=>{
    const db=await OutboxDB.abrir('f1-'+status);const c=novoComando('A',{tipo:'ADERENCIA',payload:{dia:'2026-09-12',logs:{},notes:{},base:{logs:{},notes:{}}}});await db.enfileirar(c);
    await drenarOutbox(db,'A',()=>true,async(_u,i)=>new Response(JSON.stringify(i?.body?{}:{subject:'A',generation:STORAGE_GENERATION}),{status:i?.body?status:200}));
    expect((await db.listar('A'))[0]?.comando).toEqual(c);expect(await db.ler('A','ultimoRecibo')).toBeUndefined();db.fechar();
  });
  it('retorno da rede envia o MESMO comando e só o ACK encerra a fila',async()=>{
    const db=await OutboxDB.abrir('f1-retry');const c=novoComando('A',{tipo:'ADERENCIA',payload:{dia:'2026-09-12',logs:{},notes:{},base:{logs:{},notes:{}}}});await db.enfileirar(c);
    const f=vi.fn(async(_u:string,i?:RequestInit)=>new Response(JSON.stringify(i?.body?{tipo:'ACK',operationId:c.operationId}:{subject:'A',generation:STORAGE_GENERATION})));
    await drenarOutbox(db,'A',()=>true,f);expect(JSON.parse(String(f.mock.calls[1]![1]!.body))).toEqual(c);expect(await db.listar('A')).toEqual([]);db.fechar();
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
