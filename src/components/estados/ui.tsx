import { type ReactNode, type CSSProperties } from 'react';

/**
 * Estados de sistema, vazios e carregamento — porte fiel do V4 ("Evokorpus Estados.dc.html").
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

/* ─── Skeletons (shimmer espelhando a forma do conteúdo) ─── */
const SHIMMER: CSSProperties = { background: 'linear-gradient(90deg,rgba(234,229,219,.05) 25%,rgba(234,229,219,.12) 37%,rgba(234,229,219,.05) 63%)', backgroundSize: '900px 100%', animation: 'evkShimmer 1.5s linear infinite' };

/** Bloco de shimmer (barra/quadro com a forma do conteúdo real). */
export function Shimmer({ w, h, r = 8, mb, style }: { w?: number | string; h: number; r?: number; mb?: number; style?: CSSProperties }) {
  return <div className="evk-shimmer" style={{ ...SHIMMER, width: w ?? '100%', height: h, borderRadius: r, marginBottom: mb, ...style }} />;
}

const cardSkel: CSSProperties = { background: 'linear-gradient(165deg, rgba(22,163,74,.07), rgba(15,15,14,.5))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 20, padding: 26 };
const wrapSkel: CSSProperties = { maxWidth: 1080, margin: '0 auto', padding: '32px 22px 64px', width: '100%', boxSizing: 'border-box' };

/** C2 — skeleton da aba Hoje (2 cartões + linha de registrar peso). */
export function SkeletonHoje() {
  return (
    <div style={wrapSkel}>
      <div style={{ marginBottom: 26 }}><Shimmer w={210} h={30} r={9} mb={11} /><Shimmer w={150} h={15} r={8} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 18, marginBottom: 18 }}>
        <div style={cardSkel}><Shimmer w={110} h={13} r={6} mb={20} /><Shimmer w="60%" h={26} r={9} mb={12} /><Shimmer w="80%" h={14} r={7} mb={26} /><Shimmer h={46} r={12} /></div>
        <div style={cardSkel}>
          <Shimmer w={120} h={13} r={6} mb={16} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}><Shimmer w={84} h={84} r={42} /><div style={{ flex: 1 }}><Shimmer w="70%" h={24} r={8} mb={14} /><Shimmer w="90%" h={13} r={7} /></div></div>
          <div style={{ display: 'flex', gap: 10 }}><Shimmer h={40} r={11} /><Shimmer h={40} r={11} /><Shimmer h={40} r={11} /></div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: 18 }}>
        <Shimmer w={40} h={40} r={11} /><Shimmer w={200} h={15} r={7} /><div style={{ flex: 1 }} /><Shimmer w={120} h={38} r={11} />
      </div>
    </div>
  );
}

/** C3 — skeleton de lista (5 linhas de cartão de exercício/prato). */
export function SkeletonLista() {
  return (
    <div style={wrapSkel}>
      <div style={{ marginBottom: 24 }}><Shimmer w={180} h={30} r={9} mb={11} /><Shimmer w={240} h={14} r={7} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(165deg, rgba(22,163,74,.06), rgba(15,15,14,.45))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: 18 }}>
            <Shimmer w={52} h={52} r={13} />
            <div style={{ flex: 1, minWidth: 0 }}><Shimmer w="55%" h={18} r={8} mb={11} /><div style={{ display: 'flex', gap: 8 }}><Shimmer w={72} h={13} r={999} /><Shimmer w={90} h={13} r={999} /></div></div>
            <Shimmer w={96} h={40} r={11} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** C4 — skeleton de gráfico/histórico (card + bloco 240px + tabela). */
export function SkeletonGrafico() {
  return (
    <div style={wrapSkel}>
      <div style={{ marginBottom: 24 }}><Shimmer w={170} h={30} r={9} /></div>
      <div style={{ background: 'linear-gradient(165deg, rgba(22,163,74,.07), rgba(15,15,14,.5))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 20, padding: 22, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}><Shimmer w={180} h={16} r={8} /><Shimmer w={48} h={24} r={8} /></div>
        <Shimmer h={240} r={14} style={{ background: 'linear-gradient(90deg,rgba(234,229,219,.04) 25%,rgba(234,229,219,.1) 37%,rgba(234,229,219,.04) 63%)', backgroundSize: '900px 100%' }} />
      </div>
      <div style={{ background: 'linear-gradient(165deg, rgba(22,163,74,.05), rgba(15,15,14,.4))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '8px 20px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: i === 3 ? 'none' : '1px solid rgba(234,229,219,.06)' }}><Shimmer w={130} h={15} r={7} /><Shimmer w={64} h={15} r={7} /></div>
        ))}
      </div>
    </div>
  );
}
