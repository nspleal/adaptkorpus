import LegalLayout, { Secao } from '@/components/legal/LegalLayout';

export const metadata = { title: 'Política de Privacidade · Evokorpus' };

export default function Privacidade() {
  return (
    <LegalLayout titulo="Política de Privacidade">
      <p>Esta Política explica como o Evokorpus trata seus dados pessoais, em conformidade com a <strong style={{ color: '#EAE5DB' }}>LGPD (Lei 13.709/2018)</strong>. Dados de saúde são <strong style={{ color: '#EAE5DB' }}>dados sensíveis</strong> e recebem proteção reforçada.</p>

      <Secao titulo="1. Dados que coletamos">
        <p>Conta: nome, e-mail e dados de pagamento (processados pelo provedor de pagamento). Perfil: sexo biológico, idade, altura, peso, objetivo, nível de atividade e experiência, disponibilidade, preferência alimentar e <strong style={{ color: '#EAE5DB' }}>respostas da triagem de saúde</strong>. Uso: plano gerado, trocas, registros de peso e feedback de treino.</p>
      </Secao>

      <Secao titulo="2. Para que usamos">
        <p>Para gerar e ajustar seu plano de treino e dieta, operar sua assinatura e melhorar o serviço. <strong style={{ color: '#EAE5DB' }}>Não usamos seus dados para treinar modelos de IA</strong> — o plano é fórmula + dado curado.</p>
      </Secao>

      <Secao titulo="3. Base legal e consentimento">
        <p>O tratamento de dados de saúde se apoia no seu <strong style={{ color: '#EAE5DB' }}>consentimento específico e destacado</strong>, coletado no cadastro. Você pode revogar o consentimento a qualquer momento (isso pode impedir a geração do plano).</p>
      </Secao>

      <Secao titulo="4. Minimização e segurança">
        <p>Coletamos apenas o necessário. Aplicamos controle de acesso por linha (RLS) em todas as tabelas, segregação de segredos e princípio do menor privilégio. <em>[Detalhes técnicos: ver docs/security-lgpd.md no projeto.]</em></p>
      </Secao>

      <Secao titulo="5. Compartilhamento">
        <p>Compartilhamos dados apenas com operadores necessários ao serviço (ex.: provedor de pagamento e infraestrutura), sob contrato. Não vendemos seus dados.</p>
      </Secao>

      <Secao titulo="6. Seus direitos (titular)">
        <p>Você pode <strong style={{ color: '#EAE5DB' }}>acessar, corrigir, exportar e excluir</strong> seus dados, além de revogar consentimento. As opções “Baixar meus dados” e “Excluir minha conta” estão em <strong style={{ color: '#EAE5DB' }}>Conta e assinatura</strong>.</p>
      </Secao>

      <Secao titulo="7. Retenção">
        <p>Mantemos seus dados enquanto sua conta existir. Ao excluir a conta, removemos seus dados pessoais, salvo obrigações legais de retenção. <em>[A validar: prazos.]</em></p>
      </Secao>

      <Secao titulo="8. Encarregado (DPO) e contato">
        <p>Para exercer direitos ou tirar dúvidas de privacidade, use a página de <strong style={{ color: '#EAE5DB' }}>Suporte</strong>. <em>[A definir: encarregado/DPO e canal oficial.]</em></p>
      </Secao>
    </LegalLayout>
  );
}
