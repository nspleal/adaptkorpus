/**
 * 🔒 C1 — adaptador Supabase REAL do CAS: mapeamento da RPC + garantia de que conflito de
 * pré-decisão (versão/hash) NÃO toca o banco (sem persistência parcial). A atomicidade da troca em
 * si é provada contra Postgres REAL em `supabase/tests/cas_atomicidade.sql` (runner run-cas-test.sh).
 */
import { describe, expect, it } from 'vitest';
import { RepositorioSupabasePlanoCAS, interpretarResultadoRpc, type ClienteSupabaseCAS } from './plano-cas-supabase';
import { persistirPlanoComCAS } from './plano-cas';
import type { ComandoCommit } from '@/lib/engine';

const USER = '00000000-0000-0000-0000-000000000001';
const AGG = `${USER}:plano`;

/** Cliente Supabase FALSO, programável e que REGISTRA chamadas (para provar "não tocou o banco"). */
class FakeCliente implements ClienteSupabaseCAS {
  rpcCalls: Record<string, unknown>[] = [];
  snapshot: { revision: number; formula_version: string; canonical_input_hash: string } | null = null;
  proximoRpc: { data: unknown; error: { message: string } | null } = { data: null, error: null };
  from(_tabela: string) {
    const self = this;
    return {
      select(_cols: string) {
        return {
          eq(_c: string, _v: string) {
            return { async maybeSingle() { return { data: self.snapshot, error: null }; } };
          },
        };
      },
    };
  }
  async rpc(_fn: string, args: Record<string, unknown>) {
    this.rpcCalls.push(args);
    return this.proximoRpc;
  }
}

const comando = (over: Partial<ComandoCommit<{ n: number }>> = {}): ComandoCommit<{ n: number }> => ({
  aggregateId: AGG,
  expectedRevision: 0,
  formulaVersion: 'tempo-v1',
  canonicalInputHash: '00000000abcdef01',
  aggregate: { n: 1 },
  ...over,
});

describe('C1 CAS Supabase · mapeamento da RPC', () => {
  it('COMMIT_CONFIRMADO da RPC vira ResultadoCommit com a revisão confirmada', () => {
    const r = interpretarResultadoRpc(comando(), { tipo: 'COMMIT_CONFIRMADO', committed_revision: 1 });
    expect(r.tipo).toBe('COMMIT_CONFIRMADO');
    expect(r.tipo === 'COMMIT_CONFIRMADO' && r.revision).toBe(1);
  });
  it('CONFLITO_REVISAO da RPC preserva expected/actual', () => {
    const r = interpretarResultadoRpc(comando({ expectedRevision: 7 }), { tipo: 'CONFLITO_REVISAO', expected_revision: 7, actual_revision: 8 });
    expect(r.tipo).toBe('CONFLITO_REVISAO');
    expect(r.tipo === 'CONFLITO_REVISAO' && r.revisaoAtual).toBe(8);
  });
  it('🔒 payload vazio / tipo desconhecido NUNCA vira sucesso ⇒ FALHA_ATOMICA', () => {
    expect(interpretarResultadoRpc(comando(), null).tipo).toBe('FALHA_ATOMICA');
    expect(interpretarResultadoRpc(comando(), { tipo: 'QUALQUER' }).tipo).toBe('FALHA_ATOMICA');
  });
});

describe('C1 CAS Supabase · adaptador contra cliente injetado', () => {
  it('carregarSnapshot mapeia a linha do banco (ou null se inexistente = legado)', async () => {
    const fake = new FakeCliente();
    const repo = new RepositorioSupabasePlanoCAS(fake, USER);
    expect(await repo.carregarSnapshot(AGG)).toBeNull(); // legado: sem linha
    fake.snapshot = { revision: 8, formula_version: 'tempo-v1', canonical_input_hash: '00000000abcdef07' };
    expect(await repo.carregarSnapshot(AGG)).toEqual({ revision: 8, formulaVersion: 'tempo-v1', canonicalInputHash: '00000000abcdef07' });
  });

  it('commitAtomico repassa o comando à RPC e mapeia COMMIT_CONFIRMADO', async () => {
    const fake = new FakeCliente();
    fake.proximoRpc = { data: { tipo: 'COMMIT_CONFIRMADO', committed_revision: 1 }, error: null };
    const repo = new RepositorioSupabasePlanoCAS(fake, USER);
    const r = await repo.commitAtomico(comando());
    expect(r.tipo).toBe('COMMIT_CONFIRMADO');
    expect(fake.rpcCalls[0]).toMatchObject({ p_aggregate_id: AGG, p_user_id: USER, p_expected_revision: 0 });
  });

  it('erro de infra da RPC ⇒ FALHA_ATOMICA (nada persistido parcialmente)', async () => {
    const fake = new FakeCliente();
    fake.proximoRpc = { data: null, error: { message: 'deadlock detected' } };
    const repo = new RepositorioSupabasePlanoCAS(fake, USER);
    expect((await repo.commitAtomico(comando())).tipo).toBe('FALHA_ATOMICA');
  });
});

describe('C1 CAS Supabase · pré-decisão pura NÃO toca o banco (fixture 52 / autor)', () => {
  it('conflito de formula_version ⇒ CONFLITO_VERSAO_OU_HASH sem chamar a RPC (zero persistência)', async () => {
    const fake = new FakeCliente();
    const repo = new RepositorioSupabasePlanoCAS(fake, USER);
    // agregado produzido por versão OBSOLETA; vigente = tempo-v1.
    const r = await persistirPlanoComCAS(repo, comando({ formulaVersion: 'tempo-v0' }), 'tempo-v1');
    expect(r.tipo).toBe('CONFLITO_VERSAO_OU_HASH');
    expect(fake.rpcCalls).toHaveLength(0); // o banco NUNCA foi tocado.
  });

  it('hash canônico malformado ⇒ CONFLITO_VERSAO_OU_HASH sem chamar a RPC', async () => {
    const fake = new FakeCliente();
    const repo = new RepositorioSupabasePlanoCAS(fake, USER);
    const r = await persistirPlanoComCAS(repo, comando({ canonicalInputHash: 'xyz' }), 'tempo-v1');
    expect(r.tipo).toBe('CONFLITO_VERSAO_OU_HASH');
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it('CONFLITO_REVISAO na pré-decisão (snapshot já em 8, expected 7) não commita', async () => {
    const fake = new FakeCliente();
    fake.snapshot = { revision: 8, formula_version: 'tempo-v1', canonical_input_hash: '00000000abcdef07' };
    const repo = new RepositorioSupabasePlanoCAS(fake, USER);
    const r = await persistirPlanoComCAS(repo, comando({ expectedRevision: 7 }), 'tempo-v1');
    expect(r.tipo).toBe('CONFLITO_REVISAO');
    expect(fake.rpcCalls).toHaveLength(0);
  });
});
