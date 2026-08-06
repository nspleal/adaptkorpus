/**
 * 🎛️ v3 · BLOCO A — EDIÇÃO MANUAL COMO **PREFERÊNCIA** (DF 2026-07-31, cofre
 * `parametros-motor-treino-evokorpus` §"A FORMA da edição manual").
 *
 * 🔒 **A edição é INPUT do gerador, nunca patch na saída.** O Passo 0 da Leva G mediu que a
 * rotina **não é persistida em lugar nenhum**: `rotinaDias` é memória de render e **cinco
 * lugares** a sobrescrevem inteira. Override morreria no primeiro reload — e, pior,
 * **congelaria a pessoa fora de todo conserto futuro do motor** (sem descanso por classe,
 * sem rampa, sem peso suavizado). *Override não é só uma segunda verdade: é segunda verdade
 * que envelhece sozinha.*
 *
 * 🔑 O molde é o dos **favoritos**, que já sobrevivem ao recompute porque **vivem no perfil**
 * e o montador os lê como entrada. A preferência usa o mesmo trilho:
 *   · *"neste slot, prefiro X"* → o preterido sai do pool e o preferido entra como FIXO;
 *   · *"não quero mais Y"* → Y sai do pool (atende o gatilho da B5 — *"enjoei"* — **sem**
 *     rotação automática, que quebraria a dupla progressão).
 *
 * 🔴 As duas travas que a forma exige, e que este módulo executa:
 *   1. **A preferência respeita os trilhos** (equipamento, nível, papel do slot). A que fura
 *      é **RECUSADA COM EXPLICAÇÃO** — nunca aplicada, nunca ignorada em silêncio.
 *   2. **Banimento que esvaziaria um slot é recusado, não obedecido.** O vazio apareceria no
 *      meio do treino, não na hora do banimento.
 *
 * PURO e determinístico: sem relógio, sem rede, sem estado.
 */
import type { Exercise, EquipamentoDisp, EquipamentoCasa, PadraoMovimento } from '../data/types';
import type { NivelExperiencia } from './treino-types';
import { exercicioDisponivel } from './equipamento';
import { dificuldadesLiberadas } from './treino';

/** 🏷️ Procedência e versão do trilho (§16 da pesquisa: sem rótulo, a auditoria herda a confusão). */
export const PREFERENCIAS_TRILHO = {
  procedencia: 'politica' as const,
  versao: 'v3.0' as const,
  desde: '2026-08-04',
};

/** *"Neste slot, prefiro X"* — onde o gerador colocaria `de`, passa a colocar `para`. */
export interface TrocaPreferida {
  de: string;
  para: string;
}

export interface PreferenciasTreino {
  trocas: readonly TrocaPreferida[];
  /** *"Não quero mais Y"* — o exercício sai do pool do gerador. */
  banidos: readonly string[];
}

export const PREFERENCIAS_VAZIAS: PreferenciasTreino = { trocas: [], banidos: [] };

/**
 * 🔒 Vocabulário FECHADO dos motivos de recusa. Fechado porque cada motivo vira evento de
 * telemetria e frase de tela — motivo novo é decisão, não string nova.
 */
export type MotivoRecusa =
  | 'exercicio_desconhecido'
  | 'mesmo_exercicio'
  | 'equipamento'
  | 'nivel'
  | 'papel_diferente'
  | 'esvaziaria_o_treino'
  /** 🎛️ v3.1 — foco de core sem folga de séries. É PAYLOAD: não exige migration. */
  | 'core_sem_folga';

export interface Veredito {
  aceita: boolean;
  motivo?: MotivoRecusa;
  /** 🔑 Frase para a pessoa. A recusa que não explica é a recusa silenciosa com outro nome. */
  explicacao?: string;
}

const OK: Veredito = { aceita: true };
const nao = (motivo: MotivoRecusa, explicacao: string): Veredito => ({ aceita: false, motivo, explicacao });

export interface ContextoPreferencia {
  exercises: readonly Exercise[];
  equipamento: EquipamentoDisp;
  equipamentosCasa?: readonly EquipamentoCasa[];
  nivelExperiencia: NivelExperiencia;
  /** Banimentos já em vigor — o banimento novo é avaliado SOMADO a eles. */
  banidos?: readonly string[];
}

/** O pool que o montador enxergaria: equipamento + dificuldade liberada, menos os banidos. */
function poolElegivel(ctx: ContextoPreferencia, banidosExtra: readonly string[] = []): Exercise[] {
  const liberadas = new Set(dificuldadesLiberadas(ctx.nivelExperiencia));
  const fora = new Set([...(ctx.banidos ?? []), ...banidosExtra]);
  return ctx.exercises.filter(
    (e) => !fora.has(e.id) && exercicioDisponivel(e, ctx.equipamento, ctx.equipamentosCasa) && liberadas.has(e.nivel),
  );
}

/**
 * *"Neste slot, prefiro X"* — a preferência passa nos trilhos?
 *
 * ⚠️ O trilho do **papel** (`padraoMovimento` igual) não é burocracia: o split monta o dia
 * por padrão e o motor tem invariantes que dependem disso (puxar ≥ empurrar, core 2–3×/sem).
 * Trocar um puxar por um isolado não é preferência — é desmontar o dia por outra porta.
 */
export function avaliarTroca(ctx: ContextoPreferencia, troca: TrocaPreferida): Veredito {
  const de = ctx.exercises.find((e) => e.id === troca.de);
  const para = ctx.exercises.find((e) => e.id === troca.para);
  if (!de || !para) return nao('exercicio_desconhecido', 'Não encontramos esse exercício na biblioteca.');
  if (de.id === para.id) return nao('mesmo_exercicio', 'Esse já é o exercício do seu plano.');

  if (!exercicioDisponivel(para, ctx.equipamento, ctx.equipamentosCasa)) {
    return nao('equipamento', `${para.nomePt} pede um equipamento que você não marcou. Ajuste o equipamento no perfil e ele passa a aparecer.`);
  }
  if (!dificuldadesLiberadas(ctx.nivelExperiencia).includes(para.nivel)) {
    return nao('nivel', `${para.nomePt} está acima do nível que o seu plano libera hoje. Conforme você avança, ele entra.`);
  }
  if (para.padraoMovimento !== de.padraoMovimento) {
    return nao('papel_diferente', `${para.nomePt} trabalha um movimento diferente de ${de.nomePt}, e esse lugar do treino existe para o movimento dele. Dá para trocar por outro do mesmo tipo.`);
  }
  return OK;
}

/**
 * *"Não quero mais Y"* — o banimento passa?
 *
 * 🔴 A trava: o catálogo tem uma invariante testada de **exatamente 3 conjuntos vazios**
 * (`logica-de-substituicao`). Deixar banir até o vazio quebraria a única garantia de que todo
 * slot tem saída — e o vazio apareceria **no meio do treino**.
 *
 * 🔑 Critério DERIVADO, não lista: o banimento é recusado quando **zera um padrão de
 * movimento** que ainda tinha opção. Assim ele cobre exercício que hoje é o último do seu
 * padrão e o que vier a ser amanhã, sem ninguém manter lista nenhuma.
 */
export function avaliarBanimento(ctx: ContextoPreferencia, id: string): Veredito {
  const alvo = ctx.exercises.find((e) => e.id === id);
  if (!alvo) return nao('exercicio_desconhecido', 'Não encontramos esse exercício na biblioteca.');

  const antes = poolElegivel(ctx);
  const depois = poolElegivel(ctx, [id]);
  const conta = (lista: readonly Exercise[], padrao: PadraoMovimento) => lista.filter((e) => e.padraoMovimento === padrao).length;
  const padrao = alvo.padraoMovimento;
  if (conta(antes, padrao) > 0 && conta(depois, padrao) === 0) {
    return nao('esvaziaria_o_treino', `${alvo.nomePt} é o último exercício desse movimento no seu equipamento. Se ele sair, esse lugar do treino fica sem opção — então ele fica.`);
  }
  return OK;
}

/**
 * As preferências ACEITAS, prontas para o montador consumir como entrada.
 *
 * 🔒 Revalida na montagem, não só na hora do clique: equipamento e nível mudam no perfil, e
 * uma preferência guardada ontem pode ter deixado de caber hoje. Preferência que não cabe é
 * **ignorada na geração** (o plano sai correto) e continua guardada — se a pessoa voltar a
 * ter o equipamento, ela volta a valer sozinha.
 */
export function preferenciasEfetivas(
  ctx: ContextoPreferencia,
  prefs: PreferenciasTreino | undefined,
): { preteridos: ReadonlySet<string>; preferidos: ReadonlySet<string>; banidos: ReadonlySet<string> } {
  const preteridos = new Set<string>();
  const preferidos = new Set<string>();
  const banidos = new Set<string>();
  if (!prefs) return { preteridos, preferidos, banidos };

  for (const id of prefs.banidos) {
    if (avaliarBanimento({ ...ctx, banidos: [...banidos] }, id).aceita) banidos.add(id);
  }
  for (const t of prefs.trocas) {
    if (banidos.has(t.para)) continue; // banido vence: a pessoa disse "não quero mais" depois
    if (avaliarTroca({ ...ctx, banidos: [...banidos] }, t).aceita) {
      preteridos.add(t.de);
      preferidos.add(t.para);
    }
  }
  return { preteridos, preferidos, banidos };
}
