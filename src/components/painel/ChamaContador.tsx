'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import {
  APOIO_CHAMA, CHAMA_COR_HEX, CHAMA_COR_RGB, bandaChama, chamaAtual, pillChama,
  type ChamaCor,
} from '@/lib/chama';

/**
 * Chama dos 4 marcos — porte FIEL do componente do design (design_handoff_chama_marcos:
 * Chama.dc.html é a fonte de verdade de SVG, paletas, glow e tempos de animação).
 *
 * Regras absolutas (cofre registro-de-aderencia §Contador + handoff):
 * - O fogo NUNCA apaga no estado atual (âmbar desde o dia 1; cinza só em marco FUTURO).
 * - NÃO é streak: nada aqui sugere perder a chama ou dia que conta contra.
 * - Pulso #BDFF00 fica FORA da chama (reservado a acento de UI).
 * - Comemoração (celebrarToken) é única e sutil (~1,25s), só na transição real de marco.
 */

const PALETAS: Record<ChamaCor, { outline: string; bodyTop: string; bodyMid: string; bodyBot: string; innerTop: string; innerBot: string; glow: string }> = {
  amber: { outline: '#8A4A05', bodyTop: '#FFC64F', bodyMid: '#F59A1E', bodyBot: '#E0730A', innerTop: '#FFE9A6', innerBot: '#FFB12E', glow: '245,166,35' },
  azul: { outline: '#123F73', bodyTop: '#77C7F4', bodyMid: '#3593DD', bodyBot: '#1C6EBE', innerTop: '#C4E8FB', innerBot: '#48A4EA', glow: '46,144,219' },
  roxo: { outline: '#3E1C82', bodyTop: '#C79BF3', bodyMid: '#9A5FE6', bodyBot: '#7638CE', innerTop: '#E7D2FB', innerBot: '#A06CE9', glow: '140,85,222' },
  verde: { outline: '#0A5227', bodyTop: '#3CC470', bodyMid: '#16A34A', bodyBot: '#0F7B39', innerTop: '#A2E9BB', innerBot: '#16A34A', glow: '22,163,74' },
};
const CINZA = { outline: '#1E2B24', bodyTop: '#4C5B53', bodyMid: '#3B4942', bodyBot: '#2A3730', innerTop: '#5E6E64', innerBot: '#3C4A43', glow: '120,140,128' };

export function Chama({ cor, estado = 'atual', enfase = true, size = 88, celebrarToken }: {
  cor: ChamaCor; estado?: 'atual' | 'futuro'; enfase?: boolean; size?: number; celebrarToken?: number;
}) {
  const uid = useId();
  const [celebrating, setCelebrating] = useState(false);
  const prevTok = useRef(celebrarToken);
  useEffect(() => {
    // Comemora só quando o token MUDA para um valor truthy (nunca ao montar/re-renderizar).
    if (celebrarToken !== prevTok.current && celebrarToken) {
      prevTok.current = celebrarToken;
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 1250);
      return () => clearTimeout(t);
    }
    prevTok.current = celebrarToken;
  }, [celebrarToken]);

  const futuro = estado === 'futuro';
  const P = futuro ? CINZA : PALETAS[cor];
  const h = Math.round(size * 1.12);
  const g = P.glow;

  const strong = enfase;
  const glowBlur = strong ? 16 : 11;
  const glowInset = strong ? '-36%' : '-26%';
  const gA1 = strong ? 0.5 : 0.32;
  const gA2 = strong ? 0.2 : 0.12;
  const glowStyle: CSSProperties = futuro ? { display: 'none' } : {
    position: 'absolute', inset: glowInset, borderRadius: '50%',
    background: `radial-gradient(circle at 50% 55%, rgba(${g},${gA1}) 0%, rgba(${g},${gA2}) 42%, rgba(${g},0) 70%)`,
    filter: `blur(${glowBlur}px)`,
    animation: strong ? 'evkChamaGlow 2.6s ease-in-out infinite' : 'evkChamaGlowSoft 2.9s ease-in-out infinite',
    pointerEvents: 'none', zIndex: 0,
  };

  const dsA = strong ? 0.5 : 0.32;
  const dsBlur = strong ? 9 : 6;
  const svgStyle: CSSProperties = {
    position: 'relative', zIndex: 1, display: 'block', width: '100%', height: '100%', overflow: 'visible',
    filter: futuro ? 'none' : `drop-shadow(0 1px ${dsBlur}px rgba(${g},${dsA}))`,
    transformOrigin: '50% 92%',
    animation: futuro ? 'none' : 'evkChamaBreathe 3.6s ease-in-out infinite',
  };
  const coreStyle: CSSProperties = { transformOrigin: '50% 90%', animation: futuro ? 'none' : 'evkChamaCore 2.15s ease-in-out infinite' };
  const wrapStyle: CSSProperties = { position: 'relative', width: size, height: h, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...(futuro ? { opacity: 0.55 } : {}) };
  const popStyle: CSSProperties = { position: 'relative', zIndex: 1, width: '100%', height: '100%', transformOrigin: '50% 92%', ...(celebrating ? { animation: 'evkChamaCelebra 1.2s cubic-bezier(.22,.7,.3,1)' } : {}) };
  const flashStyle: CSSProperties = {
    position: 'absolute', inset: '-48%', borderRadius: '50%',
    background: `radial-gradient(circle at 50% 55%, rgba(${g},.55) 0%, rgba(${g},0) 66%)`,
    filter: 'blur(14px)', animation: 'evkChamaFlash 1.2s ease-out', pointerEvents: 'none', zIndex: 0,
  };

  const bodyId = `cbBody-${uid}`;
  const innerId = `cbInner-${uid}`;
  return (
    <div style={wrapStyle} aria-hidden>
      <div style={glowStyle} />
      {celebrating && !futuro && <div style={flashStyle} />}
      <div style={popStyle}>
        <svg viewBox="0 0 100 112" style={svgStyle}>
          <defs>
            <linearGradient id={bodyId} x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0" stopColor={P.bodyTop} /><stop offset="0.55" stopColor={P.bodyMid} /><stop offset="1" stopColor={P.bodyBot} />
            </linearGradient>
            <linearGradient id={innerId} x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0" stopColor={P.innerTop} /><stop offset="1" stopColor={P.innerBot} />
            </linearGradient>
          </defs>
          <path d="M50.7 4 C54.8 16.2 63 28.5 69.1 40.7 C71.1 44.8 73.2 46.8 75.2 44.8 C79.3 40.7 81.3 38.7 83.4 40.7 C87.4 46.8 87.4 57 87.4 65.2 C87.4 89.6 71.1 108 48.7 108 C24.2 108 12 89.6 12 69.2 C12 48.8 22.2 32.5 32.4 20.3 C38.5 12.1 44.6 8.1 50.7 4 Z" fill={`url(#${bodyId})`} stroke={P.outline} strokeWidth={3.3} strokeLinejoin="round" strokeLinecap="round" />
          <g style={coreStyle}>
            <path d="M46 48 C48 54 52 60 55 66 C56 68 57 69 58 68 C60 66 61 65 62 66 C64 69 64 74 64 78 C64 90 56 99 45 99 C33 99 27 90 27 80 C27 70 32 62 37 56 C40 52 43 50 46 48 Z" fill={`url(#${innerId})`} />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** Contagem e chama atual; marcos futuros ficam ocultos para preservar a descoberta. */
export function ContadorTreinos({ dias, celebrarToken, modoDiario }: { dias: number; celebrarToken: number; modoDiario?: boolean }) {
  const a = chamaAtual(dias);
  const b = bandaChama(dias);
  const hex = CHAMA_COR_HEX[a.cor];
  const rgb = CHAMA_COR_RGB[a.cor];


  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ background: 'linear-gradient(165deg, rgba(22,163,74,.12), rgba(15,15,14,.55))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 20, padding: 26, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <Chama cor={a.cor} estado="atual" enfase={a.enfase} size={92} celebrarToken={celebrarToken} />
        <div style={{ flex: 1, minWidth: 250 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '.68rem', fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', padding: '5px 11px', borderRadius: 999, color: hex, background: `rgba(${rgb},.13)`, border: `1px solid rgba(${rgb},.3)` }}>{dias < 15 ? 'Aquecendo' : pillChama(dias, modoDiario)}</span>
          <div style={{ fontSize: '1.34rem', fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.3, marginTop: 12 }}>Você já completou <span style={{ fontWeight: 800, color: hex }}>{dias}</span> {dias === 1 ? 'dia' : 'dias'} de treino.</div>
          <div style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.6)', marginTop: 7, lineHeight: 1.55 }}>{APOIO_CHAMA[b]}</div>
        </div>
      </div>
    </div>
  );
}
