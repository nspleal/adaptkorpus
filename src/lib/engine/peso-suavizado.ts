/**
 * PESO SUAVIZADO — o peso que realimenta o motor (Leva D).
 * 🔒 SPEC TRAVADA: cofre `parametros-motor-dieta-evokorpus` §⚖️ e
 * `gate-de-saude-evokorpus` §conexão retroativa (DF 2026-07-31).
 *
 * **O defeito em produção:** `registrarPeso` grava em três destinos (estado da UI,
 * `evk_pesos`, `logs` tipo `peso`) e **nenhum deles é `perfil.pesoKg`**. Quem move o perfil
 * é só o *Editar perfil*. Com perfil 70 kg e peso real 61,4 kg o alvo fica ~110 kcal/dia
 * alto demais. A dieta era **adaptativa no mecanismo e estática no efeito** — e é a raiz do
 * que derrubou a copy "mantém seu plano calibrado".
 *
 * 🔴 O peso entra em SEIS lugares, não um: TMB · proteína (g/kg) · gordura (0,8 g/kg) ·
 * gatilhos de clamp · IMC do gate · e a **checagem de plausibilidade** (`health-gate.ts:26`),
 * que com peso fora de 30–300 devolve tudo `NaN` e nem calcula. 🟢 Por construção nada aqui
 * extrapola: toda saída é **média de valores já validados** por `registrarPeso`, então cai
 * sempre dentro do envelope dos registros — nunca fora.
 *
 * PURO e determinístico: sem relógio e sem rede. `hojeISO` entra por parâmetro, no padrão de
 * `treino-mesociclo` e `treino-retomada`.
 */

/** Janela da média móvel, em dias. */
export const JANELA_SUAVIZACAO_DIAS = 7;
/** Mínimo de registros na janela. Abaixo disto o motor MANTÉM o valor vigente. */
export const MIN_REGISTROS_SUAVIZACAO = 3;
/** Histerese de recomputação: o maior entre 1 kg e 1,5% do peso vigente. */
export const HISTERESE_KG = 1;
export const HISTERESE_FRACAO = 0.015;
/** No máximo uma recomputação por semana. */
export const INTERVALO_MIN_RECOMPUTO_DIAS = 7;
/** 🔒 Sair de faixa protetiva exige 14 dias fora dela. Entrar é imediato. */
export const DIAS_PARA_SAIR_DA_FAIXA = 14;

/** Uma pesagem: valor + dia. O dia é ISO (`YYYY-MM-DD`), como todo o resto do motor. */
export interface Pesagem {
  dataISO: string;
  kg: number;
}

/** Dias inteiros entre duas datas ISO (b − a). `null` se qualquer uma for inválida. */
function diasEntreISO(aISO: string, bISO: string): number | null {
  const a = Date.parse(`${aISO}T00:00:00Z`);
  const b = Date.parse(`${bISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Pesagens dentro da janela que termina em `hojeISO` (inclusiva nas duas pontas). */
export function naJanela(
  pesagens: readonly Pesagem[],
  hojeISO: string,
  janelaDias = JANELA_SUAVIZACAO_DIAS,
): Pesagem[] {
  return pesagens.filter((p) => {
    const d = diasEntreISO(p.dataISO, hojeISO);
    return d != null && d >= 0 && d < janelaDias;
  });
}

/**
 * O peso suavizado: **média móvel de 7 dias, exigindo ≥ 3 registros**.
 *
 * `null` quando não há registros suficientes — e `null` significa **"use o valor vigente"**,
 * nunca "use zero" nem "extrapole da última pesagem". Uma pesagem isolada não move nada.
 */
export function pesoSuavizado(
  pesagens: readonly Pesagem[],
  hojeISO: string,
): number | null {
  const janela = naJanela(pesagens, hojeISO).filter((p) => Number.isFinite(p.kg));
  if (janela.length < MIN_REGISTROS_SUAVIZACAO) return null;
  const soma = janela.reduce((n, p) => n + p.kg, 0);
  // Uma casa decimal: é a precisão que a balança e a UI usam; mais dígitos é ruído.
  return Math.round((soma / janela.length) * 10) / 10;
}

/**
 * O peso que o MOTOR deve usar: o suavizado quando existe, senão o vigente do perfil.
 *
 * 🔒 O peso do *Editar perfil* continua sendo a SEMENTE (1º plano, antes de haver registro)
 * e a correção manual; o suavizado **vence** quando existe (spec §4).
 */
export function pesoEfetivo(
  pesagens: readonly Pesagem[],
  hojeISO: string,
  pesoVigenteKg: number,
): number {
  return pesoSuavizado(pesagens, hojeISO) ?? pesoVigenteKg;
}

/**
 * O plano deve ser recalculado?
 *
 * 🔒 Duas condições, as DUAS obrigatórias (spec §2):
 *  · o suavizado se afastou **≥ 1 kg OU ≥ 1,5%** do peso que gerou o plano vigente — o que
 *    for MAIOR dos dois limiares, não o que for maior entre kg e %;
 *  · passou-se pelo menos **1 semana** desde a última recomputação.
 *
 * Sem isso o cardápio mudaria sozinho quase todo dia — churn que o usuário lê como "o app
 * está confuso".
 */
export function deveRecomputar(args: {
  suavizadoKg: number | null;
  pesoDoPlanoKg: number;
  ultimoRecomputoISO: string | null;
  hojeISO: string;
}): boolean {
  const { suavizadoKg, pesoDoPlanoKg, ultimoRecomputoISO, hojeISO } = args;
  if (suavizadoKg == null || !Number.isFinite(pesoDoPlanoKg) || pesoDoPlanoKg <= 0) return false;
  const limiar = Math.max(HISTERESE_KG, pesoDoPlanoKg * HISTERESE_FRACAO);
  if (Math.abs(suavizadoKg - pesoDoPlanoKg) < limiar) return false;
  if (ultimoRecomputoISO) {
    const d = diasEntreISO(ultimoRecomputoISO, hojeISO);
    if (d != null && d < INTERVALO_MIN_RECOMPUTO_DIAS) return false;
  }
  return true;
}

/* ══════════════════ Histerese ASSIMÉTRICA do gate ══════════════════ */

/**
 * Estado persistido da faixa protetiva do gate.
 *
 * `desdeISO` é o primeiro dia em que o suavizado saiu da faixa. Ele NÃO é "quando entrou" —
 * entrar é imediato e não precisa de carimbo; o que precisa de contagem é a SAÍDA.
 */
export interface FaixaProtetiva {
  /** Está sob comportamento protetivo agora? */
  ativa: boolean;
  /** 1º dia com o suavizado FORA da faixa (começa a contar os 14). `null` = dentro. */
  foraDesdeISO: string | null;
}

/**
 * 🔒 PROTEGER RÁPIDO, LIBERAR DEVAGAR (spec §3 e `gate-de-saude-evokorpus`).
 *
 * | Direção | Regra |
 * |---|---|
 * | **Entrar** em faixa protetiva | **imediato**, assim que o suavizado cruza |
 * | **Sair** | exige **14 dias** de suavizado fora da faixa |
 *
 * Por quê: oscilação em torno do corte ligaria e desligaria o roteamento, e **roteamento é
 * decisão de segurança, não de conforto**. Uma série 61,0 · 63,5 · 61,2 em torno de um corte
 * faria o gate virar ruído — "ninguém confia num portão que abre e fecha sozinho".
 *
 * **Consequência aceita e declarada:** quem cruza para fora continua vendo o comportamento
 * protetivo por até duas semanas. O erro fica **sempre do lado seguro** — mesma postura do
 * `max(1, floor(alvo))` da rampa de retomada.
 */
export function aplicarHistereseFaixa(args: {
  /** O suavizado está DENTRO da faixa protetiva hoje? (quem decide isso é o gate) */
  dentroDaFaixaHoje: boolean;
  anterior: FaixaProtetiva;
  hojeISO: string;
}): FaixaProtetiva {
  const { dentroDaFaixaHoje, anterior, hojeISO } = args;

  // ENTRAR: imediato. Proteção não espera confirmação, e o contador de saída zera.
  if (dentroDaFaixaHoje) return { ativa: true, foraDesdeISO: null };

  // Fora da faixa, mas nunca esteve protegido → nada a fazer.
  if (!anterior.ativa) return { ativa: false, foraDesdeISO: null };

  // Fora da faixa e protegido: começa (ou continua) a contagem dos 14 dias.
  const desde = anterior.foraDesdeISO ?? hojeISO;
  const dias = diasEntreISO(desde, hojeISO);
  if (dias != null && dias >= DIAS_PARA_SAIR_DA_FAIXA) {
    return { ativa: false, foraDesdeISO: null }; // cumpriu a carência → sai
  }
  return { ativa: true, foraDesdeISO: desde };
}

/** Estado inicial: sem proteção e sem contagem. */
export const FAIXA_INICIAL: FaixaProtetiva = { ativa: false, foraDesdeISO: null };
