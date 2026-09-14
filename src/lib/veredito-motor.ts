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
 * 🔴 D12 — a frase da INCERTEZA. Separada de propósito da frase do excesso medido: o dia com
 * `LIMITE_INDETERMINADO` tem `min ≤ limite < max`, isto é, depende de quanto a pessoa demora
 * dentro da faixa estimada. Afirmar excesso aqui seria inventar a medição que faltou.
 */
function podeUltrapassar(rotina: Pick<RotinaSemanal, 'dias'>, indices: readonly number[]): string {
  const nomes = nomesDosDias(rotina, indices);
  return indices.length <= 1
    ? `${nomes} pode passar do seu tempo, dependendo do ritmo`
    : `${nomes} podem passar do seu tempo, dependendo do ritmo`;
}

/**
 * O veredito da geração, em uma frase que a pessoa entende — sem jargão de discriminante e
 * sem prometer o que o motor não mediu.
 */
export function vereditoDoPlano(
  rotina: Pick<RotinaSemanal, 'dias' | 'resultadoGeracao' | 'limiteTempoTreino'> | null | undefined,
  tempoPorSessaoMin: number,
): Veredito | null {
  const rg: ResultadoGeracaoRotina | undefined = rotina?.resultadoGeracao;
  if (!rotina || !rg) return null;
  switch (rg.tipo) {
    case 'CERTIFICADO':
      if(rotina.limiteTempoTreino==='sem_limite')return {tom:'ok',titulo:'Plano calculado sem limite de tempo por sessão.',detalhe:'O tempo livre não acrescenta exercícios ao plano.'};
      return {
        tom: 'ok',
        titulo: 'A duração calculada está dentro dos limites do app.',
        detalhe: rotina.limiteTempoTreino==='limitado' ? `Referência: ${tempoPorSessaoMin} min por sessão.` : `Referência: ${tempoPorSessaoMin} min por sessão. A musculação admite até ${TOLERANCIA_EXCESSO_SEG / 60} min adicionais; essa tolerância não vale para acrescentar cardio automático.`,
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
          rg.diasPodemUltrapassar?.length ? `${podeUltrapassar(rotina, rg.diasPodemUltrapassar)}.` : '',
        ].filter(Boolean).join(' ') || undefined,
      };
    /**
     * 🔴 D12 — DUAS AFIRMAÇÕES DIFERENTES, DUAS FRASES DIFERENTES. `ACIMA_DO_LIMITE_OPERACIONAL`
     * é excesso MEDIDO (`min > limite`); `LIMITE_INDETERMINADO` é `min ≤ limite < max` — o dia
     * PODE caber. Dizer "acima do limite" no segundo caso afirmaria um excesso que o motor não
     * mediu, que é o mesmo defeito de D12 com o sinal trocado.
     */
    case 'ENTREGUE_SEM_CERTIFICACAO': {
      const certo = rg.diasAcimaDoLimite.length > 0;
      const incerto = (rg.diasPodemUltrapassar ?? []).length > 0;
      return {
        tom: 'atencao',
        titulo: certo
          ? 'O plano foi gerado, mas há dias acima do limite de tempo.'
          : 'O plano foi gerado, mas não dá para garantir que todo dia caiba no seu tempo.',
        detalhe: [
          certo ? `Acima do limite: ${nomesDosDias(rotina, rg.diasAcimaDoLimite)}.` : '',
          incerto ? `${podeUltrapassar(rotina, rg.diasPodemUltrapassar!)}.` : '',
          'Revise o tempo disponível e as séries exibidas antes de iniciar.',
        ].filter(Boolean).join(' '),
      };
    }
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
