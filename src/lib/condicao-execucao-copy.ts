/**
 * 🗣️ A CONDIÇÃO DE EXECUÇÃO, EM PORTUGUÊS — fonte única da frase.
 *
 * O contrato anatômico tem alvos que só são DIRETOS sob uma execução declarada (e104 extensão
 * de coluna × dobradiça de quadril; e139 ação do punho; e85/e88/e89 retroversão pélvica). O
 * vocabulário do pacote (`movimento: 'extensao_coluna'`) é chave de dado, não frase de tela.
 *
 * 🔴 Este módulo existe porque a frase já estava em DUAS telas — o detalhe "O que este
 * exercício aborda" e a cobertura do editor — e duas cópias divergem. Uma frase só, e as duas
 * telas leem daqui.
 *
 * 🔒 O que a frase faz e não faz: ela DESCREVE a condição em termos que a pessoa reconhece no
 * próprio movimento. Ela não promete que declarar a execução seja possível no app hoje (não
 * é — decisão do autor, 2026-09-16), e não transforma condicional em cobertura confirmada.
 *
 * Puro: sem React, sem estado.
 */
import type { CondicaoExecucao } from './data/alvos-anatomicos-tipos';

/**
 * Chave → valor → frase. O termo técnico fica, com a explicação do gesto ao lado: tirar o termo
 * esconderia o que o dado diz; deixá-lo sozinho deixa a frase inútil para quem não é da área.
 */
const TEXTO_CONDICAO: Record<string, Record<string, string>> = {
  movimento: {
    extensao_coluna: 'quando o movimento é de estender a coluna (o tronco sobe pelas costas)',
    dobradica_quadril: 'quando o movimento é de dobradiça de quadril (tronco desce à frente, quadril para trás, coluna parada)',
  },
  acaoPunho: {
    flexao: 'quando o punho flexiona (a palma fecha na direção do antebraço)',
    extensao: 'quando o punho estende (o dorso da mão sobe na direção do antebraço)',
    ambas: 'quando o punho faz os dois sentidos (flexiona e estende)',
  },
  retroversaoPelvica: {
    true: 'quando há retroversão pélvica (a bacia roda para trás e a lombar encosta)',
    false: 'quando não há retroversão pélvica (a bacia fica neutra)',
  },
};

/**
 * A frase de UMA condição. Chave ou valor fora do vocabulário cai no par cru — visível e
 * estranho de propósito: é melhor a tela mostrar que existe uma condição que ninguém traduziu
 * do que esconder a condição inteira.
 */
export function fraseDaCondicao(quando: CondicaoExecucao): string {
  return Object.entries(quando)
    .map(([k, v]) => TEXTO_CONDICAO[k]?.[String(v)] ?? `${k}: ${String(v)}`)
    .join(' e ');
}

/**
 * 🔴 O RÓTULO ÚNICO do estado condicional, decidido pelo autor em 2026-09-16.
 *
 * "Depende da execução" diz que a cobertura existe sob uma condição; "não confirmado" diz que
 * ela NÃO está fechada. As duas metades são necessárias: só a primeira leria como cobertura
 * com ressalva, e só a segunda leria como ausência de trabalho muscular.
 */
export const ROTULO_CONDICIONAL = 'Depende da execução; não confirmado';

/**
 * 🔒 A frase que impede a leitura errada mais provável: "então é só adicionar esse exercício".
 *
 * Não é. O app não registra a execução, então o mesmo exercício entra e a região continua sem
 * confirmação. Dizer isso é o que separa informar de induzir.
 */
export const AVISO_NAO_RESOLVE =
  'Adicionar não confirma esta região: o app não registra como você executa o movimento.';
