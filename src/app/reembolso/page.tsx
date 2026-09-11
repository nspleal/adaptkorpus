import LegalLayout from '@/components/legal/LegalLayout';
import { SecaoLegal, Paragrafo, Lista, ItemLista, Forte, AValidar } from '@/components/legal/ui';

export const metadata = { title: 'Reembolso · Adaptkorpus' };

/**
 * 🔒 `/reembolso` — RECRIADA em 2026-08-11 (DF do autor), depois de ter sido removida em
 * 2026-08-01 (`handoff-remover-reembolso-2026-08-01`).
 *
 * Razão do autor, verbatim: *"pode deixar o reembolso no ar, o app está em beta agora e não
 * tem nenhum problema continuar assim pois os testadores não gastam dinheiro. Porém antes de
 * lançar com certeza eu vou colocar um meio de cobrar os usuários e aí o reembolso já vai
 * estar presente."*
 *
 * 🔴 A COPY NÃO VOLTOU COMO ERA, e não podia: o cofre marca o texto anterior como
 * **"não usar"** (`operacao-legal-suporte-reembolso`, bloco do achado de 01/08). Aquele texto
 * descrevia passo a passo uma operação que não existe — *"Peça o reembolso (Assinatura →
 * Reembolso)"*, *"Estorno em até 2 dias úteis"*, *"o valor volta pelo mesmo meio de pagamento
 * usado na compra"*. Continua não existindo assinatura, checkout nem meio de pagamento.
 *
 * O que esta página faz: existe, é alcançável, e diz a VERDADE DO BETA — hoje não há cobrança,
 * então não há o que reembolsar. Prazo, percentual e condições são peça jurídica: entram como
 * `AValidar` (placeholder visível), nunca inventados. A trava do cofre é explícita —
 * *"`/reembolso` e `/termos` só são reescritos com a decisão de o que a página deve dizer
 * enquanto não há cobrança"*, dono: autor (decidir) + jurídico (ratificar). O autor decidiu;
 * o jurídico ainda não ratificou, e é por isso que os números não estão aqui.
 */

const TOC = [
  { id: 's-hoje', label: 'Como é hoje' },
  { id: 's-quando', label: 'Quando houver cobrança' },
  { id: 's-cancelar', label: 'Sair do beta' },
];

export default function Reembolso() {
  return (
    <LegalLayout
      page="reembolso"
      titulo="Reembolso"
      subtitulo="O que acontece com o seu dinheiro — e por que, hoje, não há nenhum envolvido."
      toc={TOC}
    >
      <SecaoLegal id="s-hoje" titulo="Como é hoje">
        <Paragrafo mb>
          <Forte>O Adaptkorpus está em beta e não cobra nada.</Forte> Não existe assinatura, não existe
          checkout e nenhum meio de pagamento é pedido em lugar nenhum do app.
        </Paragrafo>
        <Paragrafo mb>
          Por isso <Forte>não há reembolso a pedir</Forte>: não há pagamento para devolver. Esta página
          existe para você saber disso antes de perguntar — e para já estar aqui quando a cobrança
          existir.
        </Paragrafo>
        <Paragrafo>
          Se alguma tela do app sugerir que você pagou, ou cobrar algo de você, <Forte>não é nosso</Forte>.
          Fale com a gente pelo suporte.
        </Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-quando" titulo="Quando houver cobrança">
        <Paragrafo mb>
          Nada nesta seção vale hoje — não há cobrança. Quando existir plano pago, esta página passa
          a descrever a política, e ela será publicada <Forte>antes</Forte> da primeira cobrança, nunca
          depois.
        </Paragrafo>
        <Paragrafo mb>O texto final ainda está em revisão. O que falta definir:</Paragrafo>
        <Lista mb>
          <ItemLista>Prazo para pedir: <AValidar>prazo</AValidar></ItemLista>
          <ItemLista>Quanto volta: <AValidar>percentual e regra de proporcionalidade</AValidar></ItemLista>
          <ItemLista>Em quanto tempo o valor volta: <AValidar>prazo</AValidar></ItemLista>
          <ItemLista ultimo>Como pedir: <AValidar>canal</AValidar></ItemLista>
        </Lista>
        <Paragrafo>
          Enquanto esses campos estiverem marcados assim, <Forte>eles não valem como promessa</Forte> —
          são lacunas à espera de revisão jurídica, mostradas em vez de escondidas.
        </Paragrafo>
      </SecaoLegal>

      <SecaoLegal id="s-cancelar" titulo="Sair do beta" ultima>
        <Paragrafo mb>
          Você pode parar de usar o app quando quiser, sem pedir permissão e sem custo — porque não há
          custo.
        </Paragrafo>
        <Paragrafo>
          Para apagar a sua conta e os seus dados, use <Forte>Conta e meus dados</Forte> dentro do app. A
          exclusão leva junto o seu histórico, e isso não tem volta.
        </Paragrafo>
      </SecaoLegal>
    </LegalLayout>
  );
}
