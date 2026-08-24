'use client';

import { useState, type CSSProperties } from 'react';
import { montarSemana, proximoTreinoIdx, weekdayHojeIdx, type Weekday } from '@/lib/semana';
import { ROTULO_MODALIDADE } from '@/lib/engine/cardio';
import type { ConteudoDiaExcedente } from '@/lib/engine/dia-de-cardio';

/**
 * "Sua semana" (handoff Dias-e-Preferências §5.4) — porte FIEL. Faixa Seg–Dom no topo da
 * aba Hoje: cada dia é treino (rótulo da sessão, do motor) ou descanso; "hoje" tem anel
 * Pulso. Clicar num dia abre o detalhe. Descanso de hoje = estado B2 (nunca falha).
 * As sessões vêm do motor; "hoje" vem do relógio (na UI, não no motor).
 */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function SuaSemana({ treinoDias, sessoesNomes, onIrSessao, onVerDieta, onEditarPerfil, diaExcedente, diasCardio = [], onRegistrarCardio }: {
  treinoDias: Weekday[];
  sessoesNomes: string[];              // nomes das sessões (rotina.dias[].nome), na ordem do motor
  onIrSessao: (sessionIdx: number) => void;
  onVerDieta: () => void;
  onEditarPerfil: () => void;
  /**
   * 🔒 O DIA EXCEDENTE PASSA A TER CONTEÚDO (Leva E, spec §🏃). Vem pronto do motor
   * (`conteudoDoDiaExcedente`) — a tela não decide entre cardio e recuperação nem calcula
   * duração: se decidisse aqui, existiriam duas respostas para o que o dia é.
   */
  diaExcedente?: ConteudoDiaExcedente;
  /** Dias de cardio EMITIDOS pelo motor — rotulam a faixa e trazem o item do dia. */
  diasCardio?: readonly { modalidade: string; minutos: number | null; diaId?: string; ordemNoHorizonte?: number }[];
  /**
   * Abre o registro UNIFICADO de cardio, pré-preenchido com o item do dia.
   * 🔴 NUNCA a sessão guiada: `sessao_iniciada` é a métrica de ATIVAÇÃO, e dispará-la para
   * cardio a corromperia. Quem registra aqui é `cardio_registrado`, um dos 7 eventos.
   */
  onRegistrarCardio?: (item?: { modalidade: string; minutos: number | null }) => void;
}) {
  const hojeIdx = weekdayHojeIdx();
  // 🔒 O dia de cardio vem do MOTOR (`rotina.diasCardio`). A tela não decide se o excedente
  // é cardio ou recuperação, nem calcula duração — se decidisse, existiriam duas respostas.
  const semana = montarSemana(treinoDias, sessoesNomes, hojeIdx, diasCardio);
  const [selDay, setSelDay] = useState(hojeIdx);
  const sd = semana[selDay]!;
  const proximo = proximoTreinoIdx(semana, hojeIdx);
  /** O item de cardio do dia excedente, quando existe. `null` = o dia é recuperação. */
  /**
   * O item do dia SELECIONADO. Vem do dia da faixa (`sd.cardio`, emitido pelo motor) e cai
   * no `diaExcedente` do Painel só quando a faixa não trouxe — é ele que carrega a virada
   * "massa com sessões batidas → recuperação", que depende do histórico.
   */
  const cardio = sd.tipo === 'cardio' && diaExcedente?.tipo === 'cardio'
    ? { ...diaExcedente, minutos: sd.cardio?.minutos ?? diaExcedente.minutos }
    : (sd.tipo === 'cardio' && diaExcedente == null && sd.cardio
      ? { tipo: 'cardio' as const, minutos: sd.cardio.minutos, modalidade: sd.cardio.modalidade as never }
      : null);
  /** Cardio próprio continua depois da musculação e precisa aparecer como parte do mesmo dia. */
  const cardioAposTreino = sd.tipo === 'treino' ? sd.cardio : undefined;

  const cellStyle = (isTraining: boolean, today: boolean, detailSel: boolean): CSSProperties => ({
    position: 'relative', flex: '1 1 0', minWidth: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
    padding: '14px 8px 13px', borderRadius: 14, cursor: 'pointer', textAlign: 'center', transition: 'all .18s ease',
    ...(isTraining ? { background: 'rgba(189,255,0,.08)', border: '1px solid rgba(189,255,0,.32)' } : { background: 'rgba(234,229,219,.035)', border: '1px solid rgba(234,229,219,.12)' }),
    ...(detailSel && !today ? { borderColor: 'rgba(189,255,0,.55)' } : {}),
    ...(today ? { boxShadow: '0 0 0 2px #BDFF00' } : {}),
  });

  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-.02em' }}>Sua semana</h2>
      <p style={{ margin: '0 0 16px', fontSize: '.95rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>Toque num dia para ver o treino ou o descanso. Hoje é {semana[hojeIdx]!.full}.</p>

      <div style={{ background: 'linear-gradient(165deg, rgba(22,163,74,.1), rgba(15,15,14,.5))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 20, padding: '22px 22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: '.78rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)' }}>Seg — Dom</span>
          <div style={{ flex: 1 }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '.78rem', color: 'rgba(234,229,219,.6)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#BDFF00', boxShadow: '0 0 7px rgba(189,255,0,.7)' }} />Treino</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '.78rem', color: 'rgba(234,229,219,.6)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', border: '1.5px solid rgba(234,229,219,.35)' }} />Descanso</span>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 2px 4px' }}>
          {semana.map((d) => (
            <div key={d.weekday} onClick={() => setSelDay(d.idx)} className="evk-semana-cell" style={cellStyle(d.isTraining, d.isToday, selDay === d.idx)}>
              {d.isToday && <span style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', fontSize: '.58rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#0D2818', background: '#BDFF00', borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>Hoje</span>}
              <span style={{ fontWeight: 700, fontSize: '.95rem', color: d.isTraining ? '#EAE5DB' : 'rgba(234,229,219,.7)' }}>{d.abbr}</span>
              <span style={d.tipo === 'treino' ? { width: 7, height: 7, borderRadius: '50%', background: '#BDFF00', boxShadow: '0 0 8px rgba(189,255,0,.7)' } : d.tipo === 'recuperacao' || d.tipo === 'cardio' ? { width: 7, height: 7, borderRadius: '50%', background: '#16A34A' } : { width: 7, height: 7, borderRadius: '50%', border: '1.5px solid rgba(234,229,219,.3)' }} />
              <span style={{ lineHeight: 1.2, fontSize: '.74rem', fontWeight: d.tipo === 'descanso' ? 600 : 700, color: d.tipo === 'treino' ? '#BDFF00' : d.tipo === 'recuperacao' || d.tipo === 'cardio' ? 'rgba(234,229,219,.78)' : 'rgba(234,229,219,.45)' }}>{d.tipo === 'treino' ? (d.sessionLabel ?? 'Treino') : d.tipo === 'cardio' ? (d.sessionLabel ?? 'Cardio') : d.tipo === 'recuperacao' ? 'Recuperação' : 'Descanso'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detalhe do dia selecionado */}
      <div style={{ marginTop: 16 }}>
        {sd.tipo === 'treino' ? (
          <div style={{ background: 'linear-gradient(160deg, rgba(189,255,0,.08), rgba(15,15,14,.4))', border: '1px solid rgba(189,255,0,.28)', borderRadius: 18, padding: 24, animation: `evkStepIn .35s ease` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
              <span style={{ width: 52, height: 52, minWidth: 52, borderRadius: 15, background: 'rgba(189,255,0,.12)', border: '1px solid rgba(189,255,0,.34)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={26} height={26} viewBox="0 0 24 24" fill="none"><path d="M6.5 9v6M17.5 9v6M4 10.5v3M20 10.5v3M6.5 12h11" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /></svg></span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00', marginBottom: 6 }}>{sd.isToday ? 'Hoje · Treino' : `${cap(sd.full)} · Treino`}</div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-.02em' }}>{sd.sessionLabel ?? 'Treino'}</h3>
                <p style={{ margin: 0, fontSize: '.95rem', color: 'rgba(234,229,219,.64)', lineHeight: 1.5 }}>{sd.isToday ? 'Seu treino de hoje está pronto quando você estiver.' : `Programado para ${sd.full}.`}</p>
                {cardioAposTreino && (
                  <p style={{ margin: '10px 0 0', fontSize: '.86rem', color: 'rgba(234,229,219,.78)', lineHeight: 1.5 }}>
                    Depois do treino: cardio · {ROTULO_MODALIDADE[cardioAposTreino.modalidade as never]}{cardioAposTreino.minutos != null ? ` · ${cardioAposTreino.minutos} min` : ''}.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignSelf: 'center' }}>
                <button onClick={() => sd.sessionIdx != null && onIrSessao(sd.sessionIdx)} className="hov-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.95rem', padding: '13px 24px', border: 'none', borderRadius: 13, cursor: 'pointer' }}>{sd.isToday ? 'Ir para a sessão' : 'Ver este treino'}<svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                {cardioAposTreino && onRegistrarCardio && (
                  <button onClick={() => onRegistrarCardio(cardioAposTreino)} className="evk-troca" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(22,163,74,.12)', border: '1px solid rgba(22,163,74,.34)', color: '#8FE3AA', fontWeight: 600, fontSize: '.88rem', padding: '12px 16px', borderRadius: 13, cursor: 'pointer' }}>Registrar cardio</button>
                )}
              </div>
            </div>
          </div>
        ) : (sd.tipo === 'recuperacao' || sd.tipo === 'cardio') ? (
          <div style={{ background: 'linear-gradient(160deg, rgba(22,163,74,.09), rgba(15,15,14,.4))', border: '1px solid rgba(22,163,74,.28)', borderRadius: 18, padding: 24, animation: `evkStepIn .35s ease` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
              <span style={{ width: 52, height: 52, minWidth: 52, borderRadius: 15, background: 'rgba(22,163,74,.14)', border: '1px solid rgba(22,163,74,.34)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={24} height={24} viewBox="0 0 24 24" fill="none"><path d="M3 12h4l2 5 4-12 2 7h6" stroke="#16A34A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div style={{ flex: 1, minWidth: 200 }}>
                {/* 🔒 A FRASE NÃO EXPLICA A FÓRMULA (DF 2026-08-01, teto de 90 min).
                    Ela dizia "a duração é a meta da semana dividida pelos dias de cardio" —
                    verdade até o teto existir, e FALSA quando ele morde (1 dia excedente:
                    a meta é 150, o dia mostra 90). 🔴 E a saída não é "faltam 60 min": isso
                    é alvo no futuro da atividade da pessoa, classes ① e ③ de vazamento.
                    O app mostra O QUE PRESCREVE e não afirma que a semana está coberta —
                    silêncio sobre o resto, não versão adaptada da frase.
                    🔒 Leva E — o dia excedente deixa de ser só um rótulo. Com meta em
                    minutos ele traz UM item de cardio (modalidade + duração, ambos do
                    motor); sem meta em minutos continua sendo recuperação, que não
                    prescreve nada. O texto do cardio NÃO fala no futuro nem promete
                    resultado: descreve o item do dia. */}
                <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#16A34A', marginBottom: 6 }}>{`${sd.isToday ? 'Hoje' : cap(sd.full)} · ${cardio ? 'Cardio' : 'Recuperação'}`}</div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-.02em' }}>{cardio ? (cardio.minutos != null ? `${ROTULO_MODALIDADE[cardio.modalidade]} · ${cardio.minutos} min` : ROTULO_MODALIDADE[cardio.modalidade]) : 'Recuperação ativa'}</h3>
                <p style={{ margin: 0, maxWidth: 520, fontSize: '.95rem', color: 'rgba(234,229,219,.64)', lineHeight: 1.5 }}>{cardio ? 'Dia ativo de cardio. Pode trocar a modalidade, a intensidade e a duração ao registrar.' : 'Um dia ativo mais leve — cardio leve ou mobilidade. Faz parte do plano: o corpo se fortalece se recuperando entre os treinos de força.'}</p>
              </div>
              {cardio && onRegistrarCardio ? (
                <button onClick={() => onRegistrarCardio(sd.cardio)} className="hov-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#16A34A', color: '#0D2818', fontWeight: 700, fontSize: '.95rem', padding: '13px 24px', border: 'none', borderRadius: 13, cursor: 'pointer', alignSelf: 'center' }}>Registrar cardio<svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" /></svg></button>
              ) : (
                <button onClick={onVerDieta} className="evk-troca" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.85)', fontWeight: 600, fontSize: '.92rem', padding: '12px 20px', borderRadius: 12, cursor: 'pointer', alignSelf: 'center' }}>Ver dieta de hoje</button>
              )}
            </div>
          </div>
        ) : sd.isToday ? (
          <div style={{ background: 'rgba(234,229,219,.035)', border: '1px solid rgba(234,229,219,.13)', borderRadius: 18, padding: '26px 24px', animation: `evkStepIn .35s ease` }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.7rem', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(234,229,219,.6)', background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.16)', borderRadius: 999, padding: '5px 12px', marginBottom: 16 }}><Lua />Descanso</span>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.02em' }}>Hoje é dia de descanso.</h3>
            <p style={{ margin: '0 0 20px', maxWidth: 520, fontSize: '1rem', color: 'rgba(234,229,219,.66)', lineHeight: 1.6 }}>Descanso faz parte do plano — é quando o corpo se reconstrói e fica mais forte. Aproveite para se recuperar; amanhã o treino continua.</p>
            <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
              {proximo >= 0 && (
                <button onClick={() => setSelDay(proximo)} className="hov-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(189,255,0,.08)', border: '1px solid rgba(189,255,0,.34)', color: '#BDFF00', fontWeight: 700, fontSize: '.92rem', padding: '12px 20px', borderRadius: 12, cursor: 'pointer' }}>Ver próximo treino<span style={{ opacity: .85, fontWeight: 600 }}>· {semana[proximo]!.abbr} · {semana[proximo]!.sessionLabel ?? 'Treino'}</span></button>
              )}
              <button onClick={onVerDieta} className="evk-troca" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.85)', fontWeight: 600, fontSize: '.92rem', padding: '12px 20px', borderRadius: 12, cursor: 'pointer' }}>Ver dieta de hoje</button>
            </div>
          </div>
        ) : (
          <div style={{ background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 18, padding: 24, animation: `evkStepIn .35s ease` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ width: 48, height: 48, minWidth: 48, borderRadius: 14, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lua size={22} cor="rgba(234,229,219,.6)" /></span>
              <div><div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 5 }}>{`${cap(sd.full)} · Descanso`}</div><h3 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-.02em' }}>{cap(sd.full)} é descanso.</h3><p style={{ margin: 0, fontSize: '.93rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>Descanso programado — faz parte do plano. Nada a fazer hoje.</p></div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: '15px 17px', marginTop: 18 }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx={12} cy={12} r={9} stroke="rgba(189,255,0,.5)" strokeWidth={1.7} /><path d="M12 11v5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /><circle cx={12} cy={7.8} r={1.05} fill="#BDFF00" /></svg>
        <p style={{ margin: 0, fontSize: '.86rem', color: 'rgba(234,229,219,.66)', lineHeight: 1.55 }}>A semana segue seus dias de treino. Quer mudar? Ajuste em <button onClick={onEditarPerfil} style={{ background: 'none', border: 'none', color: '#BDFF00', fontWeight: 600, fontSize: '.86rem', cursor: 'pointer', padding: 0, borderBottom: '1px dashed rgba(189,255,0,.5)' }}>Editar perfil</button>.</p>
      </div>
    </div>
  );
}

const Lua = ({ size = 13, cor = 'currentColor' }: { size?: number; cor?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" stroke={cor} strokeWidth={1.7} strokeLinejoin="round" /></svg>
);
