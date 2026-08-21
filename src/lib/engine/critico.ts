/**
 * 🧭 O CRÍTICO DO EDITOR — placar, recomendações e avisos (handoff-editor-guiado-2026-08-13).
 *
 * 🔑 A leitura que barateia tudo, verbatim do handoff: **o crítico do editor É a conta do
 * alocador v4**. Este módulo NÃO tem conta própria de volume — ele chama
 * `creditoPonderadoDaSemana` (o mesmo 1,0/0,5 da DF① de 2026-08-12) e as bandas de
 * `trilhos` (`mev`/`mrv`). Uma segunda implementação seria uma segunda verdade para o mesmo
 * número — a classe que o cofre já nomeou no piso de proteína.
 *
 * 🔒 DF① (2026-08-13): **avisos NÃO travam**. Aqui não existe `bloqueia`: o retorno é
 * texto + severidade, e quem consome exibe. Os únicos bloqueios do produto continuam o
 * gate de saúde e o piso legal de reps com carga — nenhum dos dois mora neste arquivo.
 *
 * 🔒 A §1.2 dizia que o número "deixa de ser alvo do gerador e vira **teto do editor**".
 * É aqui que isso acontece — inclusive `INTERVALO_MIN_HORAS_MESMO_GRUPO`, que existia com
 * ZERO call sites desde o v3 e ganha o seu no aviso de dias consecutivos.
 *
 * PURO e determinístico: sem relógio, sem rede, sem estado.
 */
import type { Exercise, GrupoPrimario } from '../data/types';
import type { NivelExperiencia } from './treino-types';
import type { Objetivo } from './types';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './alocador';
import { INTERVALO_MIN_HORAS_MESMO_GRUPO, mev, mrv } from './trilhos';
import { avaliarDuracaoResistida } from './duracao-plano';
import { ROTULO_GRUPO } from '../frequencia-grupos';

/** Um dia do desenho, como o editor o entrega: o rótulo e os exercícios escolhidos. */
export interface DiaDoEditor {
  nome: string;
  exercicios: readonly Exercise[];
  /**
   * Séries planejadas por exercício (do MOTOR — o usuário não edita). 🔒 C1: os elementos
   * podem ser `undefined` (o motor não anotou — ex.: deload, corpo-inteiro). O PLACAR usa o
   * piso `ctx.seriesPadrao`; o critério de TEMPO abstém-se (NAO_AVALIADO) — nunca inventa.
   */
  series?: readonly (number | undefined)[];
  /** Descanso por exercício, em segundos (do motor). 🔒 C1: elemento `undefined` ⇒ tempo NAO_AVALIADO. */
  descansoSeg?: readonly (number | undefined)[];
}

export type StatusGrupo = 'na_banda' | 'abaixo_mev' | 'acima_mrv' | 'sem_estimulo';

export interface LinhaPlacar {
  grupo: GrupoPrimario;
  rotulo: string;
  /** Séries PONDERADAS da semana (direto 1,0 + secundário 0,5) — a conta do alocador v4. */
  ponderado: number;
  status: StatusGrupo;
  /** A banda do nível/objetivo, para a tela mostrar o alvo sem recalcular. */
  mev: number;
  mrv: number;
}

export type SeveridadeAviso = 'recomendacao' | 'risco';

export interface ItemCritico {
  /** Vocabulário FECHADO — cada motivo é copy de tela e chave de telemetria. */
  codigo:
    | 'trocar_um_por_outro'
    | 'grupo_abaixo_do_minimo'
    | 'dias_consecutivos'
    | 'acima_do_maximo'
    | 'sessao_longa'
    | 'puxar_menor_que_empurrar';
  severidade: SeveridadeAviso;
  /** Frase pronta para a tela — linguagem de sugestão/educação, nunca de resultado. */
  texto: string;
}

export interface Avaliacao {
  placar: LinhaPlacar[];
  /** 🟡 Sugestões derivadas do déficit — nunca prescrição. */
  recomendacoes: ItemCritico[];
  /** 🔴 Riscos, com o porquê. **Não travam** (DF①). */
  avisos: ItemCritico[];
}

export interface ContextoCritico {
  nivel: NivelExperiencia;
  objetivo: Objetivo;
  /** Minutos por sessão do perfil — o aviso de sessão longa compara com isto. */
  tempoPorSessaoMin: number;
  /**
   * Dias da semana em que cada dia do desenho cai, na MESMA ordem de `dias` (índice
   * Seg=0…Dom=6). Ausente = o aviso de dias consecutivos não é emitido (sem agenda não há
   * como afirmar intervalo — e afirmar sem base é o que este arquivo existe para evitar).
   */
  diasDaSemanaIdx?: readonly number[];
  /** Séries usadas no PLACAR quando o motor ainda não anotou (piso do nível). */
  seriesPadrao?: number;
}

const rotulo = (g: GrupoPrimario) => ROTULO_GRUPO[g] ?? g;

/** Horas entre dois dias da semana consecutivos no ciclo (wrap incluído). */
function horasEntre(a: number, b: number): number {
  const d = (b - a + 7) % 7;
  return d * 24;
}

/**
 * O PLACAR da semana: séries ponderadas por grupo × banda do nível.
 * Só os GRANDES entram no placar por default — são os que a DF② põe "na banda"; os
 * pequenos têm piso de presença, não faixa, e apareceriam sempre "abaixo" sem significar
 * nada (a lição da régua de frequência: número sem significado vira ruído).
 */
export function placarDaSemana(dias: readonly DiaDoEditor[], ctx: ContextoCritico): LinhaPlacar[] {
  const slots = dias.flatMap((d) => d.exercicios.map((e, i) => ({
    exercicio: e,
    series: d.series?.[i] ?? ctx.seriesPadrao ?? 1,
  })));
  const ponderado = creditoPonderadoDaSemana(slots);
  const piso = mev(ctx.nivel, ctx.objetivo);
  const teto = mrv(ctx.nivel, ctx.objetivo);
  return GRUPOS_GRANDES.map((g) => {
    const v = Math.round((ponderado.get(g) ?? 0) * 10) / 10;
    const status: StatusGrupo = v <= 0 ? 'sem_estimulo' : v < piso ? 'abaixo_mev' : v > teto ? 'acima_mrv' : 'na_banda';
    return { grupo: g, rotulo: rotulo(g), ponderado: v, status, mev: piso, mrv: teto };
  });
}

/**
 * 🟡 As RECOMENDAÇÕES. A principal é o exemplo literal do autor — *"tente adicionar um de
 * peito a mais e diminuir um de ombro"* —, derivada do déficit: existe grupo acima do alvo
 * E grupo abaixo ⇒ sugere mover UM exercício. Linguagem de sugestão ("tente"), nunca de
 * prescrição nem de resultado.
 */
export function recomendacoes(placar: readonly LinhaPlacar[]): ItemCritico[] {
  const itens: ItemCritico[] = [];
  const acima = [...placar].filter((l) => l.status === 'acima_mrv').sort((a, b) => b.ponderado - a.ponderado);
  const abaixo = [...placar].filter((l) => l.status === 'abaixo_mev' || l.status === 'sem_estimulo')
    .sort((a, b) => a.ponderado - b.ponderado);

  if (acima.length > 0 && abaixo.length > 0) {
    itens.push({
      codigo: 'trocar_um_por_outro',
      severidade: 'recomendacao',
      texto: `Tente trocar 1 exercício de ${acima[0]!.rotulo.toLowerCase()} por 1 de ${abaixo[0]!.rotulo.toLowerCase()} — assim a semana fica mais equilibrada entre os grupos.`,
    });
  }
  for (const l of abaixo) {
    // Já coberto pela sugestão de troca? A frase específica ainda ajuda: ela nomeia a faixa.
    itens.push({
      codigo: 'grupo_abaixo_do_minimo',
      severidade: 'recomendacao',
      texto: `${l.rotulo} está abaixo da faixa mínima desta semana (${l.ponderado} de ${l.mev} séries).`,
    });
  }
  return itens;
}

/**
 * 🔴 Os AVISOS — risco explicado, e **nada aqui trava** (DF①).
 *
 * A copy diz o PORQUÊ e para no mecanismo: "pode prejudicar a recuperação" é o limite do
 * que se pode afirmar sem procedência. Nada de resultado prometido nem de comportamento
 * atribuído à pessoa.
 */
export function avisos(
  dias: readonly DiaDoEditor[],
  placar: readonly LinhaPlacar[],
  ctx: ContextoCritico,
): ItemCritico[] {
  const itens: ItemCritico[] = [];

  // ① Mesmo grupo em dias próximos demais — o call site que faltava desde o v3.
  if (ctx.diasDaSemanaIdx && ctx.diasDaSemanaIdx.length === dias.length) {
    const porGrupo = new Map<GrupoPrimario, number[]>();
    dias.forEach((d, i) => {
      const idx = ctx.diasDaSemanaIdx![i]!;
      for (const g of new Set(d.exercicios.map((e) => e.grupoPrimario).filter((g): g is GrupoPrimario => g != null))) {
        porGrupo.set(g, [...(porGrupo.get(g) ?? []), idx]);
      }
    });
    for (const [g, idxs] of [...porGrupo].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const ordenados = [...idxs].sort((a, b) => a - b);
      const colado = ordenados.some((x, i) => {
        const prox = ordenados[(i + 1) % ordenados.length]!;
        return ordenados.length > 1 && horasEntre(x, prox) < INTERVALO_MIN_HORAS_MESMO_GRUPO;
      });
      if (colado) {
        itens.push({
          codigo: 'dias_consecutivos',
          severidade: 'risco',
          texto: `${rotulo(g)} aparece em dias seguidos. O intervalo recomendado entre sessões do mesmo grupo é de ${INTERVALO_MIN_HORAS_MESMO_GRUPO} horas — treinar antes disso pode prejudicar a recuperação.`,
        });
      }
    }
  }

  // ② Grupo acima do MRV do nível (conta ponderada — a mesma do placar).
  for (const l of placar.filter((x) => x.status === 'acima_mrv')) {
    itens.push({
      codigo: 'acima_do_maximo',
      severidade: 'risco',
      texto: `${l.rotulo} está acima do volume máximo do seu nível (${l.ponderado} contra ${l.mrv} séries). Volume acima do que você recupera tende a atrapalhar, não somar.`,
    });
  }

  // ③ Sessão estourando o tempo — pela FÓRMULA CANÔNICA C1 (`avaliarDuracaoResistida`), a
  //    MESMA do gerador, sobre o plano final (séries e descanso REAIS por slot). 🔒 Sem
  //    fallback silencioso 1 série / 90 s: faltou dado ⇒ NAO_AVALIADO e o crítico NÃO afirma
  //    que cabe. O editor é SOFT — isto informa, nunca trava (DF①).
  const orcamentoSeg = ctx.tempoPorSessaoMin * 60;
  dias.forEach((d, i) => {
    const slots = d.exercicios.map((ex, k) => ({ exercicio: ex, series: d.series?.[k], descansoSeg: d.descansoSeg?.[k] }));
    const r = avaliarDuracaoResistida(slots, ctx.nivel, orcamentoSeg);
    if (r.estadoCalculo === 'CALCULADO' && r.estadoLimite !== 'DENTRO_DO_LIMITE') {
      const min = Math.round(r.duracaoMaximaEstimadaSegundos! / 60);
      itens.push({
        codigo: 'sessao_longa',
        severidade: 'risco',
        texto: `${d.nome || `Dia ${i + 1}`} deve levar até cerca de ${min} min, acima dos ${ctx.tempoPorSessaoMin} min que você marcou no perfil.`,
      });
    }
  });

  // ④ Desequilíbrio puxar < empurrar (saúde do ombro — invariante do motor desde o v1).
  const conta = (p: string) => dias.reduce((n, d) => n + d.exercicios.filter((e) => e.padraoMovimento === p).length, 0);
  if (conta('puxar') < conta('empurrar')) {
    itens.push({
      codigo: 'puxar_menor_que_empurrar',
      severidade: 'risco',
      texto: `Sua semana tem mais exercícios de empurrar (${conta('empurrar')}) que de puxar (${conta('puxar')}). Manter puxar ao menos igual a empurrar ajuda a equilibrar o ombro.`,
    });
  }

  return itens;
}

/** A avaliação completa — o que a tela consome, no editor e no plano salvo (DF②). */
export function avaliarSemana(dias: readonly DiaDoEditor[], ctx: ContextoCritico): Avaliacao {
  const placar = placarDaSemana(dias, ctx);
  return { placar, recomendacoes: recomendacoes(placar), avisos: avisos(dias, placar, ctx) };
}
