'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Exercise } from '@/lib/data/types';

/** Pointer capture keeps mouse, pen and touch on the same reorder path. */
export default function OrdemExercicios({ exercicios, onMover, children }: {
  exercicios: readonly Exercise[];
  onMover: (de: number, para: number) => void;
  children: (ex: Exercise, index: number) => ReactNode;
}) {
  const lista = useRef<HTMLDivElement>(null);
  const instrucao = useId();
  const gesto = useRef<{ de: number; para: number; y: number; inicio: number; scroll: number; centros: number[] } | null>(null);
  const frame = useRef(0);
  const [arrasto, setArrasto] = useState<{ de: number; para: number; dy: number } | null>(null);
  const [anuncio, setAnuncio] = useState('');
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function atualizar() {
    const g = gesto.current;
    if (!g) return;
    const margem = 72;
    const passo = g.y < margem ? -10 : g.y > window.innerHeight - margem ? 10 : 0;
    if (passo) window.scrollBy(0, passo);
    const yDocumento = g.y + window.scrollY - g.scroll;
    let alvo = g.de;
    for (let i = 0; i < g.centros.length; i++) {
      if (i < g.de && yDocumento < g.centros[i]!) { alvo = i; break; }
      if (i > g.de && yDocumento > g.centros[i]!) alvo = i;
    }
    g.para = alvo;
    const dy = g.y - g.inicio + window.scrollY - g.scroll;
    setArrasto((a) => a?.para === alvo && a.dy === dy ? a : { de: g.de, para: alvo, dy });
    frame.current = requestAnimationFrame(atualizar);
  }

  function finalizar(cancelado = false) {
    const g = gesto.current;
    gesto.current = null;
    cancelAnimationFrame(frame.current);
    setArrasto(null);
    if (!g) return;
    if (!cancelado && g.de !== g.para) onMover(g.de, g.para);
    const posicao = cancelado ? g.de : g.para;
    setAnuncio(cancelado ? 'Movimento cancelado.' : `${exercicios[g.de]?.nomePt}: posição ${posicao + 1} de ${exercicios.length}.`);
    requestAnimationFrame(() => lista.current?.querySelectorAll<HTMLButtonElement>('.ak-drag-handle')[posicao]?.focus({ preventScroll: true }));
  }

  return <>
    <p id={instrucao} style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.8)', margin: '0 0 12px' }}>Segure a alça e arraste para mudar a ordem. Pelo teclado, use ↑ e ↓ na alça.</p>
    <span role="status" aria-live="polite" className="sr-only">{anuncio}</span>
    <div ref={lista} role="list" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
      {exercicios.map((ex, k) => <div key={`${ex.id}-${k}`} role="listitem" className={`ak-order-row${arrasto?.de === k ? ' ak-order-dragging' : ''}${arrasto && arrasto.para === k && arrasto.de !== k ? (arrasto.de < k ? ' ak-drop-after' : ' ak-drop-before') : ''}`}
        style={{ transform: arrasto?.de === k ? `translateY(${arrasto.dy}px)` : undefined }}>
        <button type="button" className="ak-drag-handle" disabled={exercicios.length < 2} aria-label={`Mover ${ex.nomePt}, posição ${k + 1} de ${exercicios.length}`} aria-describedby={instrucao}
          onPointerDown={(e) => {
            if (e.button !== 0 || !e.isPrimary) return;
            e.currentTarget.focus({ preventScroll: true });
            e.currentTarget.setPointerCapture(e.pointerId);
            const centros = Array.from(lista.current!.children).map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
            gesto.current = { de: k, para: k, y: e.clientY, inicio: e.clientY, scroll: window.scrollY, centros };
            setArrasto({ de: k, para: k, dy: 0 });
            frame.current = requestAnimationFrame(atualizar);
          }}
          onPointerMove={(e) => { if (gesto.current) gesto.current.y = e.clientY; }}
          onPointerUp={() => finalizar()}
          onPointerCancel={() => finalizar(true)}
          onLostPointerCapture={() => { if (gesto.current) finalizar(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && gesto.current) { e.preventDefault(); finalizar(true); return; }
            if (gesto.current || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const alvo = e.key === 'Home' ? 0 : e.key === 'End' ? exercicios.length - 1 : Math.max(0, Math.min(exercicios.length - 1, k + (e.key === 'ArrowUp' ? -1 : 1)));
            onMover(k, alvo);
            setAnuncio(`${ex.nomePt}: posição ${alvo + 1} de ${exercicios.length}.`);
            requestAnimationFrame(() => lista.current?.querySelectorAll<HTMLButtonElement>('.ak-drag-handle')[alvo]?.focus());
          }}>
          <svg width="18" height="24" viewBox="0 0 18 24" fill="currentColor" aria-hidden="true">{[6, 12, 18].flatMap((y) => [5, 13].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" />))}</svg>
        </button>
        <div className="ak-order-content">{children(ex, k)}</div>
      </div>)}
    </div>
  </>;
}
