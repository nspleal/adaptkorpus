import type { ResultadoGeracaoRotina, RotinaSemanal } from '@/lib/engine/treino-types';
import { TOLERANCIA_EXCESSO_SEG } from '@/lib/engine/duracao-sessao';

/**
 * 🔴 D1 (diagnóstico 2026-09-10, §6.2) — O VEREDITO E OS AVISOS DO MOTOR TÊM DONO NA TELA.
 *
 * Medido no SHA `34b2ede`: varredura de `src` (fora de `engine/` e dos testes) devolvia **zero
 * consumidores** de `rotina.avisos`, `rotina.resultadoGeracao` e `rotina.duracaoIncompativel`.
 * O montador construía nove famílias de aviso honesto — com o comentário *"o corte é dito"*,
 * *"a recusa que não explica é a recusa silenciosa com outro nome"* — e a pessoa não via
 * nenhuma. No caso medido "casa sem equipamento", 5 avisos foram computados e descartados.
 *
 * 🔒 Este módulo é PURO de propósito: ele traduz o discriminante em texto e nada mais. O
 * componente (`painel/AvisosMotor`) só renderiza o que sai daqui, então a regra de o quê a
 * pessoa lê em cada estado é testável em Node, sem DOM — o padrão que a casa já usa.
 *
 * ⚠️ Nenhum estado é silencioso. CERTIFICADO também fala: um veredito que só aparece quando
 * dá errado ensina a pessoa a ignorá-lo, e deixa `CERTIFICADO` sem prova de que chega à tela.
 */

export type TomVeredito = 'ok' | 'atencao' | 'bloqueio';

export interface Veredito {
  tom: TomVeredito;
  titulo: string;
  /** Linha de detalhe, quando o motor tem o quê detalhar. Nunca inventa motivo. */
  detalhe?: string;
}

/** Rótulo do dia pelo índice em `duracaoDias` (que é paralelo a `rotina.dias`). */
function nomesDosDias(rotina: Pick<RotinaSemanal, 'dias'>, indices: readonly number[]): string {
  const nomes = indices.map((i) => rotina.dias[i]?.nome ?? `dia ${i + 1}`);
  return nomes.length <= 1
    ? (nomes[0] ?? '')
    : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * O veredito da geração, em uma frase que a pessoa entende — sem jargão de discriminante e
 * sem prometer o que o motor não mediu.
 */
export function vereditoDoPlano(
  rotina: Pick<RotinaSemanal, 'dias' | 'resultadoGeracao'> | null | undefined,
  tempoPorSessaoMin: number,
): Veredito | null {
  const rg: ResultadoGeracaoRotina | undefined = rotina?.resultadoGeracao;
  if (!rotina || !rg) return null;
  switch (rg.tipo) {
    case 'CERTIFICADO':
      return {
        tom: 'ok',
        titulo: 'A duração calculada está dentro dos limites do app.',
        detalhe: `Referência: ${tempoPorSessaoMin} min por sessão. A musculação admite até ${TOLERANCIA_EXCESSO_SEG / 60} min adicionais; essa tolerância não vale para acrescentar cardio automático.`,
      };
    case 'NAO_AVALIADO_ENTREGAVEL':
      return {
        tom: 'atencao',
        titulo: 'Este plano está entregue, mas não conseguimos calcular a duração de tudo nele.',
        // Os motivos são códigos do motor; mostrá-los crus seria jargão, escondê-los seria
        // recusa silenciosa. Vão como detalhe, do jeito que o motor os nomeou.
        detalhe: [
          rg.motivos.length > 0 ? `Motivos: ${rg.motivos.map(m => m === 'CARDIO_SEM_DURACAO' ? 'cardio sem duração definida' : m).join(', ')}.` : '',
          rg.diasAcimaDoLimite?.length ? `Acima do limite de tempo: ${nomesDosDias(rotina, rg.diasAcimaDoLimite)}.` : '',
        ].filter(Boolean).join(' ') || undefined,
      };
    case 'ENTREGUE_SEM_CERTIFICACAO':
      return {
        tom: 'atencao',
        titulo: 'O plano foi gerado, mas há dias acima do limite de tempo.',
        detalhe: `Acima do limite: ${nomesDosDias(rotina, rg.diasAcimaDoLimite)}. Revise o tempo disponível e as séries exibidas antes de iniciar.`,
      };
    case 'INCOMPATIVEL':
      return {
        tom: 'bloqueio',
        titulo: `Não encontramos uma versão com a cobertura exigida dentro do limite de tempo para sessões de ${tempoPorSessaoMin} min.`,
        detalhe: 'Aumentar o tempo por sessão no seu perfil é o que abre espaço — não vamos cortar exercício a ponto de o treino deixar de cobrir os padrões básicos.',
      };
    case 'ERRO_ALOCADOR':
      return {
        tom: 'bloqueio',
        titulo: 'Não conseguimos montar um plano válido com estas escolhas.',
        detalhe: `Falha interna do montador (${rg.motivo}). Revise as escolhas e tente gerar novamente.`,
      };
  }
}
