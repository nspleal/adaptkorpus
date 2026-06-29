'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KAscendente, Wordmark } from '@/lib/brand/Logo';

/**
 * Landing pública do Evokorpus — desktop-first responsiva.
 * Estética: handoff de design (tokens do brand board do cofre). Copy: travas do README
 * (nunca "IA" → "regras adaptativas"; kcal = "ponto de partida"; sem promessa; 18+).
 * CTAs de checkout marcados com data-checkout="kiwify" (trocar href pelo link real).
 */

const NAV = [
  { id: 'inicio', rotulo: 'Início' },
  { id: 'como', rotulo: 'Como funciona' },
  { id: 'app', rotulo: 'O app' },
  { id: 'preco', rotulo: 'Preço' },
  { id: 'faq', rotulo: 'FAQ' },
];

export default function Home() {
  return (
    <div className="overflow-x-hidden">
      <Nav />
      <Hero />
      <Posicionamento />
      <ComoFunciona />
      <Trilhas />
      <AppPorDentro />
      <Transparencia />
      <Preco />
      <ProvaSocial />
      <FAQ />
      <Fechamento />
      <Footer />
    </div>
  );
}

/* ─── Nav ──────────────────────────────────────────────────────────────── */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [ativo, setAtivo] = useState('inicio');
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setAtivo(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-colors"
      style={{
        background: scrolled ? 'rgba(13,40,24,0.72)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(234,229,219,0.08)' : '1px solid transparent',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#inicio" className="flex items-center gap-2">
          <KAscendente size={30} />
          <Wordmark className="text-lg" />
        </a>
        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="text-sm transition-colors"
              style={{ color: ativo === n.id ? '#EAE5DB' : 'rgba(234,229,219,0.62)' }}
            >
              {n.rotulo}
            </a>
          ))}
          <Link href="/onboarding" className="btn btn-neon" data-checkout="kiwify" style={{ padding: '0.6rem 1.2rem' }}>
            Testar 7 dias grátis
          </Link>
        </nav>
        <button className="btn btn-ghost md:hidden" style={{ padding: '0.5rem 0.8rem' }} onClick={() => setAberto((v) => !v)} aria-label="Menu">
          ☰
        </button>
      </div>
      {aberto && (
        <div className="border-t border-bone/10 bg-floresta/95 px-5 py-3 md:hidden">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="block py-2 text-sm text-secundario" onClick={() => setAberto(false)}>
              {n.rotulo}
            </a>
          ))}
          <Link href="/onboarding" className="btn btn-neon mt-2 w-full" data-checkout="kiwify">
            Testar 7 dias grátis
          </Link>
        </div>
      )}
    </header>
  );
}

/* ─── seções ───────────────────────────────────────────────────────────── */

function Section({ id, children, className = '' }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto w-full max-w-6xl px-5 ${className}`}>
      {children}
    </section>
  );
}

function Hero() {
  return (
    <Section id="inicio" className="grid items-center gap-12 pb-16 pt-32 md:grid-cols-2 md:pt-40">
      <div>
        <span className="inline-block rounded-full border border-pulso/30 bg-pulso/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-pulso">
          Fitness honesto
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          O corpo que não para de <span className="text-pulso">evoluir.</span>
        </h1>
        <p className="mt-5 max-w-md text-lg text-secundario">
          Treino e dieta que se adaptam a cada avanço seu. Sem planilha, sem achismo — um plano
          construído com você, dia após dia.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/onboarding" className="btn btn-neon" data-checkout="kiwify">
            Testar 7 dias grátis
          </Link>
          <a href="#como" className="btn btn-ghost">Ver como funciona</a>
        </div>
        <p className="mt-4 text-sm text-secundario">R$ 29/mês · Cancela quando quiser · 18+</p>
      </div>
      <div className="flex justify-center md:justify-end">
        <MockupPlano />
      </div>
    </Section>
  );
}

/** Mockup "plano do dia" — abstrato, faceless (sem fotos de pessoas). */
function MockupPlano() {
  return (
    <div className="surface w-[300px] max-w-full p-5" style={{ borderRadius: 28 }}>
      <div className="flex items-center justify-between text-xs text-secundario">
        <span>9:41</span>
        <span>● ● ●</span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-secundario">Quinta · plano do dia</p>
          <p className="text-sm font-semibold">Bom treino 👊</p>
        </div>
        <KAscendente size={26} />
      </div>
      <div className="mt-4 surface-soft flex items-center gap-3 p-3">
        <Anel pct={72} />
        <div>
          <p className="text-2xl font-extrabold text-pulso">72%</p>
          <p className="text-xs text-secundario">do plano de hoje</p>
        </div>
      </div>
      <div className="mt-3 surface-soft p-3">
        <p className="label-cap">Treino · 45 min</p>
        <p className="text-sm">Peito &amp; Tríceps</p>
      </div>
      <div className="mt-3 surface-soft p-3">
        <p className="label-cap">Dieta · ponto de partida</p>
        <p className="text-sm">1.840 / 2.100 kcal</p>
        <div className="mt-2 flex gap-2">
          {[['Prot', 70], ['Carb', 55], ['Gord', 40]].map(([l, w]) => (
            <div key={l as string} className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-bone/10">
                <div className="h-full rounded-full bg-folha" style={{ width: `${w}%` }} />
              </div>
              <p className="mt-1 text-center text-[10px] text-secundario">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Anel({ pct }: { pct: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(234,229,219,0.12)" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="#BDFF00" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  );
}

function TituloSecao({ kicker, titulo, sub }: { kicker?: string; titulo: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {kicker && <span className="label-cap" style={{ color: '#BDFF00' }}>{kicker}</span>}
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{titulo}</h2>
      {sub && <p className="mt-3 text-secundario">{sub}</p>}
    </div>
  );
}

function Posicionamento() {
  const cards = [
    { t: 'Cobrança honesta', d: 'Preço claro, cancela fácil, sem letra miúda. Você sempre sabe o que está pagando.' },
    { t: 'Sem promessa mágica', d: `Método e controle no seu ritmo. Nada de 'transformação em 2 semanas'.` },
    { t: 'Constância, não perfeição', d: 'O plano que cabe na sua rotina real — do jeito que ela é.' },
  ];
  return (
    <Section className="py-16">
      <p className="mx-auto max-w-2xl text-center text-xl font-semibold sm:text-2xl">
        Sem milagre, sem pegadinha, sem dieta de rico. Só o que cabe na sua rotina — e você no comando.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.t} className="surface p-6">
            <h3 className="font-bold text-bone">{c.t}</h3>
            <p className="mt-2 text-sm text-secundario">{c.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ComoFunciona() {
  const passos = [
    { n: '01', t: 'Defina seu objetivo e sua rotina' },
    { n: '02', t: 'Receba seu plano de treino e dieta' },
    { n: '03', t: 'Registre seu progresso' },
    { n: '04', t: 'O plano se adapta ao próximo passo' },
  ];
  return (
    <Section id="como" className="py-20">
      <TituloSecao
        kicker="Como funciona"
        titulo="Um plano que evolui com você, toda semana"
        sub="Você diz seu objetivo e sua rotina. O Evokorpus monta treino e dieta a partir de dados reconhecidos e regras adaptativas — e, a cada avanço seu, recalcula o plano. Você sugere, ajusta e fica no comando: tudo é editável."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {passos.map((p, i) => (
          <div key={p.n} className="surface p-6" style={{ marginTop: `${i * 14}px` }}>
            <p className="text-3xl font-extrabold text-pulso/80">{p.n}</p>
            <p className="mt-3 font-semibold">{p.t}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Trilhas() {
  const t = [
    { n: 'Trilha 01', t: 'Emagrecer', d: 'Um plano calibrado para o seu objetivo, que ajusta o ritmo conforme você avança.' },
    { n: 'Trilha 02', t: 'Ganhar massa', d: 'Progressão estruturada e nutrição no ponto, ajustadas conforme o seu corpo responde.' },
    { n: 'Trilha 03', t: 'Manter / Saúde', d: 'Constância sustentável para manter a forma e cuidar do corpo no longo prazo.' },
  ];
  return (
    <Section className="py-16">
      <TituloSecao titulo="Três caminhos, a mesma base honesta" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {t.map((x) => (
          <div key={x.t} className="surface p-6">
            <span className="label-cap" style={{ color: '#BDFF00' }}>{x.n}</span>
            <h3 className="mt-2 text-xl font-bold">{x.t}</h3>
            <p className="mt-2 text-sm text-secundario">{x.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AppPorDentro() {
  const feats = [
    { t: 'Treino que se adapta', d: 'Progressão guiada pelo seu esforço, em casa ou na academia.' },
    { t: 'Dieta que se recalcula', d: 'Calorias e macros no seu objetivo, com pratos de verdade.' },
    { t: 'Trocar é fácil', d: 'Não curtiu um exercício ou alimento? Substitua sem quebrar o plano.' },
    { t: 'Você no comando', d: 'Tudo é editável. O app sugere; você decide.' },
    { t: 'Cabe na sua rotina', d: 'Sem equipamento, com o que tem em casa, ou na academia.' },
    { t: 'Opções pra todo mundo', d: 'Cardápios onívoros, vegetarianos e veganos.' },
  ];
  return (
    <Section id="app" className="py-20">
      <TituloSecao kicker="O app por dentro" titulo="Tudo que você precisa, do seu jeito" />
      <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {feats.map((f) => (
            <div key={f.t} className="surface-soft p-5">
              <div className="mb-2 h-1 w-8 rounded-full bg-pulso" />
              <h3 className="font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-secundario">{f.d}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center lg:justify-end">
          <MockupTreino />
        </div>
      </div>
    </Section>
  );
}

function MockupTreino() {
  const exs = [
    { n: 'Supino reto', s: '4 × 10 · 32 kg' },
    { n: 'Crucifixo', s: '3 × 12 · 14 kg' },
    { n: 'Tríceps corda', s: 'Em andamento · 2/4' },
  ];
  return (
    <div className="surface w-[300px] max-w-full p-5" style={{ borderRadius: 28 }}>
      <div className="flex items-center justify-between text-xs text-secundario">
        <span>9:41</span>
        <span>● ● ●</span>
      </div>
      <p className="mt-4 label-cap">Treino · Peito &amp; Tríceps</p>
      <p className="text-sm text-secundario">Hoje · 45 min</p>
      <ul className="mt-3 flex flex-col gap-2">
        {exs.map((e) => (
          <li key={e.n} className="surface-soft flex items-center justify-between p-3">
            <div>
              <p className="text-sm">{e.n}</p>
              <p className="text-xs text-secundario">{e.s}</p>
            </div>
            <span className="text-xs text-pulso">trocar</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Transparencia() {
  const sim = [
    'Preço fixo de R$ 29/mês, sempre claro',
    '7 dias grátis pra testar de verdade',
    'Cancela em poucos toques, quando quiser',
    'Aviso antes de qualquer renovação',
    'Seus dados protegidos (LGPD)',
  ];
  const nao = ['Sem cobrança-surpresa', 'Sem pegadinha no cancelamento', 'Sem letra miúda'];
  return (
    <Section className="py-20">
      <TituloSecao
        titulo="Honestidade não é slogan. É como a gente cobra."
        sub="Tudo o que entra na sua conta, você vê antes. E o que a gente não faz, a gente diz na cara."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="surface p-6">
          <ul className="flex flex-col gap-3">
            {sim.map((s) => (
              <li key={s} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 text-folha">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          {nao.map((n) => (
            <div key={n} className="pilula-alerta rounded-xl px-4 py-3 text-sm font-medium">{n}</div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Preco() {
  const inclui = [
    'Treino adaptativo',
    'Dieta que se recalcula',
    'Substituições de exercício e alimento',
    'Tudo editável',
    'Casa ou academia',
    'Cardápios para todo perfil',
  ];
  return (
    <Section id="preco" className="py-20">
      <TituloSecao titulo="Um preço, sem surpresa" />
      <div className="mx-auto mt-10 max-w-md">
        <div className="surface p-7" style={{ borderColor: 'rgba(189,255,0,0.25)' }}>
          <span className="label-cap">Assinatura Evokorpus</span>
          <p className="mt-2 flex items-end gap-1">
            <span className="text-5xl font-extrabold text-pulso">R$ 29</span>
            <span className="mb-1 text-secundario">/mês</span>
          </p>
          <p className="mt-1 text-sm text-secundario">7 dias grátis. Cancela quando quiser.</p>
          <ul className="mt-5 flex flex-col gap-2">
            {inclui.map((i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="text-folha">✓</span>{i}
              </li>
            ))}
          </ul>
          <Link href="/onboarding" className="btn btn-neon mt-6 w-full" data-checkout="kiwify">
            Testar 7 dias grátis
          </Link>
          <p className="mt-3 text-center text-xs text-secundario">R$ 29/mês após o teste · Cancela quando quiser · 18+</p>
        </div>
      </div>
    </Section>
  );
}

function ProvaSocial() {
  const deps = [
    { n: 'Marina', i: 'M', t: 'O que me prende é a constância. O plano cabe na minha semana de verdade, sem me cobrar perfeição.' },
    { n: 'Rafael', i: 'R', t: 'Saber exatamente o que pago, e poder cancelar fácil, fez eu confiar. Sem pegadinha mesmo.' },
    { n: 'Camila', i: 'C', t: 'Poder trocar exercício e alimento sem quebrar o plano mudou tudo. Ele se adapta ao meu dia.' },
  ];
  return (
    <Section className="py-16">
      <TituloSecao titulo="Quem usa, fala" sub="Depoimentos ilustrativos · exemplos" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {deps.map((d) => (
          <div key={d.n} className="surface p-6">
            <p className="text-sm">{`"${d.t}"`}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bone/10 text-sm font-bold">{d.i}</span>
              <div>
                <p className="text-sm font-semibold">{d.n}</p>
                <p className="text-xs text-secundario">exemplo ilustrativo</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FAQ() {
  const itens = [
    { q: 'Isso substitui um nutricionista ou personal?', a: 'Não. O Evokorpus é uma ferramenta geral e educacional, dirigida por você. Para condições de saúde, procure um profissional habilitado.' },
    { q: 'O app usa inteligência artificial?', a: 'Não. O plano é montado por regras claras e adaptativas sobre dados reconhecidos — sem caixa-preta.' },
    { q: 'Vou perder quantos quilos?', a: 'Não prometemos número nem prazo. Entregamos um método que se adapta à sua rotina — o resto é constância.' },
    { q: 'Como funciona a cobrança?', a: 'Assinatura de R$ 29/mês, com 7 dias grátis. Você cancela quando quiser, sem letra miúda. Avisamos antes de qualquer renovação.' },
    { q: 'Preciso ter quantos anos?', a: 'É um produto para maiores de 18 anos.' },
  ];
  const [aberto, setAberto] = useState<number | null>(0);
  return (
    <Section id="faq" className="py-20">
      <TituloSecao titulo="Perguntas frequentes" />
      <div className="mx-auto mt-10 max-w-2xl">
        {itens.map((it, i) => (
          <div key={it.q} className="border-b border-bone/10">
            <button className="flex w-full items-center justify-between gap-4 py-5 text-left" onClick={() => setAberto(aberto === i ? null : i)}>
              <span className="font-semibold">{it.q}</span>
              <span className="text-pulso transition-transform" style={{ transform: aberto === i ? 'rotate(45deg)' : 'none' }}>+</span>
            </button>
            {aberto === i && <p className="-mt-1 pb-5 text-sm text-secundario">{it.a}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

function Fechamento() {
  return (
    <Section className="py-16">
      <div className="surface-soft mx-auto flex max-w-3xl flex-col items-center gap-2 p-5 text-center">
        <p className="text-sm text-secundario">Prefere começar pelo básico? Temos um ebook de entrada por R$ 27.</p>
        <a href="#" className="text-sm font-semibold text-pulso">Ver o ebook →</a>
      </div>
      <div className="mt-12 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Dê o próximo passo hoje.</h2>
        <div className="mt-6 flex justify-center">
          <Link href="/onboarding" className="btn btn-neon" data-checkout="kiwify">Testar 7 dias grátis</Link>
        </div>
        <p className="mt-3 text-sm text-secundario">R$ 29/mês · Cancela quando quiser · 18+</p>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-bone/10 py-12">
      <Section>
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <KAscendente size={28} />
              <Wordmark className="text-lg" />
            </div>
            <p className="mt-3 max-w-xs text-sm text-secundario">Fitness honesto. Treino e dieta que se adaptam a cada avanço seu.</p>
            <span className="mt-3 inline-block rounded-full border border-bone/20 px-2 py-0.5 text-xs text-secundario">18+</span>
          </div>
          <div>
            <p className="label-cap">Produto</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-secundario">
              <li><a href="#como" className="hover:text-bone">Como funciona</a></li>
              <li><a href="#app" className="hover:text-bone">O app</a></li>
              <li><a href="#preco" className="hover:text-bone">Preço</a></li>
              <li><a href="#faq" className="hover:text-bone">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="label-cap">Legal</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-secundario">
              <li><a href="#" className="hover:text-bone">Política de privacidade</a></li>
              <li><a href="#" className="hover:text-bone">Termos de uso</a></li>
              <li><a href="#" className="hover:text-bone">Contato</a></li>
            </ul>
          </div>
        </div>
        <p className="mt-10 text-xs leading-relaxed text-secundario">
          O Evokorpus é uma ferramenta de uso geral e caráter educacional, dirigida pelo usuário. Não
          constitui prescrição, consulta ou acompanhamento nutricional ou de educação física, nem
          substitui a orientação de profissionais habilitados. Consulte um médico antes de iniciar
          qualquer programa de exercício ou mudança alimentar. Conteúdo para maiores de 18 anos.
        </p>
        <p className="mt-4 text-xs text-secundario">© Evokorpus · Botucatu/SP · [CNPJ]</p>
      </Section>
    </footer>
  );
}
