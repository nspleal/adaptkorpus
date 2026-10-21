'use client';
import { continuacaoDaConta } from './continuidade-conta';
import { createClient } from '@/lib/supabase/client';
import { baixarArquivo } from '@/lib/export';
import { cabecalhosSync } from './sync-contrato';

/** A sessão local só protege a ação da interface; o servidor autentica a exportação. */
export async function mesmaContaNaAba(subject: string): Promise<boolean> {
  const { data: { session } } = await createClient().auth.getSession();
  return session?.user.id === subject;
}

export async function baixarDadosCompletosDaConta(subject: string, vivo: () => boolean = () => true): Promise<void> {
  const ativo = continuacaoDaConta(() => subject, subject, vivo);
  if (!await mesmaContaNaAba(subject) || !ativo()) throw new Error('conta_mudou');
  const resposta = await fetch('/api/lgpd/exportar', {
    cache: 'no-store', headers: cabecalhosSync(subject), signal: AbortSignal.timeout(30_000),
  });
  if (!ativo()) throw new Error('conta_mudou');
  if (!resposta.ok) throw new Error('exportacao_indisponivel');
  const dados = await resposta.json() as { usuario?: { id?: string } };
  if (!ativo() || dados.usuario?.id !== subject || !await mesmaContaNaAba(subject) || !ativo()) throw new Error('conta_mudou');
  baixarArquivo('adaptkorpus-meus-dados.json', JSON.stringify(dados, null, 2));
}
