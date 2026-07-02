'use client';

import { useState, type CSSProperties } from 'react';
import { ORDEM_SEMANA, DIA_LABEL, type Weekday } from '@/lib/semana';
import { buscarAlimentos, nomeAlimento } from '@/lib/data/paleta-alimentos';
import type { Alergeno } from '@/lib/data/types';

/**
 * Componentes de entrada estruturada (handoff "Dias e Preferências") — porte FIEL:
 * SeletorDias (faixa Seg–Dom + contagem + nota) e PreferenciasAlimentares (bloco de alergias
 * de SEGURANÇA + busca "não curto" de PREFERÊNCIA com autocomplete sobre a paleta curada).
 * Reusados no Onboarding e no Editar perfil. Saída sempre ESTRUTURADA (weekdays / IDs).
 */

/* ---- Alérgenos (SEGURANÇA — mapeados ao filtro absoluto do motor). ---- */
const ALERGENOS_UI: { id: Alergeno; nome: string }[] = [
  { id: 'lactose', nome: 'Lactose' }, { id: 'gluten', nome: 'Glúten' }, { id: 'ovo', nome: 'Ovo' },
  { id: 'soja', nome: 'Soja' }, { id: 'amendoim', nome: 'Amendoim' }, { id: 'castanhas', nome: 'Castanhas' },
  { id: 'gergelim', nome: 'Gergelim' }, { id: 'coco', nome: 'Coco' }, { id: 'peixe_frutos_do_mar', nome: 'Peixe / frutos do mar' },
];

const Escudo = ({ cor = '#E5484D', size = 18 }: { cor?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3z" stroke={cor} strokeWidth={1.7} strokeLinejoin="round" />{size > 15 && <path d="M9.5 12l1.8 1.8 3.4-3.6" stroke={cor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}</svg>
);
const InfoNeon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx={12} cy={12} r={9} stroke="rgba(189,255,0,.5)" strokeWidth={1.7} /><path d="M12 11v5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /><circle cx={12} cy={7.8} r={1.05} fill="#BDFF00" /></svg>
);
const InfoBone = () => (
  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx={12} cy={12} r={9} stroke="rgba(234,229,219,.35)" strokeWidth={1.6} /><path d="M12 11v5" stroke="rgba(234,229,219,.7)" strokeWidth={1.9} strokeLinecap="round" /><circle cx={12} cy={7.9} r={1} fill="rgba(234,229,219,.7)" /></svg>
);

/* ════════════════════ Seletor de dias (Seg–Dom) ════════════════════ */

export function SeletorDias({ treinoDias, onToggle, contagemFont = '1.7rem', stripMarginTop = 24 }: {
  treinoDias: Weekday[]; onToggle: (w: Weekday) => void; contagemFont?: string; stripMarginTop?: number;
}) {
  const sel = new Set(treinoDias);
  const trainCount = treinoDias.length;
  const restCount = 7 - trainCount;
  const trainWord = trainCount === 1 ? 'dia' : 'dias';
  const restWord = restCount === 1 ? 'dia' : 'dias';
  const alvo = (on: boolean): CSSProperties => ({
    flex: '1 1 0', minWidth: 80, minHeight: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: 15, cursor: 'pointer', fontWeight: 700, transition: 'transform .16s ease, background .2s ease, border-color .2s ease, box-shadow .25s ease',
    ...(on
      ? { background: 'rgba(189,255,0,.13)', border: '1.5px solid rgba(189,255,0,.55)', color: '#BDFF00', boxShadow: '0 10px 24px -16px rgba(189,255,0,.7)' }
      : { background: 'rgba(234,229,219,.04)', border: '1.5px solid rgba(234,229,219,.13)', color: 'rgba(234,229,219,.82)' }),
  });
  let notaShow = false, notaText = '';
  if (trainCount === 0) { notaShow = true; notaText = 'Selecione ao menos um dia para treinar — os outros ficam como descanso.'; }
  else if (trainCount === 7) { notaShow = true; notaText = 'Recomendamos manter ao menos um dia de descanso — é quando o corpo se recupera. Você pode seguir assim mesmo se quiser.'; }

  return (
    <div>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: stripMarginTop }}>
        {ORDEM_SEMANA.map((w) => {
          const on = sel.has(w);
          return (
            <button key={w} onClick={() => onToggle(w)} className="evk-dia" style={alvo(on)}>
              <span style={{ fontSize: '1.04rem' }}>{DIA_LABEL[w].abbr}</span>
              <span style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: on ? '#BDFF00' : 'rgba(234,229,219,.4)' }}>{on ? 'Treino' : 'Descanso'}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 15, flexWrap: 'wrap', marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: contagemFont, fontWeight: 800, letterSpacing: '-.02em', color: '#BDFF00' }}>{trainCount}</span><span style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.7)' }}>{trainWord} de treino</span></div>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(234,229,219,.3)' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: contagemFont, fontWeight: 800, letterSpacing: '-.02em', color: 'rgba(234,229,219,.85)' }}>{restCount}</span><span style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.55)' }}>{restWord} de descanso</span></div>
      </div>
      {notaShow && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.14)' }}>
          <InfoNeon /><p style={{ margin: 0, fontSize: '.87rem', color: 'rgba(234,229,219,.72)', lineHeight: 1.5 }}>{notaText}</p>
        </div>
      )}
    </div>
  );
}

/* ════════════════════ Preferências alimentares ════════════════════ */

export function PreferenciasAlimentares({ alergias, onToggleAlergia, naoCurto, onAddFood, onRemoveFood, contexto }: {
  alergias: Alergeno[]; onToggleAlergia: (a: Alergeno) => void;
  naoCurto: string[]; onAddFood: (id: string) => void; onRemoveFood: (id: string) => void;
  contexto: 'onboarding' | 'editar';
}) {
  const alergiasSet = new Set(alergias);
  const pill = (on: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 999, fontSize: '.88rem', cursor: 'pointer', transition: 'all .18s ease',
    ...(on
      ? { fontWeight: 700, background: 'rgba(229,72,77,.14)', border: '1.5px solid rgba(229,72,77,.6)', color: '#E5484D' }
      : { fontWeight: 600, background: 'rgba(234,229,219,.04)', border: '1.5px solid rgba(234,229,219,.16)', color: 'rgba(234,229,219,.7)' }),
  });
  const notaSep = contexto === 'onboarding'
    ? <><strong style={{ color: 'rgba(234,229,219,.82)', fontWeight: 600 }}>Alergias são absolutas</strong> — a gente nunca passa por cima. Já o <strong style={{ color: 'rgba(234,229,219,.82)', fontWeight: 600 }}>&quot;não gosto&quot;</strong> abaixo a gente relaxa se faltar opção no cardápio.</>
    : <><strong style={{ color: 'rgba(234,229,219,.82)', fontWeight: 600 }}>Alergias são absolutas</strong>; já o <strong style={{ color: 'rgba(234,229,219,.82)', fontWeight: 600 }}>&quot;não gosto&quot;</strong> a gente relaxa se faltar opção no cardápio.</>;

  return (
    <div>
      {/* ALERGIAS (segurança) */}
      <div style={{ background: 'rgba(229,72,77,.05)', border: '1px solid rgba(229,72,77,.24)', borderRadius: 16, padding: '18px 19px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '1.02rem', fontWeight: 700 }}><Escudo />Alergias e intolerâncias</span>
          <span style={{ fontSize: '.66rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#E5484D', background: 'rgba(229,72,77,.12)', border: '1px solid rgba(229,72,77,.35)', borderRadius: 999, padding: '3px 9px' }}>Segurança</span>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '.9rem', color: 'rgba(234,229,219,.66)', lineHeight: 1.5 }}>Isto é <strong style={{ color: '#EAE5DB', fontWeight: 700 }}>absoluto</strong> — nunca vamos sugerir esses alimentos.{contexto === 'onboarding' ? ' Marque o que se aplica a você.' : ''}</p>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          {ALERGENOS_UI.map((a) => { const on = alergiasSet.has(a.id); return (
            <button key={a.id} onClick={() => onToggleAlergia(a.id)} style={pill(on)}><Escudo cor="currentColor" size={13} />{a.nome}</button>
          ); })}
        </div>
      </div>

      {/* separador */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '15px 2px' }}>
        <InfoBone /><p style={{ margin: 0, fontSize: '.84rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>{notaSep}</p>
      </div>

      {/* NÃO CURTO (preferência) */}
      <div style={{ background: contexto === 'editar' ? 'rgba(234,229,219,.025)' : 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, padding: '18px 19px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: '1.02rem', fontWeight: 700 }}>Alimentos que você não gosta</span>
          <span style={{ fontSize: '.66rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.72)', background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.18)', borderRadius: 999, padding: '3px 9px' }}>Preferência</span>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '.9rem', color: 'rgba(234,229,219,.66)', lineHeight: 1.5 }}>{contexto === 'onboarding' ? <>A gente evita quando dá — é <strong style={{ color: '#EAE5DB', fontWeight: 700 }}>preferência</strong>, não alergia. Tudo opcional.</> : 'A gente evita quando dá. Busque e adicione — remova quando quiser.'}</p>
        <BuscaNaoCurto naoCurto={naoCurto} onAdd={onAddFood} onRemove={onRemoveFood} />
        {/* Cofre §Variedade (DF 2026-07-01): prato ≠ ingrediente. "Cansei deste prato" é do
            nível do PRATO e NÃO alimenta o "não curto" (nível do alimento) — sinais separados. */}
        {contexto === 'editar' && <p style={{ margin: '13px 2px 0', fontSize: '.82rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.5 }}>Isto é sobre <strong style={{ color: 'rgba(234,229,219,.72)', fontWeight: 600 }}>ingredientes</strong>. Cansou de uma receita específica? Use <strong style={{ color: 'rgba(234,229,219,.72)', fontWeight: 600 }}>&quot;Cansei deste prato&quot;</strong> no card do prato (aba Dieta) — ele descansa da rotação e volta sozinho.</p>}
      </div>
    </div>
  );
}

/* Campo de busca + sugestões + chips + estado vazio. */
function BuscaNaoCurto({ naoCurto, onAdd, onRemove }: { naoCurto: string[]; onAdd: (id: string) => void; onRemove: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim();
  const sugestoes = q.length >= 1 ? buscarAlimentos(q, naoCurto, 8) : [];
  const mostrar = q.length >= 1;
  const semResultado = mostrar && sugestoes.length === 0;
  const adicionar = (id: string) => { onAdd(id); setQuery(''); };

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 14, pointerEvents: 'none', color: 'rgba(234,229,219,.5)' }}><circle cx={11} cy={11} r={6.5} stroke="currentColor" strokeWidth={1.8} /><path d="M16 16l4 4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" placeholder="Busque um alimento (ex.: jiló, coentro, fígado)…" className="input-foco"
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(13,40,24,.55)', border: '1px solid rgba(234,229,219,.16)', borderRadius: 12, padding: '13px 14px 13px 42px', color: '#EAE5DB', fontSize: '.95rem', outline: 'none', transition: 'border-color .2s ease' }} />
        </div>
        {mostrar && (
          <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 'calc(100% + 6px)', background: '#0F0F0E', border: '1px solid rgba(234,229,219,.16)', borderRadius: 13, boxShadow: '0 24px 50px -20px rgba(0,0,0,.8)', overflow: 'hidden', maxHeight: 262, overflowY: 'auto', animation: 'evkPop .16s ease' }}>
            {sugestoes.map((s) => (
              // onMouseDown (não onClick) para adicionar antes do blur do input
              <div key={s.id} onMouseDown={(e) => { e.preventDefault(); adicionar(s.id); }} className="evk-sugestao" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 15px', cursor: 'pointer', borderBottom: '1px solid rgba(234,229,219,.05)', transition: 'background .15s ease' }}>
                <span style={{ fontSize: '.92rem', fontWeight: 600, color: '#EAE5DB' }}>{s.nome}</span>
                <span style={{ fontSize: '.73rem', color: 'rgba(234,229,219,.4)' }}>{s.grupo}</span>
              </div>
            ))}
            {semResultado && <div style={{ padding: '14px 15px', fontSize: '.88rem', color: 'rgba(234,229,219,.5)' }}>Nenhum alimento encontrado na nossa lista.</div>}
          </div>
        )}
      </div>

      {naoCurto.length > 0 ? (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 14 }}>
          {naoCurto.map((id) => (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '8px 8px 8px 14px', borderRadius: 999, fontSize: '.88rem', fontWeight: 600, background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.18)', color: '#EAE5DB', animation: 'evkPop .2s ease' }}>
              {nomeAlimento(id)}
              <button onClick={() => onRemove(id)} aria-label={`Remover ${nomeAlimento(id)}`} className="evk-chip-x" style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(234,229,219,.08)', border: 'none', color: 'rgba(234,229,219,.7)', cursor: 'pointer', fontSize: '1.05rem', lineHeight: 1, transition: 'all .15s ease' }}>×</button>
            </span>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderRadius: 12, background: 'rgba(234,229,219,.025)', border: '1px dashed rgba(234,229,219,.16)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid rgba(234,229,219,.35)', flexShrink: 0 }} /><span style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.55)' }}>Nenhum alimento marcado — tudo bem, é opcional.</span>
        </div>
      )}
    </div>
  );
}
