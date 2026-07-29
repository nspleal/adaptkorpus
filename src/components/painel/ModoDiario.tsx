'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { MEAL_LABEL, type StatusRefeicao } from './RegistroRefeicao';

/**
 * MODO DIÁRIO — as telas de quem o gate roteou (`ROTEAR`).
 *
 * 🔒 Cofre, DF 2026-07-27 (`gate-de-saude-evokorpus`): a pessoa ENTRA e REGISTRA; não recebe
 * plano, cardápio, sessão guiada, meta de cardio nem progressão. A regra que separa as duas
 * coisas: **registrar é inerte, prescrever seria orientação.**
 *
 * 🔴 Nada aqui adapta nada "para a condição": estes componentes não recebem, não leem e não
 * exibem a condição de saúde. Eles não perguntam nada sobre ela e não a usam para decidir o
 * que mostrar — quem decide é o comportamento do gate (`modo-diario.ts`), um passo antes.
 *
 * Tom: sem vermelho, sem cadeado, sem "desbloqueie", sem tela vazia de recurso ausente. O que
 * some, some — não vira anúncio do que ela não tem.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

/** Os 4 slots do dia. Mesmo vocabulário do registro com plano — é a linguagem do diário,
 *  não uma prescrição (não diz o quê, nem quanto, nem quando). */
export const REFEICOES_DIARIO: readonly string[] = ['cafe', 'almoco', 'lanche', 'jantar'];

/* ════════════════════ Encaminhamento permanente ════════════════════ */

/**
 * O encaminhamento ao profissional, **calmo e permanente** (DF: "não como bloqueio, nem como
 * erro, nem em vermelho"). Fica no topo da Hoje, sempre — não é modal, não reaparece, não
 * pede ação.
 *
 * 🔒 NÃO repete os motivos do gate. Eles aparecem uma vez, no onboarding, onde são contexto
 * da decisão; repeti-los todo dia transformaria o cartão num rótulo diário da condição — o
 * oposto do tom calmo que a DF pede. O app também não os usa para nada além disto.
 */
export function CartaoEncaminhamento() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: 'linear-gradient(165deg, rgba(22,163,74,.12), rgba(15,15,14,.5))', border: '1px solid rgba(22,163,74,.34)', borderRadius: 18, padding: '18px 20px', marginBottom: 22 }}>
      <span aria-hidden style={{ width: 42, height: 42, minWidth: 42, borderRadius: 13, background: 'rgba(22,163,74,.16)', border: '1px solid rgba(22,163,74,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.4-7-9.6A4.4 4.4 0 0112 8a4.4 4.4 0 017 3.4c0 5.2-7 9.6-7 9.6z" stroke="#16A34A" strokeWidth={1.8} strokeLinejoin="round" /><path d="M9 11.5h1.6l.9-1.6 1 3 .9-1.4H16" stroke="#16A34A" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '1.02rem', marginBottom: 6 }}>Seu plano vem de um profissional</div>
        <p style={{ margin: '0 0 8px', fontSize: '.92rem', lineHeight: 1.6, color: 'rgba(234,229,219,.72)' }}>
          Pelo que você respondeu, seu caso pede o acompanhamento de um profissional de saúde — médico,
          nutricionista ou educador físico. Por isso o app não monta treino nem cardápio para você.
        </p>
        <p style={{ margin: 0, fontSize: '.92rem', lineHeight: 1.6, color: 'rgba(234,229,219,.72)' }}>
          O que ele faz é <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>guardar o que você fez</strong>:
          treinos, refeições, cardio e peso ficam registrados aqui, e você pode levar esse histórico para a consulta.
        </p>
        <Link href="/aviso" style={{ display: 'inline-block', marginTop: 12, fontSize: '.88rem', fontWeight: 600, color: 'rgba(234,229,219,.7)', textDecoration: 'none', borderBottom: '1px dashed rgba(234,229,219,.3)' }}>Ver conteúdos gerais</Link>
      </div>
    </div>
  );
}

/* ════════════════════ Aba Hoje ════════════════════ */

/** O que a pessoa já registrou HOJE — leitura do próprio dado, nada derivado de plano. */
export interface RegistroDeHoje {
  treinos: number;
  cardioMin: number;
  refeicoesRegistradas: number;
  refeicoesTotal: number;
}

/**
 * A aba **Hoje** em modo diário.
 *
 * ⚠️ DECISÃO DA SESSÃO DE CÓDIGO (2026-07-29) — o cofre não especificou esta tela; é o único
 * vazio real do Bloco A. Sem plano, a Hoje não pode ser "o plano de hoje", e deixá-la com o
 * esqueleto do plano vazio seria exatamente a "tela vazia" que a DF proíbe. Ela vira a
 * **porta do diário**: encaminhamento (calmo, permanente) → Chama → o que registrar → o que
 * já foi registrado hoje. Tudo o que aparece aqui é registro ou leitura do registro.
 */
export function HojeDiario({ registrado, onRegistrarTreino, onRegistrarCardio, onRegistrarRefeicao, pesoSlot }: {
  registrado: RegistroDeHoje;
  onRegistrarTreino: () => void;
  onRegistrarCardio: () => void;
  onRegistrarRefeicao: () => void;
  pesoSlot?: ReactNode;
}) {
  const nada = registrado.treinos === 0 && registrado.cardioMin === 0 && registrado.refeicoesRegistradas === 0;
  return (
    <div style={{ animation: `evkPop .45s ${EASE}` }}>
      <CartaoEncaminhamento />

      <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 }}>
        <div style={{ fontSize: '.76rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 14 }}>Registrar</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <AcaoRegistrar rotulo="Treino" onClick={onRegistrarTreino} icone={<path d="M6.5 9v6M17.5 9v6M4 10.5v3M20 10.5v3M8 12h8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />} />
          <AcaoRegistrar rotulo="Cardio" onClick={onRegistrarCardio} icone={<path d="M3 12h4l2.5-5 4 10 2.5-5h5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />} />
          <AcaoRegistrar rotulo="Refeição" onClick={onRegistrarRefeicao} icone={<><path d="M5 3v8a2.5 2.5 0 0 0 5 0V3M7.5 11v10" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" fill="none" /><path d="M17 3c-1.6 1.4-2.4 3.2-2.4 5.4 0 1.7.9 2.9 2.4 3.2V21" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" /></>} />
        </div>
        {pesoSlot && <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(234,229,219,.08)' }}>{pesoSlot}</div>}
      </div>

      <div style={{ background: 'rgba(234,229,219,.03)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '20px 22px' }}>
        <div style={{ fontSize: '.76rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 14 }}>Hoje você registrou</div>
        {nada ? (
          <p style={{ margin: 0, fontSize: '.94rem', lineHeight: 1.6, color: 'rgba(234,229,219,.6)' }}>Nada ainda. O que você registrar hoje aparece aqui.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {registrado.treinos > 0 && <LinhaRegistrado texto={`${registrado.treinos} treino${registrado.treinos === 1 ? '' : 's'}`} />}
            {registrado.cardioMin > 0 && <LinhaRegistrado texto={`${registrado.cardioMin} min de cardio`} />}
            {registrado.refeicoesRegistradas > 0 && <LinhaRegistrado texto={`${registrado.refeicoesRegistradas} de ${registrado.refeicoesTotal} refeições`} />}
          </div>
        )}
      </div>
    </div>
  );
}

function AcaoRegistrar({ rotulo, onClick, icone }: { rotulo: string; onClick: () => void; icone: ReactNode }) {
  return (
    <button onClick={onClick} className="hov-lift" style={{ display: 'flex', alignItems: 'center', gap: 11, minHeight: 44, background: 'rgba(189,255,0,.06)', border: '1px solid rgba(189,255,0,.26)', color: '#EAE5DB', fontWeight: 600, fontSize: '.94rem', padding: '13px 15px', borderRadius: 13, cursor: 'pointer', textAlign: 'left' }}>
      <span aria-hidden style={{ width: 30, height: 30, minWidth: 30, borderRadius: 9, background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BDFF00' }}>
        <svg width={17} height={17} viewBox="0 0 24 24" fill="none">{icone}</svg>
      </span>
      {rotulo}
    </button>
  );
}

function LinhaRegistrado({ texto }: { texto: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <span aria-hidden style={{ width: 26, height: 26, minWidth: 26, borderRadius: 8, background: 'rgba(22,163,74,.2)', border: '1px solid rgba(22,163,74,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 6.5" stroke="#BDFF00" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span style={{ fontSize: '.94rem', fontWeight: 600 }}>{texto}</span>
    </div>
  );
}

/* ════════════════════ Aba Treino ════════════════════ */

/**
 * O cabeçalho da aba **Treino** em modo diário: a entrada do registro manual. Sem rotina, sem
 * split, sem sessão guiada, sem progressão — logo abaixo dela vem o cardio (que já sabe
 * aparecer sem meta desde a Leva 2).
 */
export function TreinoDiario({ onRegistrarTreino }: { onRegistrarTreino: () => void }) {
  return (
    <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '22px 24px' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-.02em' }}>Registrar treino</h2>
      <p style={{ margin: '0 0 18px', fontSize: '.94rem', lineHeight: 1.6, color: 'rgba(234,229,219,.62)' }}>
        Anote o que você treinou — exercícios, séries e cargas. Fica tudo no seu histórico.
      </p>
      <button onClick={onRegistrarTreino} className="hov-btn" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 9, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.95rem', padding: '13px 22px', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" /></svg>
        Registrar treino feito
      </button>
    </div>
  );
}

/* ════════════════════ Aba Dieta ════════════════════ */

/**
 * A aba **Dieta** em modo diário: só o registro das 4 refeições. Sem cardápio, sem prato, sem
 * `~X kcal`, sem macro, sem troca, sem lista de compras — tudo isso é o plano.
 *
 * 🔒 O registro aqui é **unário**, não binário: "Segui o plano" / "Comi outra coisa" são
 * afirmações SOBRE UM PLANO, e não existe plano. Restou o ato inerte — "comi" — com nota
 * opcional. Continua sem caloria, sem cobrança e sem cor de falha.
 */
export function DietaDiario({ logs, notes, onStatus, onNote }: {
  logs: Record<string, StatusRefeicao>;
  notes: Record<string, string>;
  onStatus: (id: string, s: StatusRefeicao) => void;
  onNote: (id: string, txt: string) => void;
}) {
  const feitas = REFEICOES_DIARIO.filter((r) => logs[r] === 'comi').length;
  return (
    <div style={{ animation: `evkPop .45s ${EASE}` }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-.02em' }}>Suas refeições de hoje</h2>
        <p style={{ margin: 0, fontSize: '.94rem', lineHeight: 1.6, color: 'rgba(234,229,219,.6)' }}>
          {feitas} de {REFEICOES_DIARIO.length} registradas. Marque o que você comeu — o histórico fica guardado para você.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {REFEICOES_DIARIO.map((r) => (
          <RefeicaoDiario key={r} id={r} status={logs[r] ?? null} note={notes[r] ?? ''} onStatus={onStatus} onNote={onNote} />
        ))}
      </div>
    </div>
  );
}

function RefeicaoDiario({ id, status, note, onStatus, onNote }: {
  id: string; status: StatusRefeicao; note: string;
  onStatus: (id: string, s: StatusRefeicao) => void; onNote: (id: string, txt: string) => void;
}) {
  const [notaAberta, setNotaAberta] = useState(false);
  const marcada = status === 'comi';
  const caixa: CSSProperties = {
    background: 'rgba(234,229,219,.04)',
    border: `1px solid ${marcada ? 'rgba(22,163,74,.42)' : 'rgba(234,229,219,.1)'}`,
    borderRadius: 16, padding: '16px 18px',
  };
  return (
    <div style={caixa}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 120, fontWeight: 700, fontSize: '1rem' }}>{MEAL_LABEL[id] ?? id}</span>
        {marcada ? (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.9rem', fontWeight: 600, color: '#BDFF00' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 6.5" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
              Registrada
            </span>
            <button onClick={() => onStatus(id, null)} style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.6)', fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', padding: '4px 2px', borderBottom: '1px dashed rgba(234,229,219,.3)' }}>Desfazer</button>
          </>
        ) : (
          <button onClick={() => onStatus(id, 'comi')} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(189,255,0,.08)', border: '1px solid rgba(189,255,0,.32)', color: '#BDFF00', fontWeight: 700, fontSize: '.92rem', padding: '11px 18px', borderRadius: 11, cursor: 'pointer' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" /></svg>
            Registrar
          </button>
        )}
      </div>
      {marcada && (
        <div style={{ marginTop: 13, paddingTop: 13, borderTop: '1px solid rgba(234,229,219,.07)' }}>
          {notaAberta || note ? (
            <>
              <textarea rows={2} value={note} onChange={(e) => onNote(id, e.target.value)} placeholder="Quer anotar o que comeu? (opcional)" className="input-foco" aria-label={`Anotação — ${MEAL_LABEL[id] ?? id}`} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(13,40,24,.5)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 10, padding: '10px 12px', color: '#EAE5DB', fontSize: '.88rem', lineHeight: 1.5, outline: 'none', resize: 'none' }} />
              <div style={{ fontSize: '.74rem', color: 'rgba(234,229,219,.4)', marginTop: 6 }}>Sem calorias, sem cobrança. Pode deixar em branco.</div>
            </>
          ) : (
            <button onClick={() => setNotaAberta(true)} style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.6)', fontWeight: 600, fontSize: '.84rem', cursor: 'pointer', padding: '4px 2px', borderBottom: '1px dashed rgba(234,229,219,.3)' }}>Anotar o que comeu</button>
          )}
        </div>
      )}
    </div>
  );
}
