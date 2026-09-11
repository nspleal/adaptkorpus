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
  const gesto = useRef<{ de: number; para: number; y: number; inicio: number; scroll: number; centros: number[]; altura: number; min: number; max: number } | null>(null);
  const frame = useRef(0);
  const [arrasto, setArrasto] = useState<{ de: number; para: number; dy: number } | null>(null);
  const [anuncio, setAnuncio] = useState('');
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function atualizar() {
    const g = gesto.current;
    if (!g) return;
    const delta = Math.max(g.min, Math.min(g.max, g.y - g.inicio + window.scrollY - g.scroll));
    const yDocumento = g.centros[g.de]! + delta;
    let alvo = g.de;
    for (let i = 0; i < g.centros.length; i++) {
      if (i < g.de && yDocumento < g.centros[i]!) { alvo = i; break; }
      if (i > g.de && yDocumento > g.centros[i]!) alvo = i;
    }
    g.para = alvo;
    const dy = Math.max(g.min, Math.min(g.max, g.y - g.inicio + window.scrollY - g.scroll));
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
    requestAnimationFrame(() => lista.current?.querySelectorAll<HTMLDivElement>('.ak-order-row')[posicao]?.focus({ preventScroll: true }));
  }

  return <>
    <p id={instrucao} style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.8)', margin: '0 0 12px' }}>Arraste o bloco para mudar a ordem. Pelo teclado, foque o bloco e use ↑ ou ↓.</p>
    <span role="status" aria-live="polite" className="sr-only">{anuncio}</span>
    <div ref={lista} role="list" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, overflow: 'clip', padding: 3 }}>
      {exercicios.map((ex, k) => <div key={ex.id} role="listitem" tabIndex={0} aria-label={`Mover ${ex.nomePt}, posição ${k + 1} de ${exercicios.length}`} aria-describedby={instrucao}
        className={`ak-order-row ak-order-block${arrasto?.de === k ? ' ak-order-dragging' : ''}`}
        style={{ transform: arrasto ? `translateY(${arrasto.de === k ? arrasto.dy : k > arrasto.de && k <= arrasto.para ? -(gesto.current!.altura + 10) : k < arrasto.de && k >= arrasto.para ? gesto.current!.altura + 10 : 0}px)` : undefined, transition: arrasto?.de === k ? 'none' : 'transform .2s ease, border-color .18s ease, box-shadow .18s ease' }}
          onPointerDown={(e) => {
            if (e.button !== 0 || !e.isPrimary || exercicios.length < 2 || (e.target as HTMLElement).closest('button,input,select,a,textarea')) return;
            e.currentTarget.focus({ preventScroll: true });
            e.currentTarget.setPointerCapture(e.pointerId);
            const centros = Array.from(lista.current!.children).map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
            const rects = Array.from(lista.current!.children).map(el => el.getBoundingClientRect());
            const row = rects[k]!;
            gesto.current = { de: k, para: k, y: e.clientY, inicio: e.clientY, scroll: window.scrollY, centros, altura: row.height, min: rects[0]!.top - row.top, max: rects[rects.length - 1]!.bottom - row.bottom };
            setArrasto({ de: k, para: k, dy: 0 });
            frame.current = requestAnimationFrame(atualizar);
          }}
          onPointerMove={(e) => { if (gesto.current) gesto.current.y = e.clientY; }}
          onPointerUp={() => finalizar()}
          onPointerCancel={() => finalizar(true)}
          onLostPointerCapture={() => { if (gesto.current) finalizar(true); }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Escape' && gesto.current) { e.preventDefault(); finalizar(true); return; }
            if (gesto.current || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const alvo = e.key === 'Home' ? 0 : e.key === 'End' ? exercicios.length - 1 : Math.max(0, Math.min(exercicios.length - 1, k + (e.key === 'ArrowUp' ? -1 : 1)));
            onMover(k, alvo);
            setAnuncio(`${ex.nomePt}: posição ${alvo + 1} de ${exercicios.length}.`);
            requestAnimationFrame(() => lista.current?.querySelectorAll<HTMLDivElement>('.ak-order-row')[alvo]?.focus());
          }}>
        <div className="ak-order-content">{children(ex, k)}</div>
      </div>)}
    </div>
  </>;
}
