'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KAscendente } from '@/lib/brand/Logo';
import { gerarDieta, type ResultadoMotor } from '@/lib/engine';
import type {
  NivelAtividade,
  Objetivo,
  PerfilUsuario,
  Sexo,
} from '@/lib/engine';
import type { Alergeno } from '@/lib/data/types';
import { FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import { consentimentoSchema, perfilSchema } from '@/lib/validation/profile';

const ALERGENOS: { id: Alergeno; rotulo: string }[] = [
  { id: 'lactose', rotulo: 'Lactose' },
  { id: 'gluten', rotulo: 'Glúten' },
  { id: 'ovo', rotulo: 'Ovo' },
  { id: 'soja', rotulo: 'Soja' },
  { id: 'amendoim', rotulo: 'Amendoim' },
  { id: 'castanhas', rotulo: 'Castanhas' },
  { id: 'peixe_frutos_do_mar', rotulo: 'Peixe / frutos do mar' },
];

const r0 = (n: number) => Math.round(n);

export default function Onboarding() {
  // Consentimentos
  const [aceite18, setA18] = useState(false);
  const [aceiteTermos, setATermos] = useState(false);
  const [aceiteLgpd, setALgpd] = useState(false);

  // Questionário
  const [sexo, setSexo] = useState<Sexo>('feminino');
  const [pesoKg, setPeso] = useState('70');
  const [alturaCm, setAltura] = useState('170');
  const [idade, setIdade] = useState('30');
  const [nivelAtividade, setNivel] = useState<NivelAtividade>('moderado');
  const [objetivo, setObjetivo] = useState<Objetivo>('emagrecimento');
  const [preferencia, setPreferencia] = useState<'' | 'vegano' | 'vegetariano'>('');
  const [alergenos, setAlergenos] = useState<Alergeno[]>([]);

  // PAR-Q
  const [gestacaoAmamentacao, setGest] = useState(false);
  const [renal, setRenal] = useState(false);
  const [cardiaca, setCardiaca] = useState(false);
  const [lesao, setLesao] = useState(false);
  const [diabetes, setDiabetes] = useState(false);

  const [erros, setErros] = useState<string[]>([]);
  const [resultado, setResultado] = useState<ResultadoMotor | null>(null);

  function toggleAlergeno(a: Alergeno) {
    setAlergenos((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function gerar() {
    setErros([]);
    setResultado(null);

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
    const perfil: PerfilUsuario = {
      sexo: p.sexo,
      pesoKg: p.pesoKg,
      alturaCm: p.alturaCm,
      idade: p.idade,
      nivelAtividade: p.nivelAtividade,
      objetivo: p.objetivo,
      flagsSaude: p.flagsSaude,
    };

    setResultado(
      gerarDieta(perfil, {
        recipes: RECIPES_SEED,
        foodsById: FOODS_BY_ID_SEED,
        restricoes: {
          alergenos: p.alergenos as Alergeno[],
          preferencia: p.preferenciaAlimentar ?? null,
        },
      }),
    );
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

      {resultado && <ResultadoView resultado={resultado} />}

      <p className="mt-2 text-center text-xs text-secundario">
        Demonstração local: o plano é calculado no seu dispositivo. A persistência (conta +
        histórico) exige a configuração do Supabase — ver docs/access.md.
      </p>
    </main>
  );
}

function ResultadoView({ resultado }: { resultado: ResultadoMotor }) {
  const { gate, plano, cardapio } = resultado;

  if (gate.comportamento === 'ROTEAR') {
    return (
      <section className="rounded-xl border border-alerta/40 p-5">
        <span className="pilula-alerta rounded-full px-3 py-1 text-xs uppercase">Procure um profissional</span>
        <p className="mt-3 text-sm">
          Com base no que você informou, o Evokorpus <strong>não gera um plano</strong> neste
          momento — o cuidado certo aqui é o acompanhamento de um profissional de saúde.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-secundario">
          {gate.motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
    );
  }

  if (!plano) return null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-bone/15 p-5">
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

      {cardapio && (
        <div>
          <h3 className="font-label uppercase tracking-wide text-secundario">Exemplo de cardápio do dia</h3>
          {cardapio.status === 'sem_candidatos' || cardapio.status === 'fora_da_janela' ? (
            <p className="mt-2 text-sm text-secundario">{cardapio.nota}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {cardapio.pratos.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.nome}</span>
                  <span className="text-secundario capitalize">{p.refeicao}</span>
                </li>
              ))}
              <li className="mt-1 flex justify-between border-t border-bone/10 pt-1 text-secundario">
                <span>Total</span>
                <span>{r0(cardapio.totais.kcal)} kcal</span>
              </li>
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-secundario">
        Os valores são orientação geral, não prescrição. Tudo é editável — você está no comando.
      </p>
    </section>
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
