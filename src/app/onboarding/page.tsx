'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KAscendente } from '@/lib/brand/Logo';
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

const r0 = (n: number) => Math.round(n);

const REFEICAO_LABEL: Record<string, string> = {
  cafe: 'Café',
  almoco: 'Almoço',
  jantar: 'Jantar',
  lanche: 'Lanche',
};

/** Contexto da geração (snapshot) — necessário para as substituições. */
interface Contexto {
  restricoes: { alergenos: Alergeno[]; preferencia: 'vegano' | 'vegetariano' | null };
  equipamento: EquipamentoDisp;
  nivelExperiencia: NivelExperiencia;
}

export default function Onboarding() {
  // Consentimentos
  const [aceite18, setA18] = useState(false);
  const [aceiteTermos, setATermos] = useState(false);
  const [aceiteLgpd, setALgpd] = useState(false);

  // Questionário (perfil)
  const [sexo, setSexo] = useState<Sexo>('feminino');
  const [pesoKg, setPeso] = useState('70');
  const [alturaCm, setAltura] = useState('170');
  const [idade, setIdade] = useState('30');
  const [nivelAtividade, setNivel] = useState<NivelAtividade>('moderado');
  const [objetivo, setObjetivo] = useState<Objetivo>('emagrecimento');
  const [preferencia, setPreferencia] = useState<'' | 'vegano' | 'vegetariano'>('');
  const [alergenos, setAlergenos] = useState<Alergeno[]>([]);

  // Treino
  const [nivelExperiencia, setNivelExp] = useState<NivelExperiencia>('iniciante');
  const [equipamento, setEquipamento] = useState<EquipamentoDisp>('casa');
  const [diasDisponiveis, setDias] = useState('3');
  const [tempoPorSessaoMin, setTempo] = useState('45');

  // PAR-Q
  const [gestacaoAmamentacao, setGest] = useState(false);
  const [renal, setRenal] = useState(false);
  const [cardiaca, setCardiaca] = useState(false);
  const [lesao, setLesao] = useState(false);
  const [diabetes, setDiabetes] = useState(false);

  const [erros, setErros] = useState<string[]>([]);
  const [dieta, setDieta] = useState<ResultadoMotor | null>(null);
  const [treino, setTreino] = useState<ResultadoTreino | null>(null);
  const [ctx, setCtx] = useState<Contexto | null>(null);
  const [aba, setAba] = useState<'dieta' | 'treino'>('dieta');

  // Estado MUTÁVEL das telas (para as trocas refletirem na UI)
  const [cardItens, setCardItens] = useState<CardapioItem[]>([]);
  const [cardTotais, setCardTotais] = useState<RecipeMacros | null>(null);
  const [rotinaDias, setRotinaDias] = useState<DiaTreino[]>([]);
  const [msgPrato, setMsgPrato] = useState<{ idx: number; texto: string } | null>(null);
  const [msgEx, setMsgEx] = useState<{ chave: string; texto: string } | null>(null);

  function toggleAlergeno(a: Alergeno) {
    setAlergenos((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function gerar() {
    setErros([]);
    setDieta(null);
    setTreino(null);
    setMsgPrato(null);
    setMsgEx(null);

    const consent = consentimentoSchema.safeParse({ aceite18, aceiteTermos, aceiteLgpd });
    const perfilParse = perfilSchema.safeParse({
      sexo,
      pesoKg,
      alturaCm,
      idade,
      nivelAtividade,
      objetivo,
      flagsSaude: { gestacaoAmamentacao, renal, cardiaca, lesao, diabetes },
      preferenciaAlimentar: preferencia || null,
      alergenos,
    });

    if (!consent.success || !perfilParse.success) {
      const msgs: string[] = [];
      if (!consent.success) msgs.push(...consent.error.issues.map((i) => i.message));
      if (!perfilParse.success) msgs.push(...perfilParse.error.issues.map((i) => i.message));
      setErros(Array.from(new Set(msgs)));
      return;
    }

    const p = perfilParse.data;
    const restricoes = {
      alergenos: p.alergenos as Alergeno[],
      preferencia: p.preferenciaAlimentar ?? null,
    };
    const perfil: PerfilUsuario = {
      sexo: p.sexo,
      pesoKg: p.pesoKg,
      alturaCm: p.alturaCm,
      idade: p.idade,
      nivelAtividade: p.nivelAtividade,
      objetivo: p.objetivo,
      flagsSaude: p.flagsSaude,
    };

    const perfilTreino: PerfilTreino = {
      pesoKg: p.pesoKg,
      alturaCm: p.alturaCm,
      idade: p.idade,
      flagsSaude: p.flagsSaude,
      objetivo: p.objetivo,
      nivelExperiencia,
      equipamento,
      diasDisponiveis: Number(diasDisponiveis),
      tempoPorSessaoMin: Number(tempoPorSessaoMin),
    };

    const resDieta = gerarDieta(perfil, {
      recipes: RECIPES_SEED,
      foodsById: FOODS_BY_ID_SEED,
      restricoes,
    });
    const resTreino = gerarTreino(perfilTreino, { exercises: EXERCISES_SEED });

    setDieta(resDieta);
    setTreino(resTreino);
    setCtx({ restricoes, equipamento, nivelExperiencia });

    // Inicializa os estados mutáveis das telas
    if (resDieta.cardapio && resDieta.cardapio.status !== 'sem_candidatos') {
      setCardItens(resDieta.cardapio.itens);
      setCardTotais(resDieta.cardapio.totais);
    } else {
      setCardItens([]);
      setCardTotais(null);
    }
    setRotinaDias(resTreino.rotina ? resTreino.rotina.dias : []);
    setAba('dieta');
  }

  // --- Substituição de prato (F.2) ---
  function trocarPrato(idx: number) {
    if (!dieta?.plano || !ctx || !cardTotais) return;
    const item = cardItens[idx]!;
    const outrosIds = cardItens.filter((_, i) => i !== idx).map((c) => c.prato.id);
    const res = substituirPrato({
      pratoAtual: item.prato,
      slot: item.refeicao,
      recipes: RECIPES_SEED,
      foodsById: FOODS_BY_ID_SEED,
      plano: dieta.plano,
      totaisDiaAtual: cardTotais,
      restricoes: ctx.restricoes,
      gosto: { excluirPratoIds: outrosIds }, // evita repetir prato já usado no dia
    });
    if (res.status === 'ok' && res.prato && res.totaisDiaNovo) {
      const novos = cardItens.slice();
      novos[idx] = { refeicao: item.refeicao, prato: res.prato };
      setCardItens(novos);
      setCardTotais(res.totaisDiaNovo);
      setMsgPrato({ idx, texto: res.gostoRelaxado ? 'Trocado (preferência de gosto relaxada).' : 'Trocado.' });
    } else {
      setMsgPrato({ idx, texto: res.nota ?? 'Sem troca que mantenha o dia equilibrado.' });
    }
  }

  // --- Substituição de exercício (F.2) ---
  function trocarExercicio(d: number, s: number) {
    if (!ctx) return;
    const atual = rotinaDias[d]!.slots[s]!.exercicio;
    const usados = rotinaDias.flatMap((dia) => dia.slots.map((sl) => sl.exercicio.id));
    const res = substituirExercicio({
      exercicioAtual: atual,
      equipamento: ctx.equipamento,
      nivelExperiencia: ctx.nivelExperiencia,
      exercises: EXERCISES_SEED,
      historicoRecenteIds: usados, // variedade: evita repetir o que já está na semana
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

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center gap-3">
        <KAscendente size={40} />
        <Link href="/" className="text-sm text-secundario hover:text-bone">
          ← início
        </Link>
      </header>

      <h1 className="text-2xl font-bold">Vamos montar seu ponto de partida</h1>
      <p className="text-sm text-secundario">
        O Evokorpus é uma ferramenta educacional dirigida por você — não substitui um
        profissional. Em algumas condições, o app não gera plano e orienta procurar ajuda.
      </p>

      {/* Consentimentos */}
      <section className="rounded-xl border border-bone/15 p-4">
        <h2 className="font-label uppercase tracking-wide text-secundario">Antes de começar</h2>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <Check checked={aceite18} onChange={setA18} label="Confirmo que tenho 18 anos ou mais." />
          <Check checked={aceiteTermos} onChange={setATermos} label="Li e aceito o termo de conscientização e o disclaimer." />
          <Check checked={aceiteLgpd} onChange={setALgpd} label="Consinto com o tratamento dos meus dados (LGPD) para gerar meu plano." />
        </div>
      </section>

      {/* Questionário */}
      <section className="rounded-xl border border-bone/15 p-4">
        <h2 className="font-label uppercase tracking-wide text-secundario">Seus dados</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <Campo label="Sexo biológico">
            <select className="campo" value={sexo} onChange={(e) => setSexo(e.target.value as Sexo)}>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
            </select>
          </Campo>
          <Campo label="Idade">
            <input className="campo" type="number" value={idade} onChange={(e) => setIdade(e.target.value)} />
          </Campo>
          <Campo label="Peso (kg)">
            <input className="campo" type="number" value={pesoKg} onChange={(e) => setPeso(e.target.value)} />
          </Campo>
          <Campo label="Altura (cm)">
            <input className="campo" type="number" value={alturaCm} onChange={(e) => setAltura(e.target.value)} />
          </Campo>
          <Campo label="Nível de atividade">
            <select className="campo" value={nivelAtividade} onChange={(e) => setNivel(e.target.value as NivelAtividade)}>
              <option value="sedentario">Sedentário</option>
              <option value="leve">Leve</option>
              <option value="moderado">Moderado</option>
              <option value="intenso">Intenso</option>
              <option value="muito_intenso">Muito intenso</option>
            </select>
          </Campo>
          <Campo label="Objetivo">
            <select className="campo" value={objetivo} onChange={(e) => setObjetivo(e.target.value as Objetivo)}>
              <option value="emagrecimento">Emagrecimento</option>
              <option value="massa">Ganho de massa</option>
              <option value="saude">Saúde / manutenção</option>
            </select>
          </Campo>
          <Campo label="Preferência alimentar">
            <select className="campo" value={preferencia} onChange={(e) => setPreferencia(e.target.value as '' | 'vegano' | 'vegetariano')}>
              <option value="">Sem preferência</option>
              <option value="vegetariano">Vegetariano</option>
              <option value="vegano">Vegano</option>
            </select>
          </Campo>
        </div>

        <div className="mt-4">
          <span className="text-xs text-secundario">Alergias (filtro absoluto — nunca entram no cardápio)</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALERGENOS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAlergeno(a.id)}
                className={`rounded-full px-3 py-1 text-xs ${alergenos.includes(a.id) ? 'bg-folha text-bone' : 'border border-bone/25 text-secundario'}`}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Treino */}
      <section className="rounded-xl border border-bone/15 p-4">
        <h2 className="font-label uppercase tracking-wide text-secundario">Seu treino</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <Campo label="Experiência">
            <select className="campo" value={nivelExperiencia} onChange={(e) => setNivelExp(e.target.value as NivelExperiencia)}>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </Campo>
          <Campo label="Equipamento">
            <select className="campo" value={equipamento} onChange={(e) => setEquipamento(e.target.value as EquipamentoDisp)}>
              <option value="nenhum">Nenhum (peso corporal)</option>
              <option value="casa">Em casa (halteres/elásticos)</option>
              <option value="academia">Academia</option>
            </select>
          </Campo>
          <Campo label="Dias por semana">
            <input className="campo" type="number" min={1} max={7} value={diasDisponiveis} onChange={(e) => setDias(e.target.value)} />
          </Campo>
          <Campo label="Minutos por sessão">
            <input className="campo" type="number" min={10} max={180} value={tempoPorSessaoMin} onChange={(e) => setTempo(e.target.value)} />
          </Campo>
        </div>
      </section>

      {/* PAR-Q */}
      <section className="rounded-xl border border-bone/15 p-4">
        <h2 className="font-label uppercase tracking-wide text-secundario">Triagem de saúde (sim/não)</h2>
        <p className="mt-1 text-xs text-secundario">Autodeclaração mínima. Não é ficha médica.</p>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <Check checked={gestacaoAmamentacao} onChange={setGest} label="Estou gestante ou amamentando" />
          <Check checked={renal} onChange={setRenal} label="Tenho condição renal" />
          <Check checked={cardiaca} onChange={setCardiaca} label="Tenho condição cardíaca" />
          <Check checked={lesao} onChange={setLesao} label="Tenho lesão ou limitação física" />
          <Check checked={diabetes} onChange={setDiabetes} label="Tenho diabetes" />
        </div>
      </section>

      {erros.length > 0 && (
        <div className="pilula-alerta rounded-xl p-4 text-sm">
          <ul className="list-disc pl-4">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={gerar}
        className="rounded-full bg-pulso px-8 py-3 font-label uppercase tracking-wide text-floresta transition hover:opacity-90"
      >
        Gerar meu plano
      </button>

      {(dieta || treino) && (
        <section className="flex flex-col gap-4">
          {/* Abas */}
          <div className="flex gap-2">
            <Tab ativo={aba === 'dieta'} onClick={() => setAba('dieta')}>
              Dieta
            </Tab>
            <Tab ativo={aba === 'treino'} onClick={() => setAba('treino')}>
              Treino
            </Tab>
          </div>

          {aba === 'dieta' && dieta && (
            <DietaView
              dieta={dieta}
              itens={cardItens}
              totais={cardTotais}
              msg={msgPrato}
              onTrocar={trocarPrato}
            />
          )}

          {aba === 'treino' && treino && (
            <TreinoView treino={treino} dias={rotinaDias} msg={msgEx} onTrocar={trocarExercicio} />
          )}
        </section>
      )}

      <p className="mt-2 text-center text-xs text-secundario">
        Demonstração local: plano e trocas são calculados no seu dispositivo (motor
        determinístico). A persistência (conta + histórico) exige a configuração do Supabase —
        ver docs/access.md.
      </p>
    </main>
  );
}

function DietaView({
  dieta,
  itens,
  totais,
  msg,
  onTrocar,
}: {
  dieta: ResultadoMotor;
  itens: CardapioItem[];
  totais: RecipeMacros | null;
  msg: { idx: number; texto: string } | null;
  onTrocar: (idx: number) => void;
}) {
  const { gate, plano } = dieta;

  if (gate.comportamento === 'ROTEAR') return <RotearCard motivos={gate.motivos} />;
  if (!plano) return null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-bone/15 p-5">
      {plano.notaTransparencia && (
        <p className="rounded-lg bg-bone/5 p-3 text-sm text-secundario">{plano.notaTransparencia}</p>
      )}
      {plano.avisos.map((a) => (
        <p key={a} className="rounded-lg bg-bone/5 p-3 text-sm text-secundario">{a}</p>
      ))}

      <div>
        <span className="text-xs text-secundario">Estimativa de referência (ponto de partida)</span>
        <p className="text-3xl font-bold text-pulso">{r0(plano.kcalAlvo)} kcal/dia</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <Macro nome="Proteína" g={r0(plano.macros.proteinaG)} />
        <Macro nome="Carboidrato" g={r0(plano.macros.carboidratoG)} />
        <Macro nome="Gordura" g={r0(plano.macros.gorduraG)} />
      </div>

      {dieta.cardapio?.status === 'fora_da_janela' && (
        <p className="pilula-alerta rounded-lg p-3 text-xs">
          Prévia v0: este cardápio de exemplo ainda fica fora da janela calórica do objetivo
          (o banco de pratos com porções fixas não alcança o alvo). O montador com escala de
          porções está em desenvolvimento. As trocas só fecham quando o dia está dentro da janela.
        </p>
      )}

      {itens.length > 0 ? (
        <div>
          <h3 className="font-label uppercase tracking-wide text-secundario">Cardápio do dia</h3>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {itens.map((it, idx) => (
              <li key={`${it.refeicao}-${it.prato.id}`} className="rounded-lg bg-bone/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs uppercase text-secundario">{REFEICAO_LABEL[it.refeicao]}</span>
                    <span>{it.prato.nome}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTrocar(idx)}
                    className="shrink-0 rounded-full border border-pulso/60 px-3 py-1 text-xs uppercase tracking-wide text-pulso hover:bg-pulso/10"
                  >
                    Trocar
                  </button>
                </div>
                {msg?.idx === idx && <p className="mt-1 text-xs text-secundario">{msg.texto}</p>}
              </li>
            ))}
          </ul>
          {totais && (
            <p className="mt-2 flex justify-between border-t border-bone/10 pt-2 text-sm text-secundario">
              <span>Total do dia</span>
              <span>{r0(totais.kcal)} kcal · {r0(totais.proteinaG)} g proteína</span>
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-secundario">
          {dieta.cardapio?.nota ?? 'Não foi possível montar um cardápio com as restrições atuais.'}
        </p>
      )}

      <p className="text-xs text-secundario">
        Os valores são orientação geral, não prescrição. Tudo é editável — você está no comando.
      </p>
    </div>
  );
}

function TreinoView({
  treino,
  dias,
  msg,
  onTrocar,
}: {
  treino: ResultadoTreino;
  dias: DiaTreino[];
  msg: { chave: string; texto: string } | null;
  onTrocar: (d: number, s: number) => void;
}) {
  const { gate, prescricao, rotina } = treino;

  if (gate.comportamento === 'ROTEAR') return <RotearCard motivos={gate.motivos} />;
  if (!prescricao || !rotina) return null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-bone/15 p-5">
      {rotina.avisos.map((a) => (
        <p key={a} className="rounded-lg bg-bone/5 p-3 text-sm text-secundario">{a}</p>
      ))}

      <div>
        <span className="text-xs text-secundario">Prescrição ({prescricao.nivel} · {prescricao.objetivoEfetivo})</span>
        <p className="text-sm">
          {rotina.split} · {rotina.diasForcaAgendados}× força/semana
        </p>
        <p className="mt-1 text-xs text-secundario">
          Compostos {prescricao.repsComposto.min}–{prescricao.repsComposto.max} reps · isolados{' '}
          {prescricao.repsIsolado.min}–{prescricao.repsIsolado.max} reps · {prescricao.seriesPorExercicio.min}–
          {prescricao.seriesPorExercicio.max} séries · RIR {prescricao.rir.min}–{prescricao.rir.max}
        </p>
      </div>

      {dias.map((dia, d) => (
        <div key={`${dia.nome}-${d}`}>
          <h3 className="font-label uppercase tracking-wide text-secundario">{dia.nome}</h3>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {dia.slots.map((sl, s) => (
              <li key={`${d}-${s}-${sl.exercicio.id}`} className="rounded-lg bg-bone/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs uppercase text-secundario">{sl.padrao}</span>
                    <span>{sl.exercicio.nomePt}</span>
                    <span className="block text-xs text-secundario">{sl.exercicio.grupoMuscular}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTrocar(d, s)}
                    className="shrink-0 rounded-full border border-pulso/60 px-3 py-1 text-xs uppercase tracking-wide text-pulso hover:bg-pulso/10"
                  >
                    Trocar
                  </button>
                </div>
                {msg?.chave === `${d}-${s}` && <p className="mt-1 text-xs text-secundario">{msg.texto}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="text-xs text-secundario">
        Iniciante não treina até a falha; carga/dificuldade sobem por dupla progressão guiada pelo
        seu feedback. Orientação geral, não prescrição clínica.
      </p>
    </div>
  );
}

function RotearCard({ motivos }: { motivos: string[] }) {
  return (
    <div className="rounded-xl border border-alerta/40 p-5">
      <span className="pilula-alerta rounded-full px-3 py-1 text-xs uppercase">Procure um profissional</span>
      <p className="mt-3 text-sm">
        Com base no que você informou, o Evokorpus <strong>não gera um plano</strong> neste
        momento — o cuidado certo aqui é o acompanhamento de um profissional de saúde.
      </p>
      <ul className="mt-3 list-disc pl-5 text-sm text-secundario">
        {motivos.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

function Tab({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-2 font-label text-sm uppercase tracking-wide transition ${
        ativo ? 'bg-pulso text-floresta' : 'border border-bone/25 text-secundario hover:text-bone'
      }`}
    >
      {children}
    </button>
  );
}

function Macro({ nome, g }: { nome: string; g: number }) {
  return (
    <div className="rounded-lg bg-bone/5 p-3">
      <p className="text-lg font-bold">{g} g</p>
      <p className="text-xs text-secundario">{nome}</p>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-secundario">{label}</span>
      {children}
    </label>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-folha"
      />
      <span>{label}</span>
    </label>
  );
}
