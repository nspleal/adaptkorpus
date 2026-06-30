'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Error boundary global (App Router). Tema escuro de marca. Não registra dados
 * sensíveis — apenas a mensagem técnica no console do navegador (Hardening-2).
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', bottom: '-14%', left: '-10%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(229,72,77,.14), transparent 70%)', filter: 'blur(22px)' }} />
      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 460 }}>
        <div style={{ width: 56, height: 56, margin: '0 auto 20px', borderRadius: 15, background: 'rgba(229,72,77,.14)', border: '1px solid rgba(229,72,77,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none"><path d="M12 8.5v4M12 16h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="#E5484D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-.02em' }}>Algo deu errado.</h1>
        <p style={{ margin: '0 0 28px', color: 'rgba(234,229,219,.62)', fontSize: '.98rem', lineHeight: 1.55 }}>Tivemos um problema ao carregar esta tela. Você pode tentar de novo ou voltar ao início.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset} style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: '14px 26px', border: 'none', borderRadius: 13, cursor: 'pointer' }}>Tentar de novo</button>
          <Link href="/" style={{ background: 'none', border: '1px solid rgba(234,229,219,.22)', color: '#EAE5DB', fontWeight: 600, fontSize: '1rem', padding: '14px 26px', borderRadius: 13, textDecoration: 'none' }}>Voltar ao início</Link>
        </div>
      </div>
    </div>
  );
}
