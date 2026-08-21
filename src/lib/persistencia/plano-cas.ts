/**
 * 🔒 C1 — CAS na CAMADA DE APLICAÇÃO/REPOSITÓRIO (decisão do autor "Escolha A", 2026-08-21).
 *
 * O motor (`lib/engine/cas.ts`) é puro: produz o agregado, o `canonicalInputHash` e o comando de
 * commit, e DECIDE o pré-commit. Aqui vive o que tem efeito colateral: a troca atômica (o
 * compare-and-swap real) e a orquestração — carregar o snapshot atual, decidir, trocar, devolver
 * o RESULTADO DISCRIMINADO. Nenhum I/O voltou para o motor por causa disto.
 *
 * ✅ PERSISTÊNCIA REAL (decisão do autor "CAS PERSISTENTE", 2026-08-21):
 *   - migração ADITIVA `supabase/migrations/0015_c1_cas_metadata.sql` cria a tabela própria
 *     `public.plano_cas` (aggregate_id, revision, formula_version, canonical_input_hash, payload)
 *     com RLS por dono e a RPC atômica `commit_plano_cas` (`UPDATE ... WHERE revision=:expected`,
 *     zero linhas ⇒ CONFLITO_REVISAO, nunca sucesso). Tabela SEPARADA de `public.plans` de
 *     propósito: não toca a semântica de planos antigos (B1.14 fora do C1) — legado simplesmente
 *     não tem linha aqui e o primeiro uso do C1 recompõe e grava.
 *   - adaptador real: `RepositorioSupabasePlanoCAS` (`plano-cas-supabase.ts`) implementa esta porta.
 *   - atomicidade provada contra Postgres REAL: `supabase/tests/cas_atomicidade.sql` via
 *     `supabase/tests/run-cas-test.sh` (7→8, CONFLITO_REVISAO, retry recompute 8→9, tudo-ou-nada).
 *   O `RepositorioMemoria` abaixo segue como referência de semântica e alvo dos testes de unidade.
 */
import {
  decidirPreCommit,
  type ComandoCommit,
  type ResultadoCommit,
  type SnapshotAtual,
} from '@/lib/engine/cas';

/**
 * PORTA do repositório de agregado com concorrência otimista. O adaptador real (Supabase) e o de
 * memória (testes) implementam isto. `commitAtomico` é a TROCA ATÔMICA — a garantia final da corrida.
 */
export interface RepositorioPlanoCAS<A = unknown> {
  /** Snapshot atual do agregado (revisão + versão + hash). Ausente ⇒ nunca gravado (revisão 0). */
  carregarSnapshot(aggregateId: string): Promise<SnapshotAtual | null>;
  /**
   * Troca ATÔMICA: só confirma se a revisão atual ainda for `expectedRevision`. Devolve
   * COMMIT_CONFIRMADO (revisão+1), CONFLITO_REVISAO (perdeu a corrida entre ler e trocar) ou
   * FALHA_ATOMICA (o UPDATE não foi atômico / erro de infra). NÃO revalida versão/hash — isso é da
   * pré-decisão pura; aqui é só o `where revision=:expected`.
   */
  commitAtomico(comando: ComandoCommit<A>): Promise<ResultadoCommit<A>>;
}

/**
 * 🔒 Serviço de aplicação: orquestra o CAS. Carrega o snapshot atual, roda a DECISÃO PURA do motor
 * (precedência versão/hash → revisão), e só então dispara a troca atômica. Em conflito, NÃO
 * persiste nada e devolve o resultado discriminado — o chamador é quem recarrega e RECOMPUTA (nunca
 * reaplicar agregado obsoleto; nunca entregar resultado obsoleto como certificado).
 */
export async function persistirPlanoComCAS<A>(
  repo: RepositorioPlanoCAS<A>,
  comando: ComandoCommit<A>,
  formulaVersionVigente: string,
): Promise<ResultadoCommit<A>> {
  const atual = await repo.carregarSnapshot(comando.aggregateId);
  const pre = decidirPreCommit(atual, comando, formulaVersionVigente);
  if (pre.tipo !== 'PROSSEGUIR') return pre; // conflito terminal na pré-decisão: nada é persistido
  return repo.commitAtomico(comando); // troca atômica (pode ainda dar CONFLITO_REVISAO/FALHA_ATOMICA)
}

/**
 * Adaptador EM MEMÓRIA — referência da semântica e alvo dos testes. Como o JS é single-threaded, o
 * `commitAtomico` é trivialmente atômico: lê a revisão e confirma na MESMA volta do event loop.
 * `falharProxima` injeta uma FALHA_ATOMICA para exercitar esse ramo.
 */
export class RepositorioMemoria<A = unknown> implements RepositorioPlanoCAS<A> {
  private linhas = new Map<string, { revision: number; formulaVersion: string; canonicalInputHash: string; aggregate: A }>();
  private falharProxima = false;

  constructor(seed?: { aggregateId: string; revision: number; formulaVersion: string; canonicalInputHash: string; aggregate: A }) {
    if (seed) this.linhas.set(seed.aggregateId, { revision: seed.revision, formulaVersion: seed.formulaVersion, canonicalInputHash: seed.canonicalInputHash, aggregate: seed.aggregate });
  }

  /** Injeta uma FALHA_ATOMICA na próxima troca (teste do 4º estado). */
  programarFalhaAtomica(): void {
    this.falharProxima = true;
  }

  async carregarSnapshot(aggregateId: string): Promise<SnapshotAtual | null> {
    const l = this.linhas.get(aggregateId);
    return l ? { revision: l.revision, formulaVersion: l.formulaVersion, canonicalInputHash: l.canonicalInputHash } : null;
  }

  async commitAtomico(comando: ComandoCommit<A>): Promise<ResultadoCommit<A>> {
    if (this.falharProxima) {
      this.falharProxima = false;
      return { tipo: 'FALHA_ATOMICA', detalhe: 'infra: troca não confirmada (0 linhas por erro, não por revisão)' };
    }
    const atualRev = this.linhas.get(comando.aggregateId)?.revision ?? 0;
    // 🔒 a garantia final: só confirma se a revisão AINDA é a esperada (o `where revision=:expected`).
    if (atualRev !== comando.expectedRevision) {
      return { tipo: 'CONFLITO_REVISAO', revisaoEsperada: comando.expectedRevision, revisaoAtual: atualRev };
    }
    const revision = comando.expectedRevision + 1;
    this.linhas.set(comando.aggregateId, {
      revision,
      formulaVersion: comando.formulaVersion,
      canonicalInputHash: comando.canonicalInputHash,
      aggregate: comando.aggregate,
    });
    return {
      tipo: 'COMMIT_CONFIRMADO',
      aggregateId: comando.aggregateId,
      revision,
      formulaVersion: comando.formulaVersion,
      canonicalInputHash: comando.canonicalInputHash,
      aggregate: comando.aggregate,
    };
  }
}
