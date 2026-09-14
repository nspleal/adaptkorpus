'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Exercise, GrupoPrimario } from '@/lib/data/types';
import type { DiaTreino, NivelExperiencia, Objetivo, RotinaCustom } from '@/lib/engine';
import { avaliarSemana, type Avaliacao, type DiaDoEditor, type ItemCritico } from '@/lib/engine/critico';
import { SERIES_MANUAIS_MAX } from '@/lib/engine/treino-constants';
import { ROTULO_GRUPO } from '@/lib/frequencia-grupos';
import { DIA_LABEL, ORDEM_SEMANA, type Weekday } from '@/lib/semana';
import SeletorExercicio, { type ContextoSeletor } from './SeletorExercicio';
import { adicionarSemDuplicar, identidadesDe } from '@/lib/exercicio-identidade';
import ResumoSeries from './ResumoSeries';
import OrdemExercicios from './OrdemExercicios';

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
 *  ② Pedido posterior (2026-09-10): séries manuais no treino customizado.
 *    Reps/RIR/descanso continuam automáticos; o crítico permanece visível.
 *  ③ **O seletor é o mesmo do TROCAR** — uma peça, duas portas.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

export interface DiaEditavel {
  /** Rótulo do dia — herdado do plano ou "Dia N" no começo do zero. */
  nome: string;
  /** Dia da semana em que este treino cai (índice Seg=0…Dom=6). */
  weekdayIdx: number;
  exercicios: Exercise[];
  seriesPorExercicio?: Record<string, number>;
}

/** Do plano gerado para o formato editável ("começar do meu plano atual"). */
export function doPlano(dias: readonly DiaTreino[], treinoDias: readonly Weekday[], custom?: RotinaCustom): DiaEditavel[] {
  return dias.map((d, i) => ({
    nome: d.nome,
    // `diaId` é a fonte nova; agenda/posição é apenas compatibilidade para plano legado.
    weekdayIdx: Math.max(0, ORDEM_SEMANA.indexOf(d.diaId ?? treinoDias[i] ?? ORDEM_SEMANA[i % 7]!)),
    exercicios: d.slots.map((s) => s.exercicio),
    seriesPorExercicio: custom?.dias.find((dia, indice) => (dia.diaId ?? treinoDias[indice]) === (d.diaId ?? treinoDias[i]))?.seriesPorExercicio ?? Object.fromEntries(d.slots.filter((s) => s.seriesDefinidasPeloUsuario && s.series != null).map((s) => [s.exercicio.id, s.series!])),
  }));
}

/** Um treino de força por dia nesta versão. Sessões duplas exigirão uma identidade de sessão própria. */
export function weekdaysSaoUnicos(dias: readonly DiaEditavel[]): boolean {
  return new Set(dias.map((d) => d.weekdayIdx)).size === dias.length;
}

/** Do formato editável para o que se persiste — SÓ o desenho (ids por dia). */
export function paraRotinaCustom(dias: readonly DiaEditavel[]): RotinaCustom {
  return {
    origem: 'usuario',
    dias: dias
      .filter((d) => d.exercicios.length > 0)
      .map((d) => ({ nome: d.nome, diaId: ORDEM_SEMANA[d.weekdayIdx]!, exercicioIds: d.exercicios.map((e) => e.id),
        ...(d.seriesPorExercicio && Object.keys(d.seriesPorExercicio).length ? { seriesPorExercicio: Object.fromEntries(d.exercicios.filter((e) => d.seriesPorExercicio?.[e.id] != null).map((e) => [e.id, d.seriesPorExercicio![e.id]!])) } : {}),
      })),
  };
}

export default function EditorTreino({
  inicial, ctxSeletor, exercises, nivel, objetivo, tempoPorSessaoMin, limiteTempoTreino, preverPlano,
  onSalvar, onCancelar, onVoltarAoRecomendado, temCustom, onDesbanir, onAvisoMostrado,
}: {
  inicial: DiaEditavel[];
  ctxSeletor: ContextoSeletor;
  exercises: readonly Exercise[];
  nivel: NivelExperiencia;
  objetivo: Objetivo;
  tempoPorSessaoMin: number;
  limiteTempoTreino?: 'limitado' | 'sem_limite';
  /**
   * 🔑 A PRÉVIA REAL, não uma estimativa. Recebe o desenho em construção e devolve o que o
   * MOTOR produziria com ele — séries e descanso incluídos.
   *
   * ⚠️ Isto nasceu de um defeito medido no próprio aceite 3: a 1ª versão pintava o placar
   * com um número fixo de séries por exercício, e o motor atribui outra coisa (ele
   * distribui o alvo da banda pelos slots, clampado em `n × sMax`). Resultado: 5 exercícios
   * de peito apareciam como "10 ⚪ abaixo do mínimo" enquanto o plano salvo entregaria 16 —
   * o crítico mentiria justamente sobre o número que ele existe para explicar. A regra da
   * casa vale aqui como no resto: **não estime o que dá para calcular com a função real.**
   */
  preverPlano: (dias: readonly DiaEditavel[]) => DiaDoEditor[];
  onSalvar: (dias: DiaEditavel[], avaliacao: Avaliacao) => void;
  onCancelar: () => void;
  onVoltarAoRecomendado: () => void;
  /** Já existe um treino montado? Só então "Gerar novo treino" tem o que desfazer. */
  temCustom: boolean;
  onDesbanir?: (id: string) => void;
  /** Telemetria do risco exibido — o EVENTO ADVERSO da leva (payload fechado). */
  onAvisoMostrado?: (codigos: string[]) => void;
}) {
  const [dias, setDias] = useState<DiaEditavel[]>(inicial.length > 0 ? inicial : [{ nome: 'Dia 1', weekdayIdx: 0, exercicios: [] }]);
  const [abrindoEm, setAbrindoEm] = useState<number | null>(null);
  const [confirmarVolta, setConfirmarVolta] = useState(false);
  const previsto = useMemo(() => preverPlano(dias), [dias, preverPlano]);

  const avaliacao = useMemo<Avaliacao>(() => {
    // A prévia vem do MOTOR (mesmo caminho do plano salvo); os dias com exercício mantêm a
    // ordem, então os índices de dia da semana acompanham por posição.
    const comExercicio = dias.filter((d) => d.exercicios.length > 0);
    // 🔒 O editor NÃO supre `seriesPadrao`: o placar vem do MOTOR (preverPlano). Onde o motor
    // não anotou séries (deload/corpo-inteiro), o placar cai no piso do próprio crítico — e o
    // critério de TEMPO abstém-se (C1), nunca inventa.
    return avaliarSemana(previsto, {
      nivel, objetivo, tempoPorSessaoMin, limiteTempoTreino,
      diasDaSemanaIdx: comExercicio.slice(0, previsto.length).map((d) => d.weekdayIdx),
    });
  }, [dias, nivel, objetivo, tempoPorSessaoMin, limiteTempoTreino, previsto]);

  const total = dias.reduce((n, d) => n + d.exercicios.length, 0);
  const diasUnicos = weekdaysSaoUnicos(dias);
  const proximoDiaLivre = (atuais: readonly DiaEditavel[]) =>
    Math.max(0, ORDEM_SEMANA.findIndex((_, indice) => !atuais.some((dia) => dia.weekdayIdx === indice)));

  const mut = (i: number, f: (d: DiaEditavel) => DiaEditavel) => setDias((p) => p.map((d, k) => (k === i ? f(d) : d)));
  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '28px 20px 48px', animation: `evkScreenIn .45s ${EASE}` }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-.02em' }}>Montar meu treino</h1>
        <p style={{ margin: '0 0 20px', fontSize: '.9rem', color: 'rgba(234,229,219,.62)', lineHeight: 1.55 }}>
          Escolha vários exercícios de uma vez, organize a ordem e ajuste as séries.
          Repetições e descanso seguem as recomendações do app. Nas fases de recuperação, o volume pode ser reduzido.
        </p>

        {/* ═══ O CRÍTICO — placar, recomendações e avisos, ao vivo enquanto monta ═══ */}
        <PainelCritico avaliacao={avaliacao} />
        <ResumoSeries slots={previsto.flatMap((dia) => dia.exercicios.map((exercicio, i) => ({ exercicio, series: dia.series?.[i] ?? 0 })))} />

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

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <strong style={{ color: '#BDFF00' }}>{DIA_LABEL[ORDEM_SEMANA[d.weekdayIdx]!].full}</strong>
              <details><summary style={{ cursor: 'pointer', padding: '10px 0' }}>Trocar o dia</summary>
                <label>Dia do treino <select aria-label={`Dia de ${d.nome}`} value={d.weekdayIdx} onChange={(e) => { mut(i, x => ({ ...x, weekdayIdx: Number(e.target.value) })); e.currentTarget.closest('details')?.removeAttribute('open'); }} style={{ padding: 10, borderRadius: 10, background: '#12321f', color: '#EAE5DB' }}>
                  {ORDEM_SEMANA.map((w, wi) => <option key={w} value={wi} disabled={dias.some((outro, k) => k !== i && outro.weekdayIdx === wi)}>{DIA_LABEL[w].full}</option>)}
                </select></label>
              </details>
            </div>


            <p style={{ color: 'rgba(234,229,219,.8)', fontSize: '.85rem' }}>{d.exercicios.length} exercícios · {d.exercicios.length ? previsto[dias.slice(0, i).filter((dia) => dia.exercicios.length).length]?.series?.reduce<number>((n, s) => n + (s ?? 0), 0) ?? 0 : 0} séries previstas</p>
            {d.exercicios.length === 0 && (
              <p style={{ margin: '0 0 10px', fontSize: '.86rem', color: 'rgba(234,229,219,.5)' }}>Nenhum exercício ainda neste dia.</p>
            )}
            <OrdemExercicios exercicios={d.exercicios} onMover={(de, para) => mut(i, (dia) => { const itens = [...dia.exercicios]; const [item] = itens.splice(de, 1); itens.splice(para, 0, item!); return { ...dia, exercicios: itens }; })}>
              {(ex, k) => (<>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.94rem', fontWeight: 600 }}>{ex.nomePt}</div>
                    <div style={{ fontSize: '.76rem', color: 'rgba(234,229,219,.5)' }}>{ROTULO_GRUPO[ex.grupoPrimario ?? ''] ?? ex.grupoMuscular}</div>
                  </div>
                  <CampoSeries nome={ex.nomePt} valor={d.seriesPorExercicio?.[ex.id] ?? previsto[dias.slice(0, i).filter((dia) => dia.exercicios.length).length]?.series?.[k] ?? 1} onMudar={(valor) => mut(i, (dia) => ({ ...dia, seriesPorExercicio: { ...dia.seriesPorExercicio, [ex.id]: valor } }))} />
                  <button onClick={() => mut(i, (x) => ({ ...x, exercicios: x.exercicios.filter((_, j) => j !== k) }))} style={btnIcone} aria-label={`Remover ${ex.nomePt}`}>×</button>
                </>
              )}
            </OrdemExercicios>
            <button onClick={() => setAbrindoEm(i)} style={{ ...btnGhost, width: '100%', background: '#BDFF00', color: '#0D2818', minHeight: 48 }}>+ Adicionar exercícios</button>
          </div>
        ))}

        <button
          disabled={dias.length >= ORDEM_SEMANA.length}
          onClick={() => setDias((p) => [...p, { nome: `Dia ${p.length + 1}`, weekdayIdx: proximoDiaLivre(p), exercicios: [] }])}
          style={{ ...btnGhost, width: '100%', marginBottom: 20, opacity: dias.length >= ORDEM_SEMANA.length ? .4 : 1 }}
        >
          + Adicionar dia
        </button>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onCancelar} style={btnGhost}>Cancelar</button>
          {temCustom && (
            <button onClick={() => setConfirmarVolta(true)} style={btnGhost}>Gerar novo treino</button>
          )}
          {/* 🔒 DF① — o salvar NUNCA desabilita por causa de aviso. Só o treino vazio não
              salva, e isso não é risco: é ausência de treino. */}
          <button
            onClick={() => { onAvisoMostrado?.(avaliacao.avisos.map((a) => a.codigo)); onSalvar(dias, avaliacao); }}
            disabled={total === 0 || !diasUnicos}
            className={total > 0 && diasUnicos ? 'hov-btn' : ''}
            style={{ flex: 1, minWidth: 180, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 13, cursor: total > 0 && diasUnicos ? 'pointer' : 'not-allowed', opacity: total > 0 && diasUnicos ? 1 : 0.4 }}
          >
            Salvar meu treino
          </button>
        </div>
        {total === 0 && <p style={{ margin: '10px 2px 0', fontSize: '.84rem', color: 'rgba(234,229,219,.5)' }}>Adicione ao menos um exercício para salvar.</p>}
        {!diasUnicos && <p style={{ margin: '10px 2px 0', fontSize: '.84rem', color: '#ffb4a5' }}>Escolha dias diferentes: por enquanto, cada dia comporta um treino.</p>}
      </div>

      {/* 🔒 D19 — a trava mora na OPERAÇÃO: os dois caminhos de inclusão (clique individual
          e "Adicionar selecionados") passam pela mesma `adicionarSemDuplicar`. A marcação
          "Já neste treino" é só a aparência disso, e o dia continua sendo o escopo: o mesmo
          exercício em OUTRO dia não é tocado, e duplicata já gravada não é removida. */}
      {abrindoEm != null && (
        <SeletorExercicio
          exercises={exercises}
          ctx={ctxSeletor}
          jaAdicionados={identidadesDe(dias[abrindoEm]?.exercicios ?? [])}
          onEscolher={(ex) => { mut(abrindoEm, (d) => ({ ...d, exercicios: adicionarSemDuplicar(d.exercicios, [ex]).lista })); setAbrindoEm(null); }}
          onEscolherVarios={(selecionados) => { mut(abrindoEm, (d) => ({ ...d, exercicios: adicionarSemDuplicar(d.exercicios, selecionados).lista })); setAbrindoEm(null); }}
          onDesbanir={onDesbanir}
          onFechar={() => setAbrindoEm(null)}
        />
      )}

      {confirmarVolta && (
        <div onClick={() => setConfirmarVolta(false)} style={{ position: 'fixed', inset: 0, zIndex: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.66)', backdropFilter: 'blur(6px)' }}>
          <div role="dialog" aria-modal="true" aria-label="Substituir pelo novo treino" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: '1px solid rgba(234,229,219,.14)', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Substituir pelo novo treino?</div>
            <p style={{ margin: '0 0 16px', fontSize: '.9rem', color: 'rgba(234,229,219,.7)', lineHeight: 1.55 }}>
              O treino atual será substituído por uma nova montagem com o perfil atual. Seus registros e histórico serão preservados.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmarVolta(false)} style={btnGhost}>Manter o meu</button>
              <button onClick={() => { setConfirmarVolta(false); onVoltarAoRecomendado(); }} style={{ flex: 1, background: '#BDFF00', color: '#0D2818', fontWeight: 700, padding: 12, border: 'none', borderRadius: 12, cursor: 'pointer' }}>Gerar novo treino</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CampoSeries({ nome, valor, onMudar }: { nome: string; valor: number; onMudar: (valor: number) => void }) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  return <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem' }}>Séries
    <input type="number" inputMode="numeric" min={1} max={SERIES_MANUAIS_MAX} step={1} aria-label={`Séries de ${nome}`} value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { const n = Number(texto); if (Number.isInteger(n) && n >= 1 && n <= SERIES_MANUAIS_MAX) onMudar(n); else setTexto(String(valor)); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      style={{ width: 58, minHeight: 44, borderRadius: 10, background: '#0D2818', color: '#EAE5DB', border: '1px solid rgba(234,229,219,.4)', padding: 8, font: 'inherit' }} />
  </label>;
}

/**
 * O PLACAR + as sugestões + os avisos. Mesmo componente no editor e (compacto) no plano
 * salvo — DF②: *"o crítico permanece visível no plano custom, não só na montagem"*.
 */
/**
 * 🔴 D16 (auditoria 2026-09-11) — O QUE O CRÍTICO REALMENTE MOSTRA, em fonte única.
 *
 * No plano salvo o crítico é COMPACTO: ele exibe uma recomendação. Quem decide suprimir o eco
 * do motor (`lib/avisos-unificados`) precisa comparar contra o que a tela EXIBE, não contra a
 * lista inteira — senão um fato cuja fala do crítico ficou de fora do compacto sairia das duas
 * listas e desapareceria da tela. Uma régua só, aqui, para os dois consumidores.
 */
export function recomendacoesVisiveis(avaliacao: Pick<Avaliacao, 'recomendacoes'>, compacto: boolean): ItemCritico[] {
  return compacto ? avaliacao.recomendacoes.slice(0, 1) : [...avaliacao.recomendacoes];
}

export function PainelCritico({ avaliacao, compacto = false }: { avaliacao: Avaliacao; compacto?: boolean }) {
  const { placar, recomendacoes, avisos } = avaliacao;
  const visiveis = recomendacoesVisiveis(avaliacao, compacto);
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

const btnGhost: CSSProperties = {
  background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB',
  fontWeight: 600, fontSize: '.88rem', padding: '11px 15px', borderRadius: 12, cursor: 'pointer',
};
const btnIcone: CSSProperties = {
  background: 'rgba(234,229,219,.08)', border: '1px solid rgba(234,229,219,.3)', color: '#EAE5DB',
  width: 44, minWidth: 44, height: 44, borderRadius: 12, cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1,
};

/** Só para o teste de tipo do grupo — mantém o import de GrupoPrimario honesto. */
