'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { substituirExercicio, substituirPrato } from '@/lib/engine';
import SessaoTreino, { type ResumoSessao } from './SessaoTreino';
import { EXERCISES_SEED, FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import type {
  CardapioItem, DiaTreino, NivelAtividade, NivelExperiencia, Objetivo, ResultadoMotor, ResultadoTreino, Sexo,
} from '@/lib/engine';
import type { Alergeno, EquipamentoDisp, Exercise, RecipeMacros } from '@/lib/data/types';

/**
 * Painel (área logada) — porte FIEL do Evokorpus App.dc.html (estilos inline exatos +
 * evkPop/evkScreenIn). Ligado ao motor determinístico real (gate/dieta/treino/F.2).
 */

export interface PerfilResumo {
  sexo: Sexo; idade: number; alturaCm: number; pesoKg: number; objetivo: Objetivo;
  nivelAtividade: NivelAtividade; nivelExperiencia: NivelExperiencia; equipamento: EquipamentoDisp;
  preferencia: 'vegano' | 'vegetariano' | null; alergenos: Alergeno[]; diasDisponiveis: number; tempoPorSessaoMin: number;
}

const EASE = 'cubic-bezier(.22,.61,.36,1)';
const r0 = (n: number) => Math.round(n);
const REFEICAO_LABEL: Record<string, string> = { cafe: 'Café', almoco: 'Almoço', jantar: 'Jantar', lanche: 'Lanche' };
const PADRAO_LABEL: Record<string, string> = { empurrar: 'Empurrar', puxar: 'Puxar', agachar: 'Agachar', dobradica_quadril: 'Dobradiça', core: 'Core', cardio: 'Cardio', isolado: 'Isolado' };
const OBJETIVO_LABEL: Record<Objetivo, string> = { emagrecimento: 'Emagrecer', massa: 'Ganhar massa', saude: 'Manter / Saúde' };
const ATIV_LABEL: Record<NivelAtividade, string> = { sedentario: 'Sedentário', leve: 'Leve', moderado: 'Moderado', intenso: 'Intenso', muito_intenso: 'Muito intenso' };
const PORCOES: { f: number; r: string }[] = [{ f: 0.5, r: '½' }, { f: 0.75, r: '¾' }, { f: 1, r: '1' }, { f: 1.25, r: '1¼' }, { f: 1.5, r: '1½' }, { f: 2, r: '2' }];

// estilos exatos do protótipo
const cardSoft: CSSProperties = { background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '20px 22px' };
const gradCard: CSSProperties = { background: 'linear-gradient(165deg, rgba(22,163,74,.1), rgba(15,15,14,.5))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 20, padding: 26 };
const kicker: CSSProperties = { fontSize: '.76rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)' };
const pill: CSSProperties = { fontSize: '.84rem', color: 'rgba(234,229,219,.8)', background: 'rgba(234,229,219,.06)', borderRadius: 8, padding: '6px 11px' };
const sec: CSSProperties = { animation: `evkPop .45s ${EASE}` };

function escalar(m: RecipeMacros, s: number): RecipeMacros {
  return { kcal: m.kcal * s, proteinaG: m.proteinaG * s, carboidratoG: m.carboidratoG * s, gorduraG: m.gorduraG * s };
}

type Aba = 'hoje' | 'treino' | 'dieta' | 'progresso' | 'perfil';
type Feedback = 'facil' | 'na_medida' | 'dificil';
interface OpcaoPrato { prato: CardapioItem['prato']; escala: number; macros: RecipeMacros; diaNew: RecipeMacros }
type Modal =
  | { tipo: 'prato'; idx: number; base: string; opcoes: OpcaoPrato[]; excl: string[] }
  | { tipo: 'porcao'; idx: number; base: string }
  | { tipo: 'exercicio'; d: number; s: number; base: string; opcoes: Exercise[]; excl: string[] }
  | null;

export default function Painel({ perfil, dieta, treino, onSair, desfechoC }: {
  perfil: PerfilResumo; dieta: ResultadoMotor; treino: ResultadoTreino; onSair: () => void; desfechoC?: boolean;
}) {
  const restricoes = { alergenos: perfil.alergenos, preferencia: perfil.preferencia };
  const [aba, setAba] = useState<Aba>('hoje');
  const [cardItens, setCardItens] = useState<CardapioItem[]>(dieta.cardapio?.itens ?? []);
  const [cardTotais, setCardTotais] = useState<RecipeMacros | null>(dieta.cardapio?.totais ?? null);
  const [rotinaDias, setRotinaDias] = useState<DiaTreino[]>(treino.rotina?.dias ?? []);
  const [trocados, setTrocados] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [pesos, setPesos] = useState<number[]>([perfil.pesoKg]);
  const [modal, setModal] = useState<Modal>(null);
  const [dataHoje, setDataHoje] = useState('');
  const [menu, setMenu] = useState(false);
  const [mostrarC, setMostrarC] = useState(desfechoC ?? (dieta.gate.comportamento === 'RESTRINGIR' || dieta.gate.comportamento === 'PISAR'));
  const [sessaoDia, setSessaoDia] = useState<number | null>(null);
  const [sessoesConcluidas, setSessoesConcluidas] = useState(0);

  function concluirSessao(r: ResumoSessao) {
    setSessoesConcluidas((n) => n + 1);
    setFeedback((p) => ({ ...p, ...r.feedback }));
    setSessaoDia(null);
    setAba('progresso');
    window.scrollTo(0, 0);
  }

  useEffect(() => { setDataHoje(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })); }, []);
  const marcar = (k: string) => setTrocados((prev) => new Set(prev).add(k));

  function gerarOpcoesPrato(idx: number, excluir: string[]): OpcaoPrato[] {
    if (!dieta.plano || !cardTotais) return [];
    const item = cardItens[idx]!;
    const outros = cardItens.filter((_, i) => i !== idx).map((c) => c.prato.id);
    const usados = new Set(excluir); const out: OpcaoPrato[] = [];
    for (let k = 0; k < 3; k++) {
      const rr = substituirPrato({ pratoAtual: item.prato, slot: item.refeicao, recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, plano: dieta.plano, totaisDiaAtual: cardTotais, escalaAtual: item.escala, restricoes, gosto: { excluirPratoIds: [...outros, ...usados] } });
      if (rr.status === 'ok' && rr.prato && rr.escala != null && rr.macrosNovo && rr.totaisDiaNovo) { out.push({ prato: rr.prato, escala: rr.escala, macros: rr.macrosNovo, diaNew: rr.totaisDiaNovo }); usados.add(rr.prato.id); } else break;
    }
    return out;
  }
  const abrirTrocaPrato = (idx: number) => { const o = gerarOpcoesPrato(idx, []); setModal({ tipo: 'prato', idx, base: cardItens[idx]!.prato.nome, opcoes: o, excl: o.map((x) => x.prato.id) }); };
  const maisVariedadePrato = () => { if (modal?.tipo !== 'prato') return; const n = gerarOpcoesPrato(modal.idx, modal.excl); if (n.length) setModal({ ...modal, opcoes: n, excl: [...modal.excl, ...n.map((x) => x.prato.id)] }); };
  function aplicarPrato(idx: number, o: OpcaoPrato) {
    const novos = cardItens.slice(); novos[idx] = { refeicao: cardItens[idx]!.refeicao, prato: o.prato, escala: o.escala, macros: o.macros };
    setCardItens(novos); setCardTotais(o.diaNew); marcar(`p${idx}`); setModal(null);
  }
  function aplicarPorcao(idx: number, f: number) {
    const item = cardItens[idx]!; const nm = escalar(item.macros, f); const novos = cardItens.slice();
    novos[idx] = { ...item, escala: item.escala * f, macros: nm }; setCardItens(novos);
    setCardTotais((prev) => prev ? { kcal: prev.kcal - item.macros.kcal + nm.kcal, proteinaG: prev.proteinaG - item.macros.proteinaG + nm.proteinaG, carboidratoG: prev.carboidratoG - item.macros.carboidratoG + nm.carboidratoG, gorduraG: prev.gorduraG - item.macros.gorduraG + nm.gorduraG } : prev);
    marcar(`p${idx}`); setModal(null);
  }
  function gerarOpcoesEx(d: number, s: number, excluir: string[]): Exercise[] {
    const atual = rotinaDias[d]!.slots[s]!.exercicio;
    const usados = new Set([...rotinaDias.flatMap((dia) => dia.slots.map((sl) => sl.exercicio.id)), ...excluir]); const out: Exercise[] = [];
    for (let k = 0; k < 3; k++) {
      const rr = substituirExercicio({ exercicioAtual: atual, equipamento: perfil.equipamento, nivelExperiencia: perfil.nivelExperiencia, exercises: EXERCISES_SEED, historicoRecenteIds: [...usados] });
      if (rr.status === 'ok' && rr.exercicio && !out.some((e) => e.id === rr.exercicio!.id)) { out.push(rr.exercicio); usados.add(rr.exercicio.id); } else break;
    }
    return out;
  }
  const abrirTrocaEx = (d: number, s: number) => { const o = gerarOpcoesEx(d, s, []); setModal({ tipo: 'exercicio', d, s, base: rotinaDias[d]!.slots[s]!.exercicio.nomePt, opcoes: o, excl: o.map((e) => e.id) }); };
  const maisVariedadeEx = () => { if (modal?.tipo !== 'exercicio') return; const n = gerarOpcoesEx(modal.d, modal.s, modal.excl); if (n.length) setModal({ ...modal, opcoes: n, excl: [...modal.excl, ...n.map((e) => e.id)] }); };
  function aplicarEx(d: number, s: number, ex: Exercise) {
    const novos = rotinaDias.map((dia) => ({ ...dia, slots: dia.slots.slice() })); novos[d]!.slots[s] = { ...novos[d]!.slots[s]!, exercicio: ex };
    setRotinaDias(novos); marcar(`e${d}-${s}`); setModal(null);
  }
  const registrarPeso = (v: number) => { if (Number.isFinite(v) && v >= 30 && v <= 300) setPesos((p) => [...p, v]); };

  const prescricao = treino.prescricao;
  const tabs: { id: Aba; label: string }[] = [{ id: 'hoje', label: 'Hoje' }, { id: 'treino', label: 'Treino' }, { id: 'dieta', label: 'Dieta' }, { id: 'progresso', label: 'Progresso' }, { id: 'perfil', label: 'Perfil' }];

  // Sessão de treino guiada (tela cheia, fora do shell do painel).
  if (sessaoDia !== null && prescricao && rotinaDias[sessaoDia]) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
        <Backdrop />
        <SessaoTreino dia={rotinaDias[sessaoDia]!} prescricao={prescricao} onSair={() => setSessaoDia(null)} onConcluir={concluirSessao} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB', animation: `evkScreenIn .5s ${EASE}` }}>
      <Backdrop />
      {/* header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(13,40,24,.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(234,229,219,.1)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}><Logo size={26} /><Marca size="1.1rem" /></div>
          <nav style={{ flex: 1, display: 'flex', gap: 4, overflowX: 'auto', padding: '2px 4px' }}>
            {tabs.map((t) => (
              <div key={t.id} onClick={() => setAba(t.id)} style={{ cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11, fontWeight: 600, fontSize: '.94rem', transition: 'all .25s ease', border: '1px solid transparent', ...(aba === t.id ? { background: 'rgba(189,255,0,.12)', color: '#BDFF00', borderColor: 'rgba(189,255,0,.3)' } : { color: 'rgba(234,229,219,.62)' }) }}>{t.label}</div>
            ))}
          </nav>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setMenu((m) => !m)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 999, padding: '5px 12px 5px 5px', cursor: 'pointer' }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(189,255,0,.16)', color: '#BDFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.92rem' }}>V</span>
              <svg width={14} height={14} viewBox="0 0 24 24" style={{ color: 'rgba(234,229,219,.5)' }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {menu && (
              <div style={{ position: 'absolute', top: 48, right: 0, width: 180, background: '#10241a', border: '1px solid rgba(234,229,219,.14)', borderRadius: 14, padding: 7, boxShadow: '0 24px 50px -20px rgba(0,0,0,.7)', animation: `evkPop .25s ease`, zIndex: 60 }}>
                <button onClick={() => { setAba('perfil'); setMenu(false); }} style={menuBtn(false)}>Meu perfil</button>
                <button onClick={onSair} style={menuBtn(true)}>Sair</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1080, margin: '0 auto', padding: '36px 22px 90px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 800, letterSpacing: '-.02em' }}>Bom treino 👊</h1>
          <p style={{ margin: 0, color: 'rgba(234,229,219,.55)', fontSize: '.98rem', textTransform: 'capitalize' }}>{dataHoje || 'Seu dia'}</p>
        </div>

        {aba === 'hoje' && <Hoje dieta={dieta} cardTotais={cardTotais} dia={rotinaDias[0]} mostrarC={mostrarC} onFecharC={() => setMostrarC(false)} onComecar={() => rotinaDias[0] ? setSessaoDia(0) : setAba('treino')} onRegistrar={registrarPeso} />}
        {aba === 'treino' && prescricao && <TreinoTab dias={rotinaDias} prescricao={prescricao} treinoNome={treino.rotina?.split ?? 'Treino'} trocados={trocados} feedback={feedback} onTrocar={abrirTrocaEx} onFb={(k, f) => setFeedback((p) => ({ ...p, [k]: f }))} onIniciar={(d) => setSessaoDia(d)} />}
        {aba === 'dieta' && <DietaTab dieta={dieta} itens={cardItens} totais={cardTotais} trocados={trocados} onTrocar={abrirTrocaPrato} onPorcao={(idx) => setModal({ tipo: 'porcao', idx, base: cardItens[idx]!.prato.nome })} />}
        {aba === 'progresso' && <Progresso pesos={pesos} treinos={sessoesConcluidas > 0 ? sessoesConcluidas : Object.keys(feedback).length} onRegistrar={registrarPeso} />}
        {aba === 'perfil' && <Perfil perfil={perfil} />}
      </div>

      {modal && <ModalTroca modal={modal} onFechar={() => setModal(null)} onAplicarPrato={aplicarPrato} onMaisPrato={maisVariedadePrato} onAplicarPorcao={aplicarPorcao} onAplicarEx={aplicarEx} onMaisEx={maisVariedadeEx} />}
    </div>
  );
}

/* ════════════════════ Hoje ════════════════════ */

function Hoje({ dieta, cardTotais, dia, mostrarC, onFecharC, onComecar, onRegistrar }: {
  dieta: ResultadoMotor; cardTotais: RecipeMacros | null; dia: DiaTreino | undefined;
  mostrarC: boolean; onFecharC: () => void; onComecar: () => void; onRegistrar: (v: number) => void;
}) {
  const plano = dieta.plano!;
  const kcal = r0(cardTotais?.kcal ?? plano.kcalAlvo);
  const totK = plano.macros.kcalProteina + plano.macros.kcalCarboidrato + plano.macros.kcalGordura || 1;
  return (
    <div style={sec}>
      {mostrarC && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: 'rgba(189,255,0,.07)', border: '1px solid rgba(189,255,0,.3)', borderRadius: 16, padding: '16px 18px', marginBottom: 20 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx={12} cy={12} r={9} stroke="#BDFF00" strokeWidth={1.8} /><path d="M12 8v5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /><circle cx={12} cy={16.2} r={1.1} fill="#BDFF00" /></svg>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: '.96rem', marginBottom: 3, color: '#BDFF00' }}>Um ajuste honesto no seu plano</div><p style={{ margin: 0, fontSize: '.92rem', color: 'rgba(234,229,219,.75)', lineHeight: 1.55 }}>{plano.notaTransparencia ?? (plano.avisos[0] ?? 'Ajustamos seu plano para manter você em segurança. Tudo continua editável.')}</p></div>
          <button onClick={onFecharC} style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1, padding: 2 }}>×</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 18, marginBottom: 18 }}>
        {dia && (
          <div style={gradCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}><span style={kicker}>Treino de hoje</span></div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.02em', marginBottom: 6 }}>{dia.nome}</div>
            <div style={{ color: 'rgba(234,229,219,.6)', fontSize: '.95rem', marginBottom: 22 }}>{dia.slots.length} exercícios</div>
            <button onClick={onComecar} className="hov-btn" style={{ width: '100%', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 12, cursor: 'pointer' }}>Começar treino</button>
          </div>
        )}
        <div style={gradCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><span style={kicker}>Dieta de hoje</span></div>
          <div style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.5)', marginBottom: 2 }}>Seu ponto de partida</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 18 }}><span style={{ fontSize: '2rem', fontWeight: 800, color: '#BDFF00', letterSpacing: '-.02em' }}>{kcal}</span><span style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.55)' }}>kcal</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 14 }}>
            <Barra nome="Proteína" g={r0(plano.macros.proteinaG)} pct={Math.round(plano.macros.kcalProteina / totK * 100)} cor="#BDFF00" />
            <Barra nome="Carboidrato" g={r0(plano.macros.carboidratoG)} pct={Math.round(plano.macros.kcalCarboidrato / totK * 100)} cor="#16A34A" />
            <Barra nome="Gordura" g={r0(plano.macros.gorduraG)} pct={Math.round(plano.macros.kcalGordura / totK * 100)} cor="rgba(234,229,219,.4)" />
          </div>
          <p style={{ margin: 0, fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>É um guia, não uma meta exata.</p>
        </div>
      </div>
      <RegistrarPesoRow onRegistrar={onRegistrar} />
    </div>
  );
}

/* ════════════════════ Treino ════════════════════ */

function TreinoTab({ dias, prescricao, treinoNome, trocados, feedback, onTrocar, onFb, onIniciar }: {
  dias: DiaTreino[]; prescricao: NonNullable<ResultadoTreino['prescricao']>; treinoNome: string;
  trocados: Set<string>; feedback: Record<string, Feedback>; onTrocar: (d: number, s: number) => void; onFb: (k: string, f: Feedback) => void;
  onIniciar: (d: number) => void;
}) {
  const total = dias.reduce((n, d) => n + d.slots.length, 0);
  return (
    <div style={sec}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div><div style={{ ...kicker, color: '#BDFF00', marginBottom: 6 }}>Plano de treino</div><h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-.02em' }}>{treinoNome}</h2></div>
        <span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.55)', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 999, padding: '7px 14px' }}>{total} exercícios</span>
      </div>
      {dias.map((dia, d) => (
        <div key={`${dia.nome}-${d}`} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={kicker}>{dia.nome} · RIR {prescricao.rir.min}–{prescricao.rir.max}</div>
            <button onClick={() => onIniciar(d)} className="hov-btn" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.85rem', padding: '8px 16px', border: 'none', borderRadius: 10, cursor: 'pointer' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill="currentColor" /></svg>Iniciar treino</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {dia.slots.map((sl, s) => {
              const comp = sl.padrao !== 'isolado';
              const reps = comp ? prescricao.repsComposto : prescricao.repsIsolado;
              const desc = comp ? prescricao.descansoCompostoSeg : prescricao.descansoIsoladoSeg;
              const k = `${d}-${s}`;
              return (
                <div key={`${k}-${sl.exercicio.id}`} style={{ ...cardSoft, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgba(234,229,219,.22)', lineHeight: 1.2, flexShrink: 0 }}>{String(s + 1).padStart(2, '0')}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span style={{ ...kicker, color: 'rgba(234,229,219,.4)' }}>{PADRAO_LABEL[sl.padrao] ?? sl.padrao}</span>
                          <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{sl.exercicio.nomePt}</div>
                          {trocados.has(`e${k}`) && <span style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#BDFF00', background: 'rgba(189,255,0,.12)', borderRadius: 6, padding: '3px 8px' }}>trocado</span>}
                        </div>
                        <button onClick={() => onTrocar(d, s)} className="evk-troca" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.85rem', padding: '8px 14px', borderRadius: 10, cursor: 'pointer' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M4 7h12l-3-3M20 17H8l3 3" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>Trocar</button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        <span style={pill}>{prescricao.seriesPorExercicio.min}–{prescricao.seriesPorExercicio.max} × {reps.min}–{reps.max} reps</span>
                        <span style={pill}>RIR {prescricao.rir.min}–{prescricao.rir.max}</span>
                        <span style={pill}>Descanso {desc.min}–{desc.max}s</span>
                      </div>
                      <details style={{ marginBottom: 14 }}>
                        <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '.86rem', fontWeight: 600, color: '#BDFF00' }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={1.8} /><path d="M12 11v5M12 8.2v.01" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>Como fazer</summary>
                        <p style={{ margin: '10px 0 0', fontSize: '.9rem', color: 'rgba(234,229,219,.65)', lineHeight: 1.55 }}>{sl.exercicio.comoFazer}</p>
                      </details>
                      <div style={{ borderTop: '1px solid rgba(234,229,219,.08)', paddingTop: 13 }}>
                        <div style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.55)', marginBottom: 8 }}>Como foi?</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(['facil', 'na_medida', 'dificil'] as Feedback[]).map((f) => {
                            const on = feedback[k] === f;
                            return <button key={f} onClick={() => onFb(k, f)} style={{ cursor: 'pointer', flex: 1, padding: '9px 6px', borderRadius: 9, fontWeight: 600, fontSize: '.82rem', transition: 'all .25s ease', border: `1px solid ${on ? '#BDFF00' : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.12)' : 'transparent', color: on ? '#BDFF00' : 'rgba(234,229,219,.62)' }}>{f === 'facil' ? 'Fácil' : f === 'na_medida' ? 'Na medida' : 'Difícil'}</button>;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p style={{ margin: '4px 2px 0', fontSize: '.88rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.55 }}>Seu retorno ajusta o próximo treino. Iniciante não treina até a falha — a carga sobe por dupla progressão guiada pelo seu feedback.</p>
    </div>
  );
}

/* ════════════════════ Dieta ════════════════════ */

function DietaTab({ dieta, itens, totais, trocados, onTrocar, onPorcao }: {
  dieta: ResultadoMotor; itens: CardapioItem[]; totais: RecipeMacros | null; trocados: Set<string>;
  onTrocar: (idx: number) => void; onPorcao: (idx: number) => void;
}) {
  const plano = dieta.plano!;
  return (
    <div style={sec}>
      <div style={{ ...gradCard, padding: '22px 24px', borderRadius: 18, marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div><div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.5)', marginBottom: 2 }}>Seu ponto de partida</div><div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}><span style={{ fontSize: '2rem', fontWeight: 800, color: '#BDFF00', letterSpacing: '-.02em' }}>{r0(totais?.kcal ?? plano.kcalAlvo)}</span><span style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.55)' }}>kcal · estimativa de referência</span></div></div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Prot', r0(plano.macros.proteinaG)], ['Carb', r0(plano.macros.carboidratoG)], ['Gord', r0(plano.macros.gorduraG)]].map(([l, g]) => <div key={l as string}><div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.5)', marginBottom: 2 }}>{l}</div><div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{g} g</div></div>)}
          </div>
        </div>
      </div>
      {itens.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {itens.map((it, idx) => (
            <div key={`${it.refeicao}-${it.prato.id}`} style={cardSoft}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{REFEICAO_LABEL[it.refeicao]}</span><span style={{ fontSize: '.85rem', color: '#BDFF00', background: 'rgba(189,255,0,.1)', padding: '4px 11px', borderRadius: 999 }}>~{r0(it.macros.kcal)} kcal</span></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(234,229,219,.03)', borderRadius: 11, padding: '11px 14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ fontSize: '.95rem' }}>{it.prato.nome}</span>
                  {trocados.has(`p${idx}`) && <span style={{ fontSize: '.7rem', fontWeight: 600, color: '#BDFF00', background: 'rgba(189,255,0,.1)', borderRadius: 6, padding: '2px 7px' }}>{it.escala.toFixed(2)}× porção</span>}
                </span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => onTrocar(idx)} className="evk-troca" style={dishBtn}>Trocar</button>
                  <button onClick={() => onPorcao(idx)} className="evk-troca" style={dishBtn}>Editar porção</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : <p style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.6)' }}>{dieta.cardapio?.nota ?? 'Sem cardápio para as restrições atuais.'}</p>}
      <p style={{ margin: '18px 2px 0', fontSize: '.88rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.55 }}>Os pratos vêm de uma base reconhecida de alimentos e os valores são estimativas. Trocas respeitam suas alergias e seu padrão alimentar — sempre.</p>
    </div>
  );
}

/* ════════════════════ Progresso ════════════════════ */

function Progresso({ pesos, treinos, onRegistrar }: { pesos: number[]; treinos: number; onRegistrar: (v: number) => void }) {
  const atual = pesos[pesos.length - 1]!;
  const variacao = atual - pesos[0]!;
  return (
    <div style={sec}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 20 }}>
        <Stat rotulo="Peso atual" valor={atual.toFixed(1)} un="kg" />
        <Stat rotulo="Variação" valor={`${variacao >= 0 ? '+' : ''}${variacao.toFixed(1)}`} un="kg" cor="#BDFF00" />
        <Stat rotulo="Treinos avaliados" valor={String(treinos)} />
      </div>
      <div style={{ ...cardSoft, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}><span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Peso ao longo do tempo</span><span style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.45)' }}>{pesos.length} registro{pesos.length > 1 ? 's' : ''}</span></div>
        <Grafico pesos={pesos} />
        {pesos.length < 2 && <p style={{ margin: '10px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>Registre mais pesos para ver a linha evoluir.</p>}
      </div>
      <RegistrarPesoRow onRegistrar={onRegistrar} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: 'linear-gradient(165deg, rgba(22,163,74,.1), rgba(15,15,14,.4))', border: '1px solid rgba(189,255,0,.2)', borderRadius: 18, padding: '22px 24px', marginTop: 18 }}>
        <span style={{ width: 42, height: 42, minWidth: 42, borderRadius: 12, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={22} height={22} viewBox="0 0 24 24" fill="none"><path d="M3 17 Q8 14 12 9 T21 4" stroke="#BDFF00" strokeWidth={2} fill="none" strokeLinecap="round" /><circle cx={12} cy={9} r={2.2} fill="#BDFF00" /><circle cx={21} cy={4} r={2.6} fill="#BDFF00" /></svg></span>
        <div><h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 700 }}>Como seu plano evolui</h3><p style={{ margin: 0, color: 'rgba(234,229,219,.66)', lineHeight: 1.6, fontSize: '.95rem' }}>A cada avanço seu, o treino e a dieta se <strong style={{ color: '#BDFF00', fontWeight: 600 }}>recalculam</strong> pelas regras adaptativas. Sem promessa de prazo — só o ajuste fino que a sua constância merece.</p></div>
      </div>
    </div>
  );
}

/* ════════════════════ Perfil ════════════════════ */

function Perfil({ perfil }: { perfil: PerfilResumo }) {
  const linha = (k: string, v: string, last = false) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', ...(last ? {} : { borderBottom: '1px solid rgba(234,229,219,.07)' }) }}><span style={{ color: 'rgba(234,229,219,.55)', fontSize: '.94rem' }}>{k}</span><span style={{ fontWeight: 600, fontSize: '.94rem', textAlign: 'right' }}>{v}</span></div>;
  return (
    <div style={{ ...sec, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ ...cardSoft, padding: 24 }}>
          <h3 style={{ margin: '0 0 18px', fontSize: '1.15rem', fontWeight: 700 }}>Seus dados</h3>
          {linha('Sexo biológico', perfil.sexo === 'feminino' ? 'Feminino' : 'Masculino')}
          {linha('Idade', `${perfil.idade} anos`)}
          {linha('Altura', `${perfil.alturaCm} cm`)}
          {linha('Peso', `${perfil.pesoKg} kg`, true)}
        </div>
        <div style={{ ...cardSoft, padding: 24 }}>
          <h3 style={{ margin: '0 0 18px', fontSize: '1.15rem', fontWeight: 700 }}>Plano e preferências</h3>
          {linha('Objetivo', OBJETIVO_LABEL[perfil.objetivo])}
          {linha('Atividade', ATIV_LABEL[perfil.nivelAtividade])}
          {linha('Experiência', perfil.nivelExperiencia.charAt(0).toUpperCase() + perfil.nivelExperiencia.slice(1))}
          {linha('Padrão alimentar', perfil.preferencia ? (perfil.preferencia === 'vegano' ? 'Vegano' : 'Vegetariano') : 'Onívoro')}
          {linha('Alergias', perfil.alergenos.length ? perfil.alergenos.join(', ') : 'nenhuma', true)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ background: 'linear-gradient(165deg, rgba(189,255,0,.07), rgba(15,15,14,.5))', border: '1px solid rgba(189,255,0,.25)', borderRadius: 18, padding: 24 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>Assinatura Evokorpus</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 6 }}><span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#BDFF00' }}>R$ 29</span><span style={{ color: 'rgba(234,229,219,.55)' }}>/mês</span></div>
          <p style={{ margin: '0 0 20px', fontSize: '.9rem', color: 'rgba(234,229,219,.6)' }}>Demo — sem cobrança ativa. Avisamos antes de qualquer renovação, sem cobrança-surpresa.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={{ flex: 1, minWidth: 140, background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.16)', color: '#EAE5DB', fontWeight: 600, fontSize: '.92rem', padding: 12, borderRadius: 11, cursor: 'pointer' }}>Gerenciar assinatura</button>
            <button style={{ flex: 1, minWidth: 140, background: 'none', border: '1px solid rgba(229,72,77,.4)', color: '#E5484D', fontWeight: 600, fontSize: '.92rem', padding: 12, borderRadius: 11, cursor: 'pointer' }}>Cancelar</button>
          </div>
          <p style={{ margin: '14px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>Cancelar é fácil, em poucos toques — sem letra miúda.</p>
        </div>
        <div style={{ ...cardSoft, padding: 8 }}>
          {['Termos de Uso', 'Política de Privacidade', 'Aviso (disclaimer)', 'Suporte'].map((t) => (
            <a key={t} href="#" className="evk-perfil-link" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, fontSize: '.95rem', color: 'rgba(234,229,219,.8)' }}>{t} <span style={{ color: 'rgba(234,229,219,.35)' }}>→</span></a>
          ))}
        </div>
        <div style={{ padding: '4px 4px 0' }}>
          <span style={{ display: 'inline-block', marginBottom: 12, border: '1px solid rgba(234,229,219,.25)', color: 'rgba(234,229,219,.6)', borderRadius: 8, padding: '3px 10px', fontSize: '.78rem', fontWeight: 700 }}>18+</span>
          <p style={{ margin: 0, fontSize: '.8rem', color: 'rgba(234,229,219,.42)', lineHeight: 1.6 }}>O Evokorpus é uma ferramenta de uso geral e caráter educacional, dirigida pelo usuário. Não constitui prescrição, consulta ou acompanhamento nutricional ou de educação física, nem substitui a orientação de profissionais habilitados. Conteúdo para maiores de 18 anos.</p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ Modal (fiel) ════════════════════ */

function ModalTroca({ modal, onFechar, onAplicarPrato, onMaisPrato, onAplicarPorcao, onAplicarEx, onMaisEx }: {
  modal: NonNullable<Modal>; onFechar: () => void;
  onAplicarPrato: (idx: number, o: OpcaoPrato) => void; onMaisPrato: () => void;
  onAplicarPorcao: (idx: number, f: number) => void;
  onAplicarEx: (d: number, s: number, ex: Exercise) => void; onMaisEx: () => void;
}) {
  let titulo = 'Trocar'; let sub = ''; let showMore = false; let onMore = () => {};
  const opcoes: { chave: string; nome: string; detalhe?: string; onClick: () => void }[] = [];
  if (modal.tipo === 'prato') {
    sub = 'Três opções que mantêm o equilíbrio do dia (equivalência calórica). Não curtiu? Gere mais.'; showMore = true; onMore = onMaisPrato;
    modal.opcoes.forEach((o) => opcoes.push({ chave: o.prato.id, nome: o.prato.nome, detalhe: `${r0(o.macros.kcal)} kcal · ${r0(o.macros.proteinaG)} g prot`, onClick: () => onAplicarPrato(modal.idx, o) }));
  } else if (modal.tipo === 'exercicio') {
    sub = 'Mantém o grupo e o padrão, respeitando seu equipamento. Não curtiu? Gere mais.'; showMore = true; onMore = onMaisEx;
    modal.opcoes.forEach((ex) => opcoes.push({ chave: ex.id, nome: ex.nomePt, detalhe: `${ex.grupoMuscular}${ex.equipamentoDetalhe ? ` · ${ex.equipamentoDetalhe}` : ''}`, onClick: () => onAplicarEx(modal.d, modal.s, ex) }));
  } else {
    titulo = 'Editar porção'; sub = 'Ajuste a quantidade do prato — a estimativa de referência acompanha.';
    PORCOES.forEach((p) => opcoes.push({ chave: String(p.f), nome: `${p.r} porção${p.f === 1 ? ' (padrão)' : ''}`, onClick: () => onAplicarPorcao(modal.idx, p.f) }));
  }
  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: '1px solid rgba(234,229,219,.14)', borderRadius: 22, padding: 24, boxShadow: '0 40px 90px -30px rgba(0,0,0,.8)', animation: `evkPop .3s ${EASE}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00' }}>{titulo}</div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', padding: 0, marginTop: -2 }}>×</button>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-.01em', marginBottom: 6 }}>{modal.base}</div>
        <p style={{ margin: '0 0 18px', fontSize: '.86rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>{sub}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: showMore ? 14 : 0 }}>
          {opcoes.length === 0 && <p style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.6)' }}>Sem alternativa elegível agora.</p>}
          {opcoes.map((o) => (
            <button key={o.chave} onClick={o.onClick} className="modal-opt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 14, padding: '15px 17px', color: '#EAE5DB', cursor: 'pointer' }}>
              <span><span style={{ display: 'block', fontSize: '1rem', fontWeight: 600 }}>{o.nome}</span>{o.detalhe && <span style={{ display: 'block', fontSize: '.78rem', color: 'rgba(234,229,219,.55)', marginTop: 2 }}>{o.detalhe}</span>}</span>
              <span style={{ width: 26, height: 26, minWidth: 26, borderRadius: '50%', border: '1px solid rgba(234,229,219,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BDFF00' }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            </button>
          ))}
        </div>
        {showMore && (
          <button onClick={onMore} className="modal-more" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', color: '#BDFF00', fontWeight: 700, fontSize: '.94rem', padding: 13, borderRadius: 13, cursor: 'pointer' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M4 5v5h5M20 19v-5h-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><path d="M19 9a7.5 7.5 0 00-13-2.5L4 10M5 15a7.5 7.5 0 0013 2.5L20 14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Não curti nenhuma — gerar mais variedade
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════ Primitivos ════════════════════ */

const menuBtn = (muted: boolean): CSSProperties => ({ width: '100%', textAlign: 'left', background: 'none', border: 'none', color: muted ? 'rgba(234,229,219,.75)' : '#EAE5DB', fontSize: '.94rem', fontWeight: 500, padding: '11px 13px', borderRadius: 9, cursor: 'pointer' });
const dishBtn: CSSProperties = { background: 'none', border: '1px solid rgba(234,229,219,.16)', color: 'rgba(234,229,219,.75)', fontWeight: 600, fontSize: '.8rem', padding: '6px 12px', borderRadius: 9, cursor: 'pointer' };

function Backdrop() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: '-12%', right: '-8%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,163,74,.20), transparent 68%)', filter: 'blur(22px)', animation: 'evkDrift 24s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '-16%', left: '-12%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(189,255,0,.06), transparent 70%)', filter: 'blur(22px)', animation: 'evkDrift 30s ease-in-out infinite reverse' }} />
    </div>
  );
}
function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-label="Evokorpus">
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}
const Marca = ({ size }: { size: string }) => <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.02em' }}><span style={{ color: '#EAE5DB' }}>evo</span><span style={{ color: '#BDFF00' }}>korpus</span></span>;

function Barra({ nome, g, pct, cor }: { nome: string; g: number; pct: number; cor: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.84rem', marginBottom: 5 }}><span style={{ color: 'rgba(234,229,219,.7)' }}>{nome}</span><span style={{ color: 'rgba(234,229,219,.5)' }}>{g} g</span></div>
      <div style={{ height: 6, background: 'rgba(234,229,219,.1)', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: cor, borderRadius: 99 }} /></div>
    </div>
  );
}
function Stat({ rotulo, valor, un, cor }: { rotulo: string; valor: string; un?: string; cor?: string }) {
  return <div style={{ ...cardSoft, padding: 20, borderRadius: 16 }}><div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.5)', marginBottom: 6 }}>{rotulo}</div><div style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.02em', color: cor ?? '#EAE5DB' }}>{valor}{un && <span style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.5)', fontWeight: 500 }}> {un}</span>}</div></div>;
}

function RegistrarPesoRow({ onRegistrar }: { onRegistrar: (v: number) => void }) {
  const [v, setV] = useState('');
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: '18px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={20} height={20} viewBox="0 0 24 24" fill="none"><path d="M4 18 Q9 16 12 11 T20 5" stroke="#BDFF00" strokeWidth={2} fill="none" strokeLinecap="round" /><circle cx={12} cy={11} r={2} fill="#BDFF00" /><circle cx={20} cy={5} r={2.4} fill="#BDFF00" /></svg></span>
        <div><div style={{ fontWeight: 600, fontSize: '1rem' }}>Como está o peso hoje?</div><div style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.55)' }}>Um registro rápido mantém seu plano calibrado.</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="number" inputMode="decimal" placeholder="kg" value={v} onChange={(e) => setV(e.target.value)} style={{ width: 80, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 11, padding: '10px 12px', color: '#EAE5DB', fontSize: '.95rem', outline: 'none' }} />
        <button onClick={() => { onRegistrar(Number(v)); setV(''); }} style={{ background: 'none', border: '1px solid rgba(189,255,0,.4)', color: '#BDFF00', fontWeight: 600, fontSize: '.92rem', padding: '11px 20px', borderRadius: 11, cursor: 'pointer' }}>Registrar peso</button>
      </div>
    </div>
  );
}

function Grafico({ pesos }: { pesos: number[] }) {
  const W = 640, H = 200, pad = 14;
  const min = Math.min(...pesos), max = Math.max(...pesos), span = max - min || 1;
  const pts = pesos.map((p, i) => {
    const x = pesos.length === 1 ? W / 2 : pad + (i / (pesos.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((p - min) / span) * (H - 2 * pad);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1]![0].toFixed(1)} ${H} L${pts[0]![0].toFixed(1)} ${H} Z` : '';
  const ref = useRef<SVGPathElement>(null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
      <defs><linearGradient id="evkChartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(189,255,0,.28)" /><stop offset="100%" stopColor="rgba(189,255,0,0)" /></linearGradient></defs>
      {pts.length > 1 && <path d={area} fill="url(#evkChartFill)" />}
      {pts.length > 1 && <path ref={ref} d={line} fill="none" stroke="#BDFF00" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill="#BDFF00" />)}
    </svg>
  );
}
