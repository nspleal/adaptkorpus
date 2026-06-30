import LegalLayout from '@/components/legal/LegalLayout';
import { SecaoLegal, Paragrafo, Lista, ItemLista, Forte, AValidar } from '@/components/legal/ui';

export const metadata = { title: 'Política de Privacidade · Evokorpus' };

const TOC = [
  { id: 's-dados', label: 'Dados que coletamos' },
  { id: 's-finalidade', label: 'Para que usamos' },
  { id: 's-minimizacao', label: 'Minimização e consentimento' },
  { id: 's-direitos', label: 'Seus direitos (LGPD)' },
  { id: 's-retencao', label: 'Retenção e segurança' },
  { id: 's-dpo', label: 'Encarregado (DPO)' },
  { id: 's-compartilhamento', label: 'Compartilhamento' },
];

export default function Privacidade() {
  return (
    <LegalLayout page="privacidade" titulo="Política de Privacidade" subtitulo="Como tratamos seus dados, por quê, e os direitos que a LGPD garante a você. Guardamos só o necessário." toc={TOC}>
      <SecaoLegal id="s-dados" titulo="Quais dados coletamos">
        <Paragrafo mb>Coletamos apenas o que é preciso para o app funcionar:</Paragrafo>
        <Lista mb>
          <ItemLista><Forte>Dados de conta:</Forte> nome, e-mail e credenciais.</ItemLista>
          <ItemLista><Forte>Dados de saúde e perfil:</Forte> sexo, altura, peso, objetivo e respostas da triagem de saúde.</ItemLista>
          <ItemLista ultimo><Forte>Dados de uso:</Forte> progresso, trocas e preferências que você registra.</ItemLista>
        </Lista>
        <Paragrafo>Os dados de pagamento são tratados pelo processador de pagamento — não armazenamos os dados completos do seu cartão. <AValidar>processador de pagamento</AValidar></Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-finalidade" titulo="Para que usamos">
        <Paragrafo mb>Usamos seus dados para <Forte>gerar e recalcular seu plano</Forte> de treino e dieta, lembrar você de cobranças antes que aconteçam, dar suporte e manter o serviço seguro.</Paragrafo>
        <Paragrafo>Não usamos seus dados de saúde para publicidade.</Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-minimizacao" titulo="Minimização, base legal e consentimento">
        <Paragrafo mb>Seguimos o princípio da <Forte>minimização</Forte>: pedimos só o necessário e guardamos apenas pelo tempo necessário.</Paragrafo>
        <Paragrafo>O tratamento de dados de saúde se apoia no seu <Forte>consentimento</Forte>, coletado no cadastro de forma separada e específica. Você pode revogar o consentimento a qualquer momento — isso pode limitar funções que dependem desses dados.</Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-direitos" titulo="Seus direitos (LGPD)">
        <Paragrafo mb>A LGPD garante a você, titular dos dados:</Paragrafo>
        <Lista mb>
          <ItemLista><Forte>Acessar</Forte> e confirmar quais dados temos.</ItemLista>
          <ItemLista><Forte>Corrigir</Forte> dados incompletos ou desatualizados.</ItemLista>
          <ItemLista><Forte>Portar / baixar</Forte> seus dados.</ItemLista>
          <ItemLista><Forte>Excluir</Forte> seus dados e sua conta.</ItemLista>
          <ItemLista ultimo><Forte>Revogar consentimento</Forte> e se opor a tratamentos.</ItemLista>
        </Lista>
        <Paragrafo>Você exerce esses direitos direto no app (Conta → Privacidade) ou pelo canal do Encarregado, abaixo.</Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-retencao" titulo="Retenção e segurança">
        <Paragrafo mb>Mantemos seus dados enquanto a conta existir e pelo prazo necessário a obrigações legais. Depois, eliminamos ou anonimizamos. <AValidar>prazos de retenção</AValidar></Paragrafo>
        <Paragrafo>Adotamos medidas técnicas e organizacionais para proteger seus dados. Nenhum sistema é infalível, e trabalhamos para reduzir riscos continuamente.</Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-dpo" titulo="Encarregado (DPO) e canal oficial">
        <Paragrafo mb>Para tratar de privacidade e exercer seus direitos, fale com nosso Encarregado de Proteção de Dados:</Paragrafo>
        <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '1.02em', color: 'rgba(234,229,219,.72)' }}>Encarregado / DPO: <AValidar>nome do DPO</AValidar></div>
          <div style={{ fontSize: '1.02em', color: 'rgba(234,229,219,.72)' }}>Canal oficial: <AValidar>e-mail de privacidade</AValidar></div>
        </div>
      </SecaoLegal>

      <SecaoLegal id="s-compartilhamento" titulo="Compartilhamento com operadores" ultima>
        <Paragrafo mb>Compartilhamos dados apenas com operadores que nos ajudam a operar o serviço, sob contrato e instruções:</Paragrafo>
        <Lista mb>
          <ItemLista>Processamento de pagamento.</ItemLista>
          <ItemLista>Infraestrutura e hospedagem.</ItemLista>
          <ItemLista ultimo>Envio de e-mails transacionais.</ItemLista>
        </Lista>
        <Paragrafo><Forte>Não vendemos seus dados.</Forte> <AValidar>lista de operadores / subprocessadores</AValidar></Paragrafo>
      </SecaoLegal>
    </LegalLayout>
  );
}
