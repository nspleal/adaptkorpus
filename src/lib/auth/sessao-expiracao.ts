/**
 * Expiração de sessão no APP (tarefas 15–16 — dado de saúde/LGPD): além da expiração do
 * JWT (Supabase), o app encerra a sessão por INATIVIDADE (idle) e por tempo ABSOLUTO.
 * Valores default são decisão de implementação (NÃO travados no cofre — ajustáveis):
 * idle 30 min · absoluto 12 h. Pura e determinística (relógio entra por parâmetro).
 */

export interface ConfigExpiracao {
  idleMs: number;
  absolutoMs: number;
}

export const EXPIRACAO_PADRAO: ConfigExpiracao = {
  idleMs: 30 * 60_000, // 30 min sem interação
  absolutoMs: 12 * 60 * 60_000, // 12 h desde o início da sessão no app
};

export function expirouSessao(
  agoraMs: number,
  ultimoAtivoMs: number,
  inicioMs: number,
  cfg: ConfigExpiracao = EXPIRACAO_PADRAO,
): 'idle' | 'absoluta' | null {
  if (agoraMs - inicioMs >= cfg.absolutoMs) return 'absoluta';
  if (agoraMs - ultimoAtivoMs >= cfg.idleMs) return 'idle';
  return null;
}
