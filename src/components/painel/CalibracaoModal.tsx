'use client';

import { useState, type CSSProperties } from 'react';
import { escadaComNomes, indiceBase, modificacoesDe } from '@/lib/engine';
import { PISO_ABSOLUTO_REPS, PISO_REPS_COM_CARGA } from '@/lib/engine/treino-constants';
import { PISO_HOLD_SEG, repUnitDe } from '@/lib/engine/isometricos';
import type { EstadoExercicio, NivelExperiencia } from '@/lib/engine';
import type { Exercise } from '@/lib/data/types';
import type { ResumoSessao } from './SessaoTreino';

/**
 * Modal de CALIBRAÇÃO manual ("Muito fácil" — V8.1, porte fiel do protótipo
 * `Evokorpus Muito Fácil e Calibração.dc.html`; DF #11/#13 do cofre, 2026-07-04).
 * O corpo é decidido AUTOMATICAMENTE (nível e tipo nunca são perguntados):
 *   com carga → Corpo A (iniciante: reps TRAVADAS em 6 + explicador calmo;
 *               inter/avançado: livre + clamp no piso absoluto 5 + aviso âmbar);
 *   isométrico → Corpo C (Atual → Nova base da escada de modificações; topo → borda);
 *   peso corporal → Corpo B (seletor de degraus da escada; topo → Corpo D).
 * Salvar grava um EVENTO no histórico (B2) — determinismo intacto. Cancelar não grava.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';
const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '12px 14px', color: '#EAE5DB', fontSize: '1rem', fontWeight: 600, outline: 'none' };
const labelStyle: CSSProperties = { display: 'block', fontSize: '.72rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 7 };
const Cadeado = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x={5} y={11} width={14} height={9} rx={2} stroke="currentColor" strokeWidth={1.8} /><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" /></svg>
);

export type PayloadCalibracao = NonNullable<ResumoSessao['exercicios'][number]['calibracao']>;

export default function CalibracaoModal({ exercicioEfetivo, loaded, nivel, estado, exercicioPorId, onSalvar, onFechar }: {
  /** Exercício EFETIVO exibido (degrau adotado quando houver) — âncora da escada/modificação. */
  exercicioEfetivo: Exercise;
  loaded: boolean;
  nivel: NivelExperiencia;
  /** Estado atual da progressão (pré-preenche os campos); ausente antes da 1ª sessão. */
  estado?: EstadoExercicio;
  exercicioPorId: (id: string) => Exercise | undefined;
  onSalvar: (payload: PayloadCalibracao) => void;
  onFechar: () => void;
}) {
  const esSeg = repUnitDe(exercicioEfetivo.id) === 'segundos';
  const iniciante = nivel === 'iniciante';

  // Corpo B/D — escada de peso corporal (do exercício efetivo).
  const escada = !loaded && !esSeg ? escadaComNomes(exercicioEfetivo.id, exercicioPorId) : null;
  const degrauAtual = escada ? escada.degrau - 1 : 0;
  const topoEscada = escada !== null && escada.degrau === escada.total;
  const [degrauSel, setDegrauSel] = useState(degrauAtual);

  // Corpo C — modificações do isométrico (Atual → próxima mais difícil).
  const mods = esSeg ? modificacoesDe(exercicioEfetivo.id) : null;
  const modAtualIdx = mods ? Math.min(Math.max(indiceBase(exercicioEfetivo.id) + (estado?.variacaoNivel ?? 0), 0), mods.length - 1) : 0;
  const topoIso = mods !== null && modAtualIdx >= mods.length - 1;

  // Campos (pré-preenchidos da progressão atual quando houver).
  const [carga, setCarga] = useState(estado?.cargaKg != null ? String(estado.cargaKg) : '');
  const [reps, setReps] = useState(() => {
    if (loaded && iniciante) return String(PISO_REPS_COM_CARGA); // travado em 6 (sem contorno)
    return estado?.repsAlvo != null && !esSeg ? String(estado.repsAlvo) : '';
  });
  const [segundos, setSegundos] = useState(esSeg && estado?.repsAlvo != null ? String(estado.repsAlvo) : '');

  // Trilhos travados (defesa em profundidade — o motor clampa de novo no fold):
  // piso ABSOLUTO = 5 p/ todos; iniciante = 6, campo somente-leitura.
  const pisoReps = iniciante ? PISO_REPS_COM_CARGA : PISO_ABSOLUTO_REPS;
  const clampReps = (v: string) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || v === '') return v;
    return String(Math.max(loaded ? pisoReps : 1, n));
  };

  function salvar() {
    if (loaded) {
      const kg = Number(carga);
      const r = Math.max(pisoReps, Math.round(Number(reps) || pisoReps));
      onSalvar({ ...(Number.isFinite(kg) && kg > 0 ? { cargaKg: kg } : {}), reps: r });
      return;
    }
    if (esSeg && mods) {
      const s = Math.max(PISO_HOLD_SEG, Math.round(Number(segundos) || PISO_HOLD_SEG));
      // topo: reancora só o tempo na modificação atual; senão assume a próxima mais difícil
      onSalvar({ modificacaoIdx: topoIso ? modAtualIdx : modAtualIdx + 1, segundos: s });
      return;
    }
    const r = Math.max(1, Math.round(Number(reps) || 1));
    if (escada) {
      onSalvar({ degrauId: escada.degraus[degrauSel]!.idRepresentativo, reps: r });
    } else {
      onSalvar({ reps: r }); // peso corporal fora da malha (one-off): só reancora as reps
    }
  }

  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(7,18,11,.72)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 466, maxHeight: '90vh', overflowY: 'auto', background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: '1px solid rgba(234,229,219,.14)', borderRadius: 24, padding: '26px 26px 22px', boxShadow: '0 40px 90px -34px rgba(0,0,0,.8)', animation: `evkPop .3s ${EASE}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#BDFF00', marginBottom: 6 }}>Calibração manual</div>
            <h2 style={{ margin: 0, fontSize: '1.32rem', fontWeight: 800, letterSpacing: '-.01em' }}>Calibrar {exercicioEfetivo.nomePt}</h2>
          </div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer', padding: 0, marginTop: -2 }}>×</button>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: '.9rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.55 }}>Você marcou como muito fácil. Ajuste a base pro próximo treino — sem testar seu máximo real.</p>

        {/* ── CORPO A · com carga ─────────────────────────────────────────── */}
        {loaded && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label style={labelStyle}>Carga (kg)</label>
                <input type="number" inputMode="numeric" value={carga} onChange={(e) => setCarga(e.target.value)} className="input-foco" style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label style={labelStyle}>Repetições</label>
                {iniciante ? (
                  <div style={{ position: 'relative' }}>
                    {/* Piso do iniciante TRAVADO (6) — sem forma de contornar na UI (DF #11). */}
                    <input value={String(PISO_REPS_COM_CARGA)} readOnly style={{ ...inputStyle, background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.1)', color: 'rgba(234,229,219,.55)', fontWeight: 700, cursor: 'not-allowed', paddingRight: 40 }} />
                    <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(234,229,219,.4)', display: 'flex' }}><Cadeado /></span>
                  </div>
                ) : (
                  <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(clampReps(e.target.value))} onBlur={(e) => setReps(clampReps(e.target.value))} className="input-foco" style={inputStyle} />
                )}
              </div>
            </div>
            {iniciante ? (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 13, padding: '12px 14px', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 12 }}>
                <span style={{ color: 'rgba(234,229,219,.5)', flexShrink: 0, marginTop: 1, display: 'flex' }}><Cadeado size={15} /></span>
                <p style={{ margin: 0, fontSize: '.84rem', color: 'rgba(234,229,219,.62)', lineHeight: 1.5 }}>Mantemos um piso de 6 repetições para o nível iniciante — mais seguro pra calibrar sem testar o seu máximo real.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 13, padding: '12px 14px', background: 'rgba(229,192,77,.09)', border: '1px solid rgba(229,192,77,.32)', borderRadius: 12 }}>
                <span style={{ color: '#E5C04D', flexShrink: 0, marginTop: 1, display: 'flex' }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 16h.01M10.3 4.9 2.4 19a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.9a2 2 0 0 0-3.4 0z" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                <p style={{ margin: 0, fontSize: '.84rem', color: '#E5C04D', lineHeight: 1.5 }}>Fique acima de 5 repetições — esse é o piso de segurança pra qualquer nível. Nunca testamos seu 1RM real.</p>
              </div>
            )}
          </>
        )}

        {/* ── CORPO B · peso corporal com escada (seletor de degraus) ─────── */}
        {!loaded && !esSeg && escada && !topoEscada && (
          <>
            <div style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 8 }}>Nova base</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#BDFF00' }}>{escada.degraus[degrauSel]!.nome}</span>
              <span style={{ flexShrink: 0, fontSize: '.76rem', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)' }}>Degrau {degrauSel + 1} de {escada.total}</span>
            </div>
            <div style={{ position: 'relative', padding: '4px 2px 2px' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                <div style={{ position: 'absolute', left: 26, right: 26, top: 13, height: 2, background: 'rgba(234,229,219,.1)' }} />
                {escada.degraus.map((d, i) => {
                  const dot: CSSProperties = i < degrauSel
                    ? { width: 15, height: 15, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 3px rgba(22,163,74,.16)', transition: 'all .25s ease' }
                    : i === degrauSel
                      ? { width: 18, height: 18, borderRadius: '50%', background: 'rgba(189,255,0,.18)', border: '2px solid #BDFF00', boxShadow: '0 0 0 4px rgba(189,255,0,.13), 0 0 16px -1px rgba(189,255,0,.6)', transition: 'all .25s ease' }
                      : { width: 13, height: 13, borderRadius: '50%', background: 'rgba(234,229,219,.14)', transition: 'all .25s ease' };
                  const lbl: CSSProperties = { fontSize: '.58rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.15, transition: 'color .25s ease', color: i === degrauSel ? '#BDFF00' : i < degrauSel ? 'rgba(22,163,74,.9)' : 'rgba(234,229,219,.4)' };
                  return (
                    <div key={d.idRepresentativo} onClick={() => setDegrauSel(i)} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                      <span style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={dot} /></span>
                      <span style={lbl}>{d.nome}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p style={{ margin: '14px 0 16px', fontSize: '.8rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.5 }}>Toque num degrau mais à frente para assumi-lo como nova base.</p>
            <div>
              <label style={labelStyle}>Repetições nessa variação</label>
              <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="input-foco" style={inputStyle} />
            </div>
          </>
        )}

        {/* ── CORPO C · isométrico (Atual → Nova base) ────────────────────── */}
        {!loaded && esSeg && mods && !topoIso && (
          <>
            <div style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 10 }}>Assuma uma modificação mais difícil</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, opacity: 0.7 }}><svg width={52} height={34} viewBox="0 0 60 40" fill="none"><circle cx={11} cy={21} r={4.5} stroke="rgba(234,229,219,.8)" strokeWidth={2} /><path d="M15 21 H50" stroke="rgba(234,229,219,.8)" strokeWidth={2} strokeLinecap="round" /><path d="M23 21 L19 33 M42 21 L46 33" stroke="rgba(234,229,219,.8)" strokeWidth={2} strokeLinecap="round" /></svg></div>
                <div style={{ fontSize: '.64rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.45)', marginBottom: 3 }}>Atual</div>
                <div style={{ fontSize: '.86rem', fontWeight: 600, color: 'rgba(234,229,219,.85)' }}>{mods[modAtualIdx]!.nome}</div>
              </div>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(234,229,219,.4)' }}><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div style={{ background: 'rgba(189,255,0,.07)', border: '1.5px solid rgba(189,255,0,.5)', borderRadius: 14, padding: '14px 10px', textAlign: 'center', boxShadow: '0 0 22px -8px rgba(189,255,0,.5)' }}>
                <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><svg width={52} height={34} viewBox="0 0 60 40" fill="none"><circle cx={11} cy={27} r={4.5} stroke="#BDFF00" strokeWidth={2} /><path d="M15 26 L50 14" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /><path d="M23 24 L19 34 M43 17 L49 24" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /></svg></div>
                <div style={{ fontSize: '.64rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#BDFF00', marginBottom: 3 }}>Nova base</div>
                <div style={{ fontSize: '.86rem', fontWeight: 700, color: '#BDFF00' }}>{mods[modAtualIdx + 1]!.nome}</div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Segundos nessa modificação</label>
              <input type="number" inputMode="numeric" value={segundos} onChange={(e) => setSegundos(e.target.value)} className="input-foco" style={inputStyle} />
            </div>
          </>
        )}

        {/* ── CORPO D · borda: topo da escada / da modificação (ou fora da malha) ── */}
        {!loaded && ((esSeg && (topoIso || !mods)) || (!esSeg && (topoEscada || !escada))) && (
          <>
            {(topoEscada || topoIso) && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 16, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, marginBottom: 16 }}>
                <span style={{ width: 40, height: 40, minWidth: 40, borderRadius: 11, background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={22} height={22} viewBox="0 0 24 24" fill="none"><path d="M3 20h18L14 7l-3.6 6L8 9.5 3 20z" stroke="#BDFF00" strokeWidth={1.8} strokeLinejoin="round" fill="none" /></svg></span>
                <div>
                  <div style={{ fontSize: '.98rem', fontWeight: 700, lineHeight: 1.4, marginBottom: 5 }}>Você já está na {esSeg ? 'modificação' : 'variação'} mais difícil deste exercício em peso corporal.</div>
                  <p style={{ margin: 0, fontSize: '.86rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.55 }}>Ajuste {esSeg ? 'os segundos' : 'as repetições'} ou considere adicionar carga externa (colete, mochila) para continuar evoluindo.</p>
                </div>
              </div>
            )}
            <div>
              <label style={labelStyle}>{esSeg ? 'Segundos' : 'Repetições'}</label>
              {esSeg
                ? <input type="number" inputMode="numeric" value={segundos} onChange={(e) => setSegundos(e.target.value)} className="input-foco" style={inputStyle} />
                : <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="input-foco" style={inputStyle} />}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onFechar} className="evk-voltar" style={{ flex: 1, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '.96rem', padding: 14, borderRadius: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={salvar} className="hov-btn" style={{ flex: 1.4, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.96rem', padding: 14, border: 'none', borderRadius: 13, cursor: 'pointer' }}>Salvar nova calibração</button>
        </div>
      </div>
    </div>
  );
}
