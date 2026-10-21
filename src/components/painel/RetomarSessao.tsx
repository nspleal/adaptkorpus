'use client';
import { useEffect, useState } from 'react';
import { bancoSync, EVENTO_SYNC } from '@/lib/persistencia/sync-cliente';
import { rascunhoDisponivel, type RascunhoLocal } from '@/lib/persistencia/rascunho-sessao';
import { escopoLocal } from '@/lib/escopo-local';
import { EVENTO_FATOS } from '@/lib/persistencia/sync-contrato';
import { continuacaoDaConta } from '@/lib/persistencia/continuidade-conta';
import { useGravacaoLocal } from '@/lib/persistencia/use-gravacao-local';
export const EVENTO_RETOMAR_SESSAO = 'evk:retomar-sessao';

/** Retoma o contexto capturado na abertura, mesmo que o plano da conta tenha mudado. */
export default function RetomarSessao({ ocupado, modoDiario }: { ocupado: boolean; modoDiario: boolean }) {
  const [rascunho, setRascunho] = useState<RascunhoLocal | null>(null);
  const gravacao = useGravacaoLocal();
  useEffect(() => {
    let vivo = true;
    const conta = escopoLocal(), ativo = continuacaoDaConta(escopoLocal, conta, () => vivo);
    const ler = async () => {
      const subject = conta; if (!subject || !ativo()) return;
      const r = await rascunhoDisponivel(await bancoSync(), subject);
      if (ativo()) setRascunho(r ?? null);
    };
    const listener = () => { void ler().catch(() => undefined); };
    listener(); window.addEventListener(EVENTO_SYNC, listener); window.addEventListener(EVENTO_FATOS, listener);
    return () => { vivo = false; window.removeEventListener(EVENTO_SYNC, listener); window.removeEventListener(EVENTO_FATOS, listener); };
  }, []);
  async function retomar() {
    const subject = escopoLocal(), escolhido = rascunho;
    if (!subject || !escolhido) return;
    const ativo = gravacao.capturarContinuacao();
    const atual = await rascunhoDisponivel(await bancoSync(), subject);
    if (!ativo()) return;
    setRascunho(atual ?? null);
    if (atual?.sessaoId === escolhido.sessaoId) window.dispatchEvent(new CustomEvent(EVENTO_RETOMAR_SESSAO, { detail: atual }));
  }
  if (ocupado || !rascunho || (modoDiario && rascunho.origem === 'guiada')) return null;
  return <button onClick={() => { void retomar().catch(() => undefined); }}>
    Retomar {rascunho.origem === 'manual' ? 'registro manual' : 'treino em andamento'}
  </button>;
}
