'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardapioItem, PlanoDieta } from '@/lib/engine';
import type { Food, RecipeMacros } from '@/lib/data/types';
import { agoraEmMinutos, diaCompleto, linhaDoDia, medidaDoIngrediente, registradas, totaisDosItens, type ItemPorcionado } from '@/lib/dia-da-dieta';
import { ControleRegistro, MEAL_LABEL, type StatusRefeicao } from './RegistroRefeicao';

/**
 * "O DIA DA DIETA" + "REFEIÇÃO GUIADA" — Leva 2.5 (cofre, DF 2026-07-26 / DF 2026-07-27).
 * Design: PEÇA A do handoff 2026-07-27 (10 telas). Cores, copy e medidas são finais.
 *
 * A tela fecha a assimetria com o treino em duas camadas:
 *  - **o dia da dieta** = o contêiner (linha Café → Almoço → Lanche → Jantar, próxima em destaque);
 *  - **refeição guiada** = a interação (abrir, ver itens, trocar, marcar que comeu, fechar).
 *
 * 🟢 GUARDA-CORPO NÃO NEGOCIÁVEL (cofre + handoff): a refeição guiada é **LEVE**.
 * **Sem timer, sem cronômetro, sem passo a passo, sem barra de progresso de execução e sem
 * "sessão concluída".** Treino é um evento com começo e fim; **comer não é**, e transformar
 * refeição em ritual cronometrado é exatamente como apps de contagem viram obsessão. Esta
 * folha NÃO copia a estética da sessão guiada de treino — o tom é "abrir, ver, marcar, fechar".
 *
 * 🔒 Registro BINÁRIO e SEM CALORIA (`registro-de-aderencia-adaptkorpus`): o `~X kcal` existe
 * só no CARDÁPIO (que é o plano), nunca no registro nem no histórico. O controle é o mesmo
 * `ControleRegistro` do V5 — os dois botões com peso visual igual, "comi outra coisa" neutro.
 *
 * ⚠️ O relógio do dispositivo fica AQUI, na UI. A decisão de qual é a próxima refeição é do
 * módulo puro `lib/dia-da-dieta.ts`, que recebe os minutos por parâmetro.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';
const r0 = (n: number) => Math.round(n);
const NEON = '#BDFF00';
const FOLHA = '#16A34A';

/* ════════════════════ A tela ════════════════════ */

export default function DiaDaDieta({
  itens, totais, plano, foodsById, logs, notes, trocados, dataHoje,
  onStatus, onNote, onTrocar, onPorcao, onDetalhe, onCompras, notaCardapio,
}: {
  itens: ItemPorcionado[];
  totais: RecipeMacros | null;
  plano: PlanoDieta;
  foodsById: Map<string, Food>;
  logs: Record<string, StatusRefeicao>;
  notes: Record<string, string>;
  trocados: Set<string>;
  dataHoje: string;
  onStatus: (id: string, s: StatusRefeicao) => void;
  onNote: (id: string, txt: string) => void;
  onTrocar: (idx: number) => void;
  onPorcao: (idx: number) => void;
  onDetalhe: (idx: number) => void;
  onCompras: () => void;
  notaCardapio?: string;
}) {
  const refeicoes = itens.map((it) => it.refeicao);
  // O relógio entra aqui e só aqui. Re-lê a cada minuto para o destaque acompanhar o dia
  // sem que a pessoa precise recarregar (o cálculo em si é puro).
  const [agoraMin, setAgoraMin] = useState(() => agoraEmMinutos());
  useEffect(() => {
    const id = setInterval(() => setAgoraMin(agoraEmMinutos()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [aberta, setAberta] = useState<number | null>(null);

  const linhas = useMemo(() => linhaDoDia(refeicoes, logs, agoraMin), [refeicoes, logs, agoraMin]);
  const feitas = registradas(refeicoes, logs);
  const completo = diaCompleto(refeicoes, logs);
  const totaisAtuais = totais ?? totaisDosItens(itens);

  if (itens.length === 0) {
    return <p style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.6)' }}>{notaCardapio ?? 'Sem cardápio para as restrições atuais.'}</p>;
  }

  return (
    <div style={{ animation: `evkPop .45s ${EASE}` }}>
      <CabecalhoDoDia dataHoje={dataHoje} feitas={feitas} total={itens.length} totais={totaisAtuais} plano={plano} />

      {/* Duas colunas no desktop (`dia-dieta-desktop`, 1280px): linha do dia à esquerda,
          o que estiver aberto à direita. No celular vira uma coluna só. */}
      <div className="evk-dia-dieta">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {linhas.map((l) => {
            const item = itens[l.idx];
            if (!item) return null;
            if (l.estado === 'proxima') {
              return (
                <CartaoProxima
                  key={l.id} item={item} foodsById={foodsById}
                  onAbrir={() => setAberta(l.idx)} onTrocar={() => onTrocar(l.idx)}
                />
              );
            }
            return (
              <LinhaCompacta
                key={l.id} item={item} estado={l.estado}
                status={logs[l.id] ?? null} onAbrir={() => setAberta(l.idx)}
              />
            );
          })}
        </div>

        {completo && <EncerramentoCalmo />}

        <AtalhoCompras onCompras={onCompras} />
      </div>

      {aberta != null && itens[aberta] && (
        <RefeicaoGuiada
          item={itens[aberta]}
          foodsById={foodsById}
          porcentagem={trocados.has(`p${aberta}`) ? itens[aberta].porcentagemEscolhida ?? 100 : null}
          status={logs[itens[aberta].refeicao] ?? null}
          note={notes[itens[aberta].refeicao] ?? ''}
          onStatus={(s) => onStatus(itens[aberta]!.refeicao, s)}
          onNote={(t) => onNote(itens[aberta]!.refeicao, t)}
          onTrocar={() => onTrocar(aberta)}
          onPorcao={() => onPorcao(aberta)}
          onDetalhe={() => onDetalhe(aberta)}
          onFechar={() => setAberta(null)}
        />
      )}
    </div>
  );
}

/* ════════════════════ Cabeçalho do dia ════════════════════ */

/**
 * 🔒 A ressalva "é um guia, não uma meta exata" aparece **uma vez por tela**, aqui — o
 * handoff proíbe repeti-la no cartão da próxima refeição.
 * 🔒 Trava de copy 3: caloria é "estimativa de referência" / "seu ponto de partida", nunca
 * "meta exata".
 */
function CabecalhoDoDia({ dataHoje, feitas, total, totais, plano }: {
  dataHoje: string; feitas: number; total: number; totais: RecipeMacros; plano: PlanoDieta;
}) {
  const macros = totais;
  const foraDaJanela = totais.kcal < plano.janela.minKcal - 1e-6 || totais.kcal > plano.janela.maxKcal + 1e-6;
  const g = macros.proteinaG + macros.carboidratoG + macros.gorduraG;
  const pct = (v: number) => (g > 0 ? (v / g) * 100 : 0);
  return (
    <div style={{ background: 'linear-gradient(165deg, rgba(22,163,74,.1), rgba(15,15,14,.5))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 20, padding: '22px 24px', marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: NEON }}>{dataHoje || 'Seu dia'}</div>
        <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'rgba(234,229,219,.7)' }} aria-live="polite">{feitas} de {total} registradas</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 4 }}>
        <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.02em', color: NEON }}>~{r0(totais.kcal).toLocaleString('pt-BR')}</span>
        <span style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.6)' }}>kcal · cardápio atual</span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '.85rem', color: 'rgba(234,229,219,.55)' }}>Referência calculada do plano: ~{r0(plano.kcalAlvo).toLocaleString('pt-BR')} kcal · P {r0(plano.macros.proteinaG)} g · C {r0(plano.macros.carboidratoG)} g · G {r0(plano.macros.gorduraG)} g. É um guia, não uma meta exata.</p>
      {foraDaJanela && <p role="status" style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.8)' }}>O cardápio atual está fora da janela original de {r0(plano.janela.minKcal)}–{r0(plano.janela.maxKcal)} kcal. As trocas equivalentes consideram o dia atual.</p>}
      {totais.proteinaG < plano.macros.proteinaPisoG - 1e-6 && <p role="status" style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.8)' }}>O cardápio atual fornece {totais.proteinaG.toFixed(1)} g de proteína, abaixo do piso calculado de {plano.macros.proteinaPisoG.toFixed(1)} g. Esta composição não atende esse requisito.</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <BarraMacro nome="Proteína" g={r0(macros.proteinaG)} pct={pct(macros.proteinaG)} cor={FOLHA} />
        <BarraMacro nome="Carbo" g={r0(macros.carboidratoG)} pct={pct(macros.carboidratoG)} cor="rgba(189,255,0,.62)" />
        <BarraMacro nome="Gordura" g={r0(macros.gorduraG)} pct={pct(macros.gorduraG)} cor="rgba(234,229,219,.45)" />
      </div>
    </div>
  );
}

function BarraMacro({ nome, g, pct, cor }: { nome: string; g: number; pct: number; cor: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ height: 4, borderRadius: 99, background: 'rgba(234,229,219,.1)', overflow: 'hidden', marginBottom: 7 }}>
        <div style={{ height: '100%', width: `${Math.max(4, Math.min(100, pct))}%`, background: cor, borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: '.76rem', color: 'rgba(234,229,219,.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome} · {g} g</div>
    </div>
  );
}

/* ════════════════════ Linha do dia ════════════════════ */

/** Peso 1 (registrada) e peso 3 (futura, recolhida) — a mesma linha compacta. */
function LinhaCompacta({ item, estado, status, onAbrir }: {
  item: CardapioItem; estado: 'registrada' | 'futura'; status: StatusRefeicao; onAbrir: () => void;
}) {
  const registrada = estado === 'registrada';
  const seguiu = status === 'seguiu';
  // 🔒 "Comi outra coisa" é NEUTRO — nunca vermelho, nunca cinza-punição. Só o marcador
  // muda de cor (Folha × Bone); o peso do texto é idêntico nos dois.
  const rotulo = registrada ? (seguiu ? 'Segui o plano' : 'Comi outra coisa') : item.prato.nome;
  return (
    <button
      onClick={onAbrir}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 44,
        padding: '12px 14px', borderRadius: 14, background: 'rgba(15,15,14,.4)',
        border: '1px solid rgba(234,229,219,.08)', cursor: 'pointer', textAlign: 'left',
        color: '#EAE5DB', opacity: registrada ? 1 : 0.72,
      }}
    >
      <span aria-hidden style={{
        width: 26, height: 26, minWidth: 26, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: registrada && seguiu ? 'rgba(22,163,74,.22)' : 'transparent',
        border: registrada
          ? `1px solid ${seguiu ? 'rgba(22,163,74,.55)' : 'rgba(234,229,219,.4)'}`
          : '1px dashed rgba(234,229,219,.32)',
      }}>
        {registrada && (seguiu
          ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 6.5" stroke={NEON} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
          : <span style={{ width: 9, height: 2, background: 'rgba(234,229,219,.75)', borderRadius: 2 }} />)}
      </span>
      <span style={{ minWidth: 74, fontWeight: 700, fontSize: '.94rem' }}>{MEAL_LABEL[item.refeicao] ?? item.refeicao}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: '.88rem', color: 'rgba(234,229,219,.62)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rotulo}</span>
    </button>
  );
}

/**
 * Peso 2 — a **próxima refeição em destaque**. Pulso lento no `box-shadow` (4,5 s),
 * desligado sob `prefers-reduced-motion` (a classe cuida disso).
 *
 * 🔴 A ressalva do "guia, não meta" NÃO se repete aqui (fica só no cabeçalho do dia).
 * 🔴 Sem tom de cobrança quando o horário já passou: o cartão é exatamente o mesmo. O app
 * não conta atraso, não muda de cor e não diz que a pessoa perdeu a refeição.
 */
function CartaoProxima({ item, foodsById, onAbrir, onTrocar }: {
  item: CardapioItem; foodsById: Map<string, Food>; onAbrir: () => void; onTrocar: () => void;
}) {
  const nItens = item.prato.itens.filter((i) => foodsById.has(i.alimentoId)).length;
  return (
    <div className="evk-proxima-refeicao" style={{
      background: 'linear-gradient(168deg, rgba(189,255,0,.09), rgba(15,15,14,.66))',
      border: '1px solid rgba(189,255,0,.34)', borderRadius: 20, padding: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: NEON }}>Próxima refeição</span>
        <span style={{ fontSize: '.84rem', color: 'rgba(234,229,219,.6)' }}>{MEAL_LABEL[item.refeicao] ?? item.refeicao}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: '1.22rem', fontWeight: 700, letterSpacing: '-.01em', minWidth: 0 }}>{item.prato.nome}</span>
        {/* `~X kcal` vive no CARDÁPIO (é o plano) — nunca no registro. */}
        <span style={{ fontSize: '.84rem', fontWeight: 600, color: NEON, background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', borderRadius: 999, padding: '5px 12px', flexShrink: 0 }}>~{r0(item.macros.kcal)} kcal</span>
      </div>
      <div style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.55)', marginBottom: 16 }}>{nItens} {nItens === 1 ? 'item' : 'itens'}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onAbrir} className="hov-btn" style={{ flex: 1, minWidth: 150, minHeight: 44, background: NEON, color: '#0D2818', fontWeight: 700, fontSize: '.95rem', padding: '13px 20px', border: 'none', borderRadius: 12, cursor: 'pointer' }}>Abrir refeição</button>
        <button onClick={onTrocar} className="evk-troca" style={{ minHeight: 44, background: 'none', border: '1px solid rgba(234,229,219,.22)', color: 'rgba(234,229,219,.85)', fontWeight: 600, fontSize: '.92rem', padding: '13px 20px', borderRadius: 12, cursor: 'pointer' }}>Trocar</button>
      </div>
    </div>
  );
}

/** `dia-dieta-completo` — 🔒 sem confete, sem troféu, sem "parabéns, dia perfeito". */
function EncerramentoCalmo() {
  return (
    <div style={{ marginTop: 18, background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: '18px 20px' }}>
      <p style={{ margin: 0, fontSize: '.95rem', lineHeight: 1.6, color: 'rgba(234,229,219,.72)' }}>
        Você registrou todas as refeições de hoje. Constância, não perfeição.
      </p>
    </div>
  );
}

/** Atalho da lista de compras — cartão de uma linha no fim da tela, tile Pulso .1. */
function AtalhoCompras({ onCompras }: { onCompras: () => void }) {
  return (
    <button onClick={onCompras} className="hov-lift" style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', minHeight: 44, marginTop: 18, padding: '15px 17px', borderRadius: 16, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', cursor: 'pointer', textAlign: 'left', color: '#EAE5DB' }}>
      <span aria-hidden style={{ width: 36, height: 36, minWidth: 36, borderRadius: 11, background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M5 7h14l-1 12H6L5 7z" stroke={NEON} strokeWidth={1.8} strokeLinejoin="round" /><path d="M8.5 7V5.5a3.5 3.5 0 017 0V7" stroke={NEON} strokeWidth={1.8} strokeLinecap="round" /></svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '.96rem' }}>Lista de compras</span>
        <span style={{ display: 'block', fontSize: '.84rem', color: 'rgba(234,229,219,.55)' }}>O que o seu cardápio pede no período</span>
      </span>
      <span aria-hidden style={{ color: 'rgba(234,229,219,.4)', fontSize: '1.1rem', flexShrink: 0 }}>→</span>
    </button>
  );
}

/* ════════════════════ Refeição guiada ════════════════════ */

/**
 * `refeicao-guiada-aberta` — folha sobre a linha do dia (slide-up ~320 ms).
 *
 * 🟢 O que esta folha NÃO tem, por decisão travada: timer, cronômetro, passo a passo,
 * barra de progresso de execução, "iniciar", "concluir sessão" e modo de preparo
 * ("não somos app de culinária" — e não existe slot "em breve" para isso).
 */
export function RefeicaoGuiada({
  item, foodsById, porcentagem, status, note,
  onStatus, onNote, onTrocar, onPorcao, onDetalhe, onFechar,
}: {
  item: CardapioItem; foodsById: Map<string, Food>; porcentagem: number | null;
  status: StatusRefeicao; note: string;
  onStatus: (s: StatusRefeicao) => void; onNote: (t: string) => void;
  onTrocar: () => void; onPorcao: () => void; onDetalhe: () => void; onFechar: () => void;
}) {
  const folha = useRef<HTMLDivElement>(null);
  const voltar = useRef<HTMLButtonElement>(null);

  // Esc fecha + foco entra na folha (mesmo padrão das folhas do "Fiquei doente").
  useEffect(() => {
    voltar.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onFechar(); return; }
      if (e.key !== 'Tab' || !folha.current) return;
      const foc = folha.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
      if (foc.length === 0) return;
      const primeiro = foc[0]!, ultimo = foc[foc.length - 1]!;
      const ativo = document.activeElement;
      if (e.shiftKey && ativo === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && ativo === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onFechar]);

  const itens = item.prato.itens
    .map((ing) => ({ ing, food: foodsById.get(ing.alimentoId) }))
    .filter((x): x is { ing: typeof x.ing; food: Food } => !!x.food);

  return (
    <div
      onClick={onFechar}
      style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(7,18,11,.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div
        ref={folha}
        role="dialog"
        aria-modal="true"
        aria-label={`${MEAL_LABEL[item.refeicao] ?? item.refeicao} — ${item.prato.nome}`}
        onClick={(e) => e.stopPropagation()}
        className="evk-folha-refeicao"
        style={{
          width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto',
          background: 'linear-gradient(168deg, rgba(16,42,26,.99), rgba(15,15,14,.99))',
          border: '1px solid rgba(234,229,219,.14)', borderRadius: '24px 24px 0 0',
          padding: '20px 22px 30px', boxShadow: '0 -30px 80px -30px rgba(0,0,0,.85)',
        }}
      >
        {/* Header próprio da folha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button ref={voltar} onClick={onFechar} aria-label="Voltar para o dia" style={{ width: 34, height: 34, minWidth: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', color: '#EAE5DB', cursor: 'pointer' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)' }}>Voltar para o dia</div>
            <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>{MEAL_LABEL[item.refeicao] ?? item.refeicao}</div>
          </div>
          <span style={{ fontSize: '.84rem', fontWeight: 600, color: NEON, background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', borderRadius: 999, padding: '5px 12px', flexShrink: 0 }}>~{r0(item.macros.kcal)} kcal</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-.01em' }}>{item.prato.nome}</span>
          {porcentagem != null && (
            <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#0D2818', background: NEON, borderRadius: 7, padding: '3px 8px' }}>{porcentagem}% da porção</span>
          )}
        </div>

        {/* Itens do prato: medida caseira + gramas. Sem modo de preparo — decisão travada. */}
        <div style={{ background: 'rgba(15,15,14,.45)', border: '1px solid rgba(234,229,219,.08)', borderRadius: 14, padding: '6px 16px', marginBottom: 14 }}>
          {itens.map(({ ing, food }, i) => (
            <div key={ing.alimentoId} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 0', borderBottom: i === itens.length - 1 ? 'none' : '1px solid rgba(234,229,219,.06)' }}>
              <span aria-hidden style={{ width: 7, height: 7, minWidth: 7, borderRadius: '50%', background: NEON, marginTop: 7 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.94rem', fontWeight: 600 }}>{food.rotuloAmigavel ?? food.nome}</div>
                <div style={{ fontSize: '.84rem', color: 'rgba(234,229,219,.55)', marginTop: 2 }}>{medidaDoIngrediente(food, ing.gramas * item.escala)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Ações do prato. ⚠️ No nosso modelo a refeição É um prato: trocar e editar porção
            agem sobre ele (o motor substitui e escala prato, não ingrediente avulso). */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <BotaoTracejado onClick={onTrocar}>Trocar</BotaoTracejado>
          <BotaoTracejado onClick={onPorcao}>Editar porção</BotaoTracejado>
          <BotaoTracejado onClick={onDetalhe}>Ver detalhe</BotaoTracejado>
        </div>

        {/* 🔒 O registro fecha a folha: binário, sem caloria, dois botões de mesmo peso. */}
        <ControleRegistro
          status={status}
          note={note}
          onSeguiu={() => onStatus('seguiu')}
          onFora={() => onStatus('fora')}
          onAlterar={() => onStatus(null)}
          onNote={onNote}
        />

        {status && (
          <button onClick={onFechar} className="hov-btn" style={{ width: '100%', minHeight: 44, marginTop: 16, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.16)', color: '#EAE5DB', fontWeight: 600, fontSize: '.94rem', padding: '13px 20px', borderRadius: 12, cursor: 'pointer' }}>Voltar para o dia</button>
        )}
      </div>
    </div>
  );
}

function BotaoTracejado({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="evk-troca" style={{ minHeight: 44, background: 'none', border: '1px dashed rgba(234,229,219,.28)', color: 'rgba(234,229,219,.82)', fontWeight: 600, fontSize: '.88rem', padding: '11px 16px', borderRadius: 11, cursor: 'pointer' }}>{children}</button>
  );
}

