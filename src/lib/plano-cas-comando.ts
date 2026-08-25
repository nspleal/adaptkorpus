/**
 * 🔒 C1 — CONSTRUTOR do comando de commit do plano (parte PURA do CAS, decisão do autor).
 *
 * O motor produz o AGREGADO (dieta+treino, via `recomputarPlano` determinístico), o
 * `canonicalInputHash` (do INPUT que o gerou) e o COMANDO DE COMMIT. Nada aqui tem I/O — é a peça
 * que a rota/servidor entrega ao serviço de aplicação (`lib/persistencia/plano-cas.ts`) para a
 * troca atômica. `formulaVersion` = `FORMULA_DURACAO_VERSION`: é a versão que governa a semântica
 * temporal OBSERVÁVEL do plano (hold, lateralidade, técnica, estados, cardio).
 */
import { canonicalInputHash, FORMULA_DURACAO_VERSION, type ComandoCommit, type OpcoesSemana } from '@/lib/engine';
import { recomputarPlano } from '@/lib/plano';
import type { ResultadoMotor, ResultadoTreino } from '@/lib/engine';
import type { ExecucaoLateralidade, GrupoPrimario } from '@/lib/data/types';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { ProfileRow } from '@/lib/persistencia/perfil-profile';
import { perfilParaLinha } from '@/lib/persistencia/perfil-profile';
import { ORDEM_SEMANA, type Weekday } from '@/lib/semana';
import type { FeedbackGrupo, SemanaCiclo } from '@/lib/engine/treino-types';

/** O agregado do plano: o par determinístico que a rota persiste. */
/**
 * Entrada serializável do plano EXIBIDO. Não é preferência nova: congela apenas os valores
 * transitórios que participaram desta geração, para que hash, agregado salvo e tela possam
 * apontar para o mesmo plano.
 */
export interface EntradaPlanoVisivel {
  pesoEfetivoKg: number;
  diasOferecidosCardio: Weekday[];
  semanaCiclo: {
    semana: SemanaCiclo;
    feedbackGrupos: Array<[GrupoPrimario, FeedbackGrupo]>;
    retomada?: {
      semana: number;
      fator: number;
      volumeReferencia: number;
      exerciciosRecentes: string[];
    };
  };
  escolhasExecucao: Array<[string, ExecucaoLateralidade]>;
}

/** Agregado atômico: perfil a gravar + entrada certificada + os dois planos visíveis. */
export interface AgregadoPlano {
  perfilLinha: ProfileRow & Partial<{
    aceite_18: boolean;
    aceite_termos: boolean;
    aceite_lgpd: boolean;
    aceite_em: string;
  }>;
  entrada: {
    perfil: PerfilResumo;
    opcoes: EntradaPlanoVisivel;
  };
  dieta: ResultadoMotor;
  treino: ResultadoTreino;
}

/** Identidade estável do agregado por usuário (uma linha de plano por conta). */
export function aggregateIdDePlano(userId: string): string {
  return `${userId}:plano`;
}

/** Converte as estruturas de runtime (Map/Set) para a forma canônica que viaja pela rede. */
export function normalizarEntradaPlanoVisivel(
  perfil: PerfilResumo,
  entrada?: Partial<EntradaPlanoVisivel>,
): EntradaPlanoVisivel {
  const recebidos = new Set((entrada?.diasOferecidosCardio ?? []).filter((d): d is Weekday =>
    (ORDEM_SEMANA as readonly string[]).includes(d)));
  const feedbackPorGrupo = new Map<GrupoPrimario, FeedbackGrupo>();
  for (const par of entrada?.semanaCiclo?.feedbackGrupos ?? []) {
    if (Array.isArray(par) && typeof par[0] === 'string' && (par[1] === 'ok' || par[1] === 'segura')) {
      feedbackPorGrupo.set(par[0] as GrupoPrimario, par[1]);
    }
  }
  const feedback = [...feedbackPorGrupo.entries()].sort(([a], [b]) => a.localeCompare(b));
  const escolhaPorExercicio = new Map<string, ExecucaoLateralidade>();
  for (const par of entrada?.escolhasExecucao ?? []) {
    if (Array.isArray(par) && typeof par[0] === 'string' && typeof par[1] === 'string') {
      escolhaPorExercicio.set(par[0], par[1] as ExecucaoLateralidade);
    }
  }
  const escolhas = [...escolhaPorExercicio.entries()].sort(([a], [b]) => a.localeCompare(b));
  const retomada = entrada?.semanaCiclo?.retomada;
  return {
    pesoEfetivoKg: Number.isFinite(entrada?.pesoEfetivoKg) ? Number(entrada!.pesoEfetivoKg) : perfil.pesoKg,
    diasOferecidosCardio: ORDEM_SEMANA.filter((dia) => recebidos.has(dia)),
    semanaCiclo: {
      semana: entrada?.semanaCiclo?.semana ?? 1,
      feedbackGrupos: feedback,
      ...(retomada
        ? {
            retomada: {
              semana: retomada.semana,
              fator: retomada.fator,
              volumeReferencia: retomada.volumeReferencia,
              exerciciosRecentes: [...new Set(retomada.exerciciosRecentes ?? [])].sort(),
            },
          }
        : {}),
    },
    escolhasExecucao: escolhas,
  };
}

/** Reconstrói as coleções que o motor puro usa, sem deixar Map/Set escapar para o hash. */
export function opcoesDeEntradaPlano(entrada: EntradaPlanoVisivel): {
  pesoEfetivoKg: number;
  diasOferecidosCardio: Weekday[];
  semanaCiclo: OpcoesSemana;
  escolhasExecucao: ReadonlyMap<string, ExecucaoLateralidade>;
} {
  const semanaCiclo: OpcoesSemana = {
    semana: entrada.semanaCiclo.semana,
    ...(entrada.semanaCiclo.feedbackGrupos.length > 0
      ? { feedbackGrupos: new Map(entrada.semanaCiclo.feedbackGrupos) }
      : {}),
    ...(entrada.semanaCiclo.retomada
      ? {
          retomada: {
            ...entrada.semanaCiclo.retomada,
            exerciciosRecentes: new Set(entrada.semanaCiclo.retomada.exerciciosRecentes),
          },
        }
      : {}),
  };
  return {
    pesoEfetivoKg: entrada.pesoEfetivoKg,
    diasOferecidosCardio: entrada.diasOferecidosCardio,
    semanaCiclo,
    escolhasExecucao: new Map(entrada.escolhasExecucao),
  };
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
  entrada?: Partial<EntradaPlanoVisivel>,
  perfilLinha: ProfileRow & Partial<{
    aceite_18: boolean;
    aceite_termos: boolean;
    aceite_lgpd: boolean;
    aceite_em: string;
  }> = perfilParaLinha(perfil),
): ComandoCommit<AgregadoPlano> {
  const opcoesNormalizadas = normalizarEntradaPlanoVisivel(perfil, entrada);
  const { dieta, treino } = recomputarPlano(perfil, opcoesDeEntradaPlano(opcoesNormalizadas));
  return {
    aggregateId: aggregateIdDePlano(userId),
    expectedRevision,
    formulaVersion: FORMULA_DURACAO_VERSION,
    // Perfil + todas as entradas transitórias que a tela aplicou: nunca certifica outro plano.
    canonicalInputHash: canonicalInputHash({ perfil, opcoes: opcoesNormalizadas }),
    aggregate: {
      perfilLinha,
      entrada: { perfil, opcoes: opcoesNormalizadas },
      dieta,
      treino,
    },
  };
}
