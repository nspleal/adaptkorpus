import type { PerfilResumo } from '@/components/painel/Painel';
import type { EntradaPlanoVisivel } from '@/lib/plano-cas-comando';
import type { Consentimentos } from './perfil-profile';
import type { PerfilServidor, ResultadoSalvarPerfil } from './sync';

export type FonteCorrecao = {
  perfil: PerfilResumo;
  revision: number;
  entradaPlano?: EntradaPlanoVisivel;
  remoto: boolean;
};

/** A revisão acompanha o perfil efetivamente mostrado no formulário. Nunca o cache antigo. */
export async function carregarFonteCorrecao(
  local: Pick<FonteCorrecao, 'perfil' | 'entradaPlano'> | null,
  remoto: boolean,
  carregar: () => Promise<PerfilServidor | 'sem_perfil' | null>,
): Promise<FonteCorrecao | null> {
  if (!remoto) return local ? { ...local, revision: 0, remoto: false } : null;
  const servidor = await carregar();
  if (servidor === null) return null; // falha não significa ausência de perfil
  if (servidor === 'sem_perfil') return local ? { ...local, revision: 0, remoto: true } : null;
  return { ...servidor, remoto: true };
}

/** O questionário não edita pratos em descanso, desenho manual ou opções do mesociclo. */
export function mesclarPerfilCorrigido(anterior: PerfilResumo, formulario: PerfilResumo): PerfilResumo {
  return {
    ...anterior, ...formulario,
    pratosCansados: anterior.pratosCansados ?? [],
    camposInvalidos: undefined, avisosHidratacao: undefined,
  };
}

/** Uma tentativa CAS. Conflito exige releitura deliberada, nunca sobrescrita automática. */
export async function persistirCorrecao(
  fonte: FonteCorrecao,
  perfil: PerfilResumo,
  consentimentos: Consentimentos,
  salvar: (p: PerfilResumo, r: number, e?: EntradaPlanoVisivel, c?: Consentimentos) => Promise<ResultadoSalvarPerfil>,
): Promise<{ ok: true; entradaPlano?: EntradaPlanoVisivel } | { ok: false; mensagem: string }> {
  if (!fonte.remoto) return { ok: true, entradaPlano: fonte.entradaPlano };
  const r = await salvar(perfil, fonte.revision, fonte.entradaPlano, consentimentos);
  if (r.tipo === 'CONFIRMADO') return { ok: true, entradaPlano: r.entradaPlano };
  return {
    ok: false,
    mensagem: r.tipo === 'CONFLITO_REVISAO' || r.tipo === 'CONFLITO_VERSAO_OU_HASH'
      ? 'Seu perfil mudou enquanto você conferia os dados. Não sobrescrevemos a outra versão. Recarregue esta página para conferir os dados atuais.'
      : 'Não conseguimos salvar a correção no servidor. Suas respostas continuam nesta tela; tente salvar novamente.',
  };
}
