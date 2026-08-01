/**
 * TÉCNICAS AVANÇADAS — opt-in ELEGÍVEL (Leva F, spec §🥊, DF 2026-07-31).
 *
 * A decisão inverte a de 2026-07-08, **e o critério mudou junto**. A meta-análise de 2026
 * confirma benefício **pequeno em força e não significativo em hipertrofia** — e reabrir
 * **não contesta isso**. 🔑 O argumento do testador não é eficácia, é **RECONHECIMENTO**:
 * *"não tem as técnicas que eu geralmente utilizo"*. Ninguém usa drop set por ser superior;
 * usa porque é o treino dele.
 *
 * 🔒 CONSEQUÊNCIA DE HONESTIDADE, TRAVADA JUNTO: como o benefício **não é superior**, o app
 * **nunca** pode apresentá-las como melhores. São **opção de estilo**, não upgrade — nada de
 * *"treino avançado"*, *"nível pro"* ou *"resultado acelerado"*. Há guard de copy.
 *
 * 🔴 **O MOTOR NUNCA ADICIONA SOZINHO** (§10.1, literal). Este módulo só sabe responder
 * "pode?"; quem escolhe é sempre a pessoa. Nenhuma função daqui é chamada pelo montador.
 *
 * PURO e determinístico: sem relógio, sem rede, sem estado.
 */
import type { Exercise } from '@/lib/data/types';
import type { ComportamentoGate } from './types';
import type { NivelExperiencia } from './treino-types';

/** 🔒 Experiência DEMONSTRADA, não autodeclarada: nível + histórico real. */
export const MIN_SESSOES_ELEGIVEL = 6;
/** Janela da aderência às séries retas (critério 2 do §10.1), em dias. */
export const JANELA_REGRESSAO_DIAS = 14;

export type TecnicaAvancada = 'drop_set' | 'rest_pause' | 'myo_reps' | 'cluster';

/** Lista FECHADA — as quatro que a fonte nomeia. Nada entra sem passar pelo cofre. */
export const TECNICAS: readonly TecnicaAvancada[] = ['drop_set', 'rest_pause', 'myo_reps', 'cluster'] as const;

/**
 * O que o app diz sobre cada técnica.
 *
 * 🔒 **DOSE INTERNA: o cofre NÃO prescreve — decisão travada (DF 2026-07-31).** Ficam
 * **frequência e colocação** (1 por sessão, última série), que são **trilho de segurança**.
 * NÃO entram quanto reduzir no drop set, quantas pausas no rest-pause, quantos segundos no
 * cluster. Três razões, e a terceira é a que fecha:
 *  1. a evidência dá benefício pequeno/não significativo — um número seria **precisão onde
 *     não há evidência**;
 *  2. reabrir foi por **reconhecimento, não eficácia**: a pessoa já sabe como faz o drop set
 *     dela, e dizer o número seria ensinar a um experiente a técnica que ele trouxe de fora;
 *  3. 🔴 **descrever a técnica que o usuário escolheu é orientação geral; prescrever a DOSE
 *     dela encosta em prescrição** (`enquadramento-legal-fitness-brasil`). A linha fica onde
 *     o enquadramento a coloca.
 *
 * O app entrega o texto de **execução e interrupção** (critério 7); a condução é da pessoa.
 * Há guard que falha se um número de dose aparecer na superfície.
 */
export const DESCRICAO_TECNICA: Record<TecnicaAvancada, { rotulo: string; comoExecutar: string; comoInterromper: string }> = {
  drop_set: {
    rotulo: 'Drop set',
    comoExecutar: 'Ao terminar a última série, reduza a carga e continue sem descanso, na mesma forma.',
    comoInterromper: 'Pare assim que a execução perder a forma — não vale completar às custas da técnica.',
  },
  rest_pause: {
    rotulo: 'Rest-pause',
    comoExecutar: 'Ao terminar a última série, descanse poucos segundos e faça mais algumas repetições com a mesma carga.',
    comoInterromper: 'Pare quando a repetição deixar de sair controlada, ou antes se sentir dor.',
  },
  myo_reps: {
    rotulo: 'Myo-reps',
    comoExecutar: 'Depois da última série, faça mini-séries curtas com pausas breves, mantendo a mesma carga.',
    comoInterromper: 'Encerre quando as mini-séries deixarem de sair na forma, sem tentar emendar mais uma.',
  },
  cluster: {
    rotulo: 'Cluster',
    comoExecutar: 'Quebre a última série em blocos curtos, com pausas breves entre eles e a mesma carga.',
    comoInterromper: 'Pare quando a velocidade da repetição cair de forma visível.',
  },
};

/**
 * 🔒 EXERCÍCIO COMPATÍVEL — **critério, não lista** (spec reformulada em 2026-07-31).
 *
 * 🔑 O que decide **não é a classe do exercício, é o que acontece quando a série FALHA.**
 * Máquina e polia entram mesmo com padrão composto — **leg press é composto e entra**, porque
 * a trajetória é imposta e falhar só significa parar. **Composto livre não entra**: ali
 * falhar tem consequência mecânica, a barra no peito.
 *
 * ⚠️ Escrever o CRITÉRIO e não a lista é o que impede a regra de envelhecer: um exercício
 * novo no catálogo é classificado sozinho, sem ninguém precisar lembrar de atualizar um
 * array. *(Medido: nenhum dos 30+ compostos livres passa, todos os guiados passam.)*
 *
 * A decisão é do EXERCÍCIO, não do nível — o nível já foi checado no portão.
 */
export function aceitaTecnica(ex: Exercise): boolean {
  if (ex.tipo !== 'forca_hipertrofia') return false;
  if (ex.padraoMovimento === 'isolado') return true;
  const det = ex.equipamentoDetalhe ?? '';
  // Guiado = a máquina impõe a trajetória. `Peso corporal` e barra/halteres livres, não.
  return /Máquina|Polia/i.test(det);
}

/** Por que NÃO está elegível — cada valor é um critério do §10.1, nomeado. */
export type MotivoInelegivel =
  | 'nivel'          // iniciante
  | 'sem_historico'  // < 6 sessões resistidas registradas
  | 'gate'           // gate de saúde não está limpo (ROTEAR nunca vê)
  | 'regressao'      // regressão ativa por "difícil" nas últimas 2 semanas
  | 'desligado';     // opt-in não ativado

export interface Elegibilidade {
  elegivel: boolean;
  motivo: MotivoInelegivel | null;
}

/**
 * O PORTÃO. Os critérios do §10.1 que o motor consegue verificar — os outros (dose pequena,
 * explicação na 1ª exibição, feedback obrigatório, desligar em 1 toque) são de tela.
 *
 * 🔴 Ordem: o `desligado` vem por ÚLTIMO de propósito. Assim `motivo` responde "por que não
 * apareceria se você ligasse", que é o que a tela precisa dizer a quem ainda não ligou.
 */
export function elegibilidade(args: {
  nivel: NivelExperiencia;
  /** Sessões de treino RESISTIDO registradas (cardio e eventos não contam). */
  sessoesResistidas: number;
  comportamentoGate: ComportamentoGate;
  /** Há regressão ativa por "difícil" em algum grupo nas últimas 2 semanas? */
  regressaoAtiva: boolean;
  /** O opt-in do *Editar perfil* está ligado? (desligado por padrão) */
  ligado: boolean;
}): Elegibilidade {
  const { nivel, sessoesResistidas, comportamentoGate, regressaoAtiva, ligado } = args;
  if (nivel === 'iniciante') return { elegivel: false, motivo: 'nivel' };
  if (!Number.isFinite(sessoesResistidas) || sessoesResistidas < MIN_SESSOES_ELEGIVEL) {
    return { elegivel: false, motivo: 'sem_historico' };
  }
  // 🔒 `ROTEAR` nunca vê a feature. E qualquer comportamento protetivo basta para barrar:
  // o critério é "ausência de sinal de alerta", não "ausência de encaminhamento".
  if (comportamentoGate !== 'PERMITIR') return { elegivel: false, motivo: 'gate' };
  if (regressaoAtiva) return { elegivel: false, motivo: 'regressao' };
  if (!ligado) return { elegivel: false, motivo: 'desligado' };
  return { elegivel: true, motivo: null };
}

/**
 * 🔒 DOSE PEQUENA: **1 técnica por sessão, na última série**.
 *
 * Recebe as escolhas da pessoa e devolve a que vale — a primeira, em ordem estável. Não é
 * "erro" escolher duas: é a dose sendo respeitada sem transformar o excesso em bloqueio.
 */
export function tecnicaDaSessao(
  escolhas: readonly { exercicioId: string; tecnica: TecnicaAvancada }[],
): { exercicioId: string; tecnica: TecnicaAvancada } | null {
  return escolhas[0] ?? null;
}

/**
 * A série em que a técnica se aplica: a ÚLTIMA, sempre.
 * `null` quando o exercício não tem série nenhuma — não existe "última" de zero.
 */
export function serieDaTecnica(totalSeries: number): number | null {
  if (!Number.isFinite(totalSeries) || totalSeries < 1) return null;
  return Math.floor(totalSeries);
}
