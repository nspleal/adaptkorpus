'use client';

/**
 * Preferências de notificação (Web Push) — persistidas em localStorage (evk_notif).
 * `optIn === null` = nunca perguntado (mostra o convite). O opt-in é SEMPRE explícito;
 * o agendamento/entrega real (service worker push + backend) é fase posterior.
 */

export interface NotifPrefs {
  optIn: boolean | null;
  treino: boolean;
  refeicao: boolean;
}

const KEY = 'evk_notif';
const PADRAO: NotifPrefs = { optIn: null, treino: true, refeicao: true };

export function lerNotif(): NotifPrefs {
  if (typeof window === 'undefined') return { ...PADRAO };
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!o || typeof o !== 'object') return { ...PADRAO };
    return { optIn: o.optIn ?? null, treino: o.treino !== false, refeicao: o.refeicao !== false };
  } catch { return { ...PADRAO }; }
}

export function salvarNotif(p: NotifPrefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage indisponível */ }
}
