/**
 * Dia-calendário LOCAL em ISO (`YYYY-MM-DD`) — a partir do fuso do usuário, NUNCA UTC.
 *
 * Motivo (bug corrigido): `new Date().toISOString().slice(0,10)` devolve o dia em UTC. No
 * Brasil (UTC-3), às 21h já é "amanhã" em UTC — então refeições/treinos marcados à noite
 * caíam no dia seguinte e as abas discordavam sobre "hoje". Esta é a MESMA regra que o
 * `treino-historico.ts:hojeISO` já usava; centralizada aqui para a aderência reusar.
 *
 * Puro e determinístico (a data entra por parâmetro; sem relógio embutido).
 */
export function diaLocalISO(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}
