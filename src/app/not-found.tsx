import Link from 'next/link';

export const metadata = { title: 'Página não encontrada · Evokorpus' };

export default function NotFound() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', top: '-12%', right: '-8%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,163,74,.18), transparent 68%)', filter: 'blur(22px)' }} />
      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 460 }}>
        <svg width={64} height={64} viewBox="0 0 100 100" fill="none" aria-label="Evokorpus" style={{ margin: '0 auto 24px', display: 'block' }}>
          <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
          <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
        </svg>
        <div style={{ fontSize: '3.4rem', fontWeight: 800, letterSpacing: '-.03em', color: '#BDFF00', lineHeight: 1 }}>404</div>
        <h1 style={{ margin: '14px 0 8px', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-.02em' }}>Essa página saiu da rota.</h1>
        <p style={{ margin: '0 0 28px', color: 'rgba(234,229,219,.62)', fontSize: '.98rem', lineHeight: 1.55 }}>O endereço que você abriu não existe ou foi movido. Vamos te trazer de volta à trajetória.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: '14px 26px', borderRadius: 13, textDecoration: 'none' }}>Voltar ao início</Link>
          <Link href="/suporte" style={{ background: 'none', border: '1px solid rgba(234,229,219,.22)', color: '#EAE5DB', fontWeight: 600, fontSize: '1rem', padding: '14px 26px', borderRadius: 13, textDecoration: 'none' }}>Suporte</Link>
        </div>
      </div>
    </div>
  );
}
