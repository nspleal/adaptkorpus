'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Backdrop } from '@/components/auth/ui';
import { baixarArquivo } from '@/lib/export';
import { limparDadosLocais, limparSessao } from '@/lib/session';
import { sairDaConta } from '@/lib/auth/sair';
import { inicialDe } from '@/lib/auth/usuario';
import { supabaseConfigurado } from '@/lib/supabase/env';

/**
 * Conta e assinatura — porte fiel do protótipo V2 (.dc.html): status da assinatura
 * (teste/ativa/cancelada), forma de pagamento, histórico de cobrança, dados da conta,
 * privacidade/LGPD e os modais (cancelar, atualizar cartão, excluir conta).
 * UI apenas — o status real virá do webhook Kiwify + Supabase (Fase 2).
 *
 * Mantém os princípios do cofre: 18+, sem promessa, direitos LGPD (baixar/excluir),
 * aviso de cobrança ANTES da 1ª cobrança (transparência travada).
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';
type Sub = 'trial' | 'active' | 'cancelled';

// Datas ilustrativas (mock de UI). No backend virão do provedor de pagamento.
const TRIAL_END = '7 de julho de 2026';
const PROX_COBRANCA = '7 de julho de 2026';

export default function ContaPage() {
  const router = useRouter();
  const [sub, setSub] = useState<Sub>('trial');
  const [menu, setMenu] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  // Placeholder só no modo MOCK; com backend, os dados reais chegam do getUser() abaixo.
  const [nome, setNome] = useState(supabaseConfigurado() ? '' : 'Lucas Almeida');
  const [email, setEmail] = useState(supabaseConfigurado() ? '' : 'lucas@email.com');
  useEffect(() => {
    if (!supabaseConfigurado()) return;
    let vivo = true;
    void (async () => {
      try {
        // Fix bloqueador 2026-07-08: sessão LOCAL primeiro (getSession — sem rede; uso
        // só de EXIBIÇÃO); getUser (rede) apenas se não houver sessão no storage.
        const { createClient } = await import('@/lib/supabase/client');
        const auth = createClient().auth;
        const { data: { session } } = await auth.getSession();
        let u = session?.user ?? null;
        if (!u) u = (await auth.getUser()).data.user;
        if (!vivo || !u) return;
        setEmail(u.email ?? '');
        const n = (u.user_metadata as { nome?: string } | null)?.nome;
        setNome(n || u.email?.split('@')[0] || 'Sua conta');
      } catch { /* mantém o estado atual */ }
    })();
    return () => { vivo = false; };
  }, []);
  const [editar, setEditar] = useState<null | { campo: 'nome' | 'email'; valor: string }>(null);

  function salvarEdicao() {
    if (!editar) return;
    const v = editar.valor.trim();
    if (v) { if (editar.campo === 'nome') setNome(v); else setEmail(v); }
    setEditar(null);
  }

  async function baixarMeusDados() {
    // Portabilidade LGPD: com backend, exporta TUDO (profile+plans+logs+feedback+
    // subscription, via RLS); sem backend, o parcial honesto de sempre (modo mock).
    if (supabaseConfigurado()) {
      try {
        const r = await fetch('/api/lgpd/exportar', { cache: 'no-store' });
        if (r.ok) {
          baixarArquivo('evokorpus-meus-dados.json', JSON.stringify(await r.json(), null, 2));
          return;
        }
      } catch { /* cai no parcial local */ }
    }
    const dados = {
      exportadoEm: new Date().toISOString(),
      aviso: 'Exportação parcial (dados da conta nesta tela). A exportação completa de perfil, plano e histórico depende do backend (LGPD / Ownership-4).',
      conta: { nome, email, assinatura: { plano: 'Evokorpus', valorMensal: 'R$ 29', status: sub } },
    };
    baixarArquivo('evokorpus-meus-dados.json', JSON.stringify(dados, null, 2));
  }

  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  async function excluirConta() {
    setErroExclusao(null);
    // Sem backend (mock): comportamento demo de sempre — limpa o local e sai.
    if (!supabaseConfigurado()) { setDeleteOpen(false); limparSessao(); router.replace('/'); return; }
    setExcluindo(true);
    try {
      const r = await fetch('/api/lgpd/excluir', { method: 'POST' });
      if (r.ok) {
        // Conta excluída no servidor (cascata FK) → encerra sessão e limpa TODO o local.
        await sairDaConta();
        limparDadosLocais();
        router.replace('/');
        return;
      }
      // 503 = service_role ausente neste ambiente — honestidade: NÃO fingir exclusão.
      setErroExclusao(r.status === 503
        ? 'A exclusão está temporariamente indisponível. Tente de novo mais tarde ou fale com o suporte.'
        : 'Não foi possível excluir agora. Tente de novo.');
    } catch {
      setErroExclusao('Não foi possível excluir agora. Tente de novo.');
    } finally {
      setExcluindo(false);
    }
  }

  const status = {
    trial: { t: 'Em teste grátis', c: '#BDFF00', bg: 'rgba(189,255,0,.12)', bd: 'rgba(189,255,0,.3)' },
    active: { t: 'Assinatura ativa', c: '#16A34A', bg: 'rgba(22,163,74,.14)', bd: 'rgba(22,163,74,.4)' },
    cancelled: { t: 'Cancelada', c: '#E5C04D', bg: 'rgba(229,192,77,.12)', bd: 'rgba(229,192,77,.35)' },
  }[sub];
  const subLive = sub === 'trial' || sub === 'active';

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
      <Backdrop />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', animation: `evkScreenIn .5s ${EASE}` }}>
        {/* header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(13,40,24,.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(234,229,219,.1)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <a onClick={() => router.push('/app')} style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, cursor: 'pointer' }}><Logo size={26} /><Marca size="1.1rem" /></a>
            <div style={{ flex: 1 }} />
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setMenu((m) => !m)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', borderRadius: 999, padding: '5px 12px 5px 5px', cursor: 'pointer' }}>
                {/* Inicial REAL do usuário (fix 2026-07-08: era um literal 'L' hardcoded).
                    No mock, `nome` = placeholder → a inicial continua 'L' (demo). */}
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(189,255,0,.16)', color: '#BDFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.92rem' }}>{inicialDe(nome, email)}</span>
                <svg width={14} height={14} viewBox="0 0 24 24" style={{ color: 'rgba(234,229,219,.5)' }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {menu && (
                <div style={{ position: 'absolute', top: 48, right: 0, width: 190, background: '#10241a', border: '1px solid rgba(234,229,219,.14)', borderRadius: 14, padding: 7, boxShadow: '0 24px 50px -20px rgba(0,0,0,.7)', animation: `evkPop .25s ease`, zIndex: 60 }}>
                  <button onClick={() => router.push('/app')} style={menuItem(false)}>Meu perfil</button>
                  <button onClick={() => setMenu(false)} aria-current="page" style={{ ...menuItem(false), background: 'rgba(189,255,0,.08)', color: '#BDFF00', fontWeight: 600 }}>Conta e assinatura</button>
                  <button onClick={() => { void sairDaConta().finally(() => router.replace('/')); }} style={{ ...menuItem(false), color: 'rgba(234,229,219,.75)' }}>Sair</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 880, margin: '0 auto', padding: '36px 22px 80px' }}>
          <div style={{ marginBottom: 26 }}>
            <h1 style={{ margin: '0 0 5px', fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 800, letterSpacing: '-.02em' }}>Conta e assinatura</h1>
            <p style={{ margin: 0, color: 'rgba(234,229,219,.55)', fontSize: '.98rem' }}>Gerencie seu plano, pagamento e dados — tudo num lugar só.</p>
          </div>

          {/* STATUS HERO */}
          <div style={{ background: 'linear-gradient(165deg, rgba(22,163,74,.1), rgba(15,15,14,.5))', border: `1px solid ${status.bd}`, borderRadius: 20, padding: 26, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: status.bg, border: `1px solid ${status.bd}`, color: status.c, borderRadius: 999, padding: '5px 13px', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: status.c }} />{status.t}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>Evokorpus — R$ 29<span style={{ fontSize: '.95rem', fontWeight: 500, color: 'rgba(234,229,219,.55)' }}>/mês</span></div>
                {sub === 'trial' && <div style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.62)' }}>Seu teste grátis termina em <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{TRIAL_END}</strong>.</div>}
                {sub === 'active' && <div style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.62)' }}>Próxima cobrança em <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{PROX_COBRANCA}</strong>.</div>}
                {sub === 'cancelled' && <div style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.62)' }}>Assinatura cancelada. Seu acesso continua até <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{TRIAL_END}</strong> e não há nova cobrança.</div>}
              </div>
            </div>

            {sub === 'trial' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(189,255,0,.07)', border: '1px solid rgba(189,255,0,.22)', borderRadius: 13, padding: '12px 15px', margin: '18px 0' }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><rect x={3} y={5} width={18} height={14} rx={2.5} stroke="#BDFF00" strokeWidth={1.6} /><path d="M4 7l8 5 8-5" stroke="#BDFF00" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.8)', lineHeight: 1.45 }}>Avisamos por e-mail <strong style={{ color: '#BDFF00', fontWeight: 600 }}>antes</strong> da 1ª cobrança. Cobrança prevista: {PROX_COBRANCA}.</span>
              </div>
            )}

            {subLive && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                <button onClick={() => setCardOpen(true)} className="evk-troca" style={{ background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.18)', color: '#EAE5DB', fontWeight: 600, fontSize: '.92rem', padding: '12px 20px', borderRadius: 11, cursor: 'pointer' }}>Gerenciar assinatura</button>
                <button onClick={() => setCancelOpen(true)} style={{ background: 'none', border: '1px solid rgba(229,72,77,.4)', color: '#E5484D', fontWeight: 600, fontSize: '.92rem', padding: '12px 20px', borderRadius: 11, cursor: 'pointer' }}>Cancelar assinatura</button>
              </div>
            )}
            {sub === 'cancelled' && (
              <button onClick={() => setSub('active')} className="hov-btn" style={{ marginTop: 18, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.95rem', padding: '12px 22px', border: 'none', borderRadius: 11, cursor: 'pointer' }}>Reativar assinatura</button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 18, marginBottom: 18 }}>
            {/* LEFT: pagamento + histórico */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={card}>
                <h3 style={cardH}>Forma de pagamento</h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.08)', borderRadius: 13, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                    <span style={{ width: 42, height: 28, borderRadius: 6, background: 'linear-gradient(135deg,#1a3a24,#0f0f0e)', border: '1px solid rgba(234,229,219,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={22} height={14} viewBox="0 0 24 16"><rect x={1} y={1} width={22} height={14} rx={2} fill="none" stroke="rgba(234,229,219,.3)" strokeWidth={1} /><rect x={1} y={4} width={22} height={3} fill="rgba(189,255,0,.5)" /></svg></span>
                    <div><div style={{ fontWeight: 600, fontSize: '.96rem', letterSpacing: '.04em' }}>•••• •••• •••• 4242</div><div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>Expira 08/29</div></div>
                  </div>
                  <button onClick={() => setCardOpen(true)} className="evk-troca" style={{ background: 'none', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.85rem', padding: '9px 16px', borderRadius: 10, cursor: 'pointer' }}>Atualizar cartão</button>
                </div>
              </div>
              <div style={card}>
                <h3 style={cardH}>Histórico de cobrança</h3>
                {sub === 'trial' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(234,229,219,.03)', border: '1px dashed rgba(234,229,219,.14)', borderRadius: 13, padding: 18 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width={17} height={17} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={9} stroke="#BDFF00" strokeWidth={1.7} /><path d="M12 7v5l3 2" stroke="#BDFF00" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    <div><div style={{ fontWeight: 600, fontSize: '.92rem' }}>Nenhuma cobrança ainda</div><div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.55)' }}>Você está no período de teste grátis.</div></div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 0', borderBottom: '1px solid rgba(234,229,219,.07)' }}>
                      <div><div style={{ fontWeight: 600, fontSize: '.92rem' }}>Evokorpus — mensal</div><div style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.5)' }}>{PROX_COBRANCA}</div></div>
                      <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700, fontSize: '.92rem' }}>R$ 29,00</div><div style={{ fontSize: '.76rem', color: '#16A34A' }}>Pago</div></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: dados da conta + privacidade */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={card}>
                <h3 style={cardH}>Dados da conta</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <LinhaDado rotulo="Nome" valor={nome} botao="Alterar" onClick={() => setEditar({ campo: 'nome', valor: nome })} />
                  <LinhaDado rotulo="E-mail" valor={email} botao="Alterar e-mail" onClick={() => setEditar({ campo: 'email', valor: email })} />
                  <LinhaDado rotulo="Senha" valor="••••••••" botao="Alterar senha" onClick={() => router.push('/redefinir')} ultima />
                </div>
              </div>
              <div style={card}>
                <h3 style={{ ...cardH, marginBottom: 6 }}>Privacidade e seus dados</h3>
                <p style={{ margin: '0 0 16px', fontSize: '.86rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>Você controla seus dados. Atendemos às suas solicitações conforme a LGPD.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={baixarMeusDados} className="evk-troca" style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', color: '#EAE5DB', fontWeight: 600, fontSize: '.92rem', padding: '13px 15px', borderRadius: 12, cursor: 'pointer' }}><svg width={17} height={17} viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="#BDFF00" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>Baixar meus dados</button>
                  <button onClick={() => setDeleteOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: 'none', border: '1px solid rgba(229,72,77,.35)', color: '#E5484D', fontWeight: 600, fontSize: '.92rem', padding: '13px 15px', borderRadius: 12, cursor: 'pointer' }}><svg width={17} height={17} viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5h6v2M6 7l1 13h10l1-13" stroke="#E5484D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>Excluir minha conta e meus dados</button>
                </div>
              </div>
              <div style={{ ...card, padding: 8 }}>
                {([['Termos de Uso', '/termos'], ['Política de Privacidade', '/privacidade'], ['Aviso (disclaimer)', '/aviso'], ['Suporte', '/suporte']] as const).map(([l, href]) => (
                  <Link key={l} href={href} className="evk-perfil-link" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 12, fontSize: '.93rem', color: 'rgba(234,229,219,.8)', cursor: 'pointer', textDecoration: 'none' }}>{l} <span style={{ color: 'rgba(234,229,219,.35)' }}>→</span></Link>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: '4px 4px 0' }}>
            <span style={{ display: 'inline-block', marginBottom: 12, border: '1px solid rgba(234,229,219,.25)', color: 'rgba(234,229,219,.6)', borderRadius: 8, padding: '3px 10px', fontSize: '.78rem', fontWeight: 700 }}>18+</span>
            <p style={{ margin: 0, fontSize: '.8rem', color: 'rgba(234,229,219,.42)', lineHeight: 1.6, maxWidth: 760 }}>O Evokorpus é uma ferramenta de uso geral e caráter educacional, dirigida pelo usuário. Não constitui prescrição, consulta ou acompanhamento nutricional ou de educação física, nem substitui a orientação de profissionais habilitados. Conteúdo para maiores de 18 anos.</p>
          </div>
        </div>
      </div>

      {/* MODAL · CANCELAR ASSINATURA */}
      {cancelOpen && (
        <Modal onClose={() => setCancelOpen(false)} maxW={460}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <h2 style={modalH}>Cancelar assinatura</h2>
            <BotaoX onClick={() => setCancelOpen(false)} />
          </div>
          <p style={{ margin: '0 0 20px', fontSize: '.96rem', color: 'rgba(234,229,219,.7)', lineHeight: 1.6 }}>Você pode cancelar agora. Seu acesso continua até <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{TRIAL_END}</strong> e <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>não há nova cobrança</strong>.</p>
          <div style={{ fontSize: '.74rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.45)', marginBottom: 10 }}>Quer contar o motivo? <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(opcional)</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
            {['Está caro para mim', 'Não usei o suficiente', 'Não era o que eu esperava', 'Vou usar outra ferramenta', 'Outro motivo'].map((r) => {
              const on = motivo === r;
              return <button key={r} onClick={() => setMotivo(r)} style={{ textAlign: 'left', padding: '12px 15px', borderRadius: 11, fontWeight: 500, fontSize: '.92rem', cursor: 'pointer', transition: 'all .25s ease', border: `1px solid ${on ? '#BDFF00' : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.1)' : 'rgba(234,229,219,.03)', color: on ? '#BDFF00' : 'rgba(234,229,219,.8)' }}>{r}</button>;
            })}
          </div>
          <button onClick={() => { setSub('cancelled'); setCancelOpen(false); }} style={{ width: '100%', background: 'rgba(229,72,77,.14)', border: '1px solid rgba(229,72,77,.5)', color: '#E5484D', fontWeight: 700, fontSize: '1rem', padding: 14, borderRadius: 13, cursor: 'pointer', marginBottom: 10 }}>Confirmar cancelamento</button>
          <button onClick={() => setCancelOpen(false)} className="hov-btn" style={{ width: '100%', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 13, cursor: 'pointer' }}>Manter assinatura</button>
        </Modal>
      )}

      {/* MODAL · ATUALIZAR CARTÃO */}
      {cardOpen && (
        <Modal onClose={() => setCardOpen(false)} maxW={440}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <h2 style={modalH}>Atualizar cartão</h2>
            <BotaoX onClick={() => setCardOpen(false)} />
          </div>
          <p style={{ margin: '0 0 20px', fontSize: '.88rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>Seus dados são protegidos. Trocar o cartão não altera sua data de cobrança.</p>
          <label style={labelCap}>Número do cartão</label>
          <input inputMode="numeric" placeholder="0000 0000 0000 0000" style={{ ...inp, marginBottom: 14 }} />
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <div style={{ flex: 1 }}><label style={labelCap}>Validade</label><input inputMode="numeric" placeholder="MM/AA" style={inp} /></div>
            <div style={{ flex: 1 }}><label style={labelCap}>CVV</label><input inputMode="numeric" placeholder="123" style={inp} /></div>
          </div>
          <label style={labelCap}>Nome no cartão</label>
          <input placeholder="Como impresso no cartão" style={{ ...inp, marginBottom: 22 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setCardOpen(false)} className="evk-voltar" style={{ flex: 1, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.82)', fontWeight: 600, fontSize: '.96rem', padding: 13, borderRadius: 12, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={() => setCardOpen(false)} className="hov-btn" style={{ flex: 1, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.96rem', padding: 13, border: 'none', borderRadius: 12, cursor: 'pointer' }}>Salvar cartão</button>
          </div>
        </Modal>
      )}

      {/* MODAL · EXCLUIR CONTA */}
      {deleteOpen && (
        <Modal onClose={() => setDeleteOpen(false)} maxW={440} perigo>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(229,72,77,.14)', border: '1px solid rgba(229,72,77,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><svg width={24} height={24} viewBox="0 0 24 24" fill="none"><path d="M12 8.5v4M12 16h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="#E5484D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <h2 style={{ ...modalH, marginBottom: 10 }}>Excluir minha conta</h2>
          <p style={{ margin: '0 0 16px', fontSize: '.94rem', color: 'rgba(234,229,219,.7)', lineHeight: 1.6 }}>Isso apaga <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>permanentemente</strong> sua conta, seu plano e todo o seu histórico. Esta ação não pode ser desfeita.</p>
          <p style={{ margin: '0 0 22px', fontSize: '.86rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.55 }}>Se quiser, você pode <strong style={{ color: 'rgba(234,229,219,.7)', fontWeight: 600 }}>baixar seus dados</strong> antes. Cancelar a assinatura não exige excluir a conta.</p>
          {erroExclusao && <p style={{ margin: '0 0 14px', fontSize: '.88rem', color: '#E5C04D', lineHeight: 1.5 }}>{erroExclusao}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={excluirConta} disabled={excluindo} style={{ width: '100%', background: '#E5484D', color: '#0D0D0C', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 13, cursor: excluindo ? 'wait' : 'pointer', opacity: excluindo ? 0.6 : 1 }}>{excluindo ? 'Excluindo…' : 'Excluir definitivamente'}</button>
            <button onClick={() => setDeleteOpen(false)} className="evk-voltar" style={{ width: '100%', background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '1rem', padding: 14, borderRadius: 13, cursor: 'pointer' }}>Manter minha conta</button>
          </div>
        </Modal>
      )}

      {/* MODAL · ALTERAR NOME / E-MAIL */}
      {editar && (
        <Modal onClose={() => setEditar(null)} maxW={420}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <h2 style={modalH}>{editar.campo === 'nome' ? 'Alterar nome' : 'Alterar e-mail'}</h2>
            <BotaoX onClick={() => setEditar(null)} />
          </div>
          <p style={{ margin: '0 0 20px', fontSize: '.88rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>{editar.campo === 'nome' ? 'Como devemos te chamar.' : 'Usamos seu e-mail para login e avisos importantes.'}</p>
          <label style={labelCap}>{editar.campo === 'nome' ? 'Nome' : 'E-mail'}</label>
          <input
            type={editar.campo === 'email' ? 'email' : 'text'}
            value={editar.valor}
            onChange={(e) => setEditar({ campo: editar.campo, valor: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') salvarEdicao(); }}
            autoFocus
            style={{ ...inp, marginBottom: 22 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditar(null)} className="evk-voltar" style={{ flex: 1, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.82)', fontWeight: 600, fontSize: '.96rem', padding: 13, borderRadius: 12, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={salvarEdicao} className="hov-btn" style={{ flex: 1, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.96rem', padding: 13, border: 'none', borderRadius: 12, cursor: 'pointer' }}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const card: CSSProperties = { background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: 24 };
const cardH: CSSProperties = { margin: '0 0 16px', fontSize: '1.12rem', fontWeight: 700 };
const modalH: CSSProperties = { margin: 0, fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-.01em' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '13px 15px', color: '#EAE5DB', fontSize: '1rem', outline: 'none', transition: 'border-color .25s ease, background .25s ease' };
const labelCap: CSSProperties = { display: 'block', fontSize: '.74rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 7 };
const menuItem = (active: boolean): CSSProperties => ({ width: '100%', textAlign: 'left', background: 'none', border: 'none', color: active ? '#BDFF00' : '#EAE5DB', fontSize: '.94rem', fontWeight: 500, padding: '11px 13px', borderRadius: 9, cursor: 'pointer' });

function LinhaDado({ rotulo, valor, botao, onClick, ultima }: { rotulo: string; valor: string; botao: string; onClick?: () => void; ultima?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: ultima ? 'none' : '1px solid rgba(234,229,219,.07)' }}>
      <div><div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.5)', marginBottom: 2 }}>{rotulo}</div><div style={{ fontWeight: 600, fontSize: '.94rem', letterSpacing: rotulo === 'Senha' ? '.1em' : undefined }}>{valor}</div></div>
      <button onClick={onClick} className="evk-troca" style={{ background: 'none', border: '1px solid rgba(234,229,219,.16)', color: 'rgba(234,229,219,.78)', fontWeight: 600, fontSize: '.8rem', padding: '7px 13px', borderRadius: 9, cursor: 'pointer' }}>{botao}</button>
    </div>
  );
}

function Modal({ children, onClose, maxW, perigo }: { children: React.ReactNode; onClose: () => void; maxW: number; perigo?: boolean }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 212, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: maxW, maxHeight: '88vh', overflowY: 'auto', background: perigo ? 'linear-gradient(168deg, rgba(42,16,16,.96), rgba(15,15,14,.98))' : 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: `1px solid ${perigo ? 'rgba(229,72,77,.35)' : 'rgba(234,229,219,.14)'}`, borderRadius: 22, padding: 26, boxShadow: '0 40px 90px -30px rgba(0,0,0,.8)', animation: `evkPop .3s ${EASE}` }}>
        {children}
      </div>
    </div>
  );
}

function BotaoX({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', padding: 0, marginTop: -2 }}>×</button>;
}

function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}

const Marca = ({ size }: { size: string }) => <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.02em' }}><span style={{ color: '#EAE5DB' }}>evo</span><span style={{ color: '#BDFF00' }}>korpus</span></span>;
