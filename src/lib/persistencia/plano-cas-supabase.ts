/**
 * 🔒 C1 — ADAPTADOR SUPABASE REAL do CAS (decisão do autor "CAS PERSISTENTE", 2026-08-21).
 *
 * Conecta a PORTA `RepositorioPlanoCAS` (definida em `plano-cas.ts`, exercida em memória nos
 * testes) ao Supabase real. A TROCA ATÔMICA é a RPC `commit_plano_cas` (migração 0015): um UPDATE
 * condicional `WHERE aggregate_id = :id AND revision = :expected` — zero linhas ⇒ CONFLITO_REVISAO,
 * nunca sucesso. Nenhum I/O voltou para o motor puro (`src/lib/engine`): este arquivo é a camada
 * de persistência, e o serviço de aplicação (`persistirPlanoComCAS`) faz a pré-decisão pura
 * (versão/hash) ANTES de chamar a troca — então versão obsoleta nem toca o banco.
 *
 * O adaptador é injetado com um cliente Supabase (server ou admin); assim é testável e não amarra
 * a origem do cliente. `formula_version` e `canonical_input_hash` viajam para a RPC porque o
 * agregado novo/recomputado os carrega válidos antes do commit (nunca um certificado órfão).
 */
import type { ComandoCommit, ResultadoCommit, SnapshotAtual } from '@/lib/engine';
import type { RepositorioPlanoCAS } from './plano-cas';

/** Superfície MÍNIMA do cliente Supabase que o adaptador usa (facilita teste/injeção). */
export interface ClienteSupabaseCAS {
  from(tabela: string): {
    select(cols: string): {
      eq(coluna: string, valor: string): {
        maybeSingle(): Promise<{ data: { revision: number; formula_version: string; canonical_input_hash: string } | null; error: { message: string } | null }>;
      };
    };
  };
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * 🔒 Repositório CAS respaldado no Supabase. `commitAtomico` NÃO revalida versão/hash (isso é da
 * pré-decisão pura); aqui é só o `WHERE revision = :expected`, a garantia final da corrida.
 */
export class RepositorioSupabasePlanoCAS<A = unknown> implements RepositorioPlanoCAS<A> {
  constructor(
    private readonly cliente: ClienteSupabaseCAS,
    /** Dono do agregado, derivado pela rota a partir da sessão autenticada. */
    private readonly userId: string,
    /** Espelho para profile.email; não entra no agregado nem no certificado do plano. */
    private readonly emailAutenticado: string | null = null,
  ) {}

  async carregarSnapshot(aggregateId: string): Promise<SnapshotAtual | null> {
    const { data, error } = await this.cliente
      .from('plano_cas')
      .select('revision, formula_version, canonical_input_hash')
      .eq('aggregate_id', aggregateId)
      .maybeSingle();
    if (error) throw new Error(`[cas-supabase] carregarSnapshot: ${error.message}`);
    if (!data) return null; // agregado inexistente ⇒ revisão 0 (nunca gravado).
    return { revision: data.revision, formulaVersion: data.formula_version, canonicalInputHash: data.canonical_input_hash };
  }

  async commitAtomico(comando: ComandoCommit<A>): Promise<ResultadoCommit<A>> {
    const { data, error } = await this.cliente.rpc('commit_plano_cas', {
      p_aggregate_id: comando.aggregateId,
      p_user_id: this.userId,
      p_email: this.emailAutenticado,
      p_expected_revision: comando.expectedRevision,
      p_formula_version: comando.formulaVersion,
      p_canonical_input_hash: comando.canonicalInputHash,
      p_payload: comando.aggregate,
    });
    // Falha de infra (rede, permissão, deadlock) ⇒ FALHA_ATOMICA: nada foi persistido parcialmente.
    if (error) return { tipo: 'FALHA_ATOMICA', detalhe: `rpc commit_plano_cas: ${error.message}` };
    return interpretarResultadoRpc<A>(comando, data);
  }
}

/** Traduz o jsonb discriminado da RPC no `ResultadoCommit` do motor. Fail-safe: desconhecido ⇒ falha. */
export function interpretarResultadoRpc<A>(comando: ComandoCommit<A>, data: unknown): ResultadoCommit<A> {
  if (data == null || typeof data !== 'object') {
    return { tipo: 'FALHA_ATOMICA', detalhe: 'rpc retornou payload vazio/inesperado' };
  }
  const r = data as Record<string, unknown>;
  if (r.tipo === 'COMMIT_CONFIRMADO' && typeof r.committed_revision === 'number') {
    return {
      tipo: 'COMMIT_CONFIRMADO',
      aggregateId: comando.aggregateId,
      revision: r.committed_revision,
      formulaVersion: comando.formulaVersion,
      canonicalInputHash: comando.canonicalInputHash,
      aggregate: comando.aggregate,
    };
  }
  if (r.tipo === 'CONFLITO_REVISAO') {
    return {
      tipo: 'CONFLITO_REVISAO',
      revisaoEsperada: comando.expectedRevision,
      revisaoAtual: typeof r.actual_revision === 'number' ? r.actual_revision : -1,
    };
  }
  // 🔒 zero linhas / estado desconhecido NUNCA vira sucesso.
  return { tipo: 'FALHA_ATOMICA', detalhe: `rpc retornou tipo inesperado: ${String(r.tipo)}` };
}
