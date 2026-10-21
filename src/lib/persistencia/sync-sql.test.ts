import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

// Postgres WASM efêmero, sem URL, credencial ou rede. DDL real das migrations locais.
let db: PGlite;
const user = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
let seq = 0;
function args(tipo: string, payload: unknown, operationId = crypto.randomUUID(), preparado: unknown = null, hash = 'a'.repeat(64)) {
  return [user, 'sintetico@example.invalid', operationId, hash, tipo, JSON.stringify(payload), preparado == null ? null : JSON.stringify(preparado), null];
}
async function executar(a: unknown[]) {
  const r = await db.query<{ r: Record<string, unknown> }>('select public.executar_comando_sync_v2($1,$2,$3,$4,$5,$6,$7,$8) r', a);
  return r.rows[0]!.r;
}
const agregado = (tempo: number, id: string) => ({
  perfilLinha: { sexo: 'masculino', peso_kg: 80, altura_cm: 180, idade: 30, nivel_atividade: 'moderado', objetivo: 'massa' },
  entrada: { perfil: { tempoPorSessaoMin: tempo }, opcoes: {} }, dieta: {}, treino: {},
  armazenamento: { schemaVersion: 2, versoesTreino: { atual: { id, definicao: { tempoPorSessaoMin: tempo } } } },
});
const preparado = (p: unknown) => ({ agregado: p, formulaVersion: 'tempo-v1', canonicalInputHash: 'b'.repeat(64) });
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    insert into auth.users values ('${user}'), ('${userB}');`);
  for (const f of ['0001_init.sql', '0005_profile_email_preferencias.sql', '0009_eventos_telemetria.sql', '0015_c1_cas_metadata.sql', '0016_c1_persistencia_atomica.sql', '0018_aderencia_uma_linha_por_dia.sql', '0019_peso_um_por_dia.sql', '0021_sync_v2_candidata.sql']) {
    const sql = readFileSync(`supabase/migrations/${f}`, 'utf8').replace('create extension if not exists "pgcrypto";', '-- gen_random_uuid é nativo no PG local');
    await db.exec(sql);
  }
}, 30_000);
afterAll(async () => { await db?.close(); });
describe('transações SQL locais v2', () => {
  it('retry após ACK perdido e duplo clique não duplicam sessão nem feedback; ID diferente também deduplica a sessão', async () => {
    const sessao = { id: 'sessao-a', n: 1, dataISO: '2026-10-19', exercicios: [], feedback: { e1: 'facil' } };
    const a = args('SESSAO', { sessao });
    const primeiro = await executar(a);
    expect(primeiro.tipo).toBe('ACK');
    expect(await executar(a)).toEqual(primeiro);
    expect((await executar(args('SESSAO', { sessao }))).tipo).toBe('ACK');
    expect((await db.query<{ n: number }>("select count(*)::integer n from public.logs where tipo='treino' and payload->>'id'='sessao-a'")).rows[0]!.n).toBe(1);
    expect((await db.query<{ n: number }>("select count(*)::integer n from public.feedback where payload->>'sessaoId'='sessao-a'")).rows[0]!.n).toBe(1);
    expect((await executar(args('SESSAO', { sessao: { ...sessao, n: 99 } }))).tipo).toBe('CONFLITO');
    expect((await executar(args('SESSAO', { sessao }, a[2] as string, null, 'c'.repeat(64)))).motivo).toBe('operation_id_reutilizado');
  });
  it('falha no feedback desfaz sessão E recibo; retry pode completar', async () => {
    await db.exec("alter table public.feedback add constraint falha_teste check (payload->>'sessaoId' <> 'sessao-rollback')");
    const a = args('SESSAO', { sessao: { id: 'sessao-rollback', n: 2, dataISO: '2026-10-19', exercicios: [], feedback: { e1: 'facil' } } });
    await expect(executar(a)).rejects.toThrow();
    expect((await db.query<{ n: number }>("select count(*)::integer n from public.logs where payload->>'id'='sessao-rollback'")).rows[0]!.n).toBe(0);
    expect((await db.query<{ n: number }>('select count(*)::integer n from app_private.sync_recibos where operation_id=$1', [a[2]])).rows[0]!.n).toBe(0);
    await db.exec('alter table public.feedback drop constraint falha_teste');
    expect((await executar(a)).tipo).toBe('ACK');
  });
  it('peso conserva um por dia, repete igual e recusa outro valor sem sobrescrever', async () => {
    expect(await executar(args('PESO', { pesoKg: 80, dataISO: '2026-10-18' }))).toMatchObject({ tipo: 'ACK', estado: 'REGISTRADO' });
    expect(await executar(args('PESO', { pesoKg: 80, dataISO: '2026-10-18' }))).toMatchObject({ tipo: 'ACK', estado: 'IDEMPOTENTE' });
    expect(await executar(args('PESO', { pesoKg: 82, dataISO: '2026-10-18' }))).toMatchObject({ tipo: 'RECUSADO', pesoKg: 80 });
  });
  it('refeições independentes mesclam e a mesma refeição pede escolha', async () => {
    const base = { logs: {}, notes: {} };
    expect((await executar(args('ADERENCIA', { dia: '2026-10-19', logs: { cafe: 'seguiu' }, notes: {}, base }))).tipo).toBe('ACK');
    expect((await executar(args('ADERENCIA', { dia: '2026-10-19', logs: { almoco: 'comi' }, notes: {}, base }))).tipo).toBe('ACK');
    const r = await db.query<{ payload: { logs: unknown } }>("select payload from public.logs where tipo='refeicao'");
    expect(r.rows[0]!.payload.logs).toEqual({ cafe: 'seguiu', almoco: 'comi' });
    expect((await executar(args('ADERENCIA', { dia: '2026-10-19', logs: { cafe: 'fora' }, notes: {}, base }))).tipo).toBe('CONFLITO');
  });
  it('autosave no-op não gira plano nem cria snapshots; CAS e recibo são atômicos', async () => {
    const p = preparado(agregado(40, 'a'));
    const a = args('PERFIL', { expectedRevision: seq }, undefined, p);
    expect(await executar(a)).toMatchObject({ tipo: 'ACK', revision: ++seq });
    expect(await executar(a)).toMatchObject({ tipo: 'ACK', revision: seq });
    expect(await executar(args('PERFIL', { expectedRevision: seq }, undefined, p))).toMatchObject({ tipo: 'ACK', revision: seq, semMudanca: true });
    const b = args('APLICAR_TREINO', { expectedRevision: seq }, undefined, preparado(agregado(50, 'b')));
    expect(await executar(b)).toMatchObject({ tipo: 'ACK', revision: ++seq });
    expect(await executar(args('APLICAR_TREINO', { expectedRevision: seq - 1 }, undefined, preparado(agregado(60, 'c'))))).toMatchObject({ tipo: 'CONFLITO', revision: seq });
    expect((await db.query<{ n: number }>('select count(*)::integer n from public.plans')).rows[0]!.n).toBe(0);
  });
  it('rascunho com carga escolhida fica separado de sessões realizadas e tem CAS próprio', async () => {
    const antes = (await db.query<{ n: number }>("select count(*)::integer n from public.logs where tipo='treino'")).rows[0]!.n;
    const a = args('RASCUNHO_SESSAO', { id: 'ativa', expectedRevision: 0, estado: { sessaoId: 's', escolhidaKg: 26 } });
    expect(await executar(a)).toMatchObject({ tipo: 'ACK', revision: 1 });
    expect(await executar(a)).toMatchObject({ tipo: 'ACK', revision: 1 });
    expect((await executar(args('RASCUNHO_SESSAO', { id: 'ativa', expectedRevision: 0, estado: { escolhidaKg: 30 } }))).tipo).toBe('CONFLITO');
    expect((await db.query<{ n: number }>("select count(*)::integer n from public.logs where tipo='treino'")).rows[0]!.n).toBe(antes);
  });
  it('ACL não permite que browser execute RPC nem leia recibos; usuário removido não recebe ACK', async () => {
    await db.exec('set role authenticated');
    await expect(executar(args('PESO', { pesoKg: 80, dataISO: '2026-10-18' }))).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from app_private.sync_recibos')).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    const a = args('PESO', { pesoKg: 80, dataISO: '2026-10-18' }); a[0] = '33333333-3333-4333-8333-333333333333';
    await expect(executar(a)).rejects.toThrow(/identidade/);
  });
});
