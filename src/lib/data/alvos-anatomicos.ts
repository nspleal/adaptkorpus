/**
 * 🦴 LEITURA TIPADA da classificação anatômica prática — a porta única.
 *
 * Contrato: `alvos-anatomicos-tipos.ts`. Dados: `alvos-anatomicos-dados.ts` (gerado por
 * `scripts/gerar-alvos-anatomicos.mjs`). Ninguém importa os dados direto: importa aqui.
 *
 * É o porte fiel de `consulta.py` do pacote — mesmas regras de recusa, mesmas saídas, mesmos
 * nomes de campo. O Python fica como referência funcional e NÃO viaja para o bundle; o teste
 * `alvos-anatomicos.test.ts` reproduz os 23 casos de `testar.py` sobre esta implementação.
 *
 * 🔒 Para o MOTOR: puro e determinístico (mapa estático, sem rede, sem relógio, sem
 * aleatório) — importável de `src/lib/engine` sem quebrar a regra do motor.
 *
 * 🔴 Três recusas que este módulo NUNCA relaxa, porque são o contrato:
 *  1. **id/alvo desconhecido é erro**, não lista vazia — silêncio aqui viraria "não participa";
 *  2. **condição não declarada não resolve** — e104, e139 e e85/e88/e89 ficam PENDENTES, e
 *     pendente não cobre nem nega;
 *  3. **auxiliar e cardio não fecham cobertura direta** — aparecem no diagnóstico, separados.
 *
 * 🔴 O que este módulo não tem, de propósito: peso de ativação, peso de hipertrofia, score,
 * quota regional e equivalência entre exercícios. A cobertura anatômica escolhe ENTRE os
 * elegíveis; ela não decide série, tempo, descanso, foco nem dose.
 */
import type {
  AlvoAnatomico, AlvoId, AlvoResolvido, CoberturaAnatomica, CondicaoExecucao,
  CondicionalAnatomica, ConsultaAnatomica, ExercicioAnatomico, PapelDoAlvo,
} from './alvos-anatomicos-tipos';
import {
  ALVOS_ANATOMICOS, ANATOMIA_POR_EXERCICIO, GRUPOS_DE_ALVO, PROCEDENCIA_ANATOMICA,
  TIPOS_DE_ALVO, VOCABULARIO_CONDICAO,
} from './alvos-anatomicos-dados';

export type {
  AlvoAnatomico, AlvoId, AlvoResolvido, CoberturaAnatomica, CondicaoExecucao,
  CondicionalAnatomica, ConsultaAnatomica, ExercicioAnatomico, PapelDoAlvo,
} from './alvos-anatomicos-tipos';
export type { TipoDeAlvo, UsoAnatomico } from './alvos-anatomicos-tipos';
export {
  ALVOS_ANATOMICOS, ANATOMIA_POR_EXERCICIO, GRUPOS_DE_ALVO, PROCEDENCIA_ANATOMICA,
  TIPOS_DE_ALVO, VOCABULARIO_CONDICAO,
};

/**
 * 🔴 A ressalva que acompanha qualquer leitura de cobertura. Não é opcional e não é
 * decorativa: sem ela, uma lista de alvos "abordados" lê-se como promessa de resultado.
 */
export const RESSALVA_COBERTURA =
  'Presença anatômica não comprova dose suficiente nem predominância. Não é veredito de segurança ou bloqueio.';

const VAZIO: readonly never[] = Object.freeze([]);

/** A classificação crua de um id, ou `undefined` se o catálogo do pacote não o cobre. */
export function anatomiaDe(id: string): ExercicioAnatomico | undefined {
  return ANATOMIA_POR_EXERCICIO[id];
}

/** Um dos 44 alvos, ou `undefined`. */
export function alvoDe(alvo: AlvoId): AlvoAnatomico | undefined {
  return ALVOS_ANATOMICOS[alvo];
}

/** O alvo existe no vocabulário do pacote? */
export function alvoConhecido(alvo: AlvoId): boolean {
  return Object.hasOwn(ALVOS_ANATOMICOS, alvo);
}

/**
 * Alvos do GRUPO do pacote (`peito`, `costas`, `adutores`…), na ordem estável do mapa.
 *
 * 🔴 Grupo do PACOTE, não `GrupoPrimario` do catálogo: `adutores`, `flexores_quadril` e
 * `perna_anterior` existem aqui e não são grupos do app. Quem traduz um para o outro é o
 * chamador — e o motor só traduz os 12 que já são obrigação de dia, para não converter
 * sinergista em grupo obrigatório novo.
 */
export function alvosDoGrupo(grupo: string): readonly AlvoId[] {
  return Object.keys(ALVOS_ANATOMICOS).filter((a) => ALVOS_ANATOMICOS[a]!.grupo === grupo);
}

/**
 * Valida uma condição de execução contra o vocabulário fechado do pacote.
 *
 * Recusa, como `consulta.py`: chave que este exercício não declara, valor fora do
 * vocabulário e valor do TIPO errado — a string `'false'` e o número `1` não são o booleano
 * `false`. A conversão frouxa é justamente como uma execução não declarada viraria cobertura.
 */
function validarCondicoes(e: ExercicioAnatomico, condicoes: CondicaoExecucao): void {
  const permitidas = new Set(e.condicionais.flatMap((c) => Object.keys(c.quando)));
  for (const chave of Object.keys(condicoes)) {
    if (!permitidas.has(chave)) throw new Error(`Condição não definida para este exercício: ${chave}`);
    const valor = condicoes[chave]!;
    const declarados = e.condicionais.filter((c) => chave in c.quando).map((c) => c.quando[chave]!);
    const casa = declarados.some((d) => typeof d === typeof valor && d === valor);
    // 🔒 Único negativo aceito sem aparecer em nenhum `quando`: declarar que NÃO houve
    // retroversão pélvica. É informação de execução, e informação nega; silêncio não.
    const negativoDeclarado = typeof valor === 'boolean' && valor === false
      && (VOCABULARIO_CONDICAO as Readonly<Record<string, readonly (string | boolean)[]>>)[chave]?.includes(false) === true;
    if (!casa && !negativoDeclarado) throw new Error(`Valor inválido para ${chave}`);
  }
}

/**
 * Consulta os alvos de UM id, resolvendo apenas as condições DECLARADAS.
 *
 * @throws se o id não existe, se uma chave de condição não pertence a este exercício, ou se
 *   um valor está fora do vocabulário. Erro, e não silêncio: um typo não pode virar cobertura.
 */
export function alvosDoExercicio(id: string, condicoes?: CondicaoExecucao): ConsultaAnatomica {
  const e = ANATOMIA_POR_EXERCICIO[id];
  if (!e) throw new Error(`Exercício desconhecido: ${id}`);
  const dadas = condicoes ?? {};
  validarCondicoes(e, dadas);

  const alvos: AlvoResolvido[] = e.alvos.map(([alvo, papel]) => ({
    alvo, papel, base: 'inferencia_anatomica', porCondicao: false,
  }));
  const condicionaisNaoResolvidas: CondicionalAnatomica[] = [];
  for (const c of e.condicionais) {
    const chaves = Object.keys(c.quando);
    if (!chaves.every((k) => k in dadas)) { condicionaisNaoResolvidas.push(c); continue; }
    const satisfeita = chaves.every((k) => typeof dadas[k] === typeof c.quando[k] && dadas[k] === c.quando[k]);
    if (!satisfeita) continue;
    for (const alvo of c.alvos) {
      alvos.push({ alvo, papel: c.papel, base: 'inferencia_anatomica', porCondicao: true });
    }
  }
  return { id, regra: e.regra, uso: e.uso, alvos, condicionaisNaoResolvidas };
}

/** Alvos DIRETOS de um id (conjunto), já resolvidas as condições declaradas. */
export function diretosDe(id: string, condicoes?: CondicaoExecucao): Set<AlvoId> {
  return new Set(alvosDoExercicio(id, condicoes).alvos.filter((a) => a.papel === 'direto').map((a) => a.alvo));
}

export interface OpcoesCobertura {
  condicoesPorId?: Readonly<Record<string, CondicaoExecucao>>;
  /**
   * 🔴 `false` NÃO certifica nada: recusar a inferência apenas esvazia os abordados, porque
   * esta camada inteira é inferência anatômica. Existe para quem quiser ver o que sobraria se
   * só medição contasse — e a resposta é: nada.
   */
  aceitarInferencia?: boolean;
}

/**
 * Diagnóstico de cobertura de um CONJUNTO de ids contra os alvos desejados.
 *
 * Presença, não volume: cada alvo conta UMA vez, e um exercício pode abordar vários — não se
 * exige um exercício distinto por cabeça. Auxiliar e cardio aparecem em campos próprios e
 * jamais entram em `abordadosPorInferencia`.
 *
 * @throws se houver id repetido (seria contagem de volume, que este módulo não faz), se um
 *   alvo desejado não existir, ou se houver condição para um id fora do conjunto.
 */
export function avaliarCobertura(
  ids: readonly string[],
  alvosDesejados: readonly AlvoId[],
  opcoes: OpcoesCobertura = {},
): CoberturaAnatomica {
  if (new Set(ids).size !== ids.length) {
    throw new Error('IDs repetidos: esta consulta é de presença de alvos, não de volume');
  }
  const desconhecidos = alvosDesejados.filter((a) => !alvoConhecido(a)).sort();
  if (desconhecidos.length > 0) throw new Error(`Alvos desconhecidos: ${desconhecidos.join(', ')}`);
  const condicoesPorId = opcoes.condicoesPorId ?? {};
  const noConjunto = new Set(ids);
  for (const id of Object.keys(condicoesPorId)) {
    if (!noConjunto.has(id)) throw new Error('Condições de exercício ausente');
  }
  const aceitarInferencia = opcoes.aceitarInferencia ?? true;
  const desejados = new Set(alvosDesejados);

  const diretos: Record<AlvoId, string[]> = {};
  const aux: Record<AlvoId, string[]> = {};
  const cardio: Record<AlvoId, string[]> = {};
  const pendentes: Record<AlvoId, { id: string; quando: CondicaoExecucao; papel: PapelDoAlvo }[]> = {};

  for (const id of ids) {
    const e = alvosDoExercicio(id, condicoesPorId[id]);
    for (const a of e.alvos) {
      if (!desejados.has(a.alvo)) continue;
      if (a.papel === 'informativo_cardio') (cardio[a.alvo] ??= []).push(id);
      else if (a.papel === 'direto' && aceitarInferencia) (diretos[a.alvo] ??= []).push(id);
      else if (a.papel === 'auxiliar') (aux[a.alvo] ??= []).push(id);
    }
    for (const c of e.condicionaisNaoResolvidas) {
      for (const alvo of c.alvos) {
        if (desejados.has(alvo)) (pendentes[alvo] ??= []).push({ id, quando: c.quando, papel: c.papel });
      }
    }
  }

  return {
    abordadosPorInferencia: diretos,
    participacaoAuxiliar: aux,
    condicionaisNaoResolvidas: pendentes,
    participacaoCardio: cardio,
    semAlvoDiretoNesteConjunto: [...desejados].filter((a) => !(a in diretos)).sort(),
    mensagem: RESSALVA_COBERTURA,
  };
}

/**
 * Quem pode abordar um alvo diretamente: incondicionalmente, ou mediante execução declarada.
 *
 * Ids de cardio ficam de fora — participação informativa não é candidatura. Alvo sem nenhum
 * candidato devolve as duas listas VAZIAS: é o diagnóstico honesto (`it`, tibial anterior, e
 * `mu`, multífido, estão nesse caso), não um convite a inventar exercício.
 */
export function candidatosParaAlvo(alvo: AlvoId): { diretos: string[]; condicionais: string[] } {
  if (!alvoConhecido(alvo)) throw new Error(`Alvo desconhecido: ${alvo}`);
  const diretos: string[] = [];
  const condicionais: string[] = [];
  for (const [id, e] of Object.entries(ANATOMIA_POR_EXERCICIO)) {
    if (e.uso === 'somente_informativo_cardio') continue;
    if (e.alvos.some(([a, p]) => a === alvo && p === 'direto')) diretos.push(id);
    if (e.condicionais.some((c) => c.papel === 'direto' && c.alvos.includes(alvo))) condicionais.push(id);
  }
  return { diretos, condicionais };
}

/** Ids sem classificação nenhuma — vazio enquanto catálogo e pacote tiverem os mesmos 168. */
export function idsSemAnatomia(ids: readonly string[]): readonly string[] {
  const faltando = ids.filter((id) => !Object.hasOwn(ANATOMIA_POR_EXERCICIO, id));
  return faltando.length > 0 ? faltando : VAZIO;
}
