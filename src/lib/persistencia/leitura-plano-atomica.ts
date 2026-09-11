/**
 * Leitura C1 do agregado persistido. Perfil e opções devem sair do MESMO payload
 * versionado pelo CAS: consultar tabelas separadas em paralelo pode misturar
 * snapshots de antes/depois de um commit concorrente.
 */
import type { PerfilResumo } from '@/components/painel/Painel';
import type { EntradaPlanoVisivel } from '@/lib/plano-cas-comando';
import { entradaPlanoVisivelSchema } from '@/lib/validation/plano-entrada';
import { perfilResumoSchema, sanearPerfilHidratado } from '@/lib/validation/perfil-resumo';

export type LeituraPlanoAtomica = {
  perfil: PerfilResumo;
  revision: number;
  entradaPlano: EntradaPlanoVisivel;
};

/**
 * Aceita somente o snapshot C1 completo, produzido na mesma transação que incrementa a revisão.
 * Payload malformado não pode cair em uma leitura híbrida perfil antigo + revisão nova.
 */
export function leituraAtomicaDoPlanoCas(raw: unknown): LeituraPlanoAtomica | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const cas = raw as { revision?: unknown; payload?: unknown };
  if (!Number.isSafeInteger(cas.revision) || (cas.revision as number) < 1) return null;
  if (typeof cas.payload !== 'object' || cas.payload === null) return null;

  const entrada = (cas.payload as { entrada?: unknown }).entrada;
  if (typeof entrada !== 'object' || entrada === null) return null;
  const candidato = entrada as { perfil?: unknown; opcoes?: unknown };
  const perfil = perfilResumoSchema.safeParse(candidato.perfil);
  const opcoes = entradaPlanoVisivelSchema.safeParse(candidato.opcoes);
  if (!perfil.success || !opcoes.success) return null;

  return {
    perfil: perfil.data as PerfilResumo,
    revision: cas.revision as number,
    entradaPlano: opcoes.data,
  };
}

/** Recuperação usa o MESMO snapshot/revisão; não o mistura com a tabela profile ou o cache. */
export function leituraParaCorrecaoDoPlanoCas(raw: unknown): LeituraPlanoAtomica | null {
  if (!raw || typeof raw !== 'object') return null;
  const cas = raw as { revision?: unknown; payload?: { entrada?: { perfil?: unknown; opcoes?: unknown } } };
  if (!Number.isSafeInteger(cas.revision) || (cas.revision as number) < 1) return null;
  const entrada = cas.payload?.entrada;
  const p = entrada?.perfil;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const opcoes = entradaPlanoVisivelSchema.safeParse(entrada?.opcoes);
  if (!opcoes.success) return null;
  const perfil = sanearPerfilHidratado(p as Record<string, unknown>) as unknown as PerfilResumo;
  if (!perfil.camposInvalidos?.length) return null;
  return { perfil, revision: cas.revision as number, entradaPlano: opcoes.data };
}
