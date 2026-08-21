/**
 * 🔒 C1 — CAS na CAMADA DE APLICAÇÃO/REPOSITÓRIO (decisão do autor "Escolha A", 2026-08-21).
 *
 * O motor (`lib/engine/cas.ts`) é puro: produz o agregado, o `canonicalInputHash` e o comando de
 * commit, e DECIDE o pré-commit. Aqui vive o que tem efeito colateral: a troca atômica (o
 * compare-and-swap real) e a orquestração — carregar o snapshot atual, decidir, trocar, devolver
 * o RESULTADO DISCRIMINADO. Nenhum I/O voltou para o motor por causa disto.
 *
 * ⚠️ FRONTEIRA DE PERSISTÊNCIA — O QUE FALTA NO BANCO (reporte honesto, não contornado):
 *   A tabela `public.plans` (migração 0001) hoje é { id, user_id, created_at, tipo, payload, ativo }
 *   — SEM as colunas de concorrência otimista. Para o adaptador Supabase real fazer o CAS atômico,
 *   a estrutura MÍNIMA necessária (nova migração, fora desta sessão — não se escreve no cofre nem se
 *   mexe na migração de planos antigos por causa do CAS) é uma linha de AGREGADO por usuário:
 *
 *     alter table public.plans
 *       add column revision            integer      not null default 0,
 *       add column formula_version     text,
 *       add column canonical_input_hash text,
 *       add column aggregate_id        text;         -- ex.: `${user_id}:plano`
 *     create unique index plans_aggregate_rev on public.plans (aggregate_id);
 *
 *   O UPDATE condicional do adaptador (a troca atômica) é, em uma linha:
 *     update public.plans set payload=:agg, revision=revision+1, formula_version=:fv,
 *            canonical_input_hash=:hash
 *      where aggregate_id=:aid and revision=:expected;   -- 0 linhas ⇒ CONFLITO_REVISAO
 *   (RLS por `user_id` já protege o acesso; a atomicidade vem do `where revision=:expected`.)
 *
 *   Enquanto essas colunas não existirem, o `RepositorioSupabasePlanoCAS` NÃO é instanciável (só o
 *   `RepositorioMemoria`, exercitado nos testes, prova a semântica). O snapshot best-effort atual da
 *   rota `PUT /api/dados/perfil` (insert de dieta+treino) segue como está — o CAS não altera UI nem
 *   migração de planos antigos.
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
