'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Medalhao, AssinaturaMotivo, estiloBotaoPrimario } from './ui';

/**
 * Detector de conexão (V4 A3 → upgrade offline-first, melhoria adotada no cofre).
 *
 * Comportamento em dois níveis:
 * - Rota /app COM service worker ativo → o shell veio do cache (public/sw.js) e o plano é
 *   recomputado do localStorage: o app FUNCIONA offline. Mostramos só um banner inferior
 *   NÃO-bloqueante ("seu plano salvo continua disponível") — nunca escondemos o plano.
 * - Qualquer outra rota, ou sem SW controlando → overlay bloqueante de sempre
 *   ("Você está sem conexão."), que é honesto: sem cache não há o que mostrar.
 * Montado uma vez no layout raiz.
 */
export default function OfflineGuard() {
  const [offline, setOffline] = useState(false);
  const [controlado, setControlado] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => {
      setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
      setControlado(typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller);
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);

  if (!offline) return null;

  // /app controlado pelo SW: shell do cache + dados do localStorage → banner, não bloqueio.
  const funcionaOffline = controlado && (pathname === '/app' || pathname.startsWith('/app/'));
  if (funcionaOffline) {
    return (
      <div role="status" aria-label="Sem conexão — modo offline" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 300, display: 'flex', alignItems: 'center', gap: 12, maxWidth: 560, margin: '0 auto', background: '#0D2818', border: '1px solid rgba(189,255,0,.3)', borderRadius: 14, padding: '13px 16px', boxShadow: '0 18px 50px -18px rgba(0,0,0,.7)', animation: 'evkPop .35s cubic-bezier(.22,.61,.36,1)' }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M6.5 16.5h9.5a3.2 3.2 0 00.4-6.37 4.6 4.6 0 00-8.13-2" stroke="#EAE5DB" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /><path d="M6.7 11.2A3.2 3.2 0 006 16.5" stroke="#EAE5DB" strokeWidth={1.7} strokeLinecap="round" /><line x1={4} y1={3.6} x2={20} y2={20.4} stroke="#BDFF00" strokeWidth={1.9} strokeLinecap="round" /></svg>
        <p style={{ margin: 0, flex: 1, fontSize: '.88rem', color: 'rgba(234,229,219,.8)', lineHeight: 1.45 }}>Você está sem conexão — <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>seu plano salvo continua disponível</strong>.</p>
        <button onClick={() => setOffline(navigator.onLine === false)} className="evk-troca" style={{ flexShrink: 0, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.85)', fontWeight: 600, fontSize: '.82rem', padding: '8px 13px', borderRadius: 10, cursor: 'pointer' }}>Tentar de novo</button>
      </div>
    );
  }

  return (
    <div role="alertdialog" aria-label="Sem conexão" style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#0D2818', color: '#EAE5DB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '64px 28px', animation: 'evkScreenIn .5s cubic-bezier(.22,.61,.36,1)' }}>
      <div style={{ marginBottom: 24 }}>
        <Medalhao variante="neon" size={84}>
          <svg width={38} height={38} viewBox="0 0 24 24" fill="none"><path d="M6.5 16.5h9.5a3.2 3.2 0 00.4-6.37 4.6 4.6 0 00-8.13-2" stroke="#EAE5DB" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /><path d="M6.7 11.2A3.2 3.2 0 006 16.5" stroke="#EAE5DB" strokeWidth={1.7} strokeLinecap="round" /><line x1={4} y1={3.6} x2={20} y2={20.4} stroke="#BDFF00" strokeWidth={1.9} strokeLinecap="round" /></svg>
        </Medalhao>
      </div>
      <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(1.6rem,3.2vw,2.05rem)', fontWeight: 700, letterSpacing: '-.02em', maxWidth: 520 }}>Você está sem conexão.</h1>
      <p style={{ margin: '0 auto 30px', maxWidth: 440, color: 'rgba(234,229,219,.62)', lineHeight: 1.65, fontSize: '1.02rem' }}>Verifique sua internet — seus dados continuam salvos.</p>
      <button onClick={() => setOffline(navigator.onLine === false)} className="hov-btn" style={estiloBotaoPrimario}>Tentar de novo</button>
      <AssinaturaMotivo />
    </div>
  );
}
