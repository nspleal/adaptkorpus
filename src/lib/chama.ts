/**
 * Contador de treinos + Chama dos 4 marcos — lógica pura.
 *
 * Cofre (registro-de-aderencia-evokorpus §Contador, decisão 2026-07-02): contador
 * ACUMULADO de dias distintos de treino (guiado ou manual) — só sobe, NUNCA zera,
 * nunca mostra dias parados; NÃO é streak (sem reset ao faltar). Substitui os
 * marcos 7/30 da V6.2.
 *
 * Design (design_handoff_chama_marcos, iteração do autor SOBRE a decisão acima —
 * definitivo): a COR da chama muda em 4 marcos cumulativos — 15/25/50/100 dias —
 * âmbar desde o dia 1 (nunca cinza/apagada no estado atual). Pulso #BDFF00 fica
 * FORA da escala (reservado a acento de UI). Copy final por faixa (não alterar o
 * sentido). Sem promessa de resultado; é só reconhecimento de constância.
 */

export type ChamaCor = 'amber' | 'azul' | 'roxo' | 'verde';

export interface MarcoChama {
  dias: number;
  cor: ChamaCor;
  nome: string;
}

export const MARCOS_CHAMA: readonly MarcoChama[] = [
  { dias: 15, cor: 'amber', nome: 'Âmbar' },
  { dias: 25, cor: 'azul', nome: 'Azul' },
  { dias: 50, cor: 'roxo', nome: 'Roxo' },
  { dias: 100, cor: 'verde', nome: 'Verde Folha' },
];

/** Hex de referência por marco (ficha técnica do handoff). Verde = Folha (marca, hex exato). */
export const CHAMA_COR_HEX: Record<ChamaCor, string> = { amber: '#F5A623', azul: '#2E90DB', roxo: '#8C55DE', verde: '#16A34A' };
export const CHAMA_COR_RGB: Record<ChamaCor, string> = { amber: '245,166,35', azul: '46,144,219', roxo: '140,85,222', verde: '22,163,74' };

/** Linha de apoio por faixa (copy FINAL do handoff — não alterar o sentido). */
export const APOIO_CHAMA: readonly string[] = [
  'Um total que só cresce — sem sequência pra perder.',
  '1º marco: sua chama âmbar firmou. Segue acesa, sem pressa.',
  'Sua chama mudou pro azul. Mais dias somados, mesma constância.',
  'Agora ela queima roxo. Puro acúmulo, no seu tempo.',
  'Chama verde Folha: 100 dias somados. Isso é constância.',
];

/** Faixa (banda) do total de dias: 0 = antes do 1º marco · 1..4 = marcos 15/25/50/100. */
export function bandaChama(x: number): 0 | 1 | 2 | 3 | 4 {
  if (x >= 100) return 4;
  if (x >= 50) return 3;
  if (x >= 25) return 2;
  if (x >= 15) return 1;
  return 0;
}

export interface ChamaAtual {
  cor: ChamaCor;
  /** true = marco já cruzado (glow reforçado); false = base antes do 1º marco (acesa, glow discreto). */
  enfase: boolean;
  nome: string;
  /** Dias do marco atual (0 antes do 1º). */
  marco: number;
}

/** Estado atual da chama pela regra do handoff (X ≥ 100 verde · ≥50 roxo · ≥25 azul · ≥15 âmbar+ênfase · <15 âmbar base). */
export function chamaAtual(x: number): ChamaAtual {
  if (x >= 100) return { cor: 'verde', enfase: true, nome: 'Verde Folha', marco: 100 };
  if (x >= 50) return { cor: 'roxo', enfase: true, nome: 'Roxo', marco: 50 };
  if (x >= 25) return { cor: 'azul', enfase: true, nome: 'Azul', marco: 25 };
  if (x >= 15) return { cor: 'amber', enfase: true, nome: 'Âmbar', marco: 15 };
  return { cor: 'amber', enfase: false, nome: 'Âmbar', marco: 0 };
}

/** Pill/eyebrow acima do texto do contador (copy final do handoff). */
/**
 * Rótulo da pílula da chama.
 *
 * 🔒 MODO DIÁRIO (DF 2026-07-29): "Aquecendo" FICA — descreve o estado ATUAL, e descrever o
 * estado atual é leitura. Sai o "· antes do 1º marco", que posiciona a pessoa em relação a
 * um marco à frente: anunciar marco à frente é alvo, mesmo sem número.
 *
 * Varredura do módulo (pedida no lote): esta é a ÚNICA construção voltada ao futuro aqui.
 * O outro ramo (`Marco N dias · Cor`) nomeia um marco JÁ ALCANÇADO, e as 5 linhas de
 * `APOIO_CHAMA` ou descrevem o marco atingido ou a natureza do contador ("um total que só
 * cresce" = ele nunca zera), nunca o que falta.
 */
export function pillChama(x: number, modoDiario = false): string {
  const a = chamaAtual(x);
  if (bandaChama(x) !== 0) return `Marco ${a.marco} dias · ${a.nome}`;
  return modoDiario ? 'Aquecendo' : 'Aquecendo · antes do 1º marco';
}

/**
 * 🔴 O "faltam N dias" SAIU — em TODOS OS MODOS (DF 2026-08-01).
 *
 * A forma é o defeito, não a promessa. *"Faltam X para os Y"* é a **classe ①** (alvo no
 * futuro da atividade da pessoa) somada à **classe ③** (denominador), e 🔑 **a varredura de
 * afirmações nunca a pegou porque procurava copy FALSA — e essa era verdadeira.** Classe
 * nova de escape: **copy verdadeira que viola trava de forma.**
 *
 * ⚠️ O contra-argumento da gamificação foi recusado, e vale registrar por quê: **quem
 * quebrou a chama já sabe**, e dizer *"faltam 7"* a quem parou é **comentar a ausência**.
 * O JSDoc do `ChamaContador` já defendia isto desde 2026-07-29 — mas escopou a remoção ao
 * modo diário, deixando a mesma frase no ar para todo o resto.
 *
 * 🔒 REFINO DA CLASSE ③ que decide o caso (método de verificação): **denominador que
 * descreve a ESTRUTURA DO PRESENTE fica; denominador que projeta ACÚMULO FUTURO sai.**
 * "3 de 4 séries concluídas" descreve a sessão em curso; "faltam 7 dias" projeta acúmulo.
 */

/** Marcos JÁ ALCANÇADOS — passado, e contar o passado é leitura. */
export function marcosAlcancados(x: number): MarcoChama[] {
  return MARCOS_CHAMA.filter((m) => m.dias <= x);
}

/**
 * Os marcos que ainda vêm, como **LISTA ESTÁTICA** — descreve o SISTEMA ("os marcos são 15,
 * 25, 50 e 100 dias"), nunca a distância da pessoa até eles. Sem contador, sem denominador,
 * sem contagem regressiva: os mesmos números para todo mundo, mudando só quais já saíram.
 */
export function proximosMarcos(x: number): { cor: ChamaCor; dias: number; nome: string }[] {
  return MARCOS_CHAMA.filter((m) => m.dias > x).map((m) => ({ cor: m.cor, dias: m.dias, nome: m.nome }));
}

/** Nº de dias DISTINTOS com treino (guiado ou manual) — dedupe por dia calendário: registrar
 *  duas vezes no mesmo dia não soma dois dias (regra do handoff §Componente B). */
export function diasDeTreino(datasISO: readonly string[]): number {
  return new Set(datasISO.filter(Boolean)).size;
}
