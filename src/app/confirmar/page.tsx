'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Backdrop, AuthHead, cardAuth, EASE } from '@/components/auth/ui';

/**
 * Confirmação de e-mail — porte fiel do protótipo V2 (2 estados: vSent → vConfirmed).
 * UI apenas; o link real de confirmação é backend (Fase 2). Lê o e-mail do cadastro
 * via sessionStorage (gravado em /cadastro).
 */
type Fase = 'sent' | 'confirmed';

export default function ConfirmarPage() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>('sent');
  const [email, setEmail] = useState('seu e-mail');

  useEffect(() => {
    const e = sessionStorage.getItem('evk_email');
    if (e) setEmail(e);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
      <Backdrop />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', animation: `evkScreenIn .55s ${EASE}` }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          <AuthHead />
          <div style={{ ...cardAuth, padding: '38px 34px', textAlign: 'center' }}>

            {fase === 'sent' && (
              <div style={{ animation: `evkPop .35s ${EASE}` }}>
                <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto 24px' }}>
                  <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={34} height={34} viewBox="0 0 24 24" fill="none"><rect x={3} y={5} width={18} height={14} rx={2.5} stroke="#BDFF00" strokeWidth={1.7} /><path d="M4 7l8 5 8-5" stroke="#BDFF00" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <span style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: '#BDFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(189,255,0,.6)' }}>
                    <svg width={11} height={11} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#0D2818" strokeWidth={3.6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </div>
                <h1 style={{ margin: '0 0 10px', fontSize: '1.55rem', fontWeight: 700, letterSpacing: '-.02em' }}>Confirme seu e-mail</h1>
                <p style={{ margin: '0 0 26px', color: 'rgba(234,229,219,.66)', fontSize: '.98rem', lineHeight: 1.6 }}>Enviamos um link de confirmação para <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{email}</strong>. Abra para ativar sua conta e começar.</p>
                <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => setFase('confirmed')} className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.96rem', padding: '13px 24px', border: 'none', borderRadius: 12, cursor: 'pointer', transition: `transform .25s ease, box-shadow .3s ease` }}>Reenviar e-mail</button>
                  <button onClick={() => router.push('/cadastro')} className="evk-voltar" style={{ background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.82)', fontWeight: 600, fontSize: '.96rem', padding: '13px 24px', borderRadius: 12, cursor: 'pointer', transition: 'border-color .25s ease, background .25s ease' }}>Trocar e-mail</button>
                </div>
                <p style={{ margin: '20px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.45)' }}>Não achou? Veja a caixa de spam.</p>
              </div>
            )}

            {fase === 'confirmed' && (
              <div style={{ animation: `evkPop .35s ${EASE}` }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(189,255,0,.14)', border: '1px solid rgba(189,255,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                  <svg width={32} height={32} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#BDFF00" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(189,255,0,.12)', border: '1px solid rgba(189,255,0,.35)', color: '#BDFF00', borderRadius: 999, padding: '5px 14px', fontSize: '.76rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16 }}>
                  <svg width={13} height={13} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#BDFF00" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>Tudo certo
                </div>
                <h1 style={{ margin: '0 0 10px', fontSize: '1.55rem', fontWeight: 700, letterSpacing: '-.02em' }}>E-mail confirmado</h1>
                <p style={{ margin: '0 0 26px', color: 'rgba(234,229,219,.64)', fontSize: '.98rem', lineHeight: 1.55 }}>Seu e-mail foi confirmado. Vamos montar seu plano.</p>
                <button onClick={() => router.push('/onboarding')} className="hov-btn" style={{ width: '100%', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1.05rem', padding: 15, border: 'none', borderRadius: 13, cursor: 'pointer', transition: `transform .25s ${EASE}, box-shadow .3s ease` }}>Continuar</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
