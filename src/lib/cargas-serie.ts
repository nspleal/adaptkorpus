import type { SessaoHistorico } from '@/lib/treino-historico';

/**
 * Progressão de carga por exercício — lógica PURA (extraída do CargasHistorico p/ ser
 * testável; o vitest só coleta `.ts`). Alimentada pelo histórico real (`evk_treinos`,
 * já sem calibrações — ver `sessoesTreino`).
 *
 * CORREÇÃO (bug "a curva nunca aparece"): a série é UM ponto por SESSÃO registrada — não
 * por dia. O agrupamento anterior "maior carga de cada DIA" colapsava várias sessões do
 * mesmo dia num único ponto, então quem treinava (ou testava) o mesmo exercício mais de
 * uma vez no mesmo dia ficava eternamente no "Registre mais sessões…". A copy do cartão
 * sempre disse "ao longo das SESSÕES registradas" — agora o código bate com ela.
 */

export interface ExercicioComCarga {
  id: string;
  nome: string;
}

/** Maior kg de uma sessão para um exercício (`0` = sem carga registrada). */
function maiorCargaNaSessao(sessao: SessaoHistorico, selKey: string): number {
  const e = sessao.exercicios.find((x) => (x.id || x.nome) === selKey && x.loaded && !x.custom);
  if (!e) return 0;
  return Math.max(0, ...e.sets.map((st) => Number(st.kg) || 0));
}

/**
 * Exercícios da biblioteca (não-custom, com carga) que têm ao menos UMA série com kg > 0
 * no histórico — só esses são plotáveis. Antes o seletor listava qualquer exercício
 * `loaded`, mesmo sem nenhuma carga registrada: o usuário selecionava e via a série vazia.
 */
export function exerciciosComCarga(historico: readonly SessaoHistorico[]): ExercicioComCarga[] {
  const map = new Map<string, string>();
  for (const s of historico) {
    for (const e of s.exercicios) {
      const key = e.id || e.nome;
      if (!e.loaded || e.custom || !key || map.has(key)) continue;
      if (e.sets.some((st) => (Number(st.kg) || 0) > 0)) map.set(key, e.nome);
    }
  }
  return [...map].map(([id, nome]) => ({ id, nome }));
}

/**
 * Série de carga do exercício: UM ponto por sessão que registrou kg > 0, na ordem
 * cronológica (data e, no mesmo dia, ordem de registro `n`). Determinística.
 */
export function serieCargaPorExercicio(historico: readonly SessaoHistorico[], selKey: string): number[] {
  const pontos: { dataISO: string; n: number; kg: number }[] = [];
  for (const s of historico) {
    const kg = maiorCargaNaSessao(s, selKey);
    if (kg > 0) pontos.push({ dataISO: s.dataISO, n: s.n, kg });
  }
  pontos.sort((a, b) => a.dataISO.localeCompare(b.dataISO) || a.n - b.n);
  return pontos.map((p) => p.kg);
}
