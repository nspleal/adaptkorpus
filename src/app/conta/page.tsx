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
 * Conta e meus dados: dados da conta (nome, e-mail, senha) e os direitos LGPD —
 * portabilidade (baixar) e eliminação (excluir). **Só o que tem backend de verdade.**
 *
 * A seção de assinatura saiu inteira (ver o bloco 🔒 abaixo): não há cobrança no beta, e
 * o que existia era estado de `useState` fingindo status, cartão e fatura.
 *
 * Mantém os princípios do cofre: 18+, sem promessa de resultado, direitos LGPD atendidos.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

/**
 * 🔒 SEM SUCESSO SIMULADO (DF 2026-07-29). Esta tela tinha um estado de assinatura em
 * `useState` — "Confirmar cancelamento" fazia `setSub('cancelled')` e nada mais. O usuário
 * via "Cancelada", acreditava ter cancelado, e um F5 devolvia "trial". Havia também um
 * cartão de crédito fabricado (•••• 4242), uma fatura "R$ 29,00 · Pago" e datas de cobrança
 * **no passado** ("7 de julho de 2026").
 *
 * Nada disso existe no backend: `subscription` tem 0 linhas e nunca era lida. Como o beta é
 * gratuito e a decisão *cortesia × pago* está aberta, a tela passa a dizer só a verdade —
 * sem preço, sem data, sem controle que finge agir.
 *
 * ⚠️ Enquanto não houver cobrança real, NÃO reintroduza botão de estado aqui: o guard de
 * `honestidade-tela.test.ts` falha se um controle confirmar sucesso sem uma chamada que
 * possa falhar.
 */

export default function ContaPage() {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
  /**
   * 🔒 Só `'nome'`. O tipo tinha `'email'` e o modal tinha as duas metades da copy, mas
   * `salvarEdicao` só grava `nome` — se algum caminho abrisse o modal em `'email'`, a tela
   * diria "Alterar e-mail", aceitaria o novo valor e gravaria o e-mail digitado no campo
   * NOME. Fechado pelo tipo, não por disciplina. (Por que o e-mail não se edita: ver o
   * comentário na linha do e-mail.)
   */
  const [editar, setEditar] = useState<null | { campo: 'nome'; valor: string }>(null);

  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroNome, setErroNome] = useState<string | null>(null);
  /**
   * 🔒 Salva DE VERDADE (DF 2026-07-29). Antes só fazia `setNome(v)` — estado local: a tela
   * mostrava o nome novo e um F5 devolvia o antigo. Mesmo sucesso simulado dos botões de
   * assinatura. Agora é `updateUser({ data: { nome } })`, uma chamada que pode falhar, e o
   * estado só muda quando ela volta ok. (O `nome` vive em `user_metadata`, gravado no signUp
   * e lido por `inicialDe` — não há coluna própria a migrar.)
   *
   * ⚠️ Só o NOME. O e-mail não passa por aqui — ver o comentário na linha do e-mail.
   */
  async function salvarEdicao() {
    if (!editar) return;
    const v = editar.valor.trim();
    if (!v) { setEditar(null); return; }
    if (!supabaseConfigurado()) { setNome(v); setEditar(null); return; } // demo local
    setErroNome(null);
    setSalvandoNome(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { error } = await createClient().auth.updateUser({ data: { nome: v } });
      if (error) { setErroNome('Não foi possível salvar o nome. Tente de novo.'); return; }
      setNome(v);
      setEditar(null);
    } catch {
      setErroNome('Não foi possível salvar o nome agora. Tente de novo.');
    } finally {
      setSalvandoNome(false);
    }
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
      conta: { nome, email, assinatura: { status: 'beta_gratuito' } },
    };
    baixarArquivo('evokorpus-meus-dados.json', JSON.stringify(dados, null, 2));
  }

  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  // 🔒 Re-autenticação (auditoria 2026-07-29): exclusão é irreversível e cascateia; o
  // servidor exige a senha. Sessão aberta em navegador compartilhado não basta.
  const [senhaExclusao, setSenhaExclusao] = useState('');
  async function excluirConta() {
    setErroExclusao(null);
    // Sem backend (mock): comportamento demo de sempre — limpa o local e sai.
    if (!supabaseConfigurado()) { setDeleteOpen(false); limparSessao(); router.replace('/'); return; }
    setExcluindo(true);
    try {
      const r = await fetch('/api/lgpd/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha: senhaExclusao }),
      });
      if (r.ok) {
        // Conta excluída no servidor (cascata FK) → encerra sessão e limpa TODO o local.
        await sairDaConta();
        limparDadosLocais();
        router.replace('/');
        return;
      }
      // 503 = service_role ausente neste ambiente — honestidade: NÃO fingir exclusão.
      setErroExclusao(
        r.status === 401 ? 'Senha incorreta. Tente de novo.'
        : r.status === 400 ? 'Digite sua senha para confirmar.'
        : r.status === 429 ? 'Muitas tentativas. Espere um pouco e tente de novo.'
        : r.status === 503 ? 'A exclusão está temporariamente indisponível. Tente de novo mais tarde ou fale com o suporte.'
        : 'Não foi possível excluir agora. Tente de novo.');
    } catch {
      setErroExclusao('Não foi possível excluir agora. Tente de novo.');
    } finally {
      setExcluindo(false);
    }
  }

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
                  <button onClick={() => setMenu(false)} aria-current="page" style={{ ...menuItem(false), background: 'rgba(189,255,0,.08)', color: '#BDFF00', fontWeight: 600 }}>Conta e meus dados</button>
                  <button onClick={() => { void sairDaConta().finally(() => router.replace('/')); }} style={{ ...menuItem(false), color: 'rgba(234,229,219,.75)' }}>Sair</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 880, margin: '0 auto', padding: '36px 22px 80px' }}>
          <div style={{ marginBottom: 26 }}>
            <h1 style={{ margin: '0 0 5px', fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 800, letterSpacing: '-.02em' }}>Conta e meus dados</h1>
            <p style={{ margin: 0, color: 'rgba(234,229,219,.55)', fontSize: '.98rem' }}>Seus dados e seus direitos — tudo num lugar só.</p>
          </div>

          {/* 🔒 A VERDADE, sem prometer mecânica nova (copy do autor, DF 2026-07-29). */}
          <div style={{ background: 'linear-gradient(165deg, rgba(22,163,74,.1), rgba(15,15,14,.5))', border: '1px solid rgba(189,255,0,.28)', borderRadius: 20, padding: 26, marginBottom: 18 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(189,255,0,.12)', border: '1px solid rgba(189,255,0,.3)', color: '#BDFF00', borderRadius: 999, padding: '5px 13px', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#BDFF00' }} />Beta gratuito
            </div>
            {/* Só a pílula diz "Beta gratuito". O slot da linha grande era o PREÇO ("R$
                29/mês"); repetir a pílula ali dizia a mesma palavra duas vezes empilhadas.
                Sem preço para exibir, o slot sai — o lugar dele não vira eco. */}
            <p style={{ margin: 0, fontSize: '.98rem', color: 'rgba(234,229,219,.7)', lineHeight: 1.6, maxWidth: 520 }}>
              Não existe assinatura ativa nem cobrança. Quando houver plano pago, você decide se entra.
            </p>
          </div>

          {/* 🔒 Saíram "Forma de pagamento" (cartão •••• 4242 FABRICADO) e "Histórico de
              cobrança" (fatura "R$ 29,00 · Pago" FABRICADA). Não havia cartão, não houve
              cobrança. Voltam quando existir provedor de pagamento de verdade. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 18, marginBottom: 18 }}>
            {/* RIGHT: dados da conta + privacidade */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={card}>
                <h3 style={cardH}>Dados da conta</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <LinhaDado rotulo="Nome" valor={nome} botao="Alterar" onClick={() => setEditar({ campo: 'nome', valor: nome })} />
                  {/* 🔒 O E-MAIL NÃO É EDITÁVEL AQUI, e não é limitação de UI: a allowlist do
                      beta casa por e-mail (`beta_liberado()` → `lower(a.email) =
                      lower(auth.email())`, migration 0006). Trocar o e-mail derrubaria o
                      usuário da allowlist EM SILÊNCIO — ele perderia o acervo curado e o app
                      pararia de gerar plano, sem nenhuma mensagem. Enquanto o gate for por
                      e-mail, a troca é operação de suporte, não de autoatendimento. */}
                  <LinhaDado rotulo="E-mail" valor={email} />
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
      {/* 🔒 Saíram os modais "Cancelar assinatura" e "Atualizar cartão": os dois
          confirmavam sucesso sem NENHUMA chamada — `setSub('cancelled')` e um form de
          cartão que não enviava nada. Ver o guard em `honestidade-tela.test.ts`. */}
      {deleteOpen && (
        <Modal onClose={() => setDeleteOpen(false)} maxW={440} perigo>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(229,72,77,.14)', border: '1px solid rgba(229,72,77,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><svg width={24} height={24} viewBox="0 0 24 24" fill="none"><path d="M12 8.5v4M12 16h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="#E5484D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <h2 style={{ ...modalH, marginBottom: 10 }}>Excluir minha conta</h2>
          <p style={{ margin: '0 0 16px', fontSize: '.94rem', color: 'rgba(234,229,219,.7)', lineHeight: 1.6 }}>Isso apaga <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>permanentemente</strong> sua conta, seu plano e todo o seu histórico. Esta ação não pode ser desfeita.</p>
          {/* 🔒 Saiu "Cancelar a assinatura não exige excluir a conta.": não existe
              assinatura para cancelar, e a frase apontava para um controle que não existe. */}
          <p style={{ margin: '0 0 22px', fontSize: '.86rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.55 }}>Se quiser, você pode <strong style={{ color: 'rgba(234,229,219,.7)', fontWeight: 600 }}>baixar seus dados</strong> antes.</p>
          {erroExclusao && <p style={{ margin: '0 0 14px', fontSize: '.88rem', color: '#E5C04D', lineHeight: 1.5 }}>{erroExclusao}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {supabaseConfigurado() && (
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="evk-senha-exclusao" style={{ display: 'block', fontSize: '.86rem', fontWeight: 600, color: 'rgba(234,229,219,.72)', marginBottom: 8 }}>Confirme sua senha</label>
                <input
                  id="evk-senha-exclusao"
                  type="password"
                  autoComplete="current-password"
                  value={senhaExclusao}
                  onChange={(e) => setSenhaExclusao(e.target.value)}
                  className="input-foco"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.16)', borderRadius: 12, padding: '13px 14px', color: '#EAE5DB', fontSize: '1rem', outline: 'none' }}
                />
              </div>
            )}
            <button onClick={excluirConta} disabled={excluindo || (supabaseConfigurado() && senhaExclusao.length === 0)} style={{ width: '100%', background: '#E5484D', color: '#0D0D0C', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 13, cursor: excluindo ? 'wait' : 'pointer', opacity: excluindo || (supabaseConfigurado() && senhaExclusao.length === 0) ? 0.6 : 1 }}>{excluindo ? 'Excluindo…' : 'Excluir definitivamente'}</button>
            <button onClick={() => setDeleteOpen(false)} className="evk-voltar" style={{ width: '100%', background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '1rem', padding: 14, borderRadius: 13, cursor: 'pointer' }}>Manter minha conta</button>
          </div>
        </Modal>
      )}

      {/* MODAL · ALTERAR NOME / E-MAIL */}
      {editar && (
        <Modal onClose={() => setEditar(null)} maxW={420}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <h2 style={modalH}>Alterar nome</h2>
            <BotaoX onClick={() => setEditar(null)} />
          </div>
          <p style={{ margin: '0 0 20px', fontSize: '.88rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>Como devemos te chamar.</p>
          <label style={labelCap}>Nome</label>
          <input
            type="text"
            value={editar.valor}
            onChange={(e) => setEditar({ campo: editar.campo, valor: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') void salvarEdicao(); }}
            autoFocus
            style={{ ...inp, marginBottom: 22 }}
          />
          {/* O erro fica ACIMA da linha de botões: dentro do `display:flex` ele virava uma
              terceira coluna e empurrava "Salvar" para fora — quem falhava não conseguia
              tentar de novo. */}
          {erroNome && <p style={{ margin: '0 0 12px', fontSize: '.86rem', color: '#E5484D' }}>{erroNome}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditar(null)} className="evk-voltar" style={{ flex: 1, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.82)', fontWeight: 600, fontSize: '.96rem', padding: 13, borderRadius: 12, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={() => void salvarEdicao()} disabled={salvandoNome} className="hov-btn" style={{ flex: 1, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.96rem', padding: 13, border: 'none', borderRadius: 12, cursor: salvandoNome ? 'wait' : 'pointer', opacity: salvandoNome ? 0.6 : 1 }}>{salvandoNome ? 'Salvando…' : 'Salvar'}</button>
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

function LinhaDado({ rotulo, valor, botao, onClick, ultima }: { rotulo: string; valor: string; botao?: string; onClick?: () => void; ultima?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: ultima ? 'none' : '1px solid rgba(234,229,219,.07)' }}>
      <div><div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.5)', marginBottom: 2 }}>{rotulo}</div><div style={{ fontWeight: 600, fontSize: '.94rem', letterSpacing: rotulo === 'Senha' ? '.1em' : undefined }}>{valor}</div></div>
      {/* Sem `botao` a linha é só leitura — nada de <button> vazio e clicável. */}
      {botao && <button onClick={onClick} className="evk-troca" style={{ background: 'none', border: '1px solid rgba(234,229,219,.16)', color: 'rgba(234,229,219,.78)', fontWeight: 600, fontSize: '.8rem', padding: '7px 13px', borderRadius: 9, cursor: 'pointer' }}>{botao}</button>}
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
