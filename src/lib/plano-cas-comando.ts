/**
 * 🔒 C1 — CONSTRUTOR do comando de commit do plano (parte PURA do CAS, decisão do autor).
 *
 * O motor produz o AGREGADO (dieta+treino, via `recomputarPlano` determinístico), o
 * `canonicalInputHash` (do INPUT que o gerou) e o COMANDO DE COMMIT. Nada aqui tem I/O — é a peça
 * que a rota/servidor entrega ao serviço de aplicação (`lib/persistencia/plano-cas.ts`) para a
 * troca atômica. `formulaVersion` = `FORMULA_DURACAO_VERSION`: é a versão que governa a semântica
 * temporal OBSERVÁVEL do plano (hold, lateralidade, técnica, estados, cardio).
 */
import { canonicalInputHash, FORMULA_DURACAO_VERSION, type ComandoCommit } from '@/lib/engine';
import { recomputarPlano } from '@/lib/plano';
import type { ResultadoMotor, ResultadoTreino } from '@/lib/engine';
import type { PerfilResumo } from '@/components/painel/Painel';

/** O agregado do plano: o par determinístico que a rota persiste. */
export interface AgregadoPlano {
  dieta: ResultadoMotor;
  treino: ResultadoTreino;
}

/** Identidade estável do agregado por usuário (uma linha de plano por conta). */
export function aggregateIdDePlano(userId: string): string {
  return `${userId}:plano`;
}

/**
 * 🔒 Monta o comando de commit a partir do perfil e da revisão que o escritor LEU. Puro e
 * determinístico: o `canonicalInputHash` é do INPUT (perfil), e o agregado é `recomputarPlano` do
 * MESMO input — hash e agregado são consistentes por construção (nunca um certificado órfão).
 */
export function comandoCommitDePlano(
  userId: string,
  perfil: PerfilResumo,
  expectedRevision: number,
): ComandoCommit<AgregadoPlano> {
  const { dieta, treino } = recomputarPlano(perfil);
  return {
    aggregateId: aggregateIdDePlano(userId),
    expectedRevision,
    formulaVersion: FORMULA_DURACAO_VERSION,
    // O input canônico é o perfil (fonte única do plano). Determinístico, chaves ordenadas.
    canonicalInputHash: canonicalInputHash(perfil),
    aggregate: { dieta, treino },
  };
}
