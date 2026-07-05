'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Backdrop, AuthHead, cardAuth, inputAuth, labelAuth, btnNeon, btnGhost, EASE, forcaSenha } from '@/components/auth/ui';

/**
 * Redefinir senha — porte fiel do protótipo V2 (4 estados locais):
 * fRequest → fSent → fReset → fDone. UI apenas; o envio real de link é backend (Fase 2).
 */
type Fase = 'request' | 'sent' | 'reset' | 'done';

export default function RedefinirPage() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>('request');
  const [email, setEmail] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [npw, setNpw] = useState('');
  const [npw2, setNpw2] = useState('');

  const f = forcaSenha(npw);
  const mismatch = npw2.length > 0 && npw !== npw2;
  const match = npw2.length > 0 && npw === npw2;
  const podeSalvar = npw.length >= 8 && match;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
      <Backdrop />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', animation: `evkScreenIn .55s ${EASE}` }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <AuthHead />
          <div style={cardAuth}>

            {fase === 'request' && (
              <div style={{ animation: `evkPop .35s ${EASE}` }}>
                <div style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <svg width={26} height={26} viewBox="0 0 24 24" fill="none"><circle cx={9} cy={9} r={5} stroke="#BDFF00" strokeWidth={1.8} /><path d="M12.5 12.5L20 20M17 17l2-2M15 15l2-2" stroke="#BDFF00" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em' }}>Esqueceu a senha?</h1>
                <p style={{ margin: '0 0 24px', color: 'rgba(234,229,219,.62)', fontSize: '.96rem', lineHeight: 1.55 }}>Informe seu e-mail e enviamos um link para criar uma nova senha.</p>
                <label style={labelAuth}>E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" style={{ ...inputAuth, marginBottom: 22 }} />
                <button onClick={() => setFase('sent')} className="hov-btn" style={btnNeon}>Enviar link</button>
                <p style={{ textAlign: 'center', margin: '18px 0 0', fontSize: '.9rem' }}>
                  <a onClick={() => router.push('/login')} style={{ color: 'rgba(234,229,219,.7)', textDecoration: 'underline', cursor: 'pointer' }}>Voltar para o login</a>
                </p>
              </div>
            )}

            {fase === 'sent' && (
              <div style={{ animation: `evkPop .35s ${EASE}` }}>
                <div style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <svg width={26} height={26} viewBox="0 0 24 24" fill="none"><rect x={3} y={5} width={18} height={14} rx={2.5} stroke="#BDFF00" strokeWidth={1.8} /><path d="M4 7l8 5 8-5" stroke="#BDFF00" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em' }}>Verifique seu e-mail</h1>
                <p style={{ margin: '0 0 24px', color: 'rgba(234,229,219,.66)', fontSize: '.96rem', lineHeight: 1.6 }}>Se houver uma conta para <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{email || 'seu e-mail'}</strong>, enviamos um link para redefinir a senha.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {/* "Reenviar link" reenvia (permanece neste passo) — NÃO avança para criar senha:
                      quem chega ao passo de nova senha é pelo link do e-mail (abaixo). */}
                  <button onClick={() => setFase('sent')} className="evk-voltar" style={btnGhost}>Reenviar link</button>
                  <button onClick={() => router.push('/login')} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(234,229,219,.6)', fontWeight: 600, fontSize: '.92rem', padding: 6, cursor: 'pointer' }}>Voltar ao login</button>
                </div>
                <p style={{ margin: '18px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.45)', textAlign: 'center' }}>Não achou? Veja a caixa de spam. <a onClick={() => setFase('reset')} style={{ color: 'rgba(234,229,219,.6)', textDecoration: 'underline', cursor: 'pointer' }}>Abri o link do e-mail</a>.</p>
              </div>
            )}

            {fase === 'reset' && (
              <div style={{ animation: `evkPop .35s ${EASE}` }}>
                <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em' }}>Crie uma nova senha</h1>
                <p style={{ margin: '0 0 22px', color: 'rgba(234,229,219,.62)', fontSize: '.96rem', lineHeight: 1.55 }}>Escolha uma senha forte que você não usa em outro lugar.</p>
                <label style={labelAuth}>Nova senha</label>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input type={showPw ? 'text' : 'password'} value={npw} onChange={(e) => setNpw(e.target.value)} placeholder="Mínimo 8 caracteres" style={{ ...inputAuth, padding: '13px 46px 13px 15px' }} />
                  <button onClick={() => setShowPw((v) => !v)} type="button" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'rgba(234,229,219,.5)', display: 'flex' }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth={1.8} /><circle cx={12} cy={12} r={3} stroke="currentColor" strokeWidth={1.8} /></svg>
                  </button>
                </div>
                {npw.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '6px 0 16px' }}>
                    <div style={{ flex: 1, height: 5, background: 'rgba(234,229,219,.1)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: f.pct, background: f.cor, borderRadius: 99, transition: 'width .3s ease, background .3s ease' }} />
                    </div>
                    <span style={{ fontSize: '.78rem', fontWeight: 700, color: f.cor, minWidth: 60, textAlign: 'right' }}>{f.rotulo}</span>
                  </div>
                )}
                <label style={{ ...labelAuth, margin: '8px 0 7px' }}>Confirmar nova senha</label>
                <input type={showPw ? 'text' : 'password'} value={npw2} onChange={(e) => setNpw2(e.target.value)} placeholder="Repita a senha" style={inputAuth} />
                {mismatch && <p style={{ margin: '8px 0 0', fontSize: '.82rem', color: '#E5484D' }}>As senhas não coincidem.</p>}
                {match && <p style={{ margin: '8px 0 0', fontSize: '.82rem', color: '#16A34A' }}>As senhas coincidem.</p>}
                <button onClick={() => podeSalvar && setFase('done')} disabled={!podeSalvar} className="hov-btn" style={{ ...btnNeon, marginTop: 22, opacity: podeSalvar ? 1 : 0.4, cursor: podeSalvar ? 'pointer' : 'not-allowed' }}>Salvar nova senha</button>
              </div>
            )}

            {fase === 'done' && (
              <div style={{ textAlign: 'center', animation: `evkPop .35s ${EASE}` }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(189,255,0,.14)', border: '1px solid rgba(189,255,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
                  <svg width={30} height={30} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#BDFF00" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <h1 style={{ margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em' }}>Senha alterada com sucesso</h1>
                <p style={{ margin: '0 0 26px', color: 'rgba(234,229,219,.62)', fontSize: '.96rem', lineHeight: 1.55 }}>Pronto. Use sua nova senha para entrar.</p>
                <button onClick={() => router.push('/login')} className="hov-btn" style={btnNeon}>Entrar</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
