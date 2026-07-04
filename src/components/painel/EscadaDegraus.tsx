'use client';

import { useState, type CSSProperties } from 'react';
import { escadaComNomes } from '@/lib/engine';
import type { Exercise } from '@/lib/data/types';

/**
 * Escada de dificuldade — componentes visuais (porte fiel do protótipo V8.3
 * `Evokorpus Escada de Dificuldade.dc.html`; estilos verbatim do design):
 *  - <EscadaPill>: indicador "Degrau X de Y" (dots Folha/Pulso/translúcido) que expande
 *    a lista da escada em LEITURA (não é seletor — a troca real é o hint/calibração).
 *  - <HintVariacao>: cartão de sugestão da sessão guiada (subida/descida — mesma família,
 *    só a seta inverte; NUNCA vermelho: descer não é falha). Com "Assumir este degrau"
 *    (B3, DF 2026-07-04 — adoção explícita, nunca automática) e "Ver variação" (leitura).
 * Vocabulário dos dots: mais fáceis = Folha #16A34A (dominados) · atual = contorno+glow
 * Pulso #BDFF00 · mais difíceis = Bone translúcido.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

function dotCompacto(i: number, cur: number): CSSProperties {
  if (i < cur) return { width: 8, height: 8, borderRadius: '50%', background: '#16A34A' };
  if (i === cur) return { width: 11, height: 11, borderRadius: '50%', background: 'rgba(189,255,0,.2)', border: '1.5px solid #BDFF00', boxShadow: '0 0 8px -1px rgba(189,255,0,.7)' };
  return { width: 8, height: 8, borderRadius: '50%', background: 'rgba(234,229,219,.16)' };
}
function dotGrande(i: number, cur: number): CSSProperties {
  if (i < cur) return { width: 12, minWidth: 12, height: 12, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 3px rgba(22,163,74,.14)' };
  if (i === cur) return { width: 14, minWidth: 14, height: 14, borderRadius: '50%', background: 'rgba(189,255,0,.2)', border: '2px solid #BDFF00', boxShadow: '0 0 0 4px rgba(189,255,0,.12), 0 0 14px -1px rgba(189,255,0,.6)' };
  return { width: 11, minWidth: 11, height: 11, borderRadius: '50%', background: 'rgba(234,229,219,.14)' };
}
function nomeStyle(i: number, cur: number): CSSProperties {
  if (i === cur) return { fontSize: '.92rem', fontWeight: 700, color: '#BDFF00' };
  if (i < cur) return { fontSize: '.92rem', fontWeight: 500, color: 'rgba(234,229,219,.85)' };
  return { fontSize: '.92rem', fontWeight: 500, color: 'rgba(234,229,219,.45)' };
}

/**
 * Indicador "Degrau X de Y" + lista expandida (read-only). Renderiza null quando o
 * exercício está fora da malha de escadas (com carga / one-off) — regra do cofre.
 */
export function EscadaPill({ exercicioId, exercicioPorId, margemBaixo = 0 }: {
  exercicioId: string;
  exercicioPorId: (id: string) => Exercise | undefined;
  margemBaixo?: number;
}) {
  const [expandido, setExpandido] = useState(false);
  const escada = escadaComNomes(exercicioId, exercicioPorId);
  if (!escada) return null;
  const cur = escada.degrau - 1;

  return (
    <div style={{ marginBottom: margemBaixo }}>
      <button
        onClick={(e) => { e.stopPropagation(); setExpandido((v) => !v); }}
        aria-expanded={expandido}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 999, padding: '6px 10px 6px 12px', cursor: 'pointer', transition: 'border-color .2s ease', minHeight: 32 }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {escada.degraus.map((d, i) => <span key={d.idRepresentativo} style={dotCompacto(i, cur)} />)}
        </span>
        <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'rgba(234,229,219,.72)', whiteSpace: 'nowrap' }}>Degrau {escada.degrau} de {escada.total}</span>
        <span style={{ display: 'inline-flex', transition: 'transform .25s ease', transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="rgba(234,229,219,.5)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>
      {expandido && (
        <div style={{ margin: '8px 0 4px', background: 'rgba(13,40,24,.35)', border: '1px solid rgba(234,229,219,.08)', borderRadius: 14, padding: 6, animation: `evkExpand .28s ${EASE}` }}>
          {escada.degraus.map((d, i) => (
            <div key={d.idRepresentativo} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 11px', borderRadius: 10, ...(i === cur ? { background: 'rgba(189,255,0,.05)' } : {}) }}>
              <span style={{ width: 15, minWidth: 15, fontSize: '.72rem', fontWeight: 700, color: 'rgba(234,229,219,.3)', textAlign: 'center' }}>{i + 1}</span>
              <span style={dotGrande(i, cur)} />
              <span style={nomeStyle(i, cur)}>{d.nome}</span>
              {i === cur && <span style={{ marginLeft: 'auto', fontSize: '.62rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#BDFF00', background: 'rgba(189,255,0,.1)', borderRadius: 6, padding: '2px 8px' }}>Atual</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Cartão de sugestão da sessão guiada (V8.3 Estados 4/5). Subida e descida são a MESMA
 * família visual — só a seta inverte (descer não é falha; nunca Alerta). O app sugere,
 * a pessoa decide: "Assumir este degrau" grava a adoção explícita (B3), "Ver variação"
 * abre o detalhe em leitura — nada troca sozinho.
 */
export function HintVariacao({ direcao, nomeVariacao, onVerVariacao, onAssumir }: {
  direcao: 'sobe' | 'desce';
  nomeVariacao: string;
  onVerVariacao: () => void;
  onAssumir: () => void;
}) {
  return (
    <div style={{ border: '1px solid rgba(234,229,219,.14)', background: 'rgba(234,229,219,.03)', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 13, alignItems: 'flex-start', marginBottom: 14, animation: `evkPop .3s ${EASE}` }}>
      <span style={{ width: 34, height: 34, minWidth: 34, borderRadius: 10, background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {direcao === 'sobe'
          ? <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M12 19V5M6 11l6-6 6 6" stroke="#BDFF00" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
          : <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M6 13l6 6 6-6" stroke="#BDFF00" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.66rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 4 }}>Sugestão</div>
        <div style={{ fontSize: '.92rem', color: 'rgba(234,229,219,.88)', lineHeight: 1.45 }}>
          {direcao === 'sobe'
            ? <>Quando ficar fácil, o próximo degrau é <strong style={{ fontWeight: 700 }}>{nomeVariacao}</strong>.</>
            : <>Sentiu difícil demais duas vezes — que tal um degrau mais leve, <strong style={{ fontWeight: 700 }}>{nomeVariacao}</strong>?</>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 10 }}>
          {/* B3 (DF 2026-07-04): adoção EXPLÍCITA — grava evento; nunca automática. */}
          <button onClick={onAssumir} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(189,255,0,.08)', border: '1px solid rgba(189,255,0,.4)', color: '#BDFF00', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer', padding: '8px 13px', borderRadius: 10 }}>
            Assumir este degrau
          </button>
          <button onClick={onVerVariacao} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#BDFF00', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer', padding: 0 }}>
            Ver variação<svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
