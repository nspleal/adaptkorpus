'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import FaqAccordion from './FaqAccordion';

/**
 * FAQ completo com busca (porte fiel do V6.1). A busca filtra por substring normalizada
 * (sem acento/caixa) sobre pergunta+resposta, client-side. Uma categoria sem resultado
 * MANTÉM a seção e a âncora do sumário (nunca desmonta) para não quebrar o scroll-spy —
 * mostra "Nenhuma pergunta encontrada nesta categoria." (handoff §6).
 *
 * Nota: com ~30+ perguntas reais, a filtragem pode migrar para onde os dados morarem
 * (CMS/API) — aqui é o padrão de front-end sobre o dataset de exemplo.
 */

export interface FaqItem { q: string; a: string; note?: ReactNode }
export interface FaqCat { id: string; label: string; desc: string; items: FaqItem[] }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function FaqBusca({ categorias }: { categorias: FaqCat[] }) {
  const [query, setQuery] = useState('');

  const filtradas = useMemo(() => {
    const nq = norm(query.trim());
    return categorias.map((cat) => ({
      cat,
      items: nq ? cat.items.filter((it) => norm(`${it.q} ${it.a}`).includes(nq)) : cat.items,
    }));
  }, [query, categorias]);

  return (
    <div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 34 }}>
        <svg width={17} height={17} viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 14, pointerEvents: 'none', color: 'rgba(234,229,219,.5)' }}><circle cx={11} cy={11} r={6.5} stroke="currentColor" strokeWidth={1.8} /><path d="M16 16l4 4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /></svg>
        <input value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" placeholder="Busque uma pergunta… (ex.: cancelar, dados, treino)" className="input-foco" style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.16)', borderRadius: 13, padding: '14px 16px 14px 42px', color: '#EAE5DB', fontSize: '.98rem', outline: 'none', transition: 'border-color .2s ease' }} />
      </div>

      {filtradas.map(({ cat, items }) => (
        <section key={cat.id} id={cat.id} data-toc-target style={{ margin: '0 0 42px', scrollMarginTop: 128 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(1.28rem,2.4vw,1.55rem)', fontWeight: 700, letterSpacing: '-.02em' }}>{cat.label}</h2>
          <p style={{ margin: '0 0 18px', fontSize: '.95em', lineHeight: 1.6, color: 'rgba(234,229,219,.6)' }}>{cat.desc}</p>
          {items.length > 0
            ? <FaqAccordion itens={items.map((it) => ({ q: it.q, a: it.note ? <>{it.a} {it.note}</> : it.a }))} />
            : <div style={{ padding: '14px 16px', fontSize: '.9rem', color: 'rgba(234,229,219,.5)' }}>Nenhuma pergunta encontrada nesta categoria.</div>}
        </section>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: '15px 17px' }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><circle cx={12} cy={12} r={9} stroke="rgba(189,255,0,.5)" strokeWidth={1.7} /><path d="M12 11v5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /><circle cx={12} cy={7.8} r={1.05} fill="#BDFF00" /></svg>
        <p style={{ margin: 0, fontSize: '.9rem', color: 'rgba(234,229,219,.66)', lineHeight: 1.5 }}>Não achou o que procurava? <Link href="/suporte" style={{ color: '#BDFF00', fontWeight: 600, borderBottom: '1px dashed rgba(189,255,0,.5)', textDecoration: 'none' }}>Fale com a gente</Link>.</p>
      </div>
    </div>
  );
}
