import { ROTULO_GRUPO } from '@/lib/frequencia-grupos';
import type { RotinaSemanal } from '@/lib/engine';

/**
 * 🔒 B2 — O RAMO DO FOCO É DITO NA TELA (DF do autor, 2026-08-14).
 *
 * 🔑 Por que isto existe: **trocar o foco e não ver nada é indistinguível de quebrado.** Foi
 * exatamente o que transformou o 1º teste do autor em ambiguidade — ele focou peito → costas,
 * nada mudou, e não havia como saber se o motor tinha decidido "ordem" (correto) ou se o fio
 * estava cortado (o defeito). O silêncio custou uma rodada inteira de medição.
 *
 * 🔒 Os cinco ramos saem SEPARADOS de propósito. Os dois motivos do degrau ③ dizem coisas
 * diferentes e não podem sair na mesma frase:
 *  · `focado_no_teto` — o grupo já está no topo do volume dele. É boa notícia;
 *  · `compensador_no_piso` — **não há de onde tirar**. É a frase que diz a verdade ao
 *    avançado, cujos grupos já estão todos no volume mínimo, e é o que evita que ele leia a
 *    tela como quebrada.
 *
 * 📌 Assimetria declarada (a DF pede que ela apareça): o foco entrega **+N séries** quando
 * cabe na folga, ou **+1 exercício** quando move um slot. São grandezas diferentes, e a tela
 * diz qual das duas aconteceu — nunca um "pronto!" genérico.
 *
 * PURA: recebe a decisão que o motor já tomou e devolve texto. Sem promessa de resultado,
 * sem tom de falha (a ausência de entrega descreve o arranjo, não acusa a pessoa).
 */
export function fraseDoFoco(rotina: RotinaSemanal | null | undefined): string | null {
  const bloco = rotina?.blocoFoco;
  if (bloco) {
    const grupos = bloco.grupos.map(g => ROTULO_GRUPO[g] ?? g).join(' e ');
    const n = bloco.adicionais.length;
    return n > 0
      ? `${grupos} em foco: ${n} exercício${n === 1 ? '' : 's'} ${n === 1 ? 'adicional' : 'adicionais'} no plano, com ${bloco.adicionais.reduce((total, a) => total + a.series, 0)} séries ao todo.`
      : `${grupos} em foco: não foi possível acrescentar exercícios neste plano. Confira os limites indicados.`;
  }
  const f = rotina?.foco;
  if (!f) return null;
  const grupo = ROTULO_GRUPO[f.grupo] ?? f.grupo;
  const cede = ROTULO_GRUPO[f.compensa] ?? f.compensa;

  if (f.degrau === 'serie') {
    const s = f.series === 1 ? '1 série' : `${f.series} séries`;
    return `${grupo} em foco: +${s} nesta semana, cedida${f.series === 1 ? '' : 's'} por ${cede}.`;
  }
  if (f.degrau === 'slot') {
    return `${grupo} em foco: +1 exercício nesta semana, cedido por ${cede}.`;
  }

  // ③ ORDEM — cada motivo tem a sua frase, porque cada um é um fato diferente.
  switch (f.motivo) {
    case 'delta_zero':
      return `${grupo} em foco: nesta semana o foco entrega prioridade, não séries — ${grupo.toLowerCase()} vem primeiro na sessão.`;
    case 'focado_no_teto':
      return `${grupo} já está no topo do seu volume — vem primeiro na sessão.`;
    case 'compensador_no_piso':
      return `Não há de onde tirar: todos os grupos deste dia já estão no volume mínimo. ${grupo} vem primeiro na sessão.`;
    /**
     * 🔒 C6 — o fato é o arranjo da semana, não uma falha da pessoa nem do grupo escolhido:
     * o slot existia, mas movê-lo deixaria a semana com mais empurrar que puxar.
     */
    case 'equilibrio_puxar_empurrar':
      return `Mover um exercício de ${cede.toLowerCase()} para ${grupo.toLowerCase()} deixaria a semana com mais empurrar que puxar, e o motor mantém puxar ao menos igual a empurrar (ombro). ${grupo} vem primeiro na sessão.`;
    case 'transferencia_nao_realizada':
      return `Não foi possível transferir um exercício de ${cede.toLowerCase()} para ${grupo.toLowerCase()} nesta semana. ${grupo} vem primeiro na sessão.`;
    case 'sem_dia_comum':
      return `${cede} não treina no mesmo dia que ${grupo.toLowerCase()}, então não tem como ceder volume. Escolha um grupo que divida o dia — por enquanto, ${grupo.toLowerCase()} vem primeiro na sessão.`;
    default:
      return `${grupo} vem primeiro na sessão.`;
  }
}
