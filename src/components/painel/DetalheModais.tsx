'use client';

import { type CSSProperties, type ReactNode } from 'react';
import type { CardapioItem } from '@/lib/engine';
import type { Alergeno, Exercise, Food } from '@/lib/data/types';
import type { ResumoSessao } from './SessaoTreino';
import { DESCANSO_PRATO_DIAS } from '@/lib/rotacao-pratos';

/**
 * Modais de detalhe — porte fiel do protótipo V2 (.dc.html): detalhe de prato e
 * detalhe de exercício. Tudo deriva de dados REAIS curados (TACO / biblioteca de
 * exercícios). Onde o protótipo previa conteúdo ainda não modelado (modo de preparo,
 * erros comuns), mostramos o fallback honesto "em breve" — nunca inventamos.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';
const r0 = (n: number) => Math.round(n);

const PADRAO_LABEL: Record<string, string> = { empurrar: 'Empurrar', puxar: 'Puxar', agachar: 'Agachar', dobradica_quadril: 'Dobradiça de quadril', core: 'Core', cardio: 'Cardio', isolado: 'Isolado' };
const NIVEL_LABEL: Record<string, string> = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };
const TIPO_LABEL: Record<string, string> = { forca_hipertrofia: 'Força / hipertrofia', cardio: 'Cardio', pliometrico: 'Pliométrico', mobilidade: 'Mobilidade' };
const ALERGENO_LABEL: Record<Alergeno, string> = { origem_animal: 'Origem animal', carne: 'Carne', gluten: 'Glúten', lactose: 'Lactose', ovo: 'Ovo', amendoim: 'Amendoim', castanhas: 'Castanhas', gergelim: 'Gergelim', coco: 'Coco', soja: 'Soja', peixe_frutos_do_mar: 'Peixe / frutos do mar' };
const REFEICAO_LABEL: Record<string, string> = { cafe: 'Café', almoco: 'Almoço', jantar: 'Jantar', lanche: 'Lanche' };

function Shell({ children, onClose, kicker }: { children: ReactNode; onClose: () => void; kicker: string }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 218, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: '1px solid rgba(234,229,219,.14)', borderRadius: 22, padding: 24, boxShadow: '0 40px 90px -30px rgba(0,0,0,.8)', animation: `evkPop .3s ${EASE}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00' }}>{kicker}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', padding: 0, marginTop: -4 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const secCap: CSSProperties = { fontSize: '.8rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 10 };

export function DetalheExercicio({ ex, onFechar, onTrocar }: { ex: Exercise; onFechar: () => void; onTrocar: () => void }) {
  return (
    <Shell onClose={onFechar} kicker="Detalhe do exercício">
      <div style={{ position: 'relative', height: 150, borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(160deg, rgba(22,163,74,.14), rgba(15,15,14,.6))', border: '1px solid rgba(234,229,219,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <svg viewBox="0 0 200 110" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}><path d="M16 96 Q70 84 110 52 T188 16" stroke="rgba(189,255,0,.45)" strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray={600} strokeDashoffset={600} style={{ animation: `evkDraw 2.4s cubic-bezier(.16,.84,.3,1) infinite` }} /></svg>
        <div style={{ position: 'relative', textAlign: 'center' }}><div style={{ width: 42, height: 42, margin: '0 auto 7px', borderRadius: 12, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={22} height={22} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={5} r={2.4} stroke="#BDFF00" strokeWidth={1.8} /><path d="M12 8v6M12 11l-5 3M12 11l5 3M12 14l-3 6M12 14l3 6" stroke="#BDFF00" strokeWidth={1.8} strokeLinecap="round" /></svg></div><div style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.5)' }}>Demonstração faceless · em breve</div></div>
      </div>
      <h2 style={{ margin: '0 0 14px', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-.02em' }}>{ex.nomePt}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 16px', marginBottom: 20 }}>
        <Campo k="Padrão" v={PADRAO_LABEL[ex.padraoMovimento] ?? ex.padraoMovimento} />
        <Campo k="Nível" v={NIVEL_LABEL[ex.nivel] ?? ex.nivel} />
        <Campo k="Tipo" v={TIPO_LABEL[ex.tipo] ?? ex.tipo} />
        <Campo k="Equipamento" v={ex.equipamentoDetalhe ?? '—'} />
        <div style={{ padding: '9px 0', gridColumn: '1 / -1' }}><div style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.45)', marginBottom: 2 }}>Músculos trabalhados</div><div style={{ fontSize: '.9rem', fontWeight: 600 }}>{ex.grupoMuscular}</div></div>
      </div>
      <div style={secCap}>Como fazer</div>
      <p style={{ margin: '0 0 22px', fontSize: '.92rem', color: 'rgba(234,229,219,.82)', lineHeight: 1.55 }}>{ex.comoFazer}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onTrocar} className="evk-troca" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '.94rem', padding: 13, borderRadius: 12, cursor: 'pointer' }}><svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M4 7h12l-3-3M20 17H8l3 3" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>Trocar exercício</button>
        <button onClick={onFechar} className="hov-btn" style={{ flex: 1, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.94rem', padding: 13, border: 'none', borderRadius: 12, cursor: 'pointer' }}>Voltar</button>
      </div>
    </Shell>
  );
}

export function DetalhePrato({ item, foodsById, onFechar, onTrocar, onPorcao, onCansei }: { item: CardapioItem; foodsById: Map<string, Food>; onFechar: () => void; onTrocar: () => void; onPorcao: () => void; onCansei: () => void }) {
  const m = item.macros;
  const alergenos = item.prato.contemAlergenos ?? [];
  const ingredientes = item.prato.itens.map((it) => {
    const f = foodsById.get(it.alimentoId);
    return { nome: f?.nome ?? it.alimentoId, qtd: `${r0(it.gramas * item.escala)} g` };
  });
  return (
    <Shell onClose={onFechar} kicker={REFEICAO_LABEL[item.refeicao] ?? 'Prato'}>
      <div style={{ position: 'relative', height: 140, borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(160deg, rgba(22,163,74,.12), rgba(15,15,14,.6))', border: '1px solid rgba(234,229,219,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ textAlign: 'center' }}><div style={{ width: 42, height: 42, margin: '0 auto 7px', borderRadius: 12, background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={22} height={22} viewBox="0 0 24 24" fill="none"><path d="M6 3v8a2 2 0 002 2v8M6 3v4M9 3v4M16 3c-1.5 0-2 2-2 5s.5 4 2 4v9" stroke="#BDFF00" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg></div><div style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.5)' }}>Imagem do prato · em breve</div></div>
      </div>
      <h2 style={{ margin: '0 0 14px', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-.02em' }}>{item.prato.nome}</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
        <div><div style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.5)', marginBottom: 1 }}>Estimativa de referência</div><div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}><span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#BDFF00', letterSpacing: '-.02em' }}>{r0(m.kcal)}</span><span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.55)' }}>kcal</span></div></div>
        <div style={{ display: 'flex', gap: 16, marginLeft: 'auto' }}>
          {([['Prot', m.proteinaG], ['Carb', m.carboidratoG], ['Gord', m.gorduraG]] as const).map(([l, g]) => <div key={l}><div style={{ fontSize: '.72rem', color: 'rgba(234,229,219,.5)' }}>{l}</div><div style={{ fontWeight: 700, fontSize: '.98rem' }}>{r0(g)} g</div></div>)}
        </div>
      </div>

      {alergenos.length > 0 && (<>
        <div style={secCap}>Alérgenos</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {alergenos.map((a) => <span key={a} style={{ fontSize: '.82rem', fontWeight: 600, color: '#E5484D', background: 'rgba(229,72,77,.12)', border: '1px solid rgba(229,72,77,.35)', borderRadius: 999, padding: '5px 12px' }}>{ALERGENO_LABEL[a] ?? a}</span>)}
        </div>
      </>)}

      <div style={secCap}>Ingredientes</div>
      <div style={{ marginBottom: 18 }}>
        {ingredientes.map((ig, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(234,229,219,.07)' }}><span style={{ fontSize: '.92rem', color: 'rgba(234,229,219,.85)' }}>{ig.nome}</span><span style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.55)' }}>{ig.qtd}</span></div>)}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(234,229,219,.03)', border: '1px dashed rgba(234,229,219,.16)', borderRadius: 14, padding: 16, marginBottom: 18 }}>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx={12} cy={12} r={9} stroke="rgba(234,229,219,.5)" strokeWidth={1.7} /><path d="M12 7v5l3 2" stroke="rgba(234,229,219,.5)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div><div style={{ fontWeight: 600, fontSize: '.92rem', marginBottom: 2 }}>Modo de preparo em breve</div><div style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>Este prato ainda está sendo detalhado na nossa base de alimentos.</div></div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <button onClick={onTrocar} className="evk-troca" style={{ flex: 1, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '.92rem', padding: 12, borderRadius: 12, cursor: 'pointer' }}>Trocar prato</button>
        <button onClick={onPorcao} className="evk-troca" style={{ flex: 1, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '.92rem', padding: 12, borderRadius: 12, cursor: 'pointer' }}>Editar porção</button>
      </div>
      {/* "Cansei deste prato" — descanso na rotação (cofre §Variedade): tira da rotação por 21
          dias, com retorno automático. NÃO é "não curto" (nível do alimento) — é gosto de receita. */}
      <button onClick={onCansei} className="evk-troca" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'none', border: '1px solid rgba(234,229,219,.14)', color: 'rgba(234,229,219,.72)', fontWeight: 600, fontSize: '.9rem', padding: 12, borderRadius: 12, cursor: 'pointer' }}>
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M4 8h11a4 4 0 010 8h-1M4 8v9a1 1 0 001 1h8M7 4v1.5M10 4v1.5M13 4v1.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
        Cansei deste prato
      </button>
      <p style={{ margin: '9px 0 0', textAlign: 'center', fontSize: '.76rem', color: 'rgba(234,229,219,.45)' }}>Descansa da rotação por {DESCANSO_PRATO_DIAS} dias e volta sozinho.</p>
      <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: '.78rem', color: 'rgba(234,229,219,.4)' }}>Valores e alimentos da base TACO (NEPA/UNICAMP).</p>
    </Shell>
  );
}

const FB_LABEL: Record<string, string> = { facil: 'Fácil', na_medida: 'Na medida', dificil: 'Difícil' };

export function DetalheSessao({ sessao, rotulo, onFechar }: { sessao: ResumoSessao & { n: number }; rotulo: string; onFechar: () => void }) {
  const fbs = sessao.exercicios.map((e) => e.fb).filter(Boolean) as string[];
  const fbResumo = fbs.length ? (FB_LABEL[fbs.sort((a, c) => fbs.filter((x) => x === c).length - fbs.filter((x) => x === a).length)[0]!] ?? '—') : '—';
  return (
    <Shell onClose={onFechar} kicker={rotulo}>
      <h2 style={{ margin: '0 0 14px', fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-.02em' }}>{sessao.dia}</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <span style={{ fontSize: '.82rem', fontWeight: 600, color: '#BDFF00', background: 'rgba(189,255,0,.1)', borderRadius: 8, padding: '6px 11px' }}>Volume {sessao.volumeKg.toLocaleString('pt-BR')} kg</span>
        <span style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.8)', background: 'rgba(234,229,219,.06)', borderRadius: 8, padding: '6px 11px' }}>{sessao.series} séries</span>
        <span style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.8)', background: 'rgba(234,229,219,.06)', borderRadius: 8, padding: '6px 11px' }}>Como foi: {fbResumo}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sessao.exercicios.map((e, i) => (
          <div key={i} style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 10 }}>{e.nome}</div>
            {e.sets.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {e.sets.map((s, si) => (
                  <span key={si} style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.82)', background: 'rgba(234,229,219,.06)', borderRadius: 8, padding: '5px 10px' }}>
                    <span style={{ color: 'rgba(234,229,219,.45)', fontWeight: 700 }}>{si + 1}</span>&nbsp; {s.reps || '—'} reps{e.loaded && s.kg ? ` × ${s.kg} kg` : ''}
                  </span>
                ))}
              </div>
            ) : <div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>Nenhuma série registrada.</div>}
          </div>
        ))}
      </div>
      <button onClick={onFechar} className="hov-btn" style={{ width: '100%', marginTop: 18, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.96rem', padding: 13, border: 'none', borderRadius: 12, cursor: 'pointer' }}>Fechar</button>
    </Shell>
  );
}

function Campo({ k, v }: { k: string; v: string }) {
  return <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(234,229,219,.07)' }}><div style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.45)', marginBottom: 2 }}>{k}</div><div style={{ fontSize: '.9rem', fontWeight: 600 }}>{v}</div></div>;
}
