'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Backdrop, AuthHead, cardAuth, inputAuth, labelAuth, btnNeon, EASE } from '@/components/auth/ui';
import { temSessao } from '@/lib/session';

export default function LoginPage() {
  const router = useRouter();
  // Já onboardou nesta sessão → volta direto pra área logada; senão, faz o onboarding.
  const entrar = () => router.push(temSessao() ? '/app' : '/onboarding');
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
      <Backdrop />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: 430, animation: `evkScreenIn .55s ${EASE}` }}>
          <svg aria-hidden viewBox="0 0 430 120" style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 430, maxWidth: '100%', opacity: 0.5, pointerEvents: 'none' }}>
            <path d="M20 100 Q150 88 250 56 T410 16" stroke="rgba(189,255,0,.3)" strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray={2400} strokeDashoffset={2400} style={{ animation: `evkDraw 2.4s cubic-bezier(.16,.84,.3,1) .2s forwards` }} />
            <circle cx={250} cy={56} r={3.5} fill="rgba(189,255,0,.6)" /><circle cx={410} cy={16} r={5} fill="#BDFF00" />
          </svg>
          <div style={{ position: 'relative' }}><AuthHead logoSize={52} marca="1.5rem" /></div>
          <div style={cardAuth}>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em' }}>Que bom te ver de novo.</h1>
            <p style={{ margin: '0 0 26px', color: 'rgba(234,229,219,.6)', fontSize: '.96rem' }}>Entre para continuar de onde parou.</p>
            <label style={labelAuth}>E-mail</label>
            <input type="email" placeholder="voce@email.com" style={{ ...inputAuth, marginBottom: 18 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <label style={{ ...labelAuth, marginBottom: 0 }}>Senha</label>
              <Link href="/redefinir" style={{ fontSize: '.82rem', color: '#BDFF00', textDecoration: 'none' }}>Esqueci minha senha</Link>
            </div>
            <input type="password" placeholder="••••••••" style={{ ...inputAuth, marginBottom: 26 }} />
            <button onClick={entrar} className="hov-btn" style={btnNeon}>Entrar</button>
          </div>
          <p style={{ textAlign: 'center', margin: '22px 0 0', fontSize: '.85rem', color: 'rgba(234,229,219,.45)' }}>
            Novo por aqui? <Link href="/cadastro" style={{ color: '#BDFF00', textDecoration: 'underline', fontWeight: 600 }}>Criar conta</Link> · <Link href="/" style={{ color: 'rgba(234,229,219,.75)', textDecoration: 'underline' }}>Conhecer</Link> · <span style={{ border: '1px solid rgba(234,229,219,.25)', borderRadius: 6, padding: '1px 7px', fontSize: '.72rem', fontWeight: 700, color: 'rgba(234,229,219,.6)' }}>18+</span>
          </p>
        </div>
      </div>
    </div>
  );
}
