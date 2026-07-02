import LegalLayout from '@/components/legal/LegalLayout';
import FaqBusca, { type FaqCat } from '@/components/legal/FaqBusca';
import { AValidar } from '@/components/legal/ui';

export const metadata = { title: 'Perguntas frequentes · Evokorpus' };

// FAQ é conteúdo informacional (NÃO jurídico) → draftMode={false} (sem selo de rascunho).
// Ainda assim, fatos pendentes específicos levam o marcador [A validar:] inline.
const TOC = [
  { id: 's-cat-assinatura', label: 'Assinatura e cancelamento' },
  { id: 's-cat-treino', label: 'Treino' },
  { id: 's-cat-dieta', label: 'Dieta' },
  { id: 's-cat-conta', label: 'Conta e dados' },
  { id: 's-cat-legal', label: 'Legal e 18+' },
];

const CATEGORIAS: FaqCat[] = [
  {
    id: 's-cat-assinatura', label: 'Assinatura e cancelamento', desc: 'Como funciona o teste grátis, a cobrança e o cancelamento.',
    items: [
      { q: 'Como funciona o teste grátis?', a: 'São 7 dias grátis. Avisamos por e-mail antes da primeira cobrança de R$ 29/mês. Você cancela quando quiser.', note: <AValidar>valores e ciclo</AValidar> },
      { q: 'Como eu cancelo?', a: 'Em Conta → Assinatura, em poucos toques. Sem letra miúda: o acesso continua até o fim do período já pago.' },
    ],
  },
  {
    id: 's-cat-treino', label: 'Treino', desc: 'Como o treino se adapta a você.',
    items: [
      { q: 'Preciso ir à academia?', a: 'Não. O treino se adapta ao que você tem — em casa ou na academia, com ou sem equipamento.' },
      { q: 'E se eu perder um dia de treino?', a: 'Sem culpa. Seus dias de treino ficam salvos no seu perfil e o plano se reorganiza a partir daí — constância importa mais que perfeição.' },
    ],
  },
  {
    id: 's-cat-dieta', label: 'Dieta', desc: 'Cardápio, trocas e como calculamos.',
    items: [
      // "não curto" → "não gosto" (consistência com o rename já publicado no app).
      { q: 'Não gosto de um alimento do cardápio. E agora?', a: 'Você troca sem quebrar o plano — é só marcar o que não gosta nas suas preferências.' },
      { q: 'As calorias e macros são exatas?', a: 'São pontos de partida calculados a partir de dados reconhecidos (TACO/USDA) — não metas exatas. Você ajusta conforme a sua realidade.' },
    ],
  },
  {
    id: 's-cat-conta', label: 'Conta e dados', desc: 'Seus dados, seus direitos.',
    items: [
      { q: 'Como exerço meus direitos sobre meus dados (LGPD)?', a: 'Em Conta → Privacidade você acessa, corrige, baixa ou exclui seus dados. Também pode falar com nosso Encarregado (DPO).', note: <AValidar>e-mail do DPO</AValidar> },
      { q: 'Posso excluir minha conta quando quiser?', a: 'Pode, direto no app, a qualquer momento.' },
    ],
  },
  {
    id: 's-cat-legal', label: 'Legal e 18+', desc: 'Limites da ferramenta e quem pode usar.',
    items: [
      { q: 'O Evokorpus substitui um nutricionista ou personal?', a: 'Não. É uma ferramenta geral e educacional, dirigida por você. Para condições de saúde, procure um profissional habilitado.' },
      { q: 'O app usa inteligência artificial?', a: 'Não. O plano é montado por regras claras e adaptativas sobre dados reconhecidos — sem caixa-preta.' },
      { q: 'Preciso ter 18 anos?', a: 'Sim. O Evokorpus é destinado a maiores de 18 anos.' },
    ],
  },
];

export default function Faq() {
  return (
    <LegalLayout page="faq" draftMode={false} titulo="Perguntas frequentes" subtitulo="As dúvidas mais comuns sobre assinatura, treino, dieta, seus dados e os limites da ferramenta." toc={TOC}>
      <FaqBusca categorias={CATEGORIAS} />
    </LegalLayout>
  );
}
