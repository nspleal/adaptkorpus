'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { DiaTreino, PrescricaoFITT, Feedback } from '@/lib/engine/treino-types';
import { ListaErrosComuns, temErrosComuns } from './ErrosComuns';
import { repUnitDe, faixaSegundos, rotuloFaixaSeg, PISO_HOLD_SEG, type RepUnit, type FaixaHold } from '@/lib/engine/isometricos';
import { modalidadeDoExercicio, ROTULO_MODALIDADE, type IntensidadeCardio, type ModalidadeCardio } from '@/lib/engine/cardio';
import RegistrarCardio from './Cardio';
import { exercicioEfetivo, type ProgressoExercicio } from '@/lib/treino-progressao';
import { HintVariacao } from './EscadaDegraus';
import { DetalheExercicio } from './DetalheModais';
import CalibracaoModal from './CalibracaoModal';
import type { Exercise } from '@/lib/data/types';

/** Hint amigável a partir da última ação da progressão (evita jargão). */
function hintEvolucao(acao: string | null | undefined): string | null {
  if (!acao) return null;
  if (acao.includes('carga') && acao.startsWith('+')) return 'Subiu a carga desde a última — mantenha a forma.';
  if (acao.includes('série')) return 'Você ganhou uma série — mais volume.';
  if (acao.includes('variação') || acao.includes('modificação')) return 'Você subiu um degrau de dificuldade.';
  if (acao.startsWith('+')) return 'Sua meta evoluiu desde a última sessão.';
  if (acao.startsWith('−') || acao.includes('reconstrói') || acao.includes('desce')) return 'Ajustamos a meta pra baixo — reconstrua com segurança.';
  return null;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Sessão de treino guiada — porte fiel do protótipo V2 (.dc.html):
 * intro → execução (tabela de séries, timer de descanso, %1RM opt-in, "como foi",
 * "senti dor") → resumo. Estilos inline idênticos + movimento (evkStepIn/evkPop/
 * evkDraw/evkRise).
 *
 * Os números (reps, RIR, descanso, séries) vêm do motor determinístico real
 * (PrescricaoFITT) — nada de IA em runtime. O %1RM é só uma LEITURA estimada a
 * partir da faixa de reps (nunca testamos 1RM real); respeita o piso de 6 reps
 * (conceitos/parametros-motor-treino-evokorpus → piso de segurança).
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

type SetRow = { reps: string; kg: string; rir: string; done: boolean };
type ExState = { sets: SetRow[]; fb: Feedback | null; paused: boolean };

interface ExView {
  id: string;
  nome: string;
  grupos: string;
  loaded: boolean;
  reps: { min: number; max: number };
  rir: { min: number; max: number };
  restSeg: number;
  comoFazer: string;
  /** Unidade de registro (cofre): 'segundos' nos 5 isométricos, 'reps' no resto. */
  repUnit: RepUnit;
  /** Faixa de tempo do hold no nível do usuário (só quando repUnit==='segundos'). */
  faixaSeg: FaixaHold | null;
  /** Progressão (Bloco B): séries efetivas (com deload), meta que evolui, sugestão de carga, hint. */
  nSetsEx: number;
  metaCurta: string;        // conteúdo do chip: "10 reps" · "25 s" · "6–12 reps"
  metaFaixa: string | null; // contexto quando há alvo único: "faixa 8–15"
  placeholderAlvo: string;  // placeholder do input
  cargaHint: string | null; // "tente ~42,5 kg"
  evoluiuHint: string | null;
  /** Hint de escada (V8.3): direção + degrau-alvo ({id,nome}); null = sem sugestão. */
  hintDirecao: 'sobe' | 'desce' | null;
  hintAlvo: { id: string; nome: string } | null;
  /** B7: última ação foi calibração manual → "Sua meta foi recalibrada…" (consome no próximo feedback). */
  recalibrado: boolean;
  /** RIR-alvo da semana do mesociclo (v2 §3: rampa 3→1); null = prescrição fora do ciclo. */
  rirAlvoSemana: number | null;
  /** 🔒 Item de CARDIO da rotina (DF 2026-07-27 — registro unificado): concluí-lo abre o
   *  MESMO registro de cardio, com a modalidade pré-preenchida. */
  cardio: { modalidade: ModalidadeCardio } | null;
}

/** Estimativa de %1RM a partir da faixa de reps (Epley invertido), piso de 6 reps. */
function bandaRM(reps: { min: number; max: number }): string {
  const r = (n: number) => Math.round((30 / (30 + Math.max(6, n))) * 100);
  const alto = r(reps.min); // menos reps → % maior
  const baixo = r(reps.max);
  return `≈ ${baixo}–${alto}% do seu máximo`;
}

function fmt(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

export interface ResumoSessao {
  dia: string;
  series: number;
  volumeKg: number;
  feedback: Record<string, Feedback>;
  /** RIR-alvo da semana do ciclo NA DATA da sessão (v2 §3) — âncora da autorregulação
   *  (`feedbackRefinado`); ausente em sessões antigas (fallback: piso da prescrição). */
  rirAlvo?: number;
  /** Detalhe por exercício para o modal "Detalhe da sessão" no Histórico + a curva de cargas.
   *  `id` = id do exercício (chave estável entre sessões p/ a progressão de carga).
   *  Campos opcionais vêm do registro manual: `custom` (fora da biblioteca — NÃO alimenta a
   *  curva de cargas), `rir` e `variacao` (peso corporal). */
  exercicios: {
    /** `sets[].rir` = RIR NUMÉRICO por série (v2 §3/§5, DF 2026-07-08) — opcional; alimenta
     *  a autorregulação (`feedbackRefinado`). O `rir` por exercício (legado do manual) segue lido. */
    id: string; nome: string; loaded: boolean; fb: Feedback | null; sets: { reps: string; kg: string; rir?: string }[];
    custom?: boolean; rir?: string; variacao?: string;
    /** true se o exercício foi pausado por dor nesta sessão (re-check de runtime) —
     *  persiste p/ o motivo "em pausa por dor" dos favoritos (B5, DF 2026-07-04). */
    pausado?: boolean;
    /** Payload de CALIBRAÇÃO (só em sessões `tipo:'calibracao'` — B2, DF 2026-07-04):
     *  exatamente uma das formas {cargaKg,reps} | {degrauId,reps} | {modificacaoIdx,segundos}. */
    calibracao?: { cargaKg?: number; reps?: number; degrauId?: string; modificacaoIdx?: number; segundos?: number };
  }[];
}

export default function SessaoTreino({ dia, prescricao, progresso, deload, exercicioPorId, onCalibrar, onSair, onConcluir, onRegistrarCardio, pesoKg }: {
  dia: DiaTreino;
  prescricao: PrescricaoFITT;
  /** Alvo progredido por exercício (Bloco B), derivado do histórico; ausente na 1ª sessão. */
  progresso?: Record<string, ProgressoExercicio>;
  /** Semana de alívio ativa → corta ~metade das séries, mantém movimentos (cofre §Deload). */
  deload?: boolean;
  /** Resolve um exercício da biblioteca por id (overlay de adoção + "Ver variação"). */
  exercicioPorId?: (id: string) => Exercise | undefined;
  /** Grava calibração/adoção de degrau como evento no histórico (B2/B3, DF 2026-07-04). */
  onCalibrar?: (itens: { id: string; nome: string; calibracao: NonNullable<ResumoSessao['exercicios'][number]['calibracao']> }[]) => void;
  onSair: () => void;
  onConcluir: (resumo: ResumoSessao) => void;
  /** 🔒 CAMINHO ÚNICO de registro de cardio (DF 2026-07-27): o item da rotina sai pelo
   *  MESMO `registrarCardio` da tela avulsa. Ausente = a sessão não oferece o registro. */
  onRegistrarCardio?: (payload: { modalidade: ModalidadeCardio; intensidade: IntensidadeCardio; minutos: number; met: number; kcal: number }) => void;
  /** Peso do usuário — entra só na estimativa de kcal do registro de cardio. */
  pesoKg?: number;
}) {
  // "Ver variação": detalhe em LEITURA do degrau-alvo (nunca troca nada — V8.3).
  const [verVariacao, setVerVariacao] = useState<Exercise | null>(null);
  // "Muito fácil" (V8.1): índice do exercício com o modal de calibração aberto.
  const [calibrando, setCalibrando] = useState<number | null>(null);
  const exs: ExView[] = dia.slots.map((sl) => {
    const comp = sl.padrao !== 'isolado';
    const reps = comp ? prescricao.repsComposto : prescricao.repsIsolado;
    const desc = comp ? prescricao.descansoCompostoSeg : prescricao.descansoIsoladoSeg;
    // Isométricos (cofre): registram SEGUNDOS pela faixa do nível; tratados como time-only.
    const repUnit = repUnitDe(sl.exercicio.id);
    const faixaSeg = repUnit === 'segundos' ? faixaSegundos(sl.exercicio.id, prescricao.nivel) : null;
    const loaded = repUnit === 'segundos' ? false : (sl.exercicio.equipamentoDetalhe ?? '') !== 'Peso corporal';

    // --- Progressão viva (Bloco B) ---------------------------------------------------------
    const estado = progresso?.[sl.exercicio.id]?.estado;
    const esSeg = repUnit === 'segundos';
    const modo = estado?.modo ?? (loaded ? 'carga' : 'peso_corporal');
    const faixaCtx = esSeg && faixaSeg ? faixaSeg : reps; // contexto (min–max)
    const unidade = esSeg ? 's' : 'reps';
    // séries efetivas: max(rampa da semana, progressão, mínimo) — a rampa do mesociclo
    // (v2 §1, `sl.series`) levanta todos; a progressão +1 série do peso corporal pode
    // passar à frente. (`estado?.series ?? sl.series` congelaria usuários de carga no
    // mínimo: a progressão nunca toca `series` no modo carga.)
    // deload corta ~metade, mantém o movimento — cofre §Deload.
    const seriesBase = Math.max(sl.series ?? 0, estado?.series ?? 0, prescricao.seriesPorExercicio.min);
    const nSetsEx = deload ? Math.max(1, Math.ceil(seriesBase / 2)) : seriesBase;
    // alvo único (peso corporal / hold) só quando já há progressão; senão mostra a faixa
    const temAlvoUnico = modo === 'peso_corporal' && !!estado;
    const bandaStr = esSeg && faixaSeg ? `${rotuloFaixaSeg(faixaSeg)} ${unidade}` : `${reps.min}–${reps.max} ${unidade}`;
    const metaCurta = temAlvoUnico ? `${estado!.repsAlvo} ${unidade}` : bandaStr;
    const metaFaixa = temAlvoUnico ? `faixa ${faixaCtx.min}–${faixaCtx.max}${esSeg && faixaSeg?.aberto ? '+' : ''}` : null;
    const placeholderAlvo = temAlvoUnico ? String(estado!.repsAlvo) : (esSeg && faixaSeg ? `${faixaSeg.min}–${faixaSeg.max}` : `${reps.min}–${reps.max}`);
    const cargaHint = modo === 'carga' && estado?.cargaKg ? `tente ~${r1(estado.cargaKg)} kg` : null;
    const prog = progresso?.[sl.exercicio.id];
    const recalibrado = prog?.recalibrado ?? false;
    // B7: quando a última ação foi calibração manual, o hint É "meta recalibrada" — o de
    // evolução automática não concorre com ele.
    const evoluiuHint = recalibrado ? null : hintEvolucao(prog?.ultimaAcao);
    // Hint de escada (V8.3): descida tem precedência (difícil 2× é sinal mais urgente que
    // a subida especulativa); ambos filtrados por equipamento no adaptador.
    const hintDirecao: ExView['hintDirecao'] = prog?.sugereDescida && prog.variacaoAnterior ? 'desce' : prog?.proximaVariacao ? 'sobe' : null;
    const hintAlvo = hintDirecao === 'desce' ? prog!.variacaoAnterior! : hintDirecao === 'sobe' ? prog!.proximaVariacao! : null;
    // Overlay B3: degrau ASSUMIDO → a sessão exibe o exercício efetivo (nome/grupos/como
    // fazer); as chaves de progressão/feedback continuam no id ORIGINAL do slot.
    const efetivo = exercicioPorId ? (exercicioEfetivo(sl.exercicio.id, progresso, exercicioPorId) ?? sl.exercicio) : sl.exercicio;

    return {
      id: sl.exercicio.id,
      nome: efetivo.nomePt,
      grupos: efetivo.grupoMuscular,
      loaded,
      reps,
      rir: prescricao.rir,
      restSeg: Math.round((desc.min + desc.max) / 2),
      comoFazer: efetivo.comoFazer,
      repUnit,
      faixaSeg,
      nSetsEx,
      metaCurta,
      metaFaixa,
      placeholderAlvo,
      cargaHint,
      evoluiuHint,
      hintDirecao,
      hintAlvo,
      recalibrado,
      rirAlvoSemana: prescricao.rirAlvoSemana ?? null,
      // 🔒 O padrão do SLOT decide (é ele que o montador alocou como cardio), não o nome.
      cardio: sl.padrao === 'cardio' ? { modalidade: modalidadeDoExercicio(sl.exercicio.id) } : null,
    };
  });
  const nSets = prescricao.seriesPorExercicio.min;
  // Faixa REAL de séries desta sessão — na retomada ela cai abaixo do piso da prescrição,
  // então a linha do intro não pode anunciar a banda genérica do nível.
  const seriesMin = exs.length ? Math.min(...exs.map((e) => e.nSetsEx)) : nSets;
  const seriesMax = exs.length ? Math.max(...exs.map((e) => e.nSetsEx)) : prescricao.seriesPorExercicio.max;

  const [fase, setFase] = useState<'intro' | 'exec' | 'summary'>('intro');
  // 🔒 Registro de cardio UNIFICADO (DF 2026-07-27): índice do item de cardio cujo registro
  // está aberto. Ele é o MESMO componente da tela avulsa — não existe segunda fonte.
  const [cardioAberto, setCardioAberto] = useState<number | null>(null);
  const [cur, setCur] = useState(0);
  const [showRM, setShowRM] = useState(false);
  const [dorOpen, setDorOpen] = useState(false);
  const [estados, setEstados] = useState<ExState[]>(
    exs.map((e) => ({ sets: Array.from({ length: e.nSetsEx }, () => ({ reps: '', kg: '', rir: '', done: false })), fb: null, paused: false })),
  );

  // Timer de descanso.
  const [rest, setRest] = useState<{ left: number; total: number } | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (restRef.current) clearInterval(restRef.current); }, []);
  function iniciarDescanso(seg: number) {
    if (restRef.current) clearInterval(restRef.current);
    setRest({ left: seg, total: seg });
    restRef.current = setInterval(() => {
      setRest((r) => {
        if (!r) return r;
        if (r.left <= 1) { if (restRef.current) clearInterval(restRef.current); return null; }
        return { ...r, left: r.left - 1 };
      });
    }, 1000);
  }
  function pararDescanso() { if (restRef.current) clearInterval(restRef.current); setRest(null); }

  const ex = exs[cur]!;
  const est = estados[cur]!;
  const total = exs.length;

  function setSet(i: number, patch: Partial<SetRow>) {
    setEstados((prev) => prev.map((e, ei) => (ei === cur ? { ...e, sets: e.sets.map((s, si) => (si === i ? { ...s, ...patch } : s)) } : e)));
  }
  function toggleSet(i: number) {
    const ser = est.sets[i]!;
    const ligando = !ser.done;
    setSet(i, { done: ligando });
    if (ligando) iniciarDescanso(ex.restSeg); else pararDescanso();
  }
  function setFb(f: Feedback) {
    setEstados((prev) => prev.map((e, ei) => (ei === cur ? { ...e, fb: f } : e)));
  }
  function pausarEx() {
    setEstados((prev) => prev.map((e, ei) => (ei === cur ? { ...e, paused: true } : e)));
    setDorOpen(false);
  }

  const doneCount = est.sets.filter((s) => s.done).length;
  const ehUltimo = cur === total - 1;

  function avancar() {
    pararDescanso();
    setShowRM(false);
    if (ehUltimo) { setFase('summary'); window.scrollTo(0, 0); }
    else { setCur((c) => c + 1); window.scrollTo(0, 0); }
  }
  function voltar() { pararDescanso(); setShowRM(false); setCur((c) => Math.max(0, c - 1)); window.scrollTo(0, 0); }

  // Resumo
  const totalDoneSets = estados.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalVol = estados.reduce((n, e, ei) => {
    if (!exs[ei]!.loaded) return n;
    return n + e.sets.filter((s) => s.done).reduce((v, s) => v + (Number(s.reps) || 0) * (Number(s.kg) || 0), 0);
  }, 0);

  function concluir() {
    const fbMap: Record<string, Feedback> = {};
    estados.forEach((e, ei) => { if (e.fb) fbMap[exs[ei]!.id] = e.fb; });
    const exercicios = exs.map((ex, ei) => ({
      id: ex.id,
      nome: ex.nome,
      loaded: ex.loaded,
      fb: estados[ei]!.fb,
      sets: estados[ei]!.sets.filter((s) => s.done).map((s) => ({ reps: s.reps, kg: s.kg, ...(s.rir !== '' ? { rir: s.rir } : {}) })),
      // Pausa por dor PERSISTE no histórico (insumo do motivo "em pausa por dor" — B5).
      ...(estados[ei]!.paused ? { pausado: true } : {}),
    }));
    onConcluir({ dia: dia.nome, series: totalDoneSets, volumeKg: totalVol, feedback: fbMap, exercicios, ...(prescricao.rirAlvoSemana != null ? { rirAlvo: prescricao.rirAlvoSemana } : {}) });
  }

  // 🔒 Registro de cardio aberto DE DENTRO da sessão: mesma peça, mesmo `onSalvar`. Sai
  // pelo `registrarCardio` do Painel, exatamente como a tela avulsa.
  if (cardioAberto != null && onRegistrarCardio) {
    const item = exs[cardioAberto]!;
    return (
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '32px 20px 60px', animation: `evkScreenIn .4s ${EASE}` }}>
        <RegistrarCardio
          pesoKg={pesoKg ?? 70}
          modalidadeInicial={item.cardio?.modalidade}
          nomeDoItem={item.nome}
          embutido
          onSalvar={(payload) => { onRegistrarCardio(payload); setCardioAberto(null); avancar(); }}
          onCancelar={() => setCardioAberto(null)}
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', animation: `evkScreenIn .5s ${EASE}` }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(13,40,24,.85)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(234,229,219,.1)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '13px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Logo size={24} />
            <span style={{ fontWeight: 700, fontSize: '.95rem', color: 'rgba(234,229,219,.85)' }}>{dia.nome}</span>
          </div>
          <button onClick={onSair} className="evk-voltar" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.75)', fontWeight: 600, fontSize: '.85rem', padding: '8px 15px', borderRadius: 10, cursor: 'pointer' }}>Sair</button>
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 22px 80px' }}>

        {fase === 'intro' && (
          <div style={{ animation: `evkStepIn .45s ${EASE}` }}>
            <div style={{ fontSize: '.78rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00', marginBottom: 8 }}>Treino de hoje</div>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-.02em' }}>{dia.nome}</h1>
            <p style={{ margin: '0 0 24px', color: 'rgba(234,229,219,.6)', fontSize: '.98rem' }}>{total} exercícios · {seriesMin}–{seriesMax} séries por exercício · {prescricao.rirAlvoSemana != null ? `RIR alvo ${prescricao.rirAlvoSemana}` : `RIR ${prescricao.rir.min}–${prescricao.rir.max}`}</p>
            {deload && <AvisoAlivio />}
            <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '10px 20px', marginBottom: 24 }}>
              {exs.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 0', borderBottom: i === exs.length - 1 ? 'none' : '1px solid rgba(234,229,219,.07)' }}>
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: '1rem' }}>{e.nome}</div><div style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.5)' }}>{e.repUnit === 'segundos' ? 'Isométrico · tempo' : `RIR ${e.rir.min}–${e.rir.max}`}</div></div>
                  <span style={{ flexShrink: 0, fontSize: '.85rem', fontWeight: 600, color: '#BDFF00', background: 'rgba(189,255,0,.1)', padding: '6px 12px', borderRadius: 999 }}>{e.nSetsEx} × {e.metaCurta}</span>
                </div>
              ))}
            </div>
            <button onClick={() => { setFase('exec'); window.scrollTo(0, 0); }} className="hov-btn" style={btnNeon}>Iniciar treino</button>
            <p style={{ textAlign: 'center', margin: '16px 0 0', fontSize: '.88rem' }}><a onClick={onSair} style={{ color: 'rgba(234,229,219,.6)', textDecoration: 'underline', cursor: 'pointer' }}>Voltar ao painel</a></p>
          </div>
        )}

        {fase === 'exec' && (
          <div style={{ animation: `evkStepIn .4s ${EASE}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '.78rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)' }}>Exercício {cur + 1} de {total}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(234,229,219,.1)', borderRadius: 99, overflow: 'hidden', marginBottom: 22 }}>
              <div style={{ height: '100%', width: `${((cur + 1) / total) * 100}%`, background: '#BDFF00', borderRadius: 99, boxShadow: '0 0 12px rgba(189,255,0,.5)', transition: `width .45s ${EASE}` }} />
            </div>

            {/* demo slot (faceless placeholder) */}
            <div style={{ position: 'relative', height: 170, borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(160deg, rgba(22,163,74,.14), rgba(15,15,14,.6))', border: '1px solid rgba(234,229,219,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <svg viewBox="0 0 200 120" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}>
                <path d="M16 104 Q70 92 110 56 T188 18" stroke="rgba(189,255,0,.45)" strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray={600} strokeDashoffset={600} style={{ animation: `evkDraw 2.4s cubic-bezier(.16,.84,.3,1) infinite` }} />
                <circle cx={110} cy={56} r={4} fill="#BDFF00" style={{ animation: 'evkRise 2s ease-in-out infinite .3s' }} />
                <circle cx={188} cy={18} r={6} fill="#BDFF00" style={{ animation: 'evkRise 2s ease-in-out infinite .7s' }} />
              </svg>
              <div style={{ position: 'relative', textAlign: 'center' }}>
                <div style={{ width: 46, height: 46, margin: '0 auto 8px', borderRadius: 13, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={24} height={24} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={5} r={2.4} stroke="#BDFF00" strokeWidth={1.8} /><path d="M12 8v6M12 11l-5 3M12 11l5 3M12 14l-3 6M12 14l3 6" stroke="#BDFF00" strokeWidth={1.8} strokeLinecap="round" /></svg></div>
                <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'rgba(234,229,219,.7)' }}>Demonstração</div>
                <div style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.45)' }}>animação faceless · em breve</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div><h2 style={{ margin: '0 0 3px', fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-.02em' }}>{ex.nome}{est.paused && <span style={{ marginLeft: 10, fontSize: '.68rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#E5484D', background: 'rgba(229,72,77,.12)', borderRadius: 6, padding: '2px 7px' }}>Pausado</span>}</h2><div style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.5)' }}>{ex.grupos}</div></div>
            </div>

            <details style={{ marginBottom: 18 }}>
              <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.84rem', padding: '8px 13px', borderRadius: 10 }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={1.8} /><path d="M12 11v5M12 8.2v.01" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>Como fazer</summary>
              <p style={{ margin: '12px 0 0', fontSize: '.9rem', color: 'rgba(234,229,219,.65)', lineHeight: 1.55 }}>{ex.comoFazer}</p>
            </details>

            {temErrosComuns(ex.id) && (
              <details style={{ marginBottom: 18 }}>
                <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.84rem', padding: '8px 13px', borderRadius: 10 }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" /><path d="M12 10v4M12 17v.01" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>Erros comuns</summary>
                <div style={{ margin: '12px 0 0' }}><ListaErrosComuns exId={ex.id} /></div>
              </details>
            )}

            {/* B7 (DF 2026-07-04): hint de recalibração — mesma família do hint de progressão,
                posicionado ANTES dos chips (design V8.1 §7); consome no próximo feedback. */}
            {ex.recalibrado && <p style={{ margin: '0 0 13px 2px', display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: '.86rem', fontWeight: 600, color: '#BDFF00', animation: `evkStepIn .4s ${EASE}` }}><svg width={17} height={17} viewBox="0 0 24 24" fill="none"><path d="M4 18 10 12 14 16 20 8M20 8h-5M20 8v5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>Sua meta foi recalibrada com base no que você registrou.</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: '.85rem', fontWeight: 600, color: '#BDFF00', background: 'rgba(189,255,0,.1)', borderRadius: 9, padding: '7px 12px' }}>{ex.nSetsEx} × {ex.metaCurta}</span>
              {/* Progressão (Bloco B): sugestão de carga a partir do que você levantou. */}
              {ex.cargaHint && <span style={{ fontSize: '.85rem', fontWeight: 600, color: '#BDFF00', background: 'rgba(189,255,0,.1)', borderRadius: 9, padding: '7px 12px' }}>{ex.cargaHint}</span>}
              {/* RIR não se aplica a holds (cofre §Isométricos) — só o feedback fácil/na medida/difícil. */}
              {ex.repUnit !== 'segundos' && <span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.8)', background: 'rgba(234,229,219,.06)', borderRadius: 9, padding: '7px 12px' }}>{ex.rirAlvoSemana != null ? `RIR alvo: ${ex.rirAlvoSemana}` : `RIR: ${ex.rir.min}–${ex.rir.max}`}</span>}
              <span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.8)', background: 'rgba(234,229,219,.06)', borderRadius: 9, padding: '7px 12px' }}>Descanso {ex.restSeg}s</span>
            </div>
            {/* Hint de evolução (subiu de meta / carga / degrau) — só quando houve progressão real. */}
            {ex.evoluiuHint && <p style={{ margin: '0 0 10px 2px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.8rem', color: '#BDFF00' }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M4 18 10 12 14 16 20 8M20 8h-5M20 8v5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>{ex.evoluiuHint}</p>}
            {/* Escada de dificuldade (V8.3 Estados 4/5): cartão de sugestão — subir/descer é a
                mesma família, só a seta inverte. O app sugere, você decide (B3: adoção explícita). */}
            {ex.hintDirecao && ex.hintAlvo && (
              <HintVariacao
                direcao={ex.hintDirecao === 'sobe' ? 'sobe' : 'desce'}
                nomeVariacao={ex.hintAlvo.nome}
                onVerVariacao={() => { const alvo = exercicioPorId?.(ex.hintAlvo!.id); if (alvo) setVerVariacao(alvo); }}
                onAssumir={() => onCalibrar?.([{ id: ex.id, nome: ex.nome, calibracao: { degrauId: ex.hintAlvo!.id, ...(progresso?.[ex.id]?.estado.repsAlvo != null && ex.repUnit !== 'segundos' ? { reps: progresso[ex.id]!.estado.repsAlvo } : {}) } }])}
              />
            )}
            {/* Glosa amigável do RIR (jargão → linguagem simples). Não se aplica a isométricos. */}
            {ex.repUnit === 'segundos'
              ? <p style={{ margin: '0 0 18px', fontSize: '.8rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>Exercício <strong style={{ color: 'rgba(234,229,219,.75)', fontWeight: 600 }}>isométrico</strong>: segure a posição pelo tempo-alvo, com boa forma. Aqui não tem RIR — o que guia é como foi (fácil / na medida / difícil).</p>
              : <p style={{ margin: '0 0 18px', fontSize: '.8rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}><strong style={{ color: 'rgba(234,229,219,.75)', fontWeight: 600 }}>RIR</strong> é a reserva: quantas repetições você ainda conseguiria fazer no fim da série. {ex.rirAlvoSemana != null ? `Alvo desta semana do ciclo: pare com ~${ex.rirAlvoSemana} na reserva` : `Pare com ${ex.rir.min}–${ex.rir.max} na reserva`} — sem ir até a falha. Se quiser, registre o RIR de cada série (dá mais precisão ao ajuste).</p>}

            {/* %1RM opt-in (só com carga) */}
            {ex.loaded && (
              <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 13, padding: '13px 16px', marginBottom: 18 }}>
                <div onClick={() => setShowRM((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '.92rem', fontWeight: 500, color: 'rgba(234,229,219,.85)' }}>Prefiro ver por % do meu máximo</span>
                    {/* Glosa amigável do "% do máximo" (jargão → linguagem simples). */}
                    <span style={{ display: 'block', fontSize: '.78rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.45, marginTop: 2 }}>Quanto do peso máximo que você levantaria numa única repetição.</span>
                  </span>
                  <span style={{ width: 44, minWidth: 44, height: 26, borderRadius: 999, padding: 3, transition: 'background .25s ease', background: showRM ? '#BDFF00' : 'rgba(234,229,219,.18)', display: 'flex', alignItems: 'center' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: showRM ? '#0D2818' : '#EAE5DB', transition: `transform .25s ${EASE}`, transform: showRM ? 'translateX(18px)' : 'translateX(0)' }} />
                  </span>
                </div>
                {showRM && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(234,229,219,.08)' }}>
                    <div style={{ fontSize: '.95rem', fontWeight: 700, color: '#BDFF00', marginBottom: 4 }}>{bandaRM(ex.reps)}</div>
                    <div style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>Estimado a partir da sua faixa de reps — nunca testamos seu 1RM real. O piso de segurança é de 6 reps.</div>
                  </div>
                )}
              </div>
            )}

            {/* Linha-guia: o que registrar + a meta do dia (progredida), com a faixa como contexto. */}
            {ex.repUnit === 'segundos'
              ? <p style={{ margin: '0 0 8px 2px', fontSize: '.8rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.5 }}>Registre o tempo (em segundos) de cada série. Meta de hoje: <strong style={{ color: 'rgba(234,229,219,.75)', fontWeight: 600 }}>{ex.nSetsEx} séries de {ex.metaCurta}</strong>{ex.metaFaixa ? ` (${ex.metaFaixa})` : ''} · mínimo {PISO_HOLD_SEG} s.</p>
              : <p style={{ margin: '0 0 8px 2px', fontSize: '.8rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.5 }}>Registre cada série abaixo: {ex.loaded ? 'quantas repetições e o peso' : 'quantas repetições'}. Meta de hoje: <strong style={{ color: 'rgba(234,229,219,.75)', fontWeight: 600 }}>{ex.nSetsEx} séries de {ex.metaCurta}</strong>{ex.metaFaixa ? ` (${ex.metaFaixa})` : ''}{ex.cargaHint ? ` · ${ex.cargaHint}` : ''}.</p>}

            {/* tabela de séries */}
            <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: '8px 18px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0 6px', fontSize: '.72rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.45)' }}>
                <span style={{ width: 36, minWidth: 36 }}>Série</span>
                <span style={{ flex: 1 }}>{ex.repUnit === 'segundos' ? 'Segundos' : 'Reps'}</span>
                {ex.loaded && <span style={{ flex: 1 }}>Carga (kg)</span>}
                {/* RIR numérico por série (v2 §3) — não se aplica a holds. */}
                {ex.repUnit !== 'segundos' && <span style={{ flex: 1 }}>RIR</span>}
                <span style={{ width: 36, minWidth: 36, textAlign: 'center' }}>✓</span>
              </div>
              {est.sets.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                  <span style={{ width: 36, minWidth: 36, fontWeight: 800, color: 'rgba(234,229,219,.3)', fontSize: '1rem' }}>{i + 1}</span>
                  <input type="number" inputMode="numeric" value={r.reps} onChange={(e) => setSet(i, { reps: e.target.value })} placeholder={ex.placeholderAlvo} style={inputCelula} />
                  {ex.loaded && <input type="number" inputMode="numeric" value={r.kg} onChange={(e) => setSet(i, { kg: e.target.value })} placeholder="kg" style={inputCelula} />}
                  {ex.repUnit !== 'segundos' && <input type="number" inputMode="numeric" min={0} max={5} value={r.rir} onChange={(e) => setSet(i, { rir: e.target.value })} placeholder={ex.rirAlvoSemana != null ? String(ex.rirAlvoSemana) : 'RIR'} style={inputCelula} />}
                  <button onClick={() => toggleSet(i)} style={{ width: 36, minWidth: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .25s ease', border: `1px solid ${r.done ? '#BDFF00' : 'rgba(234,229,219,.2)'}`, background: r.done ? '#BDFF00' : 'transparent', color: r.done ? '#0D2818' : 'rgba(234,229,219,.3)' }}><svg width={16} height={16} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="currentColor" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                </div>
              ))}
              <div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.5)', paddingTop: 12 }}>{doneCount} de {est.sets.length} séries concluídas</div>
            </div>

            {/* timer de descanso */}
            {rest && (
              <div style={{ background: 'linear-gradient(165deg, rgba(189,255,0,.1), rgba(15,15,14,.5))', border: '1px solid rgba(189,255,0,.3)', borderRadius: 16, padding: '18px 20px', marginTop: 16, animation: `evkPop .3s ${EASE}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: '.78rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.6)' }}>Descanso</span>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#BDFF00', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{fmt(rest.left)}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(234,229,219,.12)', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}><div style={{ height: '100%', width: `${(rest.left / rest.total) * 100}%`, background: '#BDFF00', borderRadius: 99, transition: 'width 1s linear' }} /></div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setRest((r) => (r ? { left: r.left + 15, total: r.total + 15 } : r))} className="evk-voltar" style={{ flex: 1, background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.16)', color: '#EAE5DB', fontWeight: 600, fontSize: '.9rem', padding: 10, borderRadius: 11, cursor: 'pointer' }}>+15 s</button>
                  <button onClick={pararDescanso} style={{ flex: 1, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.9rem', padding: 10, border: 'none', borderRadius: 11, cursor: 'pointer' }}>Pular descanso</button>
                </div>
              </div>
            )}

            {/* como foi */}
            <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: '16px 18px', marginTop: 16 }}>
              <div style={{ fontSize: '.9rem', fontWeight: 600, marginBottom: 4 }}>Como foi este exercício?</div>
              <div style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.5)', marginBottom: 12 }}>Seu retorno ajusta o próximo treino.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(['facil', 'na_medida', 'dificil'] as Feedback[]).map((f) => {
                  const on = est.fb === f;
                  return <button key={f} onClick={() => setFb(f)} style={{ cursor: 'pointer', flex: 1, minWidth: 88, padding: '10px 6px', borderRadius: 10, fontWeight: 600, fontSize: '.85rem', transition: 'all .25s ease', border: `1px solid ${on ? '#BDFF00' : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.12)' : 'transparent', color: on ? '#BDFF00' : 'rgba(234,229,219,.62)' }}>{f === 'facil' ? 'Fácil' : f === 'na_medida' ? 'Na medida' : 'Difícil'}</button>;
                })}
                {/* 4ª pílula (V8.1, DF #11): "Muito fácil" NÃO registra feedback de 1 toque —
                    abre a CALIBRAÇÃO manual; o resultado dela É a calibração salva. */}
                {onCalibrar && (
                  <button onClick={() => setCalibrando(cur)} style={{ cursor: 'pointer', flex: 1, minWidth: 118, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 6px', borderRadius: 11, fontWeight: 700, fontSize: '.85rem', transition: 'all .2s ease', border: '1.5px solid rgba(189,255,0,.55)', background: 'rgba(189,255,0,.06)', color: '#BDFF00' }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M4 8h9M18 8h2M4 16h2M11 16h9" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /><circle cx={15.5} cy={8} r={2.4} stroke="currentColor" strokeWidth={2} /><circle cx={8.5} cy={16} r={2.4} stroke="currentColor" strokeWidth={2} /></svg>
                    Muito fácil
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" style={{ opacity: 0.75 }}><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* senti dor */}
            <div style={{ textAlign: 'center', margin: '16px 0 0' }}>
              <button onClick={() => setDorOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: 'rgba(229,72,77,.85)', fontWeight: 600, fontSize: '.86rem', padding: 8, cursor: 'pointer', textDecoration: 'underline' }}><svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M12 8.5v4M12 16h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>Senti dor neste exercício</button>
            </div>

            {/* 🔒 Item de CARDIO: concluí-lo abre o MESMO registro de cardio da tela avulsa
                (DF 2026-07-27). PULAR não registra nada — o avanço é uma ação separada,
                para não inventar sessão que não houve. */}
            {ex.cardio && onRegistrarCardio && (
              <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(189,255,0,.28)', borderRadius: 16, padding: '16px 18px', marginTop: 16 }}>
                <div style={{ fontSize: '.9rem', fontWeight: 700, marginBottom: 4 }}>Este é o seu cardio de hoje</div>
                <p style={{ margin: '0 0 12px', fontSize: '.84rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.55 }}>
                  Ao concluir, você registra {ROTULO_MODALIDADE[ex.cardio.modalidade].toLowerCase()} com a duração e a intensidade reais — é o mesmo registro da aba Treino, e ele conta uma vez só.
                </p>
                <button onClick={() => setCardioAberto(cur)} className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.95rem', padding: '13px 20px', border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 44 }}>Registrar e concluir</button>
              </div>
            )}

            {/* nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22 }}>
              {cur > 0 && <button onClick={voltar} className="evk-voltar" style={{ background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '1rem', padding: '14px 22px', borderRadius: 13, cursor: 'pointer' }}>Anterior</button>}
              <button onClick={avancar} className={ex.cardio && onRegistrarCardio ? 'evk-voltar' : 'hov-btn'} style={ex.cardio && onRegistrarCardio
                ? { flex: 1, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '1rem', padding: 14, borderRadius: 13, cursor: 'pointer' }
                : { flex: 1, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1.02rem', padding: 14, border: 'none', borderRadius: 13, cursor: 'pointer' }}>
                {ex.cardio && onRegistrarCardio ? (ehUltimo ? 'Pular e concluir treino' : 'Pular este cardio') : (ehUltimo ? 'Concluir treino' : 'Próximo exercício')}
              </button>
            </div>
          </div>
        )}

        {fase === 'summary' && (
          <div style={{ animation: `evkStepIn .45s ${EASE}` }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(189,255,0,.14)', border: '1px solid rgba(189,255,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}><svg width={30} height={30} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#BDFF00" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <h1 style={{ margin: '0 0 8px', fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.02em' }}>Resumo do treino</h1>
            <p style={{ margin: '0 0 22px', color: 'rgba(234,229,219,.62)', fontSize: '.98rem', lineHeight: 1.55 }}>Mais um dia no plano. Constância é o que move a curva.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
              <div style={cardStat}><div style={statLabel}>Séries</div><div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em' }}>{totalDoneSets}</div></div>
              <div style={cardStat}><div style={statLabel}>Volume</div><div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em', color: '#BDFF00' }}>{totalVol.toLocaleString('pt-BR')}<span style={{ fontSize: '.85rem', fontWeight: 500, color: 'rgba(234,229,219,.5)' }}> kg</span></div></div>
              <div style={cardStat}><div style={statLabel}>Exercícios</div><div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em' }}>{total}</div></div>
            </div>
            {/* Glosa amigável do "Volume" (jargão → linguagem simples; = Σ reps × carga). */}
            <p style={{ margin: '0 0 18px 2px', fontSize: '.8rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}><strong style={{ color: 'rgba(234,229,219,.75)', fontWeight: 600 }}>Volume</strong> é o peso total que você moveu hoje — repetições × carga, somando todas as séries. Exercícios só com o peso do corpo não entram na conta.</p>

            <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: '8px 20px', marginBottom: 18 }}>
              {exs.map((e, ei) => {
                const s = estados[ei]!;
                const ds = s.sets.filter((x) => x.done).length;
                const vol = e.loaded ? s.sets.filter((x) => x.done).reduce((v, x) => v + (Number(x.reps) || 0) * (Number(x.kg) || 0), 0) : 0;
                const fbLabel = s.fb === 'facil' ? 'Fácil' : s.fb === 'na_medida' ? 'Na medida' : s.fb === 'dificil' ? 'Difícil' : '—';
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 0', borderBottom: ei === exs.length - 1 ? 'none' : '1px solid rgba(234,229,219,.07)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ fontWeight: 600, fontSize: '.96rem' }}>{e.nome}</span>{s.paused && <span style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#E5484D', background: 'rgba(229,72,77,.12)', borderRadius: 6, padding: '2px 7px' }}>Pausado</span>}</div>
                      <div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>{ds}/{s.sets.length} séries · {fbLabel}</div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: '.85rem', fontWeight: 600, color: 'rgba(234,229,219,.7)' }}>{e.loaded ? `${vol.toLocaleString('pt-BR')} kg` : `${ds} séries`}</span>
                  </div>
                );
              })}
            </div>

            <button onClick={concluir} className="hov-btn" style={btnNeon}>Concluir treino</button>
          </div>
        )}
      </div>

      {/* MODAL · SENTI DOR */}
      {dorOpen && (
        <div onClick={() => setDorOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 216, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: 'linear-gradient(168deg, rgba(42,16,16,.96), rgba(15,15,14,.98))', border: '1px solid rgba(229,72,77,.35)', borderRadius: 22, padding: 26, boxShadow: '0 40px 90px -30px rgba(0,0,0,.8)', animation: `evkPop .3s ${EASE}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(229,72,77,.14)', border: '1px solid rgba(229,72,77,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><svg width={24} height={24} viewBox="0 0 24 24" fill="none"><path d="M12 8.5v4M12 16h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="#E5484D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <h2 style={{ margin: '0 0 10px', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-.01em' }}>Sentiu dor?</h2>
            <p style={{ margin: '0 0 22px', fontSize: '.94rem', color: 'rgba(234,229,219,.72)', lineHeight: 1.6 }}>Se for <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>dor</strong> (não o cansaço normal do esforço), pause este exercício e considere procurar um profissional. O resto do treino continua normalmente.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={pausarEx} style={{ width: '100%', background: 'rgba(229,72,77,.14)', border: '1px solid rgba(229,72,77,.5)', color: '#E5484D', fontWeight: 700, fontSize: '1rem', padding: 14, borderRadius: 13, cursor: 'pointer' }}>Pausar este exercício</button>
              <button onClick={() => setDorOpen(false)} className="evk-voltar" style={{ width: '100%', background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '1rem', padding: 14, borderRadius: 13, cursor: 'pointer' }}>Foi só o esforço, continuar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL · VER VARIAÇÃO (V8.3 — leitura; nunca troca nada) */}
      {verVariacao && <DetalheExercicio ex={verVariacao} readOnly onFechar={() => setVerVariacao(null)} />}

      {/* MODAL · CALIBRAÇÃO MANUAL (V8.1 "Muito fácil") */}
      {calibrando !== null && exercicioPorId && onCalibrar && (() => {
        const exC = exs[calibrando]!;
        const efetivoC = exercicioEfetivo(exC.id, progresso, exercicioPorId) ?? exercicioPorId(exC.id);
        if (!efetivoC) return null;
        return (
          <CalibracaoModal
            exercicioEfetivo={efetivoC}
            loaded={exC.loaded}
            nivel={prescricao.nivel}
            estado={progresso?.[exC.id]?.estado}
            exercicioPorId={exercicioPorId}
            onFechar={() => setCalibrando(null)}
            onSalvar={(payload) => { onCalibrar([{ id: exC.id, nome: efetivoC.nomePt, calibracao: payload }]); setCalibrando(null); }}
          />
        );
      })()}
    </div>
  );
}

const btnNeon: CSSProperties = { width: '100%', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1.08rem', padding: 16, border: 'none', borderRadius: 14, cursor: 'pointer' };
const inputCelula: CSSProperties = { flex: 1, width: '100%', minWidth: 0, boxSizing: 'border-box', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 10, padding: '10px 12px', color: '#EAE5DB', fontSize: '1rem', fontWeight: 600, outline: 'none' };
const cardStat: CSSProperties = { background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: 16 };
const statLabel: CSSProperties = { fontSize: '.74rem', color: 'rgba(234,229,219,.5)', marginBottom: 5 };

function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}

/**
 * Aviso "Semana de alívio" (deload — cofre §Deload): corta ~metade das séries, mantém os
 * movimentos, sugere −10% de carga. Tom acolhedor (recuperação faz parte), sem vermelho.
 */
function AvisoAlivio() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'linear-gradient(165deg, rgba(22,163,74,.12), rgba(15,15,14,.5))', border: '1px solid rgba(189,255,0,.28)', borderRadius: 16, padding: '14px 16px', marginBottom: 18 }}>
      <span style={{ width: 34, height: 34, minWidth: 34, borderRadius: 10, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-2 5 5 0 0 1 9 2c-2 4.5-9 9-9 9z" stroke="#BDFF00" strokeWidth={1.7} strokeLinejoin="round" /></svg></span>
      <div><div style={{ fontWeight: 700, fontSize: '.95rem', color: '#BDFF00', marginBottom: 2 }}>Semana de alívio</div><p style={{ margin: 0, fontSize: '.86rem', color: 'rgba(234,229,219,.7)', lineHeight: 1.5 }}>Reduzimos as séries e sugerimos aliviar ~10% da carga esta semana. Recuperar faz parte de progredir — na próxima semana começa um ciclo novo e você volta com tudo.</p></div>
    </div>
  );
}
