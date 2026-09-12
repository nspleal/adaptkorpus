'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Backdrop, LogoFloat, Marca, cardAuth, inputAuth, labelAuth, EASE, forcaSenha, LinhaConsentimento, LinkLegal, RequisitosSenha, apenasLeitorDeTela } from '@/components/auth/ui';
import { fraseDosFaltantes, listarEmPortugues, requisitosFaltantes, senhaCumprePolitica } from '@/lib/auth/politica-senha';
import { traduzirErroCadastro } from '@/lib/auth/erro-auth';
import { supabaseConfigurado } from '@/lib/supabase/env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const kicker: CSSProperties = { fontSize: '.72rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00' };

const ID_REQUISITOS = 'cadastro-requisitos-senha';
const ID_PENDENCIAS = 'cadastro-pendencias';

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [t, setT] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [erro, setErro] = useState<string | null>(null);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const refNome = useRef<HTMLInputElement>(null);
  const refEmail = useRef<HTMLInputElement>(null);
  const refSenha = useRef<HTMLInputElement>(null);
  const refPendencias = useRef<HTMLParagraphElement>(null);

  const f = forcaSenha(senha);
  const senhaOk = senhaCumprePolitica(senha);
  const faltamNaSenha = requisitosFaltantes(senha);

  /**
   * 🔴 O GATE PASSOU A SER A POLÍTICA, NÃO O TAMANHO (defeito do beta, 11/09/2026).
   *
   * Era `senha.length >= 8`. O servidor exige também minúscula, maiúscula e número — e
   * devolvia 422 para uma senha que esta tela já tinha aprovado e ainda rotulava "Razoável".
   */
  const valido = nome.trim().length > 1 && EMAIL_RE.test(email) && senhaOk && t.every(Boolean);
  const tog = (i: number) => { const n = [...t] as [boolean, boolean, boolean]; n[i] = !n[i]; setT(n); };

  /**
   * O QUE FALTA, EM PORTUGUÊS — derivado dos MESMOS predicados que liberam o botão, nunca de
   * uma segunda lista redigitada (que é como as duas versões saem de sincronia em silêncio).
   */
  const naoAceitos = t.filter((x) => !x).length;
  const pendencias: { campo: 'nome' | 'email' | 'senha' | 'aceites'; texto: string }[] = [];
  if (nome.trim().length <= 1) pendencias.push({ campo: 'nome', texto: 'informe seu nome' });
  if (!EMAIL_RE.test(email)) pendencias.push({ campo: 'email', texto: 'informe um e-mail válido' });
  if (senha.length === 0) pendencias.push({ campo: 'senha', texto: 'crie uma senha' });
  else if (faltamNaSenha.length > 0) pendencias.push({ campo: 'senha', texto: `complete a senha com ${fraseDosFaltantes(faltamNaSenha)}` });
  if (naoAceitos > 0) pendencias.push({ campo: 'aceites', texto: naoAceitos === 1 ? 'marque o aceite que falta' : 'marque os três aceites' });

  // Só cobra depois que a pessoa começou: formulário em branco não grita com quem chegou agora.
  const interagiu = nome !== '' || email !== '' || senha !== '' || t.some(Boolean);
  const mostrarPendencias = pendencias.length > 0 && (tentouEnviar || interagiu);

  async function submit() {
    /**
     * 🔒 O BOTÃO INATIVO EXPLICA em vez de só não responder. Antes ele era `pointerEvents:
     * 'none'`: o clique morria no vazio, nada aparecia na tela, e a pessoa ficava tentando.
     */
    if (!valido) {
      setTentouEnviar(true);
      const alvo = pendencias[0]?.campo;
      const foco = alvo === 'nome' ? refNome.current
        : alvo === 'email' ? refEmail.current
        : alvo === 'senha' ? refSenha.current
        : refPendencias.current;
      foco?.focus();
      return;
    }
    setErro(null);
    try { sessionStorage.setItem('evk_email', email); } catch { /* storage indisponível */ }
    // Sem backend (modo mock): segue direto ao passo de confirmação (comportamento atual).
    if (!supabaseConfigurado()) { router.push('/confirmar'); return; }
    setCarregando(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { data, error } = await createClient().auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { nome: nome.trim() } },
      });
      if (error) {
        /**
         * 🔒 O BACKEND CONTINUA SENDO A AUTORIDADE. A validação local existe para EXPLICAR
         * antes do envio, não para garantir que a recusa não virá: `pwned` (senha vazada) e
         * qualquer aperto futuro da política só o servidor conhece. Por isso a recusa é
         * traduzida por CÓDIGO (`error.code` / `error.reasons`), não por regex na mensagem — e
         * nada do texto cru do servidor chega à tela, ao console ou à telemetria.
         *
         * 🔴 Nome, e-mail e senha ficam onde estavam: obrigar a redigitar tudo depois de uma
         * recusa é a segunda punição pelo mesmo erro.
         */
        const recusa = traduzirErroCadastro(error, senha);
        setErro(recusa.texto);
        setCarregando(false);
        if (recusa.campo === 'senha') refSenha.current?.focus();
        else if (recusa.campo === 'email') refEmail.current?.focus();
        return;
      }
      // Confirmação de e-mail DESLIGADA no Supabase → o signUp já devolve sessão: vai
      // direto ao onboarding (a tela de "confirme seu e-mail" não faz sentido). Com
      // confirmação LIGADA (sem sessão), segue ao /confirmar como antes.
      router.replace(data.session ? '/onboarding' : '/confirmar');
    } catch (e) {
      setErro(traduzirErroCadastro(e, senha).texto);
      setCarregando(false);
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
      <Backdrop />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '44px 24px 64px', animation: `evkScreenIn .55s ${EASE}` }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 26 }}>
            <div style={{ marginBottom: 13 }}><LogoFloat size={44} /></div><Marca size="1.35rem" />
          </div>
          <div style={{ ...cardAuth, padding: '34px 32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(189,255,0,.12)', border: '1px solid rgba(189,255,0,.3)', color: '#BDFF00', borderRadius: 999, padding: '4px 12px', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 16 }}>Beta fechado</div>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-.02em' }}>Crie sua conta</h1>
            <p style={{ margin: '0 0 26px', color: 'rgba(234,229,219,.62)', fontSize: '.96rem', lineHeight: 1.55 }}>Entre no beta do Adaptkorpus. É <strong style={{ color: '#EAE5DB', fontWeight: 700 }}>grátis durante os testes</strong> — sem cartão.</p>

            <div style={{ ...kicker, marginBottom: 15 }}>Sua conta</div>
            <Campo label="Nome"><input ref={refNome} autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" style={inputAuth} /></Campo>
            <Campo label="E-mail"><input ref={refEmail} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" style={inputAuth} /></Campo>
            <Campo label="Senha" mb={8}>
              <div style={{ position: 'relative' }}>
                <input ref={refSenha} type={showPw ? 'text' : 'password'} autoComplete="new-password" aria-describedby={ID_REQUISITOS} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Crie uma senha" style={{ ...inputAuth, padding: '13px 46px 13px 15px' }} />
                <button onClick={() => setShowPw((s) => !s)} type="button" aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPw} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'rgba(234,229,219,.5)', display: 'flex' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth={1.8} /><circle cx={12} cy={12} r={3} stroke="currentColor" strokeWidth={1.8} /></svg></button>
              </div>
            </Campo>

            {/* 🔴 A POLÍTICA APARECE ANTES DO ERRO. O placeholder dizia só "Mínimo 8 caracteres";
                o servidor exige também minúscula, maiúscula e número — e a pessoa descobria isso
                por uma recusa genérica, depois de já ter mandado. */}
            <RequisitosSenha senha={senha} id={ID_REQUISITOS} />

            {/* 🔒 A ESTIMATIVA DE FORÇA SÓ APARECE DEPOIS QUE OS REQUISITOS ESTÃO CUMPRIDOS.
                Exibi-la antes foi o defeito: "Razoável" sugeria aceitação para uma senha que o
                servidor recusava. Cumprir requisito e ser uma senha boa são duas perguntas — a
                tela agora responde uma de cada vez, e nunca a segunda antes da primeira. */}
            {senhaOk && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '14px 0 4px' }}>
                <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.45)' }}>Força estimada</span>
                <div style={{ flex: 1, height: 5, background: 'rgba(234,229,219,.1)', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: f.pct, background: f.cor, borderRadius: 99, transition: 'width .3s ease, background .3s ease' }} /></div>
                <span style={{ fontSize: '.78rem', fontWeight: 700, color: f.cor, minWidth: 48, textAlign: 'right' }}>{f.rotulo}</span>
              </div>
            )}

            <div style={{ height: 1, background: 'rgba(234,229,219,.08)', margin: '22px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 22 }}>
              {/* Os nomes dos documentos são LINKS (LinkLegal: abre em nova aba e não marca
                  o checkbox) — o texto tem que ser legível ANTES do aceite (LGPD/CDC; cofre
                  operacao-legal-suporte-reembolso + plano-pos-feedback-beta §Leva 1). */}
              {[
                <>Confirmo que tenho <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>18 anos ou mais</strong>.</>,
                <>Li e aceito os <LinkLegal href="/termos">Termos de Uso</LinkLegal> e o <LinkLegal href="/aviso">Aviso (disclaimer)</LinkLegal>.</>,
                <>Autorizo o tratamento dos meus dados conforme a <LinkLegal href="/privacidade">Política de Privacidade</LinkLegal> (LGPD).</>,
              ].map((txt, i) => (
                <LinhaConsentimento key={i} on={t[i]!} onToggle={() => tog(i)}>{txt}</LinhaConsentimento>
              ))}
            </div>

            {erro && <p role="alert" style={{ margin: '0 0 16px', fontSize: '.86rem', color: '#E5484D', lineHeight: 1.5 }}>{erro}</p>}

            {/* 🔒 O MOTIVO DE O BOTÃO NÃO ESTAR DISPONÍVEL FICA VISÍVEL. Botão apagado sem
                explicação é beco sem saída: a pessoa não descobre sozinha o que falta. */}
            {mostrarPendencias && (
              <p ref={refPendencias} id={ID_PENDENCIAS} tabIndex={-1} style={{ margin: '0 0 12px', fontSize: '.84rem', color: 'rgba(234,229,219,.72)', lineHeight: 1.5 }}>
                <span style={apenasLeitorDeTela}>Para criar a conta ainda falta: </span>
                <span aria-hidden style={{ fontWeight: 700, color: 'rgba(234,229,219,.55)' }}>Para continuar: </span>
                {listarEmPortugues(pendencias.map((p) => p.texto))}.
              </p>
            )}

            <button onClick={submit} type="button" disabled={carregando} aria-disabled={!valido || carregando} aria-describedby={mostrarPendencias ? ID_PENDENCIAS : undefined} className={valido && !carregando ? 'hov-btn' : ''} style={{ width: '100%', border: 'none', cursor: carregando ? 'wait' : 'pointer', fontWeight: 700, fontSize: '1.05rem', padding: 15, borderRadius: 13, transition: `transform .25s ${EASE}, box-shadow .3s ease`, ...(valido && !carregando ? { background: '#BDFF00', color: '#0D2818' } : { background: 'rgba(234,229,219,.1)', color: 'rgba(234,229,219,.4)' }) }}>{carregando ? 'Criando…' : 'Criar conta'}</button>
            <p style={{ textAlign: 'center', margin: '18px 0 0', fontSize: '.88rem', color: 'rgba(234,229,219,.55)' }}>Já tem conta? <Link href="/login" style={{ color: '#BDFF00', textDecoration: 'underline', fontWeight: 600 }}>Entrar</Link></p>
          </div>
          <p style={{ textAlign: 'center', margin: '18px 0 0', fontSize: '.8rem', color: 'rgba(234,229,219,.4)', lineHeight: 1.5 }}>O acesso ao beta é por convite. Conteúdo para maiores de 18 anos.</p>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children, mb = 16 }: { label: string; children: React.ReactNode; mb?: number }) {
  return <div style={{ marginBottom: mb }}><label style={labelAuth}>{label}</label>{children}</div>;
}
