import type { ResultadoTreino } from './engine';

/** Ausência de composição obrigatória não autoriza substituir o plano anterior.
 * Decisão de Nicolas, 20/09. Não altera o gate de saúde nem o desenho manual.
 */
export function impedimentosDaGeracao(treino: ResultadoTreino): string[] {
  const r=treino.rotina?.resultadoGeracao;
  if (r?.tipo === 'ERRO_ALOCADOR') return ['A nova geração não foi aceita: não foi possível montar um plano que cumpra as regras.', ...r.violacoesInvariantes];
  if (r?.tipo === 'MINIMOS_NAO_ATENDIDOS' || r?.tipo === 'TETO_SEMANAL_NAO_ATENDIDO' || r?.tipo === 'TETO_SESSAO_NAO_ATENDIDO') return r.motivos;
  if (r?.tipo !== 'INCOMPATIVEL') return [];
  const rotina = treino.rotina!;
  const tempo = (seg: number) => `${Math.floor(seg / 60)} min ${Math.round(seg % 60)} s`;
  return [
    'A nova geração não foi aceita: a composição não foi certificada para o tempo disponível.',
    ...(rotina.duracaoDias ?? []).flatMap((d, i) => {
      const min = d.duracaoMinimaEstimadaSegundos;
      const max = d.duracaoMaximaEstimadaSegundos;
      return min == null ? [] : [`${rotina.dias[i]?.nome ?? `Dia ${i + 1}`}: duração mínima calculada ${tempo(min)}${max == null ? '' : `; máxima estimada ${tempo(max)}`}.`];
    }),
    ...rotina.avisos.filter(a => a.startsWith('Piso de séries atingido:')),
  ];
}
