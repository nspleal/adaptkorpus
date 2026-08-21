/**
 * 🔒 C1 — suíte da FÓRMULA CANÔNICA de duração (norma ratificada 2026-08-20 + overrides).
 *
 * Cobre as fixtures obrigatórias (spec §8.2 / handoff §8) e os alvos de mutação (§8.4). Cada
 * número foi conferido à mão contra a fórmula; os valores 1540/1780, 2270/2870 e 1440/1800
 * são os do próprio handoff. Override do autor: AQUECIMENTO não entra na duração — não há campo
 * de aquecimento na entrada, e sua ausência nunca gera NAO_AVALIADO.
 */
import { describe, expect, it } from 'vitest';
import {
  avaliarDuracaoSessao,
  FORMULA_DURACAO_VERSION,
  TEMPO_EXECUCAO_SERIE_REPS_SEG,
  TOLERANCIA_EXCESSO_SEG,
  type ItemDuracao,
} from './duracao-sessao';

const reps = (series: number, descansoEntreSeriesSeg: number, seg = TEMPO_EXECUCAO_SERIE_REPS_SEG): ItemDuracao => ({
  tipo: 'RESISTIDO', series, descansoEntreSeriesSeg,
  execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: seg }, tecnica: { tipo: 'SEM_TECNICA' },
});

describe('C1 · constantes únicas e centralizadas', () => {
  it('a constante de execução é 40 e existe só aqui', () => {
    expect(TEMPO_EXECUCAO_SERIE_REPS_SEG).toBe(40);
    expect(TOLERANCIA_EXCESSO_SEG).toBe(480);
    expect(FORMULA_DURACAO_VERSION).toBe('tempo-v1');
  });
});

describe('C1 · fixtures numéricas medidas', () => {
  it('caso CURTO: 4×4 @ 60/90/90/60, orçamento 1800 → MIN 1540 / MAX 1780 / DENTRO_DO_LIMITE', () => {
    const r = avaliarDuracaoSessao({
      itens: [reps(4, 60), reps(4, 90), reps(4, 90), reps(4, 60)], orcamentoSegundos: 1800,
    });
    expect(r.estadoCalculo).toBe('CALCULADO');
    expect(r.duracaoMinimaEstimadaSegundos).toBe(1540); // 16×40=640 exec + 3×(60+90+90+60)=900 descanso
    expect(r.duracaoMaximaEstimadaSegundos).toBe(1780); // + transição 60+90+90 (o 4º não conta)
    expect(r.estadoLimite).toBe('DENTRO_DO_LIMITE');
    expect(r.limiteOperacionalSegundos).toBe(2280);
  });

  it('caso PESADO: 3/3/3/3/4/4 @ 180/60/90/180/90/60, orçamento 3600 → MIN 2270 / MAX 2870 / DENTRO_DO_LIMITE', () => {
    const r = avaliarDuracaoSessao({
      itens: [reps(3, 180), reps(3, 60), reps(3, 90), reps(3, 180), reps(4, 90), reps(4, 60)],
      orcamentoSegundos: 3600,
    });
    expect(r.duracaoMinimaEstimadaSegundos).toBe(2270); // 20×40=800 + 1470 descanso
    expect(r.duracaoMaximaEstimadaSegundos).toBe(2870); // + 180+60+90+180+90 (o 6º não conta)
    expect(r.estadoLimite).toBe('DENTRO_DO_LIMITE');
    // 🔒 o pior caso de PLANEJAMENTO (4320) não é o oráculo — o plano final soma 2270–2870.
  });

  it('handoff §8.3: 4× (3 séries @120) → MIN 1440 / MAX 1800', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(3, 120), reps(3, 120), reps(3, 120), reps(3, 120)] });
    expect(r.duracaoMinimaEstimadaSegundos).toBe(1440); // 12×40=480 + 4×2×120=960
    expect(r.duracaoMaximaEstimadaSegundos).toBe(1800); // + 3×120=360
  });

  it('handoff §8.4: UM exercício → sem transição, MIN = MAX', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(4, 90)] });
    expect(r.duracaoMinimaEstimadaSegundos).toBe(430); // 4×40 + 3×90
    expect(r.duracaoMaximaEstimadaSegundos).toBe(430);
    expect(r.componentes!.transicaoSegundos).toBe(0);
  });
});

describe('C1 · isometria (proibido usar 40 s)', () => {
  it('hold de 120 s conta como 120 por série, não 40', () => {
    const iso: ItemDuracao = {
      tipo: 'RESISTIDO', series: 3, descansoEntreSeriesSeg: 60,
      execucao: { tipo: 'ISOMETRIA', holdSegundosPorSerie: 120 }, tecnica: { tipo: 'SEM_TECNICA' },
    };
    const r = avaliarDuracaoSessao({ itens: [iso] });
    expect(r.componentes!.execucaoSegundos).toBe(360); // 3×120, NÃO 3×40=120
    expect(r.duracaoMinimaEstimadaSegundos).toBe(480); // 360 + 2×60
  });
});

describe('C1 · unilateralidade (dobra execução, nunca descanso)', () => {
  it('unilateral nos dois lados: execução ×2, descanso intacto', () => {
    const uni: ItemDuracao = {
      tipo: 'RESISTIDO', series: 3, descansoEntreSeriesSeg: 60, unilateralDoisLados: true,
      execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 }, tecnica: { tipo: 'SEM_TECNICA' },
    };
    const r = avaliarDuracaoSessao({ itens: [uni] });
    expect(r.componentes!.execucaoSegundos).toBe(240); // 3×2×40
    expect(r.componentes!.descansoSegundos).toBe(120); // 2×60 — NÃO dobrado
    // comparação com bilateral: execução cai à metade, descanso igual.
    const bi = avaliarDuracaoSessao({ itens: [reps(3, 60)] });
    expect(bi.componentes!.execucaoSegundos).toBe(120);
    expect(bi.componentes!.descansoSegundos).toBe(120);
  });
});

describe('C1 · cardio / duração contínua', () => {
  it('cardio usa a duração explícita, sem descanso fictício de 90', () => {
    const r = avaliarDuracaoSessao({ itens: [{ tipo: 'CONTINUO', duracaoTotalSegundos: 600 }] });
    expect(r.duracaoMinimaEstimadaSegundos).toBe(600);
    expect(r.duracaoMaximaEstimadaSegundos).toBe(600);
  });

  it('cardio SEM duração → NAO_AVALIADO (nunca 90 s)', () => {
    const r = avaliarDuracaoSessao({ itens: [{ tipo: 'CONTINUO', duracaoTotalSegundos: 0 }] });
    expect(r.estadoCalculo).toBe('NAO_AVALIADO');
    expect(r.motivosNaoAvaliados.join(' ')).toMatch(/duracaoTotalSegundos/);
  });

  it('sessão MISTA resistido→cardio→resistido: duas reservas de transição explícitas', () => {
    const itens: ItemDuracao[] = [
      reps(3, 90),
      { tipo: 'CONTINUO', duracaoTotalSegundos: 600, reservaTransicaoAposSeg: 45 },
      reps(3, 60),
    ];
    const r = avaliarDuracaoSessao({ itens });
    // MIN: exec (3×40 + 3×40)=240 + descanso (2×90 + 2×60)=300 + cardio 600 = 1140
    expect(r.duracaoMinimaEstimadaSegundos).toBe(1140);
    // MAX: + transição do resistido A (90) + reserva do cardio (45) = 1140 + 135
    expect(r.duracaoMaximaEstimadaSegundos).toBe(1275);
  });

  it('omitir a reserva após o cardio (que não é último) → NAO_AVALIADO', () => {
    const itens: ItemDuracao[] = [
      { tipo: 'CONTINUO', duracaoTotalSegundos: 600 }, // sem reservaTransicaoAposSeg, e há item depois
      reps(3, 60),
    ];
    const r = avaliarDuracaoSessao({ itens });
    expect(r.estadoCalculo).toBe('NAO_AVALIADO');
    expect(r.motivosNaoAvaliados.join(' ')).toMatch(/reservaTransicaoAposSeg/);
  });

  it('cardio como ÚLTIMO item não exige reserva de transição', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(3, 60), { tipo: 'CONTINUO', duracaoTotalSegundos: 300 }] });
    expect(r.estadoCalculo).toBe('CALCULADO');
  });
});

describe('C1 · dados ausentes / domínios (proibido fallback 1 série / 90 s)', () => {
  it('série <= 0 ou não inteira → NAO_AVALIADO', () => {
    expect(avaliarDuracaoSessao({ itens: [reps(0, 60)] }).estadoCalculo).toBe('NAO_AVALIADO');
    expect(avaliarDuracaoSessao({ itens: [reps(2.5, 60)] }).estadoCalculo).toBe('NAO_AVALIADO');
  });
  it('descanso < 0 → NAO_AVALIADO com o campo', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(3, -1)] });
    expect(r.estadoCalculo).toBe('NAO_AVALIADO');
    expect(r.motivosNaoAvaliados.join(' ')).toMatch(/descansoEntreSeriesSeg/);
  });
  it('hold 0 → NAO_AVALIADO', () => {
    const r = avaliarDuracaoSessao({ itens: [{ tipo: 'RESISTIDO', series: 3, descansoEntreSeriesSeg: 60, execucao: { tipo: 'ISOMETRIA', holdSegundosPorSerie: 0 }, tecnica: { tipo: 'SEM_TECNICA' } }] });
    expect(r.estadoCalculo).toBe('NAO_AVALIADO');
  });
  it('orçamento 0 → NAO_AVALIADO (nunca verde)', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(3, 60)], orcamentoSegundos: 0 });
    expect(r.estadoCalculo).toBe('NAO_AVALIADO');
  });
  it('duração contínua negativa → NAO_AVALIADO com o campo', () => {
    const r = avaliarDuracaoSessao({ itens: [{ tipo: 'CONTINUO', duracaoTotalSegundos: -1 }] });
    expect(r.estadoCalculo).toBe('NAO_AVALIADO');
    expect(r.motivosNaoAvaliados.join(' ')).toMatch(/duracaoTotalSegundos/);
  });
  it('NAO_AVALIADO implica estado_limite NAO_AVALIADO e SEM durações', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(0, 60)], orcamentoSegundos: 1800 });
    expect(r.estadoLimite).toBe('NAO_AVALIADO');
    expect(r.duracaoMinimaEstimadaSegundos).toBeUndefined();
    expect(r.duracaoMaximaEstimadaSegundos).toBeUndefined();
  });
});

describe('C1 · técnica temporal', () => {
  it('CONTRATO_COMPLETO parcelas [20] em 3×40 entra UMA vez (não ×3 nem ×2)', () => {
    const it: ItemDuracao = {
      tipo: 'RESISTIDO', series: 3, descansoEntreSeriesSeg: 60,
      execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 },
      tecnica: { tipo: 'CONTRATO_COMPLETO', parcelasAdicionaisSegundos: [20], adicionalTecnicaTotalSegundos: 20 },
    };
    const r = avaliarDuracaoSessao({ itens: [it] });
    expect(r.componentes!.adicionalTecnicaSegundos).toBe(20); // não 60, não 40
    expect(r.duracaoMinimaEstimadaSegundos).toBe(120 + 120 + 20); // exec 120 + descanso 120 + técnica 20
  });
  it('CONTRATO_COMPLETO com total ≠ soma das parcelas → NAO_AVALIADO', () => {
    const it: ItemDuracao = {
      tipo: 'RESISTIDO', series: 3, descansoEntreSeriesSeg: 60,
      execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 },
      tecnica: { tipo: 'CONTRATO_COMPLETO', parcelasAdicionaisSegundos: [20, 10], adicionalTecnicaTotalSegundos: 25 },
    };
    expect(avaliarDuracaoSessao({ itens: [it] }).estadoCalculo).toBe('NAO_AVALIADO');
  });
  it('CONTRATO_AUSENTE → NAO_AVALIADO mesmo tentando anexar total 0', () => {
    const it: ItemDuracao = {
      tipo: 'RESISTIDO', series: 3, descansoEntreSeriesSeg: 60,
      execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 },
      tecnica: { tipo: 'CONTRATO_AUSENTE', tecnicaIds: ['dropset'] },
    };
    const r = avaliarDuracaoSessao({ itens: [it] });
    expect(r.estadoCalculo).toBe('NAO_AVALIADO');
    expect(r.motivosNaoAvaliados.join(' ')).toMatch(/CONTRATO_AUSENTE|contrato/i);
  });
});

describe('C1 · o descanso após a ÚLTIMA série nunca é contado', () => {
  it('série única (S=1) tem tempo_descanso 0', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(1, 90)] });
    expect(r.componentes!.descansoSegundos).toBe(0); // max(1-1,0)=0
    expect(r.duracaoMinimaEstimadaSegundos).toBe(40);
  });
});

describe('C1 · classificação contra o orçamento (tolerância 480)', () => {
  it('MAX == B → DENTRO_DO_LIMITE (fronteira)', () => {
    // 2 itens: exec 80, sem descanso; transição do 1º = B, do último = 0 → MAX = 80 + (B-80)? não.
    // Construção direta: itemA descanso=(B-80) não é o que queremos. Usamos fixture curta: MAX 1780 < 1800.
    const r = avaliarDuracaoSessao({ itens: [reps(4, 60), reps(4, 90), reps(4, 90), reps(4, 60)], orcamentoSegundos: 1780 });
    expect(r.duracaoMaximaEstimadaSegundos).toBe(1780);
    expect(r.estadoLimite).toBe('DENTRO_DO_LIMITE'); // 1780 <= 1780
  });
  it('B < MAX <= B+480 → DENTRO_DA_TOLERANCIA (fronteira exata em B+480)', () => {
    // sonda de fronteira: MAX = 3180 = 2700 + 480.
    const itens: ItemDuracao[] = [reps(1, 3100), reps(1, 0)]; // exec 80, descanso 0, transição A=3100
    const r = avaliarDuracaoSessao({ itens, orcamentoSegundos: 2700 });
    expect(r.duracaoMaximaEstimadaSegundos).toBe(3180);
    expect(r.estadoLimite).toBe('DENTRO_DA_TOLERANCIA');
  });
  it('MAX = B+481 NÃO recebe DENTRO_DA_TOLERANCIA', () => {
    const itens: ItemDuracao[] = [reps(1, 3101), reps(1, 0)]; // MAX 3181
    const r = avaliarDuracaoSessao({ itens, orcamentoSegundos: 2700 });
    expect(r.duracaoMaximaEstimadaSegundos).toBe(3181);
    expect(r.estadoLimite).not.toBe('DENTRO_DA_TOLERANCIA');
    expect(r.estadoLimite).toBe('LIMITE_INDETERMINADO'); // MIN 80 <= 3180 < 3181
  });
  it('MIN > B+480 → ACIMA_DO_LIMITE_OPERACIONAL', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(80, 0)], orcamentoSegundos: 2700 }); // exec 3200 = MIN = MAX
    expect(r.duracaoMinimaEstimadaSegundos).toBe(3200);
    expect(r.estadoLimite).toBe('ACIMA_DO_LIMITE_OPERACIONAL');
  });
  it('MIN == B+480 exato (com MAX>B+480) → LIMITE_INDETERMINADO, não ACIMA (fronteira do MIN)', () => {
    // reps(2,20): exec 80 + descanso 20. reps(77,0): exec 3080. MIN=3180=2700+480; transição 20 ⇒ MAX 3200.
    const r = avaliarDuracaoSessao({ itens: [reps(2, 20), reps(77, 0)], orcamentoSegundos: 2700 });
    expect(r.duracaoMinimaEstimadaSegundos).toBe(3180);
    expect(r.duracaoMaximaEstimadaSegundos).toBe(3200);
    expect(r.limiteOperacionalSegundos).toBe(3180);
    // o comparador é ESTRITO (min > limiteOp); em min == limiteOp cai em INDETERMINADO, nunca ACIMA.
    expect(r.estadoLimite).toBe('LIMITE_INDETERMINADO');
  });
  it('MIN <= B+480 < MAX → LIMITE_INDETERMINADO', () => {
    const itens: ItemDuracao[] = [reps(1, 4000), reps(1, 0)]; // MIN 80, MAX 4080
    const r = avaliarDuracaoSessao({ itens, orcamentoSegundos: 2700 });
    expect(r.estadoLimite).toBe('LIMITE_INDETERMINADO');
  });
});

describe('C1 · orçamento ausente: faixa calcula, limite indeterminável', () => {
  it('sem orçamento → CALCULADO com faixa, estado_limite NAO_AVALIADO', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(4, 90)] });
    expect(r.estadoCalculo).toBe('CALCULADO');
    expect(r.duracaoMinimaEstimadaSegundos).toBe(430);
    expect(r.estadoLimite).toBe('NAO_AVALIADO');
  });
});

describe('C1 · reserva de transição é DERIVADA do descanso vigente (não persistida)', () => {
  it('descanso 120 → transição 120; editar p/ 60 → transição 60, sem ler cópia antiga', () => {
    const a = avaliarDuracaoSessao({ itens: [reps(3, 120), reps(3, 60)] });
    expect(a.componentes!.transicaoSegundos).toBe(120); // só o 1º (não-último) conta
    const b = avaliarDuracaoSessao({ itens: [reps(3, 60), reps(3, 60)] });
    expect(b.componentes!.transicaoSegundos).toBe(60);
  });
});

describe('C1 · motivos_limite independente + domínios inteiros seguros (§2/§3.6, fixtures 15/23)', () => {
  it('orçamento ausente ⇒ CALCULADO, estado_limite NAO_AVALIADO, motivosLimite=[ORCAMENTO_AUSENTE]', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(4, 90)] });
    expect(r.estadoCalculo).toBe('CALCULADO');
    expect(r.estadoLimite).toBe('NAO_AVALIADO');
    expect(r.motivosLimite).toContain('ORCAMENTO_AUSENTE');
    expect(r.motivosNaoAvaliados).toEqual([]);
  });
  it('orçamento presente sempre ⇒ motivosLimite não tem ORCAMENTO_AUSENTE', () => {
    const r = avaliarDuracaoSessao({ itens: [reps(4, 90)], orcamentoSegundos: 1800 });
    expect(r.motivosLimite).not.toContain('ORCAMENTO_AUSENTE');
  });
  it('hold fracionário ⇒ NAO_AVALIADO', () => {
    const iso: ItemDuracao = { tipo: 'RESISTIDO', series: 3, descansoEntreSeriesSeg: 60, execucao: { tipo: 'ISOMETRIA', holdSegundosPorSerie: 90.5 }, tecnica: { tipo: 'SEM_TECNICA' } };
    expect(avaliarDuracaoSessao({ itens: [iso] }).estadoCalculo).toBe('NAO_AVALIADO');
  });
  it('duração contínua infinita ou insegura ⇒ NAO_AVALIADO', () => {
    expect(avaliarDuracaoSessao({ itens: [{ tipo: 'CONTINUO', duracaoTotalSegundos: Infinity }] }).estadoCalculo).toBe('NAO_AVALIADO');
    expect(avaliarDuracaoSessao({ itens: [{ tipo: 'CONTINUO', duracaoTotalSegundos: Number.MAX_SAFE_INTEGER + 2 }] }).estadoCalculo).toBe('NAO_AVALIADO');
  });
  it('série fracionária ⇒ NAO_AVALIADO', () => {
    expect(avaliarDuracaoSessao({ itens: [reps(2.5, 60)] }).estadoCalculo).toBe('NAO_AVALIADO');
  });
});

describe('C1 · determinismo e versionamento', () => {
  it('mesma entrada → resultado idêntico', () => {
    const entrada = { itens: [reps(4, 60), reps(4, 90)], orcamentoSegundos: 1800 };
    expect(avaliarDuracaoSessao(entrada)).toEqual(avaliarDuracaoSessao(entrada));
  });
  it('toda avaliação carrega formula_version', () => {
    expect(avaliarDuracaoSessao({ itens: [reps(3, 60)] }).formulaVersion).toBe('tempo-v1');
    expect(avaliarDuracaoSessao({ itens: [reps(0, 60)] }).formulaVersion).toBe('tempo-v1');
  });
});
