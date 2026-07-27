/**
 * Janela da semana de cardio + leitura do histórico (Leva 2 · Bloco 1).
 *
 * Adaptador entre o `evk_treinos` (histórico da UI) e o motor puro (`engine/cardio`).
 * PURO e determinístico: `hojeISO` entra por parâmetro — o relógio fica na UI, padrão de
 * `semana.ts`. 🔒 "A semana começa na SEGUNDA" (TODO de dev do handoff de design); a virada
 * zera o progresso e as sessões ficam arquivadas no histórico.
 *
 * 🔒 A virada NUNCA gera resumo, notificação ou tela sobre a semana anterior quando ela
 * ficou abaixo da meta — "ausência não fala". Por isso não existe aqui nenhuma função que
 * compute o desempenho da semana passada: o que não pode ser exibido não é calculado.
 */
import type { IntensidadeCardio, ModalidadeCardio, RegistroCardio } from '@/lib/engine/cardio';

/** Sessão do histórico, na forma mínima que este módulo precisa ler. */
export interface SessaoComCardio {
  dataISO: string;
  hora?: string;
  tipo?: string;
  cardio?: { modalidade: string; intensidade: string; minutos: number; met: number; kcal: number };
}

/** Registro da semana com a data/hora de origem (a lista da tela mostra o dia da semana). */
export interface RegistroCardioDatado extends RegistroCardio {
  dataISO: string;
  hora?: string;
}

const DIA_MS = 86_400_000;

function parseISO(dataISO: string): number {
  return Date.parse(`${dataISO}T00:00:00Z`);
}

/** Segunda-feira da semana de `hojeISO` (inclusive) e o domingo (inclusive). */
export function semanaDe(hojeISO: string): { inicioISO: string; fimISO: string } {
  const t = parseISO(hojeISO);
  if (!Number.isFinite(t)) return { inicioISO: hojeISO, fimISO: hojeISO };
  const dow = new Date(t).getUTCDay();           // 0 = domingo
  const desdeSegunda = (dow + 6) % 7;            // segunda = 0 … domingo = 6
  const inicio = t - desdeSegunda * DIA_MS;
  return {
    inicioISO: new Date(inicio).toISOString().slice(0, 10),
    fimISO: new Date(inicio + 6 * DIA_MS).toISOString().slice(0, 10),
  };
}

/** Todos os registros de cardio do histórico, do mais novo para o mais antigo. */
export function registrosCardio(historico: readonly SessaoComCardio[]): RegistroCardioDatado[] {
  return historico
    .filter((s) => s.tipo === 'cardio' && s.cardio != null)
    .map((s) => ({
      modalidade: s.cardio!.modalidade as ModalidadeCardio,
      intensidade: s.cardio!.intensidade as IntensidadeCardio,
      minutos: s.cardio!.minutos,
      met: s.cardio!.met,
      kcal: s.cardio!.kcal,
      dataISO: s.dataISO,
      ...(s.hora ? { hora: s.hora } : {}),
    }))
    .sort((a, b) => b.dataISO.localeCompare(a.dataISO) || (b.hora ?? '').localeCompare(a.hora ?? ''));
}

/** Só os registros da semana corrente (segunda→domingo que contém `hojeISO`). */
export function registrosDaSemana(historico: readonly SessaoComCardio[], hojeISO: string): RegistroCardioDatado[] {
  const { inicioISO, fimISO } = semanaDe(hojeISO);
  return registrosCardio(historico).filter((r) => r.dataISO >= inicioISO && r.dataISO <= fimISO);
}

/**
 * Total acumulado de minutos de cardio — 🔒 o número "que só cresce". É ele (ou a Chama)
 * que dá continuidade quando a semana recomeça em zero, no lugar de um placar da semana
 * perdida. Conta TODOS os registros, inclusive o movimento leve: é tempo de movimento, não
 * progresso contra a meta.
 */
export function minutosAcumulados(historico: readonly SessaoComCardio[]): number {
  return registrosCardio(historico).reduce((n, r) => n + (Number.isFinite(r.minutos) ? r.minutos : 0), 0);
}

/** "14 h" / "45 min" — o total acumulado como a tela escreve. */
export function formatarAcumulado(minutos: number): string {
  if (minutos < 60) return `${Math.max(0, Math.round(minutos))} min`;
  const h = Math.floor(minutos / 60);
  return `${h} h`;
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;

/** Dia da semana por extenso (a lista mostra "Moderado · sábado"). */
export function diaDaSemanaPt(dataISO: string): string {
  const t = parseISO(dataISO);
  return Number.isFinite(t) ? DIAS[new Date(t).getUTCDay()]! : '';
}

/** "27/07 a 02/08" — o intervalo no cabeçalho da semana. */
export function rotuloSemana(hojeISO: string): string {
  const { inicioISO, fimISO } = semanaDe(hojeISO);
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${dm(inicioISO)} a ${dm(fimISO)}`;
}
