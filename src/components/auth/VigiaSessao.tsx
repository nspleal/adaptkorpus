'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { expirouSessao } from '@/lib/auth/sessao-expiracao';
import { sairDaConta } from '@/lib/auth/sair';
import { supabaseConfigurado } from '@/lib/supabase/env';

/**
 * Vigia de sessão no app (tarefas 15–16 — dado de saúde/LGPD): encerra por INATIVIDADE
 * (30 min) e por tempo ABSOLUTO (12 h) chamando `signOut()` (revoga o refresh token) e
 * levando à tela de sessão expirada. Só ativo com backend (modo mock não tem sessão).
 * Render nulo; timers/listeners limpos no unmount.
 */
export default function VigiaSessao() {
  const router = useRouter();
  const ultimoAtivo = useRef(Date.now());
  const inicio = useRef(Date.now());

  useEffect(() => {
    if (!supabaseConfigurado()) return;
    const marcar = () => { ultimoAtivo.current = Date.now(); };
    const eventos: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll'];
    for (const ev of eventos) window.addEventListener(ev, marcar, { passive: true });
    document.addEventListener('visibilitychange', marcar); // voltar à aba conta como atividade
    const timer = setInterval(() => {
      const motivo = expirouSessao(Date.now(), ultimoAtivo.current, inicio.current);
      if (motivo) {
        clearInterval(timer);
        void sairDaConta().finally(() => router.replace('/acesso-restrito?motivo=sessao'));
      }
    }, 30_000);
    return () => {
      clearInterval(timer);
      for (const ev of eventos) window.removeEventListener(ev, marcar);
      document.removeEventListener('visibilitychange', marcar);
    };
  }, [router]);

  return null;
}
