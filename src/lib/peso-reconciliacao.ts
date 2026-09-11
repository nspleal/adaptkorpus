/**
 * 🔒 RECONCILIAÇÃO DO PESO — as duas decisões que o Painel precisa tomar quando uma resposta
 * de peso chega, isoladas do React para serem verificáveis sem renderizar.
 *
 * 🔴 R1 (revisão conjunta 2026-09-11): `aplicarPesoNoPerfil` lia o `perfil` CAPTURADO no
 * render. O callback de `registrarPesoServidor` guardava essa função antiga, então: perfil 80,
 * registro otimista 81, servidor recusa e devolve 80 → a comparação `pesoKg === perfil.pesoKg`
 * usava o 80 do closure, retornava antes de fazer nada, e o perfil ficava 81 com o histórico
 * 80. Pior: quando o peso aceito diferia, `{ ...perfil }` espalhava o perfil VELHO de volta e
 * podia desfazer edições feitas durante a espera.
 *
 * 🔴 R2: a hidratação com servidor não-vazio SUBSTITUÍA a série local inteira (perdendo
 * pesagens offline ainda não enviadas) e o reenvio só existia no ramo de servidor vazio — logo
 * um POST de peso que funcionou com um PUT de perfil que falhou nunca era reparado.
 *
 * 🔴 O QUE ESTAS FUNÇÕES NÃO FAZEM, DE PROPÓSITO: não reancoram (`evk_peso_plano` segue
 * exclusivo do *Editar perfil*), não recomputam plano e não mexem em mesociclo/deload. A
 * âncora do motor continua andando só pela política dela (≥ 3 pesagens em 7 dias, no máximo
 * 1×/semana, com as duas histereses).
 */
import { pesoKgDaResposta } from './peso-dominio';
import type { RegistroPeso } from './treino-historico';

/** Por que uma resposta NÃO virou mudança de perfil. Existe para o teste poder distinguir. */
export type MotivoDescarte =
  /** O componente saiu de cena antes da resposta (`setState` após unmount é vazamento). */
  | 'DESMONTADO'
  /** A gaveta local trocou de dono entre a ida e a volta — o peso é de outra pessoa. */
  | 'OUTRA_CONTA'
  /** Resposta sem peso legível (`null`, `''`, string, fora do domínio). Ver R4. */
  | 'FORA_DO_DOMINIO'
  /** Registro legado, sem dia declarado: não se sabe se é a pesagem vigente. */
  | 'SEM_DIA'
  /** A resposta é de OUTRO dia (tipicamente anterior): pesagem antiga não vira peso atual. */
  | 'DIA_NAO_GOVERNANTE'
  /** O perfil atual já é esse peso — nada a fazer, e nada a regravar. */
  | 'JA_CONVERGIDO';

export type DecisaoPerfil =
  | { aplicar: true; pesoKg: number }
  | { aplicar: false; motivo: MotivoDescarte };

/**
 * Decide se uma resposta de peso deve mover o peso do PERFIL, contra o estado ATUAL.
 *
 * `diaGovernante` é o dia cuja pesagem manda no perfil — e ele é diferente em cada caminho,
 * de propósito:
 *  · no REGISTRO, é o dia que a UI carimbou naquele registro (a pessoa acabou de se pesar;
 *    a resposta daquele dia é a que governa, mesmo que a volta atravesse a meia-noite);
 *  · na HIDRATAÇÃO e no REENVIO, é o DIA CIVIL CORRENTE — o reenvio de uma pesagem de terça
 *    conserta o ponto de terça no histórico e **não** encosta no peso de hoje.
 *
 * `pesoDoPerfilAgora` tem de ser lido no momento da resposta (ref/estado corrente), nunca o
 * capturado no render: é exatamente essa captura que era o R1.
 */
export function decidirPerfilAposResposta(e: {
  pesoAceito: unknown;
  diaDaResposta: string | null;
  diaGovernante: string;
  pesoDoPerfilAgora: number;
  montado: boolean;
  contaDaChamada: string | null;
  contaAgora: string | null;
}): DecisaoPerfil {
  if (!e.montado) return { aplicar: false, motivo: 'DESMONTADO' };
  if (e.contaDaChamada !== e.contaAgora) return { aplicar: false, motivo: 'OUTRA_CONTA' };
  const kg = pesoKgDaResposta(e.pesoAceito);
  if (kg === null) return { aplicar: false, motivo: 'FORA_DO_DOMINIO' };
  if (!e.diaDaResposta) return { aplicar: false, motivo: 'SEM_DIA' };
  if (e.diaDaResposta !== e.diaGovernante) return { aplicar: false, motivo: 'DIA_NAO_GOVERNANTE' };
  if (e.pesoDoPerfilAgora === kg) return { aplicar: false, motivo: 'JA_CONVERGIDO' };
  return { aplicar: true, pesoKg: kg };
}

/** Entrada da reconciliação de perfil — tudo lido NO MOMENTO da resposta. */
export type ContextoResposta = {
  pesoAceito: unknown;
  diaDaResposta: string | null;
  diaGovernante: string;
  montado: boolean;
  contaDaChamada: string | null;
  contaAgora: string | null;
};

export type PerfilReconciliado<P> =
  | { perfil: P; motivo: null }
  | { perfil: null; motivo: MotivoDescarte };

/**
 * Devolve o perfil NOVO a aplicar, ou `null` com o motivo do descarte.
 *
 * 🔴 R1 — a base do espalhamento é `perfilAtual`, que o chamador lê no momento da resposta
 * (um ref), nunca o objeto capturado quando o callback foi criado. É por isso que uma edição
 * feita DURANTE a espera sobrevive: ela já está em `perfilAtual`, e só `pesoKg` é trocado.
 */
export function reconciliarPerfilComPesoAceito<P extends { pesoKg: number }>(
  perfilAtual: P,
  e: Omit<ContextoResposta, 'pesoDoPerfilAgora'>,
): PerfilReconciliado<P> {
  const decisao = decidirPerfilAposResposta({ ...e, pesoDoPerfilAgora: perfilAtual.pesoKg });
  if (!decisao.aplicar) return { perfil: null, motivo: decisao.motivo };
  return { perfil: { ...perfilAtual, pesoKg: decisao.pesoKg }, motivo: null };
}

export type ReconciliacaoSerie = {
  /** Série a exibir e a gravar na cópia local: servidor por dia + locais pendentes. */
  serie: RegistroPeso[];
  /** Pesagens datadas que o servidor ainda não tem — precisam ser (re)enviadas. */
  pendentes: RegistroPeso[];
  /** Peso do DIA CIVIL CORRENTE na série resultante (`null` se não houve pesagem hoje). */
  pesoDeHoje: number | null;
  /** Locais sem data descartados por não terem dia com que reconciliar (só informativo). */
  legadosDescartados: number;
};

/**
 * Funde a série do SERVIDOR com a cópia LOCAL, por DIA.
 *
 * Regras, nesta ordem:
 *  1. **o servidor vence no dia que ele tem** — um registro por dia, e quem chegou primeiro
 *     é o que vale (índice único `logs_peso_por_dia_unico`). Duas abas, dois dispositivos e
 *     respostas fora de ordem convergem porque o valor do dia, no servidor, é imutável;
 *  2. **dia que só existe no local é PENDENTE**, não lixo: fica na série E entra em
 *     `pendentes` para ser reenviado. Era aqui que a pesagem feita offline desaparecia no
 *     reload — o ramo antigo trocava a série inteira pela do servidor;
 *  3. **servidor vazio** mantém o local inteiro e reenvia tudo (comportamento anterior,
 *     preservado), incluindo os legados sem data, que sobem sem data mesmo;
 *  4. **legado sem data com servidor não-vazio é descartado** — igual a antes, e por um
 *     motivo: sem dia não há como saber se ele já é um dos pontos do servidor, e reenviá-lo
 *     o carimbaria com hoje, colidindo com a pesagem de hoje. O número fica contado em
 *     `legadosDescartados` em vez de sumir sem registro.
 *
 * A saída sai ORDENADA por dia (sem data primeiro, na ordem original): a janela de 7 dias lê
 * por data, mas o gráfico lê por posição, e uma pesagem sincronizada dias depois entrava fora
 * de lugar na linha.
 */
export function reconciliarSeriePesos(
  locais: readonly RegistroPeso[],
  doServidor: readonly RegistroPeso[],
  hoje: string,
): ReconciliacaoSerie {
  if (doServidor.length === 0) {
    const serie = ordenarPorDia(locais);
    return {
      serie,
      pendentes: [...locais],
      pesoDeHoje: pesoNoDia(serie, hoje),
      legadosDescartados: 0,
    };
  }
  const diasDoServidor = new Set(doServidor.map((p) => p.dataISO).filter((d): d is string => !!d));
  const pendentes = locais.filter((p) => !!p.dataISO && !diasDoServidor.has(p.dataISO));
  const legadosDescartados = locais.filter((p) => !p.dataISO).length;
  const serie = ordenarPorDia([...doServidor, ...pendentes]);
  return { serie, pendentes, pesoDeHoje: pesoNoDia(serie, hoje), legadosDescartados };
}

function pesoNoDia(serie: readonly RegistroPeso[], dia: string): number | null {
  return serie.find((p) => p.dataISO === dia)?.kg ?? null;
}

/** Sem data primeiro (legados, sem eixo de tempo), depois por `dataISO` crescente. */
function ordenarPorDia(pesos: readonly RegistroPeso[]): RegistroPeso[] {
  const semData = pesos.filter((p) => !p.dataISO);
  const comData = pesos.filter((p) => !!p.dataISO)
    .sort((a, b) => (a.dataISO! < b.dataISO! ? -1 : a.dataISO! > b.dataISO! ? 1 : 0));
  return [...semData, ...comData];
}
