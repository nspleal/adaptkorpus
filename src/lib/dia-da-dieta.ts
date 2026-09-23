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
import { macrosDePrato } from '@/lib/data/nutrition';
import { ESCALA_PORCAO } from '@/lib/engine/constants';
import type { Food, RecipeMacros } from '@/lib/data/types';
import type { CardapioItem } from '@/lib/engine/assembler';

/** A porcentagem é relativa à porção sugerida deste prato neste dia. */
export type ItemPorcionado = CardapioItem & { escalaSugerida?: number; porcentagemEscolhida?: number };

export function escolherPorcao(item: ItemPorcionado, porcentagem: number, foodsById: ReadonlyMap<string, Food>): ItemPorcionado | null {
  const escalaSugerida = item.escalaSugerida ?? item.escala;
  const escala = escalaSugerida * porcentagem / 100;
  if (escala < ESCALA_PORCAO.min || escala > ESCALA_PORCAO.max) return null;
  const base = macrosDePrato(item.prato, foodsById);
  return { ...item, escalaSugerida, porcentagemEscolhida: porcentagem, escala,
    macros: { kcal: base.kcal * escala, proteinaG: base.proteinaG * escala,
      carboidratoG: base.carboidratoG * escala, gorduraG: base.gorduraG * escala } };
}

export function totaisDosItens(itens: readonly CardapioItem[]): RecipeMacros {
  return itens.reduce((t, item) => ({ kcal: t.kcal + item.macros.kcal,
    proteinaG: t.proteinaG + item.macros.proteinaG, carboidratoG: t.carboidratoG + item.macros.carboidratoG,
    gorduraG: t.gorduraG + item.macros.gorduraG }), { kcal: 0, proteinaG: 0, carboidratoG: 0, gorduraG: 0 });
}


/** Ordem cronológica canônica dos slots (a mesma do cardápio). */
export const ORDEM_REFEICOES: readonly string[] = ['cafe', 'almoco', 'lanche', 'jantar'];

/**
 * Horário de referência de cada slot, em minutos desde a meia-noite.
 *
 * 🔒 **INTERNO — NUNCA VAI À TELA** (DF 2026-07-29). Estes números existem só para decidir
 * QUAL refeição fica em destaque. Exibi-los seria dizer a hora de comer, e horário de
 * refeição encosta no território do nutricionista — a mesma fronteira que o produto inteiro
 * respeita. Na tela sobra o **nome** da refeição; a ordem já vem dos slots.
 *
 * O motor não tem horário de refeição (e o handoff marca os das telas como exemplo), então
 * a referência nasce aqui — invisível, e só como critério de destaque.
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
