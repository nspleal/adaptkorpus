import LegalLayout from '@/components/legal/LegalLayout';
import { QUANTO_CUSTA } from '@/lib/copy-cobranca';
import FaqBusca, { type FaqCat } from '@/components/legal/FaqBusca';

export const metadata = { title: 'Perguntas frequentes · Evokorpus' };

// FAQ é conteúdo informacional (NÃO jurídico) → draftMode={false} (sem selo de rascunho).
// Conteúdo canônico VERBATIM do cofre (conceitos/faq-evokorpus, 2026-07-02) — o app porta
// daqui, não inventa Q&A. Fatos já fixados no cofre (167 alimentos/96 pratos · reembolso
// 7 dias/2 dias úteis · suporte 24–48h) → sem [A validar].
//
// 🔒 EXCEÇÃO (DF 2026-07-29): o bloco de ASSINATURA saiu. O preço e o teste de 7 dias estão
// arquivados no cofre como PLANO, mas aqui eram apresentados como mecanismo OPERANTE — e o
// app não tem checkout, não tem cobrança e não tem mais botão de cancelar (a tela que a
// resposta "em 1 clique, na sua conta" citava foi removida). Descrever plano futuro é
// assunto dos Termos; FAQ de produto responde pelo que existe hoje.
const TOC = [
  { id: 's-cat-assinatura', label: 'Preço e acesso' },
  { id: 's-cat-treino', label: 'Treino' },
  { id: 's-cat-dieta', label: 'Dieta' },
  { id: 's-cat-conta', label: 'Conta e dados' },
  { id: 's-cat-legal', label: 'Saúde, legal e 18+' },
];

const CATEGORIAS: FaqCat[] = [
  {
    id: 's-cat-assinatura', label: 'Preço e acesso', desc: 'Quanto custa hoje e como se entra no beta.',
    items: [
      { q: 'Quanto custa?', a: QUANTO_CUSTA.faq },
      { q: 'Como eu entro?', a: 'O beta está fechado e as vagas são por convite. Quem já tem conta entra pela tela de login.' },
      { q: 'Vou ser cobrado de surpresa?', a: 'Não. Não existe cobrança no beta. Se um plano pago existir no futuro, você decide se entra.' },
    ],
  },
  {
    id: 's-cat-treino', label: 'Treino', desc: 'Como o treino é montado e se adapta a você.',
    items: [
      { q: 'Preciso de academia?', a: 'Não. Você escolhe o equipamento que tem — nenhum, em casa ou academia — e o plano se monta em cima disso.' },
      { q: 'Como o treino é montado?', a: 'Por um método de treino consagrado (o FITT): séries, repetições, descanso e progressão conforme o seu objetivo e o seu nível. Regras claras, sem achismo.' },
      { q: 'Sou iniciante, serve pra mim?', a: 'Serve. Você informa a sua experiência e o plano começa no ponto certo, com progressão gradual.' },
      { q: 'Como sei quanta carga usar?', a: 'O app trabalha com esforço percebido (deixar 1 a 3 repetições "na reserva"), e não com teste de carga máxima — mais seguro pra quem treina sozinho.' },
      { q: 'Posso escolher os dias de treino?', a: 'Pode. Você marca quais dias da semana treina (de segunda a domingo); o restante vira descanso ou recuperação leve.' },
      { q: 'Posso trocar um exercício que não gosto ou não consigo fazer?', a: 'Pode. O app sugere alternativas equivalentes pro mesmo padrão de movimento.' },
    ],
  },
  {
    id: 's-cat-dieta', label: 'Dieta', desc: 'Cardápio, dados dos alimentos, trocas e restrições.',
    items: [
      { q: 'É contagem de calorias?', a: 'Não é um diário de calorias. O app monta um cardápio pra sua meta e você só marca se seguiu ou comeu outra coisa — sem culpa, sem número na sua cara.' },
      { q: 'De onde vêm os dados dos alimentos?', a: 'De tabelas oficiais de composição de alimentos (a TACO, brasileira, e a USDA). São 167 alimentos e 96 pratos montados a partir deles.' },
      { q: 'Sou vegetariano ou vegano — funciona?', a: 'Funciona bem. Há 35 pratos veganos e 29 vegetarianos, com boas fontes de proteína vegetal (soja, leguminosas). Você marca a sua identidade alimentar e o app respeita.' },
      { q: 'Tem alimento que eu não gosto — e se eu for alérgico?', a: 'Você lista o que "não gosto" e o app evita. Alergia é tratada à parte, como filtro absoluto (nunca entra no seu cardápio) — são coisas diferentes de propósito, por segurança.' },
      { q: 'Cansei de um prato, e agora?', a: 'Toca em "Cansei deste prato" e ele sai da rotação por 21 dias, voltando sozinho depois. Cansaço de receita é temporário.' },
      { q: 'Preciso comer exatamente as gramas do cardápio?', a: 'É uma referência, não uma regra rígida. O app ajusta as porções pra bater a sua meta; use como ponto de partida.' },
    ],
  },
  {
    id: 's-cat-conta', label: 'Conta e dados', desc: 'Seus dados, seus direitos e como o app funciona.',
    items: [
      { q: 'Vocês vendem os meus dados?', a: 'Não. Nunca vendemos os seus dados nem usamos os seus dados de saúde para publicidade.' },
      { q: 'Posso exportar ou apagar os meus dados?', a: 'Pode, quando quiser — é um direito garantido pela LGPD. Você baixa ou exclui pela sua conta.' },
      { q: 'Vocês pedem foto do meu corpo?', a: 'Não pedimos foto.' },
      { q: 'Funciona sem internet?', a: 'O seu plano do dia (cardápio e treino) fica disponível offline depois que você abre o app uma vez.' },
      { q: 'Tem app pra baixar na loja?', a: 'É um app web (PWA): você acessa pelo navegador e pode "adicionar à tela inicial" pra usar como um app, sem loja.' },
      { q: 'Como falo com o suporte?', a: 'Por e-mail e WhatsApp; respondemos em até 24 a 48 horas.' },
    ],
  },
  {
    id: 's-cat-legal', label: 'Saúde, legal e 18+', desc: 'Os limites da ferramenta e quem pode usar.',
    items: [
      { q: 'O Evokorpus usa IA?', a: 'Não. É uma ferramenta baseada em regras claras e numa base de dados curada — uma fórmula transparente, não um chute de "caixa-preta". Você fica no comando das escolhas.' },
      { q: 'Isso substitui nutricionista ou personal trainer?', a: 'Não. É uma ferramenta geral e educacional pra você organizar treino e alimentação; não é acompanhamento clínico. Para necessidades específicas, procure um profissional.' },
      { q: 'Tenho uma condição de saúde (diabetes, gravidez, lesão, coração) — posso usar?', a: 'Nesses casos o app não gera plano e te orienta a procurar um profissional de saúde. É uma escolha de segurança, não um limite comercial.' },
      { q: 'Vocês prometem que eu vou emagrecer ou ganhar massa?', a: 'Não prometemos resultado. Entregamos uma ferramenta honesta e organizada; o resultado depende de constância e de fatores individuais.' },
      { q: 'Vocês recomendam suplementos?', a: 'Não. O Evokorpus não vende nem recomenda suplementos.' },
      { q: 'Tem idade mínima?', a: 'Sim: o Evokorpus é para maiores de 18 anos.' },
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
