'use client';

import { useEffect, useState } from 'react';
import { chaveLocal } from '@/lib/escopo-local';

/**
 * CONVITE DE INSTALAÇÃO (PWA) — Leva C1.
 *
 * **A fala do testador:** *"abrir navegador pelo celular é ruim, um app móvel seria ideal"*.
 * O PWA já existia inteiro (manifest + service worker); o que faltava era **convidar**.
 *
 * 🔒 DENTRO do app, nunca na landing. O beta é fechado por allowlist: convidar um visitante
 * a instalar uma porta que não abre para ele é a mesma família do "Testar 7 dias grátis" que
 * levava ao cadastro trancado (removido em `e5e77fc`).
 *
 * 🔒 TRAVA DE COPY: **o convite NÃO promete notificações.** Elas foram removidas em
 * `e5e77fc` por não existirem — a fachada foi apagada, e ressuscitá-la aqui como argumento
 * de venda seria reintroduzir a mesma mentira por outra porta. O argumento é **abrir sem a
 * barra do navegador**, que é literalmente o que o testador pediu.
 *
 * 🔒 UMA VEZ, dispensável, sem re-insistir. E a dispensa **não vira contagem nem comentário
 * na tela** — "ausência não fala" vale aqui igual: o app não diz "você já dispensou isto".
 */

/** iOS não tem `beforeinstallprompt`: lá a instalação é manual e a instrução é estática. */
function ehIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua)
    // iPadOS 13+ se apresenta como Mac; o toque é o que o distingue.
    || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
  if (!ios) return false;
  // Chrome/Firefox no iOS usam WebKit mas NÃO oferecem "Adicionar à Tela de Início".
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** Já está rodando instalado? Então não há o que convidar. */
function jaInstalado(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches === true;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function ConviteInstalar() {
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);
  const [ios, setIos] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (jaInstalado()) return;
    try {
      if (localStorage.getItem(chaveLocal('evk_instalar_ack_v1'))) return; // já respondeu
    } catch { /* storage indisponível → não insiste */ return; }

    if (ehIosSafari()) { setIos(true); setVisivel(true); return; }

    const aoPoderInstalar = (e: Event) => {
      // Sem o `preventDefault` o Chrome mostra a barra dele por cima da nossa.
      e.preventDefault();
      setEvento(e as EventoInstalacao);
      setVisivel(true);
    };
    window.addEventListener('beforeinstallprompt', aoPoderInstalar);
    // Instalou por fora (menu do browser) → o convite some e não volta.
    const aoInstalar = () => { setVisivel(false); marcarRespondido(); };
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoPoderInstalar);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  /** Respondeu (aceitou, recusou ou dispensou) → nunca mais. Sem contagem, sem "de novo". */
  function marcarRespondido() {
    try { localStorage.setItem(chaveLocal('evk_instalar_ack_v1'), '1'); } catch { /* noop */ }
  }

  async function instalar() {
    if (!evento) return;
    setVisivel(false);
    marcarRespondido();
    try { await evento.prompt(); await evento.userChoice; } catch { /* o browser decide */ }
  }

  function dispensar() {
    setVisivel(false);
    marcarRespondido();
  }

  if (!visivel) return null;

  return (
    <div
      role="complementary"
      aria-label="Instalar o Evokorpus"
      style={{
        background: 'linear-gradient(165deg, rgba(189,255,0,.07), rgba(15,15,14,.5))',
        border: '1px solid rgba(189,255,0,.25)', borderRadius: 18, padding: '18px 20px', marginBottom: 18,
        display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
      }}
    >
      <span aria-hidden style={{ width: 40, height: 40, minWidth: 40, borderRadius: 12, background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <rect x={6} y={2} width={12} height={20} rx={3} stroke="#BDFF00" strokeWidth={1.8} />
          <path d="M12 8v7m0 0l-2.5-2.5M12 15l2.5-2.5" stroke="#BDFF00" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 5 }}>Deixe o Evokorpus na tela inicial</div>
        {/* 🔒 O argumento é a barra do navegador. NADA de notificações — elas não existem. */}
        <p style={{ margin: 0, fontSize: '.9rem', lineHeight: 1.55, color: 'rgba(234,229,219,.66)' }}>
          {ios
            ? <>No Safari, toque em <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>Compartilhar</strong> e depois em <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>Adicionar à Tela de Início</strong>. Abre direto, sem a barra do navegador.</>
            : <>Abre direto, sem a barra do navegador — como um app. Continua sendo o mesmo Evokorpus.</>}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {!ios && (
          <button onClick={() => void instalar()} className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.9rem', padding: '10px 18px', border: 'none', borderRadius: 11, cursor: 'pointer' }}>Instalar</button>
        )}
        <button onClick={dispensar} className="evk-voltar" style={{ background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.9rem', padding: '10px 18px', borderRadius: 11, cursor: 'pointer' }}>{ios ? 'Entendi' : 'Agora não'}</button>
      </div>
    </div>
  );
}
