'use client';

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';

/**
 * "Fiquei doente" — a entrada + a folha de reconhecimento de pausa
 * (Leva 2 · Bloco 4, porte fiel de `design_handoff_fiquei_doente`; cofre
 * `parametros-motor-treino-evokorpus` §"Fiquei doente", DF 2026-07-27).
 *
 * 🔴 É um RECONHECIMENTO, não um comando. "Entendi" grava um carimbo de tempo e NADA MAIS:
 * não toca ciclo, volume, chama, agenda nem meta de cardio. O congelamento do mesociclo já
 * acontece sozinho desde o fix do relógio (`9ebf1bd`) e a rampa de retomada entra sozinha
 * pelo gatilho derivado — quem avisa e quem some têm o mesmo comportamento de motor.
 *
 * 🔴 Travas invioláveis do handoff, todas verificadas por teste ou smoke:
 *   · o app NÃO pergunta o motivo — zero `input`/`textarea`/`select` dentro da folha;
 *   · nada de "melhoras", conselho clínico ou avaliação de gravidade (fora do território
 *     clínico — princípio 4 do CLAUDE.md);
 *   · NENHUM contador de dias parados, em tela nenhuma;
 *   · `#E5484D` (Alerta) não aparece em pixel nenhum — ausência não é culpa;
 *   · ícone é o glifo de PAUSA. Nunca termômetro, cruz, coração, triângulo de alerta ou
 *     escudo (o escudo é da retomada).
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

/** Glifo de pausa (duas barras arredondadas) — `currentColor`, tamanho variável. */
function IconePausa({ size = 14, stroke }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x={8.4} y={5} width={2.9} height={14} rx={1.4} stroke={stroke ?? 'currentColor'} strokeWidth={1.7} />
      <rect x={13.7} y={5} width={2.9} height={14} rx={1.4} stroke={stroke ?? 'currentColor'} strokeWidth={1.7} />
    </svg>
  );
}

const botaoFolha: CSSProperties = {
  width: '100%', borderRadius: 12, cursor: 'pointer', minHeight: 44, boxSizing: 'border-box',
};

/**
 * Entrada no PÉ da aba Treino (abaixo da nota do RIR, separada por `border-top`). Reusa o
 * vocabulário do botão "Trocar" que já existe nos cartões — é o único controle de nível de
 * aba, e ficar igual aos controles honestos por exercício é o ponto da peça. Não é alerta:
 * sem moldura colorida, sem badge, sem Pulso, sem posição acima da dobra.
 */
export default function FiqueiDoente({ onReconhecer }: { onReconhecer: () => void }) {
  const [aberta, setAberta] = useState(false);
  const entradaRef = useRef<HTMLButtonElement>(null);
  const entendiRef = useRef<HTMLButtonElement>(null);
  const voltarRef = useRef<HTMLButtonElement>(null);
  const apoioId = useId();
  const tituloId = useId();
  const corpoId = useId();

  // Foco inicial em "Entendi", DENTRO do [role="dialog"]. `requestAnimationFrame` porque o
  // subtree pode não existir no frame em que o estado muda (nota do handoff).
  useEffect(() => {
    if (!aberta) return;
    const id = requestAnimationFrame(() => entendiRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [aberta]);

  // Fechar por qualquer via devolve o foco para a entrada.
  const fechar = useCallback(() => {
    setAberta(false);
    requestAnimationFrame(() => entradaRef.current?.focus());
  }, []);

  function confirmar() {
    onReconhecer();
    fechar();
  }

  // Ciclo de Tab FECHADO entre "Entendi" e "Voltar" (wrap nas duas direções) + Esc = "Voltar".
  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { e.stopPropagation(); fechar(); return; }
    if (e.key !== 'Tab') return;
    const entendi = entendiRef.current;
    const voltar = voltarRef.current;
    if (!entendi || !voltar) return;
    // Com dois focáveis, Tab e Shift+Tab são a MESMA alternância — o ciclo fecha nos dois
    // sentidos. Foco fora dos dois (na própria folha) cai em "Entendi".
    e.preventDefault();
    (document.activeElement === entendi ? voltar : entendi).focus();
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid rgba(234,229,219,.08)', marginTop: 18, paddingTop: 16 }}>
        <button
          ref={entradaRef}
          type="button"
          onClick={() => setAberta(true)}
          aria-haspopup="dialog"
          aria-expanded={aberta}
          aria-describedby={apoioId}
          className="evk-troca"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.85rem', padding: '11px 16px', borderRadius: 10, minHeight: 44, cursor: 'pointer' }}
        >
          <IconePausa />Fiquei doente
        </button>
        <span id={apoioId} style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.5)' }}>ou preciso parar um tempo</span>
      </div>

      {aberta && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onKeyDown={teclado}>
          {/* Véu decorativo: clique fecha (= "Voltar"). */}
          <div aria-hidden="true" onClick={fechar} style={{ position: 'absolute', inset: 0, background: 'rgba(6,18,11,.72)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', animation: `evkVeil .22s ease` }} />
          <div
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-labelledby={tituloId}
            aria-describedby={corpoId}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92vh', overflowY: 'auto', background: '#0F0F0E', borderTop: '1px solid rgba(234,229,219,.14)', borderRadius: '26px 26px 0 0', padding: '24px 20px 22px', boxShadow: '0 -20px 50px rgba(0,0,0,.45)', animation: `evkSheet .32s ${EASE}` }}
          >
            <div aria-hidden="true" style={{ width: 42, height: 4, borderRadius: 2, background: 'rgba(234,229,219,.2)', margin: '0 auto 18px' }} />
            <div style={{ maxWidth: 520, margin: '0 auto' }}>
              <h2 id={tituloId} style={{ margin: '0 0 14px', fontSize: '1.32rem', fontWeight: 800, letterSpacing: '-.025em' }}>Tudo bem parar.</h2>
              {/* 🔒 Copy literal do handoff — com a CORREÇÃO travada: "o PESO em cada série
                  continua o mesmo" (nunca "o esforço"). Com o RIR-alvo da rampa em 3, o
                  esforço por série CAI; o que não muda é a carga, e é ela que a pessoa
                  teme perder. Dizer "esforço" seria mentir na marca que se vende honesta. */}
              <div id={corpoId} style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 22 }}>
                <p style={{ margin: 0, fontSize: '.93rem', lineHeight: 1.6, color: '#EAE5DB', textWrap: 'pretty' }}>Doença, viagem, trabalho — o motivo não importa aqui, e o app não pergunta.</p>
                <p style={{ margin: 0, fontSize: '.89rem', lineHeight: 1.6, color: 'rgba(234,229,219,.68)', textWrap: 'pretty' }}>O seu ciclo não avança sem você. Ele conta semanas treinadas, não dias no calendário.</p>
                <p style={{ margin: 0, fontSize: '.89rem', lineHeight: 1.6, color: 'rgba(234,229,219,.68)', textWrap: 'pretty' }}>A sua Chama não zera. Ausência não apaga o que você já fez.</p>
                <p style={{ margin: 0, fontSize: '.89rem', lineHeight: 1.6, color: 'rgba(234,229,219,.68)', textWrap: 'pretty' }}>Quando você voltar, o app ajusta sozinho. Se a pausa passar de duas semanas, o treino volta com menos séries por algumas semanas — o peso em cada série continua o mesmo. Você não precisa configurar nada.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button ref={entendiRef} type="button" onClick={confirmar} className="hov-btn" style={{ ...botaoFolha, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.98rem', padding: 15, border: 'none' }}>Entendi</button>
                <button ref={voltarRef} type="button" onClick={fechar} className="evk-troca" style={{ ...botaoFolha, background: 'transparent', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.92rem', padding: 14 }}>Voltar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Aviso calmo (entre o cabeçalho da aba e a lista de exercícios). Sem data, sem contador,
 * sem botão de fechar: o treino oferecido é o MESMO da tela sem aviso — é isso que mostra,
 * sem dizer, que o ciclo não anda sem a pessoa.
 *
 * 🔒 Só entra quando a rampa de retomada NÃO está ativa (precedência dura: uma mensagem só).
 * `aria-live="polite"` anuncia uma vez; nunca `role="alert"` — não é urgência, é acolhimento.
 */
export function AvisoPausaReconhecida() {
  const tituloId = useId();
  return (
    <section
      aria-labelledby={tituloId}
      aria-live="polite"
      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'linear-gradient(168deg, rgba(22,163,74,.11), rgba(15,15,14,.55))', border: '1px solid rgba(22,163,74,.28)', borderRadius: 18, padding: '16px 17px', marginBottom: 20, animation: `evkPop .45s ${EASE}` }}
    >
      <span aria-hidden="true" style={{ width: 32, height: 32, minWidth: 32, borderRadius: 11, background: 'rgba(234,229,219,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconePausa size={16} stroke="rgba(234,229,219,.8)" />
      </span>
      <div>
        <h3 id={tituloId} style={{ margin: 0, fontSize: '.95rem', fontWeight: 700, lineHeight: 1.45, letterSpacing: '-.01em' }}>Pausa reconhecida — o seu plano espera.</h3>
        <p style={{ margin: '6px 0 0', fontSize: '.85rem', lineHeight: 1.55, color: 'rgba(234,229,219,.62)', textWrap: 'pretty' }}>Quando você voltar, o app ajusta o volume se precisar.</p>
      </div>
    </section>
  );
}
