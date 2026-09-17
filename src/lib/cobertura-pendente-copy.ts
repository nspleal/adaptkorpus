/**
 * 🔵 A FRASE DA REGIÃO PENDENTE — uma autoridade só, lida pelo plano e pela proposta.
 *
 * 🔑 Existe como módulo puro pela mesma razão de `esforcoDaExcecao`: se cada tela montasse a
 * sua frase, uma envelheceria sozinha e o plano passaria a dizer da mesma lacuna algo
 * diferente do que a proposta disse — que é exatamente o defeito que o item 6 do pedido de
 * 2026-09-17 manda fechar ("coerente com o editor").
 *
 * 🔴 O que nenhuma destas frases faz:
 *  · NÃO diz que o músculo não é ativado. Lacuna do mapa ou do catálogo é ausência de DADO
 *    ou de exercício classificado, nunca ausência de fenômeno;
 *  · NÃO chama a busca de exaustiva. O app examina um conjunto delimitado de alternativas —
 *    trocar o exercício, trocar um par do mesmo grupo, acrescentar um exercício — e a frase
 *    diz o limite que agiu, não "não existe solução";
 *  · NÃO promete que mexer no plano resolveria, e não bloqueia salvar nada.
 */
import type { MotivoRedundancia, MotivoSemCobertura } from './engine/cobertura-anatomica';

/**
 * Por que a região ficou sem exercício com ação direta identificada.
 *
 * ⚠️ `sem_candidato_no_catalogo` e `sem_candidato_elegivel` falam do CATÁLOGO e do que a
 * pessoa marcou no perfil; os três `sem_espaco_*` falam de um limite que a própria pessoa
 * escolheu (tempo) ou que a política do app fixa (estrutura e volume). São coisas diferentes
 * e a copy não as mistura.
 */
export const MOTIVO_SEM_COBERTURA: Record<MotivoSemCobertura, string> = {
  sem_candidato_no_catalogo:
    'nenhum exercício do nosso catálogo tem ação direta identificada para esta parte',
  sem_candidato_elegivel:
    'há exercício para esta parte no catálogo, mas nenhum cabe no equipamento e no nível do seu perfil',
  condicao_de_execucao_nao_declarada:
    'o exercício que cobriria esta parte só a cobre numa execução específica, e essa execução não está declarada',
  slots_do_dia_esgotados:
    'os exercícios deste dia acabaram antes',
  sem_espaco_na_estrutura:
    'este dia já está com o número de exercícios que o seu tempo comporta, e nenhuma troca resolveria sem abrir outra lacuna ou tirar volume de outro grupo',
  sem_espaco_no_tempo:
    'acrescentar mais um exercício passaria do tempo que você escolheu para a sessão',
  sem_espaco_no_volume:
    'acrescentar mais um exercício passaria do volume máximo da semana para esse grupo',
  trocar_custaria_outra_regiao:
    'trocar um exercício por ele deixaria outra parte sem cobertura, ou tiraria volume de outro grupo',
};

/** Por que dois exercícios do mesmo grupo ficaram com a mesma tarefa mecânica. */
export const MOTIVO_REDUNDANCIA: Record<MotivoRedundancia, string> = {
  sem_alternativa_no_catalogo_elegivel:
    'não há, no que você pode usar, outro exercício deste grupo com uma tarefa diferente',
  alternativa_custaria_outro_tempo:
    'a alternativa com outra tarefa mudaria o tempo do dia',
  alternativa_mudaria_credito:
    'a alternativa com outra tarefa tiraria volume de outro grupo',
};

/** A ressalva que acompanha qualquer leitura de cobertura. Presença não é dose. */
export const RESSALVA_PENDENTE =
  'Isto é informação sobre o mapa de exercícios, não um problema no seu treino: não dá para afirmar que a região não trabalha, só que não há exercício com ação direta identificada para ela neste dia.';
