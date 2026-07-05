/**
 * Tipos do banco de dados curado (espelham o schema do Supabase e o banco do cofre).
 * Fonte: fontes/banco-alimentos-evokorpus (V2 limpa: 167 alimentos TACO + 96 pratos, Δ=0)
 *        fontes/ranking-exercicios-evokorpus (163 exercícios).
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
  | 'carne'
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
  /** Nome clínico da TACO (proveniência/atribuição — não exibir ao usuário). */
  nome: string;
  /**
   * Rótulo amigável — vocabulário OFICIAL do cofre (voz de marca; DF 2026-07-01,
   * conceitos/rotulos-amigaveis-alimentos-evokorpus). É o nome que o usuário lê
   * (autocomplete, detalhe de prato, lista de compras). Opcional no TIPO (fixtures de
   * teste do motor não precisam dele); no SEED real é 100% preenchido e único —
   * imposto por data.test.ts. Exibição: `rotuloAmigavel ?? nome`.
   */
  rotuloAmigavel?: string;
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
 * `refeicoes` é uma LISTA: um prato pode servir mais de uma refeição (ex.: almoço E jantar).
 * `contemAlergenos` é a UNIÃO dos alérgenos dos ingredientes (derivada — mais segura).
 */
export interface Recipe {
  id: string;
  nome: string;
  refeicoes: Refeicao[];
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

// ---------------------------------------------------------------------------
// Exercícios (biblioteca de treino)
// ---------------------------------------------------------------------------

export type PadraoMovimento =
  | 'empurrar'
  | 'puxar'
  | 'agachar'
  | 'dobradica_quadril'
  | 'core'
  | 'cardio'
  | 'isolado';

export type NivelExercicio = 'iniciante' | 'intermediario' | 'avancado';
export type TipoExercicio = 'forca_hipertrofia' | 'cardio' | 'pliometrico' | 'mobilidade';
/**
 * Disponibilidade de equipamento. Modelo "2 níveis" (DF 2026-07-04): o TOPO do perfil é
 * `casa` (com checklist `equipamentosCasa`) ou `academia`. `nenhum` permanece como valor
 * LEGADO aceito em runtime (≡ casa + checklist vazio — migrado na leitura da sessão) e
 * como classe de exigência do EXERCÍCIO (Exercise.equipamento).
 */
export type EquipamentoDisp = 'nenhum' | 'casa' | 'academia';
export type LocalExercicio = 'casa_sem' | 'casa_com' | 'academia';

/**
 * Vocabulário de equipamento de CASA (7 — DF 2026-07-04, modelo 2 níveis). Barbell fica
 * fora de propósito: na A1 quase todo barbell é `academia`.
 */
export type EquipamentoCasa =
  | 'halteres' | 'barra_fixa' | 'elastico' | 'banco'
  | 'kettlebell' | 'corda_pular' | 'roda_abdominal';

/**
 * Grupo muscular PRIMÁRIO normalizado (1ª entrada da coluna de grupo da A1) —
 * curadoria aprovada no cofre `parametros-motor-substituicao-evokorpus` §2
 * (DF 2026-07-04). É a chave da PRESERVAÇÃO como filtro duro na troca (F.2).
 */
export type GrupoPrimario =
  | 'abdomen' | 'adutores' | 'antebraco' | 'biceps' | 'cardio' | 'core'
  | 'corpo-inteiro' | 'costas' | 'gluteos' | 'lombar' | 'ombros' | 'panturrilha'
  | 'peito' | 'pernas' | 'posterior' | 'quadriceps' | 'trapezio' | 'triceps';

export interface Exercise {
  id: string;
  nomePt: string;
  nomeEn?: string;
  grupoMuscular: string;
  /** Grupo primário normalizado (cofre F.2 §2) — governa a preservação da troca. */
  grupoPrimario: GrupoPrimario;
  padraoMovimento: PadraoMovimento;
  nivel: NivelExercicio;
  tipo: TipoExercicio;
  equipamento: EquipamentoDisp;
  /** Equipamento específico (ex.: "Halteres", "Polia", "Peso corporal"). */
  equipamentoDetalhe?: string;
  local: LocalExercicio;
  /**
   * Equipamento de casa EXIGIDO (só nos `casa_com`; DF 2026-07-04 — 1º passo derivado do
   * nome/atributos, curadoria pendente de aprovação no cofre). Disponível em "Casa" quando
   * `equipamentoExigido ⊆ equipamentosCasa` do perfil. `casa_sem` não usa; `academia` é
   * gateado pelo `local`.
   */
  equipamentoExigido?: EquipamentoCasa[];
  /**
   * Equipamento ANY-OF (V8.5, DF 2026-07-04): satisfeito quando ALGUM item da lista está
   * marcado no checklist (ex.: goblet/farmer = halteres OU kettlebell). Complementa o
   * `equipamentoExigido` (que é E/⊆). Só nos casa_com que têm alternativa real.
   */
  equipamentoExigidoQualquerUm?: EquipamentoCasa[];
  /** Faixa de popularidade (1 essencial → 4 específico), não dificuldade. */
  tier?: number;
  comoFazer: string;
}
