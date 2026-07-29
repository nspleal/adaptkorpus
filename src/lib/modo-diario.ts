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

/**
 * Os TRÊS estados (DF 2026-07-29). Os dois primeiros vinham colapsados num só, e foi
 * exatamente aí que cinco vazamentos passaram: a lista do cofre libera a **feature**, mas
 * feature carrega alvo **por dentro** — a régua na frequência, a copy da meta no cardio, os
 * "Próximos marcos" na Chama. Liberar a feature nunca quis dizer liberar o alvo dela.
 *
 * - `completo` — aparece inteira; não tem camada de alvo.
 * - `sem_alvo` — aparece, **menos** a camada prescritiva (régua, meta, marco futuro).
 * - `ausente`  — não aparece, sem tela vazia e sem "desbloqueie".
 */
export type Disponibilidade = 'completo' | 'sem_alvo' | 'ausente';

/**
 * A classificação. `completo` + `sem_alvo` = a lista "Disponível" verbatim da DF de
 * 2026-07-27; `ausente` = a lista "Ausente" da mesma DF.
 */
export const DISPONIBILIDADE: Readonly<Record<Recurso, Disponibilidade>> = {
  // Disponíveis e sem nada de alvo dentro.
  registro_treino_manual: 'completo',
  registro_refeicao: 'completo',
  registro_peso: 'completo',
  historico: 'completo',
  // Disponíveis, mas com camada prescritiva que precisa sumir — cada um destes tem um
  // guard estático provando que ela some (ver `modo-diario.test.ts`).
  frequencia_grupos: 'sem_alvo', // a régua de 2×/semana
  registro_cardio: 'sem_alvo',   // a meta semanal de minutos
  chama: 'sem_alvo',             // o bloco "Próximos marcos" ("faltam 7 dias")
  // Ausentes: são prescrição inteira.
  plano_treino: 'ausente',
  sessao_guiada: 'ausente',
  cardapio: 'ausente',
  dia_da_dieta: 'ausente',
  meta_cardio: 'ausente',
  progressao: 'ausente',
};

/** O gate roteou → o app roda em modo diário. Única porta de entrada da decisão. */
export function emModoDiario(comportamento: ComportamentoGate): boolean {
  return comportamento === 'ROTEAR';
}

/** Como o recurso entra na tela em modo diário. Fora dele, tudo é `completo`. */
export function disponibilidade(recurso: Recurso, modoDiario: boolean): Disponibilidade {
  return modoDiario ? DISPONIBILIDADE[recurso] : 'completo';
}

/**
 * O recurso APARECE? `sem_alvo` conta como disponível — o que some ali é a camada de alvo,
 * não a tela. (Assinatura preservada: é o que a UI já chamava.)
 */
export function recursoLiberado(recurso: Recurso, modoDiario: boolean): boolean {
  return disponibilidade(recurso, modoDiario) !== 'ausente';
}

const daClasse = (d: Disponibilidade): Recurso[] =>
  (Object.keys(DISPONIBILIDADE) as Recurso[]).filter((r) => DISPONIBILIDADE[r] === d);

/** Recursos que aparecem em modo diário (`completo` + `sem_alvo`). */
export const RECURSOS_DISPONIVEIS: readonly Recurso[] = [...daClasse('completo'), ...daClasse('sem_alvo')];
/** Os que aparecem PODADOS — cada um exige guard estático no teste. */
export const RECURSOS_SEM_ALVO: readonly Recurso[] = daClasse('sem_alvo');
export const RECURSOS_AUSENTES: readonly Recurso[] = daClasse('ausente');

/**
 * 🔒 A REGRA GENERALIZÁVEL (DF 2026-07-29), destilada dos cinco vazamentos desta leva:
 *
 *   **EM MODO DIÁRIO, NADA FALA NO FUTURO DA ATIVIDADE DA PESSOA.**
 *
 * Passa: "14 dias de chama" · "hoje você registrou" · "Variação" · qualquer contagem do que
 * ocorreu. Não passa: "faltam 7 dias" · "2× por semana" · "abaixo da referência" · "ao longo
 * do ciclo" · "não entra nos minutos da meta" · barra/pip/marcador esperando ser preenchido.
 *
 * Teste de uma linha: **a frase fala do FUTURO da atividade dela? Se sim, é alvo, e sai.**
 *
 * O léxico abaixo é a forma executável disso. Cada entrada saiu de um vazamento real, e o
 * conjunto pega os cinco sem pegar nada do que deve ficar.
 */
export const FALA_NO_FUTURO: readonly RegExp[] = [
  /falta[m]?\s+\d+\s+dias?/i,          // "faltam 7 dias" — Chama
  /falta\s+1\s+dia/i,
  /pr[óo]ximos?\s+marcos?/i,            // o bloco inteiro
  /\d+×?\s*(vezes?\s*)?por semana/i,   // "2× por semana" — régua
  /ao menos\s+\d+/i,
  /abaixo da refer[êe]ncia/i,           // legenda "Como ler"
  /ao longo do ciclo/i,                 // rodapé da frequência
  /minutos da meta/i,                   // copy do cardio leve
  /[ée] o esperado/i,                   // LEGENDA_UM_DIA
  /pode fechar em/i,                    // leitura de meio de semana
  /mant[ée]m seu plano/i,               // subtítulo do registro de peso
  /ainda vai (crescer|subir|aumentar)|vai crescer|\d+ de \d+ dias?[^.]{0,40}j[áa] passaram/i, // 12º: o cartão de meio de semana
];

/** A frase fala do futuro da atividade da pessoa? (Aplicação direta da regra acima.) */
export function falaNoFuturo(texto: string): boolean {
  return FALA_NO_FUTURO.some((re) => re.test(texto));
}

/**
 * 🔒 A SEGUNDA CLASSE (DF 2026-07-29). Sete achados numa leva já varrida não era
 * reincidência: era uma classe inteira sem rede. A regra do futuro fechava só uma.
 *
 *   **CLASSE 2 — a frase pressupõe um plano ou prescrição que essa pessoa NÃO TEM.**
 *
 * Pega: "não entra nos minutos da meta" · "mantém seu plano calibrado" · "Como seu plano
 * evolui" · "não mudam o seu cardápio" · "Plano e preferências" · "compostos a 6 reps".
 * Não pega: "14 dias de chama" · "hoje você registrou" · "Variação" · "Um período sem
 * registro não é um problema" · a copy do treino fora da biblioteca.
 *
 * É MAIS mecanizável que a classe 1 porque o vocabulário é fechado — são substantivos do
 * produto, não formas verbais.
 */
export const SUBSTANTIVOS_DE_PRESCRICAO: readonly RegExp[] = [
  /\bplano\b/i,
  /\bcard[áa]pio\b/i,
  /\bmeta\b|\bmetas\b/i,
  /\bprescri[çc][ãa]o\b/i,
  /\bprazo\b/i,
  /recalcul(a|am|o|ar)|rec[áa]lculo/i,
  /adaptativ[ao]s?/i,
  /modo for[çc]a/i,
  /\bprogress[ãa]o\b/i,
];

/**
 * A frase pressupõe prescrição? Aplicação direta da regra da classe 2.
 *
 * ⚠️ NEGAR a existência da prescrição NÃO é pressupô-la: "o app não monta treino nem
 * cardápio para você" é justamente a mensagem que o modo diário precisa dizer. Por isso o
 * guard trabalha com EXCEÇÕES DECLARADAS (ver a tabela no teste) e não com uma varredura
 * cega — a mais importante delas é o cartão permanente de encaminhamento ao profissional,
 * que legitimamente usa "plano" e "cardápio" para dizer que eles não existem.
 */
export function pressupoePrescricao(texto: string): boolean {
  return SUBSTANTIVOS_DE_PRESCRICAO.some((re) => re.test(texto));
}

/**
 * 🔒 A TERCEIRA FORMA (DF 2026-07-29) — **o DENOMINADOR**.
 *
 * "1 de 4 refeições" não foi pego por nenhuma das duas redes anteriores, e o motivo é
 * estrutural: o léxico procura **futuro**, o guard procura **substantivo**, o detector
 * procura **desenho**. `1 de 4` é **alvo sem verbo e sem substantivo** — o denominador
 * sozinho já afirma um total esperado. É a forma exata do controle positivo do plano
 * ("0 de 1 a 2 sessões").
 *
 * A prova de que é alvo estava no mesmo cartão: "2 treinos" e "30 min de cardio" são
 * contagem pura. Só a refeição carregava denominador, herdado da estrutura do cardápio.
 *
 *   **Teste: a string afirma um total do qual a pessoa cumpriu uma parte?**
 */
const DENOMINADOR_DE = /\b\d+\s+de\s+\d+\b/i;
/**
 * ⚠️ A forma com barra é AMBÍGUA por estrutura: `2/4` (dois de quatro) e `2/4` (2 de abril)
 * são a mesma string. Lista de exceções não fecha — data é classe infinita. O que separa as
 * duas na prática é o SUBSTANTIVO CONTÁVEL depois: "2/4 registradas" é denominador,
 * "27/07 a 02/08" e "12/2026" não têm substantivo depois da barra.
 */
// ⚠️ `[ \t]+`, não `\s+`: em texto renderizado o `\s` atravessa quebra de linha, e
// "27/07 a 02/08\nSemana de..." virava falso positivo. O substantivo tem de estar na
// MESMA LINHA da barra para contar como denominador.
const DENOMINADOR_BARRA = /\b\d+\s*\/\s*\d+[ \t]+\p{L}{3,}/u;

/**
 * Datas por extenso são o falso-positivo óbvio de `N de M` ("29 de julho"). São podadas
 * ANTES do teste — data não é numerador sobre total. As numéricas (`27/07`) não precisam de
 * poda: elas caem fora por não terem substantivo contável depois.
 */
const FORMAS_DE_DATA: readonly RegExp[] = [
  /\b\d{1,2}\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/gi,
];

/** A string afirma um total do qual só uma parte foi cumprida? (Datas não contam.) */
export function afirmaDenominador(texto: string): boolean {
  let t = texto;
  for (const re of FORMAS_DE_DATA) t = t.replace(re, ' ');
  return DENOMINADOR_DE.test(t) || DENOMINADOR_BARRA.test(t);
}
