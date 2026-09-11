'use client';

import { type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';

/**
 * Primitivos compartilhados das telas de conta (login/cadastro/redefinir/confirmar).
 * Porte fiel do protótipo V2 (estilos inline exatos). UI apenas — sem backend (Fase 1).
 */

export const EASE = 'cubic-bezier(.22,.61,.36,1)';

export const cardAuth: CSSProperties = {
  background: 'linear-gradient(168deg, rgba(15,42,26,.9), rgba(15,15,14,.92))',
  border: '1px solid rgba(234,229,219,.1)',
  borderRadius: 24,
  padding: '36px 32px',
  boxShadow: '0 40px 90px -40px rgba(0,0,0,.7)',
};
export const inputAuth: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(234,229,219,.05)',
  border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '13px 15px',
  color: '#EAE5DB', fontSize: '1rem', outline: 'none',
  transition: 'border-color .25s ease, background .25s ease',
};
export const labelAuth: CSSProperties = {
  display: 'block', fontSize: '.74rem', fontWeight: 600, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 7,
};
export const btnNeon: CSSProperties = {
  width: '100%', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1.05rem',
  padding: 15, border: 'none', borderRadius: 13, cursor: 'pointer',
  transition: `transform .25s ${EASE}, box-shadow .3s ease`,
};
export const btnGhost: CSSProperties = {
  width: '100%', background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.16)',
  color: '#EAE5DB', fontWeight: 600, fontSize: '.98rem', padding: 13, borderRadius: 12, cursor: 'pointer',
  transition: 'border-color .25s ease, background .25s ease',
};
export const linkNeon: CSSProperties = { color: '#BDFF00', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 };

/**
 * Link para um documento legal DENTRO de uma linha de consentimento (cadastro/onboarding).
 *
 * Por que existe (cofre `operacao-legal-suporte-reembolso` + `plano-pos-feedback-beta-2026-07-26`
 * §Leva 1): o texto de Termos/Privacidade/Aviso precisa estar acessível ANTES do aceite —
 * consentimento sem acesso ao texto é consentimento NÃO-informado (LGPD/CDC). O 1º retorno
 * do beta foi exatamente "não achei como ler os termos na hora de criar a conta".
 *
 * Duas travas que fazem o link funcionar no lugar onde ele vive — por isso é componente
 * único, e não um `<Link>` solto repetido em cada tela:
 *  1. `target="_blank"` (+ `rel`): a linha vive dentro de um formulário. Navegar na mesma
 *     aba perderia o que já foi digitado — e o "Voltar" das páginas legais leva à landing,
 *     não de volta ao cadastro.
 *  2. `stopPropagation`: a LINHA INTEIRA é o alvo do toggle do consentimento. Sem isto,
 *     abrir o documento para ler MARCARIA o aceite sozinho — o oposto do que a correção quer.
 */
export function LinkLegal({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={linkNeon}>
      {children}
    </Link>
  );
}

/** Força de senha (medidor) — cores do token V2. */
export function forcaSenha(pw: string): { pct: string; cor: string; rotulo: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { pct: '25%', cor: '#E5484D', rotulo: 'Fraca' };
  if (s === 2) return { pct: '50%', cor: '#E5C04D', rotulo: 'Razoável' };
  if (s === 3) return { pct: '75%', cor: '#16A34A', rotulo: 'Boa' };
  return { pct: '100%', cor: '#BDFF00', rotulo: 'Forte' };
}

export function Backdrop() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: '-12%', right: '-8%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,163,74,.20), transparent 68%)', filter: 'blur(22px)', animation: 'evkDrift 24s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '-16%', left: '-12%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(189,255,0,.06), transparent 70%)', filter: 'blur(22px)', animation: 'evkDrift 30s ease-in-out infinite reverse' }} />
    </div>
  );
}

export function LogoFloat({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-label="Adaptkorpus" style={{ animation: 'evkFloat 7s ease-in-out infinite' }}>
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}

export const Marca = ({ size = '1.3rem' }: { size?: string }) => (
  <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.02em' }}><span style={{ color: '#EAE5DB' }}>adapt</span><span style={{ color: '#BDFF00', marginLeft: '0.02em' }}>korpus</span></span>
);

/** Cabeçalho de tela de auth: logo flutuante + wordmark, centrado. */
export function AuthHead({ logoSize = 48, marca = '1.3rem' }: { logoSize?: number; marca?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 30 }}>
      <div style={{ marginBottom: 14 }}><LogoFloat size={logoSize} /></div>
      <Marca size={marca} />
    </div>
  );
}

/** Caixa de checkbox (selo neon quando marcada). */
/**
 * 🔴 LINHA DE CONSENTIMENTO — ACESSÍVEL POR TECLADO (correção 3.3, 2026-07-31).
 *
 * O defeito, aberto desde 26/07 e marcado "leva futura" sem nunca entrar em leva: o aceite
 * era um `<div onClick>` sem `role`, sem `aria-checked` e sem `tabIndex`. **Quem navega por
 * teclado ou usa leitor de tela não conseguia consentir** — e esta é a tela do
 * consentimento, que tem peso legal (LGPD/CDC). Não é polimento: é a porta de entrada.
 *
 * Estrutura, e ela importa:
 *  · o **box** é quem carrega `role="checkbox"`, `aria-checked` e o foco — nunca a linha
 *    inteira, porque o rótulo contém LINKS, e conteúdo interativo dentro de um `checkbox`
 *    é armadilha de leitor de tela (o link some da ordem de leitura);
 *  · a **linha** mantém o `onClick` só como alvo de mouse, do tamanho de antes;
 *  · o box para a propagação, senão clicar nele dispararia os dois e o valor voltaria.
 *
 * 🔒 O `LinkLegal` segue com `stopPropagation`: **ler o documento não pode marcar o
 * consentimento** — consentimento tem de ser ato deliberado, nunca efeito colateral.
 */
export function LinhaConsentimento({ on, onToggle, children, style, boxSize = 24 }: {
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
  style?: CSSProperties;
  boxSize?: number;
}) {
  const acionar = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  };
  return (
    <div onClick={onToggle} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', ...style }}>
      <span
        role="checkbox"
        aria-checked={on}
        tabIndex={0}
        onClick={acionar}
        // Espaço é o acionador canônico de checkbox; Enter entra junto porque em formulário
        // longo a mão já está nele e negar seria atrito sem ganho.
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') acionar(e); }}
        style={{ width: boxSize, height: boxSize, minWidth: boxSize, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .25s ease', border: `1px solid ${on ? '#BDFF00' : 'rgba(234,229,219,.3)'}`, background: on ? '#BDFF00' : 'transparent', cursor: 'pointer', outlineOffset: 3 }}
      >
        {on && <svg width={Math.round(boxSize * 0.55)} height={Math.round(boxSize * 0.55)} viewBox="0 0 24 24" aria-hidden><path d="M5 12l5 5 9-11" stroke="#0D2818" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span style={{ fontSize: '.92rem', lineHeight: 1.45, color: 'rgba(234,229,219,.82)' }}>{children}</span>
    </div>
  );
}
