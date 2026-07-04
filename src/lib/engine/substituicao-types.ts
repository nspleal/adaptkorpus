/**
 * Tipos do motor de SUBSTITUIÇÃO (F.2).
 * Fonte: conceitos/parametros-motor-substituicao-evokorpus (DFs travadas 2026-06-29).
 * É um SELETOR sobre planos já gerados: filtros duros → preferência → desempate
 * determinístico → fallback. Segurança e identidade nunca relaxam; só o gosto cede.
 */
import type {
  Alergeno,
  EquipamentoCasa,
  EquipamentoDisp,
  Exercise,
  Food,
  Recipe,
  RecipeMacros,
  Refeicao,
} from '../data/types';
import type { PlanoDieta } from './types';
import type { NivelExperiencia } from './treino-types';

export type StatusSub = 'ok' | 'sinalizado';

// --- Alimentos (troca prato ↔ prato, mesmo slot) ---------------------------

export interface RestricoesSub {
  /** Alérgenos — filtro absoluto. */
  alergenos: Alergeno[];
  /** Identidade alimentar — absoluta por default (relaxável só por flag dormente; v1 = absoluta). */
  preferencia?: 'vegano' | 'vegetariano' | null;
}

/** Gosto (relaxável): "não gosto de X" / "cansei de Y". */
export interface GostoAlimento {
  /** Pratos a evitar (ex.: "cansei de Y" persistente). */
  excluirPratoIds?: string[];
  /** Alimentos a evitar → exclui pratos que os contêm. */
  excluirAlimentoIds?: string[];
}

export interface PedidoSubPrato {
  pratoAtual: Recipe;
  slot: Refeicao;
  recipes: readonly Recipe[];
  foodsById: ReadonlyMap<string, Food>;
  /** Plano de dieta (janela do dia + piso de proteína do dia em macros.proteinaPisoG). */
  plano: PlanoDieta;
  /** Totais do dia ATUAL (somando o pratoAtual JÁ escalado). */
  totaisDiaAtual: RecipeMacros;
  /** Escala do pratoAtual no cardápio (1 = porção-base). Default 1. */
  escalaAtual?: number;
  restricoes: RestricoesSub;
  gosto?: GostoAlimento;
}

export interface ResultadoSubPrato {
  status: StatusSub;
  prato: Recipe | null;
  /** Escala aplicada ao prato novo (equivalência calórica com o trocado). null se sinalizado. */
  escala: number | null;
  /** Macros do prato novo JÁ escaladas (null se sinalizado). */
  macrosNovo: RecipeMacros | null;
  /** Totais do dia DEPOIS da troca (null se sinalizado). */
  totaisDiaNovo: RecipeMacros | null;
  /** true se foi preciso relaxar o gosto (fallback). */
  gostoRelaxado: boolean;
  nota?: string;
}

// --- Exercícios ------------------------------------------------------------

export interface PedidoSubExercicio {
  exercicioAtual: Exercise;
  equipamento: EquipamentoDisp;
  /** Checklist de equipamento de CASA (modelo 2 níveis, DF 2026-07-04); ausente = legado. */
  equipamentosCasa?: readonly EquipamentoCasa[];
  nivelExperiencia: NivelExperiencia;
  exercises: readonly Exercise[];
  /** Variedade: ids recentes do mesmo padrão/grupo a evitar (relaxável). */
  historicoRecenteIds?: string[];
  /** "Cansei de X" → ids a excluir (gosto, relaxável). */
  gostoExcluirIds?: string[];
}

export interface ResultadoSubExercicio {
  status: StatusSub;
  exercicio: Exercise | null;
  /** true se foi preciso relaxar gosto/variedade (fallback). */
  gostoRelaxado: boolean;
  nota?: string;
}
