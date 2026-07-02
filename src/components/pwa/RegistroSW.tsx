'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker (offline-first do plano do dia — ver public/sw.js).
 * Só em produção: em dev o cache atrapalha o hot reload. `updateViaCache: 'none'` faz o
 * browser sempre buscar o sw.js fresco no update-check (a invalidação é pela VERSAO).
 * Sem script inline (CSP): o registro roda no bundle hidratado, que o nonce já assina.
 */
export default function RegistroSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      /* sem SW segue tudo funcionando online — o OfflineGuard cobre o offline */
    });
  }, []);
  return null;
}
