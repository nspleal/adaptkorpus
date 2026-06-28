/**
 * Tipos do banco de dados curado (espelham o schema do Supabase e o banco do cofre).
 * Fonte: fontes/banco-alimentos-evokorpus (125 alimentos TACO + 56 pratos, Δ=0).
 *
 * Estrutura RELACIONAL: foods → recipes → recipe_items (join).
 * kcal/macros de um prato = SOMA dos ingredientes (TACO × gramas), nunca por 4/4/9.
 */

export type GrupoAlimentar =
  | 'proteina_animal'
  | 'leguminosa_proteina_vegetal'
  | 'verdura_legume'
  | 'fruta'
  | 'grao_cereal_tuberculo'
  | 'gordura'
  | 'laticinio';

/** Alérgenos/restrições rastreados (base do filtro absoluto da substituição). */
export type Alergeno =
  | 'origem_animal'
  | 'gluten'
  | 'lactose'
  | 'ovo'
  | 'amendoim'
  | 'castanhas'
  | 'gergelim'
  | 'coco'
  | 'soja'
  | 'peixe_frutos_do_mar';

export type Refeicao = 'cafe' | 'almoco' | 'jantar' | 'lanche';
export type TipoPrato = 'vegano' | 'vegetariano' | 'onivoro';

/** Alimento (ingrediente único) — valores REAIS da TACO por 100 g. */
export interface Food {
  id: string;
  nome: string;
  /** Nº de referência na TACO 4ª ed. (proveniência). */
  fonteTaco?: number;
  grupo: GrupoAlimentar;
  kcalPor100g: number;
  proteinaPor100g: number;
  carboidratoPor100g: number;
  gorduraPor100g: number;
  fibraPor100g?: number;
  medidaCaseira?: string;
  gramasDaMedida?: number;
  alergenos: Alergeno[];
}

/** Item da receita (join prato ↔ alimento). */
export interface RecipeItem {
  alimentoId: string;
  gramas: number;
}

/**
 * Prato (combinação de alimentos). kcal/macros derivam dos ingredientes.
 * `contemAlergenos` é a UNIÃO dos alérgenos dos ingredientes (desnormalizado p/ filtro rápido).
 */
export interface Recipe {
  id: string;
  nome: string;
  refeicao: Refeicao;
  tipo: TipoPrato;
  itens: RecipeItem[];
  contemAlergenos: Alergeno[];
}

/** Totais nutricionais computados de um prato. */
export interface RecipeMacros {
  kcal: number;
  proteinaG: number;
  carboidratoG: number;
  gorduraG: number;
}
