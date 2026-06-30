'use client';

import { useState, type CSSProperties } from 'react';
import { AValidar } from './ui';

/**
 * Formulário de contato (porte fiel do V3) — APENAS UI, sem envio real. Ao enviar mostra a
 * nota de demonstração. A integração de envio (e-mail/ticket) é backend.
 */
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '13px 15px', color: '#EAE5DB', fontSize: '1rem', outline: 'none', transition: 'border-color .25s ease, background .25s ease' };
const label: CSSProperties = { display: 'block', fontSize: '.74rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 8 };

export default function ContactForm() {
  const [enviado, setEnviado] = useState(false);
  return (
    <form onSubmit={(e) => { e.preventDefault(); setEnviado(true); }} style={{ background: 'rgba(234,229,219,.035)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        <div><label style={label}>Nome</label><input type="text" placeholder="Seu nome" style={inp} /></div>
        <div><label style={label}>E-mail</label><input type="email" placeholder="voce@email.com" style={inp} /></div>
      </div>
      <div>
        <label style={label}>Assunto</label>
        <select style={inp}>
          <option style={{ background: '#0F0F0E' }}>Dúvida sobre o app</option>
          <option style={{ background: '#0F0F0E' }}>Cobrança e assinatura</option>
          <option style={{ background: '#0F0F0E' }}>Privacidade / LGPD</option>
          <option style={{ background: '#0F0F0E' }}>Outro</option>
        </select>
      </div>
      <div>
        <label style={label}>Mensagem</label>
        <textarea rows={4} placeholder="Como podemos ajudar?" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <button type="submit" className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: '14px 26px', border: 'none', borderRadius: 13, cursor: 'pointer' }}>Enviar mensagem</button>
        {enviado && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.86rem', color: 'rgba(234,229,219,.6)' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={9} stroke="#BDFF00" strokeWidth={2} /><path d="M8 12l2.5 2.5L16 9" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Formulário de demonstração — sem envio real. <AValidar>integração de envio</AValidar>
          </span>
        )}
      </div>
    </form>
  );
}
