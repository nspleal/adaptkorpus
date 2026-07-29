'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { chaveLocal } from '@/lib/escopo-local';

/**
 * Faixa de transparência — porte fiel de `design_handoff_banner_privacidade`
 * (banner-reference.html é a fonte de verdade de medidas/copy/estilos; classes `.evk-cookie*`
 * em globals.css). NÃO é consentimento de cookies: o site usa só Vercel Web Analytics
 * (cookieless) → ação ÚNICA "Entendi" + link "Saiba mais". Não é gate (o analytics roda
 * independente do reconhecimento). Sem vermelho (trava do handoff). Copy verbatim.
 */
const ACK_KEY = 'evk_privacy_ack_v1' as const;

export default function AvisoPrivacidade() {
  const pathname = usePathname();
  // Guard de hidratação (padrão do repo, ex.: useTemSessao): começa oculto no SSR/1º paint,
  // resolve do localStorage no efeito — evita mismatch com a faixa fixa.
  const [estado, setEstado] = useState<'hidden' | 'in' | 'leaving'>('hidden');

  useEffect(() => {
    try { if (localStorage.getItem(chaveLocal(ACK_KEY)) !== '1') setEstado('in'); } catch { /* storage indisponível */ }
  }, []);

  // Aviso do site institucional/landing — não aparece dentro do painel logado /app.
  const noApp = pathname === '/app' || pathname.startsWith('/app/');
  if (estado === 'hidden' || noApp) return null;

  const reconhecer = () => {
    try { localStorage.setItem(chaveLocal(ACK_KEY), '1'); } catch { /* storage indisponível */ }
    setEstado('leaving');            // dispara a saída (slide-down + fade via CSS)
    setTimeout(() => setEstado('hidden'), 600); // remove do DOM após a transição (fallback)
  };

  return (
    <aside className={`evk-cookie${estado === 'leaving' ? ' is-leaving' : ''}`} role="region" aria-label="Aviso de privacidade" aria-live="polite">
      <div className="evk-cookie__lead">
        <span className="evk-cookie__icon" aria-hidden="true">
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none">
            <path d="M12 3.4l6.2 2.4V11c0 4.1-2.8 7.3-6.2 8.6C8.6 18.3 5.8 15.1 5.8 11V5.8L12 3.4z" stroke="#EAE5DB" strokeWidth={1.6} strokeLinejoin="round" />
            <path d="M9.3 11.9l1.9 1.9 3.6-3.9" stroke="#EAE5DB" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="evk-cookie__text">Usamos apenas uma medição anônima de uso (sem cookies de rastreio) para melhorar o Evokorpus. <span className="evk-cookie__muted">Nenhum dado de saúde é usado para publicidade.</span></p>
      </div>
      <div className="evk-cookie__actions">
        <Link className="evk-cookie__more" href="/privacidade">Saiba mais</Link>
        <button className="evk-cookie__btn" type="button" onClick={reconhecer}>Entendi</button>
      </div>
    </aside>
  );
}
