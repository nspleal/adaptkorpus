'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { temSessao, useTemSessao } from '@/lib/session';
import { QUANTO_CUSTA } from '@/lib/copy-cobranca';

/**
 * Landing pública do Evokorpus — porte FIEL do protótipo de design (Evokorpus.dc.html):
 * estilos inline idênticos + movimento (backdrop que deriva, trajetórias neon que se
 * desenham, reveals em scroll, mockups flutuando, anel pulsando, FAQ, nav com blur,
 * scroll-spy). Copy travada (nunca "IA"; kcal = "ponto de partida"; sem promessa; 18+).
 */

const rev = (delay = 0): React.CSSProperties => ({ transitionDelay: `${delay}ms` });

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const logado = useTemSessao(); // já onboardou → CTA do topo vira "Abrir o app"
  // Robustez ao 1º quadro: useTemSessao só resolve após o efeito, então se a sessão existir
  // no clique, vamos pro /app mesmo que o rótulo ainda esteja em "Entrar".
  const irAppSeLogado = (e: React.MouseEvent) => { if (temSessao()) { e.preventDefault(); router.push('/app'); } };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      root.querySelectorAll('.rv').forEach((el) => el.classList.add('rv-in'));
      root.querySelectorAll('[data-draw]').forEach((p) => ((p as SVGElement & ElementCSSInlineStyle).style.strokeDashoffset = '0'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    root.querySelectorAll('.rv').forEach((el) => io.observe(el));

    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { (e.target as SVGElement & ElementCSSInlineStyle).style.strokeDashoffset = '0'; cio.unobserve(e.target); } });
    }, { threshold: 0.25 });
    root.querySelectorAll('[data-draw]').forEach((p) => cio.observe(p));

    root.querySelectorAll('#inicio .rv').forEach((el) => el.classList.add('rv-in'));
    const t = setTimeout(() => {
      root.querySelectorAll('.rv').forEach((el) => el.classList.add('rv-in'));
      root.querySelectorAll('[data-draw]').forEach((p) => ((p as SVGElement & ElementCSSInlineStyle).style.strokeDashoffset = '0'));
    }, 1800);

    const nav = document.getElementById('evk-nav');
    const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const setActive = (id: string) => root.querySelectorAll('.evk-navlink').forEach((a) => a.classList.toggle('is-active', a.getAttribute('data-nav') === id));
    const spy = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }), { threshold: 0.5, rootMargin: '-20% 0px -55% 0px' });
    ['inicio', 'como', 'app', 'beta', 'faq'].forEach((id) => { const el = document.getElementById(id); if (el) spy.observe(el); });

    return () => { io.disconnect(); cio.disconnect(); spy.disconnect(); window.removeEventListener('scroll', onScroll); clearTimeout(t); };
  }, []);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      {/* ambient backdrop */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-12%', right: '-8%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,163,74,.20), transparent 68%)', filter: 'blur(20px)', animation: 'evkDrift 22s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-14%', left: '-10%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(189,255,0,.07), transparent 70%)', filter: 'blur(20px)', animation: 'evkDrift 28s ease-in-out infinite reverse' }} />
      </div>

      {/* NAV */}
      <nav id="evk-nav" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <a href="#inicio" style={{ display: 'flex', alignItems: 'center', gap: 11 }}><LogoSvg size={30} /><Marca size="1.32rem" /></a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30, fontSize: '.94rem', fontWeight: 500 }} className="evk-navlinks">
            {[['inicio', 'Início'], ['como', 'Como funciona'], ['app', 'O app'], ['faq', 'FAQ']].map(([id, txt]) => (
              <a key={id} href={`#${id}`} data-nav={id} className="evk-navlink">{txt}</a>
            ))}
          </div>
          {/* 🔒 CTA ÚNICO "Entrar" (DF 2026-07-29). Era "Testar 7 dias grátis" → /cadastro,
              e o cadastro é trancado pela allowlist do beta: o visitante clicava e NÃO
              entrava. Sem checkout no app, um CTA de teste grátis é porta que não abre. */}
          <Link href={logado ? '/app' : '/login'} onClick={irAppSeLogado} className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.92rem', padding: '11px 20px', borderRadius: 12 }}>{logado ? 'Abrir o app' : 'Entrar'}</Link>
        </div>
      </nav>

      {/* HERO */}
      <section id="inicio" style={{ position: 'relative', zIndex: 1, scrollMarginTop: 90, minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '120px 24px 80px' }}>
        <svg aria-hidden viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, opacity: 0.55 }}>
          <path data-draw d="M40 640 Q360 600 520 380 T960 90" stroke="rgba(189,255,0,.30)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray={1600} strokeDashoffset={1600} style={{ transition: `stroke-dashoffset 2.6s cubic-bezier(.16,.84,.3,1)` }} />
          <circle cx={40} cy={640} r={5} fill="rgba(189,255,0,.5)" style={{ animation: 'evkPulse 3.4s ease-in-out infinite' }} />
          <circle cx={520} cy={380} r={7} fill="rgba(189,255,0,.7)" style={{ animation: 'evkPulse 3.4s ease-in-out infinite .5s' }} />
          <circle cx={960} cy={90} r={10} fill="#BDFF00" style={{ animation: 'evkPulse 3.4s ease-in-out infinite 1s', filter: 'drop-shadow(0 0 12px rgba(189,255,0,.7))' }} />
        </svg>
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1180, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 56, alignItems: 'center' }}>
          <div>
            <div className="rv" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', border: '1px solid rgba(189,255,0,.3)', borderRadius: 999, fontSize: '.78rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00', marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#BDFF00', animation: 'evkBlink 2s ease-in-out infinite' }} />Fitness honesto
            </div>
            <h1 className="rv" style={{ ...rev(80), margin: '0 0 22px', fontWeight: 800, fontSize: 'clamp(2.6rem, 5.6vw, 5rem)', lineHeight: 1.02, letterSpacing: '-.03em' }}>O corpo que não para de <span style={{ color: '#BDFF00' }}>evoluir.</span></h1>
            <p className="rv" style={{ ...rev(160), margin: '0 0 36px', fontSize: 'clamp(1.05rem,1.5vw,1.28rem)', lineHeight: 1.6, color: 'rgba(234,229,219,.7)', maxWidth: 520, fontWeight: 500 }}>Treino e dieta que se adaptam a cada avanço seu. Sem planilha, sem achismo — um plano construído com você, dia após dia.</p>
            <div className="rv" style={{ ...rev(240), display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 30 }}>
              <Link href="/login" className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1.02rem', padding: '16px 28px', borderRadius: 14 }}>Entrar</Link>
              <a href="#como" className="hov-btn" style={{ border: '1px solid rgba(234,229,219,.35)', color: '#EAE5DB', fontWeight: 600, fontSize: '1.02rem', padding: '16px 28px', borderRadius: 14 }}>Ver como funciona</a>
            </div>
            <p className="rv" style={{ ...rev(320), margin: 0, fontSize: '.92rem', color: 'rgba(234,229,219,.5)', fontWeight: 500 }}>O beta está fechado. As vagas são por convite. &nbsp;•&nbsp; 18+</p>
          </div>
          <div className="rv" style={{ ...rev(220), justifySelf: 'center' }}>
            <div style={{ animation: 'evkFloat 7s ease-in-out infinite' }}><PhonePlano /></div>
          </div>
        </div>
      </section>

      {/* POSICIONAMENTO */}
      <section id="honesto" style={sec()}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <h2 className="rv" style={{ margin: '0 0 64px', fontWeight: 800, fontSize: 'clamp(1.8rem,3.6vw,3.1rem)', lineHeight: 1.12, letterSpacing: '-.02em', maxWidth: 960 }}>Sem milagre, sem pegadinha, sem dieta de rico. <span style={{ color: 'rgba(234,229,219,.5)' }}>Só o que cabe na sua rotina — e você no comando.</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 22 }}>
            {[
              /* 🔒 Era "Cobrança honesta — preço claro, cancela fácil… você sempre sabe o que
                 está pagando": não há cobrança, não há cancelamento e ninguém paga nada. A
                 copy abaixo é a MESMA já aprovada para /conta e para o Perfil. */
              { ic: <path d="M12 2v20M7 6h7.5a3 3 0 010 6H8a3 3 0 000 6h9" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />, t: 'Beta gratuito', d: 'Não existe assinatura ativa nem cobrança. Quando houver plano pago, você decide se entra.' },
              { ic: <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3z" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />, t: 'Sem promessa mágica', d: `Método e controle no seu ritmo. Nada de 'transformação em 2 semanas'.` },
              { ic: <><path d="M4 18 Q9 16 12 11 T20 5" stroke="#BDFF00" strokeWidth={2} fill="none" strokeLinecap="round" /><circle cx={12} cy={11} r={2} fill="#BDFF00" /><circle cx={20} cy={5} r={2.4} fill="#BDFF00" /></>, t: 'Constância, não perfeição', d: 'O plano que cabe na sua rotina real — do jeito que ela é.' },
            ].map((c, i) => (
              <div key={c.t} className="rv hov-lift" style={{ ...rev(i * 100), background: 'rgba(234,229,219,.035)', border: '1px solid rgba(234,229,219,.09)', borderRadius: 22, padding: 30 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none">{c.ic}</svg>
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: '1.22rem', fontWeight: 700 }}>{c.t}</h3>
                <p style={{ margin: 0, color: 'rgba(234,229,219,.62)', lineHeight: 1.6, fontSize: '.98rem' }}>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como" style={sec('#0F0F0E')}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div className="rv" style={{ maxWidth: 780, marginBottom: 60 }}>
            <Kicker>Como funciona</Kicker>
            <h2 style={{ margin: '0 0 22px', fontWeight: 800, fontSize: 'clamp(1.8rem,3.6vw,3rem)', lineHeight: 1.1, letterSpacing: '-.02em' }}>Um plano que evolui com você, toda semana</h2>
            <p style={{ margin: 0, color: 'rgba(234,229,219,.62)', lineHeight: 1.65, fontSize: '1.05rem' }}>Você diz seu objetivo e sua rotina. O Evokorpus monta treino e dieta a partir de dados reconhecidos e <span style={{ color: '#BDFF00', fontWeight: 600 }}>regras adaptativas</span> — e, a cada avanço seu, recalcula o plano. Você sugere, ajusta e fica no comando: tudo é editável.</p>
          </div>
          <div style={{ position: 'relative' }}>
            <svg aria-hidden viewBox="0 0 1100 120" preserveAspectRatio="none" style={{ position: 'absolute', top: 18, left: 0, width: '100%', height: 120, zIndex: 0, opacity: 0.8 }}>
              <path data-draw d="M70 95 Q330 80 560 55 T1030 18" stroke="rgba(189,255,0,.4)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray={1200} strokeDashoffset={1200} style={{ transition: 'stroke-dashoffset 2.4s cubic-bezier(.16,.84,.3,1)' }} />
            </svg>
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 20 }}>
              {[
                { n: '01', d: 18, g: 0.6, mb: 24, mt: 0, txt: 'Defina seu objetivo e sua rotina', cor: 'rgba(234,229,219,.18)' },
                { n: '02', d: 22, g: 0.65, mb: 22, mt: -2, txt: 'Receba seu plano de treino e dieta', cor: 'rgba(234,229,219,.18)' },
                { n: '03', d: 26, g: 0.7, mb: 18, mt: -4, txt: 'Registre seu progresso', cor: 'rgba(234,229,219,.18)' },
                { n: '04', d: 30, g: 0.8, mb: 14, mt: -6, txt: 'O plano se adapta ao próximo passo', cor: '#BDFF00' },
              ].map((s, i) => (
                <div key={s.n} className="rv" style={rev(i * 120)}>
                  <div style={{ width: s.d, height: s.d, borderRadius: '50%', background: '#BDFF00', boxShadow: `0 0 ${10 + i * 4}px rgba(189,255,0,${s.g})`, marginBottom: s.mb, marginTop: s.mt }} />
                  <div style={{ fontSize: '2.4rem', fontWeight: 800, color: s.cor, lineHeight: 1, marginBottom: 12 }}>{s.n}</div>
                  <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.4 }}>{s.txt}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRÊS TRILHAS */}
      <section id="trilhas" style={sec()}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <h2 className="rv" style={{ margin: '0 0 48px', fontWeight: 800, fontSize: 'clamp(1.8rem,3.4vw,2.8rem)', letterSpacing: '-.02em' }}>Três caminhos, a mesma base honesta</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 22 }}>
            {[
              { n: 'Trilha 01', t: 'Emagrecer', d: 'Um plano calibrado para o seu objetivo, que ajusta o ritmo conforme você avança.' },
              { n: 'Trilha 02', t: 'Ganhar massa', d: 'Progressão estruturada e nutrição no ponto, ajustadas conforme o seu corpo responde.' },
              { n: 'Trilha 03', t: 'Manter / Saúde', d: 'Constância sustentável para manter a forma e cuidar do corpo no longo prazo.' },
            ].map((c, i) => (
              <div key={c.t} className="rv hov-lift" style={{ ...rev(i * 120), background: 'linear-gradient(160deg,rgba(22,163,74,.10),rgba(234,229,219,.02))', border: '1px solid rgba(234,229,219,.09)', borderRadius: 22, padding: 32 }}>
                <div style={{ fontSize: '.76rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#BDFF00', marginBottom: 14 }}>{c.n}</div>
                <h3 style={{ margin: '0 0 12px', fontSize: '1.5rem', fontWeight: 700 }}>{c.t}</h3>
                <p style={{ margin: 0, color: 'rgba(234,229,219,.62)', lineHeight: 1.6 }}>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O APP POR DENTRO */}
      <section id="app" style={sec('#0F0F0E')}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div className="rv" style={{ marginBottom: 56, maxWidth: 680 }}>
            <Kicker>O app por dentro</Kicker>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: 'clamp(1.8rem,3.6vw,3rem)', lineHeight: 1.1, letterSpacing: '-.02em' }}>Tudo que você precisa, do seu jeito</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 40, alignItems: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
              {[
                { ic: <path d="M6 7v10M18 7v10M6 12h12M3 10v4M21 10v4" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" />, t: 'Treino que se adapta', d: 'Progressão guiada pelo seu esforço, em casa ou na academia.' },
                { ic: <><path d="M5 11a7 7 0 0114 0c0 5-7 9-7 9s-7-4-7-9z" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><path d="M9 11h6" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /></>, t: 'Dieta que se recalcula', d: 'Calorias e macros no seu objetivo, com pratos de verdade.' },
                { ic: <path d="M4 7h12l-3-3M20 17H8l3 3" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />, t: 'Trocar é fácil', d: 'Não gostou de um exercício ou alimento? Substitua sem quebrar o plano.' },
                { ic: <><path d="M12 4v4M12 16v4M4 12h4M16 12h4" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /><circle cx={12} cy={12} r={3} stroke="#BDFF00" strokeWidth={2} /></>, t: 'Você no comando', d: 'Tudo é editável. O app sugere; você decide.' },
                { ic: <path d="M3 11l9-7 9 7M5 10v9h14v-9" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />, t: 'Cabe na sua rotina', d: 'Sem equipamento, com o que tem em casa, ou na academia.' },
                { ic: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke="#BDFF00" strokeWidth={1.7} strokeLinecap="round" />, t: 'Opções pra todo mundo', d: 'Cardápios onívoros, vegetarianos e veganos.' },
              ].map((f, i) => (
                <div key={f.t} className="rv hov-lift" style={{ ...rev(i * 80), background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.09)', borderRadius: 18, padding: 22 }}>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" style={{ marginBottom: 14 }}>{f.ic}</svg>
                  <h3 style={{ margin: '0 0 7px', fontSize: '1.02rem', fontWeight: 700 }}>{f.t}</h3>
                  <p style={{ margin: 0, fontSize: '.9rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>{f.d}</p>
                </div>
              ))}
            </div>
            <div className="rv" style={{ ...rev(160), justifySelf: 'center' }}>
              <div style={{ animation: 'evkFloat 8s ease-in-out infinite .5s' }}><PhoneTreino /></div>
            </div>
          </div>
        </div>
      </section>

      {/* TRANSPARÊNCIA */}
      <section id="transparencia" style={sec()}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 56, alignItems: 'center' }}>
          <div className="rv">
            {/* 🔒 O REMATE VOLTA (DF 2026-08-01, `identidade-de-marca-evokorpus` §Passos urgentes).
                Em 2026-07-29 o h2 perdeu a segunda metade — era "É como a gente cobra." — porque no
                beta não há cobrança. 🔴 Truncar onde o board tem remate é REGRESSÃO DE MARCA, não
                conserto: o remate neon era do design. A regra que fica: quando um pilar do
                posicionamento deixa de ser verdade, troca-se o PILAR, não se apaga a frase.
                O board trava três pilares do fitness honesto — cobrança honesta · sem promessa
                mágica · constância. O remate antigo era o ①; este é o ②, e é o que a realidade
                sustenta hoje. Casa com a seção abaixo, que lista o que o app NÃO faz.
                Cor: Pulso #BDFF00, o acento de fundo escuro (skill `evokorpus-brand`). */}
            <h2 style={{ margin: '0 0 18px', fontWeight: 800, fontSize: 'clamp(1.8rem,3.4vw,2.8rem)', lineHeight: 1.12, letterSpacing: '-.02em' }}>Honestidade não é slogan. <span style={{ color: '#BDFF00' }}>É o que a gente deixa de prometer.</span></h2>
            <p style={{ margin: 0, color: 'rgba(234,229,219,.6)', lineHeight: 1.6, fontSize: '1.02rem' }}>Tudo o que entra na sua conta, você vê antes. E o que a gente não faz, a gente diz na cara.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 28 }}>
              {/* 🔒 Saiu "Sem pegadinha no cancelamento": pressupõe assinatura a cancelar. */}
              {['Sem cobrança-surpresa', 'Sem letra miúda'].map((n) => (
                <span key={n} style={{ background: 'rgba(229,72,77,.14)', color: '#E5484D', border: '1px solid rgba(229,72,77,.4)', borderRadius: 999, padding: '9px 16px', fontWeight: 600, fontSize: '.88rem' }}>{n}</span>
              ))}
              {/* 🔒 Saiu o selo "7 dias de garantia": garantia é sobre uma compra, e não há
                  compra. 🔴 E a página /reembolso, que este comentário dizia estar "no ar,
                  linkada no rodapé", SAIU também (DF 2026-08-01): descrevia passo a passo uma
                  operação de estorno inexistente. Página de reembolso sem venda é superfície
                  de risco. O texto público está preservado no cofre e volta com a cobrança. */}
            </div>
          </div>
          <div className="rv" style={{ ...rev(120), display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 🔒 Saíram os quatro itens de cobrança (preço fixo, 7 dias grátis, cancelamento
                em poucos toques, aviso de renovação): nenhum tem mecanismo por trás. */}
            {['Beta gratuito, sem cobrança', 'Seus dados protegidos (LGPD)', 'Ferramenta educacional, 18+'].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.09)', borderRadius: 14, padding: '16px 18px' }}>
                <span style={{ width: 26, height: 26, minWidth: 26, borderRadius: '50%', background: 'rgba(189,255,0,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check14 /></span>
                <span style={{ fontSize: '1rem', fontWeight: 500 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BETA (era a seção PREÇO) */}
      <section id="beta" style={sec('#0F0F0E')}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div className="rv" style={{ position: 'relative', background: 'linear-gradient(165deg,#10301d,#0a1c11)', border: '1px solid rgba(189,255,0,.32)', borderRadius: 28, padding: '44px 40px', boxShadow: '0 30px 80px -36px rgba(189,255,0,.4), inset 0 1px 0 rgba(189,255,0,.1)' }}>
            <svg aria-hidden viewBox="0 0 200 60" style={{ position: 'absolute', top: 24, right: 28, width: 120, opacity: 0.5 }}><path d="M10 50 Q70 44 110 28 T190 8" stroke="rgba(189,255,0,.5)" strokeWidth={2} fill="none" strokeLinecap="round" /><circle cx={110} cy={28} r={3} fill="#BDFF00" /><circle cx={190} cy={8} r={4} fill="#BDFF00" /></svg>
            <Kicker mb={16}>Beta gratuito</Kicker>
            {/* 🔒 Saíram o preço "R$ 29 /mês" e "7 dias grátis. Cancela quando quiser.": não
                existe checkout, não existe teste e não existe assinatura a cancelar. */}
            <div style={{ fontSize: 'clamp(1.9rem,4.4vw,2.6rem)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.15, marginBottom: 10 }}>O beta está fechado.</div>
            <p style={{ margin: '0 0 28px', color: 'rgba(234,229,219,.62)', fontSize: '1rem' }}>As vagas são por convite.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 30 }}>
              {['Treino adaptativo', 'Dieta que se recalcula', 'Substituições de exercício e alimento', 'Tudo editável', 'Casa ou academia', 'Cardápios para todo perfil'].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: '.98rem' }}><Check16 /> {i}</div>
              ))}
            </div>
            <Link href="/login" className="hov-btn" style={{ display: 'block', textAlign: 'center', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1.08rem', padding: 17, borderRadius: 14 }}>Entrar</Link>
            <p style={{ margin: '16px 0 0', textAlign: 'center', fontSize: '.82rem', color: 'rgba(234,229,219,.45)' }}>Para quem já tem conta • 18+</p>
          </div>
        </div>
      </section>

      {/* PROVA SOCIAL */}
      <section id="prova" style={sec()}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div className="rv" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 40 }}>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: 'clamp(1.8rem,3.4vw,2.8rem)', letterSpacing: '-.02em' }}>Quem usa, fala</h2>
            <span style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.45)', border: '1px solid rgba(234,229,219,.18)', borderRadius: 999, padding: '6px 14px' }}>Depoimentos ilustrativos · exemplos</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 22 }}>
            {[
              { i: 'M', n: 'Marina', t: 'O que me prende é a constância. O plano cabe na minha semana de verdade, sem me cobrar perfeição.' },
              /* 🔒 Era "Saber exatamente o que pago, e poder cancelar fácil…" — fala de uma
                 relação de cobrança que não existe, mesmo rotulado como ilustrativo. */
              { i: 'R', n: 'Rafael', t: 'O app não promete milagre e diz o que não faz. Foi isso que me fez confiar.' },
              { i: 'C', n: 'Camila', t: 'Poder trocar exercício e alimento sem quebrar o plano mudou tudo. Ele se adapta ao meu dia.' },
            ].map((d, k) => (
              <div key={d.n} className="rv" style={{ ...rev(k * 120), background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.09)', borderRadius: 22, padding: 28 }}>
                <p style={{ margin: '0 0 22px', fontSize: '1.05rem', lineHeight: 1.55, fontWeight: 500 }}>{`"${d.t}"`}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(189,255,0,.15)', color: '#BDFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{d.i}</div>
                  <div><div style={{ fontWeight: 600, fontSize: '.92rem' }}>{d.n}</div><div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.45)' }}>exemplo ilustrativo</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={sec()}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <h2 className="rv" style={{ margin: '0 0 44px', fontWeight: 800, fontSize: 'clamp(1.8rem,3.4vw,2.8rem)', letterSpacing: '-.02em', textAlign: 'center' }}>Perguntas frequentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { q: 'Isso substitui um nutricionista ou personal?', a: 'Não. O Evokorpus é uma ferramenta geral e educacional, dirigida por você. Para condições de saúde, procure um profissional habilitado.' },
              { q: 'O app usa inteligência artificial?', a: 'Não. O plano é montado por regras claras e adaptativas sobre dados reconhecidos — sem caixa-preta.' },
              { q: 'Vou perder quantos quilos?', a: 'Não prometemos número nem prazo. Entregamos um método que se adapta à sua rotina — o resto é constância.' },
              { q: 'Quanto custa?', a: QUANTO_CUSTA.landing },
              { q: 'Preciso ter quantos anos?', a: 'É um produto para maiores de 18 anos.' },
            ].map((it, i) => <FAQItem key={it.q} q={it.q} a={it.a} delay={i * 60} />)}
          </div>
        </div>
      </section>

      {/* EBOOK */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 40px' }}>
        <div className="rv" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, padding: '16px 22px', background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.08)', borderRadius: 14, fontSize: '.92rem', color: 'rgba(234,229,219,.55)' }}>
          <span>Prefere começar pelo básico? Temos <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>A Curva</strong>, um ebook de entrada por R$ 27.</span>
          <Link href="/ebook" style={{ color: '#EAE5DB', textDecoration: 'underline', fontWeight: 500 }}>Ver o ebook</Link>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ position: 'relative', zIndex: 1, padding: 'clamp(80px,12vh,140px) 24px', textAlign: 'center', overflow: 'hidden' }}>
        <svg aria-hidden viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, margin: 'auto', width: '90%', maxWidth: 800, opacity: 0.4, zIndex: 0 }}><path data-draw d="M60 250 Q280 230 420 150 T740 50" stroke="rgba(189,255,0,.35)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray={1000} strokeDashoffset={1000} style={{ transition: 'stroke-dashoffset 2.4s cubic-bezier(.16,.84,.3,1)' }} /><circle cx={420} cy={150} r={6} fill="rgba(189,255,0,.6)" style={{ animation: 'evkPulse 3.2s ease-in-out infinite' }} /><circle cx={740} cy={50} r={9} fill="#BDFF00" style={{ animation: 'evkPulse 3.2s ease-in-out infinite .6s', filter: 'drop-shadow(0 0 10px rgba(189,255,0,.7))' }} /></svg>
        <div className="rv" style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 30px', fontWeight: 800, fontSize: 'clamp(2.2rem,5vw,4rem)', lineHeight: 1.05, letterSpacing: '-.03em' }}>Dê o próximo passo hoje.</h2>
          <Link href="/login" className="hov-btn" style={{ display: 'inline-block', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1.1rem', padding: '18px 36px', borderRadius: 14 }}>Entrar</Link>
          <p style={{ margin: '18px 0 0', fontSize: '.9rem', color: 'rgba(234,229,219,.5)' }}>O beta está fechado. As vagas são por convite. • 18+</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ position: 'relative', zIndex: 1, background: '#0F0F0E', borderTop: '1px solid rgba(234,229,219,.08)', padding: '64px 24px 40px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 40, marginBottom: 48 }}>
            <div>
              <a href="#inicio" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><LogoSvg size={26} /><Marca size="1.2rem" /></a>
              <p style={{ margin: 0, color: 'rgba(234,229,219,.45)', fontSize: '.9rem', lineHeight: 1.5, maxWidth: 280 }}>Fitness honesto. Treino e dieta que se adaptam a cada avanço seu.</p>
              <span style={{ display: 'inline-block', marginTop: 16, border: '1px solid rgba(234,229,219,.25)', color: 'rgba(234,229,219,.6)', borderRadius: 8, padding: '4px 10px', fontSize: '.8rem', fontWeight: 700 }}>18+</span>
            </div>
            {[
              { t: 'Produto', l: [['#como', 'Como funciona'], ['#app', 'O app'], ['#beta', 'O beta'], ['#faq', 'FAQ']] },
              { t: 'Recursos', l: [['/ebook', 'Ebook']] },
              { t: 'Legal', l: [['/privacidade', 'Política de privacidade'], ['/termos', 'Termos de uso'], ['/aviso', 'Aviso (disclaimer)'], ['/suporte', 'Contato']] },
            ].map((col) => (
              <div key={col.t}>
                <div style={{ fontSize: '.76rem', textTransform: 'uppercase', letterSpacing: '.12em', color: 'rgba(234,229,219,.4)', marginBottom: 16, fontWeight: 600 }}>{col.t}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: '.92rem' }}>{col.l.map((par) => { const h = par[0]!; const t = par[1]!; return h.startsWith('/') ? <Link key={t} href={h} className="evk-foot-link">{t}</Link> : <a key={t} href={h} className="evk-foot-link">{t}</a>; })}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: '0 0 18px', paddingTop: 28, borderTop: '1px solid rgba(234,229,219,.08)', color: 'rgba(234,229,219,.4)', fontSize: '.8rem', lineHeight: 1.6, maxWidth: 880 }}>O Evokorpus é uma ferramenta de uso geral e caráter educacional, dirigida pelo usuário. Não constitui prescrição, consulta ou acompanhamento nutricional ou de educação física, nem substitui a orientação de profissionais habilitados. Consulte um médico antes de iniciar qualquer programa de exercício ou mudança alimentar. Conteúdo para maiores de 18 anos.</p>
          <p style={{ margin: 0, color: 'rgba(234,229,219,.4)', fontSize: '.82rem' }}>© Evokorpus • Botucatu/SP • [CNPJ]</p>
        </div>
      </footer>
    </div>
  );
}

/* ─── helpers ─── */
const sec = (bg?: string): React.CSSProperties => ({ position: 'relative', zIndex: 1, scrollMarginTop: 90, padding: 'clamp(80px,12vh,140px) 24px', ...(bg ? { background: bg } : {}) });

function Kicker({ children, mb = 18 }: { children: React.ReactNode; mb?: number }) {
  return <div style={{ fontSize: '.78rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#BDFF00', marginBottom: mb }}>{children}</div>;
}

function LogoSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Evokorpus">
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}
function Marca({ size }: { size: string }) {
  return <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.02em' }}><span style={{ color: '#EAE5DB' }}>evo</span><span style={{ color: '#BDFF00' }}>korpus</span></span>;
}
const Check14 = () => <svg width={14} height={14} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#BDFF00" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Check16 = () => <svg width={16} height={16} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#BDFF00" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function FAQItem({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="rv" style={{ ...rev(delay), background: 'rgba(234,229,219,.04)', border: `1px solid ${open ? 'rgba(189,255,0,.3)' : 'rgba(234,229,219,.1)'}`, borderRadius: 16, overflow: 'hidden', transition: 'border-color .3s ease, opacity .7s, transform .7s' }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ width: '100%', background: 'none', border: 'none', color: '#EAE5DB', fontFamily: 'inherit', textAlign: 'left', padding: '20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, cursor: 'pointer', fontSize: '1.05rem', fontWeight: 600 }}>
        {q}<span aria-hidden style={{ color: '#BDFF00', fontSize: '1.4rem', lineHeight: 1, transition: 'transform .3s ease', minWidth: 18, transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      <div style={{ maxHeight: open ? (ref.current?.scrollHeight ?? 200) : 0, opacity: open ? 1 : 0, overflow: 'hidden', transition: 'max-height .45s cubic-bezier(.22,.61,.36,1), opacity .4s ease' }}>
        <div ref={ref}><p style={{ margin: 0, padding: '0 22px 22px', color: 'rgba(234,229,219,.62)', lineHeight: 1.6 }}>{a}</p></div>
      </div>
    </div>
  );
}

/* ─── mockups (faceless) ─── */
function PhonePlano() {
  return (
    <div style={{ width: 308, background: '#0b2014', border: '1px solid rgba(234,229,219,.12)', borderRadius: 42, padding: 12, boxShadow: '0 40px 80px -30px rgba(0,0,0,.7), 0 0 0 1px rgba(189,255,0,.05)' }}>
      <div style={{ background: 'linear-gradient(180deg,#0F2A1A,#0a1c10)', borderRadius: 32, padding: '18px 18px 14px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', color: 'rgba(234,229,219,.55)', marginBottom: 18 }}><span>9:41</span><span>● ● ●</span></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div><div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.12em', color: 'rgba(234,229,219,.45)' }}>Quinta · plano do dia</div><div style={{ fontSize: '1.18rem', fontWeight: 700, marginTop: 3 }}>Bom treino, Lu 👊</div></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.08)', borderRadius: 18, padding: 14, marginBottom: 14 }}>
          <svg width={62} height={62} viewBox="0 0 62 62" style={{ animation: 'evkRingGlow 4s ease-in-out infinite' }}><circle cx={31} cy={31} r={26} stroke="rgba(234,229,219,.12)" strokeWidth={6} fill="none" /><circle cx={31} cy={31} r={26} stroke="#BDFF00" strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={163} strokeDashoffset={46} transform="rotate(-90 31 31)" /></svg>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#BDFF00' }}>72%</div><div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.55)' }}>da meta de hoje</div></div>
        </div>
        <div style={{ background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.08)', borderRadius: 18, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><span style={{ fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(234,229,219,.5)' }}>Treino</span><span style={{ fontSize: '.72rem', color: '#BDFF00' }}>45 min</span></div>
          <div style={{ fontWeight: 700, fontSize: '.98rem', marginBottom: 10 }}>Peito &amp; Tríceps</div>
          <div style={{ display: 'flex', gap: 5 }}>{[1, 1, 1, 0, 0].map((on, i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: on ? '#BDFF00' : 'rgba(234,229,219,.15)' }} />)}</div>
        </div>
        <div style={{ background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.08)', borderRadius: 18, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><span style={{ fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(234,229,219,.5)' }}>Dieta</span><span style={{ fontSize: '.72rem', color: 'rgba(234,229,219,.6)' }}>1.840 / 2.100 kcal</span></div>
          <div style={{ display: 'flex', gap: 10, fontSize: '.7rem' }}>{[['Prot', 78], ['Carb', 62], ['Gord', 54]].map(([l, w]) => <div key={l as string} style={{ flex: 1 }}><div style={{ color: 'rgba(234,229,219,.5)', marginBottom: 4 }}>{l}</div><div style={{ height: 5, borderRadius: 3, background: 'rgba(234,229,219,.15)' }}><div style={{ width: `${w}%`, height: '100%', borderRadius: 3, background: '#16A34A' }} /></div></div>)}</div>
        </div>
      </div>
    </div>
  );
}

function PhoneTreino() {
  const exs = [{ n: 'Supino reto', s: '4 × 10 · 32 kg', on: true }, { n: 'Crucifixo', s: '3 × 12 · 14 kg', on: true }];
  return (
    <div style={{ width: 284, background: '#0b2014', border: '1px solid rgba(234,229,219,.12)', borderRadius: 40, padding: 11, boxShadow: '0 40px 80px -30px rgba(0,0,0,.7)' }}>
      <div style={{ background: 'linear-gradient(180deg,#0F2A1A,#0a1c10)', borderRadius: 30, padding: '18px 16px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', color: 'rgba(234,229,219,.5)', marginBottom: 16 }}><span>9:41</span><span>● ● ●</span></div>
        <div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.12em', color: 'rgba(234,229,219,.45)', marginBottom: 4 }}>Treino · Peito &amp; Tríceps</div>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>Hoje · 45 min</div>
        {exs.map((e) => (
          <div key={e.n} style={{ background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.08)', borderRadius: 14, padding: 13, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontWeight: 600, fontSize: '.92rem' }}>{e.n}</div><div style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.5)' }}>{e.s}</div></div>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#BDFF00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={13} height={13} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#0D2818" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          </div>
        ))}
        <div style={{ background: 'rgba(189,255,0,.08)', border: '1px solid rgba(189,255,0,.25)', borderRadius: 14, padding: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontWeight: 600, fontSize: '.92rem', color: '#BDFF00' }}>Tríceps corda</div><div style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.6)' }}>Em andamento · 2/4</div></div>
          <span style={{ fontSize: '.7rem', color: 'rgba(234,229,219,.55)', textDecoration: 'underline' }}>trocar</span>
        </div>
      </div>
    </div>
  );
}
