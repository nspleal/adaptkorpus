import InstitucionalShell from '@/components/legal/InstitucionalShell';

export const metadata = { title: 'Changelog · Evokorpus' };

// Releases REAIS do Evokorpus, compilados do histórico de lançamentos — atualizar a cada release.
// Tags SEM vermelho (vermelho = erro/segurança em todo o sistema): "Novo" = Pulso sólido;
// "Melhoria"/"Correção" = pílula Bone neutra.
type Tag = 'Novo' | 'Melhoria' | 'Correção';
const GRUPOS: { mes: string; itens: { data: string; titulo: string; tag: Tag; desc: string }[] }[] = [
  {
    mes: 'Julho 2026',
    itens: [
      { data: '03 jul', titulo: 'Registre um treino já feito', tag: 'Novo', desc: 'Treinou por fora ou em outro dia? Lance a sessão completa — exercícios, séries, cargas e esforço — direto no seu histórico.' },
      { data: '03 jul', titulo: 'A chama dos quatro marcos', tag: 'Novo', desc: 'O total de dias de treino ganhou uma chama que muda de cor aos 15, 25, 50 e 100 dias. Um número que só cresce — sem sequência pra perder.' },
      { data: '02 jul', titulo: 'Erros comuns em cada exercício', tag: 'Novo', desc: 'Além do "como fazer", a tela do exercício agora mostra os deslizes mais comuns de execução e como corrigir.' },
      { data: '02 jul', titulo: 'Registre qualquer treino', tag: 'Novo', desc: 'Treinou por fora do plano? Marque o dia como treinado — ele conta para a sua constância.' },
      { data: '02 jul', titulo: 'Marcos de constância', tag: 'Novo', desc: 'Um marco que soma os seus dias de treino e nunca cobra a ausência: nenhum dia conta contra você.' },
      { data: '02 jul', titulo: 'Progressão de carga por exercício', tag: 'Novo', desc: 'Acompanhe a evolução da sua carga ao longo do tempo, direto no Histórico.' },
      { data: '02 jul', titulo: 'Base ampliada: 167 alimentos e 96 pratos', tag: 'Melhoria', desc: 'Cardápios com mais opções, incluindo 35 pratos veganos e 29 vegetarianos, com dados TACO e USDA.' },
      { data: '02 jul', titulo: 'Perguntas frequentes com busca', tag: 'Melhoria', desc: 'A central de ajuda agora cobre assinatura, treino, dieta, seus dados e os limites da ferramenta.' },
      { data: '02 jul', titulo: 'Garantia de 7 dias e reembolso', tag: 'Novo', desc: 'Nova página explicando a garantia de 7 dias e como pedir reembolso, sem letra miúda.' },
      { data: '01 jul', titulo: 'Escolha os seus dias de treino', tag: 'Novo', desc: 'Marque quais dias da semana você treina (de segunda a domingo); o resto vira descanso ou recuperação leve.' },
      { data: '01 jul', titulo: '"Cansei deste prato"', tag: 'Novo', desc: 'Tirou um prato da rotação? Ele descansa por 21 dias e volta sozinho depois.' },
    ],
  },
  {
    mes: 'Junho 2026',
    itens: [
      { data: '30 jun', titulo: 'Registro de refeições e histórico de constância', tag: 'Novo', desc: 'Marque se seguiu o plano em cada refeição e acompanhe a sua constância — sem contar calorias, sem culpa.' },
      { data: '30 jun', titulo: 'Detalhe de cada prato e exercício', tag: 'Novo', desc: 'Toque em um item para ver ingredientes, estimativa de referência e como fazer.' },
      { data: '30 jun', titulo: 'Termos, Privacidade e Suporte', tag: 'Novo', desc: 'Documentos claros sobre como a ferramenta funciona e como os seus dados são tratados.' },
      { data: '30 jun', titulo: 'Sua sessão mais estável', tag: 'Melhoria', desc: 'A área logada sobrevive a recarregar a página e ao botão voltar do navegador.' },
    ],
  },
];

function TagPill({ tag }: { tag: Tag }) {
  const neon = tag === 'Novo';
  return (
    <span style={{ fontSize: '.66rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', borderRadius: 999, padding: '2px 9px', ...(neon
      ? { color: '#0D2818', background: '#BDFF00' }
      : { color: 'rgba(234,229,219,.72)', background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.18)' }) }}>{tag}</span>
  );
}

export default function Changelog() {
  return (
    <InstitucionalShell page="changelog">
      <div style={{ maxWidth: 760, margin: '0 auto', animation: 'evkScreenIn .5s cubic-bezier(.22,.61,.36,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: 'clamp(2.1rem,4.4vw,3.2rem)', lineHeight: 1.06, letterSpacing: '-.03em' }}>Changelog</h1>
        </div>
        <p style={{ margin: '0 0 44px', fontSize: 'clamp(1.02rem,1.4vw,1.16rem)', lineHeight: 1.6, color: 'rgba(234,229,219,.66)', fontWeight: 500, maxWidth: 520 }}>O que muda no Evokorpus, direto ao ponto — atualizado a cada novo lançamento.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {GRUPOS.map((g) => (
            <div key={g.mes}>
              <div style={{ fontSize: '.76rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(234,229,219,.45)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(234,229,219,.1)' }}>{g.mes}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {g.itens.map((it) => (
                  <div key={it.data + it.titulo} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <span style={{ flex: 'none', marginTop: 2, fontSize: '.82rem', color: 'rgba(234,229,219,.45)', width: 70 }}>{it.data}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}><h3 style={{ margin: 0, fontSize: '1.04rem', fontWeight: 700, color: '#EAE5DB' }}>{it.titulo}</h3><TagPill tag={it.tag} /></div>
                      <p style={{ margin: 0, fontSize: '.94rem', lineHeight: 1.55, color: 'rgba(234,229,219,.62)' }}>{it.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </InstitucionalShell>
  );
}
