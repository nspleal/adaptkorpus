'use client';

import { useEffect, useState } from 'react';
import { Medalhao, AssinaturaMotivo, estiloBotaoPrimario } from './ui';

/**
 * Detector de conexão (V4 A3). Quando o aparelho fica offline, sobrepõe a tela cheia
 * "Você está sem conexão." com ação [Tentar de novo]. Wireado a navigator.onLine + eventos.
 * Montado uma vez no layout raiz.
 */
export default function OfflineGuard() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);

  if (!offline) return null;

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
