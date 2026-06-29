'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KAscendente, Wordmark } from '@/lib/brand/Logo';
import {
  gerarDieta,
  gerarTreino,
  substituirPrato,
  substituirExercicio,
  type ResultadoMotor,
  type ResultadoTreino,
} from '@/lib/engine';
import type {
  NivelAtividade,
  NivelExperiencia,
  Objetivo,
  PerfilTreino,
  PerfilUsuario,
  Sexo,
} from '@/lib/engine';
import type { Alergeno, EquipamentoDisp, RecipeMacros } from '@/lib/data/types';
import type { CardapioItem, DiaTreino } from '@/lib/engine';
import { EXERCISES_SEED, FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import { consentimentoSchema, perfilSchema } from '@/lib/validation/profile';

/* ─── tabelas de exibição ──────────────────────────────────────────────── */

const ALERGENOS: { id: Alergeno; rotulo: string }[] = [
  { id: 'lactose', rotulo: 'Lactose' },
  { id: 'gluten', rotulo: 'Glúten' },
  { id: 'ovo', rotulo: 'Ovo' },
  { id: 'soja', rotulo: 'Soja' },
  { id: 'amendoim', rotulo: 'Amendoim' },
  { id: 'castanhas', rotulo: 'Castanhas' },
  { id: 'gergelim', rotulo: 'Gergelim' },
  { id: 'coco', rotulo: 'Coco' },
  { id: 'peixe_frutos_do_mar', rotulo: 'Peixe / frutos do mar' },
];

const ATIVIDADES: { id: NivelAtividade; rotulo: string; sub: string }[] = [
  { id: 'sedentario', rotulo: 'Sedentário', sub: 'pouco ou nenhum exercício' },
  { id: 'leve', rotulo: 'Leve', sub: '1–2 dias/semana' },
  { id: 'moderado', rotulo: 'Moderado', sub: '3–4 dias/semana' },
  { id: 'intenso', rotulo: 'Intenso', sub: '5–6 dias/semana' },
  { id: 'muito_intenso', rotulo: 'Muito intenso', sub: 'treino diário / trabalho físico' },
];

const REFEICAO_LABEL: Record<string, string> = { cafe: 'Café', almoco: 'Almoço', jantar: 'Jantar', lanche: 'Lanche' };

const r0 = (n: number) => Math.round(n);
const TOTAL_PASSOS = 8;

interface Contexto {
  restricoes: { alergenos: Alergeno[]; preferencia: 'vegano' | 'vegetariano' | null };
  equipamento: EquipamentoDisp;
  nivelExperiencia: NivelExperiencia;
}

type Fase = 'wizard' | 'gerando' | 'resultado';

export default function Onboarding() {
  // Consentimentos (passo 1)
  const [aceite18, setA18] = useState(false);
  const [aceiteTermos, setATermos] = useState(false);
  const [aceiteLgpd, setALgpd] = useState(false);

  // Perfil
  const [sexo, setSexo] = useState<Sexo>('feminino');
  const [idade, setIdade] = useState('30');
  const [alturaCm, setAltura] = useState('170');
  const [pesoKg, setPeso] = useState('70');

  // Triagem (PAR-Q)
  const [gestacaoAmamentacao, setGest] = useState(false);
  const [renal, setRenal] = useState(false);
  const [cardiaca, setCardiaca] = useState(false);
  const [lesao, setLesao] = useState(false);
  const [diabetes, setDiabetes] = useState(false);

  // Objetivo / atividade / treino
  const [objetivo, setObjetivo] = useState<Objetivo>('emagrecimento');
  const [nivelAtividade, setNivel] = useState<NivelAtividade>('moderado');
  const [nivelExperiencia, setNivelExp] = useState<NivelExperiencia>('iniciante');
  const [equipamento, setEquipamento] = useState<EquipamentoDisp>('casa');
  const [diasDisponiveis, setDias] = useState(3);
  const [tempoPorSessaoMin, setTempo] = useState(45);

  // Preferência alimentar
  const [preferencia, setPreferencia] = useState<'' | 'vegano' | 'vegetariano'>('');
  const [alergenos, setAlergenos] = useState<Alergeno[]>([]);
  const [naoGosto, setNaoGosto] = useState('');

  // Fluxo
  const [passo, setPasso] = useState(0);
  const [fase, setFase] = useState<Fase>('wizard');
  const [erros, setErros] = useState<string[]>([]);

  // Resultado
  const [dieta, setDieta] = useState<ResultadoMotor | null>(null);
  const [treino, setTreino] = useState<ResultadoTreino | null>(null);
  const [ctx, setCtx] = useState<Contexto | null>(null);
  const [aba, setAba] = useState<'dieta' | 'treino'>('dieta');
  const [cardItens, setCardItens] = useState<CardapioItem[]>([]);
  const [cardTotais, setCardTotais] = useState<RecipeMacros | null>(null);
  const [rotinaDias, setRotinaDias] = useState<DiaTreino[]>([]);
  const [msgPrato, setMsgPrato] = useState<{ idx: number; texto: string } | null>(null);
  const [msgEx, setMsgEx] = useState<{ chave: string; texto: string } | null>(null);

  function toggleAlergeno(a: Alergeno) {
    setAlergenos((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  /* ─── validação por passo ───────────────────────────────────────────── */
  function passoValido(p: number): boolean {
    switch (p) {
      case 0:
        return aceite18 && aceiteTermos && aceiteLgpd;
      case 1: {
        const i = Number(idade), a = Number(alturaCm), pe = Number(pesoKg);
        return Number.isFinite(i) && i >= 18 && i <= 100 && Number.isFinite(a) && a >= 100 && a <= 250 && Number.isFinite(pe) && pe >= 30 && pe <= 300;
      }
      default:
        return true; // demais passos têm default selecionado
    }
  }

  function avancar() {
    setErros([]);
    if (!passoValido(passo)) return;
    if (passo < TOTAL_PASSOS - 1) {
      setPasso((p) => p + 1);
    } else {
      gerar();
    }
  }
  function voltar() {
    setErros([]);
    setPasso((p) => Math.max(0, p - 1));
  }

  /* ─── geração (gate → dieta + treino) ───────────────────────────────── */
  function gerar() {
    const consent = consentimentoSchema.safeParse({ aceite18, aceiteTermos, aceiteLgpd });
    const perfilParse = perfilSchema.safeParse({
      sexo, pesoKg, alturaCm, idade, nivelAtividade, objetivo,
      flagsSaude: { gestacaoAmamentacao, renal, cardiaca, lesao, diabetes },
      preferenciaAlimentar: preferencia || null,
      alergenos,
    });
    if (!consent.success || !perfilParse.success) {
      const msgs = [
        ...(consent.success ? [] : consent.error.issues.map((i) => i.message)),
        ...(perfilParse.success ? [] : perfilParse.error.issues.map((i) => i.message)),
      ];
      setErros(Array.from(new Set(msgs)));
      return;
    }

    const p = perfilParse.data;
    const restricoes = { alergenos: p.alergenos as Alergeno[], preferencia: p.preferenciaAlimentar ?? null };
    const perfil: PerfilUsuario = {
      sexo: p.sexo, pesoKg: p.pesoKg, alturaCm: p.alturaCm, idade: p.idade,
      nivelAtividade: p.nivelAtividade, objetivo: p.objetivo, flagsSaude: p.flagsSaude,
    };
    const perfilTreino: PerfilTreino = {
      pesoKg: p.pesoKg, alturaCm: p.alturaCm, idade: p.idade, flagsSaude: p.flagsSaude,
      objetivo: p.objetivo, nivelExperiencia, equipamento, diasDisponiveis, tempoPorSessaoMin,
    };

    const resDieta = gerarDieta(perfil, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes });
    const resTreino = gerarTreino(perfilTreino, { exercises: EXERCISES_SEED });

    setDieta(resDieta);
    setTreino(resTreino);
    setCtx({ restricoes, equipamento, nivelExperiencia });
    if (resDieta.cardapio && resDieta.cardapio.status !== 'sem_candidatos') {
      setCardItens(resDieta.cardapio.itens);
      setCardTotais(resDieta.cardapio.totais);
    } else {
      setCardItens([]); setCardTotais(null);
    }
    setRotinaDias(resTreino.rotina ? resTreino.rotina.dias : []);
    setAba('dieta');
    setMsgPrato(null); setMsgEx(null);

    // Tela "gerando o plano" (UX; o motor é instantâneo e puro).
    setFase('gerando');
    setTimeout(() => setFase('resultado'), 1300);
  }

  function recomecar() {
    setFase('wizard');
    setPasso(0);
    setDieta(null);
    setTreino(null);
  }

  /* ─── substituições (F.2) ───────────────────────────────────────────── */
  function trocarPrato(idx: number) {
    if (!dieta?.plano || !ctx || !cardTotais) return;
    const item = cardItens[idx]!;
    const outrosIds = cardItens.filter((_, i) => i !== idx).map((c) => c.prato.id);
    const res = substituirPrato({
      pratoAtual: item.prato, slot: item.refeicao, recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED,
      plano: dieta.plano, totaisDiaAtual: cardTotais, escalaAtual: item.escala,
      restricoes: ctx.restricoes, gosto: { excluirPratoIds: outrosIds },
    });
    if (res.status === 'ok' && res.prato && res.totaisDiaNovo && res.escala != null && res.macrosNovo) {
      const novos = cardItens.slice();
      novos[idx] = { refeicao: item.refeicao, prato: res.prato, escala: res.escala, macros: res.macrosNovo };
      setCardItens(novos);
      setCardTotais(res.totaisDiaNovo);
      setMsgPrato({ idx, texto: res.gostoRelaxado ? 'Trocado (preferência relaxada).' : 'Trocado.' });
    } else {
      setMsgPrato({ idx, texto: res.nota ?? 'Sem troca disponível.' });
    }
  }

  function trocarExercicio(d: number, s: number) {
    if (!ctx) return;
    const atual = rotinaDias[d]!.slots[s]!.exercicio;
    const usados = rotinaDias.flatMap((dia) => dia.slots.map((sl) => sl.exercicio.id));
    const res = substituirExercicio({
      exercicioAtual: atual, equipamento: ctx.equipamento, nivelExperiencia: ctx.nivelExperiencia,
      exercises: EXERCISES_SEED, historicoRecenteIds: usados,
    });
    const chave = `${d}-${s}`;
    if (res.status === 'ok' && res.exercicio) {
      const novos = rotinaDias.map((dia) => ({ ...dia, slots: dia.slots.slice() }));
      novos[d]!.slots[s] = { ...novos[d]!.slots[s]!, exercicio: res.exercicio };
      setRotinaDias(novos);
      setMsgEx({ chave, texto: res.gostoRelaxado ? 'Trocado (variedade relaxada).' : 'Trocado.' });
    } else {
      setMsgEx({ chave, texto: res.nota ?? 'Sem substituto elegível.' });
    }
  }

  /* ─── render ────────────────────────────────────────────────────────── */
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <KAscendente size={32} />
          <Wordmark className="text-lg" />
        </Link>
        {fase === 'wizard' && <span className="label-cap">Passo {passo + 1} de {TOTAL_PASSOS}</span>}
      </header>

      {fase === 'wizard' && (
        <>
          <div className="progress">
            <span style={{ width: `${((passo + 1) / TOTAL_PASSOS) * 100}%` }} />
          </div>

          <div key={passo} className="anim-step flex flex-col gap-5">
            {passo === 0 && <PassoTermos {...{ aceite18, setA18, aceiteTermos, setATermos, aceiteLgpd, setALgpd }} />}
            {passo === 1 && <PassoSobre {...{ sexo, setSexo, idade, setIdade, alturaCm, setAltura, pesoKg, setPeso }} />}
            {passo === 2 && <PassoTriagem {...{ sexo, gestacaoAmamentacao, setGest, renal, setRenal, cardiaca, setCardiaca, lesao, setLesao, diabetes, setDiabetes }} />}
            {passo === 3 && <PassoObjetivo {...{ objetivo, setObjetivo }} />}
            {passo === 4 && <PassoAtividade {...{ nivelAtividade, setNivel }} />}
            {passo === 5 && <PassoExperiencia {...{ nivelExperiencia, setNivelExp }} />}
            {passo === 6 && <PassoOndeQuando {...{ equipamento, setEquipamento, diasDisponiveis, setDias, tempoPorSessaoMin, setTempo }} />}
            {passo === 7 && <PassoPreferencia {...{ preferencia, setPreferencia, alergenos, toggleAlergeno, naoGosto, setNaoGosto }} />}
          </div>

          {erros.length > 0 && (
            <div className="pilula-alerta rounded-xl p-3 text-sm">
              <ul className="list-disc pl-4">{erros.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-3">
            <button className="btn btn-ghost" onClick={voltar} disabled={passo === 0}>← Voltar</button>
            <button className="btn btn-neon flex-1" onClick={avancar} disabled={!passoValido(passo)}>
              {passo === TOTAL_PASSOS - 1 ? 'Gerar meu plano' : 'Continuar'}
            </button>
          </div>
        </>
      )}

      {fase === 'gerando' && <TelaGerando />}

      {fase === 'resultado' && dieta && (
        dieta.gate.comportamento === 'ROTEAR'
          ? <Encaminhamento motivos={dieta.gate.motivos} onRevisar={recomecar} />
          : (
            <section className="anim-screen flex flex-col gap-4">
              <BannerAjuste dieta={dieta} />
              <div className="seg">
                <button className="opt" aria-pressed={aba === 'dieta'} onClick={() => setAba('dieta')}>Dieta</button>
                <button className="opt" aria-pressed={aba === 'treino'} onClick={() => setAba('treino')}>Treino</button>
              </div>
              {aba === 'dieta' && <DietaView dieta={dieta} itens={cardItens} totais={cardTotais} msg={msgPrato} onTrocar={trocarPrato} />}
              {aba === 'treino' && treino && <TreinoView treino={treino} dias={rotinaDias} msg={msgEx} onTrocar={trocarExercicio} />}
              <button className="btn btn-ghost" onClick={recomecar}>Refazer questionário</button>
            </section>
          )
      )}

      <p className="mt-2 text-center text-xs text-secundario">
        Demonstração local: plano e trocas são calculados no seu dispositivo (motor determinístico,
        sem IA). Estimativa de referência, não prescrição. Ferramenta educacional, 18+.
      </p>
    </main>
  );
}

/* ════════════════════ Passos do wizard ════════════════════ */

function StepHead({ titulo, sub }: { titulo: string; sub?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
      {sub && <p className="mt-1 text-sm text-secundario">{sub}</p>}
    </div>
  );
}

function PassoTermos(p: {
  aceite18: boolean; setA18: (v: boolean) => void;
  aceiteTermos: boolean; setATermos: (v: boolean) => void;
  aceiteLgpd: boolean; setALgpd: (v: boolean) => void;
}) {
  return (
    <>
      <StepHead titulo="Antes de começar" sub="O Evokorpus é uma ferramenta educacional dirigida por você — não substitui um profissional." />
      <div className="surface flex flex-col gap-1 p-2">
        <Check checked={p.aceite18} onChange={p.setA18} label="Confirmo que tenho 18 anos ou mais." />
        <Check checked={p.aceiteTermos} onChange={p.setATermos} label="Li e aceito o termo de conscientização e o disclaimer." />
        <Check checked={p.aceiteLgpd} onChange={p.setALgpd} label="Consinto com o tratamento dos meus dados (LGPD) para gerar meu plano." />
      </div>
    </>
  );
}

function PassoSobre(p: {
  sexo: Sexo; setSexo: (v: Sexo) => void;
  idade: string; setIdade: (v: string) => void;
  alturaCm: string; setAltura: (v: string) => void;
  pesoKg: string; setPeso: (v: string) => void;
}) {
  return (
    <>
      <StepHead titulo="Sobre você" sub="Usamos isso só para calcular seu ponto de partida." />
      <div>
        <span className="label-cap">Sexo biológico</span>
        <div className="seg mt-2">
          <button className="opt" aria-pressed={p.sexo === 'feminino'} onClick={() => p.setSexo('feminino')}>Feminino</button>
          <button className="opt" aria-pressed={p.sexo === 'masculino'} onClick={() => p.setSexo('masculino')}>Masculino</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <NumField label="Idade" value={p.idade} onChange={p.setIdade} suf="anos" />
        <NumField label="Altura" value={p.alturaCm} onChange={p.setAltura} suf="cm" />
        <NumField label="Peso" value={p.pesoKg} onChange={p.setPeso} suf="kg" />
      </div>
    </>
  );
}

function PassoTriagem(p: {
  sexo: Sexo;
  gestacaoAmamentacao: boolean; setGest: (v: boolean) => void;
  renal: boolean; setRenal: (v: boolean) => void;
  cardiaca: boolean; setCardiaca: (v: boolean) => void;
  lesao: boolean; setLesao: (v: boolean) => void;
  diabetes: boolean; setDiabetes: (v: boolean) => void;
}) {
  return (
    <>
      <StepHead titulo="Triagem de saúde" sub="Autodeclaração mínima (sim/não). Não é ficha médica. Em algumas condições o app orienta procurar um profissional em vez de gerar um plano." />
      <div className="flex flex-col gap-2">
        {p.sexo === 'feminino' && <SimNao label="Estou gestante ou amamentando" value={p.gestacaoAmamentacao} onChange={p.setGest} />}
        <SimNao label="Tenho condição renal" value={p.renal} onChange={p.setRenal} />
        <SimNao label="Tenho condição cardíaca" value={p.cardiaca} onChange={p.setCardiaca} />
        <SimNao label="Tenho lesão ou limitação física" value={p.lesao} onChange={p.setLesao} />
        <SimNao label="Tenho diabetes" value={p.diabetes} onChange={p.setDiabetes} />
      </div>
    </>
  );
}

function PassoObjetivo(p: { objetivo: Objetivo; setObjetivo: (v: Objetivo) => void }) {
  const opts: { id: Objetivo; rotulo: string; sub: string }[] = [
    { id: 'emagrecimento', rotulo: 'Emagrecer', sub: 'reduzir gordura com constância' },
    { id: 'massa', rotulo: 'Ganhar massa', sub: 'construir músculo' },
    { id: 'saude', rotulo: 'Manter / Saúde', sub: 'manutenção e bem-estar' },
  ];
  return (
    <>
      <StepHead titulo="Seu objetivo" sub="Você pode mudar depois." />
      <CardOptions opts={opts} sel={p.objetivo} onSel={p.setObjetivo} />
    </>
  );
}

function PassoAtividade(p: { nivelAtividade: NivelAtividade; setNivel: (v: NivelAtividade) => void }) {
  return (
    <>
      <StepHead titulo="Nível de atividade" sub="Fora dos treinos — sua rotina do dia a dia." />
      <CardOptions opts={ATIVIDADES} sel={p.nivelAtividade} onSel={p.setNivel} />
    </>
  );
}

function PassoExperiencia(p: { nivelExperiencia: NivelExperiencia; setNivelExp: (v: NivelExperiencia) => void }) {
  const opts: { id: NivelExperiencia; rotulo: string; sub: string }[] = [
    { id: 'iniciante', rotulo: 'Iniciante', sub: 'começando agora ou voltando' },
    { id: 'intermediario', rotulo: 'Intermediário', sub: 'treino há alguns meses' },
    { id: 'avancado', rotulo: 'Avançado', sub: 'treino consistente há anos' },
  ];
  return (
    <>
      <StepHead titulo="Experiência de treino" sub="Define a progressão e a dificuldade liberada." />
      <CardOptions opts={opts} sel={p.nivelExperiencia} onSel={p.setNivelExp} />
    </>
  );
}

function PassoOndeQuando(p: {
  equipamento: EquipamentoDisp; setEquipamento: (v: EquipamentoDisp) => void;
  diasDisponiveis: number; setDias: (v: number) => void;
  tempoPorSessaoMin: number; setTempo: (v: number) => void;
}) {
  const eq: { id: EquipamentoDisp; rotulo: string }[] = [
    { id: 'nenhum', rotulo: 'Sem equipamento' },
    { id: 'casa', rotulo: 'Em casa' },
    { id: 'academia', rotulo: 'Academia' },
  ];
  return (
    <>
      <StepHead titulo="Onde e quando" sub="Adaptamos os exercícios ao que você tem." />
      <div>
        <span className="label-cap">Equipamento</span>
        <div className="seg mt-2">
          {eq.map((e) => <button key={e.id} className="opt" aria-pressed={p.equipamento === e.id} onClick={() => p.setEquipamento(e.id)}>{e.rotulo}</button>)}
        </div>
      </div>
      <div>
        <span className="label-cap">Dias por semana</span>
        <div className="seg mt-2">
          {[1, 2, 3, 4, 5, 6].map((d) => <button key={d} className="opt" aria-pressed={p.diasDisponiveis === d} onClick={() => p.setDias(d)}>{d}</button>)}
        </div>
      </div>
      <div>
        <span className="label-cap">Minutos por sessão</span>
        <div className="seg mt-2">
          {[30, 45, 60, 75].map((t) => <button key={t} className="opt" aria-pressed={p.tempoPorSessaoMin === t} onClick={() => p.setTempo(t)}>{t === 75 ? '75+' : t}</button>)}
        </div>
      </div>
    </>
  );
}

function PassoPreferencia(p: {
  preferencia: '' | 'vegano' | 'vegetariano'; setPreferencia: (v: '' | 'vegano' | 'vegetariano') => void;
  alergenos: Alergeno[]; toggleAlergeno: (a: Alergeno) => void;
  naoGosto: string; setNaoGosto: (v: string) => void;
}) {
  const pad: { id: '' | 'vegetariano' | 'vegano'; rotulo: string }[] = [
    { id: '', rotulo: 'Onívoro' },
    { id: 'vegetariano', rotulo: 'Vegetariano' },
    { id: 'vegano', rotulo: 'Vegano' },
  ];
  return (
    <>
      <StepHead titulo="Preferência alimentar" sub="Alergia e padrão são regras absolutas; “não curto” é só uma preferência." />
      <div>
        <span className="label-cap">Padrão alimentar</span>
        <div className="seg mt-2">
          {pad.map((x) => <button key={x.id || 'oni'} className="opt" aria-pressed={p.preferencia === x.id} onClick={() => p.setPreferencia(x.id)}>{x.rotulo}</button>)}
        </div>
      </div>
      <div>
        <span className="label-cap">Alergias <span className="normal-case opacity-70">(filtro absoluto — nunca entram no cardápio)</span></span>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALERGENOS.map((a) => <button key={a.id} className="chip" aria-pressed={p.alergenos.includes(a.id)} onClick={() => p.toggleAlergeno(a.id)}>{a.rotulo}</button>)}
        </div>
      </div>
      <div>
        <span className="label-cap">Não curto <span className="normal-case opacity-70">(opcional)</span></span>
        <input className="campo mt-2" placeholder="ex.: jiló, fígado…" value={p.naoGosto} onChange={(e) => p.setNaoGosto(e.target.value)} />
      </div>
    </>
  );
}

/* ════════════════════ Gerando / Desfechos ════════════════════ */

function TelaGerando() {
  return (
    <section className="anim-screen flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
      <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(234,229,219,.15)', borderTopColor: '#BDFF00', animation: 'evkSpin .9s linear infinite' }} />
      <div>
        <p className="text-lg font-bold">Montando seu ponto de partida…</p>
        <p className="mt-1 text-sm text-secundario">Aplicando regras adaptativas ao seu perfil.</p>
      </div>
    </section>
  );
}

function Encaminhamento({ motivos, onRevisar }: { motivos: string[]; onRevisar: () => void }) {
  return (
    <section className="anim-screen surface flex flex-col gap-4 p-6">
      <KAscendente size={44} />
      <h1 className="text-2xl font-bold tracking-tight">Aqui, o cuidado certo é com um profissional</h1>
      <p className="text-sm text-secundario">
        Com base no que você informou, o Evokorpus <strong className="text-bone">não gera um plano</strong> neste
        momento. Isso é proposital: algumas situações pedem o acompanhamento de um profissional de saúde.
      </p>
      <ul className="flex flex-col gap-1 text-sm text-secundario">
        {motivos.map((m) => <li key={m} className="flex gap-2"><span className="text-folha">•</span>{m}</li>)}
      </ul>
      <div className="flex gap-3">
        <button className="btn btn-ghost flex-1" onClick={onRevisar}>Revisar respostas</button>
      </div>
    </section>
  );
}

/** Banner do Desfecho C — ajuste honesto (RESTRINGIR ou PISAR). */
function BannerAjuste({ dieta }: { dieta: ResultadoMotor }) {
  const c = dieta.gate.comportamento;
  if (c !== 'RESTRINGIR' && c !== 'PISAR') return null;
  const linhas = [dieta.plano?.notaTransparencia, ...(dieta.plano?.avisos ?? [])].filter(Boolean) as string[];
  return (
    <div className="pilula-ajuste p-4 text-sm">
      <p className="label-cap" style={{ color: '#BDFF00' }}>Ajuste honesto</p>
      <p className="mt-1">Ajustamos seu plano para manter você em segurança. Tudo continua editável.</p>
      {linhas.length > 0 && <ul className="mt-2 flex flex-col gap-1 text-secundario">{linhas.map((l) => <li key={l}>{l}</li>)}</ul>}
    </div>
  );
}

/* ════════════════════ Plano: Dieta / Treino ════════════════════ */

function DietaView({ dieta, itens, totais, msg, onTrocar }: {
  dieta: ResultadoMotor; itens: CardapioItem[]; totais: RecipeMacros | null;
  msg: { idx: number; texto: string } | null; onTrocar: (idx: number) => void;
}) {
  const plano = dieta.plano;
  if (!plano) return null;
  return (
    <div className="surface flex flex-col gap-5 p-5">
      <div>
        <span className="label-cap">Seu ponto de partida</span>
        <p className="text-4xl font-extrabold text-pulso">{r0(plano.kcalAlvo)}<span className="ml-1 text-lg font-medium text-secundario">kcal/dia</span></p>
        <p className="mt-1 text-xs text-secundario">É um guia, não uma meta exata.</p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Macro nome="Proteína" g={r0(plano.macros.proteinaG)} />
        <Macro nome="Carboidrato" g={r0(plano.macros.carboidratoG)} />
        <Macro nome="Gordura" g={r0(plano.macros.gorduraG)} />
      </div>

      {itens.length > 0 ? (
        <div>
          <span className="label-cap">Cardápio do dia</span>
          <ul className="mt-2 flex flex-col gap-2">
            {itens.map((it, idx) => (
              <li key={`${it.refeicao}-${it.prato.id}`} className="surface-soft p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs uppercase text-secundario">{REFEICAO_LABEL[it.refeicao]}</span>
                    <span className="text-sm">{it.prato.nome}</span>
                    <span className="block text-xs text-secundario">{r0(it.macros.kcal)} kcal · {r0(it.macros.proteinaG)} g prot · porção {it.escala.toFixed(2)}×</span>
                  </div>
                  <button className="btn btn-ghost shrink-0" style={{ padding: '0.5rem 0.9rem', fontSize: '.8rem' }} onClick={() => onTrocar(idx)}>Trocar</button>
                </div>
                {msg?.idx === idx && <p className="mt-1 text-xs text-secundario">{msg.texto}</p>}
              </li>
            ))}
          </ul>
          {totais && <p className="mt-2 flex justify-between border-t border-bone/10 pt-2 text-sm text-secundario"><span>Total do dia</span><span>{r0(totais.kcal)} kcal · {r0(totais.proteinaG)} g prot</span></p>}
        </div>
      ) : (
        <p className="text-sm text-secundario">{dieta.cardapio?.nota ?? 'Não foi possível montar um cardápio com as restrições atuais.'}</p>
      )}
    </div>
  );
}

function TreinoView({ treino, dias, msg, onTrocar }: {
  treino: ResultadoTreino; dias: DiaTreino[];
  msg: { chave: string; texto: string } | null; onTrocar: (d: number, s: number) => void;
}) {
  const { prescricao, rotina } = treino;
  if (!prescricao || !rotina) return null;
  return (
    <div className="surface flex flex-col gap-4 p-5">
      <div>
        <span className="label-cap">{rotina.split} · {rotina.diasForcaAgendados}× força/semana</span>
        <p className="mt-1 text-xs text-secundario">
          Compostos {prescricao.repsComposto.min}–{prescricao.repsComposto.max} reps · {prescricao.seriesPorExercicio.min}–{prescricao.seriesPorExercicio.max} séries · RIR {prescricao.rir.min}–{prescricao.rir.max}
        </p>
      </div>
      {dias.map((dia, d) => (
        <div key={`${dia.nome}-${d}`}>
          <span className="label-cap">{dia.nome}</span>
          <ul className="mt-2 flex flex-col gap-2">
            {dia.slots.map((sl, s) => (
              <li key={`${d}-${s}-${sl.exercicio.id}`} className="surface-soft p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs uppercase text-secundario">{sl.padrao}</span>
                    <span className="text-sm">{sl.exercicio.nomePt}</span>
                    <span className="block text-xs text-secundario">{sl.exercicio.grupoMuscular}</span>
                  </div>
                  <button className="btn btn-ghost shrink-0" style={{ padding: '0.5rem 0.9rem', fontSize: '.8rem' }} onClick={() => onTrocar(d, s)}>Trocar</button>
                </div>
                {msg?.chave === `${d}-${s}` && <p className="mt-1 text-xs text-secundario">{msg.texto}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-secundario">Iniciante não treina até a falha; carga sobe por dupla progressão guiada pelo seu feedback.</p>
    </div>
  );
}

/* ════════════════════ Primitivos de UI ════════════════════ */

function CardOptions<T extends string>({ opts, sel, onSel }: {
  opts: { id: T; rotulo: string; sub: string }[]; sel: T; onSel: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {opts.map((o) => (
        <button key={o.id} className="opt text-left" aria-pressed={sel === o.id} onClick={() => onSel(o.id)} style={{ flex: 'none' }}>
          <span className="block font-semibold text-bone">{o.rotulo}</span>
          <span className="block text-xs text-secundario">{o.sub}</span>
        </button>
      ))}
    </div>
  );
}

function NumField({ label, value, onChange, suf }: { label: string; value: string; onChange: (v: string) => void; suf: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-cap">{label}</span>
      <div className="relative">
        <input className="campo" type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-secundario">{suf}</span>
      </div>
    </label>
  );
}

function SimNao({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="surface-soft flex items-center justify-between gap-3 p-3">
      <span className="text-sm">{label}</span>
      <div className="seg shrink-0" style={{ width: 140 }}>
        <button className="opt" aria-pressed={!value} onClick={() => onChange(false)}>Não</button>
        <button className="opt" aria-pressed={value} onClick={() => onChange(true)}>Sim</button>
      </div>
    </div>
  );
}

function Macro({ nome, g }: { nome: string; g: number }) {
  return (
    <div className="surface-soft p-3">
      <p className="text-lg font-bold">{g} g</p>
      <p className="text-xs text-secundario">{nome}</p>
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 transition hover:bg-bone/5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-pulso" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
