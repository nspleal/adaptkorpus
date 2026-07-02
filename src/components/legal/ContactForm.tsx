'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { AValidar } from './ui';

/**
 * Formulário de contato (porte fiel do V3) — agora com ENVIO REAL via POST /api/suporte
 * (melhoria adotada no cofre: "formulário mudo é anti-marca"). O envio é env-gated no
 * servidor: sem provedor configurado a rota devolve `nao_configurado` e mantemos o aviso
 * honesto de demonstração (nunca fingimos envio).
 *
 * A11y: cada campo tem label associado (htmlFor/id) e indicador de foco visível
 * (.input-foco:focus → borda neon + anel), equivalente ao style-focus do protótipo.
 * O campo `site` é honeypot anti-bot: invisível/fora do tab; humano nunca preenche.
 */
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '13px 15px', color: '#EAE5DB', fontSize: '1rem', outline: 'none', transition: 'border-color .25s ease, background .25s ease, box-shadow .25s ease' };
const label: CSSProperties = { display: 'block', fontSize: '.74rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 8 };

type Estado = 'idle' | 'enviando' | 'ok' | 'nao_configurado' | 'erro';

export default function ContactForm() {
  const [estado, setEstado] = useState<Estado>('idle');

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (estado === 'enviando') return;
    const fd = new FormData(e.currentTarget);
    setEstado('enviando');
    try {
      const r = await fetch('/api/suporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: String(fd.get('nome') ?? ''),
          email: String(fd.get('email') ?? ''),
          assunto: String(fd.get('assunto') ?? 'outro'),
          mensagem: String(fd.get('mensagem') ?? ''),
          site: String(fd.get('site') ?? ''),
        }),
      });
      if (r.ok) {
        const dados = (await r.json()) as { ok?: boolean; status?: string };
        setEstado(dados.ok ? 'ok' : dados.status === 'nao_configurado' ? 'nao_configurado' : 'erro');
      } else setEstado('erro');
    } catch {
      setEstado('erro');
    }
  }

  return (
    <form onSubmit={enviar} style={{ background: 'rgba(234,229,219,.035)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        <div>
          <label htmlFor="contato-nome" style={label}>Nome</label>
          <input id="contato-nome" name="nome" type="text" required maxLength={120} placeholder="Seu nome" className="input-foco" style={inp} />
        </div>
        <div>
          <label htmlFor="contato-email" style={label}>E-mail</label>
          <input id="contato-email" name="email" type="email" required maxLength={254} placeholder="voce@email.com" className="input-foco" style={inp} />
        </div>
      </div>
      <div>
        <label htmlFor="contato-assunto" style={label}>Assunto</label>
        <select id="contato-assunto" name="assunto" className="input-foco" style={inp}>
          <option value="duvida" style={{ background: '#0F0F0E' }}>Dúvida sobre o app</option>
          <option value="cobranca" style={{ background: '#0F0F0E' }}>Cobrança e assinatura</option>
          <option value="privacidade" style={{ background: '#0F0F0E' }}>Privacidade / LGPD</option>
          <option value="outro" style={{ background: '#0F0F0E' }}>Outro</option>
        </select>
      </div>
      <div>
        <label htmlFor="contato-msg" style={label}>Mensagem</label>
        <textarea id="contato-msg" name="mensagem" rows={4} required minLength={10} maxLength={4000} placeholder="Como podemos ajudar?" className="input-foco" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      {/* honeypot anti-bot — invisível, fora do tab, nunca preenchido por humanos */}
      <input name="site" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <button type="submit" disabled={estado === 'enviando'} className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: '14px 26px', border: 'none', borderRadius: 13, cursor: estado === 'enviando' ? 'wait' : 'pointer', opacity: estado === 'enviando' ? 0.7 : 1 }}>
          {estado === 'enviando' ? 'Enviando…' : 'Enviar mensagem'}
        </button>
        {estado === 'ok' && (
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.86rem', color: 'rgba(234,229,219,.7)' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={9} stroke="#BDFF00" strokeWidth={2} /><path d="M8 12l2.5 2.5L16 9" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Mensagem enviada — respondemos pelo seu e-mail.
          </span>
        )}
        {estado === 'nao_configurado' && (
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.86rem', color: 'rgba(234,229,219,.6)' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={9} stroke="#BDFF00" strokeWidth={2} /><path d="M8 12l2.5 2.5L16 9" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Formulário de demonstração — sem envio real. <AValidar>integração de envio</AValidar>
          </span>
        )}
        {estado === 'erro' && (
          <span role="status" style={{ fontSize: '.86rem', color: '#E5484D' }}>
            Não foi possível enviar agora. Tente de novo em instantes.
          </span>
        )}
      </div>
    </form>
  );
}
