'use client';

import { useState, type CSSProperties } from 'react';
import type { PerfilResumo } from './Painel';
import type { NivelAtividade, NivelExperiencia, Objetivo, Sexo } from '@/lib/engine';
import type { Alergeno, EquipamentoDisp } from '@/lib/data/types';

/**
 * Editar perfil — porte fiel do protótipo V2 (.dc.html). Coleta os mesmos campos do
 * onboarding e, ao salvar, abre o modal "Recalcular plano?". A confirmação chama
 * onSalvar(novoPerfil); o Painel recalcula dieta+treino com o motor determinístico real.
 *
 * Alterar peso/objetivo/disponibilidade recalcula o plano (regra do cofre). A triagem de
 * saúde (flagsSaude) é preservada do perfil atual — não é reaberta neste formulário.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

const OBJETIVOS: { id: Objetivo; t: string; d: string }[] = [
  { id: 'emagrecimento', t: 'Emagrecer', d: 'Reduzir gordura com constância.' },
  { id: 'massa', t: 'Ganhar massa', d: 'Construir músculo de forma estruturada.' },
  { id: 'saude', t: 'Manter / Saúde', d: 'Manutenção e bem-estar no longo prazo.' },
];
const ATIVIDADES: { id: NivelAtividade; t: string; d: string }[] = [
  { id: 'sedentario', t: 'Sedentário', d: 'Pouco ou nenhum exercício' },
  { id: 'leve', t: 'Leve', d: '1–2 dias por semana' },
  { id: 'moderado', t: 'Moderado', d: '3–4 dias por semana' },
  { id: 'intenso', t: 'Intenso', d: '5–6 dias por semana' },
  { id: 'muito_intenso', t: 'Muito intenso', d: 'Treino diário / trabalho físico' },
];
const EXPERIENCIAS: { id: NivelExperiencia; t: string; d: string }[] = [
  { id: 'iniciante', t: 'Iniciante', d: 'Começando agora ou voltando.' },
  { id: 'intermediario', t: 'Intermediário', d: 'Treino há alguns meses.' },
  { id: 'avancado', t: 'Avançado', d: 'Treino consistente há anos.' },
];
const LOCAIS: { id: EquipamentoDisp; t: string; d: string }[] = [
  { id: 'nenhum', t: 'Sem equipamento', d: 'Só o peso do corpo.' },
  { id: 'casa', t: 'Em casa', d: 'Halteres, elásticos, o que tiver.' },
  { id: 'academia', t: 'Academia', d: 'Acesso completo a máquinas e pesos.' },
];
const PADROES: { id: '' | 'vegetariano' | 'vegano'; t: string; d: string }[] = [
  { id: '', t: 'Onívoro', d: 'Como de tudo.' },
  { id: 'vegetariano', t: 'Vegetariano', d: 'Sem carnes.' },
  { id: 'vegano', t: 'Vegano', d: 'Sem origem animal.' },
];
const ALERGENOS: { id: Alergeno; t: string }[] = [
  { id: 'lactose', t: 'Lactose' }, { id: 'gluten', t: 'Glúten' }, { id: 'ovo', t: 'Ovo' }, { id: 'soja', t: 'Soja' },
  { id: 'amendoim', t: 'Amendoim' }, { id: 'castanhas', t: 'Castanhas' }, { id: 'gergelim', t: 'Gergelim' }, { id: 'coco', t: 'Coco' }, { id: 'peixe_frutos_do_mar', t: 'Peixe / frutos do mar' },
];

export default function EditarPerfil({ inicial, onCancelar, onSalvar }: {
  inicial: PerfilResumo;
  onCancelar: () => void;
  onSalvar: (novo: PerfilResumo) => void;
}) {
  const [sexo, setSexo] = useState<Sexo>(inicial.sexo);
  const [idade, setIdade] = useState(String(inicial.idade));
  const [altura, setAltura] = useState(String(inicial.alturaCm));
  const [peso, setPeso] = useState(String(inicial.pesoKg));
  const [objetivo, setObjetivo] = useState<Objetivo>(inicial.objetivo);
  const [atividade, setAtividade] = useState<NivelAtividade>(inicial.nivelAtividade);
  const [experiencia, setExperiencia] = useState<NivelExperiencia>(inicial.nivelExperiencia);
  const [local, setLocal] = useState<EquipamentoDisp>(inicial.equipamento);
  const [dias, setDias] = useState(inicial.diasDisponiveis);
  const [tempo, setTempo] = useState(inicial.tempoPorSessaoMin);
  const [padrao, setPadrao] = useState<'' | 'vegetariano' | 'vegano'>(inicial.preferencia ?? '');
  const [alergias, setAlergias] = useState<Alergeno[]>(inicial.alergenos);
  const [naoGostoInput, setNaoGostoInput] = useState('');
  const [naoGosto, setNaoGosto] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState(false);

  const toggleAlergia = (a: Alergeno) => setAlergias((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  const addNaoGosto = () => { const v = naoGostoInput.trim(); if (v && !naoGosto.includes(v)) { setNaoGosto((p) => [...p, v]); setNaoGostoInput(''); } };

  const i = +idade, a = +altura, pz = +peso;
  const valido = i >= 18 && i <= 100 && a >= 100 && a <= 250 && pz >= 30 && pz <= 300;

  function salvar() {
    if (!valido) return;
    onSalvar({
      ...inicial,
      sexo, idade: i, alturaCm: a, pesoKg: pz, objetivo, nivelAtividade: atividade,
      nivelExperiencia: experiencia, equipamento: local, diasDisponiveis: dias, tempoPorSessaoMin: tempo,
      preferencia: padrao || null, alergenos: alergias,
    });
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 22px 56px', animation: `evkScreenIn .5s ${EASE}` }}>
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}><Logo size={26} /><h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em' }}>Editar perfil</h1></div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(189,255,0,.07)', border: '1px solid rgba(189,255,0,.25)', borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx={12} cy={12} r={9} stroke="#BDFF00" strokeWidth={1.7} /><path d="M12 8v5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /><circle cx={12} cy={16.2} r={1.1} fill="#BDFF00" /></svg>
          <p style={{ margin: 0, fontSize: '.9rem', color: 'rgba(234,229,219,.78)', lineHeight: 1.55 }}>Alterar <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>peso</strong>, <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>objetivo</strong> ou <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>disponibilidade</strong> recalcula seu plano.</p>
        </div>

        <div style={{ background: 'linear-gradient(168deg, rgba(15,42,26,.55), rgba(15,15,14,.6))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 22, padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 26 }}>

          <div>
            <div style={cap}>Sexo biológico</div>
            <div style={{ display: 'flex', gap: 10 }}>{(['feminino', 'masculino'] as Sexo[]).map((sx) => <div key={sx} onClick={() => setSexo(sx)} style={{ ...seg, ...(sexo === sx ? segOn : {}) }}>{sx === 'feminino' ? 'Feminino' : 'Masculino'}</div>)}</div>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {([['Idade', idade, setIdade, 'anos'], ['Altura', altura, setAltura, 'cm'], ['Peso', peso, setPeso, 'kg']] as const).map(([lb, v, set, u]) => (
              <div key={lb} style={{ flex: 1, minWidth: 120 }}>
                <div style={cap}>{lb}</div>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '0 14px' }}><input type="number" inputMode="numeric" value={v} onChange={(e) => set(e.target.value)} style={{ width: '100%', background: 'none', border: 'none', color: '#EAE5DB', fontSize: '1.1rem', fontWeight: 600, padding: '12px 0', outline: 'none' }} /><span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.45)' }}>{u}</span></div>
              </div>
            ))}
          </div>

          <CardsBloco titulo="Objetivo" opts={OBJETIVOS} sel={objetivo} onSel={setObjetivo} />
          <CardsBloco titulo="Nível de atividade" opts={ATIVIDADES} sel={atividade} onSel={setAtividade} desc />
          <CardsBloco titulo="Experiência de treino" opts={EXPERIENCIAS} sel={experiencia} onSel={setExperiencia} desc />
          <CardsBloco titulo="Local e equipamento" opts={LOCAIS} sel={local} onSel={setLocal} desc />

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 170 }}><div style={cap}>Dias por semana</div><div style={{ display: 'flex', gap: 7 }}>{[1, 2, 3, 4, 5, 6].map((d) => <div key={d} onClick={() => setDias(d)} style={{ ...seg, ...(dias === d ? segOn : {}) }}>{d}</div>)}</div></div>
            <div style={{ flex: 1, minWidth: 170 }}><div style={cap}>Tempo por sessão</div><div style={{ display: 'flex', gap: 7 }}>{[30, 45, 60, 75].map((t) => <div key={t} onClick={() => setTempo(t)} style={{ ...seg, ...(tempo === t ? segOn : {}) }}>{t === 75 ? '75+' : t}</div>)}</div></div>
          </div>

          <div>
            <div style={cap}>Padrão alimentar</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{PADROES.map((o) => <div key={o.id || 'oni'} onClick={() => setPadrao(o.id)} style={{ ...card, minWidth: 120, flex: 1, ...(padrao === o.id ? cardOn : {}) }}><div style={{ fontSize: '.98rem', fontWeight: 700 }}>{o.t}</div><div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.6)' }}>{o.d}</div></div>)}</div>
          </div>

          <div>
            <div style={{ ...cap, marginBottom: 6 }}>Alergias e intolerâncias</div>
            <p style={{ margin: '0 0 10px', fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>Regra de segurança absoluta — nunca incluímos o que estiver marcado.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>{ALERGENOS.map((o) => { const on = alergias.includes(o.id); return <div key={o.id} onClick={() => toggleAlergia(o.id)} style={{ cursor: 'pointer', padding: '8px 14px', borderRadius: 999, fontWeight: 600, fontSize: '.88rem', transition: 'all .25s ease', border: `1px solid ${on ? '#16A34A' : 'rgba(234,229,219,.18)'}`, background: on ? '#16A34A' : 'transparent', color: on ? '#EAE5DB' : 'rgba(234,229,219,.7)' }}>{o.t}</div>; })}</div>
          </div>

          <div>
            <div style={{ ...cap, marginBottom: 6 }}>Alimentos que você não curte</div>
            <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>Preferência relaxável: a gente evita quando dá; se faltar opção, avisa. Diferente de alergia.</p>
            {naoGosto.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {naoGosto.map((c) => <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '.88rem', fontWeight: 500, color: 'rgba(234,229,219,.85)', background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 999, padding: '7px 9px 7px 14px' }}>{c}<button onClick={() => setNaoGosto((p) => p.filter((x) => x !== c))} style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.05rem', lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}>×</button></span>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 9 }}>
              <input value={naoGostoInput} onChange={(e) => setNaoGostoInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNaoGosto(); }} placeholder="Ex.: jiló, fígado…" style={{ flex: 1, boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '12px 14px', color: '#EAE5DB', fontSize: '.96rem', outline: 'none' }} />
              <button onClick={addNaoGosto} className="modal-more" style={{ background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', color: '#BDFF00', fontWeight: 700, fontSize: '.92rem', padding: '0 20px', borderRadius: 12, cursor: 'pointer' }}>Adicionar</button>
            </div>
          </div>

        </div>

        {!valido && <p style={{ color: '#E5484D', fontSize: '.88rem', margin: '14px 2px 0' }}>Confira idade (18–100), altura (100–250 cm) e peso (30–300 kg).</p>}

        <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
          <button onClick={onCancelar} className="evk-voltar" style={{ background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '1rem', padding: '14px 24px', borderRadius: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => valido && setConfirmar(true)} disabled={!valido} className={valido ? 'hov-btn' : ''} style={{ flex: 1, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1.02rem', padding: 14, border: 'none', borderRadius: 13, cursor: valido ? 'pointer' : 'not-allowed', opacity: valido ? 1 : 0.4 }}>Salvar alterações</button>
        </div>
      </div>

      {/* MODAL · RECALCULAR PLANO */}
      {confirmar && (
        <div onClick={() => setConfirmar(false)} style={{ position: 'fixed', inset: 0, zIndex: 213, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: '1px solid rgba(189,255,0,.3)', borderRadius: 22, padding: 26, boxShadow: '0 40px 90px -30px rgba(0,0,0,.8)', animation: `evkPop .3s ${EASE}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><svg width={24} height={24} viewBox="0 0 24 24" fill="none"><path d="M4 5v5h5M20 19v-5h-5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><path d="M19 9a7.5 7.5 0 00-13-2.5L4 10M5 15a7.5 7.5 0 0013 2.5L20 14" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <h2 style={{ margin: '0 0 10px', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-.01em' }}>Recalcular seu plano?</h2>
            <p style={{ margin: '0 0 22px', fontSize: '.94rem', color: 'rgba(234,229,219,.72)', lineHeight: 1.6 }}>Você mudou <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>peso, objetivo ou disponibilidade</strong>. Vamos atualizar suas estimativas de referência e o treino — e a triagem de saúde roda de novo, se fizer sentido.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={salvar} className="hov-btn" style={{ width: '100%', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 13, cursor: 'pointer' }}>Confirmar e recalcular</button>
              <button onClick={() => setConfirmar(false)} className="evk-voltar" style={{ width: '100%', background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '1rem', padding: 14, borderRadius: 13, cursor: 'pointer' }}>Voltar e revisar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cap: CSSProperties = { fontSize: '.8rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 10 };
const seg: CSSProperties = { cursor: 'pointer', flex: 1, minWidth: 0, textAlign: 'center', padding: '13px 8px', borderRadius: 12, fontWeight: 600, fontSize: '.95rem', transition: 'all .25s ease', border: '1px solid rgba(234,229,219,.12)', background: 'rgba(234,229,219,.04)', color: 'rgba(234,229,219,.7)' };
const segOn: CSSProperties = { borderColor: '#BDFF00', background: 'rgba(189,255,0,.1)', color: '#BDFF00' };
const card: CSSProperties = { cursor: 'pointer', position: 'relative', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, padding: '16px 18px', transition: `all .25s ease` };
const cardOn: CSSProperties = { borderColor: '#BDFF00', background: 'rgba(189,255,0,.07)', boxShadow: '0 0 0 1px rgba(189,255,0,.35)' };

function CardsBloco<T extends string>({ titulo, opts, sel, onSel, desc }: { titulo: string; opts: { id: T; t: string; d: string }[]; sel: T; onSel: (v: T) => void; desc?: boolean }) {
  return (
    <div>
      <div style={cap}>{titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: desc ? 9 : 10 }}>
        {opts.map((o) => {
          const on = sel === o.id;
          return (
            <div key={o.id} onClick={() => onSel(o.id)} style={{ ...card, ...(on ? cardOn : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div><div style={{ fontSize: '1rem', fontWeight: 700 }}>{o.t}</div>{desc && <div style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.6)' }}>{o.d}</div>}</div>
                {on && <span style={{ width: 22, height: 22, minWidth: 22, borderRadius: '50%', background: '#BDFF00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={12} height={12} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#0D2818" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}
