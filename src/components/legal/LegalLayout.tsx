import Link from 'next/link';
import { type ReactNode } from 'react';

/**
 * Layout das páginas institucionais/legais (Termos, Privacidade, Aviso, Suporte).
 * Tema escuro de marca, sem dependência de runtime/IA. Conteúdo é RASCUNHO estruturado —
 * a redação final passa por validação jurídica e volta pelo humano para o cofre.
 */
export default function LegalLayout({ titulo, atualizado, children }: { titulo: string; atualizado?: string; children: ReactNode }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(13,40,24,.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(234,229,219,.1)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <svg width={26} height={26} viewBox="0 0 100 100" fill="none" aria-hidden><line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" /></svg>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-.02em' }}><span style={{ color: '#EAE5DB' }}>evo</span><span style={{ color: '#BDFF00' }}>korpus</span></span>
          </Link>
          <Link href="/" style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.7)', textDecoration: 'none' }}>← Início</Link>
        </div>
      </header>

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '48px 22px 80px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.8rem,4vw,2.4rem)', fontWeight: 800, letterSpacing: '-.02em' }}>{titulo}</h1>
        {atualizado && <p style={{ margin: '0 0 8px', fontSize: '.85rem', color: 'rgba(234,229,219,.45)' }}>Atualizado em {atualizado}</p>}
        <div style={{ display: 'inline-block', margin: '6px 0 28px', background: 'rgba(229,192,77,.12)', border: '1px solid rgba(229,192,77,.35)', color: '#E5C04D', borderRadius: 8, padding: '5px 12px', fontSize: '.78rem', fontWeight: 600 }}>
          Rascunho — conteúdo em validação jurídica
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, lineHeight: 1.65, fontSize: '.98rem', color: 'rgba(234,229,219,.82)' }}>
          {children}
        </div>
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(234,229,219,.1)', display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '.9rem' }}>
          {([['/termos', 'Termos de Uso'], ['/privacidade', 'Política de Privacidade'], ['/aviso', 'Aviso (disclaimer)'], ['/suporte', 'Suporte']] as const).map(([h, t]) => (
            <Link key={h} href={h} className="evk-foot-link" style={{ color: 'rgba(234,229,219,.65)' }}>{t}</Link>
          ))}
        </div>
        <p style={{ margin: '22px 0 0', fontSize: '.78rem', color: 'rgba(234,229,219,.4)', lineHeight: 1.6 }}>
          O Evokorpus é uma ferramenta de uso geral e caráter educacional, dirigida pelo usuário. Não constitui prescrição, consulta ou
          acompanhamento nutricional ou de educação física, nem substitui a orientação de profissionais habilitados. Conteúdo para maiores de 18 anos.
        </p>
      </main>
    </div>
  );
}

/** Seção de documento legal (título + corpo). */
export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 700, color: '#EAE5DB', letterSpacing: '-.01em' }}>{titulo}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </section>
  );
}
