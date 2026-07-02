'use client';

import type { NotifPrefs } from '@/lib/notificacoes';

/**
 * Opt-in de notificações (porte fiel do V6.2 §Peça7). Nada pré-ativado; o opt-in é sempre
 * explícito (via modal). Os toggles Treino/Refeição têm peso igual e são igualmente fáceis de
 * desligar. O preview usa cartão CLARO (#F4F3EF) de propósito: quem renderiza a notificação é
 * o navegador/SO, não o CSS da marca — não escurecer. Reengajamento = UM aviso após 7+ dias.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

const Sino = ({ size, cor = '#BDFF00' }: { size: number; cor?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M6 10a6 6 0 1112 0c0 3.2 1 5 2 6.5H4c1-1.5 2-3.3 2-6.5Z" stroke={cor} strokeWidth={1.8} strokeLinejoin="round" /><path d="M9.5 19.5a2.5 2.5 0 005 0" stroke={cor} strokeWidth={1.8} strokeLinecap="round" /></svg>
);

/** Switch reaproveitado da sessão guiada (mesmas medidas). Área clicável inteira. */
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <span onClick={onClick} style={{ width: 46, minWidth: 46, height: 26, borderRadius: 999, padding: 3, cursor: 'pointer', transition: 'background .25s ease', background: on ? '#BDFF00' : 'rgba(234,229,219,.15)', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: on ? '#0D2818' : 'rgba(234,229,219,.8)', transition: `transform .25s ${EASE}`, transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </span>
  );
}

const MiniLogo = () => (
  <svg width={15} height={15} viewBox="0 0 100 100" fill="none"><line x1={28} y1={16} x2={28} y2={84} stroke="#16241a" strokeWidth={14} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#16241a" strokeWidth={14} strokeLinecap="round" /><path d="M33 50 Q50 38 70 18" stroke="#6b8f00" strokeWidth={4} fill="none" strokeLinecap="round" /></svg>
);

function MockNotif({ titulo, corpo }: { titulo: string; corpo: string }) {
  return (
    <div style={{ background: '#F4F3EF', borderRadius: 12, padding: '12px 14px', boxShadow: '0 10px 26px -12px rgba(0,0,0,.4)', maxWidth: 380 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><MiniLogo /><span style={{ fontSize: '.72rem', fontWeight: 600, color: '#5b5b56' }}>evokorpus.app</span><span style={{ fontSize: '.7rem', color: '#8a8a83', marginLeft: 'auto' }}>agora</span></div>
      <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#1c1c1a', marginBottom: 2 }}>{titulo}</div>
      <div style={{ fontSize: '.82rem', color: '#54544e', lineHeight: 1.4 }}>{corpo}</div>
    </div>
  );
}

export function NotificacoesCard({ prefs, onAtivar, onToggleTreino, onToggleRefeicao, onDesativarTudo }: {
  prefs: NotifPrefs; onAtivar: () => void; onToggleTreino: () => void; onToggleRefeicao: () => void; onDesativarTudo: () => void;
}) {
  const ativo = prefs.optIn === true;
  const promptCopy = prefs.optIn === false
    ? 'Sem problema — você pode ativar quando quiser.'
    : 'Quer lembretes do seu treino e refeições? Você escolhe quando ativar — e pode desligar quando quiser.';
  return (
    <div style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ width: 42, height: 42, minWidth: 42, borderRadius: 12, background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sino size={21} /></span><h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Notificações</h3></div>
        {ativo && <span style={{ fontSize: '.66rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#BDFF00', background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>Ativadas</span>}
      </div>

      {!ativo ? (
        <>
          <p style={{ margin: '0 0 16px', fontSize: '.92rem', color: 'rgba(234,229,219,.65)', lineHeight: 1.55 }}>{promptCopy}</p>
          <button onClick={onAtivar} className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.92rem', padding: '11px 20px', border: 'none', borderRadius: 11, cursor: 'pointer' }}>Ativar notificações</button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid rgba(234,229,219,.07)', gap: 14 }}>
              <div><div style={{ fontWeight: 600, fontSize: '.95rem' }}>Treino</div><div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>Lembrete do seu treino do dia.</div></div>
              <Switch on={prefs.treino} onClick={onToggleTreino} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', gap: 14 }}>
              <div><div style={{ fontWeight: 600, fontSize: '.95rem' }}>Refeição</div><div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>Lembrete pra registrar suas refeições.</div></div>
              <Switch on={prefs.refeicao} onClick={onToggleRefeicao} />
            </div>
          </div>
          <button onClick={onDesativarTudo} style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.55)', fontSize: '.85rem', fontWeight: 600, cursor: 'pointer', padding: 0, borderBottom: '1px dashed rgba(234,229,219,.3)', fontFamily: 'inherit' }}>Desativar tudo</button>

          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(234,229,219,.08)' }}>
            <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'rgba(234,229,219,.5)', marginBottom: 12, lineHeight: 1.5 }}>Exemplo de aviso — só depois de 7+ dias sem usar o app. Um único toque, depois silêncio.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <MockNotif titulo="Seu treino de hoje te espera." corpo="Sem pressa — seu plano continua aqui, pronto quando você quiser." />
              <MockNotif titulo="Seu plano continua aqui." corpo="Volte quando quiser — nada mudou." />
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '.76rem', color: 'rgba(234,229,219,.4)', lineHeight: 1.5 }}>Renderizado pelo navegador/sistema — fora do nosso controle de estilo.</p>
          </div>
        </>
      )}
    </div>
  );
}

export function ModalNotificacoes({ onAtivar, onAgoraNao, onFechar }: { onAtivar: () => void; onAgoraNao: () => void; onFechar: () => void }) {
  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: 214, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: '1px solid rgba(189,255,0,.3)', borderRadius: 22, padding: 26, boxShadow: '0 40px 90px -30px rgba(0,0,0,.8)', animation: `evkPop .3s ${EASE}` }}>
        <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Sino size={23} /></div>
        <h2 style={{ margin: '0 0 10px', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-.01em' }}>Quer lembretes do seu treino e refeições?</h2>
        <p style={{ margin: '0 0 22px', fontSize: '.94rem', color: 'rgba(234,229,219,.72)', lineHeight: 1.6 }}>Ativamos avisos simples pra te ajudar a manter o ritmo — <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>um toque, depois silêncio</strong>. Sem sequência de mensagens, sem cobrança. Desligue por tipo ou tudo de uma vez, quando quiser.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onAtivar} className="hov-btn" style={{ width: '100%', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 13, cursor: 'pointer' }}>Ativar</button>
          <button onClick={onAgoraNao} className="evk-voltar" style={{ width: '100%', background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '1rem', padding: 14, borderRadius: 13, cursor: 'pointer' }}>Agora não</button>
        </div>
      </div>
    </div>
  );
}
