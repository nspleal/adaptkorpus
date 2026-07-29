/**
 * "O DIA DA DIETA" — a linha do dia (Café → Almoço → Lanche → Jantar) com a **próxima
 * refeição em destaque**.
 *
 * 🔒 Cofre, DF 2026-07-26 (`logica-de-dieta` → "O dia da dieta" + "refeição guiada"): a tela
 * é o contêiner, a refeição guiada é a interação. Design: PEÇA A do handoff de 2026-07-27.
 *
 * ⚠️ **O relógio fica na UI, nunca aqui.** Este módulo é PURO: recebe `agoraMin` (minutos
 * desde a meia-noite, no fuso do dispositivo) e devolve o mesmo resultado sempre — mesmo
 * padrão de `cardio-semana.ts` e `semana.ts`. Quem lê `new Date()` é o componente.
 *
 * 🟢 Guarda-corpo da feature (cofre): a refeição guiada é **leve** — sem timer, sem passo a
 * passo, sem "sessão concluída". Este módulo não modela duração, etapa nem progresso de
 * execução, e é de propósito: não há onde pendurar um cronômetro.
 */

import type { StatusRefeicao } from '@/components/painel/RegistroRefeicao';

/** Ordem cronológica canônica dos slots (a mesma do cardápio). */
export const ORDEM_REFEICOES: readonly string[] = ['cafe', 'almoco', 'lanche', 'jantar'];

/**
 * Horário de referência de cada slot, em minutos desde a meia-noite.
 *
 * ⚠️ DECISÃO DA SESSÃO DE CÓDIGO (2026-07-29): o motor NÃO tem horário de refeição e o
 * handoff marca os horários das telas como exemplo ("todos os números, pratos, horários e
 * nomes são exemplo"). Mas "próxima refeição pelo relógio" precisa de um horário para
 * comparar, então ele nasce aqui, como **referência de exibição** — nunca como prescrição
 * ("coma às 12:30"). O 12:30 do almoço é o único que casa com a arte.
 */
export const HORARIO_REFEICAO: Readonly<Record<string, number>> = {
  cafe: 7 * 60 + 30,   // 07:30
  almoco: 12 * 60 + 30, // 12:30
  lanche: 16 * 60,      // 16:00
  jantar: 20 * 60,      // 20:00
};

/**
 * Janela de tolerância (min) DEPOIS do horário em que a refeição ainda conta como "a
 * próxima". Sem ela, às 13:00 o almoço já viraria passado e o destaque pularia para o
 * lanche — com o almoço ainda por registrar.
 */
export const TOLERANCIA_MIN = 90;

/** `HH:MM` a partir dos minutos desde a meia-noite. */
export function horaDe(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Minutos desde a meia-noite LOCAL. Único ponto que toca o relógio — chamado só pela UI. */
export function agoraEmMinutos(agora: Date = new Date()): number {
  return agora.getHours() * 60 + agora.getMinutes();
}

/** Peso visual de cada linha do dia (os três do design). */
export type EstadoLinha = 'registrada' | 'proxima' | 'futura';

export interface LinhaDoDia {
  /** Slot (`cafe` | `almoco` | …). */
  id: string;
  estado: EstadoLinha;
  /** Horário de referência, `HH:MM`. */
  hora: string;
  /** Índice do item no cardápio (o componente usa para trocar/porção/detalhe). */
  idx: number;
}

/**
 * Monta a linha do dia.
 *
 * A escolha da **próxima** (TODO de dev da PEÇA A):
 *  1. entre as NÃO registradas, a primeira cujo horário ainda não passou da tolerância;
 *  2. se todas já passaram e ainda faltam registros, a **mais antiga pendente** — e isso
 *     🔴 **sem tom de cobrança**: o estado é o mesmo `proxima`, com o mesmo cartão. O app
 *     não diz "você perdeu", não conta atraso e não muda de cor (trava de copy 7 do
 *     handoff: "ausência não fala").
 *  3. nenhuma pendente → dia completo, ninguém em destaque.
 *
 * Puro: `agoraMin` entra por parâmetro.
 */
export function linhaDoDia(
  refeicoes: readonly string[],
  logs: Readonly<Record<string, StatusRefeicao>>,
  agoraMin: number,
  horarios: Readonly<Record<string, number>> = HORARIO_REFEICAO,
): LinhaDoDia[] {
  const ordenadas = [...refeicoes].sort(
    (a, b) => (horarios[a] ?? 0) - (horarios[b] ?? 0) || ORDEM_REFEICOES.indexOf(a) - ORDEM_REFEICOES.indexOf(b),
  );
  const pendentes = ordenadas.filter((r) => !logs[r]);
  const naJanela = pendentes.find((r) => (horarios[r] ?? 0) + TOLERANCIA_MIN >= agoraMin);
  const destaque = naJanela ?? pendentes[0] ?? null;

  return ordenadas.map((id) => ({
    id,
    idx: refeicoes.indexOf(id),
    hora: horaDe(horarios[id] ?? 0),
    estado: logs[id] ? 'registrada' : id === destaque ? 'proxima' : 'futura',
  }));
}

/** O dia inteiro registrado? Fecha a tela com o encerramento calmo do design. */
export function diaCompleto(refeicoes: readonly string[], logs: Readonly<Record<string, StatusRefeicao>>): boolean {
  return refeicoes.length > 0 && refeicoes.every((r) => !!logs[r]);
}

/** Quantas já foram registradas (o contador "N de 4 registradas" do cabeçalho). */
export function registradas(refeicoes: readonly string[], logs: Readonly<Record<string, StatusRefeicao>>): number {
  return refeicoes.filter((r) => !!logs[r]).length;
}

/**
 * "**medida caseira + gramas**" de um ingrediente (`1 filé médio · 120 g` no design).
 *
 * A medida caseira da base TACO já vem com a contagem embutida ("1 bife médio", "6 unidades
 * médias"), então ela vale como está quando a quantidade bate com a medida. Fora disso o
 * multiplicador aparece — inventar plural em português daria erro em metade dos casos.
 * Sem `medidaCaseira`/`gramasDaMedida` na base, sobram as gramas (não fabricamos medida).
 */
export function medidaDoIngrediente(
  food: { medidaCaseira?: string; gramasDaMedida?: number },
  gramas: number,
): string {
  const g = `${Math.round(gramas)} g`;
  if (!food.medidaCaseira || !food.gramasDaMedida || food.gramasDaMedida <= 0) return g;
  const n = gramas / food.gramasDaMedida;
  if (n >= 0.9 && n <= 1.1) return `${food.medidaCaseira} · ${g}`;
  const meio = Math.round(n * 2) / 2; // meia medida é o menor passo legível na cozinha
  if (meio <= 0) return g;
  // Arredondou para 1 medida (ex.: 7 g de azeite ÷ 8 g da colher) → "1× 1 colher de sopa"
  // seria ruído; a medida sozinha já diz o mesmo.
  if (meio === 1) return `${food.medidaCaseira} · ${g}`;
  return `${String(meio).replace('.', ',')}× ${food.medidaCaseira} · ${g}`;
}
