import { type ReactNode, type CSSProperties } from 'react';

/**
 * Estados de sistema, vazios e carregamento — porte fiel do V4 ("Adaptkorpus Estados.dc.html").
 * Componentes presentacionais reutilizáveis (server-safe). Regras travadas: toda tela vazia
 * tem ação de saída clara; tom sem culpa; erro nunca expõe stack; sem "IA"; 18+; neon só no escuro.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

type Variante = 'neon' | 'erro' | 'folha';
const MED_VAR: Record<Variante, CSSProperties> = {
  neon: { background: 'rgba(189,255,0,.07)', border: '1px solid rgba(189,255,0,.22)' },
  erro: { background: 'rgba(229,72,77,.1)', border: '1px solid rgba(229,72,77,.34)' },
  folha: { background: 'rgba(22,163,74,.14)', border: '1px solid rgba(22,163,74,.4)' },
};

/** Medalhão de ícone (78px in-app / 84px sistema). */
export function Medalhao({ children, variante = 'neon', size = 78 }: { children: ReactNode; variante?: Variante; size?: number }) {
  return (
    <div style={{ width: size, height: size, minWidth: size, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, ...MED_VAR[variante] }}>
      {children}
    </div>
  );
}

/** Motivo do logo (curva + 3 pontos) no canto sup. direito do empty-card, opacity .08. */
function LogoMotivo() {
  return (
    <svg aria-hidden viewBox="0 0 240 120" width={240} style={{ position: 'absolute', top: -12, right: -12, opacity: 0.08, pointerEvents: 'none' }}>
      <path d="M16 100 Q90 84 140 50 T228 14" stroke="#BDFF00" strokeWidth={3} fill="none" strokeLinecap="round" /><circle cx={16} cy={100} r={5} fill="#BDFF00" /><circle cx={140} cy={50} r={6.5} fill="#BDFF00" /><circle cx={228} cy={14} r={8.5} fill="#BDFF00" />
    </svg>
  );
}

const btnPri: CSSProperties = { background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: '14px 28px', border: 'none', borderRadius: 13, cursor: 'pointer', position: 'relative', zIndex: 1 };
const btnSec: CSSProperties = { background: 'none', border: '1px solid rgba(234,229,219,.22)', color: 'rgba(234,229,219,.82)', fontWeight: 600, fontSize: '.98rem', padding: '13px 24px', borderRadius: 12, cursor: 'pointer', position: 'relative', zIndex: 1 };
export { btnPri as estiloBotaoPrimario, btnSec as estiloBotaoSecundario };

/** Empty-card (vazios B dentro da área logada): card tracejado, medalhão, título, apoio, ações. */
export function EmptyCard({ icone, variante = 'neon', titulo, apoio, children }: { icone: ReactNode; variante?: Variante; titulo: string; apoio: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ background: 'rgba(234,229,219,.022)', border: '1px dashed rgba(234,229,219,.18)', borderRadius: 24, padding: '56px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden', animation: `evkPop .4s ${EASE}` }}>
      <LogoMotivo />
      <div style={{ marginBottom: 22 }}><Medalhao variante={variante}>{icone}</Medalhao></div>
      <h2 style={{ margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em', position: 'relative', zIndex: 1 }}>{titulo}</h2>
      <p style={{ margin: '0 auto 28px', maxWidth: 430, color: 'rgba(234,229,219,.62)', lineHeight: 1.6, fontSize: '1rem', position: 'relative', zIndex: 1 }}>{apoio}</p>
      {children}
    </div>
  );
}

/** Estado de sistema em tela cheia (404/erro/offline/acesso/encaminhamento). */
export function EstadoSistema({ eyebrow, ilustracao, titulo, apoio, acoes, assinatura }: { eyebrow?: string; ilustracao: ReactNode; titulo: string; apoio: ReactNode; acoes: ReactNode; assinatura?: ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '64px 28px', animation: `evkScreenIn .5s ${EASE}` }}>
      {ilustracao}
      {eyebrow && <span style={{ fontSize: '.74rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(234,229,219,.4)', marginBottom: 14 }}>{eyebrow}</span>}
      <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(1.6rem,3.2vw,2.05rem)', fontWeight: 700, letterSpacing: '-.02em', maxWidth: 520, textWrap: 'balance' as CSSProperties['textWrap'] }}>{titulo}</h1>
      <div style={{ margin: '0 auto 30px', maxWidth: 450, color: 'rgba(234,229,219,.62)', lineHeight: 1.65, fontSize: '1.02rem' }}>{apoio}</div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>{acoes}</div>
      {assinatura}
    </div>
  );
}

/** Assinatura do motivo do logo (rodapé de A2/A3). */
export function AssinaturaMotivo() {
  return (
    <svg aria-hidden viewBox="0 0 200 46" width={170} style={{ opacity: 0.45, marginTop: 34 }}>
      <path d="M12 36 Q70 28 110 18 T188 8" stroke="rgba(189,255,0,.35)" strokeWidth={2} fill="none" strokeLinecap="round" /><circle cx={12} cy={36} r={3} fill="rgba(189,255,0,.45)" /><circle cx={110} cy={18} r={4} fill="rgba(189,255,0,.7)" /><circle cx={188} cy={8} r={5.5} fill="#BDFF00" />
    </svg>
  );
}
