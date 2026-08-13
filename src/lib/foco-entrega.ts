/**
 * 🔴 A ENTREGA DO FOCO, MEDIDA DO PLANO — leva A2 do v4 (handoff-motor-volume-v4-2026-08-12).
 *
 * O defeito medido (relatorio-medicao-v3-2026-08-12): `foco_ativado.entrega` saía de
 * `aplicarFoco` sobre o ALVO — e o alvo é truncado pela distribuição (`n_slots × sMax`),
 * então produção emitia `entrega: 'volume'` com o plano IDÊNTICO. Telemetria que afirma o
 * que não aconteceu não é dado: é a versão gravada do sucesso simulado.
 *
 * Aqui a entrega é MEDIDA contra o contrafactual exato — o MESMO perfil, sem o foco:
 *  · séries do grupo subiram  → `volume` (com o delta REAL);
 *  · só a ordem mudou         → `ordem`;
 *  · nada mudou               → `null` — o evento NÃO dispara. A ausência é o dado honesto.
 *
 * 🔒 Core NUNCA devolve `ordem` (DF 2026-08-05): para core, entrega inerte é recusa lá na
 * porta, não evento aqui — se um caso de borda chegar com delta 0, a resposta é silêncio.
 *
 * PURO e determinístico (compara duas saídas do motor; não roda nada).
 */
import type { GrupoPrimario } from '@/lib/data/types';
import type { ResultadoTreino } from '@/lib/engine';

export interface EntregaMedida {
  entrega: 'volume' | 'ordem';
  /** Séries semanais do grupo A MAIS que o plano sem foco — medido, nunca o alvo. */
  delta: number;
}

const seriesDoGrupo = (t: ResultadoTreino, grupo: GrupoPrimario): number =>
  (t.rotina?.dias ?? []).reduce(
    (n, d) => n + d.slots.reduce((m, sl) => m + (sl.exercicio.grupoPrimario === grupo ? (sl.series ?? 0) : 0), 0),
    0,
  );

/** Assinatura do plano (ids × séries, na ordem) — é a ORDEM que o foco sem folga entrega. */
const assinatura = (t: ResultadoTreino): string =>
  (t.rotina?.dias ?? []).map((d) => d.slots.map((sl) => `${sl.exercicio.id}×${sl.series ?? 0}`).join(',')).join('|');

export function medirEntregaDoFoco(
  comFoco: ResultadoTreino,
  semFoco: ResultadoTreino,
  grupo: GrupoPrimario,
): EntregaMedida | null {
  const delta = seriesDoGrupo(comFoco, grupo) - seriesDoGrupo(semFoco, grupo);
  if (delta > 0) return { entrega: 'volume', delta };
  if (grupo === 'core') return null; // DF 2026-08-05: core nunca emite 'ordem'
  return assinatura(comFoco) !== assinatura(semFoco) ? { entrega: 'ordem', delta: 0 } : null;
}
