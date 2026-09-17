'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Exercise } from '@/lib/data/types';
import type { ElegibilidadeFavorito } from '@/lib/favoritos-elegibilidade';

/**
 * Favoritos (⭐ V8.2) — porte fiel do protótipo `Adaptkorpus Favoritos.dc.html`:
 *  - <EstrelaFavorito>: botão 42px, contorno Bone quando não-favoritado / preenchido
 *    Pulso quando favoritado, com `evkStarPop` só na transição de estado.
 *  - <BadgeFavorito>: pílula "Favorito" (contorno neon + texto Bone — distinta da tag
 *    "trocado") quando o montador incluiu por preferência.
 *  - <MeusFavoritos>: seção do Editar-perfil (irmã de "Alimentos que você não gosta"),
 *    com etiqueta honesta de descompasso (4 motivos travados, NUNCA vermelho), remover
 *    reversível via <ToastDesfazer> (4,5 s; sair da tela = confirma) e estado vazio
 *    como convite. DF B5 2026-07-04.
 */

const STAR_PATH = 'M12 3.4l2.62 5.31 5.86.85-4.24 4.13 1 5.84L12 16.9l-5.24 2.76 1-5.84-4.24-4.13 5.86-.85z';

export function EstrelaFavorito({ favoritado, onToggle, tamanho = 42, iconSize = 21 }: {
  favoritado: boolean;
  onToggle: () => void;
  tamanho?: number;
  iconSize?: number;
}) {
  // Anima SÓ na transição de estado (nunca em cada render — spec do protótipo).
  const [pop, setPop] = useState(false);
  const primeiro = useRef(true);
  useEffect(() => {
    if (primeiro.current) { primeiro.current = false; return; }
    setPop(true);
    const t = setTimeout(() => setPop(false), 340);
    return () => clearTimeout(t);
  }, [favoritado]);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      aria-pressed={favoritado}
      style={{
        width: tamanho, height: tamanho, minWidth: tamanho, borderRadius: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'border-color .2s ease, background .2s ease',
        ...(favoritado
          ? { background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.35)' }
          : { background: 'none', border: '1px solid rgba(234,229,219,.16)' }),
      }}
    >
      <span style={{ display: 'flex', animation: pop ? 'evkStarPop .32s cubic-bezier(.22,.61,.36,1)' : undefined }}>
        {favoritado
          ? <svg width={iconSize} height={iconSize} viewBox="0 0 24 24"><path d={STAR_PATH} fill="#BDFF00" /></svg>
          : <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none"><path d={STAR_PATH} stroke="rgba(234,229,219,.55)" strokeWidth={1.6} strokeLinejoin="round" /></svg>}
      </span>
    </button>
  );
}

/** Pílula "Favorito" — transparência de "por que isso está aqui de novo" (B5: todo favorito no plano). */
export function BadgeFavorito() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '.66rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'rgba(234,229,219,.85)', background: 'rgba(189,255,0,.06)', border: '1px solid rgba(189,255,0,.4)', borderRadius: 999, padding: '3px 10px 3px 8px' }}>
      <svg width={11} height={11} viewBox="0 0 24 24"><path d={STAR_PATH} fill="#BDFF00" /></svg>
      Favorito
    </span>
  );
}

/** Toast não-modal com "Desfazer" (4,5 s; some sozinho — sair da tela = confirma). */
export function ToastDesfazer({ mensagem, onDesfazer, onExpirar }: {
  mensagem: string;
  onDesfazer: () => void;
  onExpirar: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onExpirar, 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 320, display: 'flex', alignItems: 'center', gap: 14, background: '#10241a', border: '1px solid rgba(234,229,219,.16)', borderRadius: 13, padding: '13px 16px', boxShadow: '0 24px 55px -22px rgba(0,0,0,.75)', animation: 'evkToastIn .3s cubic-bezier(.22,.61,.36,1)' }}>
      <span style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.85)' }}>{mensagem}</span>
      <button onClick={onDesfazer} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#BDFF00', fontWeight: 700, fontSize: '.88rem', cursor: 'pointer', padding: 0 }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        Desfazer
      </button>
    </div>
  );
}

/**
 * Seção "Meus favoritos" (Editar perfil — irmã do bloco de alimentos). Read/write no
 * estado local do formulário (persiste no Salvar, como o "não gosto").
 */
export function MeusFavoritos({ favoritos, exercicioPorId, elegibilidadeDe, onRemover }: {
  favoritos: readonly string[];
  exercicioPorId: (id: string) => Exercise | undefined;
  /** Avaliação de descompasso por favorito (motivo travado quando não elegível). */
  elegibilidadeDe: (ex: Exercise) => ElegibilidadeFavorito;
  onRemover: (id: string) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: '.8rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 6 }}>Meus favoritos</div>
      <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.5 }}>Exercícios que você gosta e quer ver com frequência — o montador prioriza sempre que couber no seu plano.</p>
      {favoritos.length === 0 ? (
        <div style={{ border: '1px dashed rgba(234,229,219,.16)', borderRadius: 16, padding: '22px 18px', textAlign: 'center' }}>
          <div style={{ width: 42, height: 42, margin: '0 auto 10px', borderRadius: 12, background: 'rgba(189,255,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none"><path d={STAR_PATH} stroke="#BDFF00" strokeWidth={1.6} strokeLinejoin="round" /></svg>
          </div>
          <p style={{ margin: 0, fontSize: '.88rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.55 }}>Você ainda não marcou nenhum exercício como favorito. Toque na estrela em qualquer exercício do seu treino para ele aparecer sempre que couber.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {favoritos.map((id) => {
            const ex = exercicioPorId(id);
            if (!ex) return null;
            const eleg = elegibilidadeDe(ex);
            return (
              <div key={id} style={{ background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: '13px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>{ex.nomePt}</div>
                  <div style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.5)' }}>{ex.grupoMuscular}</div>
                  {/* Descompasso honesto (Estado 5): motivo travado, Bone neutro — NUNCA vermelho. */}
                  {!eleg.elegivel && eleg.motivo && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 7, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 999, padding: '4px 11px', fontSize: '.74rem', color: 'rgba(234,229,219,.55)' }}>
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={1.8} /><path d="M12 11v5M12 8.2v.01" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>
                      Não aparece agora — {eleg.motivo}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <EstrelaFavorito favoritado onToggle={() => onRemover(id)} iconSize={20} />
                  <button onClick={() => onRemover(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(234,229,219,.16)', color: 'rgba(234,229,219,.7)', fontSize: '.8rem', fontWeight: 600, padding: '9px 12px', borderRadius: 10, cursor: 'pointer' }}>
                    <span style={{ fontSize: '1rem', lineHeight: 1 }}>×</span>Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 🎛️ v3 · Bloco A — O CAMINHO DE VOLTA do *"não quero mais este"*.
 *
 * 🔴 Existe porque a confirmação do banimento diz *"se mudar de ideia, dá para trazer de
 * volta em Editar perfil"* — e copy que promete um controle inexistente é a classe de
 * defeito que este projeto vem fechando lote após lote. **A frase e o botão entram juntos.**
 *
 * Espelho NEGATIVO de "Meus favoritos", na mesma família de preferências.
 */
export function ExerciciosBanidos({ banidos, exercicioPorId, onRestaurar }: {
  banidos: readonly string[];
  exercicioPorId: (id: string) => Exercise | undefined;
  onRestaurar: (id: string) => void;
}) {
  if (banidos.length === 0) return null; // sem banimento, sem seção: nada a explicar
  return (
    <div>
      <div style={{ fontSize: '.8rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 6 }}>Fora do meu plano</div>
      <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.5 }}>Exercícios que você pediu para não ver mais. O montador não os usa — e você pode trazer qualquer um de volta quando quiser.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {banidos.map((id) => {
          const ex = exercicioPorId(id);
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 12, padding: '11px 13px' }}>
              <span style={{ fontSize: '.92rem', color: 'rgba(234,229,219,.82)' }}>{ex?.nomePt ?? id}</span>
              <button type="button" onClick={() => onRestaurar(id)} style={{ background: 'none', border: '1px solid rgba(189,255,0,.4)', color: '#BDFF00', fontWeight: 600, fontSize: '.84rem', padding: '7px 13px', borderRadius: 10, cursor: 'pointer', minHeight: 36 }}>Trazer de volta</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 🎛️ v3 · Bloco B — O GRUPO EM FOCO (pedido nº 4 do beta: *"selecionar grupo muscular em foco"*).
 *
 * 🔒 Copy travada em duas frentes:
 *  · **1 grupo por vez, 4–6 semanas** — a janela é declarada, não sugerida;
 *  · **quem já está no topo do volume não ganha séries: ganha ORDEM.** Prometer volume a
 *    quem está no MRV seria prometer o que o teto duro proíbe.
 */
export function GrupoEmFoco({ grupos, foco, compensa, onFoco, onCompensa, manual = false }: {
  manual?: boolean;
  grupos: readonly { id: string; rotulo: string }[];
  foco: string | null;
  compensa: string | null;
  onFoco: (id: string | null) => void;
  onCompensa: (id: string | null) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: '.8rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 6 }}>Grupo em foco</div>
      {/**
        * 🔒 A segunda frase é CONDICIONAL de propósito (DF 2026-08-05). A saída por ORDEM não
        * existe para o core: sem folga, o core recebe RECUSA EXPLICADA e o foco não é salvo.
        * Prometer "passa a vir primeiro na sessão" a quem escolheu Core seria copy que
        * pressupõe uma prescrição inexistente — a classe de vazamento que já custou caro.
        */}
      <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.5 }}>
        Um foco por vez, por 4 a 6 semanas. {foco !== 'core' ? 'Na nova montagem automática, o foco acrescenta até dois exercícios de duas séries. Braços e pernas dividem esse bloco entre seus componentes. Em um dia de treino, o foco fica com dois exercícios no total. O tempo disponível pode reduzir o bloco.' : ''}{' '}
        {foco === 'core'
          ? (manual
            ? 'No core personalizado, as séries entram nos exercícios existentes mediante compensação. Sem folga, o app avisa e não ativa o foco.'
            : 'No core automático, até duas séries adicionais na semana entram nos exercícios existentes, sem retirar séries de outros grupos. Os dias não mudam; sem margem de volume e tempo, o app informa que não houve adição.')
          : 'Braços e ombros vêm primeiro na sessão. O treino personalizado mantém seus exercícios e sua ordem.'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => { onFoco(null); onCompensa(null); }} aria-pressed={foco === null} style={pill(foco === null)}>Nenhum</button>
        {[...grupos, { id: 'bracos', rotulo: 'Braços' }, { id: 'pernas', rotulo: 'Pernas' }].map((g) => (
          <button key={g.id} type="button" onClick={() => onFoco(g.id)} aria-pressed={foco === g.id} style={pill(foco === g.id)}>{g.rotulo}</button>
        ))}
      </div>
      {manual && foco === 'core' && (
        <>
          <div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.5)', marginBottom: 6 }}>Qual grupo cede as séries?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {grupos.filter((g) => g.id !== foco).map((g) => (
              <button key={g.id} type="button" onClick={() => onCompensa(g.id)} aria-pressed={compensa === g.id} style={pill(compensa === g.id)}>{g.rotulo}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const pill = (ativo: boolean): CSSProperties => ({
  background: ativo ? 'rgba(189,255,0,.14)' : 'none',
  border: `1px solid ${ativo ? 'rgba(189,255,0,.5)' : 'rgba(234,229,219,.18)'}`,
  color: ativo ? '#BDFF00' : 'rgba(234,229,219,.8)',
  fontWeight: 600, fontSize: '.86rem', padding: '8px 14px', borderRadius: 999, cursor: 'pointer', minHeight: 40,
});

/**
 * 🎛️ v4 · DF③ (2026-08-12) — A DIVISÃO DE TREINO COMO ESCOLHA.
 *
 * 🔒 Copy honesta, sem promessa de resultado: cada opção diz o que MUDA na montagem, não o
 * que ela "entrega". `auto` é o default declarado — quem nunca tocar aqui continua com o
 * padrão por dias disponíveis (ninguém ganha divisão que não pediu).
 *
 * ⚠️ Prioridades tem template travado para 4 dias de treino (o exemplo do autor); nos
 * demais a montagem cai no padrão por dias — e a copy avisa, em vez de fingir.
 */
export const ROTULO_DIVISAO: Record<'auto' | 'superior-inferior' | 'prioridades', string> = {
  'auto': 'Automática',
  'superior-inferior': 'Superior / Inferior',
  'prioridades': 'Por prioridades',
};

export function SeletorDivisao({ divisao, onDivisao }: {
  divisao: 'auto' | 'superior-inferior' | 'prioridades';
  onDivisao: (d: 'auto' | 'superior-inferior' | 'prioridades') => void;
}) {
  return (
    <div>
      <div style={{ fontSize: '.8rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 6 }}>Divisão de treino</div>
      <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.5 }}>
        Como os grupos se distribuem pelos seus dias. {divisao === 'prioridades'
          ? 'Dias por tema (ex.: peito+ombros num dia, braços completos noutro). Vale com 4 dias de treino; com outra agenda, a montagem automática assume.'
          : divisao === 'superior-inferior'
            ? 'Dias de parte de cima e dias de parte de baixo, alternados conforme a sua agenda.'
            : 'O app escolhe pela sua agenda: corpo inteiro com poucos dias, superior/inferior com mais.'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(ROTULO_DIVISAO) as Array<keyof typeof ROTULO_DIVISAO>).map((d) => (
          <button key={d} type="button" onClick={() => onDivisao(d)} aria-pressed={divisao === d} style={pill(divisao === d)}>{ROTULO_DIVISAO[d]}</button>
        ))}
      </div>
    </div>
  );
}
