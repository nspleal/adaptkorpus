/** Regras puras para detectar uma versão de plano mais nova sem aceitar payload arbitrário. */
export const EVENTO_PLANO_ATUALIZADO = 'plano_atualizado';

export function revisaoRemotaMaisNova(revisaoLocal: number, payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const revisao = (payload as { revision?: unknown }).revision;
  if (!Number.isSafeInteger(revisao) || (revisao as number) < 0) return null;
  return (revisao as number) > revisaoLocal ? (revisao as number) : null;
}
