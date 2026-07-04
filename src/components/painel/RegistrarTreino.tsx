'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { DiaTreino, PrescricaoFITT, Feedback } from '@/lib/engine/treino-types';
import type { Exercise } from '@/lib/data/types';
import type { ResumoSessao } from './SessaoTreino';
import { EXERCISES_SEED } from '@/lib/data/seed';
import { hojeISO } from '@/lib/treino-historico';
import { exercicioEfetivo, type ProgressoExercicio } from '@/lib/treino-progressao';
import CalibracaoModal, { type PayloadCalibracao } from './CalibracaoModal';
import { repUnitDe, type RepUnit } from '@/lib/engine/isometricos';

/**
 * Registrar treino feito — porte FIEL do formulário do design
 * (design_handoff_registro_e_contador_treino, Componente A). Formulário PÓS-FATO:
 * lança uma sessão que já aconteceu (sem timer, sem execução ao vivo — não é o player
 * guiado). Regras de produção do handoff (o protótipo simplificava):
 * - a sessão entra na DATA REAL escolhida (aceita passado; nunca futuro — max = hoje);
 * - o contador de dias deduplica por dia calendário (feito no derivado `diasDeTreino`);
 * - busca ESTRUTURADA na biblioteca real (163) é o caminho principal; texto livre só como
 *   "exercício personalizado" explícito, que NÃO alimenta o gráfico de carga.
 * Grava no MESMO formato da sessão guiada (ResumoSessao) + origem manual (no Painel).
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';
const PADRAO_LABEL: Record<string, string> = { empurrar: 'Empurrar', puxar: 'Puxar', agachar: 'Agachar', dobradica_quadril: 'Dobradiça de quadril', core: 'Core', cardio: 'Cardio', isolado: 'Isolado' };
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

interface ExForm {
  uid: string;
  refId: string | null;      // id da biblioteca (e{n}) ou null se personalizado
  nome: string;
  custom: boolean;
  temCarga: boolean;
  /** Unidade de registro (cofre): 'segundos' nos 5 isométricos → coluna "Segundos". */
  repUnit: RepUnit;
  dica: string;
  variacao: string;
  sets: { reps: string; kg: string }[];
  chip: Feedback | null;
  rir: string;
}

const lbl: CSSProperties = { display: 'block', fontSize: '.74rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 7 };
const inputBase: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '12px 14px', color: '#EAE5DB', fontSize: '.95rem', fontFamily: 'inherit', outline: 'none', colorScheme: 'dark' };
const pickerInput: CSSProperties = { boxSizing: 'border-box', background: 'rgba(13,40,24,.5)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 11, padding: '11px 14px', color: '#EAE5DB', fontSize: '.92rem', fontFamily: 'inherit', outline: 'none' };
const setInput: CSSProperties = { flex: 1, width: '100%', minWidth: 0, boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 9, padding: '9px 11px', color: '#EAE5DB', fontSize: '.92rem', fontWeight: 600, outline: 'none' };
const chipStyle = (active: boolean): CSSProperties => ({ padding: '8px 12px', borderRadius: 9, fontSize: '.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s ease', border: `1px solid ${active ? 'rgba(189,255,0,.4)' : 'rgba(234,229,219,.16)'}`, background: active ? 'rgba(189,255,0,.12)' : 'none', color: active ? '#BDFF00' : 'rgba(234,229,219,.72)' });

let seq = 0;
const newUid = () => `exf${++seq}`;

export default function RegistrarTreino({ diaHoje, prescricao, progresso, exercicioPorId, onCalibrar, onCancelar, onSalvar, onVerHistorico }: {
  diaHoje?: DiaTreino;
  prescricao: PrescricaoFITT | null;
  /** Progressão atual (pré-preenche a calibração "Muito fácil"). */
  progresso?: Record<string, ProgressoExercicio>;
  exercicioPorId?: (id: string) => Exercise | undefined;
  /** Grava calibração como evento no histórico (B2 — "Muito fácil" também vive aqui, V8.1). */
  onCalibrar?: (itens: { id: string; nome: string; calibracao: PayloadCalibracao }[]) => void;
  onCancelar: () => void;
  /** Persiste a sessão (Painel: registrarSessaoEm + celebração do marco). Deve ser síncrono. */
  onSalvar: (resumo: ResumoSessao, dataISO: string, extra: { hora: string; obs?: string }) => void;
  onVerHistorico: () => void;
}) {
  // "Muito fácil" (V8.1): uid do exercício com o modal de calibração aberto.
  const [calibrando, setCalibrando] = useState<string | null>(null);
  const [dataISO, setDataISO] = useState(() => hojeISO());
  const [hora, setHora] = useState(() => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; });
  const [startMode, setStartMode] = useState<'plano' | 'zero' | null>(null);
  const [exs, setExs] = useState<ExForm[]>([]);
  const [obs, setObs] = useState('');
  const [status, setStatus] = useState<'editando' | 'salvando' | 'salvo'>('editando');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [fEquip, setFEquip] = useState('');
  const [fPadrao, setFPadrao] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  const maxDate = hojeISO();

  const equipOptions = useMemo(() => [...new Set(EXERCISES_SEED.map((e) => e.equipamentoDetalhe).filter(Boolean))] as string[], []);
  const padraoOptions = useMemo(() => [...new Set(EXERCISES_SEED.map((e) => e.padraoMovimento))], []);

  function entradaDaBiblioteca(ex: Exercise, prefill: boolean): ExForm {
    // Isométricos registram SEGUNDOS e são time-only (sem carga); o resto segue a regra do
    // player: peso corporal não tem coluna de carga.
    const repUnit = repUnitDe(ex.id);
    const temCarga = repUnit === 'segundos' ? false : (ex.equipamentoDetalhe ?? '') !== 'Peso corporal';
    const nSets = prefill && prescricao ? prescricao.seriesPorExercicio.min : 3;
    const repsDefault = prefill && prescricao && repUnit === 'reps' ? String(prescricao.repsComposto.max) : '';
    return {
      uid: newUid(), refId: ex.id, nome: ex.nomePt, custom: false, temCarga, repUnit,
      dica: ex.comoFazer, variacao: '',
      sets: Array.from({ length: nSets }, () => ({ reps: repsDefault, kg: '' })),
      chip: null, rir: '',
    };
  }

  function escolherPartida(mode: 'plano' | 'zero') {
    if (mode === 'plano' && diaHoje && prescricao) {
      const lista = diaHoje.slots.map((sl) => {
        const comp = sl.padrao !== 'isolado';
        const e = entradaDaBiblioteca(sl.exercicio, true);
        // reps default = TOPO da faixa prescrita (composto/isolado), editável; carga em branco.
        const reps = String((comp ? prescricao.repsComposto : prescricao.repsIsolado).max);
        return { ...e, sets: e.sets.map(() => ({ reps, kg: '' })) };
      });
      setStartMode('plano'); setExs(lista);
    } else {
      setStartMode('zero'); setExs([]);
    }
  }

  const addedRefs = useMemo(() => new Set(exs.map((e) => e.refId).filter(Boolean)), [exs]);
  const filtrados = useMemo(() => {
    const nq = norm(query.trim());
    return EXERCISES_SEED.filter((e) => {
      const mQ = !nq || norm(e.nomePt).includes(nq) || norm(e.nomeEn ?? '').includes(nq);
      const mE = !fEquip || e.equipamentoDetalhe === fEquip;
      const mP = !fPadrao || e.padraoMovimento === fPadrao;
      return mQ && mE && mP && !addedRefs.has(e.id);
    });
  }, [query, fEquip, fPadrao, addedRefs]);

  const mut = (uid: string, patch: (e: ExForm) => ExForm) => setExs((s) => s.map((e) => (e.uid === uid ? patch(e) : e)));
  const mover = (uid: string, dir: -1 | 1) => setExs((s) => {
    const arr = s.slice(); const i = arr.findIndex((e) => e.uid === uid); const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return s;
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    return arr;
  });

  function confirmarCustom() {
    const nome = customName.trim();
    if (!nome) return;
    setExs((s) => [...s, {
      uid: newUid(), refId: null, nome, custom: true, temCarga: true, repUnit: 'reps',
      dica: 'Exercício personalizado — sem instruções da biblioteca.', variacao: '',
      sets: [{ reps: '', kg: '' }], chip: null, rir: '',
    }]);
    setCustomOpen(false); setCustomName('');
  }

  const temExercicios = exs.length > 0;
  const canSave = temExercicios && status === 'editando';

  function salvar() {
    if (!canSave) return;
    // Persiste JÁ (localStorage é síncrono — o "Salvando…" é só a transição visual do design).
    const fbMap: Record<string, Feedback> = {};
    exs.forEach((e) => { if (e.refId && e.chip) fbMap[e.refId] = e.chip; });
    const exercicios = exs.map((e) => ({
      id: e.refId ?? '',
      nome: e.nome,
      loaded: e.temCarga,
      fb: e.chip,
      sets: e.sets.filter((r) => r.reps !== '' || r.kg !== '').map((r) => ({ reps: r.reps, kg: r.kg })),
      ...(e.custom ? { custom: true } : {}),
      ...(e.rir !== '' ? { rir: e.rir } : {}),
      ...(e.variacao.trim() !== '' ? { variacao: e.variacao.trim() } : {}),
    }));
    const series = exercicios.reduce((n, e) => n + e.sets.length, 0);
    const volumeKg = exercicios.reduce((n, e) => (e.loaded ? n + e.sets.reduce((v, r) => v + (Number(r.reps) || 0) * (Number(r.kg) || 0), 0) : n), 0);
    onSalvar(
      { dia: 'Treino registrado', series, volumeKg, feedback: fbMap, exercicios },
      !dataISO || dataISO > maxDate ? maxDate : dataISO, // nunca futuro (regra do handoff)
      { hora, ...(obs.trim() ? { obs: obs.trim() } : {}) },
    );
    setStatus('salvando');
    setTimeout(() => setStatus('salvo'), 900);
  }

  function registrarOutro() {
    setDataISO(hojeISO());
    const d = new Date(); setHora(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setStartMode(null); setExs([]); setObs(''); setStatus('editando');
    setPickerOpen(false); setQuery(''); setFEquip(''); setFPadrao(''); setCustomOpen(false); setCustomName('');
    window.scrollTo(0, 0);
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', animation: `evkScreenIn .5s ${EASE}` }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(13,40,24,.85)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(234,229,219,.1)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '13px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <svg width={24} height={24} viewBox="0 0 100 100" fill="none"><line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" /></svg>
            <span style={{ fontWeight: 700, fontSize: '.95rem', color: 'rgba(234,229,219,.85)' }}>Registrar treino</span>
          </div>
          <button onClick={onCancelar} className="evk-voltar" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.75)', fontWeight: 600, fontSize: '.85rem', padding: '8px 15px', borderRadius: 10, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 22px 90px' }}>
        {status === 'salvo' ? (
          <div style={{ animation: `evkStepIn .45s ${EASE}` }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(189,255,0,.14)', border: '1px solid rgba(189,255,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}><svg width={30} height={30} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#BDFF00" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <h1 style={{ margin: '0 0 8px', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.02em' }}>Treino registrado.</h1>
            <p style={{ margin: '0 0 26px', color: 'rgba(234,229,219,.62)', fontSize: '1rem', lineHeight: 1.55 }}>Mais um dia no seu histórico.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={onVerHistorico} className="hov-btn" style={{ flex: 1, minWidth: 180, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: 15, border: 'none', borderRadius: 13, cursor: 'pointer' }}>Ver no histórico</button>
              <button onClick={registrarOutro} className="evk-voltar" style={{ flex: 1, minWidth: 180, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '1rem', padding: 15, borderRadius: 13, cursor: 'pointer' }}>Registrar outro treino</button>
            </div>
          </div>
        ) : (
          <div style={{ animation: `evkStepIn .4s ${EASE}` }}>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.02em' }}>Registrar treino feito.</h1>
            <p style={{ margin: '0 0 26px', color: 'rgba(234,229,219,.6)', fontSize: '.95rem', lineHeight: 1.55 }}>Diferente do treino guiado — aqui você lança uma sessão que já aconteceu.</p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 26 }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={lbl}>Data</label>
                {/* max não impede data futura DIGITADA (só marca :invalid) → clamp no onChange. */}
                <input type="date" value={dataISO} max={maxDate} onChange={(e) => { const v = e.target.value; setDataISO(v && v > maxDate ? maxDate : v); }} className="input-foco" style={inputBase} />
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label style={lbl}>Hora</label>
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input-foco" style={inputBase} />
              </div>
            </div>

            {startMode === null ? (
              <div style={{ marginBottom: 26 }}>
                <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'rgba(234,229,219,.72)', marginBottom: 12 }}>Como você quer começar?</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                  {diaHoje && prescricao && (
                    <div onClick={() => escolherPartida('plano')} className="evk-start-card" style={{ cursor: 'pointer', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 16, padding: 20 }}>
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ marginBottom: 12 }}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /></svg>
                      <div style={{ fontWeight: 700, fontSize: '1.02rem', marginBottom: 6 }}>Usar o treino do plano</div>
                      <div style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>Pré-preenche os exercícios de hoje ({diaHoje.nome}) — você só ajusta reps e cargas reais.</div>
                    </div>
                  )}
                  <div onClick={() => escolherPartida('zero')} className="evk-start-card" style={{ cursor: 'pointer', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 16, padding: 20 }}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ marginBottom: 12 }}><circle cx={12} cy={12} r={9} stroke="#BDFF00" strokeWidth={1.8} /><path d="M12 8v8M8 12h8" stroke="#BDFF00" strokeWidth={1.8} strokeLinecap="round" /></svg>
                    <div style={{ fontWeight: 700, fontSize: '1.02rem', marginBottom: 6 }}>Montar do zero</div>
                    <div style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>Comece uma lista vazia e adicione exatamente o que você treinou.</div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 20, fontSize: '.86rem', color: 'rgba(234,229,219,.55)' }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-11" stroke="#16A34A" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>Ponto de partida: {startMode === 'plano' ? 'o treino do plano.' : 'do zero.'}</div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'rgba(234,229,219,.72)' }}>Exercícios</div>
                  {!pickerOpen && (
                    <button onClick={() => setPickerOpen(true)} className="evk-registrar" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: '1px solid rgba(189,255,0,.4)', color: '#BDFF00', fontWeight: 600, fontSize: '.86rem', padding: '9px 15px', borderRadius: 10, cursor: 'pointer' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" /></svg>Adicionar exercício</button>
                  )}
                </div>

                {pickerOpen && (
                  <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(189,255,0,.3)', borderRadius: 16, padding: 16, marginBottom: 16, animation: `evkPop .3s ${EASE}` }}>
                    <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar na biblioteca de exercícios…" className="input-foco" style={{ ...pickerInput, width: '100%', marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                      <select value={fEquip} onChange={(e) => setFEquip(e.target.value)} style={{ ...pickerInput, borderRadius: 10, padding: '9px 11px', fontSize: '.84rem' }}>
                        <option value="">Todos</option>
                        {equipOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <select value={fPadrao} onChange={(e) => setFPadrao(e.target.value)} style={{ ...pickerInput, borderRadius: 10, padding: '9px 11px', fontSize: '.84rem' }}>
                        <option value="">Todos</option>
                        {padraoOptions.map((o) => <option key={o} value={o}>{PADRAO_LABEL[o] ?? o}</option>)}
                      </select>
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {filtrados.map((e) => (
                        <div key={e.id} onClick={() => { setExs((s) => [...s, entradaDaBiblioteca(e, false)]); setQuery(''); }} className="evk-picker-row" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(234,229,219,.03)' }}>
                          <div><div style={{ fontSize: '.92rem', fontWeight: 600 }}>{e.nomePt}</div><div style={{ fontSize: '.76rem', color: 'rgba(234,229,219,.5)' }}>{PADRAO_LABEL[e.padraoMovimento] ?? e.padraoMovimento} · {e.equipamentoDetalhe ?? '—'}</div></div>
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ color: '#BDFF00', flexShrink: 0 }}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" /></svg>
                        </div>
                      ))}
                      {filtrados.length === 0 && <div style={{ padding: 14, textAlign: 'center', fontSize: '.85rem', color: 'rgba(234,229,219,.45)' }}>Nenhum exercício encontrado.</div>}
                    </div>
                    {customOpen && (
                      <>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                          <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Nome do exercício" className="input-foco" style={{ ...pickerInput, flex: 1, minWidth: 160, borderRadius: 10, padding: '10px 12px', fontSize: '.88rem' }} />
                          <button onClick={confirmarCustom} style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.86rem', padding: '10px 16px', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Adicionar</button>
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: '.76rem', color: 'rgba(234,229,219,.45)', lineHeight: 1.5 }}>Exercícios personalizados não alimentam o gráfico de carga por exercício.</p>
                      </>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid rgba(234,229,219,.08)' }}>
                      {!customOpen && <a onClick={() => setCustomOpen(true)} style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.6)', textDecoration: 'underline', cursor: 'pointer' }}>+ Exercício personalizado (fora da biblioteca)</a>}
                      <button onClick={() => { setPickerOpen(false); setQuery(''); setCustomOpen(false); setCustomName(''); }} style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '.84rem', padding: '9px 16px', borderRadius: 10, cursor: 'pointer' }}>Concluído</button>
                    </div>
                  </div>
                )}

                {exs.length === 0 && !pickerOpen && (
                  <div style={{ background: 'rgba(234,229,219,.02)', border: '1px dashed rgba(234,229,219,.18)', borderRadius: 18, padding: '36px 24px', textAlign: 'center', color: 'rgba(234,229,219,.5)', fontSize: '.92rem', marginBottom: 16 }}>Nenhum exercício ainda — adicione o que você treinou.</div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 26 }}>
                  {exs.map((e, idx) => (
                    <div key={e.uid} style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '20px 22px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.08rem', fontWeight: 700 }}>{e.nome}</span>
                          {e.custom && <span style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'rgba(234,229,219,.45)', background: 'rgba(234,229,219,.08)', borderRadius: 6, padding: '3px 7px' }}>Personalizado</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {idx > 0 && <button onClick={() => mover(e.uid, -1)} aria-label="Mover para cima" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(234,229,219,.14)', background: 'none', color: 'rgba(234,229,219,.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M5 15l7-7 7 7" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
                          {idx < exs.length - 1 && <button onClick={() => mover(e.uid, 1)} aria-label="Mover para baixo" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(234,229,219,.14)', background: 'none', color: 'rgba(234,229,219,.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M5 9l7 7 7-7" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
                          <button onClick={() => setExs((s) => s.filter((x) => x.uid !== e.uid))} aria-label="Remover exercício" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(229,72,77,.25)', background: 'none', color: 'rgba(229,72,77,.85)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                        </div>
                      </div>

                      <details style={{ margin: '6px 0 14px' }}>
                        <summary style={{ fontSize: '.83rem', fontWeight: 600, color: 'rgba(234,229,219,.6)', listStyle: 'none', cursor: 'pointer' }}>Como fazer</summary>
                        <p style={{ margin: '8px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>{e.dica}</p>
                      </details>

                      {/* Aviso PERMANENTE no cartão (handoff §A item 3: "exibido no próprio
                          cartão, não só no momento de adicionar"). */}
                      {e.custom && (
                        <p style={{ margin: '0 0 12px', fontSize: '.76rem', color: 'rgba(234,229,219,.45)', lineHeight: 1.5 }}>Esse exercício não alimenta o gráfico de carga por exercício.</p>
                      )}
                      {e.custom && (
                        <div onClick={() => mut(e.uid, (x) => ({ ...x, temCarga: !x.temCarga }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', width: 40, minWidth: 40, height: 22, borderRadius: 999, padding: 2, boxSizing: 'border-box', transition: 'background .25s ease', background: !e.temCarga ? '#BDFF00' : 'rgba(234,229,219,.15)' }}><span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', transition: 'transform .25s ease', background: !e.temCarga ? '#0D2818' : 'rgba(234,229,219,.8)', transform: `translateX(${!e.temCarga ? 18 : 0}px)` }} /></span>
                          <span style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.65)' }}>Peso corporal (sem carga)</span>
                        </div>
                      )}

                      {!e.temCarga && (
                        <div style={{ marginBottom: 14 }}>
                          <label style={{ ...lbl, fontSize: '.72rem', letterSpacing: '.06em', color: 'rgba(234,229,219,.45)', marginBottom: 6 }}>Variação (opcional)</label>
                          <input type="text" value={e.variacao} onChange={(ev) => mut(e.uid, (x) => ({ ...x, variacao: ev.target.value }))} placeholder="ex.: joelhos apoiados, inclinada" className="input-foco" style={{ ...pickerInput, width: '100%', borderRadius: 10, padding: '9px 12px', fontSize: '.86rem' }} />
                        </div>
                      )}

                      <div style={{ background: 'rgba(13,40,24,.3)', borderRadius: 12, padding: '4px 14px 10px', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 6px', fontSize: '.66rem', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'rgba(234,229,219,.4)' }}>
                          <span style={{ width: 26, minWidth: 26 }}>Série</span>
                          <span style={{ flex: 1 }}>{e.repUnit === 'segundos' ? 'Segundos' : 'Reps'}</span>
                          {e.temCarga && <span style={{ flex: 1 }}>Carga (kg)</span>}
                          <span style={{ width: 28, minWidth: 28 }} />
                        </div>
                        {e.sets.map((row, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(234,229,219,.06)' }}>
                            <span style={{ width: 26, minWidth: 26, fontWeight: 800, color: 'rgba(234,229,219,.3)', fontSize: '.9rem' }}>{i + 1}</span>
                            <input type="number" inputMode="numeric" value={row.reps} placeholder="—" onChange={(ev) => mut(e.uid, (x) => ({ ...x, sets: x.sets.map((r, ri) => (ri === i ? { ...r, reps: ev.target.value } : r)) }))} className="input-foco" style={setInput} />
                            {e.temCarga && <input type="number" inputMode="numeric" value={row.kg} placeholder="—" onChange={(ev) => mut(e.uid, (x) => ({ ...x, sets: x.sets.map((r, ri) => (ri === i ? { ...r, kg: ev.target.value } : r)) }))} className="input-foco" style={setInput} />}
                            {e.sets.length > 1 && <button onClick={() => mut(e.uid, (x) => ({ ...x, sets: x.sets.filter((_, ri) => ri !== i) }))} aria-label="Remover série" style={{ width: 28, height: 28, minWidth: 28, borderRadius: 8, border: 'none', background: 'none', color: 'rgba(234,229,219,.4)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>×</button>}
                          </div>
                        ))}
                        <button onClick={() => mut(e.uid, (x) => ({ ...x, sets: [...x.sets, { reps: '', kg: '' }] }))} style={{ marginTop: 10, background: 'none', border: 'none', color: '#BDFF00', fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>+ Adicionar série</button>
                      </div>

                      <div style={{ borderTop: '1px solid rgba(234,229,219,.08)', paddingTop: 14 }}>
                        <div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.5)', marginBottom: 10 }}>Esforço (opcional)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <button style={chipStyle(e.chip === 'facil')} onClick={() => mut(e.uid, (x) => ({ ...x, chip: x.chip === 'facil' ? null : 'facil' }))}>Fácil</button>
                          <button style={chipStyle(e.chip === 'na_medida')} onClick={() => mut(e.uid, (x) => ({ ...x, chip: x.chip === 'na_medida' ? null : 'na_medida' }))}>Na medida</button>
                          <button style={chipStyle(e.chip === 'dificil')} onClick={() => mut(e.uid, (x) => ({ ...x, chip: x.chip === 'dificil' ? null : 'dificil' }))}>Difícil</button>
                          {/* 4ª pílula (V8.1): abre a calibração — não registra chip. Custom (sem id) não calibra. */}
                          {onCalibrar && !e.custom && e.refId && (
                            <button onClick={() => setCalibrando(e.uid)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 15px', borderRadius: 11, fontSize: '.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all .2s ease', border: '1.5px solid rgba(189,255,0,.55)', background: 'rgba(189,255,0,.06)', color: '#BDFF00' }}>
                              <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M4 8h9M18 8h2M4 16h2M11 16h9" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /><circle cx={15.5} cy={8} r={2.4} stroke="currentColor" strokeWidth={2} /><circle cx={8.5} cy={16} r={2.4} stroke="currentColor" strokeWidth={2} /></svg>
                              Muito fácil
                              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" style={{ opacity: 0.75 }}><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                          )}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 4 }}><span style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.5)' }}>RIR</span><input type="number" inputMode="numeric" min={0} max={5} value={e.rir} placeholder="—" onChange={(ev) => mut(e.uid, (x) => ({ ...x, rir: ev.target.value }))} className="input-foco" style={{ width: 52, boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.16)', borderRadius: 9, padding: '8px 9px', color: '#EAE5DB', fontSize: '.88rem', fontWeight: 600, outline: 'none' }} /></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, color: 'rgba(234,229,219,.72)', marginBottom: 8 }}>Como foi o treino? (opcional)</label>
                  <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Pulável — só se quiser registrar algo a mais." rows={3} className="input-foco" style={{ ...inputBase, fontSize: '.92rem', resize: 'vertical' }} />
                </div>

                <button onClick={salvar} className={canSave ? 'hov-btn' : undefined} disabled={!canSave} style={canSave
                  ? { width: '100%', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1.05rem', padding: 16, border: 'none', borderRadius: 14, cursor: 'pointer' }
                  : { width: '100%', background: 'rgba(234,229,219,.08)', color: 'rgba(234,229,219,.4)', fontWeight: 700, fontSize: '1.05rem', padding: 16, border: 'none', borderRadius: 14, cursor: 'not-allowed' }}>
                  {status === 'salvando' ? 'Salvando…' : 'Salvar treino'}
                </button>
                {!temExercicios && <p style={{ margin: '10px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.45)', textAlign: 'center' }}>Adicione ao menos um exercício para salvar.</p>}
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL · CALIBRAÇÃO MANUAL (V8.1 "Muito fácil" — mesmo fluxo da guiada) */}
      {calibrando !== null && exercicioPorId && onCalibrar && (() => {
        const entrada = exs.find((x) => x.uid === calibrando);
        if (!entrada?.refId) return null;
        const efetivoC = exercicioEfetivo(entrada.refId, progresso, exercicioPorId) ?? exercicioPorId(entrada.refId);
        if (!efetivoC) return null;
        return (
          <CalibracaoModal
            exercicioEfetivo={efetivoC}
            loaded={entrada.temCarga && entrada.repUnit !== 'segundos'}
            nivel={prescricao?.nivel ?? 'iniciante'}
            estado={progresso?.[entrada.refId]?.estado}
            exercicioPorId={exercicioPorId}
            onFechar={() => setCalibrando(null)}
            onSalvar={(payload) => { onCalibrar([{ id: entrada.refId!, nome: efetivoC.nomePt, calibracao: payload }]); setCalibrando(null); }}
          />
        );
      })()}
    </div>
  );
}
