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
  /**
   * 🔒 A ENTRADA foi por MEDIÇÃO (suavizado de ≥ 3 pesagens) ou por valor DIGITADO?
   *
   * É o que gradua a saída (spec §4, refinamento 2026-07-31): a carência de 14 dias existe
   * para não sair por teclado de uma faixa em que se entrou por medição. Entrada sem
   * medição nenhuma não tem por que segurar ninguém — era erro de digitação.
   */
  porMedicao: boolean;
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
 *
 * 🔻 **REFINAMENTO (spec §4, 2026-07-31) — a saída é PROPORCIONAL À EVIDÊNCIA DA ENTRADA.**
 * Como estava, quem digitasse 45 kg por engano num perfil de 70 (→ `ROTEAR` por IMC < 16)
 * ficava **14 dias sem plano** mesmo corrigindo no minuto seguinte: a mesma trava que impede
 * a fuga por teclado impedia a correção do erro de digitação.
 *
 * | Entrou por… | Sai… |
 * |---|---|
 * | valor **digitado** (sem medição por trás) | **imediato** — a entrada também não tinha evidência |
 * | **suavizado medido** (≥ 3 pesagens) | **14 dias** fora da faixa |
 *
 * 🔑 A porta dos fundos segue fechada, agora pelo motivo certo: **não se sai por TECLADO de
 * uma faixa em que se entrou por MEDIÇÃO.** O abuso real — três pesagens em faixa protetiva
 * e um número digitado para escapar — continua bloqueado.
 */
export function aplicarHistereseFaixa(args: {
  /** O suavizado está DENTRO da faixa protetiva hoje? (quem decide isso é o gate) */
  dentroDaFaixaHoje: boolean;
  anterior: FaixaProtetiva;
  hojeISO: string;
  /** O peso que está decidindo isto veio de MEDIÇÃO (suavizado) ou de teclado? */
  ancoraMedida: boolean;
}): FaixaProtetiva {
  const { dentroDaFaixaHoje, anterior, hojeISO, ancoraMedida } = args;

  // ENTRAR: imediato. Proteção não espera confirmação, e o contador de saída zera. A
  // procedência é CARIMBADA na entrada — é ela que vai graduar a saída.
  //
  // 🔴 A procedência MEDIDA não decai (achado da correção 1.1, 2026-07-31). Quem entrou por
  // medição e depois passa dias sem se pesar tem `suavizado = null` — e carimbar `false` ali
  // rebaixaria a entrada a "digitada", abrindo a saída por teclado de uma faixa em que se
  // entrou por medição. É exatamente a porta dos fundos que o refinamento fechou. Medição
  // nova só pode FORTALECER o carimbo; a janela esvaziar nunca o enfraquece.
  if (dentroDaFaixaHoje) {
    return {
      ativa: true,
      foraDesdeISO: null,
      porMedicao: ancoraMedida || (anterior.ativa && anterior.porMedicao),
    };
  }

  // Fora da faixa, mas nunca esteve protegido → nada a fazer.
  if (!anterior.ativa) return { ativa: false, foraDesdeISO: null, porMedicao: false };

  // 🔒 Entrou SEM medição → sai na hora. Não há evidência a respeitar: segurar aqui seria
  // punir um erro de digitação com duas semanas sem plano.
  if (!anterior.porMedicao) return { ativa: false, foraDesdeISO: null, porMedicao: false };

  // Entrou por MEDIÇÃO: começa (ou continua) a contagem dos 14 dias.
  const desde = anterior.foraDesdeISO ?? hojeISO;
  const dias = diasEntreISO(desde, hojeISO);
  if (dias != null && dias >= DIAS_PARA_SAIR_DA_FAIXA) {
    return { ativa: false, foraDesdeISO: null, porMedicao: false }; // cumpriu a carência
  }
  return { ativa: true, foraDesdeISO: desde, porMedicao: true };
}

/** Estado inicial: sem proteção e sem contagem. */
export const FAIXA_INICIAL: FaixaProtetiva = { ativa: false, foraDesdeISO: null, porMedicao: false };

/* ══════════════════ Resolução: o peso com que o plano é gerado ══════════════════ */

/**
 * O estado PERSISTIDO da âncora. É o mínimo que precisa sobreviver ao reload para que a
 * histerese exista — sem ele, "no máximo uma recomputação por semana" não teria como saber
 * quando foi a última, e a carência de 14 dias não teria como contar.
 */
export interface EstadoPesoPlano {
  /** Peso com que o plano vigente foi gerado. */
  ancoraKg: number;
  /** Dia em que a âncora foi fixada (base do intervalo mínimo de recomputação). */
  ancoraDesdeISO: string;
  /**
   * 🔒 A âncora veio de MEDIÇÃO (suavizado de ≥ 3 pesagens) ou de TECLADO (peso do perfil /
   * reancoragem manual)? É a procedência que gradua a saída da faixa protetiva (spec §4).
   */
  ancoraMedida: boolean;
  /** Estado da faixa protetiva do gate. */
  faixa: FaixaProtetiva;
  /** Peso que estava DENTRO da faixa, preservado durante a carência de saída. */
  pesoNaFaixaKg: number | null;
  /**
   * Dia da última REANCORAGEM manual (*Editar perfil*). Enquanto estiver preenchido, só
   * contam pesagens POSTERIORES a ele. `null` = a série manda normalmente.
   */
  reancoraISO: string | null;
}

/**
 * 🔒 EDITAR O PERFIL REANCORA (spec §4, regra CORRIGIDA em 2026-07-31).
 *
 * A redação anterior — *"o suavizado vence quando existe"* — tornava a correção manual
 * inócua: quem digitasse 65 com três pesagens em 61,4 continuaria com o plano em 61,4, **sem
 * nenhuma saída**. Agora o valor digitado vira o peso do plano **na hora**, e vale até a
 * janela ter ≥ 3 registros **posteriores** à edição — aí a série retoma.
 *
 * 🔴 O QUE A REANCORAGEM NÃO FAZ: encurtar a carência de saída da faixa protetiva. `faixa` e
 * `pesoNaFaixaKg` atravessam esta função **intactos**. Sem isso, digitar um número seria a
 * porta dos fundos do gate — e o gate é a única parte que não pode ter porta dos fundos.
 */
export function reancorar(
  anterior: EstadoPesoPlano | null,
  pesoKg: number,
  hojeISO: string,
): EstadoPesoPlano {
  return {
    ancoraKg: pesoKg,
    ancoraDesdeISO: hojeISO,
    ancoraMedida: false, // 🔒 veio do TECLADO — é isto que permite desfazer a digitação
    faixa: anterior?.faixa ?? FAIXA_INICIAL, // ⚠️ preservado de propósito
    pesoNaFaixaKg: anterior?.pesoNaFaixaKg ?? null, // ⚠️ o pino também
    reancoraISO: hojeISO,
  };
}

export type EventoPeso = 'migracao' | 'recomputo';

/**
 * 🔒 O ÚNICO lugar que decide com que peso o plano é gerado (Leva D, DF 2026-07-31).
 *
 * Junta as três camadas na ordem travada — **conectar → suavizar → histerese**:
 *  1. **suavizar**: média móvel de 7 dias (≥ 3 registros), senão o vigente do perfil;
 *  2. **histerese de recomputação**: a âncora só se move com ≥ 1 kg / 1,5% E ≥ 1 semana;
 *  3. **histerese assimétrica do gate**: sair de faixa protetiva exige 14 dias.
 *
 * `emFaixaProtetiva` entra INJETADA: quem sabe o que é faixa protetiva é o gate de saúde, e
 * este módulo não pode depender dele (o gate já depende de peso — a seta iria e voltaria).
 *
 * 🟢 Puro: todo estado entra por `anterior` e sai em `estado`. Quem guarda é o cliente.
 */
export function resolverPesoDoPlano(args: {
  pesagens: readonly Pesagem[];
  hojeISO: string;
  /** Peso do *Editar perfil* — a SEMENTE, usada enquanto não houver janela suficiente. */
  pesoPerfilKg: number;
  anterior: EstadoPesoPlano | null;
  /** O gate trata este peso com comportamento protetivo? (≠ PERMITIR) */
  emFaixaProtetiva: (pesoKg: number) => boolean;
}): { pesoKg: number; estado: EstadoPesoPlano; evento: EventoPeso | null } {
  const { pesagens, hojeISO, pesoPerfilKg, anterior, emFaixaProtetiva } = args;

  // ── 0. A reancoragem manual (spec §4) ──────────────────────────────────────────
  // Com reancoragem em vigor, só contam pesagens POSTERIORES à edição: as anteriores são
  // justamente as que a pessoa está corrigindo, e deixá-las na média manteria o número que
  // ela veio consertar. Quando as ≥ 3 novas aparecem, a série retoma e a marca cai.
  const reancorada = anterior?.reancoraISO ?? null;
  const elegiveis = reancorada ? pesagens.filter((p) => p.dataISO > reancorada) : pesagens;
  const suavizado = pesoSuavizado(elegiveis, hojeISO);
  const retomando = reancorada != null && suavizado != null;

  // ── 1. A âncora ────────────────────────────────────────────────────────────────
  let ancoraKg: number;
  let ancoraDesdeISO: string;
  let ancoraMedida: boolean;
  let evento: EventoPeso | null = null;

  if (!anterior) {
    // Primeira resolução. Se já existe janela, o plano nasce no suavizado — e isso é um
    // evento de MIGRAÇÃO (o plano vinha do peso do perfil), não uma recomputação de rotina.
    ancoraKg = suavizado ?? pesoPerfilKg;
    ancoraDesdeISO = hojeISO;
    ancoraMedida = suavizado != null; // sem janela, a semente do perfil é teclado
    if (suavizado != null && suavizado !== pesoPerfilKg) evento = 'migracao';
  } else if (
    deveRecomputar({
      suavizadoKg: suavizado,
      pesoDoPlanoKg: anterior.ancoraKg,
      // Na RETOMADA o intervalo mínimo não se aplica: a reancoragem foi um movimento
      // deliberado de dias atrás, e exigir mais uma semana faria "a série retoma" significar
      // "a série retoma daqui a sete dias". O limiar de ≥ 1 kg/1,5% continua valendo.
      ultimoRecomputoISO: retomando ? null : anterior.ancoraDesdeISO,
      hojeISO,
    })
  ) {
    ancoraKg = suavizado as number; // `deveRecomputar` só devolve true com suavizado != null
    ancoraDesdeISO = hojeISO;
    ancoraMedida = true; // veio da média de pesagens reais
    evento = 'recomputo';
  } else {
    ancoraKg = anterior.ancoraKg;
    ancoraDesdeISO = anterior.ancoraDesdeISO;
    ancoraMedida = anterior.ancoraMedida;
  }

  // ── 2. A faixa protetiva ───────────────────────────────────────────────────────
  /**
   * 🔴 DOIS RELÓGIOS (correção 1.1, 2026-07-31 — a única deste lote com consequência de
   * SEGURANÇA).
   *
   * O defeito: a faixa era decidida sobre a **âncora**, então a histerese de recomputação
   * (Δ ≥ 1 kg · 1×/semana) — que existe para o **cardápio não mudar todo dia** — passava a
   * governar também o **gate de saúde**. Um cruzamento pequeno ficava INVISÍVEL.
   *
   * Prova numérica: **1,60 m · 41,5 kg** (IMC 16,21, fora da faixa) com suavizado **40,8**
   * (IMC **15,94**, dentro). **Δ = 0,7 kg < 1 kg** → a âncora não se move → o gate nunca via
   * o 40,8 e não roteava. Uma pessoa em magreza severa seguia recebendo plano.
   *
   * 🔒 A regra: **a histerese governa kcal/macros; o gate lê o SUAVIZADO a cada leitura.**
   * Enquanto o gate está calado, a âncora manda (é ela que segura o churn do cardápio); no
   * instante em que o gate fala, ele fala a partir da medição, sem limiar e sem esperar
   * semana. 🟢 A assimetria não muda: **entrar é imediato, sair continua exigindo 14 dias** —
   * e é isso que impede a leitura crua de fazer o portão piscar.
   */
  const pesoDaLeitura = suavizado ?? ancoraKg;
  const dentroHoje = emFaixaProtetiva(pesoDaLeitura);
  const faixa = aplicarHistereseFaixa({
    dentroDaFaixaHoje: dentroHoje,
    anterior: anterior?.faixa ?? FAIXA_INICIAL,
    hojeISO,
    // A procedência é a da LEITURA que decidiu a entrada, não a da âncora: é o que o
    // refinamento da carência (digitado × medido) precisa saber para graduar a saída.
    ancoraMedida: suavizado != null,
  });

  // Em carência de SAÍDA (a leitura já saiu, mas os 14 dias não passaram) o plano continua
  // sendo gerado com o peso que estava DENTRO da faixa. É o que dá efeito à histerese: sem
  // fixar o peso, o gate recalcularia PERMITIR no dia seguinte e a carência seria decorativa.
  // 🔒 O erro fica do lado seguro — mesma postura do `max(1, floor(alvo))` da retomada.
  const emCarencia = faixa.ativa && !dentroHoje;
  const pesoNaFaixaKg = dentroHoje ? pesoDaLeitura : (emCarencia ? (anterior?.pesoNaFaixaKg ?? null) : null);
  /**
   * 🔒 Com a faixa ATIVA, o comportamento segue a LEITURA (ou o pino da carência), nunca a
   * âncora: se o gate viu magreza severa e o plano fosse gerado no peso ancorado, o gate
   * interno de `gerarDieta` recalcularia `PERMITIR` e o roteamento evaporaria. Faixa calada →
   * a âncora manda, e o cardápio segue estável como a Leva D travou.
   */
  const pesoKg = faixa.ativa
    ? (emCarencia && pesoNaFaixaKg != null ? pesoNaFaixaKg : pesoDaLeitura)
    : ancoraKg;

  return {
    pesoKg,
    // A marca da reancoragem cai assim que a série volta a ter janela própria.
    estado: { ancoraKg, ancoraDesdeISO, ancoraMedida, faixa, pesoNaFaixaKg, reancoraISO: retomando ? null : reancorada },
    evento,
  };
}
