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
  | { tipo: 'prato'; idx: number; base: string; opcoes: OpcaoPrato[]; excl: string[] }
  | { tipo: 'porcao'; idx: number; base: string }
  | { tipo: 'exercicio'; d: number; s: number; base: string; opcoes: Exercise[]; excl: string[] }
  | null;

interface OpcaoPrato { prato: CardapioItem['prato']; escala: number; macros: RecipeMacros; diaNew: RecipeMacros }

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
    setModal({ tipo: 'prato', idx, base: cardItens[idx]!.prato.nome, opcoes, excl: opcoes.map((o) => o.prato.id) });
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
    setModal({ tipo: 'exercicio', d, s, base: rotinaDias[d]!.slots[s]!.exercicio.nomePt, opcoes, excl: opcoes.map((e) => e.id) });
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
            mostrarC={desfechoC ?? (dieta.gate.comportamento === 'RESTRINGIR' || dieta.gate.comportamento === 'PISAR')}
            onIrTreino={() => setAba('treino')} onRegistrar={registrarPeso} pesoAtual={pesos[pesos.length - 1]!} />
        )}
        {aba === 'treino' && prescricao && (
          <TreinoTab dias={rotinaDias} prescricao={prescricao} trocados={trocados} feedback={feedback}
            onTrocar={abrirTrocaEx} onFeedback={(k, f) => setFeedback((prev) => ({ ...prev, [k]: f }))} avisos={treino.rotina?.avisos ?? []} />
        )}
        {aba === 'dieta' && (
          <DietaTab dieta={dieta} itens={cardItens} totais={cardTotais} trocados={trocados}
            onTrocar={abrirTrocaPrato} onPorcao={(idx) => setModal({ tipo: 'porcao', idx, base: cardItens[idx]!.prato.nome })} />
        )}
        {aba === 'progresso' && <Progresso pesos={pesos} treinos={Object.keys(feedback).length} onRegistrar={registrarPeso} />}
        {aba === 'perfil' && <Perfil perfil={perfil} onSair={onSair} />}
      </main>

      {modal && (
        <ModalTroca modal={modal}
          onFechar={() => setModal(null)}
          onAplicarPrato={aplicarPrato} onMaisPrato={maisVariedadePrato}
          onAplicarPorcao={aplicarPorcao} onAplicarEx={aplicarEx} onMaisEx={maisVariedadeEx} />
      )}
    </div>
  );
}

/* ════════════════════ Abas ════════════════════ */

function Hoje({ data, dieta, rotinaDias, cardTotais, mostrarC, onIrTreino, onRegistrar, pesoAtual }: {
  data: string; dieta: ResultadoMotor; rotinaDias: DiaTreino[]; cardTotais: RecipeMacros | null; mostrarC: boolean;
  onIrTreino: () => void; onRegistrar: (v: number) => void; pesoAtual: number;
}) {
  const plano = dieta.plano;
  const diaHoje = rotinaDias[0];
  return (
    <div className="anim-screen flex flex-col gap-4">
      <div>
        <p className="text-sm capitalize text-secundario">{data || 'Seu dia'}</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Bom treino 👊</h1>
      </div>

      {mostrarC && (
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

function ModalTroca({ modal, onFechar, onAplicarPrato, onMaisPrato, onAplicarPorcao, onAplicarEx, onMaisEx }: {
  modal: NonNullable<Modal>;
  onFechar: () => void;
  onAplicarPrato: (idx: number, o: OpcaoPrato) => void; onMaisPrato: () => void;
  onAplicarPorcao: (idx: number, f: number) => void;
  onAplicarEx: (d: number, s: number, ex: Exercise) => void; onMaisEx: () => void;
}) {
  // Lista unificada de opções (fiel ao protótipo: linhas com seta; 3 opções + "gerar mais").
  let titulo = 'Trocar';
  let sub = '';
  let showMore = false;
  let onMore = () => {};
  const opcoes: { chave: string; nome: string; detalhe?: string; onClick: () => void }[] = [];
  if (modal.tipo === 'prato') {
    sub = 'Três opções que mantêm o equilíbrio do dia (equivalência calórica). Não curtiu? Gere mais.';
    showMore = true; onMore = onMaisPrato;
    modal.opcoes.forEach((o) => opcoes.push({ chave: o.prato.id, nome: o.prato.nome, detalhe: `${r0(o.macros.kcal)} kcal · ${r0(o.macros.proteinaG)} g prot`, onClick: () => onAplicarPrato(modal.idx, o) }));
  } else if (modal.tipo === 'exercicio') {
    sub = 'Mantém o grupo e o padrão, respeitando seu equipamento. Não curtiu? Gere mais.';
    showMore = true; onMore = onMaisEx;
    modal.opcoes.forEach((ex) => opcoes.push({ chave: ex.id, nome: ex.nomePt, detalhe: `${ex.grupoMuscular}${ex.equipamentoDetalhe ? ` · ${ex.equipamentoDetalhe}` : ''}`, onClick: () => onAplicarEx(modal.d, modal.s, ex) }));
  } else {
    titulo = 'Editar porção';
    sub = 'Ajuste a quantidade do prato — a estimativa de referência acompanha.';
    PORCOES.forEach((p) => opcoes.push({ chave: String(p.f), nome: `${p.r} porção${p.f === 1 ? ' (padrão)' : ''}`, onClick: () => onAplicarPorcao(modal.idx, p.f) }));
  }

  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: '1px solid rgba(234,229,219,.14)', borderRadius: 22, padding: 24, boxShadow: '0 40px 90px -30px rgba(0,0,0,.8)', animation: 'evkPop .3s cubic-bezier(.22,.61,.36,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00' }}>{titulo}</div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', padding: 0, marginTop: -2 }}>×</button>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-.01em', marginBottom: 6 }}>{modal.base}</div>
        <p style={{ margin: '0 0 18px', fontSize: '.86rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>{sub}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: showMore ? 14 : 0 }}>
          {opcoes.length === 0 && <p style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.6)' }}>Sem alternativa elegível agora. Tente ajustar suas preferências.</p>}
          {opcoes.map((o) => (
            <button key={o.chave} onClick={o.onClick} className="modal-opt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 14, padding: '15px 17px', color: '#EAE5DB', cursor: 'pointer' }}>
              <span>
                <span style={{ display: 'block', fontSize: '1rem', fontWeight: 600 }}>{o.nome}</span>
                {o.detalhe && <span style={{ display: 'block', fontSize: '.78rem', color: 'rgba(234,229,219,.55)', marginTop: 2 }}>{o.detalhe}</span>}
              </span>
              <span style={{ width: 26, height: 26, minWidth: 26, borderRadius: '50%', border: '1px solid rgba(234,229,219,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BDFF00' }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
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
