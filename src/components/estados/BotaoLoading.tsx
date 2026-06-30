import { type CSSProperties, type ReactNode } from 'react';

/**
 * Botão com estado de carregamento inline (V4 C5). Quando `loading`, mostra spinner,
 * fica `disabled` + `cursor:progress` (sem clique duplo). Variantes primária (Pulso) e
 * secundária (contorno neon). Reutilizável em qualquer CTA.
 */
export default function BotaoLoading({
  loading = false, variante = 'primario', children, carregandoLabel, onClick, type = 'button', style,
}: {
  loading?: boolean;
  variante?: 'primario' | 'secundario';
  children: ReactNode;
  carregandoLabel?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}) {
  const pri = variante === 'primario';
  const base: CSSProperties = pri
    ? { background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.96rem', padding: '13px 22px', border: 'none', borderRadius: 12 }
    : { background: 'none', border: '1px solid rgba(189,255,0,.35)', color: '#BDFF00', fontWeight: 600, fontSize: '.96rem', padding: '12px 22px', borderRadius: 12 };
  return (
    <button
      type={type}
      onClick={loading ? undefined : onClick}
      disabled={loading}
      aria-busy={loading}
      className={loading ? '' : 'hov-btn'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 9, cursor: loading ? 'progress' : 'pointer', opacity: loading ? (pri ? 0.92 : 0.85) : 1, transition: 'opacity .2s ease', ...base, ...style }}
    >
      {loading && (
        <svg width={17} height={17} viewBox="0 0 24 24" style={{ animation: 'evkSpin .8s linear infinite' }} aria-hidden>
          <circle cx={12} cy={12} r={9} stroke={pri ? 'rgba(13,40,24,.28)' : 'rgba(189,255,0,.22)'} strokeWidth={3} fill="none" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke={pri ? '#0D2818' : '#BDFF00'} strokeWidth={3} fill="none" strokeLinecap="round" />
        </svg>
      )}
      {loading && carregandoLabel ? carregandoLabel : children}
    </button>
  );
}
