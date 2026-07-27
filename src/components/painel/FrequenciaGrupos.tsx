'use client';

import { useState, type CSSProperties } from 'react';
import {
  contarFrequencia, ESCALA_MAX, janelaSemana, janelaSemanasFechadas, LEGENDA_UM_DIA,
  mediaPorSemana, PADROES, REGIOES, reguaDoPadrao, ROTULO_GRUPO, ROTULO_PADRAO, ROTULO_REGUA,
  rotuloContagem, type Janela, type SessaoParaFrequencia,
} from '@/lib/frequencia-grupos';
import type { Exercise } from '@/lib/data/types';
import type { Objetivo } from '@/lib/engine';

/**
 * Frequência por grupo muscular (Leva 2 · Bloco 2; porte de
 * `Evokorpus Frequência por Grupo.dc.html`, 6 telas, aba Progresso).
 *
 * 🔒 Tela SOMENTE LEITURA: é um espelho do que aconteceu, não uma nota. As regras
 * adaptativas distribuem os padrões ao longo do ciclo — não há nada a corrigir aqui.
 *
 * 🔴 As 4 correções obrigatórias do cofre (todas em `lib/frequencia-grupos`, com teste):
 *   1. sem marcador nem esmaecimento quando há < 2 dias de força agendados;
 *   2. o padrão `cardio` usa o alvo do objetivo, nunca o 2×;
 *   3. "4 semanas" = as 4 últimas FECHADAS, sem a corrente;
 *   4. o rótulo atribui a régua ao PADRÃO ("2× — referência dos padrões").
 *
 * Vocabulário proibido nesta peça (guard-rail estático): meta · ideal · ótimo ·
 * negligenciado · ranking · score. Ficar abaixo da marca não é erro.
 */

const NEON = '#BDFF00';
const FOLHA = '#16A34A';
const cardSoft: CSSProperties = { background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18 };
const kicker: CSSProperties = { fontSize: '.72rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)' };
const apoio: CSSProperties = { fontSize: '.86rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.55 };

type Periodo = 'semana' | 'quatro';

function Barra({ valor, marca }: { valor: number; marca: number | null }) {
  const pct = Math.min(100, (valor / ESCALA_MAX) * 100);
  const emDia = marca != null && valor >= marca;
  return (
    <div style={{ position: 'relative', height: 9, borderRadius: 999, background: 'rgba(234,229,219,.07)', overflow: 'visible' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: emDia ? FOLHA : 'rgba(234,229,219,.28)', transition: 'width .5s ease' }} />
      {/* 🔴 A marca só existe quando há régua — com 1 dia de força ela NÃO é renderizada. */}
      {marca != null && (
        <span aria-hidden style={{ position: 'absolute', top: -3, left: `${(marca / ESCALA_MAX) * 100}%`, width: 2, height: 15, borderRadius: 1, background: 'rgba(234,229,219,.45)' }} />
      )}
    </div>
  );
}

function Linha({ nome, valor, marca }: { nome: string; valor: number; marca: number | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(88px,1fr) 2.2fr auto', alignItems: 'center', gap: 12, padding: '7px 0' }}>
      <span style={{ fontSize: '.88rem', color: 'rgba(234,229,219,.82)' }}>{nome}</span>
      <Barra valor={valor} marca={marca} />
      <span style={{ fontSize: '.85rem', fontWeight: 600, color: valor > 0 ? '#EAE5DB' : 'rgba(234,229,219,.35)', minWidth: 40, textAlign: 'right' }}>
        {rotuloContagem(valor)}
      </span>
    </div>
  );
}

export default function FrequenciaGrupos({ sessoes, exercicioPorId, hojeISO, diasForca, objetivo, retomadaAtiva }: {
  sessoes: readonly SessaoParaFrequencia[];
  exercicioPorId: (id: string) => Exercise | undefined;
  hojeISO: string;
  /** Dias de FORÇA agendados — a condicional da régua (correção 1). */
  diasForca: number;
  objetivo: Objetivo;
  retomadaAtiva?: boolean;
}) {
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const quatro = periodo === 'quatro';
  const janela: Janela = quatro ? janelaSemanasFechadas(hojeISO) : janelaSemana(hojeISO);
  const c = contarFrequencia(sessoes, janela, exercicioPorId);
  const divisor = quatro ? 4 : 1;
  const valor = (n: number) => (quatro ? mediaPorSemana(n, divisor) : n);
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  // 🔴 Correção 1: sem ≥ 2 dias de força não há marcador em padrão nenhum (exceto cardio,
  // que tem régua própria — correção 2).
  const reguaForca = reguaDoPadrao({ padrao: 'empurrar', diasForca, objetivo });
  const marcaForca = reguaForca?.tipo === 'vezes' ? reguaForca.valor : null;
  const marcaDe = (padraoOuGrupo: string) => {
    const r = reguaDoPadrao({ padrao: padraoOuGrupo, diasForca, objetivo, retomadaAtiva });
    return r?.tipo === 'vezes' ? r.valor : null;
  };

  const botaoPeriodo = (id: Periodo, label: string) => {
    const on = periodo === id;
    return (
      <button
        key={id} type="button" role="tab" aria-selected={on} onClick={() => setPeriodo(id)}
        style={{ minHeight: 44, padding: '9px 16px', borderRadius: 11, cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', border: `1px solid ${on ? NEON : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.1)' : 'rgba(234,229,219,.03)', color: on ? NEON : 'rgba(234,229,219,.62)' }}
      >{label}</button>
    );
  };

  return (
    <section aria-labelledby="evk-freq-titulo" style={{ ...cardSoft, padding: '22px 24px', marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <div style={{ ...kicker, color: NEON, marginBottom: 6 }}>Frequência</div>
          <h3 id="evk-freq-titulo" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-.02em' }}>
            {dm(janela.inicioISO)} a {dm(janela.fimISO)}
          </h3>
        </div>
        <div role="tablist" aria-label="Período" style={{ display: 'flex', gap: 8 }}>
          {botaoPeriodo('semana', 'Semana')}{botaoPeriodo('quatro', '4 semanas')}
        </div>
      </div>

      {c.sessoes === 0 ? (
        <>
          {/* Estado vazio ACOLHEDOR: mostra o que vai aparecer, e não cobra nada. */}
          <p style={{ ...apoio, margin: '10px 0 4px' }}>
            <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>Nada registrado neste período</strong>
          </p>
          <p style={{ ...apoio, margin: '0 0 14px' }}>
            Quando você registrar um treino, cada grupo trabalhado aparece aqui com a sua contagem.
            {/* 🟡 O caso do registro manual livre: a Chama conta o dia, esta tela não —
                e é justamente esta a tela que existe para explicar a diferença. */}
            {c.semGrupo > 0 && ' Um treino registrado à mão, com exercícios fora da biblioteca, entra na sua chama como dia treinado, mas não tem grupo para somar aqui.'}
          </p>
          <div aria-hidden style={{ opacity: 0.35 }}>
            {REGIOES[0]!.grupos.slice(0, 4).map((g) => <Linha key={g} nome={ROTULO_GRUPO[g]!} valor={0} marca={null} />)}
          </div>
          <p style={{ ...apoio, margin: '14px 0 0' }}>Um período sem registro não é um problema — é só um período sem registro.</p>
        </>
      ) : (
        <>
          <p style={{ ...apoio, margin: '10px 0 18px' }}>
            {quatro
              ? <>Quantas vezes cada grupo entrou nos seus <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{c.sessoes} treinos</strong> em 4 semanas. Os números são a <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>média por semana</strong>.</>
              : <>Quantas vezes cada grupo entrou nos seus <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>{c.sessoes} treino{c.sessoes === 1 ? '' : 's'}</strong> desta semana.</>}
            {' '}A chama conta <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>dias</strong> treinados. Aqui a conta é por <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>grupo</strong> — são duas leituras diferentes.
          </p>

          <div style={{ ...kicker, marginBottom: 8 }}>Padrões de movimento{quatro ? ' · média por semana' : ''}</div>
          <div style={{ marginBottom: 8 }}>
            {PADROES.map((p) => <Linha key={p} nome={ROTULO_PADRAO[p]!} valor={valor(c.porPadrao[p] ?? 0)} marca={marcaDe(p)} />)}
          </div>
          <p style={{ ...apoio, margin: '0 0 20px' }}>
            {/* 🔴 Correção 1: a legenda muda quando o plano tem 1 dia de força — 1× ali é o
                ESPERADO, não uma falta. */}
            {marcaForca == null
              ? LEGENDA_UM_DIA.charAt(0).toUpperCase() + LEGENDA_UM_DIA.slice(1) + '.'
              : `Referência do motor: cada padrão ao menos ${marcaForca}× por semana${quatro ? ', agora na média das 4' : ''}.`}
            {/* 🔴 Correção 2: dito em texto, para as duas telas da leva não discordarem. */}
            {' '}O cardio tem referência própria — ela vive na aba Treino, junto do registro de cardio.
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={kicker}>Por grupo muscular{quatro ? ' · média/semana' : ''}</span>
            {/* 🔴 Correção 4: o rótulo atribui a régua ao PADRÃO, não ao grupo. */}
            {marcaForca != null && <span style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.45)' }}>{ROTULO_REGUA}</span>}
          </div>
          {REGIOES.map((r) => (
            <div key={r.titulo} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '.68rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.32)', margin: '8px 0 2px' }}>{r.titulo}</div>
              {/* 🔒 Grupos em ZERO continuam na lista, na mesma posição, com "0×". */}
              {r.grupos.map((g) => <Linha key={g} nome={ROTULO_GRUPO[g]!} valor={valor(c.porGrupo[g] ?? 0)} marca={g === 'cardio' ? marcaDe('cardio') : marcaForca} />)}
            </div>
          ))}
          <p style={{ ...apoio, margin: '12px 0 0' }}>
            {/* 🔴 Correção 4 (a linha que acompanha o rótulo): ficar abaixo da marca em
                grupo acessório é plano correto, não erro. */}
            A marca é a referência dos <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>padrões</strong>, não de cada músculo: grupos acessórios costumam ficar abaixo dela sem que isso seja problema.
            {c.semGrupo > 0 && ' Treinos registrados à mão, com exercícios fora da biblioteca, contam na sua chama mas não têm grupo para somar aqui.'}
          </p>
          <p style={{ ...apoio, margin: '10px 0 0' }}>
            É um espelho do que aconteceu, não uma nota. As regras adaptativas distribuem os padrões ao longo do ciclo — você não precisa ajustar nada aqui.
          </p>
        </>
      )}
    </section>
  );
}
