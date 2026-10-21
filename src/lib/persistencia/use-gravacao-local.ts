'use client';
import { useEffect, useRef, useState } from 'react';
import { escopoLocal } from '@/lib/escopo-local';
import { continuacaoDaConta } from './continuidade-conta';

/** A Promise termina no commit local. ACK remoto continua sendo responsabilidade da outbox. */
export function useGravacaoLocal() {
  const trava = useRef(false), vivo = useRef(true), vida = useRef(0);
  const [gravando, setGravando] = useState(false), [erro, setErro] = useState(false);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; vida.current += 1; }; }, []);
  function capturarVida() {
    const inicio = vida.current;
    return () => vivo.current && vida.current === inicio;
  }
  function capturarContinuacao() {
    return continuacaoDaConta(escopoLocal, escopoLocal(), capturarVida());
  }
  async function gravar(trabalho: () => void | Promise<void>, confirmar?: () => void): Promise<boolean> {
    if (trava.current) return false;
    const valido = capturarContinuacao();
    if (!valido()) return false;
    trava.current = true; setGravando(true); setErro(false);
    try {
      await trabalho();
      if (!valido()) return false;
      confirmar?.();
      return true;
    } catch {
      if (valido()) setErro(true);
      return false;
    } finally {
      trava.current = false;
      if (valido()) setGravando(false);
    }
  }
  return { gravar, gravando, erro, capturarContinuacao, capturarVida };
}
