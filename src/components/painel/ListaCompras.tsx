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
      .map((g) => ({ grupo: g, itens: porGrupo.get(g)!.sort((a, b) => a.food.nome.localeCompare(b.food.nome, 'pt-BR')) }));
  }, [itens, foodsById, dias]);

  const total = grupos.reduce((n, g) => n + g.itens.length, 0);
  const checados = Object.values(comprado).filter(Boolean).length;
  const toggle = (id: string) => setComprado((p) => ({ ...p, [id]: !p[id] }));

  const diasOpts = [{ d: 3, t: '3 dias' }, { d: 7, t: '7 dias' }, { d: 14, t: '14 dias' }];

  return (
    <div style={{ animation: `evkPop .45s ${EASE}` }}>
      <button onClick={onVoltar} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: 'rgba(234,229,219,.6)', fontWeight: 600, fontSize: '.88rem', padding: 0, marginBottom: 14, cursor: 'pointer' }} className="evk-foot-link"><span style={{ fontSize: '1.1rem' }}>←</span> Voltar para Dieta</button>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em' }}>Lista de compras</h2>
        <span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.55)' }}>{checados} de {total} comprados</span>
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
      <div style={{ display: 'flex', gap: 7, marginBottom: 24 }}>
        {diasOpts.map((o) => {
          const on = dias === o.d;
          return <div key={o.d} onClick={() => setDias(o.d)} style={{ cursor: 'pointer', padding: '9px 16px', borderRadius: 11, fontWeight: 600, fontSize: '.9rem', transition: 'all .25s ease', border: `1px solid ${on ? '#BDFF00' : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.1)' : 'rgba(234,229,219,.03)', color: on ? '#BDFF00' : 'rgba(234,229,219,.62)' }}>{o.t}</div>;
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
                  <div key={it.food.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i === g.itens.length - 1 ? 'none' : '1px solid rgba(234,229,219,.06)' }}>
                    <div onClick={() => toggle(it.food.id)} style={{ width: 24, height: 24, minWidth: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .2s ease', border: `1px solid ${checked ? '#BDFF00' : 'rgba(234,229,219,.25)'}`, background: checked ? '#BDFF00' : 'transparent' }}>{checked && <svg width={13} height={13} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#0D2818" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                    <span onClick={() => toggle(it.food.id)} style={{ flex: 1, fontSize: '.95rem', cursor: 'pointer', ...risco }}>{it.food.nome}</span>
                    <span style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.55)', ...risco }}>{fmtQty(it.gramas)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '20px 2px 0', fontSize: '.85rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.55 }}>Quantidades estimadas a partir das porções do plano. Trocas e porções que você editar entram aqui também.</p>
      </>
      )}
    </div>
  );
}
