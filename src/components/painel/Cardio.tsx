'use client';

import { useState, type CSSProperties } from 'react';
import {
  DESCRICAO_INTENSIDADE, MODALIDADES_CARDIO, ROTULO_INTENSIDADE, ROTULO_MODALIDADE,
  classeDoMet, intensidadesDe, kcalExibida, kcalLiquida, metDe, metaCumprida, minutosNaMeta,
  resumoCardioSemana,
  type IntensidadeCardio, type MetaCardio, type ModalidadeCardio,
} from '@/lib/engine/cardio';
import { diaDaSemanaPt, formatarAcumulado, rotuloSemana, type RegistroCardioDatado } from '@/lib/cardio-semana';

/**
 * Cardio — registro, progresso contra a meta e estimativa de gasto
 * (Leva 2 · Bloco 1; porte fiel de `Evokorpus Cardio.dc.html`, 14 telas, do pacote
 * `design_handoff_evokorpus_dieta_cardio_retomada`; spec TRAVADA do cofre
 * `parametros-motor-treino-evokorpus` §Cardio, DF 2026-07-27).
 *
 * 🔴 Travas que esta peça honra (todas com teste):
 *   · o MET (e qualquer número técnico de intensidade) NUNCA aparece na interface;
 *   · 🟢 a kcal NUNCA volta para a dieta — é informação, não orçamento. Nenhuma copy de
 *     "liberou", "saldo" ou "pode comer mais";
 *   · a classe sai do MET, nunca do rótulo autorrelatado (corrida "leve" conta em dobro);
 *   · atividade LEVE não avança a meta e NUNCA é enquadrada como falha — vive em
 *     "Movimento registrado", com o mesmo tratamento de cartão das outras sessões;
 *   · quem o gate roteou registra mas NÃO recebe meta;
 *   · a semana que terminou abaixo da meta não é exibida: a semana nova recomeça em zero
 *     com o mesmo convite calmo. Nenhum placar do que não foi feito.
 */

const NEON = '#BDFF00';
const cardSoft: CSSProperties = { background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18 };
const kicker: CSSProperties = { fontSize: '.72rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)' };
const apoio: CSSProperties = { fontSize: '.86rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.55 };

/** Estimativa como a tela escreve — "~140 kcal" ou o piso "menos de 10 kcal". */
export function textoKcal(kcal: number): string {
  const e = kcalExibida(kcal);
  return e.piso ? 'menos de 10 kcal' : `~${e.kcal} kcal`;
}

/**
 * 🔒 Copy OBRIGATÓRIA do descompasso com o aparelho — esteira e bike mostram um número
 * maior (bruto, e sem conhecer o condicionamento), o usuário compara e conclui que o app
 * está errado. Linha discreta + expansível, FECHADA por padrão, abrindo NO LUGAR (nunca
 * item de FAQ escondido, nunca modal).
 */
export function PorQueOAparelho() {
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer', color: 'rgba(234,229,219,.6)', fontSize: '.84rem', fontWeight: 600, minHeight: 44 }}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden><circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={1.8} /><path d="M12 11v5M12 8.2v.01" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>
        Por que o número da esteira é maior?
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {aberto && (
        <p style={{ ...apoio, margin: '4px 0 0', textWrap: 'pretty' }}>
          O número do aparelho costuma ser maior: ele soma também o que você gastaria parado e não conhece seu condicionamento. Aqui mostramos só o gasto extra do exercício — é a conta que conversa com a sua dieta.
        </p>
      )}
    </div>
  );
}

/* ═════════════════ Progresso da semana ═════════════════ */

/**
 * 🔴 O CARTÃO MEDE CONTRA O QUE O PLANO PRESCREVE (DF 2026-08-01, §🏃) — não contra a meta
 * abstrata. **O app cobra o que ele deu.**
 *
 * O defeito que isto fecha é ANTERIOR ao teto de 90: o cartão dizia *"Faltam 150 minutos
 * para os 150"* enquanto o plano oferecia UM dia de cardio. Com o teto, a distância ficou
 * visível — o plano prescreve 90 e o cartão cobrava 150 —, mas a dívida já existia sempre
 * que a pessoa oferecia menos dias do que a meta pede.
 *
 * 🔻 E a forma da frase saiu junto: *"Faltam X para os Y"* é a **classe ①** (alvo no futuro
 * da atividade da pessoa) somada à **classe ③** (denominador). 🔑 A varredura de afirmações
 * nunca a pegou porque procurava copy **FALSA** — e essa era **verdadeira**. É classe nova
 * de escape: **copy verdadeira que viola trava de forma.**
 *
 * A forma agora é de **REGISTRO, não de dívida**: o que a semana tem, o que foi registrado,
 * **sem contagem regressiva**. A diretriz de 150 min não some do mundo — ela deixa de ser
 * uma dívida que o app cobra de quem ele não deu os dias.
 */
function BarraMinutos({ feito, meta, prescrito }: { feito: number; meta: MetaCardio; prescrito?: number }) {
  // O denominador é o PLANO quando ele existe; a meta só sobra como referência da diretriz.
  const base = prescrito != null && prescrito > 0 ? prescrito : meta.alvo;
  const pct = base > 0 ? Math.min(100, (feito / base) * 100) : 0;
  const completo = feito >= base;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: '2.1rem', fontWeight: 800, color: NEON, letterSpacing: '-.02em', lineHeight: 1 }}>{feito}</span>
        <span style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.6)' }}>de {base} min no seu plano</span>
      </div>
      <div style={{ height: 9, borderRadius: 999, background: 'rgba(234,229,219,.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #16A34A, #BDFF00)', transition: 'width .4s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: '.72rem', color: 'rgba(234,229,219,.42)' }}>
        <span>0</span>
        <span>{base} (o cardio do seu plano)</span>
        {/* 🔒 300 NÃO é teto: a diretriz reconhece benefício acima disso. Nenhum rótulo o
            chama de máximo, e passar dele não dispara nada. */}
        {meta.max != null && <span>{meta.max} (faixa recomendada)</span>}
      </div>
      {/* 🔒 FORMA DE REGISTRO, NÃO DE DÍVIDA. Sem "faltam", sem contagem regressiva e sem
          alvo no futuro da atividade da pessoa: diz o que a semana tem e o que ela registrou. */}
      <p style={{ ...apoio, margin: '12px 0 0' }}>
        {completo
          ? `Você registrou ${feito} min de cardio nesta semana. Nada muda no seu cardápio — é só o registro.`
          : `Você registrou ${feito} min de cardio nesta semana. Seu plano tem ${base} min.`}
      </p>
    </>
  );
}

/** 🔒 Massa é CONTAGEM DE SESSÕES — não é barra: são blocos, o segundo tracejado. */
function BlocosSessoes({ feitas, meta }: { feitas: number; meta: MetaCardio }) {
  const total = meta.max ?? meta.alvo;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: '2.1rem', fontWeight: 800, color: NEON, letterSpacing: '-.02em', lineHeight: 1 }}>{feitas}</span>
        <span style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.6)' }}>
          de {meta.max != null ? `${meta.alvo} a ${meta.max} sessões` : `${meta.alvo} sessão`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {Array.from({ length: total }, (_, i) => {
          const on = i < feitas;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 8px', borderRadius: 12, fontSize: '.85rem', fontWeight: 600, background: on ? 'rgba(22,163,74,.16)' : 'transparent', border: on ? '1px solid #16A34A' : '1px dashed rgba(234,229,219,.22)', color: on ? '#EAE5DB' : 'rgba(234,229,219,.5)' }}>
              {on && <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 6 9 17l-5-5" stroke={NEON} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>}
              Sessão {i + 1}
            </div>
          );
        })}
      </div>
      <p style={{ ...apoio, margin: '12px 0 0' }}>
        {meta.max != null
          ? 'No ganho de massa a conta é por sessão, não por minutos. Uma já cumpre; a segunda é opcional.'
          : 'Nesta fase é uma sessão na semana — o piso da faixa. Volta a ser 1 ou 2 quando o treino voltar ao volume cheio.'}
      </p>
    </>
  );
}

function LinhaSessao({ r, leve }: { r: RegistroCardioDatado; leve: boolean }) {
  const naMeta = minutosNaMeta(r.met, r.minutos);
  const dobra = classeDoMet(r.met) === 2;
  return (
    <div style={{ ...cardSoft, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '.98rem' }}>
          {ROTULO_MODALIDADE[r.modalidade]}{leve ? ' leve' : ''} · {r.minutos} min
        </div>
        <div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.55)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          {dobra && <span style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: NEON, background: 'rgba(189,255,0,.12)', borderRadius: 6, padding: '2px 7px' }}>vigoroso</span>}
          <span>
            {/* Só a frase do talk test — nunca o número técnico. */}
            {leve ? DESCRICAO_INTENSIDADE.leve : dobra ? `Conta como ${naMeta} min na meta` : ROTULO_INTENSIDADE[r.intensidade]}
            {' · '}{diaDaSemanaPt(r.dataISO)}{r.hora ? `, ${r.hora}` : ''}
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {!leve && <div style={{ fontWeight: 700, fontSize: '.9rem', color: NEON }}>+{naMeta} min</div>}
        <div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.45)', marginTop: 2 }}>{textoKcal(r.kcal)}, estimativa</div>
      </div>
    </div>
  );
}

/* ═════════════════ A seção da semana ═════════════════ */

export function CardioSemana({ registros, meta, retomada, hojeISO, acumuladoMin, objetivo, onRegistrar, prescritoMin }: {
  registros: readonly RegistroCardioDatado[];
  /** `null` = usuário roteado (registra, mas não recebe meta). */
  meta: MetaCardio | null;
  /**
   * 🔒 Minutos que o PLANO prescreve nesta semana (soma dos dias de cardio emitidos). É o
   * denominador do cartão (DF 2026-08-01): o app cobra o que ele deu, não a meta abstrata.
   * Ausente = sem dia de cardio emitido → cai na meta, como antes.
   */
  prescritoMin?: number;
  /** Chip da rampa, quando ativa — o MESMO das telas de treino (é o mesmo movimento). */
  retomada?: { semana: number; totalSemanas: number } | null;
  hojeISO: string;
  acumuladoMin: number;
  objetivo: 'emagrecimento' | 'massa' | 'saude';
  onRegistrar: () => void;
}) {
  const resumo = resumoCardioSemana(registros);
  const cumprida = metaCumprida(meta, resumo);
  const rotuloObjetivo = objetivo === 'massa' ? 'Ganho de massa' : objetivo === 'emagrecimento' ? 'Emagrecimento · 150–300 min' : 'Saúde · 150 min';

  return (
    <section aria-labelledby="evk-cardio-titulo" style={{ marginTop: 26, borderTop: '1px solid rgba(234,229,219,.08)', paddingTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ ...kicker, color: NEON, marginBottom: 6 }}>Cardio</div>
          <h2 id="evk-cardio-titulo" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-.02em' }}>Semana de {rotuloSemana(hojeISO)}</h2>
        </div>
        {retomada && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '.78rem', fontWeight: 700, color: NEON, background: 'rgba(22,163,74,.14)', border: '1px solid rgba(22,163,74,.42)', borderRadius: 999, padding: '7px 13px' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3l7.5 4v5c0 4.6-3.1 8-7.5 9-4.4-1-7.5-4.4-7.5-9V7L12 3z" stroke={NEON} strokeWidth={1.7} strokeLinejoin="round" /></svg>
            Retomada · semana {retomada.semana} de {retomada.totalSemanas}
          </span>
        )}
      </div>

      <div style={{ ...cardSoft, padding: '20px 22px', marginBottom: 16 }}>
        {meta == null ? (
          <>
            {/* 🔒 Gate ROTEAR: registra, mas não recebe meta — exibir meta a quem o gate
                excluiu seria orientação de exercício. */}
            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>Sem meta semanal por aqui</div>
            <p style={{ ...apoio, margin: 0 }}>Pelo que você respondeu no início, o volume de cardio é combinado com o profissional que acompanha você. O app continua sendo seu caderno de registro.</p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={kicker}>
                {cumprida ? 'Meta da semana cumprida' : meta.tipo === 'sessoes' ? 'Sessões da semana' : retomada ? 'Meta desta semana' : 'Meta da semana'}
              </span>
              <span style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.45)' }}>{rotuloObjetivo}</span>
            </div>
            {meta.tipo === 'sessoes'
              ? <BlocosSessoes feitas={resumo.sessoesNaMeta} meta={meta} />
              : <BarraMinutos feito={resumo.minutosNaMeta} meta={meta} prescrito={prescritoMin} />}
            {retomada && (
              <p style={{ ...apoio, margin: '12px 0 0' }}>
                Sua meta está menor porque você está voltando. Ela sobe junto com o treino e volta ao normal quando a retomada terminar.
              </p>
            )}
          </>
        )}
        <div style={{ marginTop: 18 }}>
          <button type="button" onClick={onRegistrar} className="hov-btn" style={{ background: NEON, color: '#0D2818', fontWeight: 700, fontSize: '.95rem', padding: '13px 22px', border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 44 }}>Registrar cardio</button>
        </div>
      </div>

      {resumo.contam.length > 0 && (
        <>
          <div style={{ ...kicker, marginBottom: 10 }}>Sessões desta semana</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {resumo.contam.map((r, i) => <LinhaSessao key={`c${i}`} r={r as RegistroCardioDatado} leve={false} />)}
          </div>
        </>
      )}

      {resumo.leves.length > 0 && (
        <>
          {/* 🔒 Atividade leve com DIGNIDADE: seção própria, mesmo tratamento de cartão,
              sem cinza-punição, sem "não contou", sem vermelho. */}
          <div style={{ ...kicker, marginBottom: 4 }}>Movimento registrado</div>
          {/* 🔒 Sem meta (gate ROTEAR) não há "minutos da meta" a mencionar: a frase viraria
              a única aparição da meta na tela de quem o gate excluiu dela. */}
          <p style={{ ...apoio, margin: '0 0 10px' }}>{meta == null ? 'Movimento registrado — fica guardado no seu histórico.' : 'Movimento registrado — não entra nos minutos da meta.'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {resumo.leves.map((r, i) => <LinhaSessao key={`l${i}`} r={r as RegistroCardioDatado} leve />)}
          </div>
        </>
      )}

      {registros.length === 0 && (
        <div style={{ ...cardSoft, padding: '20px 22px', marginBottom: 16 }}>
          {/* 🔒 A semana que terminou abaixo da meta NÃO é exibida: a semana nova recomeça
              em zero com este mesmo convite calmo. Nenhum placar do que não foi feito. */}
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 5 }}>Nenhum cardio nesta semana</div>
          <p style={{ ...apoio, margin: 0 }}>Caminhada, corrida, bike, corda ou luta. Uma sessão curta já entra na conta.</p>
          {acumuladoMin > 0 && (
            /* A continuidade vem do número que SÓ CRESCE. */
            <p style={{ ...apoio, margin: '12px 0 0' }}>
              <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{formatarAcumulado(acumuladoMin)} de cardio no total</strong> · Desde que você começou. Esse número só cresce.
            </p>
          )}
        </div>
      )}

      {/* 🟢 A trava central: a estimativa é informação, NUNCA orçamento. */}
      {/* 🔒 CLASSE 2 — a frase pressupõe um CARDÁPIO, que o modo diário não tem. Sai
          inteira; não se reescreve (não existe equivalente verdadeiro sem cardápio). */}
      {meta != null && <p style={{ ...apoio, margin: 0 }}>As calorias são estimativas do gasto extra do exercício. Elas ficam aqui como informação — não mudam o seu cardápio.</p>}
      <PorQueOAparelho />
    </section>
  );
}

/* ═════════════════ O registro ═════════════════ */

const ATALHOS_MIN = [15, 30, 45, 60] as const;

export default function RegistrarCardio({ pesoKg, onSalvar, onCancelar, modalidadeInicial, minutosInicial, embutido, nomeDoItem }: {
  pesoKg: number;
  onSalvar: (payload: { modalidade: ModalidadeCardio; intensidade: IntensidadeCardio; minutos: number; met: number; kcal: number }) => void;
  onCancelar: () => void;
  /** 🔒 Registro UNIFICADO: o item de cardio da rotina pré-preenche a modalidade. */
  modalidadeInicial?: ModalidadeCardio;
  /**
   * Duração sugerida do DIA DE CARDIO (meta ÷ dias, já arredondada pelo motor).
   * ⚠️ É só um valor INICIAL do campo — a pessoa edita, e o que vale é o que ela registra.
   * O app não afirma que ela fez os minutos que ele sugeriu.
   */
  minutosInicial?: number;
  /** Aberto de DENTRO da sessão guiada: salva e devolve o controle, sem tela de confirmação
   *  (a confirmação é da tela avulsa; aqui a sessão continua). */
  embutido?: boolean;
  /** Nome do item da rotina que abriu este registro (só no modo embutido). */
  nomeDoItem?: string;
}) {
  const [modalidade, setModalidade] = useState<ModalidadeCardio>(modalidadeInicial ?? 'caminhada');
  const opcoes = intensidadesDe(modalidade);
  const [intensidade, setIntensidade] = useState<IntensidadeCardio>('moderado');
  const [minutos, setMinutos] = useState(minutosInicial && minutosInicial > 0 ? minutosInicial : 30);
  const [salvo, setSalvo] = useState<null | { minutos: number; met: number; kcal: number; naMeta: number; intensidade: IntensidadeCardio; modalidade: ModalidadeCardio }>(null);

  // "Leve" some em pular corda — sem mensagem de erro. Se estava selecionada, cai em moderado.
  const intensidadeEfetiva = opcoes.includes(intensidade) ? intensidade : 'moderado';
  const met = metDe(modalidade, intensidadeEfetiva) ?? 0;
  const soDoisBaldes = opcoes.length === 2;

  function salvar() {
    const kcal = kcalLiquida(met, pesoKg, minutos);
    // 🔒 CAMINHO ÚNICO: tanto a tela avulsa quanto o item da rotina saem por aqui. Quem
    // grava é sempre o chamador, com `registrarCardio` — não há segunda fonte para divergir.
    onSalvar({ modalidade, intensidade: intensidadeEfetiva, minutos, met, kcal });
    if (embutido) return;   // a sessão guiada segue; a confirmação é da tela avulsa
    setSalvo({ minutos, met, kcal, naMeta: minutosNaMeta(met, minutos), intensidade: intensidadeEfetiva, modalidade });
  }

  if (salvo) {
    const dobra = classeDoMet(salvo.met) === 2;
    const conta = classeDoMet(salvo.met) > 0;
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 4px' }}>
        <div style={{ ...kicker, color: NEON, marginBottom: 8 }}>Cardio</div>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-.02em' }}>
          {ROTULO_MODALIDADE[salvo.modalidade]} de {salvo.minutos} min registrada
        </h1>
        <p style={{ ...apoio, margin: '0 0 20px' }}>{ROTULO_INTENSIDADE[salvo.intensidade]} · hoje</p>

        <div style={{ ...cardSoft, padding: '18px 20px', marginBottom: 14 }}>
          <div style={kicker}>{conta ? 'Na meta' : 'Movimento registrado'}</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: NEON, letterSpacing: '-.02em', margin: '6px 0 4px' }}>
            {conta ? `+${salvo.naMeta} min` : `${salvo.minutos} min`}
          </div>
          <p style={{ ...apoio, margin: 0 }}>
            {dobra
              /* 🔒 "Vigoroso vale o dobro" comunicado com UM exemplo só — o da própria
                 pessoa — e sem ensinar fórmula. */
              ? `Os seus ${salvo.minutos} min vigorosos contam como ${salvo.naMeta} na meta.`
              : conta
                ? 'Toda sessão entra, sem tempo mínimo.'
                : 'Movimento registrado — não entra nos minutos da meta.'}
          </p>
        </div>

        <div style={{ ...cardSoft, padding: '18px 20px', marginBottom: 14 }}>
          <div style={kicker}>Gasto</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-.02em', margin: '6px 0 2px' }}>{textoKcal(salvo.kcal)}</div>
          <div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.45)' }}>estimativa</div>
          <PorQueOAparelho />
        </div>

        {/* Registrar cardio acende o dia de treino na Chama, sem piso de duração. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(168deg, rgba(22,163,74,.11), rgba(15,15,14,.55))', border: '1px solid rgba(22,163,74,.28)', borderRadius: 16, padding: '14px 16px', marginBottom: 20 }}>
          <span aria-hidden style={{ width: 32, height: 32, minWidth: 32, borderRadius: 11, background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M12 3c1.5 3.4-1.2 4.6-1.2 7A3.2 3.2 0 0 0 14 13c1.6 0 2.6-1 2.8-2.2 1.4 1.5 2.2 3.3 2.2 5.2a7 7 0 1 1-14 0c0-4.7 3.4-8.3 7-13z" stroke={NEON} strokeWidth={1.6} strokeLinejoin="round" /></svg>
          </span>
          <div style={{ fontSize: '.92rem', fontWeight: 600 }}>Dia de treino acendido</div>
        </div>

        <button type="button" onClick={onCancelar} className="hov-btn" style={{ width: '100%', background: NEON, color: '#0D2818', fontWeight: 700, fontSize: '.98rem', padding: 15, border: 'none', borderRadius: 13, cursor: 'pointer', minHeight: 44 }}>Ver a semana</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ ...kicker, color: NEON, marginBottom: 6 }}>Cardio</div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-.02em' }}>Registrar cardio</h1>
          {nomeDoItem && <p style={{ ...apoio, margin: '6px 0 0' }}>{nomeDoItem} — confira e ajuste o que mudou.</p>}
        </div>
        <button type="button" onClick={onCancelar} className="evk-voltar" style={{ flexShrink: 0, background: 'none', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.75)', fontWeight: 600, fontSize: '.85rem', padding: '11px 16px', borderRadius: 10, cursor: 'pointer', minHeight: 44 }}>Cancelar</button>
      </div>

      <div style={{ ...kicker, marginBottom: 10 }}>Modalidade</div>
      <div role="radiogroup" aria-label="Modalidade" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {MODALIDADES_CARDIO.map((m) => {
          const on = m === modalidade;
          return (
            <button
              key={m} type="button" role="radio" aria-checked={on}
              onClick={() => setModalidade(m)}
              style={{ minHeight: 44, padding: '11px 16px', borderRadius: 999, cursor: 'pointer', fontSize: '.88rem', fontWeight: on ? 700 : 600, border: `1px solid ${on ? NEON : 'rgba(234,229,219,.16)'}`, background: on ? NEON : 'transparent', color: on ? '#0D2818' : 'rgba(234,229,219,.75)' }}
            >{ROTULO_MODALIDADE[m]}</button>
          );
        })}
      </div>
      {modalidade === 'outro' && (
        <p style={{ ...apoio, margin: '-14px 0 22px' }}>Em &quot;Outro&quot; usamos os valores da caminhada — é uma aproximação.</p>
      )}

      <div style={{ ...kicker, marginBottom: 4 }}>Intensidade</div>
      <p style={{ ...apoio, margin: '0 0 10px' }}>
        {soDoisBaldes
          ? 'Pular corda começa em moderado — escolha pela sua respiração.'
          : 'Escolha pela sua respiração durante o exercício.'}
      </p>
      <div role="radiogroup" aria-label="Intensidade" style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 10 }}>
        {opcoes.map((i) => {
          const on = i === intensidadeEfetiva;
          return (
            <button
              key={i} type="button" role="radio" aria-checked={on}
              onClick={() => setIntensidade(i)}
              style={{ textAlign: 'left', minHeight: 44, padding: '13px 16px', borderRadius: 13, cursor: 'pointer', border: `1px solid ${on ? NEON : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.1)' : 'transparent', color: '#EAE5DB' }}
            >
              <div style={{ fontWeight: 700, fontSize: '.95rem', color: on ? NEON : '#EAE5DB' }}>{ROTULO_INTENSIDADE[i]}</div>
              {/* A descrição do talk test É a intensidade na interface — o número técnico
                  nunca aparece, nem em tooltip. */}
              <div style={{ fontSize: '.83rem', color: 'rgba(234,229,219,.6)', marginTop: 2 }}>{DESCRICAO_INTENSIDADE[i]}</div>
            </button>
          );
        })}
      </div>
      <p style={{ ...apoio, margin: '0 0 22px' }}>Sessões vigorosas contam em dobro nos minutos da meta.</p>

      <div style={{ ...kicker, marginBottom: 10 }}>Duração</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 12 }}>
        <button type="button" aria-label="Diminuir 1 minuto" onClick={() => setMinutos((m) => Math.max(1, m - 1))}
          style={{ width: 46, height: 46, borderRadius: 12, border: '1px solid rgba(234,229,219,.18)', background: 'none', color: '#EAE5DB', fontSize: '1.3rem', cursor: 'pointer' }}>−</button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.02em' }}>{minutos}</span>
          <span style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.55)' }}>min</span>
        </div>
        <button type="button" aria-label="Aumentar 1 minuto" onClick={() => setMinutos((m) => Math.min(600, m + 1))}
          style={{ width: 46, height: 46, borderRadius: 12, border: '1px solid rgba(234,229,219,.18)', background: 'none', color: '#EAE5DB', fontSize: '1.3rem', cursor: 'pointer' }}>+</button>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 26 }}>
        {ATALHOS_MIN.map((v) => (
          <button key={v} type="button" onClick={() => setMinutos(v)}
            style={{ minHeight: 44, padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontSize: '.86rem', fontWeight: 600, border: `1px solid ${minutos === v ? NEON : 'rgba(234,229,219,.14)'}`, background: minutos === v ? 'rgba(189,255,0,.1)' : 'transparent', color: minutos === v ? NEON : 'rgba(234,229,219,.7)' }}>{v}</button>
        ))}
      </div>

      <button type="button" onClick={salvar} className="hov-btn" style={{ width: '100%', background: NEON, color: '#0D2818', fontWeight: 700, fontSize: '.98rem', padding: 15, border: 'none', borderRadius: 13, cursor: 'pointer', minHeight: 44 }}>{embutido ? 'Salvar e continuar' : 'Salvar registro'}</button>
    </div>
  );
}
