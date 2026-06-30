import LegalLayout, { Secao } from '@/components/legal/LegalLayout';

export const metadata = { title: 'Termos de Uso · Evokorpus' };

export default function Termos() {
  return (
    <LegalLayout titulo="Termos de Uso">
      <p>Estes Termos regem o uso do aplicativo Evokorpus. Ao criar uma conta ou usar o serviço, você concorda com eles. Leia também a <strong style={{ color: '#EAE5DB' }}>Política de Privacidade</strong> e o <strong style={{ color: '#EAE5DB' }}>Aviso</strong>.</p>

      <Secao titulo="1. O que o Evokorpus é (e o que não é)">
        <p>O Evokorpus é uma <strong style={{ color: '#EAE5DB' }}>ferramenta de uso geral e caráter educacional</strong>, dirigida pelo usuário, que sugere um plano de treino e dieta a partir de fórmulas e de uma base de dados curada. <strong style={{ color: '#EAE5DB' }}>Não é</strong> prescrição médica, nutricional ou de educação física, e não substitui o acompanhamento de profissionais habilitados.</p>
        <p>As estimativas (como calorias) são pontos de partida, não metas garantidas. O serviço não promete resultados.</p>
      </Secao>

      <Secao titulo="2. Idade mínima (18+)">
        <p>O Evokorpus é destinado a pessoas com <strong style={{ color: '#EAE5DB' }}>18 anos ou mais</strong>. Ao usar o serviço, você declara ter idade igual ou superior a 18 anos.</p>
      </Secao>

      <Secao titulo="3. Sua conta">
        <p>Você é responsável por manter a confidencialidade das suas credenciais e por toda a atividade na sua conta. Os dados que você informa devem ser verdadeiros e atualizados — eles alimentam as estimativas do seu plano.</p>
      </Secao>

      <Secao titulo="4. Assinatura, teste grátis e cobrança">
        <p>O acesso é por assinatura. Quando houver período de teste grátis, avisamos por e-mail <strong style={{ color: '#EAE5DB' }}>antes</strong> da primeira cobrança — sem cobrança-surpresa. Você pode cancelar a qualquer momento; o acesso permanece até o fim do período já pago e não há nova cobrança.</p>
        <p><em>[A validar: valores, ciclo, regras de reembolso e o provedor de pagamento.]</em></p>
      </Secao>

      <Secao titulo="5. Uso responsável e saúde">
        <p>Consulte um médico antes de iniciar qualquer programa de exercício ou mudança alimentar. Se você relatar uma condição de saúde na triagem, o app pode <strong style={{ color: '#EAE5DB' }}>não gerar um plano automático</strong> e orientar a procurar um profissional.</p>
      </Secao>

      <Secao titulo="6. Propriedade intelectual">
        <p>A marca, o conteúdo e o software do Evokorpus são protegidos. Você recebe uma licença pessoal e intransferível de uso, enquanto sua assinatura estiver ativa.</p>
      </Secao>

      <Secao titulo="7. Limitação de responsabilidade">
        <p>Na máxima extensão permitida pela lei aplicável, o Evokorpus não se responsabiliza por decisões tomadas com base nas sugestões do app. <em>[A validar juridicamente.]</em></p>
      </Secao>

      <Secao titulo="8. Alterações e contato">
        <p>Podemos atualizar estes Termos; avisaremos quando houver mudanças relevantes. Dúvidas: veja a página de <strong style={{ color: '#EAE5DB' }}>Suporte</strong>.</p>
      </Secao>
    </LegalLayout>
  );
}
