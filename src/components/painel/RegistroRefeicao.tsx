'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { faixaTint, limiarAderencia, streakAderencia } from '@/lib/aderencia';
import { diaLocalISO } from '@/lib/dia-local';
import { carregarAderenciaServidor, salvarAderenciaDia, type DiaAderencia } from '@/lib/persistencia/sync';
import { registrarEvento } from '@/lib/metricas/registrar';
import { chaveLocal } from '@/lib/escopo-local';

/**
 * Registrar refeição + histórico de aderência — porte fiel do V5.
 * Binário leve por refeição (seguiu / comeu fora) → constância, NÃO diário de calorias.
 * Travas: "comeu fora" é NEUTRO (nunca vermelho/culpa); sem calorias/macros no registro nem
 * no histórico; os dois botões têm peso visual igual; aderência = constância, não perfeição.
 *
 * Persistência real (sem backend): localStorage por data. O histórico é dado genuíno do usuário
 * — nada é fabricado. A sincronização entre dispositivos é a fase de backend (Ownership-1).
 */

/**
 * `seguiu`/`fora` = o binário do plano (cofre `registro-de-aderencia-evokorpus`).
 * `comi` = o registro do MODO DIÁRIO (`ROTEAR`): sem plano não existe "seguiu o plano" nem
 * "comi outra coisa" — as duas frases só significam algo contra uma prescrição, e quem o gate
 * roteou não tem nenhuma. Registrar continua inerte; o que sumiu foi o eixo de comparação.
 * As telas do plano tratam `comi` como "a registrar" (cai no `else` de todos os ternários),
 * e as contas de aderência só somam `seguiu` — nenhuma delas roda em modo diário.
 */
export type StatusRefeicao = 'seguiu' | 'fora' | 'comi' | null;
export const MEAL_LABEL: Record<string, string> = { cafe: 'Café da manhã', almoco: 'Almoço', lanche: 'Lanche da tarde', jantar: 'Jantar' };
const KEY = 'evk_aderencia' as const;

type DiaLog = { logs: Record<string, StatusRefeicao>; notes: Record<string, string> };
type Historico = Record<string, DiaLog>;

// Dia LOCAL (não UTC): à noite no Brasil, toISOString() viraria "amanhã" e mis-arquivaria
// as refeições + discordaria da Chama (que já usa data local). Ver `dia-local.ts`.
function hojeISO(): string { return diaLocalISO(new Date()); }
function lerTudo(): Historico {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(chaveLocal(KEY)) || '{}') as Historico; } catch { return {}; }
}

/** Estado de registro do DIA atual (persistido). Compartilhe uma instância no Painel. */
export function useRegistro() {
  const [logs, setLogs] = useState<Record<string, StatusRefeicao>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const hidratado = useRef(false);

  useEffect(() => {
    const d = lerTudo()[hojeISO()];
    if (d) { setLogs(d.logs || {}); setNotes(d.notes || {}); }
    hidratado.current = true;
    // Logado: o dia de HOJE do servidor vence (2º device continua de onde parou).
    let vivo = true;
    void carregarAderenciaServidor().then((dias) => {
      if (!vivo || !dias) return; // falha de chamada → local fica (mock intacto)
      const hoje = dias[hojeISO()];
      if (hoje) {
        setLogs((hoje.logs as Record<string, StatusRefeicao>) || {});
        setNotes(hoje.notes || {});
      }
      // Re-migração (fix bloqueador 2026-07-08): dias que só existem no LOCAL são
      // writes silenciosamente perdidos — re-sobem (janela de 30 dias p/ bound de
      // requests). É o retry do write-through, paridade com o self-heal do profile.
      const limite = Date.parse(`${hojeISO()}T00:00:00Z`) - 30 * 86_400_000;
      for (const [dia, d] of Object.entries(lerTudo())) {
        if (dias[dia] || !d) continue;
        if (Number.isFinite(limite) && Date.parse(`${dia}T00:00:00Z`) < limite) continue;
        void salvarAderenciaDia(dia, d.logs ?? {}, d.notes ?? {});
      }
    });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!hidratado.current) return;
    const all = lerTudo();
    all[hojeISO()] = { logs, notes };
    try { localStorage.setItem(chaveLocal(KEY), JSON.stringify(all)); } catch { /* quota */ }
    // Write-through p/ o servidor (no-op sem backend); o local já está gravado.
    void salvarAderenciaDia(hojeISO(), logs, notes);
  }, [logs, notes]);

  return {
    logs, notes,
    setStatus: (id: string, s: StatusRefeicao) => {
      // 🔒 `refeicao_marcada` sai NO ATO da marcação. ⚠️ Só o slot e o booleano — nunca o
      // CONTEÚDO da refeição (a denylist barra `prato`, `alimento`, `kcal`).
      registrarEvento('refeicao_marcada', { refeicao: id, seguiu: s === 'seguiu' });
      setLogs((p) => ({ ...p, [id]: s }));
    },
    setNote: (id: string, txt: string) => setNotes((p) => ({ ...p, [id]: txt })),
  };
}

const EASE = 'cubic-bezier(.22,.61,.36,1)';

/* ─── F1: Controle de registro por refeição (abaixo dos pratos, após divisor) ─── */
export function ControleRegistro({ status, note, onSeguiu, onFora, onAlterar, onNote }: {
  status: StatusRefeicao; note: string; onSeguiu: () => void; onFora: () => void; onAlterar: () => void; onNote: (t: string) => void;
}) {
  return (
    <>
      <div style={{ height: 1, background: 'rgba(234,229,219,.08)', margin: '16px 0 0' }} />
      {!status && (
        <div style={{ paddingTop: 15 }}>
          <div style={{ fontSize: '.86rem', fontWeight: 600, color: 'rgba(234,229,219,.72)', marginBottom: 11 }}>Você seguiu a dieta nesta refeição?</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={onSeguiu} style={{ flex: 1, minWidth: 150, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(189,255,0,.08)', border: '1px solid rgba(189,255,0,.32)', color: '#BDFF00', fontWeight: 700, fontSize: '.92rem', padding: 12, borderRadius: 11, cursor: 'pointer', transition: 'all .2s ease' }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 6.5" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>Segui o plano</button>
            <button onClick={onFora} style={{ flex: 1, minWidth: 150, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.85)', fontWeight: 600, fontSize: '.92rem', padding: 12, borderRadius: 11, cursor: 'pointer', transition: 'all .2s ease' }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M5 9h9M11 5l4 4-4 4" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /><path d="M19 15H10M14 19l-4-4 4-4" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /></svg>Comi outra coisa</button>
          </div>
        </div>
      )}
      {status === 'seguiu' && (
        <div style={{ marginTop: 15, display: 'flex', alignItems: 'center', gap: 13, background: 'linear-gradient(165deg, rgba(22,163,74,.16), rgba(189,255,0,.04))', border: '1px solid rgba(22,163,74,.42)', borderRadius: 13, padding: '13px 15px', animation: `evkPop .4s ${EASE}` }}>
          <span style={{ width: 38, height: 38, minWidth: 38, borderRadius: 11, background: 'rgba(22,163,74,.22)', border: '1px solid rgba(22,163,74,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={20} height={20} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 6.5" stroke="#BDFF00" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: '.96rem' }}>Refeição registrada — você seguiu o plano.</div></div>
          <BotaoAlterar onClick={onAlterar} />
        </div>
      )}
      {status === 'fora' && (
        <div style={{ marginTop: 15, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.16)', borderRadius: 13, padding: '15px 16px', animation: `evkPop .4s ${EASE}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <span style={{ width: 38, height: 38, minWidth: 38, borderRadius: 11, background: 'rgba(234,229,219,.08)', border: '1px solid rgba(234,229,219,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={19} height={19} viewBox="0 0 24 24" fill="none"><path d="M5 9h9M11 5l4 4-4 4" stroke="rgba(234,229,219,.8)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /><path d="M19 15H10M14 19l-4-4 4-4" stroke="rgba(234,229,219,.8)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: '.96rem' }}>Registrado: você comeu fora do plano nesta refeição.</div></div>
            <BotaoAlterar onClick={onAlterar} />
          </div>
          <p style={{ margin: '11px 0 0', paddingLeft: 51, fontSize: '.88rem', color: 'rgba(234,229,219,.62)', lineHeight: 1.5 }}>Tudo bem — comer fora faz parte. O que conta é a constância, não a perfeição.</p>
          <div style={{ paddingLeft: 51, marginTop: 12 }}>
            <textarea rows={2} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Quer anotar o que comeu? (opcional)" className="input-foco" style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(13,40,24,.5)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 10, padding: '10px 12px', color: '#EAE5DB', fontSize: '.88rem', lineHeight: 1.5, outline: 'none', resize: 'none' }} />
            <div style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.4)', marginTop: 6 }}>Sem calorias, sem cobrança. Pode deixar em branco.</div>
          </div>
        </div>
      )}
    </>
  );
}
function BotaoAlterar({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="evk-alterar" style={{ flexShrink: 0, background: 'none', border: 'none', color: 'rgba(234,229,219,.6)', fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', padding: '4px 2px', borderBottom: '1px dashed rgba(234,229,219,.3)' }}>Alterar</button>;
}

/* ─── F2: Histórico → Dieta (aderência, sem calorias) + B4 ─── */
function fmtData(d: Date): string { return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); }
const DOWS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function HistoricoDieta({ refeicoes, hojeLogs, hojeNotes, onVerDieta, modoDiario = false }: {
  refeicoes: string[]; hojeLogs: Record<string, StatusRefeicao>; hojeNotes: Record<string, string>; onVerDieta: () => void;
  /**
   * 🔒 MODO DIÁRIO (gate `ROTEAR`): o histórico continua disponível — é leitura do que a
   * própria pessoa registrou —, mas TODA moldura relativa ao plano sai. "~X% do plano",
   * "dias seguidos no plano" e "N/4 no plano" não têm referente sem prescrição; a mesma
   * tela passa a contar **dias com registro**.
   */
  modoDiario?: boolean;
}) {
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const [aberto, setAberto] = useState<string | null>(null);
  const [hist, setHist] = useState<Historico>({});
  useEffect(() => {
    setHist(lerTudo());
    // Logado: merge servidor-sobre-local (o servidor vence por dia) e re-grava o cache.
    let vivo = true;
    void carregarAderenciaServidor().then((dias: Record<string, DiaAderencia> | null) => {
      if (!vivo || !dias) return;
      const merged: Historico = { ...lerTudo(), ...(dias as unknown as Historico) };
      try { localStorage.setItem(chaveLocal(KEY), JSON.stringify(merged)); } catch { /* quota */ }
      setHist(merged);
    });
    return () => { vivo = false; };
  }, []);

  const hoje = hojeISO();
  // Mescla o dia de hoje ao vivo (props) sobre o que está no storage.
  const merged: Historico = { ...hist, [hoje]: { logs: hojeLogs, notes: hojeNotes } };
  const total = refeicoes.length || 4;
  // A "conta do dia": com plano é ADERÊNCIA (quantas seguiram); em modo diário é REGISTRO
  // (quantas foram marcadas) — sem plano, "seguiu" não tem referente.
  const seguiuDoDia = (d?: DiaLog) => refeicoes.filter((r) => (modoDiario ? !!d?.logs?.[r] : d?.logs?.[r] === 'seguiu')).length;
  const temRegistro = (d?: DiaLog) => !!d && refeicoes.some((r) => d.logs?.[r]);
  const noPlano = modoDiario ? 'registradas' : 'no plano';

  const diasComRegistro = Object.values(merged).filter(temRegistro).length;
  if (diasComRegistro === 0) {
    return (
      <div style={{ background: 'rgba(234,229,219,.022)', border: '1px dashed rgba(234,229,219,.18)', borderRadius: 24, padding: '56px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <svg viewBox="0 0 240 120" width={240} aria-hidden style={{ position: 'absolute', top: -12, right: -12, opacity: 0.08, pointerEvents: 'none' }}><path d="M16 100 Q90 84 140 50 T228 14" stroke="#BDFF00" strokeWidth={3} fill="none" strokeLinecap="round" /><circle cx={16} cy={100} r={5} fill="#BDFF00" /><circle cx={140} cy={50} r={6.5} fill="#BDFF00" /><circle cx={228} cy={14} r={8.5} fill="#BDFF00" /></svg>
        <div style={{ width: 78, height: 78, borderRadius: 22, background: 'rgba(189,255,0,.07)', border: '1px solid rgba(189,255,0,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22, position: 'relative', zIndex: 1 }}>
          <svg width={34} height={34} viewBox="0 0 24 24" fill="none"><circle cx={13.6} cy={12} r={6.4} stroke="#EAE5DB" strokeWidth={1.7} /><circle cx={13.6} cy={12} r={2.5} stroke="rgba(234,229,219,.45)" strokeWidth={1.5} /><path d="M5 4v5.4a1.6 1.6 0 0 0 3.2 0V4" stroke="#BDFF00" strokeWidth={1.6} strokeLinecap="round" fill="none" /><line x1={6.6} y1={9.4} x2={6.6} y2={20} stroke="#BDFF00" strokeWidth={1.6} strokeLinecap="round" /></svg>
        </div>
        <h2 style={{ margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em', position: 'relative', zIndex: 1 }}>Você ainda não registrou refeições.</h2>
        <p style={{ margin: '0 auto 28px', maxWidth: 430, color: 'rgba(234,229,219,.62)', lineHeight: 1.6, fontSize: '1rem', position: 'relative', zIndex: 1 }}>Quando você marcar suas refeições, elas aparecem aqui.</p>
        <button onClick={onVerDieta} className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: '14px 28px', border: 'none', borderRadius: 13, cursor: 'pointer', position: 'relative', zIndex: 1 }}>{modoDiario ? 'Registrar refeição' : 'Ver dieta de hoje'}</button>
      </div>
    );
  }

  // Janela do período
  const agora = new Date();
  const diasJanela = periodo === 'semana' ? 7 : 30;
  const datas: Date[] = [];
  for (let i = 0; i < diasJanela; i++) { const d = new Date(agora); d.setDate(agora.getDate() - i); datas.push(d); }
  const comDados = datas.filter((d) => temRegistro(merged[diaLocalISO(d)]));
  const pctPeriodo = comDados.length ? Math.round(comDados.reduce((s, d) => s + seguiuDoDia(merged[diaLocalISO(d)]) / total, 0) / comDados.length * 100) : 0;
  // streak: dias consecutivos (de hoje p/ trás) com ≥ ¾ das refeições do plano no dia
  // (PROPORCIONAL, arredondado — DF 2026-07-04; o "3 fixo" exigiria 100% num plano de 3).
  // GLOBAL (helper puro): não limitado à janela visível — antes divergia entre Semana e Mês.
  const limiar = limiarAderencia(total);
  const streak = streakAderencia(hoje, (dia) => { const dl = merged[dia]; return temRegistro(dl) ? seguiuDoDia(dl) : null; }, total);

  // `comi` (modo diário) pinta como registrada — é o único estado "marcado" que existe lá.
  const segMini = (st: StatusRefeicao): CSSProperties => ({ flex: 1, height: 8, borderRadius: 99, ...(st === 'seguiu' || st === 'comi' ? { background: '#BDFF00' } : st === 'fora' ? { background: 'rgba(234,229,219,.32)' } : { background: 'rgba(234,229,219,.09)', border: '1px solid rgba(234,229,219,.2)' }) });
  const rotuloDia = (d: Date) => { const dd = Math.round((agora.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000); return dd === 0 ? 'Hoje' : dd === 1 ? 'Ontem' : DOWS[d.getDay()]!; };

  return (
    <div style={{ animation: `evkPop .45s ${EASE}` }}>
      {/* resumo do período */}
      <div style={{ background: 'linear-gradient(160deg, rgba(22,163,74,.14), rgba(15,15,14,.55))', border: '1px solid rgba(189,255,0,.2)', borderRadius: 20, padding: 24, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 18 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: '#BDFF00', marginBottom: 8 }}>Resumo · {periodo === 'semana' ? 'Esta semana' : 'Este mês'}</div>
            {/* Em modo diário o número é DIAS COM REGISTRO — "% do plano" não tem referente. */}
            {modoDiario ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}><span style={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '-.03em', color: '#BDFF00' }}>{comDados.length}</span><span style={{ fontSize: '1rem', color: 'rgba(234,229,219,.7)' }}>{comDados.length === 1 ? 'dia registrado' : 'dias registrados'} {periodo === 'semana' ? 'nesta semana' : 'neste mês'}</span></div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}><span style={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '-.03em', color: '#BDFF00' }}>~{pctPeriodo}%</span><span style={{ fontSize: '1rem', color: 'rgba(234,229,219,.7)' }}>do plano {periodo === 'semana' ? 'nesta semana' : 'neste mês'} · dos dias com registro</span></div>
            )}
            <p style={{ margin: 0, maxWidth: 440, fontSize: '.92rem', color: 'rgba(234,229,219,.62)', lineHeight: 1.55 }}>{modoDiario ? 'Constância, não perfeição. Cada refeição marcada fica no seu histórico.' : 'Constância, não perfeição — você está num bom ritmo. Cada refeição marcada conta.'}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 7 }}>
              {(['semana', 'mes'] as const).map((p) => { const on = periodo === p; return <div key={p} onClick={() => { setPeriodo(p); setAberto(null); }} style={{ padding: '9px 16px', borderRadius: 9, fontSize: '.86rem', fontWeight: 600, cursor: 'pointer', ...(on ? { background: '#BDFF00', color: '#0D2818' } : { background: 'rgba(234,229,219,.04)', color: 'rgba(234,229,219,.6)', border: '1px solid rgba(234,229,219,.12)' }) }}>{p === 'semana' ? 'Semana' : 'Mês'}</div>; })}
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.86rem', fontWeight: 700, color: '#BDFF00', background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', borderRadius: 999, padding: '8px 14px' }}><svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M12 3c1.5 3 4 4.2 4 7.5a4 4 0 0 1-8 0c0-1 .4-1.8 1-2.5-.2 1.4.6 2.2 1.3 2.4-.5-2 .7-3.8 1.7-4.4z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" fill="none" /></svg>{streak > 0 ? `${streak} ${streak === 1 ? 'dia' : 'dias'} seguidos ${modoDiario ? 'com registro' : 'no plano'}` : 'Sua sequência começa hoje'}</span>
          </div>
        </div>
      </div>

      {periodo === 'semana' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {datas.map((d) => {
            const k = diaLocalISO(d);
            const dl = merged[k];
            const cnt = seguiuDoDia(dl);
            const open = aberto === k;
            const reg = temRegistro(dl);
            return (
              <div key={k} style={{ background: 'rgba(234,229,219,.04)', border: `1px solid ${open ? 'rgba(189,255,0,.3)' : 'rgba(234,229,219,.1)'}`, borderRadius: 16, overflow: 'hidden' }}>
                <div onClick={() => setAberto(open ? null : k)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 18px', cursor: 'pointer' }}>
                  <div style={{ minWidth: 96 }}><div style={{ fontWeight: 700, fontSize: '.98rem' }}>{rotuloDia(d)}</div><div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.5)' }}>{fmtData(d)}</div></div>
                  <div style={{ flex: 1, display: 'flex', gap: 6, minWidth: 0 }}>{refeicoes.map((r) => <div key={r} style={segMini(dl?.logs?.[r] ?? null)} />)}</div>
                  <span style={{ fontSize: '.86rem', fontWeight: 600, color: reg && cnt >= limiar ? '#BDFF00' : 'rgba(234,229,219,.6)', whiteSpace: 'nowrap' }}>{reg ? `${cnt}/${total}` : '—'} {noPlano}</span>
                  <span aria-hidden style={{ color: 'rgba(234,229,219,.4)', fontSize: '1.1rem', flexShrink: 0, transition: 'transform .2s ease', transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>
                </div>
                {open && <DetalheDia dl={dl} refeicoes={refeicoes} />}
              </div>
            );
          })}
          <p style={{ margin: '8px 2px 0', fontSize: '.84rem', color: 'rgba(234,229,219,.5)' }}>{modoDiario ? 'Toque num dia para ver as refeições registradas e as anotações, se houver.' : 'Toque num dia para ver as refeições — seguiu, comeu fora e as anotações, se houver.'}</p>
        </div>
      ) : (
        <Mes merged={merged} refeicoes={refeicoes} total={total} aberto={aberto} setAberto={setAberto} modoDiario={modoDiario} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: '15px 17px', marginTop: 18 }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx={12} cy={12} r={9} stroke="rgba(189,255,0,.5)" strokeWidth={1.7} /><path d="M12 11v5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /><circle cx={12} cy={7.8} r={1.05} fill="#BDFF00" /></svg>
        <p style={{ margin: 0, fontSize: '.86rem', color: 'rgba(234,229,219,.66)', lineHeight: 1.55 }}>{modoDiario ? <>Este histórico é seu registro de <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>constância</strong> — quantas refeições você marcou. Não é um diário de calorias, e nenhum dia conta como falha.</> : <>Aderência mede sua <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>constância</strong> — quantas refeições seguiram o plano. Não é um diário de calorias, e comer fora nunca conta como falha.</>}</p>
      </div>
    </div>
  );
}

function DetalheDia({ dl, refeicoes }: { dl?: DiaLog; refeicoes: string[] }) {
  return (
    <div style={{ padding: '4px 18px 16px', borderTop: '1px solid rgba(234,229,219,.07)', animation: `evkPop .3s ease` }}>
      {refeicoes.map((r, i) => {
        const st = dl?.logs?.[r] ?? null;
        const note = dl?.notes?.[r];
        const statusTxt = st === 'seguiu' ? 'Seguiu o plano' : st === 'fora' ? 'Comeu fora' : st === 'comi' ? 'Registrada' : 'A registrar';
        const statusCor = st === 'seguiu' || st === 'comi' ? '#BDFF00' : 'rgba(234,229,219,.55)';
        return (
          <div key={r} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderBottom: i === refeicoes.length - 1 ? 'none' : '1px solid rgba(234,229,219,.05)' }}>
            <span style={{ width: 30, height: 30, minWidth: 30, borderRadius: 9, background: st === 'seguiu' || st === 'comi' ? 'rgba(22,163,74,.22)' : 'rgba(234,229,219,.06)', border: `1px solid ${st === 'seguiu' || st === 'comi' ? 'rgba(22,163,74,.5)' : 'rgba(234,229,219,.16)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              {st === 'seguiu' || st === 'comi' ? <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 6.5" stroke="#BDFF00" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
                : st === 'fora' ? <span style={{ width: 10, height: 2, background: 'rgba(234,229,219,.7)', borderRadius: 2 }} />
                : <span style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid rgba(234,229,219,.4)' }} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><span style={{ fontWeight: 600, fontSize: '.92rem' }}>{MEAL_LABEL[r] ?? r}</span><span style={{ fontSize: '.78rem', color: statusCor }}>{statusTxt}</span></div>
              {note && <div style={{ marginTop: 4, fontSize: '.82rem', color: 'rgba(234,229,219,.55)', fontStyle: 'italic' }}>“{note}”</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Mes({ merged, refeicoes, total, aberto, setAberto, modoDiario = false }: { merged: Historico; refeicoes: string[]; total: number; aberto: string | null; setAberto: (k: string | null) => void; modoDiario?: boolean }) {
  const agora = new Date();
  const ano = agora.getFullYear(), mes = agora.getMonth();
  const primeiroDow = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const hojeISOv = hojeISO();
  // Mesma troca de eixo do resto da tela: com plano conta ADERÊNCIA, em modo diário conta REGISTRO.
  const seguiuDoDia = (d?: DiaLog) => refeicoes.filter((r) => (modoDiario ? !!d?.logs?.[r] : d?.logs?.[r] === 'seguiu')).length;
  const temRegistro = (d?: DiaLog) => !!d && refeicoes.some((r) => d.logs?.[r]);
  // Calor PROPORCIONAL ao plano (faixaTint 0..4) — antes travado em `cnt>=4`, o que impedia
  // um plano de 3 refeições de atingir o tier neon num dia perfeito.
  const TINT = ['rgba(234,229,219,.07)', 'rgba(22,163,74,.14)', 'rgba(22,163,74,.26)', 'rgba(22,163,74,.42)', 'rgba(189,255,0,.55)'] as const;
  const tint = (cnt: number, reg: boolean) => !reg ? TINT[0] : TINT[faixaTint(cnt, total)];
  const cels: ({ day: number; k: string } | null)[] = [];
  for (let i = 0; i < primeiroDow; i++) cels.push(null);
  for (let dia = 1; dia <= diasNoMes; dia++) cels.push({ day: dia, k: diaLocalISO(new Date(ano, mes, dia)) });
  const det = aberto ? merged[aberto] : undefined;

  return (
    <>
      <div style={{ background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 7, marginBottom: 8 }}>{DOWS.map((h) => <div key={h} style={{ textAlign: 'center', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.05em', color: 'rgba(234,229,219,.4)' }}>{h}</div>)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 7 }}>
          {cels.map((c, i) => {
            if (!c) return <div key={`e${i}`} />;
            const dl = merged[c.k]; const reg = temRegistro(dl); const cnt = seguiuDoDia(dl);
            const isHoje = c.k === hojeISOv;
            return (
              <div key={c.k} onClick={() => reg && setAberto(aberto === c.k ? null : c.k)} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.82rem', fontWeight: 600, cursor: reg ? 'pointer' : 'default', background: tint(cnt, reg), color: reg && cnt >= total ? '#0D2818' : 'rgba(234,229,219,.7)', boxShadow: isHoje ? '0 0 0 2px #BDFF00' : undefined }}><span style={{ position: 'relative', zIndex: 1 }}>{c.day}</span></div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(234,229,219,.07)' }}>
          <span style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.45)' }}>{modoDiario ? 'Mais registradas' : 'Mais no plano'}</span>
          <div style={{ display: 'flex', gap: 4 }}>{['rgba(234,229,219,.07)', 'rgba(22,163,74,.2)', 'rgba(22,163,74,.34)', 'rgba(22,163,74,.5)', 'rgba(189,255,0,.55)'].map((c) => <span key={c} style={{ width: 16, height: 16, borderRadius: 5, background: c }} />)}</div>
          <span style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.45)' }}>menos · sem cor de falha</span>
        </div>
      </div>
      {det && aberto && (
        <div style={{ marginTop: 16, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(189,255,0,.22)', borderRadius: 16, padding: '18px 20px', animation: `evkPop .3s ease` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}><span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{fmtData(new Date(aberto))}</span><span style={{ fontSize: '.82rem', fontWeight: 600, color: '#BDFF00' }}>{seguiuDoDia(det)}/{total} {modoDiario ? 'registradas' : 'no plano'}</span></div>
            <button onClick={() => setAberto(null)} style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(234,229,219,.55)', fontSize: '1.1rem', cursor: 'pointer', border: '1px solid rgba(234,229,219,.12)', background: 'none' }}>×</button>
          </div>
          <DetalheDia dl={det} refeicoes={refeicoes} />
        </div>
      )}
    </>
  );
}
