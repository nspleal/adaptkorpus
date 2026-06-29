'use client';

import { useEffect, useState } from 'react';
import { KAscendente, Wordmark } from '@/lib/brand/Logo';
import { substituirExercicio, substituirPrato } from '@/lib/engine';
import { EXERCISES_SEED, FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import type {
  CardapioItem,
  DiaTreino,
  NivelAtividade,
  NivelExperiencia,
  Objetivo,
  ResultadoMotor,
  ResultadoTreino,
  Sexo,
} from '@/lib/engine';
import type { Alergeno, EquipamentoDisp, Exercise, RecipeMacros } from '@/lib/data/types';

/**
 * Painel (área logada) — Hoje · Treino · Dieta · Progresso · Perfil.
 * Estética do handoff de design; ligado ao motor determinístico real (gate/dieta/
 * treino/substituição F.2). Sem IA, sem rede. Demo local (sem persistência — Fase 1).
 */

export interface PerfilResumo {
  sexo: Sexo;
  idade: number;
  alturaCm: number;
  pesoKg: number;
  objetivo: Objetivo;
  nivelAtividade: NivelAtividade;
  nivelExperiencia: NivelExperiencia;
  equipamento: EquipamentoDisp;
  preferencia: 'vegano' | 'vegetariano' | null;
  alergenos: Alergeno[];
  diasDisponiveis: number;
  tempoPorSessaoMin: number;
}

const r0 = (n: number) => Math.round(n);
const REFEICAO_LABEL: Record<string, string> = { cafe: 'Café', almoco: 'Almoço', jantar: 'Jantar', lanche: 'Lanche' };
const PADRAO_LABEL: Record<string, string> = {
  empurrar: 'Empurrar', puxar: 'Puxar', agachar: 'Agachar',
  dobradica_quadril: 'Dobradiça', core: 'Core', cardio: 'Cardio', isolado: 'Isolado',
};
const OBJETIVO_LABEL: Record<Objetivo, string> = { emagrecimento: 'Emagrecer', massa: 'Ganhar massa', saude: 'Manter / Saúde' };
const EQUIP_LABEL: Record<EquipamentoDisp, string> = { nenhum: 'Sem equipamento', casa: 'Em casa', academia: 'Academia' };
const ATIV_LABEL: Record<NivelAtividade, string> = { sedentario: 'Sedentário', leve: 'Leve', moderado: 'Moderado', intenso: 'Intenso', muito_intenso: 'Muito intenso' };
const PORCOES: { f: number; r: string }[] = [
  { f: 0.5, r: '½' }, { f: 0.75, r: '¾' }, { f: 1, r: '1' }, { f: 1.25, r: '1¼' }, { f: 1.5, r: '1½' }, { f: 2, r: '2' },
];

function escalar(m: RecipeMacros, s: number): RecipeMacros {
  return { kcal: m.kcal * s, proteinaG: m.proteinaG * s, carboidratoG: m.carboidratoG * s, gorduraG: m.gorduraG * s };
}

type Aba = 'hoje' | 'treino' | 'dieta' | 'progresso' | 'perfil';
type Feedback = 'facil' | 'na_medida' | 'dificil';
type Modal =
  | { tipo: 'prato'; idx: number; opcoes: OpcaoPrato[]; excl: string[] }
  | { tipo: 'porcao'; idx: number }
  | { tipo: 'exercicio'; d: number; s: number; opcoes: Exercise[]; excl: string[] }
  | null;

interface OpcaoPrato { prato: CardapioItem['prato']; escala: number; macros: RecipeMacros; diaNew: RecipeMacros }

export default function Painel({ perfil, dieta, treino, onSair }: {
  perfil: PerfilResumo; dieta: ResultadoMotor; treino: ResultadoTreino; onSair: () => void;
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

  useEffect(() => {
    // Data só no cliente (evita mismatch de hidratação; o motor não usa relógio).
    setDataHoje(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
  }, []);

  const marcar = (k: string) => setTrocados((prev) => new Set(prev).add(k));

  /* ─── substituição de prato (3 opções + "gerar mais variedade") ─────── */
  function gerarOpcoesPrato(idx: number, excluir: string[]): OpcaoPrato[] {
    if (!dieta.plano || !cardTotais) return [];
    const item = cardItens[idx]!;
    const outros = cardItens.filter((_, i) => i !== idx).map((c) => c.prato.id);
    const usados = new Set(excluir);
    const out: OpcaoPrato[] = [];
    for (let k = 0; k < 3; k++) {
      const r = substituirPrato({
        pratoAtual: item.prato, slot: item.refeicao, recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED,
        plano: dieta.plano, totaisDiaAtual: cardTotais, escalaAtual: item.escala,
        restricoes, gosto: { excluirPratoIds: [...outros, ...usados] },
      });
      if (r.status === 'ok' && r.prato && r.escala != null && r.macrosNovo && r.totaisDiaNovo) {
        out.push({ prato: r.prato, escala: r.escala, macros: r.macrosNovo, diaNew: r.totaisDiaNovo });
        usados.add(r.prato.id);
      } else break;
    }
    return out;
  }
  function abrirTrocaPrato(idx: number) {
    const opcoes = gerarOpcoesPrato(idx, []);
    setModal({ tipo: 'prato', idx, opcoes, excl: opcoes.map((o) => o.prato.id) });
  }
  function maisVariedadePrato() {
    if (modal?.tipo !== 'prato') return;
    const novas = gerarOpcoesPrato(modal.idx, modal.excl);
    if (novas.length > 0) setModal({ ...modal, opcoes: novas, excl: [...modal.excl, ...novas.map((o) => o.prato.id)] });
  }
  function aplicarPrato(idx: number, o: OpcaoPrato) {
    const novos = cardItens.slice();
    novos[idx] = { refeicao: cardItens[idx]!.refeicao, prato: o.prato, escala: o.escala, macros: o.macros };
    setCardItens(novos);
    setCardTotais(o.diaNew);
    marcar(`p${idx}`);
    setModal(null);
  }

  /* ─── editar porção ─────────────────────────────────────────────────── */
  function aplicarPorcao(idx: number, f: number) {
    const item = cardItens[idx]!;
    const novoMacros = escalar(item.macros, f);
    const novos = cardItens.slice();
    novos[idx] = { ...item, escala: item.escala * f, macros: novoMacros };
    setCardItens(novos);
    setCardTotais((prev) => prev ? {
      kcal: prev.kcal - item.macros.kcal + novoMacros.kcal,
      proteinaG: prev.proteinaG - item.macros.proteinaG + novoMacros.proteinaG,
      carboidratoG: prev.carboidratoG - item.macros.carboidratoG + novoMacros.carboidratoG,
      gorduraG: prev.gorduraG - item.macros.gorduraG + novoMacros.gorduraG,
    } : prev);
    marcar(`p${idx}`);
    setModal(null);
  }

  /* ─── substituição de exercício ─────────────────────────────────────── */
  function gerarOpcoesEx(d: number, s: number, excluir: string[]): Exercise[] {
    const atual = rotinaDias[d]!.slots[s]!.exercicio;
    const usados = new Set([...rotinaDias.flatMap((dia) => dia.slots.map((sl) => sl.exercicio.id)), ...excluir]);
    const out: Exercise[] = [];
    for (let k = 0; k < 3; k++) {
      const r = substituirExercicio({
        exercicioAtual: atual, equipamento: perfil.equipamento, nivelExperiencia: perfil.nivelExperiencia,
        exercises: EXERCISES_SEED, historicoRecenteIds: [...usados],
      });
      if (r.status === 'ok' && r.exercicio && !out.some((e) => e.id === r.exercicio!.id)) {
        out.push(r.exercicio); usados.add(r.exercicio.id);
      } else break;
    }
    return out;
  }
  function abrirTrocaEx(d: number, s: number) {
    const opcoes = gerarOpcoesEx(d, s, []);
    setModal({ tipo: 'exercicio', d, s, opcoes, excl: opcoes.map((e) => e.id) });
  }
  function maisVariedadeEx() {
    if (modal?.tipo !== 'exercicio') return;
    const novas = gerarOpcoesEx(modal.d, modal.s, modal.excl);
    if (novas.length > 0) setModal({ ...modal, opcoes: novas, excl: [...modal.excl, ...novas.map((e) => e.id)] });
  }
  function aplicarEx(d: number, s: number, ex: Exercise) {
    const novos = rotinaDias.map((dia) => ({ ...dia, slots: dia.slots.slice() }));
    novos[d]!.slots[s] = { ...novos[d]!.slots[s]!, exercicio: ex };
    setRotinaDias(novos);
    marcar(`e${d}-${s}`);
    setModal(null);
  }

  function registrarPeso(v: number) {
    if (Number.isFinite(v) && v >= 30 && v <= 300) setPesos((p) => [...p, v]);
  }

  const prescricao = treino.prescricao;
  const tabs: { id: Aba; rotulo: string }[] = [
    { id: 'hoje', rotulo: 'Hoje' }, { id: 'treino', rotulo: 'Treino' }, { id: 'dieta', rotulo: 'Dieta' },
    { id: 'progresso', rotulo: 'Progresso' }, { id: 'perfil', rotulo: 'Perfil' },
  ];

  return (
    <div className="min-h-screen pb-16">
      {/* Header com tabs */}
      <header className="sticky top-0 z-40 border-b border-bone/10 bg-floresta/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2"><KAscendente size={28} /><Wordmark className="text-base" /></div>
          <button className="text-sm text-secundario hover:text-bone" onClick={onSair}>Sair</button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setAba(t.id)}
              className="shrink-0 rounded-full px-4 py-1.5 text-sm transition"
              style={aba === t.id ? { background: '#BDFF00', color: '#0D2818', fontWeight: 600 } : { color: 'rgba(234,229,219,.62)' }}>
              {t.rotulo}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6">
        {aba === 'hoje' && (
          <Hoje data={dataHoje} dieta={dieta} rotinaDias={rotinaDias} cardTotais={cardTotais}
            onIrTreino={() => setAba('treino')} onRegistrar={registrarPeso} pesoAtual={pesos[pesos.length - 1]!} />
        )}
        {aba === 'treino' && prescricao && (
          <TreinoTab dias={rotinaDias} prescricao={prescricao} trocados={trocados} feedback={feedback}
            onTrocar={abrirTrocaEx} onFeedback={(k, f) => setFeedback((prev) => ({ ...prev, [k]: f }))} avisos={treino.rotina?.avisos ?? []} />
        )}
        {aba === 'dieta' && (
          <DietaTab dieta={dieta} itens={cardItens} totais={cardTotais} trocados={trocados}
            onTrocar={abrirTrocaPrato} onPorcao={(idx) => setModal({ tipo: 'porcao', idx })} />
        )}
        {aba === 'progresso' && <Progresso pesos={pesos} treinos={Object.keys(feedback).length} onRegistrar={registrarPeso} />}
        {aba === 'perfil' && <Perfil perfil={perfil} onSair={onSair} />}
      </main>

      {modal && (
        <ModalTroca modal={modal} cardItens={cardItens}
          onFechar={() => setModal(null)}
          onAplicarPrato={aplicarPrato} onMaisPrato={maisVariedadePrato}
          onAplicarPorcao={aplicarPorcao} onAplicarEx={aplicarEx} onMaisEx={maisVariedadeEx} />
      )}
    </div>
  );
}

/* ════════════════════ Abas ════════════════════ */

function Hoje({ data, dieta, rotinaDias, cardTotais, onIrTreino, onRegistrar, pesoAtual }: {
  data: string; dieta: ResultadoMotor; rotinaDias: DiaTreino[]; cardTotais: RecipeMacros | null;
  onIrTreino: () => void; onRegistrar: (v: number) => void; pesoAtual: number;
}) {
  const plano = dieta.plano;
  const diaHoje = rotinaDias[0];
  const c = dieta.gate.comportamento;
  return (
    <div className="anim-screen flex flex-col gap-4">
      <div>
        <p className="text-sm capitalize text-secundario">{data || 'Seu dia'}</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Bom treino 👊</h1>
      </div>

      {(c === 'RESTRINGIR' || c === 'PISAR') && (
        <div className="pilula-ajuste p-4 text-sm">
          <p className="label-cap" style={{ color: '#BDFF00' }}>Ajuste honesto</p>
          <p className="mt-1">Ajustamos seu plano para manter você em segurança. Tudo continua editável.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {diaHoje && (
          <div className="surface p-5">
            <span className="label-cap">Treino de hoje</span>
            <p className="mt-1 text-lg font-bold">{diaHoje.nome}</p>
            <p className="text-sm text-secundario">{diaHoje.slots.length} exercícios</p>
            <button className="btn btn-neon mt-4 w-full" onClick={onIrTreino}>Começar treino</button>
          </div>
        )}
        {plano && (
          <div className="surface p-5">
            <span className="label-cap">Dieta de hoje · ponto de partida</span>
            <p className="mt-1 text-3xl font-extrabold text-pulso">{r0(cardTotais?.kcal ?? plano.kcalAlvo)}<span className="ml-1 text-base font-medium text-secundario">kcal</span></p>
            <p className="text-xs text-secundario">É um guia, não uma meta exata.</p>
            <div className="mt-3 flex flex-col gap-2">
              <Barra nome="Proteína" g={r0(plano.macros.proteinaG)} pct={70} />
              <Barra nome="Carboidrato" g={r0(plano.macros.carboidratoG)} pct={55} />
              <Barra nome="Gordura" g={r0(plano.macros.gorduraG)} pct={40} />
            </div>
          </div>
        )}
      </div>

      <RegistrarPeso pesoAtual={pesoAtual} onRegistrar={onRegistrar} />
    </div>
  );
}

function TreinoTab({ dias, prescricao, trocados, feedback, onTrocar, onFeedback, avisos }: {
  dias: DiaTreino[]; prescricao: NonNullable<ResultadoTreino['prescricao']>;
  trocados: Set<string>; feedback: Record<string, Feedback>;
  onTrocar: (d: number, s: number) => void; onFeedback: (k: string, f: Feedback) => void; avisos: string[];
}) {
  return (
    <div className="anim-screen flex flex-col gap-5">
      {avisos.map((a) => <div key={a} className="surface-soft p-3 text-sm text-secundario">{a}</div>)}
      {dias.map((dia, d) => (
        <div key={`${dia.nome}-${d}`} className="surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">{dia.nome}</h2>
            <span className="label-cap">RIR {prescricao.rir.min}–{prescricao.rir.max}</span>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {dia.slots.map((sl, s) => {
              const composto = sl.padrao !== 'isolado';
              const reps = composto ? prescricao.repsComposto : prescricao.repsIsolado;
              const desc = composto ? prescricao.descansoCompostoSeg : prescricao.descansoIsoladoSeg;
              const k = `${d}-${s}`;
              return (
                <li key={`${k}-${sl.exercicio.id}`} className="surface-soft p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="label-cap">{PADRAO_LABEL[sl.padrao] ?? sl.padrao}</span>
                        {trocados.has(`e${k}`) && <span className="rounded-full bg-pulso/15 px-2 py-0.5 text-[10px] font-bold text-pulso">TROCADO</span>}
                      </div>
                      <p className="text-sm font-semibold">{sl.exercicio.nomePt}</p>
                      <p className="text-xs text-secundario">
                        {prescricao.seriesPorExercicio.min}–{prescricao.seriesPorExercicio.max} séries × {reps.min}–{reps.max} reps · descanso {desc.min}–{desc.max}s
                      </p>
                    </div>
                    <button className="btn btn-ghost shrink-0" style={{ padding: '.4rem .8rem', fontSize: '.78rem' }} onClick={() => onTrocar(d, s)}>Trocar</button>
                  </div>
                  <details className="mt-2 text-xs text-secundario">
                    <summary className="cursor-pointer select-none">Como fazer</summary>
                    <p className="mt-1">{sl.exercicio.comoFazer}</p>
                  </details>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-secundario">Como foi?</span>
                    {(['facil', 'na_medida', 'dificil'] as Feedback[]).map((f) => (
                      <button key={f} onClick={() => onFeedback(k, f)} aria-pressed={feedback[k] === f}
                        className="chip" style={{ padding: '.25rem .6rem', fontSize: '.72rem' }}>
                        {f === 'facil' ? 'Fácil' : f === 'na_medida' ? 'Na medida' : 'Difícil'}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="text-xs text-secundario">Iniciante não treina até a falha. A carga sobe por dupla progressão guiada pelo seu feedback — por isso o “Como foi?”.</p>
    </div>
  );
}

function DietaTab({ dieta, itens, totais, trocados, onTrocar, onPorcao }: {
  dieta: ResultadoMotor; itens: CardapioItem[]; totais: RecipeMacros | null; trocados: Set<string>;
  onTrocar: (idx: number) => void; onPorcao: (idx: number) => void;
}) {
  const plano = dieta.plano;
  if (!plano) return null;
  return (
    <div className="anim-screen flex flex-col gap-4">
      <div className="surface p-5">
        <span className="label-cap">Seu ponto de partida</span>
        <p className="text-4xl font-extrabold text-pulso">{r0(totais?.kcal ?? plano.kcalAlvo)}<span className="ml-1 text-base font-medium text-secundario">kcal/dia</span></p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <Macro nome="Proteína" g={r0(plano.macros.proteinaG)} />
          <Macro nome="Carboidrato" g={r0(plano.macros.carboidratoG)} />
          <Macro nome="Gordura" g={r0(plano.macros.gorduraG)} />
        </div>
      </div>
      {itens.length > 0 ? (
        <div className="flex flex-col gap-2">
          {itens.map((it, idx) => (
            <div key={`${it.refeicao}-${it.prato.id}`} className="surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="label-cap">{REFEICAO_LABEL[it.refeicao]}</span>
                    {trocados.has(`p${idx}`) && <span className="rounded-full bg-pulso/15 px-2 py-0.5 text-[10px] font-bold text-pulso">EDITADO</span>}
                  </div>
                  <p className="text-sm font-semibold">{it.prato.nome}</p>
                  <p className="text-xs text-secundario">{r0(it.macros.kcal)} kcal · {r0(it.macros.proteinaG)} g prot · porção {it.escala.toFixed(2)}×</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button className="btn btn-ghost" style={{ padding: '.4rem .8rem', fontSize: '.78rem' }} onClick={() => onTrocar(idx)}>Trocar</button>
                  <button className="btn btn-ghost" style={{ padding: '.4rem .8rem', fontSize: '.78rem' }} onClick={() => onPorcao(idx)}>Porção</button>
                </div>
              </div>
            </div>
          ))}
          {totais && <p className="flex justify-between px-1 text-sm text-secundario"><span>Total do dia</span><span>{r0(totais.kcal)} kcal · {r0(totais.proteinaG)} g prot</span></p>}
        </div>
      ) : <p className="text-sm text-secundario">{dieta.cardapio?.nota ?? 'Sem cardápio para as restrições atuais.'}</p>}
    </div>
  );
}

function Progresso({ pesos, treinos, onRegistrar }: { pesos: number[]; treinos: number; onRegistrar: (v: number) => void }) {
  const atual = pesos[pesos.length - 1]!;
  const variacao = atual - pesos[0]!;
  return (
    <div className="anim-screen flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat rotulo="Peso atual" valor={`${atual.toFixed(1)} kg`} />
        <Stat rotulo="Variação" valor={`${variacao >= 0 ? '+' : ''}${variacao.toFixed(1)} kg`} />
        <Stat rotulo="Treinos" valor={`${treinos}`} />
      </div>
      <div className="surface p-5">
        <span className="label-cap">Seu peso</span>
        <GraficoPeso pesos={pesos} />
        {pesos.length < 2 && <p className="mt-2 text-xs text-secundario">Registre mais pesos para ver a linha evoluir.</p>}
      </div>
      <RegistrarPeso pesoAtual={atual} onRegistrar={onRegistrar} />
      <div className="surface-soft p-5 text-sm text-secundario">
        <p className="label-cap" style={{ color: '#BDFF00' }}>Como seu plano evolui</p>
        <p className="mt-2">A cada avanço seu, o Evokorpus recalcula treino e dieta por regras adaptativas — sem caixa-preta. Você registra, ele ajusta o próximo passo.</p>
      </div>
    </div>
  );
}

function Perfil({ perfil, onSair }: { perfil: PerfilResumo; onSair: () => void }) {
  const linhas: [string, string][] = [
    ['Sexo biológico', perfil.sexo === 'feminino' ? 'Feminino' : 'Masculino'],
    ['Idade', `${perfil.idade} anos`],
    ['Altura', `${perfil.alturaCm} cm`],
    ['Peso', `${perfil.pesoKg} kg`],
    ['Objetivo', OBJETIVO_LABEL[perfil.objetivo]],
    ['Atividade', ATIV_LABEL[perfil.nivelAtividade]],
    ['Experiência', perfil.nivelExperiencia.charAt(0).toUpperCase() + perfil.nivelExperiencia.slice(1)],
    ['Equipamento', EQUIP_LABEL[perfil.equipamento]],
    ['Treino', `${perfil.diasDisponiveis}×/semana · ${perfil.tempoPorSessaoMin} min`],
    ['Alimentação', perfil.preferencia ? perfil.preferencia : 'Onívoro'],
    ['Alergias', perfil.alergenos.length ? perfil.alergenos.join(', ') : 'nenhuma'],
  ];
  return (
    <div className="anim-screen flex flex-col gap-4">
      <div className="surface p-5">
        <span className="label-cap">Seus dados</span>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          {linhas.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-bone/5 pb-2">
              <dt className="text-secundario">{k}</dt><dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <button className="btn btn-ghost mt-4 w-full" onClick={onSair}>Refazer questionário</button>
      </div>

      <div className="surface p-5">
        <span className="label-cap">Assinatura</span>
        <p className="mt-1 flex items-end gap-1"><span className="text-3xl font-extrabold text-pulso">R$ 29</span><span className="mb-1 text-secundario">/mês</span></p>
        <p className="text-xs text-secundario">Próximo vencimento: — (demo, sem cobrança ativa)</p>
        <div className="mt-3 flex gap-2">
          <button className="btn btn-ghost flex-1" disabled>Gerenciar</button>
          <button className="btn btn-ghost flex-1" disabled>Cancelar</button>
        </div>
        <p className="mt-2 text-xs text-secundario">Cancelar é fácil, sem letra miúda. Avisamos antes de qualquer renovação.</p>
      </div>

      <div className="surface-soft p-5 text-xs leading-relaxed text-secundario">
        <div className="mb-2 flex gap-3">
          <a href="#" className="hover:text-bone">Política de privacidade</a>
          <a href="#" className="hover:text-bone">Termos de uso</a>
        </div>
        O Evokorpus é uma ferramenta de uso geral e caráter educacional, dirigida pelo usuário. Não constitui
        prescrição, consulta ou acompanhamento nutricional ou de educação física, nem substitui a orientação
        de profissionais habilitados. Conteúdo para maiores de 18 anos.
      </div>
    </div>
  );
}

/* ════════════════════ Modal ════════════════════ */

function ModalTroca({ modal, cardItens, onFechar, onAplicarPrato, onMaisPrato, onAplicarPorcao, onAplicarEx, onMaisEx }: {
  modal: NonNullable<Modal>; cardItens: CardapioItem[];
  onFechar: () => void;
  onAplicarPrato: (idx: number, o: OpcaoPrato) => void; onMaisPrato: () => void;
  onAplicarPorcao: (idx: number, f: number) => void;
  onAplicarEx: (d: number, s: number, ex: Exercise) => void; onMaisEx: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onFechar}
      style={{ background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }}>
      <div className="surface anim-step w-full max-w-md p-5" style={{ borderRadius: 22 }} onClick={(e) => e.stopPropagation()}>
        {modal.tipo === 'prato' && (
          <>
            <Cabecalho titulo="Trocar prato" sub="Equilíbrio do dia preservado (equivalência calórica)." onFechar={onFechar} />
            <div className="mt-3 flex flex-col gap-2">
              {modal.opcoes.length === 0 && <p className="text-sm text-secundario">Sem alternativas que mantenham o dia equilibrado.</p>}
              {modal.opcoes.map((o) => (
                <button key={o.prato.id} className="surface-soft p-3 text-left transition hover:border-pulso/40" onClick={() => onAplicarPrato(modal.idx, o)}>
                  <p className="text-sm font-semibold">{o.prato.nome}</p>
                  <p className="text-xs text-secundario">{r0(o.macros.kcal)} kcal · {r0(o.macros.proteinaG)} g prot</p>
                </button>
              ))}
            </div>
            <button className="btn btn-ghost mt-3 w-full" onClick={onMaisPrato}>Gerar mais variedade</button>
          </>
        )}

        {modal.tipo === 'porcao' && (
          <>
            <Cabecalho titulo="Editar porção" sub={cardItens[modal.idx]?.prato.nome} onFechar={onFechar} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PORCOES.map((p) => (
                <button key={p.f} className="opt" onClick={() => onAplicarPorcao(modal.idx, p.f)}>{p.r}</button>
              ))}
            </div>
            <p className="mt-3 text-xs text-secundario">1 = porção atual. As kcal do dia se ajustam.</p>
          </>
        )}

        {modal.tipo === 'exercicio' && (
          <>
            <Cabecalho titulo="Trocar exercício" sub="Mesmo grupo/padrão, respeitando seu equipamento." onFechar={onFechar} />
            <div className="mt-3 flex flex-col gap-2">
              {modal.opcoes.length === 0 && <p className="text-sm text-secundario">Sem substituto elegível para o equipamento/nível.</p>}
              {modal.opcoes.map((ex) => (
                <button key={ex.id} className="surface-soft p-3 text-left transition hover:border-pulso/40" onClick={() => onAplicarEx(modal.d, modal.s, ex)}>
                  <p className="text-sm font-semibold">{ex.nomePt}</p>
                  <p className="text-xs text-secundario">{ex.grupoMuscular}{ex.equipamentoDetalhe ? ` · ${ex.equipamentoDetalhe}` : ''}</p>
                </button>
              ))}
            </div>
            <button className="btn btn-ghost mt-3 w-full" onClick={onMaisEx}>Gerar mais variedade</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════ Primitivos ════════════════════ */

function Cabecalho({ titulo, sub, onFechar }: { titulo: string; sub?: string; onFechar: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="text-lg font-bold">{titulo}</h3>{sub && <p className="text-xs text-secundario">{sub}</p>}</div>
      <button className="text-secundario hover:text-bone" onClick={onFechar} aria-label="Fechar">✕</button>
    </div>
  );
}

function RegistrarPeso({ pesoAtual, onRegistrar }: { pesoAtual: number; onRegistrar: (v: number) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="surface-soft flex items-center gap-3 p-4">
      <div className="flex-1">
        <span className="label-cap">Registrar peso</span>
        <p className="text-xs text-secundario">Atual: {pesoAtual.toFixed(1)} kg</p>
      </div>
      <input className="campo" style={{ width: 90 }} type="number" inputMode="decimal" placeholder="kg" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn btn-neon" style={{ padding: '.6rem 1rem' }} onClick={() => { onRegistrar(Number(v)); setV(''); }}>Salvar</button>
    </div>
  );
}

function GraficoPeso({ pesos }: { pesos: number[] }) {
  const W = 320, H = 90, pad = 6;
  const min = Math.min(...pesos), max = Math.max(...pesos);
  const span = max - min || 1;
  const pts = pesos.map((p, i) => {
    const x = pesos.length === 1 ? W / 2 : pad + (i / (pesos.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((p - min) / span) * (H - 2 * pad);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" style={{ height: 90 }}>
      {pesos.length > 1 && <path d={d} fill="none" stroke="#BDFF00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#BDFF00" />)}
    </svg>
  );
}

function Barra({ nome, g, pct }: { nome: string; g: number; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-secundario"><span>{nome}</span><span>{g} g</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bone/10"><div className="h-full rounded-full bg-folha" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Macro({ nome, g }: { nome: string; g: number }) {
  return <div className="surface-soft p-3"><p className="text-lg font-bold">{g} g</p><p className="text-xs text-secundario">{nome}</p></div>;
}

function Stat({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="surface p-4 text-center"><p className="text-xl font-extrabold text-bone">{valor}</p><p className="text-xs text-secundario">{rotulo}</p></div>;
}
