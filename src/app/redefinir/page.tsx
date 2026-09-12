'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Backdrop, AuthHead, cardAuth, inputAuth, labelAuth, btnNeon, btnGhost, EASE, forcaSenha, RequisitosSenha } from '@/components/auth/ui';
import { fraseDosFaltantes, requisitosFaltantes, senhaCumprePolitica } from '@/lib/auth/politica-senha';
import { traduzirErroCadastro } from '@/lib/auth/erro-auth';
import { supabaseConfigurado } from '@/lib/supabase/env';

const ID_REQUISITOS = 'redefinir-requisitos-senha';

/**
 * Redefinir senha (4 estados): request → sent → reset → done. Fluxo real (Supabase):
 * `resetPasswordForEmail` → link do e-mail → `/auth/callback` estabelece a sessão de
 * recuperação e volta aqui → detectamos a sessão e mostramos o passo "nova senha" →
 * `updateUser({ password })`. Sem backend (modo mock) os passos avançam localmente.
 */
type Fase = 'request' | 'sent' | 'reset' | 'done';

export default function RedefinirPage() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>('request');
  const [email, setEmail] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [npw, setNpw] = useState('');
  const [npw2, setNpw2] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Voltando do link do e-mail (via /auth/callback) há uma sessão de recuperação → vai
  // direto ao passo de nova senha.
  useEffect(() => {
    if (!supabaseConfigurado()) return;
    let vivo = true;
    void (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const { data } = await createClient().auth.getSession();
        if (vivo && data.session) setFase('reset');
      } catch { /* segue no passo request */ }
    })();
    return () => { vivo = false; };
  }, []);

  async function enviarLink() {
    setErro(null);
    if (!supabaseConfigurado()) { setFase('sent'); return; }
    if (!email) { setErro('Informe seu e-mail.'); return; }
    setCarregando(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/redefinir`,
      });
      setFase('sent'); // mensagem neutra (não revela se o e-mail existe), mesmo em erro
      void error;
    } finally {
      setCarregando(false);
    }
  }

  async function salvarSenha() {
    if (!podeSalvar) return;
    setErro(null);
    if (!supabaseConfigurado()) { setFase('done'); return; }
    setCarregando(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { error } = await createClient().auth.updateUser({ password: npw });
      if (error) {
        /**
         * 🔴 `updateUser({ password })` passa pela MESMA política de senha do `signUp` — foi
         * ela que produziu o 422 do cadastro em 11/09/2026. Se a recusa for de senha, a tela
         * diz QUAL requisito faltou (por `error.code`/`reasons`, não por texto); qualquer
         * outra falha aqui continua sendo link expirado/sessão perdida, e a copy é a de antes.
         */
        const recusa = traduzirErroCadastro(error, npw);
        setErro(recusa.motivo === 'senha-fraca' ? recusa.texto : 'Não foi possível salvar a senha. Peça um novo link.');
        setCarregando(false);
        return;
      }
      setFase('done');
    } catch {
      setErro('Não foi possível salvar a senha agora. Tente de novo.');
      setCarregando(false);
    }
  }

  const f = forcaSenha(npw);
  const mismatch = npw2.length > 0 && npw !== npw2;
  const match = npw2.length > 0 && npw === npw2;
  /**
   * 🔴 MESMO GATE DO CADASTRO, PELO MESMO MOTIVO. Era `npw.length >= 8`, e `updateUser` é
   * validado pela mesma política do servidor: a tela aprovaria uma senha sem número e só
   * descobriria na recusa. A explicação vem do mesmo módulo, não de uma segunda lista.
   */
  const senhaNovaOk = senhaCumprePolitica(npw);
  const podeSalvar = senhaNovaOk && match;
  const faltamNaSenha = requisitosFaltantes(npw);

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
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" style={{ ...inputAuth, marginBottom: 22 }} />
                {erro && <p style={{ margin: '0 0 12px', fontSize: '.85rem', color: '#E5484D' }}>{erro}</p>}
                <button onClick={enviarLink} disabled={carregando} className="hov-btn" style={{ ...btnNeon, opacity: carregando ? 0.6 : 1 }}>{carregando ? 'Enviando…' : 'Enviar link'}</button>
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
                  <button onClick={enviarLink} disabled={carregando} className="evk-voltar" style={btnGhost}>Reenviar link</button>
                  <button onClick={() => router.push('/login')} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(234,229,219,.6)', fontWeight: 600, fontSize: '.92rem', padding: 6, cursor: 'pointer' }}>Voltar ao login</button>
                </div>
                <p style={{ margin: '18px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.45)', textAlign: 'center' }}>Não achou? Veja a caixa de spam.{!supabaseConfigurado() && <> <a onClick={() => setFase('reset')} style={{ color: 'rgba(234,229,219,.6)', textDecoration: 'underline', cursor: 'pointer' }}>Abri o link do e-mail</a>.</>}</p>
              </div>
            )}

            {fase === 'reset' && (
              <div style={{ animation: `evkPop .35s ${EASE}` }}>
                <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em' }}>Crie uma nova senha</h1>
                <p style={{ margin: '0 0 22px', color: 'rgba(234,229,219,.62)', fontSize: '.96rem', lineHeight: 1.55 }}>Escolha uma senha forte que você não usa em outro lugar.</p>
                <label style={labelAuth}>Nova senha</label>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input type={showPw ? 'text' : 'password'} autoComplete="new-password" aria-describedby={ID_REQUISITOS} value={npw} onChange={(e) => setNpw(e.target.value)} placeholder="Crie uma senha" style={{ ...inputAuth, padding: '13px 46px 13px 15px' }} />
                  <button onClick={() => setShowPw((v) => !v)} type="button" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'rgba(234,229,219,.5)', display: 'flex' }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth={1.8} /><circle cx={12} cy={12} r={3} stroke="currentColor" strokeWidth={1.8} /></svg>
                  </button>
                </div>
                <RequisitosSenha senha={npw} id={ID_REQUISITOS} />
                {/* 🔒 A força estimada só entra depois dos requisitos — antes ela sugeria
                    aceitação para uma senha que o servidor recusaria (defeito do cadastro). */}
                {senhaNovaOk && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '14px 0 16px' }}>
                    <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.45)' }}>Força estimada</span>
                    <div style={{ flex: 1, height: 5, background: 'rgba(234,229,219,.1)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: f.pct, background: f.cor, borderRadius: 99, transition: 'width .3s ease, background .3s ease' }} />
                    </div>
                    <span style={{ fontSize: '.78rem', fontWeight: 700, color: f.cor, minWidth: 48, textAlign: 'right' }}>{f.rotulo}</span>
                  </div>
                )}
                <label style={{ ...labelAuth, margin: '8px 0 7px' }}>Confirmar nova senha</label>
                <input type={showPw ? 'text' : 'password'} autoComplete="new-password" value={npw2} onChange={(e) => setNpw2(e.target.value)} placeholder="Repita a senha" style={inputAuth} />
                {mismatch && <p style={{ margin: '8px 0 0', fontSize: '.82rem', color: '#E5484D' }}>As senhas não coincidem.</p>}
                {match && <p style={{ margin: '8px 0 0', fontSize: '.82rem', color: '#16A34A' }}>As senhas coincidem.</p>}
                {erro && <p role="alert" style={{ margin: '12px 0 0', fontSize: '.85rem', color: '#E5484D', lineHeight: 1.5 }}>{erro}</p>}
                {/* 🔒 Botão indisponível diz POR QUÊ — aqui também. */}
                {npw.length > 0 && !podeSalvar && (
                  <p id="redefinir-pendencia" style={{ margin: '12px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.7)', lineHeight: 1.5 }}>
                    Para continuar: {faltamNaSenha.length > 0 ? `complete a senha com ${fraseDosFaltantes(faltamNaSenha)}` : 'repita a mesma senha no campo de confirmação'}.
                  </p>
                )}
                <button onClick={salvarSenha} disabled={!podeSalvar || carregando} aria-describedby={npw.length > 0 && !podeSalvar ? 'redefinir-pendencia' : undefined} className="hov-btn" style={{ ...btnNeon, marginTop: 22, opacity: podeSalvar && !carregando ? 1 : 0.4, cursor: podeSalvar && !carregando ? 'pointer' : 'not-allowed' }}>{carregando ? 'Salvando…' : 'Salvar nova senha'}</button>
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
