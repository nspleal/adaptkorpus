'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode } from 'react';
import { DISCLAIMER, AValidar } from './ui';
import { temSessao, useTemSessao } from '@/lib/session';

/**
 * Casca institucional (porte fiel do V3): header sticky com blur (logo + "Voltar ao site"
 * + sub-nav de pílulas com a página ativa em Pulso) e footer Carvão (cross-links +
 * disclaimer + 18+ + copyright). Usada pelas páginas legais e pela /ebook.
 */

// 🔒 `reembolso` saiu do tipo em 2026-08-01 — a rota foi ao ar descrevendo estorno e garantia
// que não existem — e VOLTA ao tipo em 2026-08-11 (DF do autor): a página volta ao ar, mas
// dizendo a verdade do beta (não há cobrança, logo não há o que reembolsar). O texto anterior
// segue marcado como "não usar" no cofre; o que voltou é copy nova.
type PageKey = 'termos' | 'privacidade' | 'aviso' | 'suporte' | 'ebook' | 'faq' | 'changelog' | 'reembolso';

const NAV: { key: PageKey; label: string; href: string }[] = [
  { key: 'termos', label: 'Termos', href: '/termos' },
  { key: 'privacidade', label: 'Privacidade', href: '/privacidade' },
  { key: 'aviso', label: 'Aviso', href: '/aviso' },
  { key: 'suporte', label: 'Suporte', href: '/suporte' },
];
const FOOTER: { key: PageKey; label: string; href: string }[] = [
  { key: 'termos', label: 'Termos de Uso', href: '/termos' },
  { key: 'privacidade', label: 'Política de Privacidade', href: '/privacidade' },
  { key: 'aviso', label: 'Aviso', href: '/aviso' },
  { key: 'faq', label: 'Perguntas frequentes', href: '/faq' },
  { key: 'suporte', label: 'Suporte', href: '/suporte' },
  { key: 'changelog', label: 'Changelog', href: '/changelog' },
  { key: 'ebook', label: 'Ebook', href: '/ebook' },
];

function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}
const Marca = ({ size }: { size: string }) => <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.02em' }}><span style={{ color: '#EAE5DB' }}>evo</span><span style={{ color: '#BDFF00' }}>korpus</span></span>;

export default function InstitucionalShell({ page, showAmbient = true, children }: { page: PageKey; showAmbient?: boolean; children: ReactNode }) {
  // Logado → "voltar" leva à área logada (/app), não à landing de marketing; deslogado → landing.
  const router = useRouter();
  const logado = useTemSessao();
  const voltarHref = logado ? '/app' : '/';
  const voltarLabel = logado ? 'Voltar ao app' : 'Voltar ao site';
  // Robustez ao 1º quadro (useTemSessao resolve só após o efeito): se houver sessão no clique,
  // vai pro /app mesmo que o rótulo/href ainda estejam no estado deslogado.
  const irAppSeLogado = (e: React.MouseEvent) => { if (temSessao()) { e.preventDefault(); router.push('/app'); } };
  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%', overflowX: 'hidden', background: '#0D2818', color: '#EAE5DB' }}>
      {/* ambient backdrop (controlável via showAmbient — handoff V3 §7) */}
      {showAmbient && (
        <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-12%', right: '-8%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,163,74,.16), transparent 68%)', filter: 'blur(22px)', animation: 'evkDrift 24s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-16%', left: '-12%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(189,255,0,.05), transparent 70%)', filter: 'blur(22px)', animation: 'evkDrift 30s ease-in-out infinite reverse' }} />
        </div>
      )}

      {/* header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(13,40,24,.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(234,229,219,.1)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
          <Link href={voltarHref} onClick={irAppSeLogado} style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: 'inherit' }}><Logo size={28} /><Marca size="1.24rem" /></Link>
          <Link href={voltarHref} onClick={irAppSeLogado} className="evk-voltar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'rgba(234,229,219,.8)', fontSize: '.92rem', fontWeight: 600, border: '1px solid rgba(234,229,219,.2)', borderRadius: 11, padding: '9px 16px' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>{voltarLabel}
          </Link>
        </div>
        <div style={{ borderTop: '1px solid rgba(234,229,219,.06)' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '9px 24px', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.7rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(234,229,219,.4)', marginRight: 4 }}>Institucional</span>
            {NAV.map((n) => {
              const on = page === n.key;
              return <Link key={n.key} href={n.href} style={{ fontSize: '.9rem', fontWeight: on ? 700 : 600, color: on ? '#0D2818' : 'rgba(234,229,219,.7)', background: on ? '#BDFF00' : 'transparent', border: `1px solid ${on ? '#BDFF00' : 'rgba(234,229,219,.16)'}`, borderRadius: 999, padding: '8px 16px', textDecoration: 'none', transition: 'background .2s ease, color .2s ease, border-color .2s ease' }}>{n.label}</Link>;
            })}
            <span style={{ width: 1, height: 20, background: 'rgba(234,229,219,.14)', margin: '0 4px' }} />
            <Link href="/ebook" style={{ fontSize: '.88rem', fontWeight: page === 'ebook' ? 700 : 500, color: page === 'ebook' ? '#BDFF00' : 'rgba(234,229,219,.55)', textDecoration: 'underline', textUnderlineOffset: 3, padding: '8px 6px' }}>Ebook</Link>
          </div>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, padding: 'clamp(34px,5vw,60px) 24px 0' }}>{children}</main>

      {/* footer */}
      <footer style={{ position: 'relative', zIndex: 1, background: '#0F0F0E', borderTop: '1px solid rgba(234,229,219,.08)', marginTop: 'clamp(56px,9vh,100px)', padding: '52px 24px 40px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 22, marginBottom: 30 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}><Logo size={24} /><Marca size="1.12rem" /></Link>
            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 4px', alignItems: 'center' }}>
              {FOOTER.map((f) => <Link key={f.key} href={f.href} className="evk-foot-link" style={{ fontSize: '.9rem', fontWeight: 500, color: 'rgba(234,229,219,.62)', padding: '7px 12px', borderRadius: 9, textDecoration: 'none' }}>{f.label}</Link>)}
            </nav>
          </div>
          <p style={{ margin: '0 0 18px', paddingTop: 24, borderTop: '1px solid rgba(234,229,219,.08)', color: 'rgba(234,229,219,.4)', fontSize: '.8rem', lineHeight: 1.6, maxWidth: 880 }}>{DISCLAIMER}</p>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <span style={{ border: '1px solid rgba(234,229,219,.25)', color: 'rgba(234,229,219,.6)', borderRadius: 8, padding: '4px 10px', fontSize: '.78rem', fontWeight: 700 }}>18+</span>
            <p style={{ margin: 0, color: 'rgba(234,229,219,.4)', fontSize: '.82rem' }}>© Evokorpus • <AValidar>CNPJ / razão social</AValidar> • Botucatu/SP</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export type { PageKey };
