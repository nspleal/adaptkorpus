import InstitucionalShell from '@/components/legal/InstitucionalShell';

export const metadata = { title: 'Changelog · Evokorpus' };

// Conteúdo ILUSTRATIVO de formato — o time alimenta a lista a cada release.
// Tags SEM vermelho (vermelho = erro/segurança em todo o sistema): "Novo" = Pulso sólido;
// "Melhoria"/"Correção" = pílula Bone neutra.
type Tag = 'Novo' | 'Melhoria' | 'Correção';
const GRUPOS: { mes: string; itens: { data: string; titulo: string; tag: Tag; desc: string }[] }[] = [
  {
    mes: 'Junho 2026',
    itens: [
      { data: '28 jun', titulo: 'Trocas de alimentos mais rápidas', tag: 'Melhoria', desc: 'Buscar e substituir um alimento do cardápio ficou mais direto.' },
      { data: '14 jun', titulo: 'Novo painel da semana', tag: 'Novo', desc: 'Veja seus dias de treino e de descanso em um único lugar.' },
    ],
  },
  {
    mes: 'Maio 2026',
    itens: [
      { data: '22 mai', titulo: 'Correção no cálculo de macros', tag: 'Correção', desc: 'Ajustamos um arredondamento que afetava os totais de proteína.' },
      { data: '05 mai', titulo: 'Preferências alimentares', tag: 'Novo', desc: 'Agora você marca alergias e alimentos que não gosta direto no perfil.' },
    ],
  },
  {
    mes: 'Abril 2026',
    itens: [
      { data: '10 abr', titulo: 'Melhorias de performance', tag: 'Melhoria', desc: 'O app abre mais rápido em conexões lentas.' },
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
          <span style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.45)', border: '1px solid rgba(234,229,219,.18)', borderRadius: 999, padding: '6px 14px', whiteSpace: 'nowrap' }}>Exemplos ilustrativos de formato</span>
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
