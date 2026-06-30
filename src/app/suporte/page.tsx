import Link from 'next/link';
import LegalLayout, { Secao } from '@/components/legal/LegalLayout';

export const metadata = { title: 'Suporte · Evokorpus' };

export default function Suporte() {
  return (
    <LegalLayout titulo="Suporte">
      <p>Precisa de ajuda? Reunimos os caminhos mais rápidos abaixo.</p>

      <Secao titulo="Perguntas frequentes">
        <p>Muitas dúvidas (como funciona, preço, cancelamento, idade) estão respondidas na <Link href="/#faq" style={{ color: '#BDFF00', textDecoration: 'underline' }}>seção de FAQ</Link> da página inicial.</p>
      </Secao>

      <Secao titulo="Assinatura e pagamento">
        <p>Para gerenciar seu plano, atualizar o cartão ou cancelar, vá em <Link href="/conta" style={{ color: '#BDFF00', textDecoration: 'underline' }}>Conta e assinatura</Link>. Cancelar é simples e sem letra miúda; avisamos por e-mail antes de qualquer cobrança.</p>
      </Secao>

      <Secao titulo="Privacidade e seus dados">
        <p>Você pode baixar ou excluir seus dados em <Link href="/conta" style={{ color: '#BDFF00', textDecoration: 'underline' }}>Conta e assinatura</Link>. Saiba mais na <Link href="/privacidade" style={{ color: '#BDFF00', textDecoration: 'underline' }}>Política de Privacidade</Link>.</p>
      </Secao>

      <Secao titulo="Falar com a gente">
        <p>Envie sua mensagem para o nosso e-mail de suporte: <a href="mailto:suporte@evokorpus.app" style={{ color: '#BDFF00', textDecoration: 'underline' }}>suporte@evokorpus.app</a>. <em>[A confirmar: canal oficial de atendimento.]</em></p>
      </Secao>

      <Secao titulo="Saúde em primeiro lugar">
        <p>O Evokorpus é educacional e não substitui profissionais. Em caso de dor, condição de saúde ou dúvida clínica, procure um médico. Veja o <Link href="/aviso" style={{ color: '#BDFF00', textDecoration: 'underline' }}>Aviso</Link>.</p>
      </Secao>
    </LegalLayout>
  );
}
