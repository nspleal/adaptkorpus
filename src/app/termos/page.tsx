import LegalLayout from '@/components/legal/LegalLayout';
import { NUCLEO_COBRANCA } from '@/lib/copy-cobranca';
import { SecaoLegal, Paragrafo, Lista, ItemLista, Forte, AValidar } from '@/components/legal/ui';

export const metadata = { title: 'Termos de Uso · Evokorpus' };

const TOC = [
  { id: 's-objeto', label: 'Objeto do serviço' },
  { id: 's-elegibilidade', label: 'Elegibilidade' },
  { id: 's-conta', label: 'Conta e acesso' },
  { id: 's-assinatura', label: 'Acesso e cobrança' },
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

      {/* 🔒 A SEÇÃO DE ASSINATURA SAIU (DF 2026-08-04). Ela descrevia 7 dias grátis, R$ 29/mês,
          aviso antes da 1ª cobrança e regras de renovação — mecanismo que não existe: no beta
          não há cobrança, assinatura nem checkout. Documento legal que descreve cobrança
          inexistente é o mesmo defeito das telas de produto, num lugar que pesa mais.
          🟢 A página FICA no ar (o cadastro precisa dela para o consentimento) e os
          `[A validar:]` jurídicos continuam — são do advogado, não deste lote. O núcleo abaixo
          é o mesmo publicado no /faq, na landing e no /suporte (`lib/copy-cobranca`). */}
      <SecaoLegal id="s-assinatura" titulo="Acesso e cobrança">
        <Paragrafo mb>{NUCLEO_COBRANCA}</Paragrafo>
        <Paragrafo>Se um plano pago passar a existir, ele será <Forte>anunciado antes</Forte> de qualquer cobrança, e você decide se entra. Nada é cobrado sem você contratar.</Paragrafo>
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
