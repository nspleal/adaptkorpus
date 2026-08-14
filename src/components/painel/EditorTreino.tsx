'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { Exercise, GrupoPrimario } from '@/lib/data/types';
import type { DiaTreino, NivelExperiencia, Objetivo, RotinaCustom } from '@/lib/engine';
import { avaliarSemana, type Avaliacao, type DiaDoEditor, type ItemCritico } from '@/lib/engine/critico';
import { ROTULO_GRUPO } from '@/lib/frequencia-grupos';
import { DIA_LABEL, ORDEM_SEMANA, type Weekday } from '@/lib/semana';
import SeletorExercicio, { type ContextoSeletor } from './SeletorExercicio';

/**
 * 🧭 O EDITOR GUIADO — "Montar meu treino" (handoff-editor-guiado-2026-08-13).
 *
 * Fecha o pedido nº 5 do beta por inteiro: a pessoa monta o próprio treino **com o motor ao
 * lado**, recomendando enquanto ela monta e avisando do risco.
 *
 * 🔒 As três DFs, executadas aqui:
 *  ① **Aviso NÃO trava.** O botão de salvar nunca desabilita por causa do crítico; os
 *    avisos aparecem em vermelho, explicados, e a pessoa segue. Os únicos bloqueios do
 *    produto continuam sendo o gate de saúde e o piso legal de reps — nenhum mora aqui.
 *  ② **Séries/reps/RIR NÃO são editáveis.** O editor mexe em QUAIS exercícios e em QUE dia;
 *    a prescrição e a progressão continuam do motor, e o crítico segue visível depois de
 *    salvar (a faixa compacta no plano).
 *  ③ **O seletor é o mesmo do TROCAR** — uma peça, duas portas.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

export interface DiaEditavel {
  /** Rótulo do dia — herdado do plano ou "Dia N" no começo do zero. */
  nome: string;
  /** Dia da semana em que este treino cai (índice Seg=0…Dom=6). */
  weekdayIdx: number;
  exercicios: Exercise[];
}

/** Do plano gerado para o formato editável ("começar do meu plano atual"). */
export function doPlano(dias: readonly DiaTreino[], treinoDias: readonly Weekday[]): DiaEditavel[] {
  return dias.map((d, i) => ({
    nome: d.nome,
    weekdayIdx: ORDEM_SEMANA.indexOf(treinoDias[i] ?? ORDEM_SEMANA[i % 7]!),
    exercicios: d.slots.map((s) => s.exercicio),
  }));
}

/** Do formato editável para o que se persiste — SÓ o desenho (ids por dia). */
export function paraRotinaCustom(dias: readonly DiaEditavel[]): RotinaCustom {
  return {
    origem: 'usuario',
    dias: dias
      .filter((d) => d.exercicios.length > 0)
      .map((d) => ({ nome: d.nome, exercicioIds: d.exercicios.map((e) => e.id) })),
  };
}

export default function EditorTreino({
  inicial, ctxSeletor, exercises, nivel, objetivo, tempoPorSessaoMin, seriesPadrao,
  onSalvar, onCancelar, onVoltarAoRecomendado, temCustom, onDesbanir, onAvisoMostrado,
}: {
  inicial: DiaEditavel[];
  ctxSeletor: ContextoSeletor;
  exercises: readonly Exercise[];
  nivel: NivelExperiencia;
  objetivo: Objetivo;
  tempoPorSessaoMin: number;
  seriesPadrao: number;
  onSalvar: (dias: DiaEditavel[], avaliacao: Avaliacao) => void;
  onCancelar: () => void;
  onVoltarAoRecomendado: () => void;
  /** Já existe um treino montado? Só então "Voltar ao recomendado" tem o que desfazer. */
  temCustom: boolean;
  onDesbanir?: (id: string) => void;
  /** Telemetria do risco exibido — o EVENTO ADVERSO da leva (payload fechado). */
  onAvisoMostrado?: (codigos: string[]) => void;
}) {
  const [dias, setDias] = useState<DiaEditavel[]>(inicial.length > 0 ? inicial : [{ nome: 'Dia 1', weekdayIdx: 0, exercicios: [] }]);
  const [abrindoEm, setAbrindoEm] = useState<number | null>(null);
  const [confirmarVolta, setConfirmarVolta] = useState(false);

  const avaliacao = useMemo<Avaliacao>(() => {
    const paraCritico: DiaDoEditor[] = dias.map((d) => ({ nome: d.nome, exercicios: d.exercicios }));
    return avaliarSemana(paraCritico, {
      nivel, objetivo, tempoPorSessaoMin,
      diasDaSemanaIdx: dias.map((d) => d.weekdayIdx),
      seriesPadrao,
    });
  }, [dias, nivel, objetivo, tempoPorSessaoMin, seriesPadrao]);

  const total = dias.reduce((n, d) => n + d.exercicios.length, 0);

  const mut = (i: number, f: (d: DiaEditavel) => DiaEditavel) => setDias((p) => p.map((d, k) => (k === i ? f(d) : d)));
  const mover = (i: number, k: number, delta: number) => mut(i, (d) => {
    const ex = [...d.exercicios];
    const alvo = k + delta;
    if (alvo < 0 || alvo >= ex.length) return d;
    [ex[k], ex[alvo]] = [ex[alvo]!, ex[k]!];
    return { ...d, exercicios: ex };
  });

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '28px 20px 48px', animation: `evkScreenIn .45s ${EASE}` }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-.02em' }}>Montar meu treino</h1>
        <p style={{ margin: '0 0 20px', fontSize: '.9rem', color: 'rgba(234,229,219,.62)', lineHeight: 1.55 }}>
          Você escolhe os exercícios e em que dia cada um entra. As séries, as repetições e o descanso
          continuam vindo do app, e a progressão segue igual à do treino recomendado.
        </p>

        {/* ═══ O CRÍTICO — placar, recomendações e avisos, ao vivo enquanto monta ═══ */}
        <PainelCritico avaliacao={avaliacao} />

        {dias.map((d, i) => (
          <div key={i} style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <input
                value={d.nome}
                onChange={(e) => mut(i, (x) => ({ ...x, nome: e.target.value.slice(0, 60) }))}
                aria-label={`Nome do dia ${i + 1}`}
                className="input-foco"
                style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', borderBottom: '1px solid rgba(234,229,219,.14)', color: '#EAE5DB', fontSize: '1rem', fontWeight: 700, padding: '4px 0', outline: 'none' }}
              />
              {dias.length > 1 && (
                <button onClick={() => setDias((p) => p.filter((_, k) => k !== i))} style={btnGhost} aria-label={`Remover ${d.nome}`}>Remover dia</button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {ORDEM_SEMANA.map((w, wi) => (
                <button key={w} type="button" onClick={() => mut(i, (x) => ({ ...x, weekdayIdx: wi }))} aria-pressed={d.weekdayIdx === wi} style={pill(d.weekdayIdx === wi)}>
                  {DIA_LABEL[w].abbr}
                </button>
              ))}
            </div>

            {d.exercicios.length === 0 && (
              <p style={{ margin: '0 0 10px', fontSize: '.86rem', color: 'rgba(234,229,219,.5)' }}>Nenhum exercício ainda neste dia.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
              {d.exercicios.map((ex, k) => (
                <div key={`${ex.id}-${k}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(13,40,24,.4)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.94rem', fontWeight: 600 }}>{ex.nomePt}</div>
                    <div style={{ fontSize: '.76rem', color: 'rgba(234,229,219,.5)' }}>{ROTULO_GRUPO[ex.grupoPrimario ?? ''] ?? ex.grupoMuscular}</div>
                  </div>
                  <button onClick={() => mover(i, k, -1)} disabled={k === 0} style={{ ...btnIcone, opacity: k === 0 ? 0.3 : 1 }} aria-label="Subir">↑</button>
                  <button onClick={() => mover(i, k, +1)} disabled={k === d.exercicios.length - 1} style={{ ...btnIcone, opacity: k === d.exercicios.length - 1 ? 0.3 : 1 }} aria-label="Descer">↓</button>
                  <button onClick={() => mut(i, (x) => ({ ...x, exercicios: x.exercicios.filter((_, j) => j !== k) }))} style={btnIcone} aria-label={`Remover ${ex.nomePt}`}>×</button>
                </div>
              ))}
            </div>
            <button onClick={() => setAbrindoEm(i)} style={btnGhost}>+ Adicionar exercício</button>
          </div>
        ))}

        <button onClick={() => setDias((p) => [...p, { nome: `Dia ${p.length + 1}`, weekdayIdx: Math.min(6, p.length), exercicios: [] }])} style={{ ...btnGhost, width: '100%', marginBottom: 20 }}>
          + Adicionar dia
        </button>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onCancelar} style={btnGhost}>Cancelar</button>
          {temCustom && (
            <button onClick={() => setConfirmarVolta(true)} style={btnGhost}>Voltar ao recomendado</button>
          )}
          {/* 🔒 DF① — o salvar NUNCA desabilita por causa de aviso. Só o treino vazio não
              salva, e isso não é risco: é ausência de treino. */}
          <button
            onClick={() => { onAvisoMostrado?.(avaliacao.avisos.map((a) => a.codigo)); onSalvar(dias, avaliacao); }}
            disabled={total === 0}
            className={total > 0 ? 'hov-btn' : ''}
            style={{ flex: 1, minWidth: 180, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 13, cursor: total > 0 ? 'pointer' : 'not-allowed', opacity: total > 0 ? 1 : 0.4 }}
          >
            Salvar meu treino
          </button>
        </div>
        {total === 0 && <p style={{ margin: '10px 2px 0', fontSize: '.84rem', color: 'rgba(234,229,219,.5)' }}>Adicione ao menos um exercício para salvar.</p>}
      </div>

      {abrindoEm != null && (
        <SeletorExercicio
          exercises={exercises}
          ctx={ctxSeletor}
          onEscolher={(ex) => { mut(abrindoEm, (d) => ({ ...d, exercicios: [...d.exercicios, ex] })); setAbrindoEm(null); }}
          onDesbanir={onDesbanir}
          onFechar={() => setAbrindoEm(null)}
        />
      )}

      {confirmarVolta && (
        <div onClick={() => setConfirmarVolta(false)} style={{ position: 'fixed', inset: 0, zIndex: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.66)', backdropFilter: 'blur(6px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: '1px solid rgba(234,229,219,.14)', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Voltar ao treino recomendado?</div>
            <p style={{ margin: '0 0 16px', fontSize: '.9rem', color: 'rgba(234,229,219,.7)', lineHeight: 1.55 }}>
              O treino que você montou sai, e o app volta a montar o seu. Dá para montar de novo quando quiser.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmarVolta(false)} style={btnGhost}>Manter o meu</button>
              <button onClick={() => { setConfirmarVolta(false); onVoltarAoRecomendado(); }} style={{ flex: 1, background: '#BDFF00', color: '#0D2818', fontWeight: 700, padding: 12, border: 'none', borderRadius: 12, cursor: 'pointer' }}>Voltar ao recomendado</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * O PLACAR + as sugestões + os avisos. Mesmo componente no editor e (compacto) no plano
 * salvo — DF②: *"o crítico permanece visível no plano custom, não só na montagem"*.
 */
export function PainelCritico({ avaliacao, compacto = false }: { avaliacao: Avaliacao; compacto?: boolean }) {
  const { placar, recomendacoes, avisos } = avaliacao;
  const visiveis = compacto ? recomendacoes.slice(0, 1) : recomendacoes;
  return (
    <div style={{ background: 'rgba(13,40,24,.4)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, padding: 15, marginBottom: 16 }}>
      {!compacto && (
        <>
          <div style={{ fontSize: '.76rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 9 }}>Sua semana</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: visiveis.length || avisos.length ? 13 : 0 }}>
            {placar.map((l) => (
              <span key={l.grupo} title={`${l.ponderado} de ${l.mev}–${l.mrv} séries`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '.8rem', fontWeight: 600, border: `1px solid ${corDoStatus(l.status).borda}`, color: corDoStatus(l.status).texto, borderRadius: 999, padding: '5px 10px' }}>
                {corDoStatus(l.status).marca} {l.rotulo} <span style={{ opacity: 0.7, fontWeight: 500 }}>{l.ponderado}</span>
              </span>
            ))}
          </div>
        </>
      )}
      {avisos.map((a, i) => <Linha key={`a${i}`} item={a} />)}
      {visiveis.map((r, i) => <Linha key={`r${i}`} item={r} />)}
      {!compacto && avisos.length === 0 && recomendacoes.length === 0 && (
        <p style={{ margin: 0, fontSize: '.86rem', color: 'rgba(234,229,219,.6)' }}>Sua semana está dentro das faixas do seu nível.</p>
      )}
    </div>
  );
}

function Linha({ item }: { item: ItemCritico }) {
  const risco = item.severidade === 'risco';
  return (
    <p role={risco ? 'alert' : 'status'} style={{ margin: '0 0 8px', fontSize: '.86rem', lineHeight: 1.5, color: risco ? '#E5484D' : 'rgba(234,229,219,.8)' }}>
      <span aria-hidden style={{ marginRight: 6 }}>{risco ? '🔴' : '🟡'}</span>{item.texto}
    </p>
  );
}

const corDoStatus = (s: string) =>
  s === 'na_banda' ? { marca: '🟢', borda: 'rgba(22,163,74,.45)', texto: 'rgba(234,229,219,.9)' }
  : s === 'acima_mrv' ? { marca: '🔴', borda: 'rgba(229,72,77,.45)', texto: '#E5484D' }
  : { marca: '⚪', borda: 'rgba(234,229,219,.2)', texto: 'rgba(234,229,219,.62)' };

const pill = (ativo: boolean): CSSProperties => ({
  background: ativo ? 'rgba(189,255,0,.14)' : 'none',
  border: `1px solid ${ativo ? 'rgba(189,255,0,.5)' : 'rgba(234,229,219,.18)'}`,
  color: ativo ? '#BDFF00' : 'rgba(234,229,219,.75)',
  fontWeight: 600, fontSize: '.8rem', padding: '6px 10px', borderRadius: 999, cursor: 'pointer', minWidth: 44,
});
const btnGhost: CSSProperties = {
  background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB',
  fontWeight: 600, fontSize: '.88rem', padding: '11px 15px', borderRadius: 12, cursor: 'pointer',
};
const btnIcone: CSSProperties = {
  background: 'none', border: '1px solid rgba(234,229,219,.16)', color: 'rgba(234,229,219,.8)',
  width: 32, minWidth: 32, height: 32, borderRadius: 9, cursor: 'pointer', fontSize: '.95rem', lineHeight: 1,
};

/** Só para o teste de tipo do grupo — mantém o import de GrupoPrimario honesto. */
export type GrupoDoPlacar = GrupoPrimario;
