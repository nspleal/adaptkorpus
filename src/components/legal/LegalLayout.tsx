'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import InstitucionalShell, { type PageKey } from './InstitucionalShell';
import { AValidar } from './ui';

/**
 * Molde de leitura das páginas legais (Termos · Privacidade · Aviso · Suporte) — porte fiel
 * do V3: selo de rascunho, título + subtítulo + "Última atualização", e grid sumário + coluna
 * de leitura (72ch). Sumário com scroll-spy (IntersectionObserver) e item ativo em Pulso.
 * No mobile (<880px, via CSS) o grid empilha e o sumário recolhe.
 */
export default function LegalLayout({
  page, titulo, subtitulo, toc, draftMode = true, readingScale = 1, children,
}: {
  page: Exclude<PageKey, 'ebook'>;
  titulo: string;
  subtitulo: string;
  toc: { id: string; label: string }[];
  draftMode?: boolean;
  readingScale?: number;
  children: ReactNode;
}) {
  const [ativo, setAtivo] = useState<string>(toc[0]?.id ?? '');
  const detalheRef = useRef<HTMLDetailsElement>(null);

  // Sumário recolhido no mobile (≥880px aberto). Imperativo só no mount — mantém toggle do usuário.
  useEffect(() => {
    if (detalheRef.current) detalheRef.current.open = window.innerWidth >= 880;
  }, []);

  // Scroll-spy: destaca a seção visível no sumário.
  useEffect(() => {
    const alvos = toc.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    if (!alvos.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setAtivo(e.target.id); }),
      { rootMargin: '-122px 0px -68% 0px', threshold: 0 },
    );
    alvos.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [toc]);

  return (
    <InstitucionalShell page={page}>
      <div style={{ maxWidth: 1080, margin: '0 auto', animation: `evkScreenIn .5s cubic-bezier(.22,.61,.36,1)` }}>
        {/* bloco de título */}
        <div style={{ position: 'relative', maxWidth: '72ch' }}>
          <svg aria-hidden viewBox="0 0 300 60" style={{ position: 'absolute', top: -14, right: 0, width: 170, maxWidth: '42%', opacity: 0.5, pointerEvents: 'none' }}>
            <path d="M10 50 Q120 44 190 26 T290 8" stroke="rgba(189,255,0,.4)" strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray={420} strokeDashoffset={420} style={{ animation: `evkDraw 2.2s cubic-bezier(.16,.84,.3,1) .25s forwards` }} />
            <circle cx={190} cy={26} r={3} fill="rgba(189,255,0,.6)" /><circle cx={290} cy={8} r={4.5} fill="#BDFF00" />
          </svg>
          {draftMode && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(229,72,77,.12)', border: '1px solid rgba(229,72,77,.42)', color: '#E5484D', borderRadius: 999, padding: '7px 15px', fontSize: '.82rem', fontWeight: 600, marginBottom: 22 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E5484D', animation: 'evkBlink 2s ease-in-out infinite' }} />Rascunho — conteúdo em validação jurídica
            </div>
          )}
          <h1 style={{ margin: '0 0 14px', fontWeight: 800, fontSize: 'clamp(2.1rem,4.4vw,3.2rem)', lineHeight: 1.06, letterSpacing: '-.03em' }}>{titulo}</h1>
          <p style={{ margin: '0 0 18px', fontSize: 'clamp(1.02rem,1.4vw,1.16rem)', lineHeight: 1.6, color: 'rgba(234,229,219,.66)', fontWeight: 500 }}>{subtitulo}</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: '.9rem', color: 'rgba(234,229,219,.5)' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={2} /><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Última atualização: <AValidar>data</AValidar>
          </div>
        </div>

        {/* grid: sumário + leitura */}
        <div className="legal-grid">
          <div className="legal-toc-wrap">
            <details ref={detalheRef} open style={{ background: 'rgba(234,229,219,.035)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: '8px 6px' }}>
              <summary style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.55)' }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h12M4 18h8" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /></svg>Nesta página
              </summary>
              <nav style={{ display: 'flex', flexDirection: 'column', padding: 4 }}>
                {toc.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className={`legal-toc-link${ativo === s.id ? ' is-active' : ''}`}>{s.label}</a>
                ))}
              </nav>
            </details>
          </div>

          <div style={{ minWidth: 0, fontSize: 16 * readingScale }}>{children}</div>
        </div>
      </div>
    </InstitucionalShell>
  );
}
