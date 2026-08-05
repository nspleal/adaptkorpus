/**
 * 🎛️ v3 · BLOCO B — OS TRILHOS DO EDITOR e o FOCO POR GRUPO (DF 2026-07-31, cofre
 * `parametros-motor-treino-evokorpus` §"🎛️ v3 — os trilhos do editor").
 *
 * 🔒 **O v3 sai de política declarada, não de evidência.** A §16 da pesquisa lista 13 lacunas
 * sem resposta robusta e prescreve o procedimento: *declarar a incerteza · default
 * conservador · racional explícito · medir · versionar*. Por isso **todo trilho aqui carrega
 * procedência e versão** — sem o rótulo, a próxima auditoria herda a confusão.
 *
 * 🟢 O que barateia a decisão: 5 dos 6 trilhos **já têm número no cofre**. O que muda não é a
 * origem — é o **papel**: o número deixa de ser *alvo do gerador* e vira *teto do editor*.
 *
 * PURO e determinístico.
 */
import type { GrupoPrimario } from '../data/types';
import type { NivelExperiencia, Faixa } from './treino-types';
import type { Objetivo } from './types';
import { VOLUME_NIVEL, FREQ_POR_GRUPO_MIN } from './treino-constants';

/** 🏷️ Procedência × versão — o rótulo que o §16 exige em cada trilho. */
export interface Rotulo {
  procedencia: 'evidencia' | 'politica';
  versao: string;
  desde: string;
}
const V3: Rotulo = { procedencia: 'politica', versao: 'v3.0', desde: '2026-08-04' };

/**
 * Os 7 trilhos, cada um com o rótulo. `origem` diz de onde o número veio — §1.2 é tabela do
 * cofre reaproveitada; "nossa" é número que não existia antes.
 */
export const TRILHOS = {
  seriesPorExercicio: { ...V3, origem: '§1.2' },
  seriesPorGrupoNaSessao: { ...V3, origem: '§1.2 (coerência aritmética)' },
  mrv: { ...V3, origem: '§1.2 — topo da faixa do nível' },
  mev: { ...V3, origem: '§1.2 — piso da faixa' },
  intervaloMinimoEntreSessoes: { ...V3, origem: 'nossa' },
  seriesDiretas: { ...V3, origem: 'já é o comportamento' },
  foco: { ...V3, origem: 'nossa (a §16 voltou sem um único número)' },
} as const satisfies Record<string, Rotulo & { origem: string }>;

/** Teto de séries por exercício — o teto do NÍVEL (iniciante 3 · intermediário 4 · avançado 4). */
export function tetoSeriesPorExercicio(nivel: NivelExperiencia): number {
  return VOLUME_NIVEL[nivel].seriesPorExercicio.max;
}

/** A faixa semanal por grupo do nível+objetivo. `max` = MRV · `min` = MEV. */
export function faixaSemanal(nivel: NivelExperiencia, objetivo: Objetivo): Faixa {
  return VOLUME_NIVEL[nivel].volumePorGrupoSemana[objetivo];
}

/**
 * 🔴 **MRV — teto DURO.** É o topo da faixa do nível, e nada o eleva: nem o foco, nem o
 * editor. *(A alternativa — elevar o teto durante a fase de foco — foi recusada: transformaria
 * o único guarda-corpo de volume em algo negociável.)*
 */
export function mrv(nivel: NivelExperiencia, objetivo: Objetivo): number {
  return faixaSemanal(nivel, objetivo).max;
}

/** **MEV — piso de AVISO, nunca bloqueio.** Ficar abaixo dele avisa; não impede. */
export function mev(nivel: NivelExperiencia, objetivo: Objetivo): number {
  return faixaSemanal(nivel, objetivo).min;
}

/** Teto de séries do grupo NA SESSÃO: volume semanal ÷ frequência (massa/interm.: 16÷2 = 8). */
export function tetoSeriesGrupoNaSessao(nivel: NivelExperiencia, objetivo: Objetivo, freqPorGrupo = FREQ_POR_GRUPO_MIN): number {
  return Math.ceil(mrv(nivel, objetivo) / Math.max(1, freqPorGrupo));
}

/** 🆕 Intervalo mínimo entre sessões do MESMO grupo — política declarada. */
export const INTERVALO_MIN_HORAS_MESMO_GRUPO = 48;

/* ═══════════════════════ FOCO POR GRUPO (pedido nº 4 do beta) ═══════════════════════ */

/** +2–4 séries/semana no grupo focado, compensadas 1:1 em outro. 1 grupo por vez, 4–6 semanas. */
export const FOCO_DELTA: Faixa = { min: 2, max: 4 };
export const FOCO_SEMANAS: Faixa = { min: 4, max: 6 };

export interface FocoGrupo {
  grupo: GrupoPrimario;
  /** O grupo que cede o volume — a compensação é **1:1**, o total da semana não cresce. */
  compensa: GrupoPrimario;
  /** Semana do foco (1-based). Fora de 1..`FOCO_SEMANAS.max` o foco está encerrado. */
  semana: number;
}

export interface EfeitoFoco {
  /** Alvo de séries do grupo focado, DEPOIS do teto duro. */
  alvoFocado: number;
  /** Alvo do grupo que compensa (nunca abaixo do MEV). */
  alvoCompensado: number;
  /** Quanto de volume realmente se moveu — 0 quando o focado já estava no MRV. */
  deltaAplicado: number;
  /**
   * 🔑 O que o foco entregou. `volume` quando havia folga até o MRV; `ordem` quando não havia
   * — e aí o grupo focado vem PRIMEIRO DENTRO DA SUA CLASSE. **Quem já está no topo não
   * ganha volume; ganha ORDEM.**
   */
  entrega: 'volume' | 'ordem';
}

/**
 * 🔴 A CONTRADIÇÃO RESOLVIDA (error-hunt de 2026-07-31): o MRV é teto DURO e o foco soma
 * +2–4. Massa/intermediário com peito já em **16** (o topo) e foco no peito → **18–20 > 16**.
 * As duas regras não podiam valer juntas.
 *
 * 🔒 **Resolução travada, do lado conservador: o foco sobe até o MRV e para ali.**
 *
 * ⚠️ E a compensação é **1:1**: o que o grupo focado ganha, outro cede — o volume semanal
 * total não cresce. Sem isso o "foco" seria um aumento geral com outro nome.
 */
export function aplicarFoco(args: {
  alvoBase: number;
  alvoCompensaBase: number;
  nivel: NivelExperiencia;
  objetivo: Objetivo;
  /** Quanto se quer somar (dentro de `FOCO_DELTA`). Default: o piso, que é o conservador. */
  delta?: number;
}): EfeitoFoco {
  const teto = mrv(args.nivel, args.objetivo);
  const piso = mev(args.nivel, args.objetivo);
  const desejado = Math.min(Math.max(args.delta ?? FOCO_DELTA.min, FOCO_DELTA.min), FOCO_DELTA.max);

  // O teto duro corta primeiro: nunca acima do MRV.
  const cabeNoFocado = Math.max(0, teto - args.alvoBase);
  // …e o piso do compensador corta em seguida: 1:1 só existe se houver de onde tirar.
  const cabeNoCompensa = Math.max(0, args.alvoCompensaBase - piso);
  const deltaAplicado = Math.min(desejado, cabeNoFocado, cabeNoCompensa);

  return {
    alvoFocado: args.alvoBase + deltaAplicado,
    alvoCompensado: args.alvoCompensaBase - deltaAplicado,
    deltaAplicado,
    entrega: deltaAplicado > 0 ? 'volume' : 'ordem',
  };
}

/** O foco está vigente? Fora da janela de 4–6 semanas ele acabou (não se renova sozinho). */
export function focoVigente(foco: FocoGrupo | undefined): boolean {
  return !!foco && foco.semana >= 1 && foco.semana <= FOCO_SEMANAS.max;
}

/**
 * 🔒 A ORDEM — o que o foco entrega a quem já está no topo.
 *
 * 🔴 A ressalva que a 2ª passada da error-hunt obrigou: *"vem primeiro na sessão"*, **sem a
 * qualificação, INVERTERIA composto → isolado** quando o foco fosse num músculo pequeno — e
 * fatigar o bíceps antes das puxadas é **pré-exaustão**, técnica avançada que a seção ao lado
 * decidiu **não prescrever por default**. O conserto teria criado, de graça, o que a seção
 * vizinha proíbe.
 *
 * 🔑 Por isso a reordenação é **ESTÁVEL e DENTRO DA CLASSE**: entre compostos se composto,
 * entre isolados se isolado. A fronteira composto→isolado nunca é cruzada.
 */
export function ordenarComFoco<T>(
  itens: readonly T[],
  grupoFocado: GrupoPrimario | undefined,
  leitura: { classe: (item: T) => 'composto' | 'isolado'; grupo: (item: T) => GrupoPrimario | null },
): T[] {
  if (!grupoFocado) return [...itens];
  /**
   * ⚠️ A 1ª escrita permutava dentro de BLOCOS CONTÍGUOS de mesma classe — e numa sessão
   * `puxar · core · empurrar` os dois compostos caem em blocos diferentes, então o foco não
   * movia nada. O critério é a CLASSE, não a vizinhança.
   *
   * 🔒 As POSIÇÕES de cada classe ficam congeladas (a 2ª posição era de um isolado e continua
   * sendo); só os ocupantes de uma mesma classe se reorganizam entre si. É isso que torna
   * impossível cruzar a fronteira composto → isolado — e é a fronteira que impede a
   * pré-exaustão acidental.
   */
  const fila = new Map<'composto' | 'isolado', T[]>();
  for (const classe of ['composto', 'isolado'] as const) {
    const daClasse = itens.filter((x) => leitura.classe(x) === classe);
    fila.set(classe, [
      ...daClasse.filter((x) => leitura.grupo(x) === grupoFocado),
      ...daClasse.filter((x) => leitura.grupo(x) !== grupoFocado),
    ]);
  }
  return itens.map((x) => fila.get(leitura.classe(x))!.shift()!);
}
