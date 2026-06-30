import LegalLayout from '@/components/legal/LegalLayout';
import { SecaoLegal, Paragrafo, Lista, ItemLista, Forte, AValidar } from '@/components/legal/ui';

export const metadata = { title: 'Termos de Uso · Evokorpus' };

const TOC = [
  { id: 's-objeto', label: 'Objeto do serviço' },
  { id: 's-elegibilidade', label: 'Elegibilidade' },
  { id: 's-conta', label: 'Conta e acesso' },
  { id: 's-assinatura', label: 'Assinatura e cobrança' },
  { id: 's-conteudo', label: 'Conteúdo e propriedade' },
  { id: 's-responsabilidade', label: 'Isenções e responsabilidade' },
  { id: 's-alteracoes', label: 'Alterações e foro' },
];

export default function Termos() {
  return (
    <LegalLayout page="termos" titulo="Termos de Uso" subtitulo="Como você pode usar o Evokorpus, o que oferecemos e os limites do serviço — em linguagem direta." toc={TOC}>
      <SecaoLegal id="s-objeto" titulo="Objeto do serviço">
        <Paragrafo mb>O Evokorpus é uma <Forte>ferramenta de uso geral e caráter educacional, dirigida por você</Forte>. Ele organiza treino e alimentação a partir das informações que você fornece e de regras adaptativas sobre dados reconhecidos.</Paragrafo>
        <Paragrafo>Ele <Forte>não constitui prescrição, consulta ou acompanhamento</Forte> nutricional ou de educação física, nem substitui profissionais habilitados. Você está sempre no comando: o app sugere, você decide e ajusta.</Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-elegibilidade" titulo="Elegibilidade">
        <Paragrafo>O Evokorpus é destinado a <Forte>maiores de 18 anos</Forte>. Ao criar uma conta, você declara ter ao menos 18 anos e capacidade para aceitar estes Termos.</Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-conta" titulo="Conta e acesso">
        <Paragrafo mb>Sua conta é pessoal e intransferível. Você é responsável por manter a confidencialidade das suas credenciais e pelas atividades feitas na sua conta.</Paragrafo>
        <Lista>
          <ItemLista>Use dados verdadeiros ao se cadastrar.</ItemLista>
          <ItemLista>Não compartilhe seu acesso com terceiros.</ItemLista>
          <ItemLista ultimo>Avise-nos se suspeitar de uso não autorizado.</ItemLista>
        </Lista>
      </SecaoLegal>

      <SecaoLegal id="s-assinatura" titulo="Assinatura e cobrança">
        <Paragrafo mb>A assinatura dá acesso aos recursos do Evokorpus enquanto estiver ativa. Sem cobrança-surpresa, sem letra miúda.</Paragrafo>
        <Lista mb>
          <ItemLista><Forte>7 dias grátis</Forte> para testar.</ItemLista>
          <ItemLista>Enviamos um <Forte>aviso por e-mail antes da primeira cobrança</Forte>.</ItemLista>
          <ItemLista>Valor de R$ 29/mês <AValidar>valores e ciclo</AValidar></ItemLista>
          <ItemLista ultimo><Forte>Cancelamento a qualquer momento.</Forte></ItemLista>
        </Lista>
        <Paragrafo>O cancelamento encerra as renovações seguintes; o acesso permanece até o fim do período já pago. <AValidar>política de reembolso</AValidar></Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-conteudo" titulo="Conteúdo e propriedade intelectual">
        <Paragrafo mb>A marca, o software, os textos e o design do Evokorpus são protegidos e pertencem a seus titulares. O uso do serviço não transfere esses direitos a você.</Paragrafo>
        <Paragrafo>Os valores nutricionais de alimentos exibidos têm como base a <Forte>TACO (NEPA/UNICAMP)</Forte> e o <Forte>USDA</Forte>. Mantemos o crédito a essas fontes onde os dados aparecem.</Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-responsabilidade" titulo="Isenções e limitação de responsabilidade">
        <Paragrafo mb>O Evokorpus <Forte>não promete resultado, número ou prazo</Forte>. A evolução depende de fatores individuais e da sua constância.</Paragrafo>
        <Paragrafo>Na máxima medida permitida pela lei, não nos responsabilizamos por decisões tomadas com base no uso da ferramenta. Em caso de dor, sintoma ou condição de saúde, procure um profissional habilitado. <AValidar>limitação de responsabilidade</AValidar></Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-alteracoes" titulo="Alterações dos termos e foro" ultima>
        <Paragrafo mb>Podemos atualizar estes Termos para refletir melhorias do serviço ou exigências legais. Avisaremos sobre mudanças relevantes, e a data de atualização fica sempre visível no topo.</Paragrafo>
        <Paragrafo>Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro de <AValidar>foro</AValidar> para dirimir controvérsias. Razão social: <AValidar>razão social / CNPJ</AValidar></Paragrafo>
      </SecaoLegal>
    </LegalLayout>
  );
}
