'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import type { Proposta } from '@/lib/proposta-treino';
import { seriesDoSlot } from '@/lib/series-treino';
import { ROTULO_GRUPO } from '@/lib/frequencia-grupos';
import { DIA_LABEL, ORDEM_SEMANA, type Weekday } from '@/lib/semana';

/**
 * 🔁 A PRÉVIA DA PROPOSTA — o que vai entrar no lugar do treino atual, ANTES de qualquer
 * gravação.
 *
 * 🔒 As travas desta tela:
 *  · nada é aplicado sem o toque explícito em "Aplicar"; "Manter o meu" fecha e não escreve
 *    coisa nenhuma — nem perfil, nem desenho, nem histórico;
 *  · a substituição de um DESENHO MANUAL por um plano automático é dita com todas as letras.
 *    Trocar a origem do treino em silêncio seria tirar da pessoa o controle que ela exerceu;
 *  · quando a montagem proposta é igual à atual, a tela DIZ isso — não encena novidade;
 *  · o que é preservado (histórico, registros, progresso e fase do ciclo) é afirmado, porque
 *    é exatamente o que costuma travar a decisão.
 *
 * A prévia mostra o plano REAL que o perfil proposto gera (mesmo motor do salvamento), nunca
 * uma estimativa paralela.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

const btnGhost: CSSProperties = {
  background: 'none', border: '1px solid rgba(234,229,219,.25)', color: '#EAE5DB',
  fontWeight: 600, fontSize: '.92rem', padding: '12px 16px', borderRadius: 12,
  cursor: 'pointer', minHeight: 44,
};
const rotulo: CSSProperties = {
  fontSize: '.68rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'rgba(234,229,219,.55)',
};
const nota: CSSProperties = { fontSize: '.84rem', lineHeight: 1.6, color: 'rgba(234,229,219,.72)' };

/**
 * 🔒 "Nada a mudar" só quando NADA muda — nem o plano exibido, nem o desenho salvo.
 *
 * 🔴 Defeito medido no QA de 16/09: banir um exercício do desenho manual não muda o plano na
 * tela (o motor já o descartava da geração), mas ele continua guardado no perfil. Olhando só
 * a rotina renderizada, a tela dizia "nada a atualizar" com algo a atualizar.
 */
function nadaMuda(p: Proposta): boolean {
  return p.mudancas.identica && !p.desenhoAlterado.mudou;
}

/** O título e a explicação mudam com a AÇÃO e com o que ela realmente faz. */
function cabecalho(p: Proposta, nomeDoExercicio: (id: string) => string): { titulo: string; resumo: string } {
  if (p.tipo === 'atualizar') {
    if (nadaMuda(p)) {
      return {
        titulo: 'Nada a atualizar',
        resumo: p.origemAntes === 'automatico'
          ? 'Seu treino é montado pelo app e já segue as suas preferências atuais.'
          : 'Todos os exercícios do seu treino continuam válidos com as suas preferências atuais.',
      };
    }
    if (p.mudancas.identica) {
      const nomes = p.desenhoAlterado.idsRemovidos.map(nomeDoExercicio);
      return {
        titulo: 'Atualizar o seu treino',
        resumo: nomes.length > 0
          ? `O plano na tela continua igual — o app já deixava de fora o que as suas preferências não permitem. O que muda é o seu treino salvo: ${nomes.join(', ')} ${nomes.length === 1 ? 'sai' : 'saem'} dele de vez.`
          : 'O plano na tela continua igual. O que muda é o seu treino salvo, que passa a refletir as suas preferências atuais.',
      };
    }
    return {
      titulo: 'Atualizar o seu treino',
      resumo: 'Mantivemos o que continua compatível com as suas preferências e ajustamos só o que deixou de caber.',
    };
  }
  if (p.variedade === 'sem_alternativa' && nadaMuda(p)) {
    return {
      titulo: 'Sem uma montagem diferente desta',
      resumo: `Testamos ${p.tentativas} ${p.tentativas === 1 ? 'montagem' : 'montagens'} e, com o seu equipamento, nível e restrições atuais, o catálogo não oferece uma semana diferente da que você já tem. Nada foi alterado.`,
    };
  }
  return {
    titulo: 'Novo treino montado pelo app',
    resumo: 'Montado agora com as suas preferências atuais: dias, tempo, equipamento, nível, fase do ciclo, foco, favoritos e restrições.',
  };
}

export default function PropostaTreino({
  proposta, nomeDoExercicio, aplicando, desatualizada, onAplicar, onRemontar, onCancelar,
}: {
  proposta: Proposta;
  /** Resolve o nome de tela de um id — a lista de mudanças nunca mostra código interno. */
  nomeDoExercicio: (id: string) => string;
  aplicando: boolean;
  /**
   * 🔴 As preferências mudaram entre montar e aplicar. A proposta na tela descreve um estado
   * que passou — e aplicá-la gravaria um treino montado sobre o que não vale mais.
   */
  desatualizada: boolean;
  onAplicar: () => void;
  onRemontar: () => void;
  onCancelar: () => void;
}) {
  const dialogo = useRef<HTMLDivElement>(null);
  const fechar = useRef(onCancelar);
  fechar.current = onCancelar;
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    dialogo.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar.current(); }
      if (e.key !== 'Tab') return;
      const controles = Array.from(dialogo.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, [tabindex="0"]') ?? [])
        .filter((el) => el.getClientRects().length > 0);
      const primeiro = controles[0]; const ultimo = controles[controles.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
      if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
    };
    document.addEventListener('keydown', teclado);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflowAnterior; document.removeEventListener('keydown', teclado); anterior?.focus(); };
  }, []);

  const { titulo, resumo } = cabecalho(proposta, nomeDoExercicio);
  const { mudancas } = proposta;
  const substituiDesenho = proposta.origemAntes === 'manual' && proposta.origemDepois === 'automatico';
  const nada = nadaMuda(proposta);
  const dias = proposta.rotina.dias.filter((d) => d.slots.length > 0);
  const nomes = (ids: readonly string[]) => [...new Set(ids)].map(nomeDoExercicio);

  return (
    <div
      onClick={() => { if (!aplicando) onCancelar(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(7,18,11,.7)', backdropFilter: 'blur(6px)' }}
    >
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto',
          background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))',
          border: '1px solid rgba(234,229,219,.14)', borderRadius: 20, padding: 20,
          animation: `evkScreenIn .3s ${EASE}`,
        }}
      >
        <div style={{ ...rotulo, marginBottom: 6 }}>
          {proposta.tipo === 'gerar' ? 'Gerar novo treino' : 'Atualizar treino'}
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-.02em' }}>{titulo}</h2>
        <p style={{ ...nota, margin: '0 0 14px' }}>{resumo}</p>

        {/* 🔒 A troca de origem é dita, nunca silenciosa. */}
        {substituiDesenho && !nada && (
          <p role="status" style={{ ...nota, margin: '0 0 14px', borderLeft: '2px solid rgba(234,179,8,.6)', paddingLeft: 10 }}>
            O treino que <strong>você montou</strong> sai e entra este, montado pelo app. Você
            pode montar de novo quando quiser em &quot;Montar meu treino&quot; — e o que você
            editar depois continua sendo seu.
          </p>
        )}

        {/* 🔴 Proposta velha: a tela para, explica e oferece o único caminho honesto — montar
            de novo com o que vale agora. Nada é gravado neste estado. */}
        {desatualizada && (
          <p role="alert" style={{ ...nota, margin: '0 0 14px', color: '#ffb4a5', background: 'rgba(229,72,77,.08)', border: '1px solid rgba(229,72,77,.35)', borderRadius: 12, padding: '10px 12px' }}>
            Suas preferências mudaram depois que esta proposta foi montada, então ela não
            descreve mais o seu treino. Nada foi alterado — monte de novo para ver a proposta
            com as preferências de agora.
          </p>
        )}

        {/* ═══ O que muda ═══ */}
        {!nada && !mudancas.identica && (
          <section aria-label="O que muda" style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ ...rotulo, marginBottom: 8 }}>O que muda</div>
            <Linha marca="＋" cor="#BDFF00" titulo="Entram" itens={nomes(mudancas.adicionados)} />
            <Linha marca="－" cor="#ffb4a5" titulo="Saem" itens={nomes(mudancas.removidos)} />
            <Linha marca="＝" cor="rgba(234,229,219,.7)" titulo="Continuam" itens={nomes(mudancas.mantidos)} />
            <Dias marca="＋" titulo="Dias que ganham treino" dias={mudancas.diasAdicionados} />
            <Dias marca="－" titulo="Dias que deixam de ter treino" dias={mudancas.diasRemovidos} />
          </section>
        )}

        {/* ═══ O plano proposto ═══ */}
        <section aria-label="A proposta" style={{ marginBottom: 14 }}>
          <div style={{ ...rotulo, marginBottom: 8 }}>{nada ? 'Seu treino' : 'Como o treino fica'}</div>
          {dias.length === 0 && <p style={nota}>Nenhum dia de treino com exercícios.</p>}
          {dias.map((dia, i) => (
            <details key={`${dia.nome}-${i}`} open={dias.length <= 2} style={{ marginBottom: 8 }}>
              <summary style={{ cursor: 'pointer', padding: '8px 0', fontSize: '.92rem', fontWeight: 700 }}>
                {dia.diaId ? DIA_LABEL[dia.diaId as Weekday].full : `Dia ${i + 1}`} · {dia.nome}
                <span style={{ fontWeight: 500, color: 'rgba(234,229,219,.6)' }}>
                  {' '}— {dia.slots.length} {dia.slots.length === 1 ? 'exercício' : 'exercícios'}
                </span>
              </summary>
              <ul style={{ margin: '0 0 6px', padding: '0 0 0 18px', ...nota }}>
                {dia.slots.map((s, k) => (
                  <li key={`${s.exercicio.id}-${k}`} style={{ marginBottom: 3 }}>
                    {s.exercicio.nomePt}
                    <span style={{ color: 'rgba(234,229,219,.5)' }}>
                      {' '}· {ROTULO_GRUPO[s.exercicio.grupoPrimario ?? ''] ?? s.exercicio.grupoMuscular}
                      {seriesDoSlot(s) > 0 ? ` · ${seriesDoSlot(s)} séries` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>

        {/**
          * 🔵 A RESSALVA DO TETO POR SESSÃO, ANTES DA CONFIRMAÇÃO (decisão 2026-09-17, 2ª volta).
          *
          * 🔑 A decisão autoriza a proposta a passar de 12 séries ponderadas num grupo num
          * mesmo treino **quando o motor esgota as alternativas** — e exige que isso seja dito
          * ANTES do toque em "Usar este treino", e não só depois, no plano. Sem este bloco a
          * pessoa confirmaria sem saber: a lista de avisos do motor é renderizada na aba do
          * plano e no editor, nunca aqui.
          *
          * 🔒 A fonte é `rotina.excecoesDeSessao`, publicada pelo motor junto do plano — a
          * mesma que o editor lê. A tela não recalcula nada, e o texto não afirma perigo nem
          * lesão: diz o número, o dia e de onde vem o excedente.
          */}
        {(proposta.rotina.excecoesDeSessao ?? []).length > 0 && (
          <section role="status" aria-label="Ressalva de volume" style={{ ...nota, margin: '0 0 14px', color: '#ffd8a8', background: 'rgba(234,179,8,.08)', border: '1px solid rgba(234,179,8,.35)', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Uma ressalva antes de você decidir</div>
            <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
              {(proposta.rotina.excecoesDeSessao ?? []).map((e) => (
                <li key={`${e.dia}-${e.grupo}`} style={{ marginBottom: 4 }}>
                  <strong>{ROTULO_GRUPO[e.grupo] ?? e.grupo}</strong> fica com {e.ponderado} séries
                  em {e.nomeDoDia} — acima das {e.teto} que o app usa como limite de um treino só,
                  somando diretas e indiretas.
                  {e.origensIndiretas.length > 0 && (
                    <> {e.indireto} {e.indireto === 1 ? 'vem' : 'vêm'} do trabalho indireto de{' '}
                      {e.origensIndiretas.map((o) => (ROTULO_GRUPO[o.grupo] ?? o.grupo).toLowerCase()).join(', ')} no mesmo dia.</>
                  )}
                </li>
              ))}
            </ul>
            <p style={{ margin: '6px 0 0', color: 'rgba(234,229,219,.7)' }}>
              Procuramos outro exercício, outro dia e menos séries, e nada disso coube nas suas
              outras escolhas. Este treino não está dentro de todos os limites do app.
            </p>
          </section>
        )}

        {/* 🔒 O que a substituição NÃO toca — o que costuma travar a decisão. */}
        <p style={{ ...nota, margin: '0 0 16px', fontSize: '.8rem', color: 'rgba(234,229,219,.6)' }}>
          Seu histórico, os treinos registrados, o progresso das cargas e a fase do seu ciclo
          (inclusive a semana de alívio) são preservados.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancelar} disabled={aplicando} style={{ ...btnGhost, opacity: aplicando ? .5 : 1 }}>
            {nada ? 'Fechar' : 'Manter o meu'}
          </button>
          {!nada && desatualizada && (
            <button
              type="button"
              onClick={onRemontar}
              style={{ flex: 1, minWidth: 170, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.98rem', padding: 13, border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 44 }}
            >
              Montar de novo
            </button>
          )}
          {!nada && !desatualizada && (
            <button
              type="button"
              onClick={onAplicar}
              disabled={aplicando}
              style={{ flex: 1, minWidth: 170, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.98rem', padding: 13, border: 'none', borderRadius: 12, cursor: aplicando ? 'progress' : 'pointer', opacity: aplicando ? .6 : 1, minHeight: 44 }}
            >
              {aplicando ? 'Aplicando…' : proposta.tipo === 'gerar' ? 'Usar este treino' : 'Aplicar a atualização'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Linha({ marca, cor, titulo, itens }: { marca: string; cor: string; titulo: string; itens: readonly string[] }) {
  if (itens.length === 0) return null;
  return (
    <p style={{ margin: '0 0 6px', fontSize: '.85rem', lineHeight: 1.55, color: 'rgba(234,229,219,.82)' }}>
      <span aria-hidden style={{ color: cor, marginRight: 6 }}>{marca}</span>
      <strong style={{ fontWeight: 600 }}>{titulo} ({itens.length}):</strong> {itens.join(', ')}
    </p>
  );
}

function Dias({ marca, titulo, dias }: { marca: string; titulo: string; dias: readonly Weekday[] }) {
  if (dias.length === 0) return null;
  const ordenados = ORDEM_SEMANA.filter((d) => dias.includes(d));
  return (
    <p style={{ margin: '0 0 6px', fontSize: '.85rem', lineHeight: 1.55, color: 'rgba(234,229,219,.82)' }}>
      <span aria-hidden style={{ marginRight: 6 }}>{marca}</span>
      <strong style={{ fontWeight: 600 }}>{titulo}:</strong> {ordenados.map((d) => DIA_LABEL[d].full).join(', ')}
    </p>
  );
}
