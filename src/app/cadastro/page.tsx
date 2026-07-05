'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Backdrop, LogoFloat, Marca, cardAuth, inputAuth, labelAuth, EASE, forcaSenha, CheckBox } from '@/components/auth/ui';
import { supabaseConfigurado } from '@/lib/supabase/env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const kicker: CSSProperties = { fontSize: '.72rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00' };

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [t, setT] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const f = forcaSenha(senha);
  const valido = nome.trim().length > 1 && EMAIL_RE.test(email) && senha.length >= 8 && t.every(Boolean);
  const tog = (i: number) => { const n = [...t] as [boolean, boolean, boolean]; n[i] = !n[i]; setT(n); };

  async function submit() {
    if (!valido) return;
    setErro(null);
    try { sessionStorage.setItem('evk_email', email); } catch { /* storage indisponível */ }
    // Sem backend (modo mock): segue direto ao passo de confirmação (comportamento atual).
    if (!supabaseConfigurado()) { router.push('/confirmar'); return; }
    setCarregando(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { error } = await createClient().auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { nome: nome.trim() } },
      });
      if (error) {
        setErro(/already|registered|exist/i.test(error.message)
          ? 'Este e-mail já tem uma conta. Tente entrar.'
          : 'Não foi possível criar a conta. Confira os dados e tente de novo.');
        setCarregando(false);
        return;
      }
      router.push('/confirmar'); // confirmação chega por e-mail → /auth/callback
    } catch {
      setErro('Não foi possível criar a conta agora. Tente de novo.');
      setCarregando(false);
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
      <Backdrop />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '44px 24px 64px', animation: `evkScreenIn .55s ${EASE}` }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 26 }}>
            <div style={{ marginBottom: 13 }}><LogoFloat size={44} /></div><Marca size="1.35rem" />
          </div>
          <div style={{ ...cardAuth, padding: '34px 32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(189,255,0,.12)', border: '1px solid rgba(189,255,0,.3)', color: '#BDFF00', borderRadius: 999, padding: '4px 12px', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 16 }}>Beta fechado</div>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-.02em' }}>Crie sua conta</h1>
            <p style={{ margin: '0 0 26px', color: 'rgba(234,229,219,.62)', fontSize: '.96rem', lineHeight: 1.55 }}>Entre no beta do Evokorpus. É <strong style={{ color: '#EAE5DB', fontWeight: 700 }}>grátis durante os testes</strong> — sem cartão.</p>

            <div style={{ ...kicker, marginBottom: 15 }}>Sua conta</div>
            <Campo label="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" style={inputAuth} /></Campo>
            <Campo label="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" style={inputAuth} /></Campo>
            <Campo label="Senha" mb={8}>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" style={{ ...inputAuth, padding: '13px 46px 13px 15px' }} />
                <button onClick={() => setShowPw((s) => !s)} type="button" aria-label="Mostrar senha" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'rgba(234,229,219,.5)', display: 'flex' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth={1.8} /><circle cx={12} cy={12} r={3} stroke="currentColor" strokeWidth={1.8} /></svg></button>
              </div>
            </Campo>
            {senha.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '6px 0 4px' }}>
                <div style={{ flex: 1, height: 5, background: 'rgba(234,229,219,.1)', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: f.pct, background: f.cor, borderRadius: 99, transition: 'width .3s ease, background .3s ease' }} /></div>
                <span style={{ fontSize: '.78rem', fontWeight: 700, color: f.cor, minWidth: 60, textAlign: 'right' }}>{f.rotulo}</span>
              </div>
            )}

            <div style={{ height: 1, background: 'rgba(234,229,219,.08)', margin: '22px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 22 }}>
              {[
                <>Confirmo que tenho <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>18 anos ou mais</strong>.</>,
                <>Li e aceito os <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>Termos de Uso</strong> e o <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>Aviso (disclaimer)</strong>.</>,
                <>Autorizo o tratamento dos meus dados conforme a <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>Política de Privacidade</strong> (LGPD).</>,
              ].map((txt, i) => (
                <div key={i} onClick={() => tog(i)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                  <CheckBox on={t[i]!} /><span style={{ fontSize: '.92rem', lineHeight: 1.45, color: 'rgba(234,229,219,.82)' }}>{txt}</span>
                </div>
              ))}
            </div>

            {erro && <p style={{ margin: '0 0 16px', fontSize: '.86rem', color: '#E5484D' }}>{erro}</p>}
            <button onClick={submit} disabled={carregando} className={valido && !carregando ? 'hov-btn' : ''} style={{ width: '100%', border: 'none', cursor: valido && !carregando ? 'pointer' : 'default', fontWeight: 700, fontSize: '1.05rem', padding: 15, borderRadius: 13, transition: `transform .25s ${EASE}, box-shadow .3s ease`, ...(valido && !carregando ? { background: '#BDFF00', color: '#0D2818' } : { background: 'rgba(234,229,219,.1)', color: 'rgba(234,229,219,.4)', pointerEvents: valido ? 'auto' : 'none' }) }}>{carregando ? 'Criando…' : 'Criar conta'}</button>
            <p style={{ textAlign: 'center', margin: '18px 0 0', fontSize: '.88rem', color: 'rgba(234,229,219,.55)' }}>Já tem conta? <Link href="/login" style={{ color: '#BDFF00', textDecoration: 'underline', fontWeight: 600 }}>Entrar</Link></p>
          </div>
          <p style={{ textAlign: 'center', margin: '18px 0 0', fontSize: '.8rem', color: 'rgba(234,229,219,.4)', lineHeight: 1.5 }}>O acesso ao beta é por convite. Conteúdo para maiores de 18 anos.</p>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children, mb = 16 }: { label: string; children: React.ReactNode; mb?: number }) {
  return <div style={{ marginBottom: mb }}><label style={labelAuth}>{label}</label>{children}</div>;
}
