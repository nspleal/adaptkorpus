/**
 * DESCANSO ENTRE SÉRIES — propriedade do EXERCÍCIO, não do objetivo.
 * 🔒 SPEC TRAVADA: cofre `parametros-motor-treino-evokorpus` §🕐 (DF 2026-07-31);
 * handoff `outputs/handoff-descanso-2026-07-31`; evidência §5.7 (Singer et al. 2024,
 * PMID 39205815).
 *
 * **A fala que originou:** *"o tempo de descanso sempre ser o mesmo é extremamente péssimo,
 * pois varia muito de propósito para propósito"* (2ª rodada do beta).
 *
 * 🔻 O primeiro culpado era a SPEC, não o código: a §1.1 fazia o descanso ser função do
 * `objetivo` — para 2 dos 3 objetivos, "sempre o mesmo" era o que a spec mandava. A inversão
 * é de EIXO: a faixa vem da classe do exercício, e o objetivo entra **só** pelo RIR-alvo,
 * que ele já define. Consequência de graça: nenhum objetivo **consegue** encurtar descanso —
 * o mito "descanso curto emagrece" morre por construção, não por prosa.
 *
 * PURO e determinístico: sem relógio, sem rede. A semana do mesociclo e a rampa entram por
 * parâmetro (mesmo padrão de `treino-mesociclo` e `treino-retomada`).
 */
import type { Exercise } from '../data/types';
import type { Faixa } from './treino-types';
import { repUnitDe } from './isometricos';
import { temCarga } from './equipamento';
import { RETOMADA_DESCANSO_MIN_SEG } from './treino-constants';

/** Piso duro global: nada no motor prescreve menos (§Bloco 3.4). Os 30–60 s "metabólicos"
 *  ficam fora do v2. */
export const DESCANSO_PISO_DURO_SEG = 60;

export type ClasseDescanso = 'COMPOSTO' | 'ISOLADO' | 'POTENCIA' | 'NAO_SE_APLICA';

/**
 * Faixas por classe (§5.7). POTÊNCIA é 🟡 **política declarada**, não citação: a fonte pede
 * "descanso suficiente para preservar velocidade e qualidade" sem dar número, e adotamos a
 * faixa do composto.
 */
export const FAIXA_DESCANSO: Readonly<Record<Exclude<ClasseDescanso, 'NAO_SE_APLICA'>, Faixa>> = {
  COMPOSTO: { min: 120, max: 180 },
  ISOLADO: { min: 60, max: 120 },
  POTENCIA: { min: 120, max: 180 },
};

/** Override MODAL (não é classe): modo força + composto + carga → "3–5 min quando necessário". */
export const FAIXA_FORCA_PESADA: Faixa = { min: 180, max: 300 };

/** Padrões de movimento que são composto. ⚠️ `dobradica_quadril`, não `dobradica`. */
const PADROES_COMPOSTO: ReadonlySet<string> = new Set([
  'agachar', 'dobradica_quadril', 'empurrar', 'puxar',
]);

/** Padrões que classificam como isolado/acessório. 🔒 `core` é ACESSÓRIO (DF 2026-07-31). */
const PADROES_ISOLADO: ReadonlySet<string> = new Set(['isolado', 'core']);

/**
 * Classe do exercício, derivada de campos que a biblioteca JÁ tem — zero campo novo, zero
 * curadoria, zero migração.
 *
 * 🔴 A ORDEM IMPORTA: `tipo` é consultado ANTES de `padraoMovimento`. O `e151` (Patinador) é
 * `padraoMovimento: 'cardio'` **e** `tipo: 'pliometrico'`; invertendo a ordem ele cai em
 * NAO_SE_APLICA e **perde o descanso**. Medido, não suposto: a inversão dá
 * `POTENCIA 2 · NAO_SE_APLICA 14` em vez de `3 · 13`.
 *
 * 🔒 O fallback é rede de segurança, NÃO caminho: um teste de exaustividade varre os 163 e
 * falha se qualquer exercício cair nele.
 */
export function classeDeDescanso(ex: Exercise): ClasseDescanso {
  return classificarComOrigem(ex).classe;
}

/**
 * Igual a `classeDeDescanso`, mas diz **se o fallback foi usado**.
 *
 * 🔴 Existe porque sem isso o fallback é INVISÍVEL: ele devolve `COMPOSTO`, que é a mesma
 * resposta que o ramo legítimo daria para um padrão de composto. Prova disso: trocar
 * `dobradica_quadril` pelo literal errado `dobradica` — o defeito exato que o cofre
 * registrou — deixa os 16 caírem no fallback e **a partição 73/74/3/13 não muda**. A
 * mutação sobrevivia. É o `viaFallback` que torna o erro de literal detectável.
 */
export function classificarComOrigem(ex: Exercise): { classe: ClasseDescanso; viaFallback: boolean } {
  if (ex.tipo === 'pliometrico') return { classe: 'POTENCIA', viaFallback: false };
  if (ex.tipo === 'cardio' || ex.padraoMovimento === 'cardio') return { classe: 'NAO_SE_APLICA', viaFallback: false };
  if (PADROES_ISOLADO.has(ex.padraoMovimento)) return { classe: 'ISOLADO', viaFallback: false };
  if (PADROES_COMPOSTO.has(ex.padraoMovimento)) return { classe: 'COMPOSTO', viaFallback: false };
  return { classe: 'COMPOSTO', viaFallback: true }; // rede de segurança, nunca caminho
}

/**
 * A faixa que vale para este exercício, já com o override de força pesada aplicado.
 * `null` quando não há série a descansar (cardio).
 */
export function faixaDoExercicio(ex: Exercise, modoForca = false): Faixa | null {
  const classe = classeDeDescanso(ex);
  if (classe === 'NAO_SE_APLICA') return null;
  // Peso corporal não entra na força pesada — o modo força já o exclui.
  if (modoForca && classe === 'COMPOSTO' && temCarga(ex)) return FAIXA_FORCA_PESADA;
  return FAIXA_DESCANSO[classe];
}

/**
 * Deslocamento dentro da faixa pelo RIR-alvo (§Bloco 2).
 *
 * 🟢 Racional DECLARADO, não citação: na §5.7 a razão do descanso é **preservar trabalho**,
 * e o trabalho da série seguinte só é ameaçado quando a anterior chegou perto da falha.
 * É política nossa, conservadora e explicável.
 *
 * O RIR-alvo já é `[3, 3, 2, 2, 1]` por semana do mesociclo → o descanso varia sozinho ao
 * longo das 6 semanas, **sem parâmetro novo**. Os valores caem em passos de 30 s por
 * construção (as faixas têm amplitude 60 ou 120).
 */
export function deslocarPorRir(faixa: Faixa, rirAlvo: number): number {
  if (rirAlvo >= 3) return faixa.min;   // longe da falha → piso
  if (rirAlvo <= 1) return faixa.max;   // perto da falha → topo
  return Math.round((faixa.min + faixa.max) / 2); // RIR 2 → meio
}

/**
 * Piso do FIT durante a rampa de retomada: 120 s (semana 1) · 90 s (semana 2).
 *
 * 🔴 Duas regras travadas se contradizem e o FIT VENCE. Na rampa o RIR-alvo é 3 (DF
 * 2026-07-27), o que pelo deslocamento puxaria para o piso da faixa; mas a regra FIT manda
 * trabalho:descanso ≥ 1:4 (sem. 1) e ≥ 1:3 (sem. 2). **Sem o `max()`, a rampa ENCURTARIA o
 * descanso exatamente na fase que existe para proteger** — e o sintoma não aparece em
 * nenhum teste que não seja escrito para isso.
 *
 * 🔴 É PISO FIXO, nunca razão. A tradução "1:4 ≈ 120 s" foi feita para série de 8–12 reps
 * (~30 s de trabalho); aplicada como RAZÃO a uma prancha de 60 s daria 240 s, e aos 120 s do
 * avançado daria 480 s de espera. Isométrico usa o mesmo piso fixo de todo mundo.
 */
export function pisoFitDaRampa(semanaRampa: number): number {
  const [sem1, sem2] = RETOMADA_DESCANSO_MIN_SEG;
  return semanaRampa <= 1 ? sem1 : sem2;
}

/**
 * 🔒 PISOS DA DEGRADAÇÃO POR CLASSE (correções 1.3 e 1.4, 2026-07-31).
 *
 * A ordem travada é *cobertura > descanso longo*: quando o tempo aperta, o descanso cede
 * antes do número de exercícios. **Mas ceder não é despencar** — cada classe tem um chão:
 *
 * | Classe | Piso ao degradar | Por quê |
 * |---|---|---|
 * | `ISOLADO` | **60 s** | é o piso duro global; abaixo disso não é descanso |
 * | `COMPOSTO` | **90 s** | já era |
 * | `COMPOSTO` **força pesada** | 🔴 **180 s** | 1.3 — o orçamento levava **300 → 90 (−70 %)**, o oposto do que a §5.7 manda para força pesada (3–5 min) |
 * | `POTENCIA` | **90 s** | 1.4 — degrada **junto com o composto**; antes não tinha lugar na ordem e só não despencava por acidente (o padrão `cardio` do `e151` caía no ramo do composto) |
 */
export const PISO_DEGRADACAO: Record<Exclude<ClasseDescanso, 'NAO_SE_APLICA'>, number> = {
  ISOLADO: DESCANSO_PISO_DURO_SEG,
  COMPOSTO: 90,
  POTENCIA: 90,
};
/** 🔴 1.3 — força pesada tem chão próprio: nunca abaixo de 3 min. */
export const PISO_DEGRADACAO_FORCA_PESADA = 180;

/**
 * Aplica a degradação de tempo a um descanso já calculado, respeitando o piso da classe.
 * `degradacao`: 0 = faixa cheia · 1 = ISOLADO cede · 2 = as demais classes também cedem.
 */
export function degradar(
  base: number,
  classe: Exclude<ClasseDescanso, 'NAO_SE_APLICA'>,
  degradacao: 0 | 1 | 2,
  forcaPesada = false,
): number {
  if (degradacao >= 1 && classe === 'ISOLADO') return PISO_DEGRADACAO.ISOLADO;
  if (degradacao >= 2 && classe !== 'ISOLADO') {
    const piso = forcaPesada && classe === 'COMPOSTO' ? PISO_DEGRADACAO_FORCA_PESADA : PISO_DEGRADACAO[classe];
    return Math.max(Math.min(base, piso), DESCANSO_PISO_DURO_SEG);
  }
  return base;
}

export interface ArgsDescanso {
  exercicio: Exercise;
  /** RIR-alvo da semana do mesociclo (já vem da prescrição). */
  rirAlvo: number;
  modoForca?: boolean;
  /** Semana da rampa de retomada, 1-based. `null`/ausente = sem rampa. */
  semanaRampa?: number | null;
  /**
   * Nível de degradação do orçamento de tempo do DIA (0/1/2). Entra aqui — e não só no teto
   * por padrão — porque a classe só é conhecida com o exercício em mãos: `POTENCIA` e força
   * pesada são invisíveis para quem só vê o padrão do slot (1.3/1.4).
   */
  degradacao?: 0 | 1 | 2;
}

/**
 * O descanso deste exercício, em segundos. `null` quando não há série a descansar.
 *
 * Precedência (a ordem importa — §Bloco 3):
 * ```
 * base    = faixa(classe, forçaPesada) deslocada pelo RIR-alvo
 * comPiso = rampaAtiva ? max(pisoFIT, base) : base
 * final   = max(pisoDuroGlobal, comPiso)
 * ```
 * O orçamento de tempo NÃO entra aqui — ele degrada por classe no montador, que é quem
 * conhece a sessão inteira.
 */
export function descansoDoExercicio(args: ArgsDescanso): number | null {
  const faixa = faixaDoExercicio(args.exercicio, args.modoForca === true);
  if (!faixa) return null;
  const base = deslocarPorRir(faixa, args.rirAlvo);
  const naRampa = args.semanaRampa != null && args.semanaRampa > 0;
  const comPiso = naRampa ? Math.max(pisoFitDaRampa(args.semanaRampa!), base) : base;
  // 🔒 Na rampa NÃO se degrada: o piso do FIT é inviolável e quem cede é o nº de itens.
  const { classe } = classificarComOrigem(args.exercicio);
  const final = naRampa || classe === 'NAO_SE_APLICA'
    ? comPiso
    : degradar(comPiso, classe, args.degradacao ?? 0, args.modoForca === true && temCarga(args.exercicio));
  return Math.max(DESCANSO_PISO_DURO_SEG, final);
}

/** Rótulo humano em passos legíveis: "2 min", "2 min 30", "1 min 30", "45 s". */
export function rotuloDescanso(seg: number): string {
  if (seg < 60) return `${seg} s`;
  const min = Math.floor(seg / 60);
  const resto = seg % 60;
  return resto === 0 ? `${min} min` : `${min} min ${resto}`;
}

/** É isométrico? (registra segundos — nunca entra na razão FIT). */
export function ehIsometrico(ex: Exercise): boolean {
  return repUnitDe(ex.id) === 'segundos';
}

/**
 * Descanso estimado a partir do PADRÃO DE MOVIMENTO, para a fase de orçamento do montador —
 * quando os exercícios ainda não foram escolhidos e só se conhece o padrão do slot.
 *
 * ⚠️ É estimativa de PLANEJAMENTO, não o valor exibido. O definitivo sai de
 * `descansoDoExercicio` depois da escolha, que é quem enxerga `tipo: 'pliometrico'` e o
 * override de força pesada (ambos dependem do exercício, não do padrão).
 *
 * `degradacao` implementa a regra 3 (cobertura > descanso longo), na ordem travada:
 *   0 = faixa cheia · 1 = ISOLADO cede até 60 s · 2 = COMPOSTO também cede, até 90 s.
 * Na rampa o chamador NÃO degrada: o piso do FIT é inviolável e quem cede é o nº de itens.
 */
export function descansoDoPadrao(
  padrao: string,
  args: { rirAlvo: number; modoForca?: boolean; semanaRampa?: number | null; degradacao?: 0 | 1 | 2 },
): number {
  const isolado = PADROES_ISOLADO.has(padrao);
  const classe: Exclude<ClasseDescanso, 'NAO_SE_APLICA'> = isolado ? 'ISOLADO' : 'COMPOSTO';
  // Força pesada é modal e depende de carga — no planejamento assume-se o caso com carga,
  // que é o mais custoso: subestimar o tempo é o erro que faz a sessão não fechar.
  const faixa = args.modoForca === true && classe === 'COMPOSTO' ? FAIXA_FORCA_PESADA : FAIXA_DESCANSO[classe];
  const base = deslocarPorRir(faixa, args.rirAlvo);
  const naRampa = args.semanaRampa != null && args.semanaRampa > 0;
  const comPiso = naRampa ? Math.max(pisoFitDaRampa(args.semanaRampa!), base) : base;
  if (naRampa) return Math.max(DESCANSO_PISO_DURO_SEG, comPiso); // piso do FIT inviolável

  // 🔒 O MESMO `degradar` do valor exibido: se o orçamento e a tela usassem pisos
  // diferentes, o `min(exato, teto)` do montador reintroduziria o corte que 1.3 removeu.
  const deg = degradar(comPiso, classe, args.degradacao ?? 0, args.modoForca === true);
  return Math.max(DESCANSO_PISO_DURO_SEG, deg);
}
