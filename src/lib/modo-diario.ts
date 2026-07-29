/**
 * MODO DIÁRIO — o app de quem o gate de saúde roteou (`ROTEAR`).
 *
 * 🔒 Cofre, DF 2026-07-27 (`gate-de-saude-evokorpus` → "`ROTEAR` = MODO DIÁRIO"): quem declara
 * condição de saúde **entra no app**. O que ela não recebe é **PRESCRIÇÃO** — plano de treino
 * gerado, cardápio, meta de cardio, progressão. O que ela recebe é um **diário**: registra o
 * que fez e lê o próprio histórico.
 *
 * A linha, travada no cofre e válida para o produto inteiro:
 * **REGISTRAR É INERTE · PRESCREVER SERIA ORIENTAÇÃO.**
 *
 * 🔴 Trava de escopo: nada de adaptar plano "para a condição". O app **dá um passo atrás** —
 * não avalia, não gradua, não sugere protocolo (Princípio 3 do enquadramento legal). Por isso
 * este módulo é uma lista de **o que some**, nunca uma lista de "o que muda por causa da
 * condição": ele não lê a condição, só o comportamento do gate.
 *
 * Puro e sem relógio — a UI importa a decisão, nunca a re-deriva por conta própria.
 */

import type { ComportamentoGate } from '@/lib/engine/types';

/**
 * Superfícies do app classificadas pela DF. Os nomes são os do cofre para que a lista abaixo
 * seja conferível linha a linha contra a página.
 */
export type Recurso =
  // --- Disponível (é registro ou leitura do que a PRÓPRIA pessoa registrou) ---
  | 'registro_treino_manual'
  | 'registro_refeicao'
  | 'registro_cardio'
  | 'registro_peso'
  | 'chama'
  | 'historico'
  | 'frequencia_grupos'
  // --- Ausente (é prescrição) ---
  | 'plano_treino'
  | 'sessao_guiada'
  | 'cardapio'
  | 'dia_da_dieta'
  | 'meta_cardio'
  | 'progressao';

/** Verbatim da DF: "Disponível: registro manual de treino · registro de refeição · registro de
 *  cardio · registro de peso · Chama · histórico · a visão de frequência por grupo". */
const DISPONIVEL_NO_DIARIO: ReadonlySet<Recurso> = new Set<Recurso>([
  'registro_treino_manual',
  'registro_refeicao',
  'registro_cardio',
  'registro_peso',
  'chama',
  'historico',
  'frequencia_grupos',
]);

/** Verbatim da DF: "Ausente, sem tela vazia e sem 'desbloqueie': plano de treino gerado ·
 *  sessão guiada · cardápio · 'o dia da dieta' com prescrição · meta de cardio · progressão/
 *  mesociclo/rampa". */
const AUSENTE_NO_DIARIO: ReadonlySet<Recurso> = new Set<Recurso>([
  'plano_treino',
  'sessao_guiada',
  'cardapio',
  'dia_da_dieta',
  'meta_cardio',
  'progressao',
]);

/** O gate roteou → o app roda em modo diário. Única porta de entrada da decisão. */
export function emModoDiario(comportamento: ComportamentoGate): boolean {
  return comportamento === 'ROTEAR';
}

/**
 * O recurso aparece? Fora do modo diário, tudo aparece (o app normal não é afetado).
 * Dentro dele, só o que a DF listou como disponível.
 */
export function recursoLiberado(recurso: Recurso, modoDiario: boolean): boolean {
  return modoDiario ? DISPONIVEL_NO_DIARIO.has(recurso) : true;
}

/** As duas listas cobrem o universo de recursos e não se sobrepõem — o teste ancora nisto
 *  para que um recurso novo não entre no app sem ser classificado por alguém. */
export const RECURSOS_DISPONIVEIS: readonly Recurso[] = [...DISPONIVEL_NO_DIARIO];
export const RECURSOS_AUSENTES: readonly Recurso[] = [...AUSENTE_NO_DIARIO];
