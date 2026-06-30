'use client';

import { useState, type ReactNode } from 'react';

/**
 * Acordeão de FAQ (porte fiel do V3). Primeiro item aberto por padrão; cada item alterna
 * de forma independente. Animação por grid-template-rows (transição limpa, sem medir altura).
 */
export default function FaqAccordion({ itens }: { itens: { q: string; a: ReactNode }[] }) {
  const [abertos, setAbertos] = useState<Set<number>>(new Set([0]));
  const toggle = (i: number) => setAbertos((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {itens.map((it, i) => {
        const on = abertos.has(i);
        return (
          <div key={i} style={{ background: 'rgba(234,229,219,.04)', border: `1px solid ${on ? 'rgba(189,255,0,.3)' : 'rgba(234,229,219,.1)'}`, borderRadius: 15, overflow: 'hidden', transition: 'border-color .3s ease' }}>
            <button onClick={() => toggle(i)} aria-expanded={on} style={{ width: '100%', background: 'none', border: 'none', color: '#EAE5DB', textAlign: 'left', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, cursor: 'pointer', fontSize: '1.02rem', fontWeight: 600 }}>
              {it.q}
              <span style={{ color: '#BDFF00', fontSize: '1.4rem', lineHeight: 1, transition: 'transform .3s ease', minWidth: 18, transform: on ? 'rotate(45deg)' : 'none' }}>+</span>
            </button>
            <div className={`faq-panel${on ? ' open' : ''}`}>
              <div>
                <p style={{ margin: 0, padding: '0 20px 20px', color: 'rgba(234,229,219,.66)', lineHeight: 1.65 }}>{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
