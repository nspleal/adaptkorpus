import Link from 'next/link';
import LegalLayout from '@/components/legal/LegalLayout';
import { SecaoLegal, Paragrafo, AValidar } from '@/components/legal/ui';
import FaqAccordion from '@/components/legal/FaqAccordion';
import ContactForm from '@/components/legal/ContactForm';

export const metadata = { title: 'Suporte e Contato · Evokorpus' };

const TOC = [
  { id: 's-faq', label: 'Perguntas frequentes' },
  { id: 's-contato', label: 'Fale com a gente' },
  { id: 's-legais', label: 'Páginas legais' },
];

const FAQ = [
  { q: 'O Evokorpus substitui um nutricionista ou personal?', a: 'Não. É uma ferramenta geral e educacional, dirigida por você. Para condições de saúde ou orientação individual, procure um profissional habilitado.' },
  { q: 'O app usa inteligência artificial?', a: 'Não. O plano é montado por regras claras e adaptativas sobre dados reconhecidos — sem caixa-preta.' },
  // 🔒 Saíram "Como funciona a cobrança e o teste grátis?" e "Como eu cancelo?" (DF
  // 2026-07-29): não há cobrança, e a segunda mandava o usuário a "Conta → Assinatura",
  // uma seção que deixou de existir — instrução para uma tela inexistente.
  { q: 'Quanto custa?', a: 'Nada. O beta é gratuito e as vagas são por convite: não existe cobrança nem assinatura hoje.' },
  { q: 'Quero exercer meus direitos de dados. Como faço?', a: <>Em Conta → Privacidade você pode baixar ou excluir seus dados. Também pode falar com nosso Encarregado (DPO): <AValidar>e-mail do DPO</AValidar></> },
];

const CARDS = [
  { titulo: 'Termos de Uso', desc: 'Regras, assinatura e limites do serviço.', href: '/termos' },
  { titulo: 'Política de Privacidade', desc: 'Dados, LGPD e seus direitos.', href: '/privacidade' },
  { titulo: 'Aviso', desc: 'Caráter educacional e segurança.', href: '/aviso' },
];

export default function Suporte() {
  return (
    <LegalLayout page="suporte" titulo="Suporte e Contato" subtitulo="Tire dúvidas, fale com a gente e acesse as páginas legais." toc={TOC}>
      <section id="s-faq" data-toc-target style={{ margin: '0 0 46px', scrollMarginTop: 128 }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 'clamp(1.32rem,2.6vw,1.7rem)', fontWeight: 700, letterSpacing: '-.02em' }}>Perguntas frequentes</h2>
        <FaqAccordion itens={FAQ} />
      </section>

      <SecaoLegal id="s-contato" titulo="Fale com a gente">
        <Paragrafo mb>Não achou a resposta? Escreva pra gente. E-mail de suporte: <AValidar>suporte@evokorpus… real</AValidar></Paragrafo>
        <ContactForm />
      </SecaoLegal>

      <section id="s-legais" data-toc-target style={{ margin: '0 0 8px', scrollMarginTop: 128 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(1.32rem,2.6vw,1.7rem)', fontWeight: 700, letterSpacing: '-.02em' }}>Páginas legais</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="hov-lift" style={{ textAlign: 'left', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: 18, color: '#EAE5DB', textDecoration: 'none' }}>
              <div style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: 4 }}>{c.titulo}</div>
              <div style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.55)' }}>{c.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </LegalLayout>
  );
}
