import Link from 'next/link';
import { EstadoSistema, estiloBotaoPrimario, estiloBotaoSecundario } from '@/components/estados/ui';

export const metadata = { title: 'Página não encontrada · Evokorpus' };

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
      <EstadoSistema
        eyebrow="Erro 404"
        ilustracao={
          <svg viewBox="0 0 300 156" width={300} style={{ maxWidth: '100%', marginBottom: 30 }}>
            <line x1={24} y1={132} x2={276} y2={132} stroke="rgba(234,229,219,.1)" strokeWidth={1.5} strokeDasharray="2 8" strokeLinecap="round" />
            <path d="M34 122 Q86 108 118 78" stroke="#EAE5DB" strokeWidth={3.4} fill="none" strokeLinecap="round" opacity={0.85} />
            <path d="M150 56 Q186 38 206 28" stroke="rgba(234,229,219,.34)" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeDasharray="3 9" />
            <path d="M214 24 Q236 16 256 30" stroke="rgba(234,229,219,.18)" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="2 9" />
            <circle cx={34} cy={122} r={4.5} fill="rgba(189,255,0,.5)" />
            <circle cx={118} cy={78} r={5.5} fill="rgba(189,255,0,.7)" />
            <circle cx={138} cy={98} r={6} fill="none" stroke="rgba(229,72,77,.55)" strokeWidth={2} />
            <path d="M135 95l6 6M141 95l-6 6" stroke="rgba(229,72,77,.7)" strokeWidth={1.8} strokeLinecap="round" />
            <circle cx={206} cy={28} r={7.5} fill="#BDFF00" style={{ filter: 'drop-shadow(0 0 10px rgba(189,255,0,.6))', animation: 'evkBlink 2.4s ease-in-out infinite' }} />
          </svg>
        }
        titulo="Essa página saiu da rota."
        apoio="O link pode estar quebrado ou a página mudou de lugar."
        acoes={<>
          <Link href="/" className="hov-btn" style={{ ...estiloBotaoPrimario, textDecoration: 'none', fontSize: '.98rem', padding: '13px 24px', borderRadius: 12 }}>Voltar ao início</Link>
          <Link href="/suporte" className="evk-voltar" style={{ ...estiloBotaoSecundario, textDecoration: 'none' }}>Falar com o suporte</Link>
        </>}
      />
    </div>
  );
}
