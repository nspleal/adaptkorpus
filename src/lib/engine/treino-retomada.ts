/**
 * Rampa de retomada — SPEC TRAVADA (cofre `parametros-motor-treino-adaptkorpus`
 * §"Rampa de retomada", DF 2026-07-27; handoff `outputs/handoff-leva-2-2026-07-27` Bloco 3).
 *
 * ⚠️ É feature de SEGURANÇA, não de acolhimento. O risco de voltar no volume cheio é
 * **rabdomiólise por esforço**: a diretriz CSCCa/NSCA 2019 registra ~60% das lesões
 * não-contato no retorno após inatividade, com perfil "alto volume submáximo, INCLUSIVE
 * PESO CORPORAL, até a fadiga". Por isso o corte vale também para quem treina sem carga.
 *
 * 🔴 O ponto que carrega a leva: **recuar para a semana 1 do mesociclo NÃO é a rampa**.
 * A semana 1 entrega o PISO da banda (massa/intermediário: 13 de 16 = −19%), e a diretriz
 * pede −50%, que cai ABAIXO do piso. Este módulo existe para produzir esse estado que o
 * motor não tinha: **volume abaixo do piso da banda, temporário**.
 *
 * Puro e determinístico: nenhum relógio aqui dentro — `hojeISO` e as datas entram por
 * parâmetro (mesmo padrão de `treino-mesociclo`).
 */
import {
  RETOMADA_DIAS_GATILHO,
  RETOMADA_DIAS_LONGA,
  RETOMADA_FATORES_CURTA,
  RETOMADA_FATORES_LONGA,
  RETOMADA_FREQ_MAX_POR_GRUPO,
  RETOMADA_IRV_TETO,
  RETOMADA_RIR_ALVO,
  RETOMADA_SEMANAS_FIT,
  RETOMADA_SERIES_MAX_SEM_CARGA,
  RETOMADA_DESCANSO_MIN_SEG,
} from './treino-constants';

/** Dias inteiros entre duas datas ISO (b − a); NaN-safe → null (entrada inválida). */
function diasEntreISO(aISO: string, bISO: string): number | null {
  const a = Date.parse(`${aISO}T00:00:00Z`);
  const b = Date.parse(`${bISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Faixa da pausa (3 faixas travadas; a 4ª foi descartada por não ter apoio em fonte). */
export type FaixaRetomada = 'curta' | 'longa';

export interface EstadoRetomada {
  /** Rampa em vigor nesta semana. */
  ativa: boolean;
  faixa: FaixaRetomada;
  /** Semana da rampa, 1-based. */
  semana: number;
  /** Total de semanas da rampa (2 na curta, 4 na longa) — o "de N" do contador. */
  totalSemanas: number;
  /** Fator sobre o volume de REFERÊNCIA (não composto). */
  fator: number;
  /** Dias da pausa que originou a rampa (só para a copy; nunca exibido como contagem). */
  diasPausa: number;
  /** true enquanto a pessoa ainda NÃO voltou a treinar (pausa aberta). */
  pausaAberta: boolean;
}

/** Fatores da faixa. Não compostos: cada um incide sobre o volume de referência. */
function fatoresDa(faixa: FaixaRetomada): readonly number[] {
  return faixa === 'curta' ? RETOMADA_FATORES_CURTA : RETOMADA_FATORES_LONGA;
}

/** Faixa a partir dos dias de pausa; null abaixo do gatilho (≤ 14 → nada muda). */
export function faixaDaPausa(dias: number): FaixaRetomada | null {
  if (!Number.isFinite(dias) || dias <= RETOMADA_DIAS_GATILHO) return null;
  return dias > RETOMADA_DIAS_LONGA ? 'longa' : 'curta';
}

/**
 * Estado da rampa, DERIVADO do histórico (sem estado novo — mesma lição do relógio do
 * mesociclo). O gatilho é a **pausa mais recente ≥ 15 dias** entre sessões de treino
 * RESISTIDO (cardio não encerra pausa — o chamador filtra):
 *  - pausa ainda ABERTA (última sessão → hoje) → rampa na semana 1, à espera da volta;
 *  - pausa FECHADA → a rampa corre a partir da 1ª sessão de volta; passado o total de
 *    semanas, acabou (e o ciclo recomeça no piso, regra 4 da spec).
 * "Parar de novo durante a rampa recalcula sozinho": uma pausa nova vira a mais recente.
 */
export function estadoRetomada(args: {
  /** Datas ISO de sessões de treino RESISTIDO (sem cardio, sem eventos), em qualquer ordem. */
  datasSessaoResistida: readonly string[];
  hojeISO: string;
}): EstadoRetomada | null {
  const datas = [...new Set(args.datasSessaoResistida)].filter(Boolean).sort();
  if (datas.length === 0) return null; // nunca treinou: não é retomada, é começo

  const ultima = datas[datas.length - 1]!;
  const diasDesdeUltima = diasEntreISO(ultima, args.hojeISO);
  if (diasDesdeUltima == null || diasDesdeUltima < 0) return null;

  // 1) Pausa ABERTA: ainda não voltou.
  const faixaAberta = faixaDaPausa(diasDesdeUltima);
  if (faixaAberta) {
    return {
      ativa: true, faixa: faixaAberta, semana: 1,
      totalSemanas: fatoresDa(faixaAberta).length,
      fator: fatoresDa(faixaAberta)[0]!,
      diasPausa: diasDesdeUltima, pausaAberta: true,
    };
  }

  // 2) Pausa FECHADA mais recente: maior intervalo entre sessões consecutivas que passou
  //    do gatilho. Varre de trás para frente — a mais recente é a que governa.
  for (let i = datas.length - 1; i > 0; i--) {
    const gap = diasEntreISO(datas[i - 1]!, datas[i]!);
    if (gap == null) continue;
    const faixa = faixaDaPausa(gap);
    if (!faixa) continue;
    const volta = datas[i]!; // 1ª sessão depois da pausa
    const desdeVolta = diasEntreISO(volta, args.hojeISO);
    if (desdeVolta == null || desdeVolta < 0) return null;
    const fatores = fatoresDa(faixa);
    const semana = Math.floor(desdeVolta / 7) + 1;
    if (semana > fatores.length) return null; // rampa concluída → ciclo recomeça no piso
    return {
      ativa: true, faixa, semana, totalSemanas: fatores.length,
      fator: fatores[semana - 1]!, diasPausa: gap, pausaAberta: false,
    };
  }
  return null;
}

/**
 * Volume-alvo da semana de rampa. 🔴 Pode (e deve) cair ABAIXO do piso da banda — é
 * exatamente o estado que o motor não tinha.
 * `max(1, floor(referencia × fator))`: arredondar para BAIXO é DF travada — o erro cai
 * sempre para o lado seguro (3 → 1, 5 → 2), dura 2 semanas e a semana seguinte recupera.
 * ⚠️ Não afirmar que entrega exatamente −50%: entrega "−50% ou um pouco mais".
 */
export function volumeDaRetomada(volumeReferencia: number, fator: number): number {
  if (!Number.isFinite(volumeReferencia) || volumeReferencia <= 0) return 1;
  return Math.max(1, Math.floor(volumeReferencia * fator));
}

/**
 * Invariante IRV (regra FIT da diretriz) — **guarda-corpo DURO**, não ajuste de percentual:
 * `séries × reps × %1RM ≤ 30` por grupo, por sessão. O teto corta sozinho qualquer perfil,
 * inclusive os que ainda não existem (foi assim que a spec resolveu a tensão interna da
 * própria diretriz, em que o −30% da semana 2 devolvia IRV ≈ 36 em volume alto).
 * `pct1rm` em DECIMAL (0,73 = 73%).
 */
export function irvComCarga(series: number, reps: number, pct1rm: number): number {
  return series * reps * pct1rm;
}
export function irvRespeitaTeto(series: number, reps: number, pct1rm: number): boolean {
  return irvComCarga(series, reps, pct1rm) <= RETOMADA_IRV_TETO;
}

/**
 * Séries máximas por grupo/sessão que respeitam o IRV, dado reps e %1RM. Nunca abaixo de 1
 * (uma série é o mínimo que faz a sessão existir).
 */
export function seriesMaxComCarga(reps: number, pct1rm: number): number {
  if (!Number.isFinite(reps) || !Number.isFinite(pct1rm) || reps <= 0 || pct1rm <= 0) return 1;
  return Math.max(1, Math.floor(RETOMADA_IRV_TETO / (reps * pct1rm)));
}

/**
 * 🔴 SEM CARGA o IRV é INCOMPUTÁVEL (não há %1RM em peso corporal — e derivar %1RM do mapa
 * de reps seria inventar número: 10 flexões para quem faz 12 e para quem faz 40 são
 * intensidades diferentes). E é justamente aí que o risco mora: os casos da fonte são de
 * peso corporal. Forma travada: **teto fixo de 3 séries** por grupo por sessão nas 2
 * primeiras semanas (derivação: 30 ÷ (15 × 0,60) ≈ 3,3).
 */
export function seriesMaxSemCarga(): number {
  return RETOMADA_SERIES_MAX_SEM_CARGA;
}

/** Teto de séries por grupo/sessão na rampa, escolhendo a forma do invariante pelo modo. */
export function tetoSeriesDaRetomada(args: { comCarga: boolean; reps?: number; pct1rm?: number }): number {
  if (!args.comCarga) return seriesMaxSemCarga();
  return seriesMaxComCarga(args.reps ?? 10, args.pct1rm ?? 0.73);
}

/**
 * Frequência máxima por GRUPO/PADRÃO na semana (não por dias de treino — a diretriz fala em
 * grupo, e limitar dias brigaria com os dias que o usuário escolheu).
 * Fora das 2 semanas da regra FIT, não há teto (`Infinity`).
 */
export function freqMaxPorGrupo(semanaRetomada: number): number {
  return RETOMADA_FREQ_MAX_POR_GRUPO[semanaRetomada - 1] ?? Infinity;
}

/**
 * Descanso MÍNIMO na rampa (a regra FIT está em razão trabalho:descanso 1:4 → 1:3; com a
 * série de 8–12 reps ≈ 30 s isso vira 120 s e 90 s). ⚠️ Isto **eleva** o mínimo do isolado,
 * que no v1 é 60–90 s. Fora das 2 semanas, 0 (vale o descanso normal da prescrição).
 */
export function descansoMinimoSeg(semanaRetomada: number): number {
  return RETOMADA_DESCANSO_MIN_SEG[semanaRetomada - 1] ?? 0;
}

/** true nas 2 primeiras semanas de volta — janela da regra FIT e da suspensão da B5. */
export function naJanelaFit(semanaRetomada: number): boolean {
  return semanaRetomada <= RETOMADA_SEMANAS_FIT;
}

/**
 * 🔴 RIR-alvo durante a rampa = 3 (piso da escada `[3,3,2,2,1]`), **nunca** o RIR da semana
 * em que a pessoa parou. Sem isto, quem treinou 5 semanas e sumiu 60 dias volta com RIR 1 —
 * séries a uma repetição da falha na 1ª sessão depois de 2 meses parado, exatamente o
 * cenário que a feature existe para evitar. Subir o RIR tira REPS, não PESO → é corte de
 * VOLUME, coerente com "corta volume, não intensidade". O piso do nível continua valendo.
 */
export function rirAlvoDaRetomada(rirMinDaPrescricao: number): number {
  return Math.max(RETOMADA_RIR_ALVO, rirMinDaPrescricao);
}

/**
 * Prescrição EFETIVA durante a rampa (pura): RIR-alvo 3 e descanso mínimo elevado.
 * Não toca a CARGA — "corta volume, não intensidade" (intensidade aqui é %1RM). O volume
 * por grupo é responsabilidade do montador (`OpcoesSemana.retomada`).
 */
export function aplicarRetomada<
  P extends {
    rir: { min: number; max: number };
    descansoCompostoSeg: { min: number; max: number };
    descansoIsoladoSeg: { min: number; max: number };
  },
>(prescricao: P, semanaRetomada: number): P & { rirAlvoSemana: number; retomada: true } {
  const minSeg = descansoMinimoSeg(semanaRetomada);
  const elevar = (f: { min: number; max: number }) => ({
    min: Math.max(f.min, minSeg),
    max: Math.max(f.max, minSeg),
  });
  return {
    ...prescricao,
    rirAlvoSemana: rirAlvoDaRetomada(prescricao.rir.min),
    descansoCompostoSeg: elevar(prescricao.descansoCompostoSeg),
    descansoIsoladoSeg: elevar(prescricao.descansoIsoladoSeg),
    retomada: true as const,
  };
}

/**
 * Meta de cardio durante a rampa: também multiplicada pelo fator (uso LITERAL da fonte —
 * a rampa 50/30/20/10 foi escrita para condicionamento; a musculação é que ganhou a regra
 * FIT). Minutos arredondam ao inteiro; contagem de sessões nunca desce abaixo de 1.
 */
export function metaCardioDaRetomada(meta: number, fator: number, emSessoes = false): number {
  if (!Number.isFinite(meta) || meta <= 0) return emSessoes ? 1 : 0;
  return emSessoes ? Math.max(1, Math.floor(meta * fator)) : Math.round(meta * fator);
}
