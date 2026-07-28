'use client';

import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react';
import {
  contarFrequencia, detalheDoGrupo, diasPassadosNaSemana, ESCALA_MAX, janelaSemana,
  janelaSemanasFechadas, LEGENDA_UM_DIA, mediaPorSemana, PADROES, REGIOES, reguaDoPadrao,
  ROTULO_GRUPO, ROTULO_PADRAO, ROTULO_REGUA, rotuloAcessivelLinha, rotuloContagem,
  type Janela, type SessaoParaFrequencia,
} from '@/lib/frequencia-grupos';
import type { Exercise } from '@/lib/data/types';
import type { Objetivo } from '@/lib/engine';

/**
 * Frequência por grupo muscular (Leva 2 · Bloco 2). Porte de
 * `design_handoff_frequencia/CLAUDE_CODE.md` (recuperado de
 * `raw/design-handoff-frequencia-por-grupo-2026-07-27.md` no cofre — o zip quebrou os nomes
 * acentuados e a pasta não apareceu na extração) + as 4 correções obrigatórias do cofre,
 * que MANDAM onde os dois discordam.
 *
 * 🔒 Tela SOMENTE LEITURA: espelho do que aconteceu, não uma nota. Não grava, não dispara,
 * não sugere. A régua é UMA só (≥2×/semana, do motor) — nenhuma faixa ideal, volume ótimo
 * ou meta de séries inventada. Ficar abaixo dela, ou em zero, NÃO é erro.
 *
 * 🔴 Onde o design e o cofre discordam, o cofre venceu (registrado em cada ponto):
 *   · §7.3 "grupo secundário conta" → o catálogo não tem campo secundário: só `grupoPrimario`;
 *   · §7.4 "4 semanas = 4 fechadas + a corrente" → correção 3: SEM a corrente;
 *   · §6.3/§10.2 "marcador sempre em 50%" → correção 1: com < 2 dias de força não há marcador;
 *   · §6.3 rótulo "2× de referência" → correção 4: "2× — referência dos padrões";
 *   · §7.6 "ler a contagem de padrões do motor" → o motor não expõe essa contagem; ela é
 *     agregada aqui do mesmo histórico, com a mesma régua.
 */

const NEON = '#BDFF00';
const FOLHA = '#16A34A';
const KEY_PERIODO = 'evk_freq_periodo';

const cardSoft: CSSProperties = { background: 'rgba(15,15,14,.45)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 20 };
const rotuloCartao: CSSProperties = { fontSize: '.64rem', fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: 'rgba(234,229,219,.45)' };
const apoio: CSSProperties = { fontSize: '.86rem', color: 'rgba(234,229,219,.58)', lineHeight: 1.55 };

type Periodo = 'semana' | 'quatro';

/* ── A linha de grupo: o único desenho novo da peça ───────────────────────── */

function LinhaGrupo({ nome, valor, marca, periodo, onAbrir }: {
  nome: string; valor: number; marca: number | null; periodo: Periodo; onAbrir: () => void;
}) {
  const emDia = marca != null && valor >= marca;
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={rotuloAcessivelLinha({ nome, valor, periodo, marca })}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 44,
        padding: '13px 0', background: 'none', border: 'none',
        borderBottom: '1px solid rgba(234,229,219,.055)', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ flex: '0 0 108px', fontSize: '.84rem', fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: emDia ? '#EAE5DB' : 'rgba(234,229,219,.5)' }}>{nome}</span>
      {/* Barra e marcador são DECORATIVOS — o número já está no rótulo acessível. */}
      <span aria-hidden="true" style={{ position: 'relative', flex: 1, minWidth: 0, height: 7, borderRadius: 4, background: 'rgba(234,229,219,.075)' }}>
        <span className="evk-freq-barra" style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, (valor / ESCALA_MAX) * 100)}%`, borderRadius: 4, background: emDia ? FOLHA : 'rgba(234,229,219,.22)' }} />
        {/* 🔴 Correção 1: o marcador só existe quando há régua. Quando existe, ele fica
            SEMPRE em 50% (escala fixa 0–4×) — é assim que ele vira aprendível. */}
        {marca != null && (
          <span style={{ position: 'absolute', top: -4, left: `${(marca / ESCALA_MAX) * 100}%`, marginLeft: -1, width: 2, height: 15, borderRadius: 1, background: 'rgba(234,229,219,.34)' }} />
        )}
      </span>
      <span style={{ flex: '0 0 46px', textAlign: 'right', fontSize: '.86rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: emDia ? '#EAE5DB' : 'rgba(234,229,219,.4)' }}>{rotuloContagem(valor)}</span>
    </button>
  );
}

/* ── Os 7 padrões, compactos (não tocáveis nesta versão) ──────────────────── */

function CelulaPadrao({ rotulo, valor, marca }: { rotulo: string; valor: number; marca: number | null }) {
  const emDia = marca != null && valor >= marca;
  const cor = emDia ? FOLHA : 'rgba(234,229,219,.3)';
  const pip = (aceso: boolean): CSSProperties => ({ width: 13, height: 3, borderRadius: 2, background: aceso ? cor : 'rgba(234,229,219,.1)' });
  return (
    <li style={{ listStyle: 'none', padding: '11px 12px', borderRadius: 12, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.08)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-.025em', color: emDia ? '#EAE5DB' : 'rgba(234,229,219,.4)' }}>{rotuloContagem(valor)}</span>
      {/* Os dois pips SÃO a régua: dois acesos = padrão em 2× ou mais. */}
      <span aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
        <span style={pip(marca != null && valor >= 1)} /><span style={pip(marca != null && valor >= 2)} />
      </span>
      <span style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(234,229,219,.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{rotulo}</span>
    </li>
  );
}

/* ── Detalhe do grupo (tela própria, push — não modal) ────────────────────── */

function DetalheGrupoTela({ grupo, janela, sessoes, exercicioPorId, marca, onVoltar }: {
  grupo: string; janela: Janela; sessoes: readonly SessaoParaFrequencia[];
  exercicioPorId: (id: string) => Exercise | undefined; marca: number | null; onVoltar: () => void;
}) {
  const d = detalheDoGrupo(sessoes, janela, grupo, exercicioPorId);
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const emDia = marca != null && d.vezes >= marca;
  return (
    <section aria-labelledby="evk-freq-detalhe" style={{ ...cardSoft, padding: '20px 22px', marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button type="button" onClick={onVoltar} aria-label="Voltar" style={{ width: 44, height: 44, minWidth: 44, borderRadius: 11, border: '1px solid rgba(234,229,219,.16)', background: 'none', color: '#EAE5DB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div>
          <h3 id="evk-freq-detalhe" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-.02em' }}>{ROTULO_GRUPO[grupo] ?? grupo}</h3>
          <div style={{ fontSize: '.76rem', fontWeight: 600, color: 'rgba(234,229,219,.5)' }}>{dm(janela.inicioISO)} a {dm(janela.fimISO)}</div>
        </div>
      </div>

      <div style={{ background: 'linear-gradient(165deg, rgba(22,163,74,.12), rgba(15,15,14,.55))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1 }}>{rotuloContagem(d.vezes)}</span>
          <span style={{ fontSize: '.95rem', fontWeight: 600, color: 'rgba(234,229,219,.62)' }}>neste período</span>
        </div>
        <span aria-hidden="true" style={{ position: 'relative', display: 'block', height: 7, borderRadius: 4, background: 'rgba(234,229,219,.075)' }}>
          <span className="evk-freq-barra" style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, (d.vezes / ESCALA_MAX) * 100)}%`, borderRadius: 4, background: emDia ? FOLHA : 'rgba(234,229,219,.22)' }} />
          {marca != null && <span style={{ position: 'absolute', top: -4, left: '50%', marginLeft: -1, width: 2, height: 15, borderRadius: 1, background: 'rgba(234,229,219,.34)' }} />}
        </span>
        {marca != null && d.padroes.length > 0 && (
          <p style={{ ...apoio, margin: '12px 0 0' }}>
            A marca é a referência do motor: ao menos {marca}× por semana para o padrão de {(ROTULO_PADRAO[d.padroes[0]!] ?? d.padroes[0]!).toLowerCase()}.
          </p>
        )}
      </div>

      {d.dias.length > 0 ? (
        <>
          <div style={{ ...rotuloCartao, marginBottom: 10 }}>Nos dias</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {d.dias.map((dia) => (
              <div key={dia.dataISO} style={{ display: 'flex', gap: 14, background: 'rgba(234,229,219,.03)', borderRadius: 14, padding: '13px 15px' }}>
                <div style={{ flex: '0 0 46px' }}>
                  <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.06em', color: FOLHA }}>{dia.sigla}</div>
                  <div style={{ fontSize: '.92rem', fontWeight: 800 }}>{dia.dia}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '.86rem', fontWeight: 700, marginBottom: 6 }}>{dia.treino}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {dia.exercicios.map((n) => (
                      <span key={n} style={{ fontSize: '.76rem', color: 'rgba(234,229,219,.72)', background: 'rgba(234,229,219,.06)', borderRadius: 7, padding: '4px 9px' }}>{n}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {d.padroes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={rotuloCartao}>Padrão de movimento</span>
              {d.padroes.map((p) => (
                <span key={p} style={{ fontSize: '.78rem', fontWeight: 600, color: 'rgba(234,229,219,.8)', background: 'rgba(234,229,219,.06)', borderRadius: 8, padding: '5px 11px' }}>{ROTULO_PADRAO[p] ?? p}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        /* 🔒 Linha em 0× abre normalmente — nunca desabilitada. */
        <p style={{ ...apoio, margin: '0 0 14px' }}>Sem registro neste período.</p>
      )}
      <p style={{ ...apoio, margin: 0 }}>As regras adaptativas equilibram os padrões ao longo do ciclo — nada aqui pede uma correção sua.</p>
    </section>
  );
}

/* ── A visão ──────────────────────────────────────────────────────────────── */

export default function FrequenciaGrupos({ sessoes, exercicioPorId, hojeISO, diasForca, objetivo, retomadaAtiva, onVerTreino }: {
  sessoes: readonly SessaoParaFrequencia[];
  exercicioPorId: (id: string) => Exercise | undefined;
  hojeISO: string;
  /** Dias de FORÇA agendados — a condicional da régua (correção 1). */
  diasForca: number;
  objetivo: Objetivo;
  retomadaAtiva?: boolean;
  onVerTreino?: () => void;
}) {
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);
  // Preferência de período lembrada (só UI local — nada de servidor nesta tela).
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY_PERIODO);
      if (v === 'semana' || v === 'quatro') setPeriodo(v);
    } catch { /* storage indisponível */ }
  }, []);
  function trocarPeriodo(p: Periodo) {
    setPeriodo(p);
    setGrupoAberto(null);
    try { window.localStorage.setItem(KEY_PERIODO, p); } catch { /* noop */ }
  }

  const quatro = periodo === 'quatro';
  const janela: Janela = quatro ? janelaSemanasFechadas(hojeISO) : janelaSemana(hojeISO);
  const c = contarFrequencia(sessoes, janela, exercicioPorId);
  const valor = (n: number) => (quatro ? mediaPorSemana(n, 4) : n);
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const diasPassados = diasPassadosNaSemana(hojeISO);
  const parcial = !quatro && diasPassados < 7;

  // 🔴 Correção 1: sem ≥ 2 dias de força não há marcador em padrão de força nenhum.
  // 🔴 Correção 2: o cardio tem régua própria, que não depende dos dias de força.
  const marcaDe = (padraoOuGrupo: string) => {
    const r = reguaDoPadrao({ padrao: padraoOuGrupo, diasForca, objetivo, retomadaAtiva });
    return r?.tipo === 'vezes' ? r.valor : null;
  };
  const marcaForca = marcaDe('empurrar');

  if (grupoAberto) {
    return (
      <DetalheGrupoTela
        grupo={grupoAberto} janela={janela} sessoes={sessoes} exercicioPorId={exercicioPorId}
        marca={marcaForca}
        onVoltar={() => setGrupoAberto(null)}
      />
    );
  }

  const tab = (id: Periodo, label: string) => {
    const on = periodo === id;
    // §9 — ← → navegam entre os tabs. Com dois, ambas as setas alternam; o FOCO acompanha
    // (senão a seta seguinte dispara a partir do botão antigo e a navegação trava num lado).
    const teclado = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const outro: Periodo = periodo === 'semana' ? 'quatro' : 'semana';
      trocarPeriodo(outro);
      requestAnimationFrame(() => document.getElementById(`evk-freq-tab-${outro}`)?.focus());
    };
    return (
      <button
        key={id} type="button" role="tab" id={`evk-freq-tab-${id}`} aria-selected={on}
        aria-controls="evk-freq-painel" tabIndex={on ? 0 : -1}
        onClick={() => trocarPeriodo(id)} onKeyDown={teclado}
        style={{ minHeight: 44, padding: '9px 16px', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', border: `1px solid ${on ? NEON : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.1)' : 'rgba(234,229,219,.03)', color: on ? NEON : 'rgba(234,229,219,.62)' }}
      >{label}</button>
    );
  };

  return (
    <section aria-labelledby="evk-freq-titulo" style={{ ...cardSoft, padding: '22px 24px', marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h3 id="evk-freq-titulo" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-.025em' }}>Frequência</h3>
          <div style={{ fontSize: '.76rem', fontWeight: 600, color: 'rgba(234,229,219,.5)', marginTop: 4 }}>{dm(janela.inicioISO)} a {dm(janela.fimISO)}</div>
        </div>
        <div role="tablist" aria-label="Período" style={{ display: 'flex', gap: 8 }}>
          {tab('semana', 'Semana')}{tab('quatro', '4 semanas')}
        </div>
      </div>

      <div role="tabpanel" id="evk-freq-painel" aria-labelledby={`evk-freq-tab-${periodo}`}>
        {c.sessoes === 0 ? (
          <>
            {/* §6.8 — estado vazio: acolhedor, mostra o que vai aparecer, e não cobra nada. */}
            <div style={{ background: 'rgba(15,15,14,.42)', border: '1px dashed rgba(234,229,219,.16)', borderRadius: 20, padding: '26px 20px', textAlign: 'center', marginBottom: 16 }}>
              <svg width={34} height={34} viewBox="0 0 24 24" fill="none" aria-hidden style={{ opacity: 0.45, marginBottom: 10 }}>
                <path d="M4 7h16M4 12h11M4 17h7" stroke="#EAE5DB" strokeWidth={1.7} strokeLinecap="round" />
              </svg>
              <div style={{ fontSize: '1.04rem', fontWeight: 700, marginBottom: 6 }}>Nada registrado neste período</div>
              <p style={{ ...apoio, margin: '0 auto', maxWidth: 270 }}>
                Quando você registrar um treino, cada grupo trabalhado aparece aqui com a sua contagem.
                {/* 🟡 O caso do registro manual livre (pedido do cofre): a Chama conta o dia,
                    esta tela não — e é justamente esta a tela que explica a diferença. */}
                {c.semGrupo > 0 && ' Um treino registrado à mão, com exercícios fora da biblioteca, entra na sua chama como dia treinado, mas não tem grupo para somar aqui.'}
              </p>
            </div>
            <div style={{ ...rotuloCartao, marginBottom: 2 }}>Como vai ficar</div>
            <div aria-hidden="true" style={{ opacity: 0.5, pointerEvents: 'none', marginBottom: 16 }}>
              {REGIOES[0]!.grupos.slice(0, 4).map((g) => (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid rgba(234,229,219,.055)' }}>
                  <span style={{ flex: '0 0 108px', fontSize: '.84rem', fontWeight: 600, color: 'rgba(234,229,219,.5)' }}>{ROTULO_GRUPO[g]}</span>
                  <span style={{ position: 'relative', flex: 1, minWidth: 0, height: 7, borderRadius: 4, background: 'rgba(234,229,219,.075)' }}>
                    {marcaForca != null && <span style={{ position: 'absolute', top: -4, left: '50%', marginLeft: -1, width: 2, height: 15, borderRadius: 1, background: 'rgba(234,229,219,.34)' }} />}
                  </span>
                  <span style={{ flex: '0 0 46px', textAlign: 'right', fontSize: '.86rem', fontWeight: 700, color: 'rgba(234,229,219,.4)' }}>—</span>
                </div>
              ))}
            </div>
            {onVerTreino && (
              <button type="button" onClick={onVerTreino} className="hov-btn" style={{ background: NEON, color: '#0D2818', fontWeight: 700, fontSize: '.92rem', padding: '12px 20px', border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 44, marginBottom: 14 }}>Ver o treino de hoje</button>
            )}
            <p style={{ ...apoio, margin: 0 }}>Um período sem registro não é um problema — é só um período sem registro.</p>
          </>
        ) : (
          <>
            <p style={{ ...apoio, margin: '0 0 14px' }}>
              {quatro
                ? <><strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{c.sessoes} treinos</strong> em 4 semanas. Os números abaixo são a <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>média por semana</strong>.</>
                : <>Quantas vezes cada grupo entrou nos seus <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{c.sessoes} treino{c.sessoes === 1 ? '' : 's'}</strong> desta semana.</>}
            </p>

            {/* §6.5 — a nota da distinção com a Chama. O glifo é Bone (nunca Pulso/Folha):
                não é um segundo indicador, é um ícone de referência. */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, background: 'rgba(234,229,219,.035)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden style={{ opacity: 0.5, flexShrink: 0, marginTop: 2 }}>
                <path d="M12 3c1.5 3.4-1.2 4.6-1.2 7A3.2 3.2 0 0 0 14 13c1.6 0 2.6-1 2.8-2.2 1.4 1.5 2.2 3.3 2.2 5.2a7 7 0 1 1-14 0c0-4.7 3.4-8.3 7-13z" stroke="#EAE5DB" strokeWidth={1.6} strokeLinejoin="round" />
              </svg>
              <p style={{ ...apoio, margin: 0 }}>A chama conta <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>dias</strong> treinados. Aqui a conta é por <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>grupo</strong> — são duas leituras diferentes.</p>
            </div>

            {/* §6.7 — meio de semana: leitura honesta, sem projeção e sem cobrança. */}
            {parcial && (
              <div style={{ background: 'linear-gradient(165deg, rgba(22,163,74,.1), rgba(15,15,14,.5))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: '14px 15px', marginBottom: 16 }}>
                <span aria-hidden="true" style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} style={{ width: 7, height: 22, borderRadius: 2, background: i < diasPassados ? FOLHA : 'rgba(234,229,219,.14)' }} />
                  ))}
                </span>
                <p style={{ margin: 0, fontSize: '.83rem', lineHeight: 1.55, color: 'rgba(234,229,219,.68)' }}>
                  <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{diasPassados} de 7 dias</strong> desta semana já passaram. A contagem abaixo ainda vai crescer.
                </p>
              </div>
            )}

            {/* §6.4 — os 7 padrões, sempre visíveis, não tocáveis nesta versão. */}
            <div style={{ ...rotuloCartao, marginBottom: 8 }}>
              Padrões de movimento{quatro ? ' · média por semana' : parcial ? ' · até aqui' : ''}
            </div>
            <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, margin: '0 0 10px', padding: 0 }}>
              {PADROES.map((p) => <CelulaPadrao key={p} rotulo={ROTULO_PADRAO[p]!} valor={valor(c.porPadrao[p] ?? 0)} marca={marcaDe(p)} />)}
            </ul>
            <p style={{ ...apoio, margin: '0 0 20px' }}>
              {/* 🔴 Correção 1: com 1 dia de força, 1× é o ESPERADO — não uma falta. */}
              {marcaForca == null
                ? `${LEGENDA_UM_DIA.charAt(0).toUpperCase()}${LEGENDA_UM_DIA.slice(1)}.`
                : quatro
                  ? `A mesma referência de ${marcaForca}× por semana, agora na média das 4. As duas marquinhas mostram isso.`
                  : parcial
                    ? `A referência de ${marcaForca}× vale pela semana inteira — ela só fecha domingo.`
                    : `Referência do motor: cada padrão ao menos ${marcaForca}× por semana. As duas marquinhas mostram isso.`}
              {/* 🔴 Correção 2: dito em texto, para as duas telas da leva não discordarem. */}
              {' '}O cardio tem referência própria — ela vive na aba Treino, junto do registro de cardio.
            </p>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={rotuloCartao}>Por grupo{quatro ? ' · média/semana' : ' muscular'}</span>
              {/* 🔴 Correção 4: o rótulo atribui a régua ao PADRÃO, não ao grupo. */}
              {marcaForca != null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '.68rem', fontWeight: 600, color: 'rgba(234,229,219,.45)' }}>
                  <span aria-hidden="true" style={{ width: 2, height: 11, borderRadius: 1, background: 'rgba(234,229,219,.34)' }} />
                  {ROTULO_REGUA}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: '0 34px' }}>
              {REGIOES.map((r) => (
                <div key={r.titulo}>
                  <h4 style={{ margin: 0, fontSize: '.6rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(234,229,219,.3)', padding: '12px 0 4px' }}>{r.titulo}</h4>
                  {/* 🔒 Grupos em ZERO continuam na lista, na mesma posição, com "0×". */}
                  {r.grupos.map((g) => (
                    <LinhaGrupo
                      key={g} nome={ROTULO_GRUPO[g]!} valor={valor(c.porGrupo[g] ?? 0)}
                      marca={marcaForca}
                      periodo={periodo} onAbrir={() => setGrupoAberto(g)}
                    />
                  ))}
                </div>
              ))}
            </div>
            <p style={{ ...apoio, margin: '12px 0 0' }}>
              {quatro
                ? 'Média com uma casa decimal: 2,5× quer dizer dez vezes em quatro semanas.'
                : parcial
                  ? 'Leitura de meio de semana: o que está em 1× hoje pode fechar em 2× ou mais.'
                  : 'Toque num grupo para ver em que dias ele entrou.'}
            </p>

            {/* §6.11 — legenda "Como ler" (obrigatória no desktop; inofensiva no telefone). */}
            <div style={{ ...cardSoft, padding: '14px 16px', marginTop: 16 }}>
              <div style={{ ...rotuloCartao, marginBottom: 10 }}>Como ler</div>
              {[
                { amostra: FOLHA, texto: `Em ${marcaForca ?? 2}× ou mais na semana` },
                { amostra: 'rgba(234,229,219,.22)', texto: 'Abaixo da referência — não é erro' },
                { amostra: 'rgba(234,229,219,.075)', texto: 'Sem registro no período' },
              ].map((l) => (
                <div key={l.texto} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                  <span aria-hidden="true" style={{ width: 34, height: 6, borderRadius: 3, background: l.amostra, flexShrink: 0 }} />
                  <span style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.6)' }}>{l.texto}</span>
                </div>
              ))}
              {marcaForca != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                  <span aria-hidden="true" style={{ width: 34, display: 'flex', justifyContent: 'center', flexShrink: 0 }}><span style={{ width: 2, height: 14, borderRadius: 1, background: 'rgba(234,229,219,.34)' }} /></span>
                  <span style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.6)' }}>A marca de {marcaForca}×, sempre no mesmo ponto</span>
                </div>
              )}
            </div>

            <p style={{ ...apoio, margin: '14px 0 0' }}>
              {/* 🔴 Correção 4 (a linha que acompanha o rótulo). */}
              A marca é a referência dos <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>padrões</strong>, não de cada músculo: grupos acessórios costumam ficar abaixo dela sem que isso seja problema.
              {c.semGrupo > 0 && ' Treinos registrados à mão, com exercícios fora da biblioteca, contam na sua chama mas não têm grupo para somar aqui.'}
            </p>
            <p style={{ ...apoio, margin: '10px 0 0' }}>
              É um espelho do que aconteceu, não uma nota. As regras adaptativas distribuem os padrões ao longo do ciclo — você não precisa ajustar nada aqui.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
