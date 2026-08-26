/** Regras puras para detectar uma versão de plano mais nova sem aceitar payload arbitrário. */
export const EVENTO_PLANO_ATUALIZADO = 'plano_atualizado';

export function revisaoRemotaMaisNova(revisaoLocal: number, payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const revisao = (payload as { revision?: unknown }).revision;
  if (!Number.isSafeInteger(revisao) || (revisao as number) < 0) return null;
  return (revisao as number) > revisaoLocal ? (revisao as number) : null;
}


/**
 * Depois de um PUT confirmado, uma notificação com a MESMA revisão é o eco do próprio
 * commit e não deve bloquear saves seguintes. Só uma revisão estritamente maior continua
 * pendente: ela veio de outro dispositivo durante a corrida.
 */
export function reconciliarConfirmacaoLocal(
  revisaoConfirmada: number,
  revisaoRemotaPendente: number | null,
): { bloqueado: boolean; revisaoRemotaPendente: number | null } {
  if (revisaoRemotaPendente !== null && revisaoRemotaPendente > revisaoConfirmada) {
    return { bloqueado: true, revisaoRemotaPendente };
  }
  return { bloqueado: false, revisaoRemotaPendente: null };
}
