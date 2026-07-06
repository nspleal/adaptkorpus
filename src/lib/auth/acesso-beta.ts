/**
 * Gate do beta fechado (regra 4.2.1 da blindagem; conceito beta-fechado-app-evokorpus):
 * o app é servido quando o e-mail está na ALLOWLIST (`beta_liberado()`, RPC security
 * definer) OU quando há assinatura ativa/trial (`subscription.status`, read-only p/ o
 * dono — só o webhook/service_role escreve). O entitlement NUNCA fica em superfície
 * gravável pelo usuário. Decisão pura e determinística — testável sem I/O.
 */

export type ViaAcesso = 'beta' | 'assinatura' | null;

const STATUS_ATIVOS = new Set(['ativa', 'trial']);

export function decidirAcessoBeta(
  betaLiberado: boolean,
  statusAssinatura?: string | null,
): { liberado: boolean; via: ViaAcesso } {
  if (betaLiberado) return { liberado: true, via: 'beta' };
  if (statusAssinatura && STATUS_ATIVOS.has(statusAssinatura)) return { liberado: true, via: 'assinatura' };
  return { liberado: false, via: null };
}
