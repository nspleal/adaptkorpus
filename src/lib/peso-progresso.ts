/**
 * 🔒 O QUE A TELA DE PROGRESSO PODE DIZER SOBRE PESO — separação entre **peso do perfil** e
 * **pesagens reais**.
 *
 * 🔴 F3 (fechamento dirigido de `7a8f2c2`, QA autenticada 2026-09-11): a tela dizia
 * "2 registros" com **uma** pesagem no banco, e a variação exibida mudou de `-1` para `0`
 * ao recarregar. Causa: o Painel abre a série com uma SEMENTE sem data
 * (`{ dataISO: null, kg: perfil.pesoKg }`) e a tela contava `pesos.length` e calculava
 * `atual - pesos[0]`. Isso faz três coisas erradas de uma vez:
 *  · **conta** o peso do perfil como se fosse uma pesagem;
 *  · **inventa um passado**: o peso atual do perfil passa a ser o "primeiro ponto" do
 *    histórico, que é justamente o que ele não é;
 *  · torna a variação **instável**: antes do reload a semente é o peso ANTIGO do perfil
 *    (variação −1), depois do reload é o peso NOVO (variação 0) — o mesmo histórico
 *    contando duas histórias diferentes.
 *
 * 🔒 REFERÊNCIA DA VARIAÇÃO, DECLARADA: é a **primeira pesagem datada** da série (a mais
 * antiga). Ela é estável porque vem do histórico, nunca do perfil — recarregar não a move.
 * Com menos de duas pesagens datadas **não há variação**: a tela diz que não há comparação,
 * em vez de exibir um número derivado do peso do perfil.
 *
 * 🔴 O QUE ESTE MÓDULO NÃO FAZ, DE PROPÓSITO: não toca a âncora do motor
 * (`resolverPesoDoPlanoLocal` continua lendo a série com a semente, e já ignora registro sem
 * data na janela de 7 dias), não mexe em dieta/cardio (que leem `perfil.pesoKg`) e não
 * altera a regra de uma pesagem por dia. É **só exibição**.
 */
import type { RegistroPeso } from './treino-historico';

/** Por que não há variação a exibir. */
export type SemComparacao = 'NENHUMA_PESAGEM' | 'UMA_PESAGEM';

export type VariacaoPeso =
  | { tipo: 'SEM_COMPARACAO'; motivo: SemComparacao }
  | {
      tipo: 'COMPARADA';
      kg: number;
      /** Referência declarada: a primeira pesagem datada. */
      deISO: string;
      deKg: number;
      ateISO: string;
    };

export type ResumoPesoExibido = {
  /** Quantas pesagens DATADAS existem. A semente do perfil nunca entra. */
  registros: number;
  /** Peso a exibir como "atual". */
  atualKg: number;
  /** `false` quando `atualKg` é o peso do PERFIL porque ainda não há pesagem alguma. */
  atualEhPesagem: boolean;
  variacao: VariacaoPeso;
  /** Série do gráfico: só pesagens datadas, em ordem de dia. Vazia = nada a desenhar. */
  serieKg: number[];
};

/**
 * Resumo exibível a partir da série do Painel (que inclui a semente sem data) e do peso
 * corrente do perfil.
 *
 * ⚠️ Registro sem data (`dataISO: null`) é descartado AQUI para fins de contagem, variação e
 * gráfico. Isso alcança a semente e também os registros legados de antes da Leva D — e é o
 * comportamento honesto: sem dia não se sabe onde o ponto entra na linha do tempo, e é
 * exatamente essa ignorância que produzia a variação instável.
 */
export function resumoPesoExibido(
  pesos: readonly RegistroPeso[],
  pesoDoPerfilKg: number,
): ResumoPesoExibido {
  const datadas = pesos
    .filter((p): p is RegistroPeso & { dataISO: string } => typeof p.dataISO === 'string' && p.dataISO.length > 0)
    .slice()
    .sort((a, b) => (a.dataISO < b.dataISO ? -1 : a.dataISO > b.dataISO ? 1 : 0));

  const serieKg = datadas.map((p) => p.kg);
  const ultima = datadas[datadas.length - 1];
  const primeira = datadas[0];

  if (!ultima || !primeira) {
    return {
      registros: 0,
      atualKg: pesoDoPerfilKg,
      atualEhPesagem: false,
      variacao: { tipo: 'SEM_COMPARACAO', motivo: 'NENHUMA_PESAGEM' },
      serieKg,
    };
  }
  if (datadas.length === 1) {
    return {
      registros: 1,
      atualKg: ultima.kg,
      atualEhPesagem: true,
      variacao: { tipo: 'SEM_COMPARACAO', motivo: 'UMA_PESAGEM' },
      serieKg,
    };
  }
  return {
    registros: datadas.length,
    atualKg: ultima.kg,
    atualEhPesagem: true,
    variacao: {
      tipo: 'COMPARADA',
      kg: ultima.kg - primeira.kg,
      deISO: primeira.dataISO,
      deKg: primeira.kg,
      ateISO: ultima.dataISO,
    },
    serieKg,
  };
}

/** Rótulo da variação. `null` = não há número a exibir (a tela mostra a ausência). */
export function rotuloVariacao(v: VariacaoPeso): string | null {
  if (v.tipo !== 'COMPARADA') return null;
  return `${v.kg >= 0 ? '+' : ''}${v.kg.toFixed(1)}`;
}

/**
 * Frase da ausência de comparação. Fala do APP e do histórico, no passado/presente — nunca
 * promete evolução nem comenta o corpo de quem lê (mesma régua de copy da Leva D).
 */
export function fraseSemComparacao(motivo: SemComparacao): string {
  return motivo === 'NENHUMA_PESAGEM'
    ? 'Nenhuma pesagem registrada ainda. O peso acima é o do seu perfil.'
    : 'Uma pesagem só não dá comparação. A variação aparece a partir da segunda.';
}
