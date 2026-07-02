import LegalLayout from '@/components/legal/LegalLayout';
import FaqAccordion from '@/components/legal/FaqAccordion';
import { AValidar } from '@/components/legal/ui';

export const metadata = { title: 'Reembolso · Evokorpus' };

const TOC = [
  { id: 's-garantia', label: 'Garantia de 7 dias' },
  { id: 's-passos', label: 'Como pedir o reembolso' },
  { id: 's-faq-reembolso', label: 'Perguntas sobre cobrança' },
];

const PASSOS = [
  { n: '01', t: 'Peça o reembolso', d: 'Pela sua conta (Assinatura → Reembolso) ou pelo e-mail de suporte.', neon: false },
  { n: '02', t: 'Confirmamos por e-mail', d: 'Você recebe a confirmação do pedido, sem enrolação.', neon: false },
  { n: '03', t: 'Estorno em até 2 dias úteis', d: 'O valor volta pelo mesmo meio de pagamento usado na compra.', neon: true },
];

// Copy jurídico/comercial em rascunho — mantém os marcadores [A validar:] até a redação final.
const FAQ = [
  { q: 'Já usei os 7 dias grátis. A garantia ainda vale?', a: 'Vale. A garantia é sobre a cobrança, não sobre ter usado o teste grátis.' },
  { q: 'Como eu cancelo minha assinatura?', a: 'Em Conta → Assinatura, em poucos toques. Cancelar impede a próxima cobrança; o reembolso é para quando você já foi cobrado e quer o dinheiro de volta.' },
  { q: 'Quando o estorno cai na minha conta?', a: <>Processamos em até 2 dias úteis; o tempo até aparecer no seu banco ou cartão pode variar. <AValidar>prazo do banco/operadora</AValidar></> },
  { q: 'Preciso explicar o motivo?', a: 'Não. É sem perguntas — só nos diga que quer o reembolso.' },
];

export default function Reembolso() {
  return (
    <LegalLayout page="reembolso" titulo="Reembolso" subtitulo="Nossa garantia é simples: se você não gostou, devolvemos o dinheiro — sem perguntas. Veja como funciona." toc={TOC}>
      {/* Garantia — cartão de destaque com o ACENTO DE MARCA (Pulso), não o vermelho de alerta:
          reembolso é boa notícia, não erro/segurança. */}
      <section id="s-garantia" data-toc-target style={{ margin: '0 0 40px', scrollMarginTop: 128 }}>
        <div style={{ position: 'relative', background: 'linear-gradient(165deg, rgba(189,255,0,.08), rgba(15,15,14,.5))', border: '1px solid rgba(189,255,0,.3)', borderRadius: 22, padding: 'clamp(26px,4vw,40px)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: '#BDFF00', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 18 }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3z" stroke="#BDFF00" strokeWidth={1.8} strokeLinejoin="round" /><path d="M9.5 12l1.8 1.8 3.4-3.6" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Nossa garantia
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 'clamp(1.16rem,2vw,1.42rem)', lineHeight: 1.5, fontWeight: 700, color: '#EAE5DB', letterSpacing: '-.01em' }}>7 dias de garantia. Não gostou? Devolvemos tudo — sem perguntas.</p>
          <p style={{ margin: 0, fontSize: '1.02rem', lineHeight: 1.65, color: 'rgba(234,229,219,.72)' }}>Peça pelo e-mail de suporte ou direto na sua conta. Processamos o estorno em até 2 dias úteis. <AValidar>prazo/CDC/condições</AValidar></p>
        </div>
      </section>

      <section id="s-passos" data-toc-target style={{ margin: '0 0 46px', scrollMarginTop: 128 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(1.32rem,2.6vw,1.7rem)', fontWeight: 700, letterSpacing: '-.02em' }}>Como pedir o reembolso</h2>
        <p style={{ margin: '0 0 26px', fontSize: '1.02em', lineHeight: 1.78, color: 'rgba(234,229,219,.72)' }}>Três passos, sem burocracia.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 22 }}>
          {PASSOS.map((p) => (
            <div key={p.n}>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, color: p.neon ? '#BDFF00' : 'rgba(189,255,0,.35)', lineHeight: 1, marginBottom: 12 }}>{p.n}</div>
              <p style={{ margin: '0 0 6px', fontSize: '1.02rem', fontWeight: 700, lineHeight: 1.4, color: '#EAE5DB' }}>{p.t}</p>
              <p style={{ margin: 0, fontSize: '.92rem', lineHeight: 1.5, color: 'rgba(234,229,219,.6)' }}>{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="s-faq-reembolso" data-toc-target style={{ margin: '0 0 8px', scrollMarginTop: 128 }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 'clamp(1.32rem,2.6vw,1.7rem)', fontWeight: 700, letterSpacing: '-.02em' }}>Perguntas sobre cobrança</h2>
        <FaqAccordion itens={FAQ} />
      </section>
    </LegalLayout>
  );
}
