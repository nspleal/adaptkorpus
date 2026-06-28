/**
 * Tipos do motor determinístico — App Evokorpus.
 *
 * Fonte de verdade (cofre / obsidian):
 *   - conceitos/parametros-motor-dieta-evokorpus  (spec A3 travada da dieta)
 *   - conceitos/gate-de-saude-evokorpus            (gate de saúde travado)
 *   - conceitos/motor-de-regras-deterministico
 *
 * Princípio: NADA é gerado por IA em runtime. Tudo é fórmula + dado curado.
 * Mesmo input → mesma saída (auditável; sustenta o enquadramento legal).
 */

export type Sexo = 'masculino' | 'feminino';

/** Objetivo do usuário. 'saude' = manutenção (~GET). */
export type Objetivo = 'emagrecimento' | 'massa' | 'saude';

export type NivelAtividade =
  | 'sedentario'
  | 'leve'
  | 'moderado'
  | 'intenso'
  | 'muito_intenso';

/**
 * Condições autodeclaradas (PAR-Q enxuto, sim/não) — NÃO é ficha médica (LGPD).
 * Qualquer flag verdadeira → ROTEAR (território clínico; Princípio 3 do enquadramento legal).
 */
export interface FlagsSaude {
  /** Gestação ou amamentação. */
  gestacaoAmamentacao: boolean;
  /** Condição renal. */
  renal: boolean;
  /** Condição cardíaca. */
  cardiaca: boolean;
  /** Lesão ou limitação física. */
  lesao: boolean;
  /** Diabetes. */
  diabetes: boolean;
}

/** Entrada do motor (após autenticação + consentimento; vem do `profile` com RLS). */
export interface PerfilUsuario {
  sexo: Sexo;
  /** Peso em kg. */
  pesoKg: number;
  /** Altura em cm. */
  alturaCm: number;
  /** Idade em anos (app é 18+; validado na borda). */
  idade: number;
  nivelAtividade: NivelAtividade;
  objetivo: Objetivo;
  flagsSaude: FlagsSaude;
}

/** Vocabulário do gate (mais restritivo → menos restritivo). */
export type ComportamentoGate = 'ROTEAR' | 'RESTRINGIR' | 'PISAR' | 'PERMITIR';

export interface ResultadoGate {
  comportamento: ComportamentoGate;
  /** Motivos legíveis (pt) que dispararam o comportamento. */
  motivos: string[];
  /** Avisos "procure um profissional" (independem do objetivo; IMC < 18.5). */
  avisos: string[];
  /** Valores derivados (úteis para a dieta e para auditoria/exibição). */
  derivados: {
    imc: number;
    tmb: number;
    get: number;
    pisoSeguro: number;
  };
  /**
   * Objetivo efetivo que a dieta deve usar.
   * RESTRINGIR força 'saude' (manutenção). Demais comportamentos mantêm o objetivo.
   */
  objetivoEfetivo: Objetivo;
}

export interface MetaMacros {
  /** Gramas exibidas (o "ponto"). */
  proteinaG: number;
  gorduraG: number;
  carboidratoG: number;
  /** kcal alocadas por macro (4/4/9 — SÓ para a meta, nunca para medir alimento). */
  kcalProteina: number;
  kcalGordura: number;
  kcalCarboidrato: number;
  /** Pisos/travas do montador. */
  proteinaPisoG: number;
}

export interface JanelaMontador {
  minKcal: number;
  maxKcal: number;
}

export interface PlanoDieta {
  comportamento: ComportamentoGate;
  /** kcal-alvo exibida (o "ponto"; internamente kcal_alvo, já com piso aplicado). */
  kcalAlvo: number;
  macros: MetaMacros;
  janela: JanelaMontador;
  derivados: ResultadoGate['derivados'];
  /** Linha honesta para a UI quando o gate sobrescreve o pedido (transparência). */
  notaTransparencia?: string;
  motivos: string[];
  avisos: string[];
}
