'use client';

import type { Marco } from '@/lib/marcos';

/**
 * Marcos de constância (porte fiel do V6.2 §Peça5). Celebração leve, NUNCA punitiva:
 * o anel mostra dias acumulados; uma pausa nunca zera. Dois tamanhos do mesmo componente
 * — cartão completo (aba Progresso) e indicador compacto (aba Hoje).
 */

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** Copy por estado (cartão). */
function textos(m: Marco) {
  if (m.mode === 'atingido') return { eyebrow: 'Marco atingido', title: `Marco de ${m.tier} dias!`, body: `${m.tier} dias de treino registrados. Isso é constância de verdade.` };
  if (m.mode === 'poshiato') return { eyebrow: 'Bem-vindo de volta', title: 'Sua constância continua', body: `Você tirou uns dias de pausa — e está tudo bem. Seu total continua em ${m.atual} de ${m.tier} dias; nenhum dia conta contra você.` };
  return { eyebrow: 'Sua constância', title: `${m.atual} de ${m.tier} dias de treino`, body: `Faltam ${dias(m.restantes)} de treino registrados para o seu marco de ${m.tier} dias.` };
}

function Anel({ m, size, stroke, r }: { m: Marco; size: number; stroke: number; r: number }) {
  const C = 2 * Math.PI * r;
  const frac = m.tier > 0 ? Math.min(1, m.atual / m.tier) : 0;
  const offset = C * (1 - frac);
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} stroke="rgba(234,229,219,.12)" strokeWidth={stroke} fill="none" />
      <circle cx={cx} cy={cx} r={r} stroke="#BDFF00" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={C.toFixed(1)} strokeDashoffset={offset.toFixed(1)} transform={`rotate(-90 ${cx} ${cx})`} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.22,.61,.36,1)', ...(m.mode === 'atingido' ? { animation: 'evkRingGlow 2.4s ease-in-out infinite' } : {}) }} />
    </svg>
  );
}

const MedalhaG = ({ size, float }: { size: number; float?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', inset: 0, margin: 'auto', ...(float ? { animation: 'evkFloat 3s ease-in-out infinite' } : {}) }}>
    {float && <path d="M8.5 13.5L6 21l6-2.5 6 2.5-2.5-7.5" stroke="#BDFF00" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
    <circle cx={12} cy={float ? 8 : 9} r={float ? 6 : 6.4} fill="rgba(189,255,0,.16)" stroke="#BDFF00" strokeWidth={1.8} />
    <path d={float ? 'M9.3 8.1l1.8 1.8 3.2-3.6' : 'M9.2 9.1l1.9 1.9 3.3-3.7'} stroke="#BDFF00" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Cartão completo — aba Progresso. */
export function MarcoCard({ m }: { m: Marco }) {
  const t = textos(m);
  const atingido = m.mode === 'atingido';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', borderRadius: 20, padding: 26, marginBottom: 20, ...(atingido
      ? { background: 'linear-gradient(165deg, rgba(189,255,0,.1), rgba(15,15,14,.5))', border: '1px solid rgba(189,255,0,.38)', boxShadow: '0 0 44px -20px rgba(189,255,0,.55)' }
      : { background: 'linear-gradient(165deg, rgba(22,163,74,.1), rgba(15,15,14,.5))', border: '1px solid rgba(234,229,219,.1)' }) }}>
      <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
        <Anel m={m} size={88} stroke={8} r={37} />
        {atingido
          ? <MedalhaG size={32} float />
          : <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#EAE5DB', letterSpacing: '-.02em', lineHeight: 1.1 }}>{m.atual}</span><span style={{ fontSize: '.64rem', color: 'rgba(234,229,219,.5)' }}>de {m.tier}</span></div>}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00', marginBottom: 6 }}>{t.eyebrow}</div>
        <h3 style={{ margin: '0 0 6px', fontSize: '1.28rem', fontWeight: 800, letterSpacing: '-.02em' }}>{t.title}</h3>
        <p style={{ margin: 0, fontSize: '.94rem', color: 'rgba(234,229,219,.68)', lineHeight: 1.55 }}>{t.body}</p>
      </div>
    </div>
  );
}

/** Indicador compacto — aba Hoje. */
export function MarcoCompacto({ m, onVerDetalhe }: { m: Marco; onVerDetalhe: () => void }) {
  const atingido = m.mode === 'atingido';
  const title = atingido ? `Marco de ${m.tier} dias atingido!` : m.mode === 'poshiato' ? 'Sua constância continua' : `Constância: ${m.atual} de ${m.tier} dias`;
  const sub = atingido ? `${m.tier} dias de treino registrados.` : m.mode === 'poshiato' ? `${m.atual} de ${m.tier} dias — nenhum dia conta contra você.` : `Faltam ${dias(m.restantes)} para o marco de ${m.tier} dias.`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: '14px 16px', marginBottom: 18 }}>
      <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
        <Anel m={m} size={40} stroke={5} r={16} />
        {atingido && <MedalhaG size={17} />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{title}</div>
        <div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.55)' }}>{sub}</div>
      </div>
      <button onClick={onVerDetalhe} className="evk-troca" style={{ flexShrink: 0, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.84rem', padding: '8px 14px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>Ver detalhe</button>
    </div>
  );
}
