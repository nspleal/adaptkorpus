'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { CardapioItem } from '@/lib/engine';
import type { Food, GrupoAlimentar } from '@/lib/data/types';
import { EmptyCard, estiloBotaoPrimario } from '@/components/estados/ui';

/**
 * Lista de compras — porte fiel do protótipo V2 (.dc.html).
 * Gerada a partir do CARDÁPIO REAL: soma os ingredientes de cada prato (TACO ×
 * gramas × escala) ao longo do período escolhido, agrupando por grupo alimentar.
 * Determinística: mesmo cardápio + período → mesma lista. Sem IA.
 *
 * 🔒 O CHECKBOX É LOCAL POR DECISÃO, não por limitação (handoff §TODO de dev): a lista é
 * efêmera e não vale o custo de sincronizar. Em outro aparelho ela aparece toda desmarcada —
 * é o comportamento correto, não um bug.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

const GRUPO_LABEL: Record<GrupoAlimentar, string> = {
  proteina_animal: 'Proteínas',
  leguminosa_proteina_vegetal: 'Leguminosas e proteínas vegetais',
  verdura_legume: 'Verduras e legumes',
  fruta: 'Frutas',
  grao_cereal_tuberculo: 'Grãos, cereais e tubérculos',
  gordura: 'Gorduras',
  laticinio: 'Laticínios',
};
const GRUPO_ORDEM: GrupoAlimentar[] = ['proteina_animal', 'leguminosa_proteina_vegetal', 'laticinio', 'grao_cereal_tuberculo', 'verdura_legume', 'fruta', 'gordura'];

function fmtQty(g: number): string {
  const total = Math.round(g);
  if (total >= 1000) return `${(total / 1000).toFixed(total % 1000 === 0 ? 0 : 1)} kg`;
  return `${total} g`;
}

/** Nome que o usuário lê = rótulo amigável do cofre (rotulos-amigaveis-alimentos-adaptkorpus);
 *  o nome clínico TACO fica como proveniência na base. */
const rotulo = (f: Food): string => f.rotuloAmigavel ?? f.nome;

export default function ListaCompras({ itens, foodsById, onVoltar }: {
  itens: CardapioItem[];
  foodsById: Map<string, Food>;
  onVoltar: () => void;
}) {
  const [dias, setDias] = useState(7);
  const [comprado, setComprado] = useState<Record<string, boolean>>({});

  const grupos = useMemo(() => {
    const agg = new Map<string, { food: Food; gramas: number }>();
    for (const item of itens) {
      for (const ing of item.prato.itens) {
        const food = foodsById.get(ing.alimentoId);
        if (!food) continue;
        const g = ing.gramas * item.escala * dias;
        const prev = agg.get(ing.alimentoId);
        if (prev) prev.gramas += g;
        else agg.set(ing.alimentoId, { food, gramas: g });
      }
    }
    const porGrupo = new Map<GrupoAlimentar, { food: Food; gramas: number }[]>();
    for (const v of agg.values()) {
      const arr = porGrupo.get(v.food.grupo) ?? [];
      arr.push(v);
      porGrupo.set(v.food.grupo, arr);
    }
    return GRUPO_ORDEM
      .filter((g) => porGrupo.has(g))
      .map((g) => ({ grupo: g, itens: porGrupo.get(g)!.sort((a, b) => rotulo(a.food).localeCompare(rotulo(b.food), 'pt-BR')) }));
  }, [itens, foodsById, dias]);

  const total = grupos.reduce((n, g) => n + g.itens.length, 0);
  const checados = Object.values(comprado).filter(Boolean).length;
  const toggle = (id: string) => setComprado((p) => ({ ...p, [id]: !p[id] }));

  /**
   * Exportar (botão do header, design §Lista de compras): baixa um .txt com a lista
   * agrupada. Tudo local — sem rede, sem serviço externo, funciona offline no PWA.
   */
  function exportar() {
    const linhas = [`Lista de compras — ${dias} dias`, ''];
    for (const g of grupos) {
      linhas.push(GRUPO_LABEL[g.grupo].toUpperCase());
      for (const it of g.itens) linhas.push(`  [ ] ${rotulo(it.food)} — ${fmtQty(it.gramas)}`);
      linhas.push('');
    }
    linhas.push('As quantidades somam o que o seu cardápio pede no período.');
    const blob = new Blob([linhas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lista-de-compras-${dias}-dias.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const diasOpts = [{ d: 3, t: '3 dias' }, { d: 7, t: '7 dias' }, { d: 14, t: '14 dias' }];

  return (
    <div style={{ animation: `evkPop .45s ${EASE}` }}>
      <button onClick={onVoltar} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: 'rgba(234,229,219,.6)', fontWeight: 600, fontSize: '.88rem', padding: 0, marginBottom: 14, cursor: 'pointer' }} className="evk-foot-link"><span style={{ fontSize: '1.1rem' }}>←</span> Voltar para Dieta</button>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em' }}>Lista de compras</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.55)' }} aria-live="polite">{checados} de {total} comprados</span>
          {total > 0 && (
            <button onClick={exportar} className="evk-troca" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.82)', fontWeight: 600, fontSize: '.86rem', padding: '9px 15px', borderRadius: 11, cursor: 'pointer' }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3v12M8 11l4 4 4-4" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" /></svg>
              Exportar
            </button>
          )}
        </div>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: '.9rem', color: 'rgba(234,229,219,.55)' }}>Gerada a partir do seu cardápio, somando os ingredientes do período.</p>

      {total === 0 ? (
        <EmptyCard
          variante="neon"
          icone={<svg width={34} height={34} viewBox="0 0 24 24" fill="none"><circle cx={9.5} cy={19.5} r={1.4} stroke="#EAE5DB" strokeWidth={1.6} /><circle cx={17} cy={19.5} r={1.4} stroke="#EAE5DB" strokeWidth={1.6} /><path d="M3 4h2.3l2 11h10l2-7.6H6.3" stroke="#EAE5DB" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M12.4 8.2v3.2M10.8 9.8h3.2" stroke="#BDFF00" strokeWidth={1.6} strokeLinecap="round" /></svg>}
          titulo="Sua lista de compras está vazia."
          apoio="Gere a lista a partir do seu cardápio."
        >
          <button onClick={onVoltar} className="hov-btn" style={estiloBotaoPrimario}>Ver dieta</button>
        </EmptyCard>
      ) : (
      <>
      {/* 🔒 Design §Acessibilidade: "Período 3/7/14 dias" = `radiogroup`, com `aria-checked`
          e setas navegando. Era `div` + onClick — sem papel, sem teclado. */}
      <div role="radiogroup" aria-label="Período da lista" style={{ display: 'flex', gap: 7, marginBottom: 24 }}>
        {diasOpts.map((o, i) => {
          const on = dias === o.d;
          return (
            <button
              key={o.d}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setDias(o.d)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                const passo = e.key === 'ArrowRight' ? 1 : -1;
                const prox = diasOpts[(i + passo + diasOpts.length) % diasOpts.length]!;
                setDias(prox.d);
                const alvo = e.currentTarget.parentElement?.querySelectorAll('button')[diasOpts.indexOf(prox)];
                (alvo as HTMLElement | undefined)?.focus();
              }}
              style={{ minHeight: 44, cursor: 'pointer', padding: '9px 16px', borderRadius: 11, fontWeight: on ? 700 : 600, fontSize: '.9rem', transition: 'all .25s ease', border: `1px solid ${on ? '#BDFF00' : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.1)' : 'rgba(234,229,219,.03)', color: on ? '#BDFF00' : 'rgba(234,229,219,.62)' }}
            >{o.t}</button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {grupos.map((g) => (
          <div key={g.grupo}>
            <div style={{ fontSize: '.78rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#BDFF00', marginBottom: 10 }}>{GRUPO_LABEL[g.grupo]}</div>
            <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: '4px 16px' }}>
              {g.itens.map((it, i) => {
                const checked = !!comprado[it.food.id];
                const risco: CSSProperties = checked ? { opacity: 0.45, textDecoration: 'line-through' } : {};
                return (
                  <button
                    key={it.food.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(it.food.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 44, padding: '12px 0', background: 'none', border: 'none', borderBottom: i === g.itens.length - 1 ? 'none' : '1px solid rgba(234,229,219,.06)', color: '#EAE5DB', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span aria-hidden style={{ width: 24, height: 24, minWidth: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s ease', border: `1px solid ${checked ? '#BDFF00' : 'rgba(234,229,219,.25)'}`, background: checked ? '#BDFF00' : 'transparent' }}>{checked && <svg width={13} height={13} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#0D2818" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
                    <span style={{ flex: 1, fontSize: '.95rem', ...risco }}>{rotulo(it.food)}</span>
                    <span style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.55)', ...risco }}>{fmtQty(it.gramas)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '20px 2px 0', fontSize: '.85rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.55 }}>As quantidades somam o que o seu cardápio pede no período. Trocas feitas nas refeições já entram na conta.</p>
      </>
      )}
    </div>
  );
}
