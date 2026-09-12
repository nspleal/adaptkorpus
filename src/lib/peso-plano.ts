'use client';

/**
 * A ponte entre a série de pesagens e o motor (Leva D, DF 2026-07-31).
 *
 * O módulo puro (`engine/peso-suavizado`) decide **o que** o peso do plano deve ser; aqui só
 * se guarda e se lê o estado que a decisão precisa (`evk_peso_plano`) e se monta o predicado
 * de faixa protetiva a partir do gate de saúde.
 *
 * 🔒 Nada de relógio nem de storage no motor: `hojeISO` entra por parâmetro e o estado entra
 * por `anterior`. Este arquivo é o único que toca `localStorage` para o peso do plano.
 */

import { avaliarGateSaude } from '@/lib/engine';
import type { PerfilUsuario } from '@/lib/engine';
import {
  reancorar,
  resolverPesoDoPlano,
  type EstadoPesoPlano,
  type Pesagem,
} from '@/lib/engine/peso-suavizado';
import { chaveLocal } from '@/lib/escopo-local';
import type { PerfilResumo } from '@/components/painel/Painel';

/** Os campos que o gate de saúde realmente lê — `PerfilResumo` os satisfaz. */
type PerfilDoGate = Pick<PerfilResumo, 'sexo' | 'alturaCm' | 'idade' | 'nivelAtividade' | 'objetivo' | 'flagsSaude'>;
import type { RegistroPeso } from '@/lib/treino-historico';

const KEY = 'evk_peso_plano' as const;

/** Lê a âncora persistida. `null` = nunca resolvida (primeira vez / storage indisponível). */
export function lerEstadoPesoPlano(): EstadoPesoPlano | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(chaveLocal(KEY));
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<EstadoPesoPlano> | null;
    if (!o || !Number.isFinite(o.ancoraKg) || typeof o.ancoraDesdeISO !== 'string') return null;
    const f = o.faixa;
    return {
      ancoraKg: o.ancoraKg as number,
      ancoraDesdeISO: o.ancoraDesdeISO,
      faixa: {
        ativa: !!f?.ativa,
        foraDesdeISO: typeof f?.foraDesdeISO === 'string' ? f.foraDesdeISO : null,
        // ⚠️ Estado gravado ANTES do refinamento não tem o campo. `true` é o default
        // conservador: âncora antiga é tratada como MEDIDA, então a carência de 14 dias
        // continua valendo para ela. Assumir `false` abriria a saída por teclado no upgrade.
        porMedicao: f?.porMedicao !== false,
      },
      pesoNaFaixaKg: Number.isFinite(o.pesoNaFaixaKg) ? (o.pesoNaFaixaKg as number) : null,
      ancoraMedida: o.ancoraMedida !== false,
      reancoraISO: typeof o.reancoraISO === 'string' ? o.reancoraISO : null,
    };
  } catch {
    return null;
  }
}

function gravarEstadoPesoPlano(estado: EstadoPesoPlano): void {
  try { localStorage.setItem(chaveLocal(KEY), JSON.stringify(estado)); } catch { /* storage indisponível */ }
}

/**
 * As pesagens que a JANELA aceita: só as que têm data.
 *
 * 🔒 Registro legado (`dataISO: null`) fica de fora **de propósito** — sem data não existe
 * "últimos 7 dias", e chutar uma data produziria a média de uma série que não aconteceu.
 * Ele continua no gráfico (`lerPesosKg`); o que ele não faz é entrar em conta que o gate lê.
 */
export function pesagensDatadas(pesos: readonly RegistroPeso[]): Pesagem[] {
  return pesos
    .filter((p): p is RegistroPeso & { dataISO: string } => typeof p.dataISO === 'string')
    .map((p) => ({ dataISO: p.dataISO, kg: p.kg }));
}

/**
 * O predicado de faixa protetiva: o gate trata ESTE peso com comportamento protetivo?
 *
 * "Protetivo" = qualquer coisa que não seja `PERMITIR` (ROTEAR, RESTRINGIR, PISAR). Note que
 * uma condição clínica declarada mantém o gate protetivo em QUALQUER peso — e é isso mesmo:
 * a carência de saída só existe para quem saiu por causa do peso.
 *
 * 🔑 **O critério é DERIVADO do gate, não uma lista de cortes de IMC — e é isso que faz o
 * eixo kcal entrar de graça** (DF 2026-08-01, `gate-de-saude-adaptkorpus` §Histerese
 * assimétrica). `GET ≤ piso_seguro → ROTEAR` é `!== 'PERMITIR'` como qualquer outro desfecho
 * protetivo, então ele já herda *entrar a cada leitura · sair em 14 dias*. ⚠️ Trocar isto por
 * uma checagem de faixas de IMC reabriria o buraco em silêncio: existe peso que cruza o piso
 * calórico com **IMC 22,2**, longe de todo corte — invisível para qualquer regra de IMC.
 * Guard que executa esse caso: `peso-conexao.test.ts` §eixo kcal.
 *
 * 🔒 Exportado para que o guard execute ESTE predicado, não uma cópia escrita no teste —
 * cópia diverge do original sem ninguém perceber. O parâmetro pede só os campos que o gate
 * LÊ (`PerfilDoGate`): assinatura que exige mais do que usa obriga a fixture do guard a
 * inventar dado irrelevante, e dado inventado é ruído que esconde o que a prova afirma.
 */
export function fazEmFaixaProtetiva(perfil: PerfilDoGate): (pesoKg: number) => boolean {
  return (pesoKg: number) => {
    const p: PerfilUsuario = {
      sexo: perfil.sexo, pesoKg, alturaCm: perfil.alturaCm, idade: perfil.idade,
      nivelAtividade: perfil.nivelAtividade, objetivo: perfil.objetivo, flagsSaude: perfil.flagsSaude,
    };
    return avaliarGateSaude(p).comportamento !== 'PERMITIR';
  };
}

/**
 * Resolve o peso com que o plano deve ser gerado **e persiste a âncora**.
 *
 * Idempotente no mesmo dia: sem pesagem nova e sem virada de carência, resolver duas vezes
 * devolve o mesmo peso e grava o mesmo estado — é o que permite `/app` e o `Painel`
 * resolverem cada um por si e ainda assim gerarem o MESMO plano.
 *
 * ⚠️ Devolve só o peso: quem quiser distinguir migração de recomputação lê o `evento` do
 * módulo puro. Na tela a distinção não serve — a frase é a mesma e é sobre o app.
 */
export function resolverPesoDoPlanoLocal(args: {
  perfil: PerfilResumo;
  pesos: readonly RegistroPeso[];
  hojeISO: string;
}): number {
  const { perfil, pesos, hojeISO } = args;
  const { pesoKg, estado } = resolverPesoDoPlano({
    pesagens: pesagensDatadas(pesos),
    hojeISO,
    pesoPerfilKg: perfil.pesoKg,
    anterior: lerEstadoPesoPlano(),
    emFaixaProtetiva: fazEmFaixaProtetiva(perfil),
  });
  gravarEstadoPesoPlano(estado);
  return pesoKg;
}

/**
 * 🔒 O *Editar perfil* REANCORA (spec §4, DF 2026-07-31): o valor digitado passa a ser o
 * peso do plano **na hora**, e vale até haver ≥ 3 pesagens posteriores à edição.
 *
 * 🔴 **Não encurta a carência de uma faixa em que se entrou por MEDIÇÃO.** `reancorar`
 * preserva `faixa` e `pesoNaFaixaKg`, e o `resolverPesoDoPlanoLocal` chamado em seguida
 * volta a pinar o peso enquanto os 14 dias correm.
 *
 * 🔻 Refinamento (spec §4, 2026-07-31): se a entrada na faixa **não teve medição por trás**
 * — o erro de digitação —, a saída é **imediata**. A porta dos fundos que continua fechada é
 * a que importa: não se sai por teclado de uma faixa em que se entrou por medição.
 */
export function reancorarPesoDoPlanoLocal(pesoKg: number, hojeISO: string): void {
  if (!Number.isFinite(pesoKg)) return;
  gravarEstadoPesoPlano(reancorar(lerEstadoPesoPlano(), pesoKg, hojeISO));
}
