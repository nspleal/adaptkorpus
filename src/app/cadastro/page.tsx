'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Backdrop, LogoFloat, Marca, cardAuth, inputAuth, labelAuth, EASE, forcaSenha, CheckBox } from '@/components/auth/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const kicker: CSSProperties = { fontSize: '.72rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00' };

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [card, setCard] = useState('');
  const [exp, setExp] = useState('');
  const [cvv, setCvv] = useState('');
  const [nomeCartao, setNomeCartao] = useState('');
  const [t, setT] = useState<[boolean, boolean, boolean]>([false, false, false]);

  const f = forcaSenha(senha);
  const valido =
    nome.trim().length > 1 && EMAIL_RE.test(email) && senha.length >= 8 &&
    card.replace(/\s/g, '').length >= 13 && /^\d\d\/\d\d$/.test(exp) && cvv.length >= 3 &&
    nomeCartao.trim().length > 1 && t.every(Boolean);

  function submit() {
    if (!valido) return;
    try { sessionStorage.setItem('evk_email', email); } catch {}
    router.push('/confirmar');
  }
  const tog = (i: number) => { const n = [...t] as [boolean, boolean, boolean]; n[i] = !n[i]; setT(n); };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
      <Backdrop />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '44px 24px 64px', animation: `evkScreenIn .55s ${EASE}` }}>
        <div style={{ width: '100%', maxWidth: 980 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
            <div style={{ marginBottom: 13 }}><LogoFloat size={44} /></div><Marca size="1.35rem" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20, alignItems: 'start' }}>
            {/* FORM */}
            <div style={{ ...cardAuth, padding: '34px 32px' }}>
              <h1 style={{ margin: '0 0 6px', fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-.02em' }}>Crie sua conta</h1>
              <p style={{ margin: '0 0 26px', color: 'rgba(234,229,219,.62)', fontSize: '.96rem', lineHeight: 1.55 }}>Comece seus <strong style={{ color: '#EAE5DB', fontWeight: 700 }}>7 dias grátis</strong>. Você só é cobrado depois — e a gente avisa antes.</p>

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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                <div style={kicker}>Pagamento</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.76rem', fontWeight: 600, color: 'rgba(234,229,219,.55)' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3z" stroke="#16A34A" strokeWidth={1.8} strokeLinejoin="round" /><path d="M9 12l2 2 4-4.5" stroke="#16A34A" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>Pagamento seguro</span>
              </div>
              <Campo label="Número do cartão">
                <div style={{ position: 'relative' }}>
                  <input inputMode="numeric" value={card} onChange={(e) => setCard(e.target.value)} placeholder="0000 0000 0000 0000" style={{ ...inputAuth, padding: '13px 52px 13px 15px' }} />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}><span style={{ width: 22, height: 14, borderRadius: 3, background: 'rgba(234,229,219,.18)' }} /><span style={{ width: 22, height: 14, borderRadius: 3, background: 'rgba(234,229,219,.1)' }} /></span>
                </div>
              </Campo>
              <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                <div style={{ flex: 1 }}><label style={labelAuth}>Validade</label><input inputMode="numeric" value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM/AA" style={inputAuth} /></div>
                <div style={{ flex: 1 }}><label style={labelAuth}>CVV</label><input inputMode="numeric" value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="123" style={inputAuth} /></div>
              </div>
              <Campo label="Nome no cartão" mb={4}><input value={nomeCartao} onChange={(e) => setNomeCartao(e.target.value)} placeholder="Como impresso no cartão" style={inputAuth} /></Campo>

              <div style={{ display: 'flex', gap: 12, background: 'rgba(189,255,0,.07)', border: '1px solid rgba(189,255,0,.25)', borderRadius: 14, padding: '14px 16px', margin: '18px 0 22px' }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M4 8h16v11a1 1 0 01-1 1H5a1 1 0 01-1-1V8z" stroke="#BDFF00" strokeWidth={1.7} strokeLinejoin="round" /><path d="M4 9l8 5 8-5" stroke="#BDFF00" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg>
                <p style={{ margin: 0, fontSize: '.88rem', lineHeight: 1.55, color: 'rgba(234,229,219,.82)' }}>Grátis por 7 dias. Avisamos por e-mail <strong style={{ color: '#BDFF00', fontWeight: 700 }}>antes da primeira cobrança</strong> de R$ 29/mês. Cancele quando quiser.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 24 }}>
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

              <button onClick={submit} className={valido ? 'hov-btn' : ''} style={{ width: '100%', border: 'none', cursor: valido ? 'pointer' : 'default', fontWeight: 700, fontSize: '1.05rem', padding: 15, borderRadius: 13, transition: `transform .25s ${EASE}, box-shadow .3s ease`, ...(valido ? { background: '#BDFF00', color: '#0D2818' } : { background: 'rgba(234,229,219,.1)', color: 'rgba(234,229,219,.4)', pointerEvents: 'none' }) }}>Começar meus 7 dias grátis</button>
              <p style={{ textAlign: 'center', margin: '18px 0 0', fontSize: '.88rem', color: 'rgba(234,229,219,.55)' }}>Já tem conta? <Link href="/login" style={{ color: '#BDFF00', textDecoration: 'underline', fontWeight: 600 }}>Entrar</Link></p>
            </div>

            {/* SIDEBAR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'linear-gradient(165deg, rgba(189,255,0,.08), rgba(15,15,14,.5))', border: '1px solid rgba(189,255,0,.25)', borderRadius: 20, padding: 24 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(189,255,0,.14)', border: '1px solid rgba(189,255,0,.35)', color: '#BDFF00', borderRadius: 999, padding: '5px 13px', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 18 }}>7 dias grátis</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 4 }}><span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.02em' }}>R$ 29</span><span style={{ color: 'rgba(234,229,219,.55)' }}>/mês após o teste</span></div>
                <p style={{ margin: '0 0 22px', fontSize: '.9rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>Você só paga se continuar. Sem cobrança-surpresa.</p>
                <Timeline />
              </div>
              <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '6px 18px' }}>
                {['R$ 29/mês após o teste', 'Cancela quando quiser', 'Sem cobrança-surpresa', 'Conteúdo para maiores de 18 anos'].map((s, i, arr) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 0', ...(i < arr.length - 1 ? { borderBottom: '1px solid rgba(234,229,219,.07)' } : {}) }}><svg width={16} height={16} viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path d="M5 12l5 5 9-11" stroke="#BDFF00" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.8)' }}>{s}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children, mb = 16 }: { label: string; children: React.ReactNode; mb?: number }) {
  return <div style={{ marginBottom: mb }}><label style={labelAuth}>{label}</label>{children}</div>;
}

function Timeline() {
  const passos = [
    { dot: 13, glow: true, t: 'Hoje', d: 'Acesso total ao plano. Nada é cobrado.', linha: true },
    { dot: 11, glow: false, t: 'Dia 5', d: 'Lembrete por e-mail de que o teste vai acabar.', linha: true },
    { dot: 10, ring: true, t: 'Dia 7', d: '1ª cobrança de R$ 29 — ou cancele antes, sem custo.', linha: false },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {passos.map((p) => (
        <div key={p.t} style={{ display: 'flex', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ width: p.dot, height: p.dot, borderRadius: '50%', marginTop: p.glow ? 0 : 1, ...(p.ring ? { border: '2px solid rgba(234,229,219,.35)' } : { background: p.glow ? '#BDFF00' : 'rgba(189,255,0,.55)', boxShadow: p.glow ? '0 0 10px rgba(189,255,0,.6)' : 'none' }) }} />
            {p.linha && <span style={{ width: 2, flex: 1, background: 'linear-gradient(rgba(189,255,0,.5), rgba(189,255,0,.18))', margin: '2px 0' }} />}
          </div>
          <div style={{ paddingBottom: p.linha ? 18 : 0 }}><div style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: 2 }}>{p.t}</div><div style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.45 }}>{p.d}</div></div>
        </div>
      ))}
    </div>
  );
}
