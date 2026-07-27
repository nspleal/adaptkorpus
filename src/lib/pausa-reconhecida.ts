/**
 * "Fiquei doente" — o RECONHECIMENTO de pausa (Leva 2 · Bloco 4, DF 2026-07-27).
 *
 * Cofre: `conceitos/parametros-motor-treino-evokorpus` §"Fiquei doente" (a DF de
 * 2026-07-26 — "pausa que congela" — foi SUPERSEDIDA pela própria Leva 1: desde `9ebf1bd`
 * a semana do ciclo conta semanas TREINADAS, então o congelamento já acontece sozinho,
 * tendo a pessoa avisado ou não). Sobrou para o botão o que ele sempre foi no pedido do
 * beta: **o ato de avisar**. Ele não tem função mecânica — e isso é a especificação.
 *
 * 🔴 Este módulo vive na camada de UI de propósito. O MOTOR NUNCA LÊ `reconhecidoEm`
 * (`engine-sem-reconhecido.test.ts` falha se `src/lib/engine` sequer mencionar o campo):
 * quem avisa e quem some têm exatamente o mesmo comportamento de motor.
 *
 * 🔴 Motive-free por LGPD: o estado é só um carimbo de tempo. Nada de motivo, sintoma,
 * data prevista de volta ou contagem de dias — um campo que gravasse "doente" seria dado
 * de saúde (categoria sensível) num produto que se define fora do território clínico.
 *
 * PURO e determinístico: nenhum relógio aqui dentro (o `agoraISO` do carimbo entra por
 * parâmetro na UI, padrão de `semana.ts`).
 */

/** Só o que estas regras precisam de uma sessão — evita acoplar ao `SessaoHistorico`. */
export interface SessaoMinima {
  dataISO: string;
  tipo?: string;
}

/** Entradas que não são treino nenhum (espelha `EVENTOS` de `treino-historico`). */
const EVENTOS = new Set(['calibracao', 'sinal_fadiga']);

/**
 * O reconhecimento ainda vale? Vale enquanto existe carimbo e **não há treino registrado
 * depois dele** — "limpa no primeiro treino registrado, sem mensagem nenhuma".
 *
 * A comparação é por DIA (a sessão só carrega `dataISO`) e usa `>` estrito: um treino do
 * próprio dia do aviso não o apaga aqui, porque quem apaga esse caso é a limpeza
 * imperativa no ato do registro (`Painel.aplicarNovoHistorico`). Ficar no `>=` faria o
 * aviso nunca aparecer para quem treinou de manhã e avisou à tarde.
 *
 * Cardio conta como treino (é treino para a Chama) — quem pedalou voltou a treinar.
 */
export function pausaReconhecida(
  reconhecidoEm: string | null | undefined,
  sessoes: readonly SessaoMinima[],
): boolean {
  if (!reconhecidoEm) return false;
  const dia = reconhecidoEm.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  return !sessoes.some((s) => (!s.tipo || !EVENTOS.has(s.tipo)) && s.dataISO > dia);
}

/**
 * Precedência de mensagem (🔒 REGRA DURA do handoff — nunca duas empilhadas):
 *   rampa de retomada ativa → SÓ o chip/cartão de retomada
 *   reconhecido            → SÓ o aviso "Pausa reconhecida"
 *   senão                  → nada (≤14 dias: "ausência não fala")
 */
export function avisoPausaVisivel(args: {
  reconhecidoEm?: string | null;
  rampaAtiva: boolean;
  sessoes: readonly SessaoMinima[];
}): boolean {
  if (args.rampaAtiva) return false;
  return pausaReconhecida(args.reconhecidoEm, args.sessoes);
}
