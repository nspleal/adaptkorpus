'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Backdrop, AuthHead, cardAuth, inputAuth, labelAuth, btnNeon, EASE } from '@/components/auth/ui';
import { temSessao } from '@/lib/session';
import { supabaseConfigurado } from '@/lib/supabase/env';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  /**
   * 🔴 LOGADO NÃO REENCONTRA O LOGIN (pedido-ui-biblioteca-e-voltar-2026-08-13, aceite 2d).
   * Quem já tem sessão e cai aqui pelo histórico volta ao app com `replace` — sem criar
   * entrada nova, senão o próximo Voltar traria a pessoa de volta para cá em looping.
   *
   * 🔒 A pergunta é feita à sessão de AUTH (`getSession()` — lê o storage local, sem rede),
   * a MESMA fonte que o middleware usa para proteger `/app` (`src/middleware.ts:92`). Usar o
   * cache de perfil (`temSessao()`) daria falso positivo com perfil velho e conta deslogada:
   * mandaria para `/app`, o middleware devolveria para cá, e o par ficaria em ping-pong.
   */
  useEffect(() => {
    if (!supabaseConfigurado()) return;
    let vivo = true;
    void (async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const { data } = await createClient().auth.getSession();
      if (vivo && data.session) router.replace('/app');
    })();
    return () => { vivo = false; };
  }, [router]);

  async function entrar() {
    setErro(null);
    // Sem backend (modo mock): preserva o comportamento atual (não quebra dev/demo).
    if (!supabaseConfigurado()) { router.push(temSessao() ? '/app' : '/onboarding'); return; }
    if (!email || !senha) { setErro('Informe seu e-mail e senha.'); return; }
    setCarregando(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { error } = await createClient().auth.signInWithPassword({ email, password: senha });
      if (error) { setErro('E-mail ou senha inválidos.'); setCarregando(false); return; }
      router.replace('/app'); // /app decide onboarding × painel; o middleware garante a sessão
    } catch {
      setErro('Não foi possível entrar agora. Tente de novo.');
      setCarregando(false);
    }
  }

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
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" style={{ ...inputAuth, marginBottom: 18 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <label style={{ ...labelAuth, marginBottom: 0 }}>Senha</label>
              <Link href="/redefinir" style={{ fontSize: '.82rem', color: '#BDFF00', textDecoration: 'none' }}>Esqueci minha senha</Link>
            </div>
            <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }} placeholder="••••••••" style={{ ...inputAuth, marginBottom: erro ? 12 : 26 }} />
            {erro && <p style={{ margin: '0 0 18px', fontSize: '.85rem', color: '#E5484D' }}>{erro}</p>}
            <button onClick={entrar} disabled={carregando} className="hov-btn" style={{ ...btnNeon, opacity: carregando ? 0.6 : 1, cursor: carregando ? 'wait' : 'pointer' }}>{carregando ? 'Entrando…' : 'Entrar'}</button>
          </div>
          <p style={{ textAlign: 'center', margin: '22px 0 0', fontSize: '.85rem', color: 'rgba(234,229,219,.45)' }}>
            Novo por aqui? <Link href="/cadastro" style={{ color: '#BDFF00', textDecoration: 'underline', fontWeight: 600 }}>Criar conta</Link> · <Link href="/" style={{ color: 'rgba(234,229,219,.75)', textDecoration: 'underline' }}>Conhecer</Link> · <span style={{ border: '1px solid rgba(234,229,219,.25)', borderRadius: 6, padding: '1px 7px', fontSize: '.72rem', fontWeight: 700, color: 'rgba(234,229,219,.6)' }}>18+</span>
          </p>
        </div>
      </div>
    </div>
  );
}
