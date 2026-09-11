import Link from 'next/link';
import InstitucionalShell from '@/components/legal/InstitucionalShell';
export const metadata = { title: 'A Curva · Adaptkorpus' };

const BULLETS = [
  'Como montar uma rotina de treino que cabe no seu dia.',
  'Princípios de progressão sem achismo — e o que evitar.',
  'Como pensar a alimentação com base em dados confiáveis (TACO/USDA).',
  'Mitos comuns de fitness, explicados com calma.',
];

export default function Ebook() {
  return (
    <InstitucionalShell page="ebook">
      <div style={{ maxWidth: 920, margin: '0 auto', animation: `evkScreenIn .5s cubic-bezier(.22,.61,.36,1)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.74rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 18 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#BDFF00' }} />Material de entrada
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 'clamp(28px,4vw,52px)', alignItems: 'center' }}>
          {/* capa ilustrativa (faceless, abstrata) */}
          <div style={{ justifySelf: 'center' }}>
            <div style={{ position: 'relative', width: 230, height: 312, borderRadius: 14, background: 'linear-gradient(160deg,#10301d,#0a1c11)', border: '1px solid rgba(189,255,0,.25)', boxShadow: '0 36px 70px -28px rgba(0,0,0,.7)', overflow: 'hidden', animation: 'evkFloat 8s ease-in-out infinite' }}>
              <svg aria-hidden viewBox="0 0 230 312" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.9 }}><path d="M24 270 Q90 250 130 170 T206 50" stroke="rgba(189,255,0,.4)" strokeWidth={2.5} fill="none" strokeLinecap="round" /><circle cx={130} cy={170} r={5} fill="rgba(189,255,0,.6)" /><circle cx={206} cy={50} r={7} fill="#BDFF00" /></svg>
              <div style={{ position: 'absolute', left: 22, top: 24 }}>
                <svg width={34} height={34} viewBox="0 0 100 100" fill="none"><line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" /></svg>
              </div>
              <div style={{ position: 'absolute', left: 22, right: 22, bottom: 24 }}>
                <div style={{ fontSize: '.66rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(234,229,219,.45)', marginBottom: 6 }}>Ebook</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-.01em', color: '#EAE5DB' }}>A Curva</div>
                <div style={{ fontSize: '.72rem', lineHeight: 1.3, color: 'rgba(234,229,219,.55)', marginTop: 3 }}>O básico do fitness honesto</div>
              </div>
              <div style={{ position: 'absolute', top: 12, right: 12, fontSize: '.62rem', color: 'rgba(234,229,219,.4)', border: '1px solid rgba(234,229,219,.18)', borderRadius: 6, padding: '2px 7px' }}>capa ilustrativa</div>
            </div>
          </div>
          {/* info */}
          <div>
            <h1 style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 'clamp(1.7rem,3.2vw,2.4rem)', lineHeight: 1.08, letterSpacing: '-.02em' }}>A Curva</h1>
            <div style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 600, color: 'rgba(234,229,219,.78)' }}>O básico do fitness honesto</div>
            <p style={{ margin: '0 0 18px', fontSize: '1.02rem', lineHeight: 1.6, color: 'rgba(234,229,219,.66)' }}>Um material introdutório, curto e direto, para quem quer começar com clareza.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 24 }}>
              {BULLETS.map((b) => (
                <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <svg width={17} height={17} viewBox="0 0 24 24" style={{ marginTop: 3, flex: 'none' }}><path d="M5 12l5 5 9-11" stroke="#BDFF00" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span style={{ fontSize: '.98rem', lineHeight: 1.5, color: 'rgba(234,229,219,.78)' }}>{b}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.02em' }}>R$ 27</span><span style={{ fontSize: '.92rem', color: 'rgba(234,229,219,.55)' }}>compra única</span></div>
              {/* Checkout (Kiwify) ainda não integrado — sem backend de pagamento. Afordância
                  honesta "em breve" em vez de um botão morto (convenção de placeholder do app). */}
              <button data-checkout="ebook" disabled aria-disabled="true" title="Checkout em breve" style={{ background: 'rgba(234,229,219,.1)', color: 'rgba(234,229,219,.6)', fontWeight: 700, fontSize: '1rem', padding: '14px 26px', border: '1px solid rgba(234,229,219,.16)', borderRadius: 13, cursor: 'not-allowed' }}>Comprar o ebook · em breve</button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '.84rem', color: 'rgba(234,229,219,.45)' }}>Pagamento seguro • É um material introdutório: não promete resultado nem substitui profissionais.</p>
            <div style={{ borderTop: '1px solid rgba(234,229,219,.1)', paddingTop: 18, fontSize: '.94rem', color: 'rgba(234,229,219,.6)' }}>
              Prefere o plano que se adapta todo dia? <Link href="/" style={{ color: '#BDFF00', textDecoration: 'none', fontWeight: 600, borderBottom: '1px solid rgba(189,255,0,.4)' }}>Conheça o app</Link>.
            </div>
          </div>
        </div>
      </div>
    </InstitucionalShell>
  );
}
