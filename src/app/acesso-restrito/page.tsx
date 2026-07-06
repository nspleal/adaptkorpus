'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Medalhao, estiloBotaoPrimario, estiloBotaoSecundario } from '@/components/estados/ui';

/**
 * Acesso restrito (V4 A4) — agora É a tela do guard (Gating-2 / Entitlement-1): o vigia
 * de sessão e o gate do beta chegam aqui com `?motivo=sessao|assinatura`, que semeia a
 * variante (lida de window.location p/ evitar o Suspense do useSearchParams). O
 * segmentado continua para inspeção manual. Tom honesto, sem pressão.
 */
type Variante = 'sessao' | 'assinatura';

export default function AcessoRestrito() {
  const router = useRouter();
  const [v, setV] = useState<Variante>('sessao');
  useEffect(() => {
    const motivo = new URLSearchParams(window.location.search).get('motivo');
    if (motivo === 'assinatura' || motivo === 'sessao') setV(motivo);
  }, []);

  const copy = v === 'assinatura'
    ? { title: 'Sua assinatura está inativa.', sup: 'Renove quando quiser para voltar ao seu plano — sem pressa e sem letra miúda. Você decide.', pri: 'Ver minha assinatura', priGo: () => router.push('/conta'), sec: 'Falar com o suporte', secGo: () => router.push('/suporte') }
    : { title: 'Sua sessão expirou.', sup: 'Faça login de novo para continuar de onde parou. Seus dados continuam salvos.', pri: 'Entrar de novo', priGo: () => router.push('/login'), sec: 'Ver minha assinatura', secGo: () => router.push('/conta') };

  const seg = (val: Variante, label: string) => {
    const on = v === val;
    return <div onClick={() => setV(val)} style={{ padding: '9px 16px', borderRadius: 9, fontSize: '.86rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s', ...(on ? { background: '#BDFF00', color: '#0D2818' } : { background: 'none', color: 'rgba(234,229,219,.6)' }) }}>{label}</div>;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0D2818', color: '#EAE5DB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '56px 28px', animation: 'evkScreenIn .5s cubic-bezier(.22,.61,.36,1)' }}>
      <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 12, marginBottom: 34 }}>
        {seg('sessao', 'Sessão expirada')}{seg('assinatura', 'Assinatura inativa')}
      </div>
      <div style={{ marginBottom: 24 }}>
        <Medalhao variante="neon" size={84}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none"><rect x={5} y={10.5} width={14} height={9.5} rx={2.4} stroke="#EAE5DB" strokeWidth={1.7} /><path d="M8 10.5V8a4 4 0 018 0v2.5" stroke="#BDFF00" strokeWidth={1.7} strokeLinecap="round" /><circle cx={12} cy={15} r={1.4} fill="#EAE5DB" /></svg>
        </Medalhao>
      </div>
      <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(1.6rem,3.2vw,2.05rem)', fontWeight: 700, letterSpacing: '-.02em', maxWidth: 520 }}>{copy.title}</h1>
      <p style={{ margin: '0 auto 30px', maxWidth: 450, color: 'rgba(234,229,219,.62)', lineHeight: 1.65, fontSize: '1.02rem' }}>{copy.sup}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={copy.priGo} className="hov-btn" style={{ ...estiloBotaoPrimario, fontSize: '.98rem', padding: '13px 24px', borderRadius: 12 }}>{copy.pri}</button>
        <button onClick={copy.secGo} className="evk-voltar" style={estiloBotaoSecundario}>{copy.sec}</button>
      </div>
    </div>
  );
}
