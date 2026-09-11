import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina, type OpcoesSemana } from './treino-montador';
import { arredondar5, duracaoDoDiaDeCardio } from './dia-de-cardio';
import { EXERCISES } from '../data/exercises';
import { montarSemana } from '../semana';
import { sessoesResistidas, sessoesTreino, type SessaoHistorico } from '../treino-historico';
import { semanaDoCiclo } from './treino-mesociclo';
import type { FlagsSaude } from './types';
import type { PerfilTreino } from './treino-types';

/**
 * 🔴 3.4 — DIA EXCEDENTE = DIA DE CARDIO: **os três guards, escritos ANTES do código.**
 *
 * O lote exige que estes três existam antes da emissão do slot, e o motivo é histórico: a
 * armadilha 2 da Leva 2 (cardio caindo no balde do mesociclo) foi fechada por ESTRUTURA e
 * não por cuidado, e reabri-la sem rede desfaria o fix `9ebf1bd` que está em produção.
 *
 *  ① o dia de cardio NÃO é rotulado `'treino'`;
 *  ② `sessao_iniciada` NÃO dispara para cardio — quem registra é `cardio_registrado`;
 *  ③ o relógio do mesociclo NÃO se move com cardio.
 */

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return {
    pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'saude',
    nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 5,
    tempoPorSessaoMin: 60, ...over,
  };
}

/** Uma rotina com dias EXCEDENTES de verdade (mais dias disponíveis que o teto de força). */
function rotinaComExcedente(over: Partial<PerfilTreino> = {}) {
  const p = perfil(over);
  const opc: OpcoesSemana = { semana: 1, feedbackGrupos: new Map() };
  const prescricao = prescreverTreino(p, avaliarGateTreino(p));
  const dias = Math.max(0, Math.floor(p.diasDisponiveis));
  const diasForca = dias < 1 ? 0 : Math.min(dias, prescricao.sessoesForcaSemana.max);
  const diasVagosOferecidos = Array.from({ length: dias - diasForca }, (_, i) => diasForca + i);
  return montarRotina(
    prescricao, p, EXERCISES, undefined, opc, undefined, undefined, diasVagosOferecidos,
  );
}

describe('🔴 o caso existe (senão os três guards são decorativos)', () => {
  it('há dia excedente de verdade nesta configuração', () => {
    const r = rotinaComExcedente();
    expect(r.diasCardioRecuperacao, 'sem excedente não há o que guardar').toBeGreaterThan(0);
  });
});

describe('🔴 ① o dia de cardio não é rotulado `treino`', () => {
  it('`montarSemana` não chama de treino um dia que não tem sessão de força', () => {
    const r = rotinaComExcedente();
    const nomes = r.dias.map((d) => d.nome);
    const semana = montarSemana(['seg', 'ter', 'qua', 'qui', 'sex'], nomes, 0);
    const ativos = semana.filter((d) => d.isTraining);
    const forca = ativos.filter((d) => d.tipo === 'treino');
    // 🔒 Dias rotulados 'treino' NUNCA podem exceder as sessões de força do motor: cada um
    // deles abre a sessão guiada, e abrir cardio como sessão de força é o defeito.
    expect(forca.length, 'mais dias de treino que sessões de força').toBeLessThanOrEqual(r.dias.length);
    expect(ativos.length, 'o caso precisa ter mais dias ativos que sessões').toBeGreaterThan(r.dias.length);
    for (const d of ativos.slice(r.dias.length)) {
      expect(d.tipo, `${d.full} virou dia de treino`).not.toBe('treino');
      expect(d.sessionIdx, `${d.full} ganhou índice de sessão de força`).toBeUndefined();
    }
  });

  it('nenhum dia de força fica sem sessão correspondente (o inverso do defeito)', () => {
    const r = rotinaComExcedente();
    const semana = montarSemana(['seg', 'ter', 'qua', 'qui', 'sex'], r.dias.map((d) => d.nome), 0);
    for (const d of semana.filter((x) => x.tipo === 'treino')) {
      expect(d.sessionIdx, `${d.full} é treino mas não aponta sessão`).not.toBeUndefined();
      expect(r.dias[d.sessionIdx!], `${d.full} aponta sessão inexistente`).toBeTruthy();
    }
  });
});

describe('🔴 ② `sessao_iniciada` não dispara para cardio', () => {
  const podar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  const painel = () => podar(readFileSync('src/components/painel/Painel.tsx', 'utf8'));

  it('o evento de cardio é `cardio_registrado`, e é um dos 7 tipos fechados', () => {
    const s = painel();
    expect(s).toMatch(/registrarEvento\('cardio_registrado'/);
  });

  it('🔒 nenhum caminho de CARDIO passa por `sessao_iniciada`', () => {
    const s = painel();
    // `sessao_iniciada` sai de UM lugar só — a abertura da sessão guiada de força.
    const disparos = s.match(/registrarEvento\('sessao_iniciada'/g) ?? [];
    expect(disparos, 'o disparo de ativação se espalhou').toHaveLength(1);
    // E o corpo de `iniciarSessaoGuiada` não pode ser alcançável a partir do dia de cardio:
    // o botão do dia excedente abre o REGISTRO, não a sessão.
    const i = s.indexOf('function iniciarSessaoGuiada');
    const corpo = s.slice(i, s.indexOf('\n  }', i));
    expect(corpo, 'a sessão guiada passou a registrar cardio').not.toMatch(/cardio_registrado|setRegistrandoCardio/);
  });

  it('o botão do dia excedente abre o registro de cardio, não a sessão guiada', () => {
    const s = painel();
    // ⚠️ Âncora no `<SuaSemana`, não no 1º `onRegistrarCardio=` do arquivo: a sessão guiada
    // também recebe essa prop, e o extrator ingênuo pegava ELA. (Falhou assim na 1ª escrita.)
    const i = s.indexOf('<SuaSemana');
    expect(i, 'a faixa da semana sumiu do Painel').toBeGreaterThanOrEqual(0);
    const tag = s.slice(i, s.indexOf('/>', i));
    expect(tag, 'o dia excedente não oferece registro de cardio').toMatch(/onRegistrarCardio=/);
    // ⚠️ A asserção é sobre O VALOR da prop de cardio, não sobre a tag inteira: `onIrSessao`
    // legitimamente chama `iniciarSessaoGuiada` — é o handler dos dias de FORÇA, e proibi-lo
    // na tag toda acusaria o comportamento certo. (Foi o que aconteceu na 1ª escrita.)
    const j = tag.indexOf('onRegistrarCardio=');
    const handler = tag.slice(j, tag.indexOf('\n', j));
    expect(handler).toMatch(/setRegistrandoCardio\(true\)/);
    expect(handler, 'o dia de cardio abriria a sessão de força').not.toMatch(/iniciarSessaoGuiada/);
    // E o handler dos dias de FORÇA continua sendo o que abre a sessão — o outro lado.
    expect(tag).toMatch(/onIrSessao=[^\n]*iniciarSessaoGuiada/);
  });
});

describe('🔴 ③ o relógio do mesociclo não se move com cardio', () => {
  const dia = (n: number) =>
    new Date(Date.parse('2026-07-31T00:00:00Z') - n * 86_400_000).toISOString().slice(0, 10);

  const base = (dataISO: string, n: number): SessaoHistorico =>
    ({ n, dataISO, dia: 'Treino', series: 12, volumeKg: 3000, feedback: {}, exercicios: [] } as unknown as SessaoHistorico);
  const cardio = (dataISO: string, n: number): SessaoHistorico =>
    ({ ...base(dataISO, n), tipo: 'cardio', cardio: { modalidade: 'caminhada', intensidade: 'moderado', minutos: 30, met: 4.3, kcal: 120 } } as SessaoHistorico);

  it('`sessoesResistidas` exclui cardio — é o balde que move o relógio', () => {
    const h = [base(dia(20), 1), cardio(dia(10), 2), cardio(dia(3), 3)];
    expect(sessoesResistidas(h).map((s) => s.dataISO)).toEqual([dia(20)]);
    // …e a Chama continua contando o cardio: são baldes diferentes, de propósito.
    expect(sessoesTreino(h)).toHaveLength(3);
  });

  /**
   * 🔑 O PAR DISCRIMINANTE. O relógio conta SEMANAS COM ATIVIDADE (sondado, não presumido),
   * então acrescentar sessão numa semana que já tem não move nada — e um teste montado
   * assim passaria mesmo se o cardio entrasse no balde. A prova precisa ser a MESMA DATA,
   * numa semana ainda vazia: como força ela move o relógio; como cardio, não pode mover.
   */
  const inicio = dia(20);
  const semanaDe = (h: SessaoHistorico[]) =>
    semanaDoCiclo(inicio, dia(0), sessoesResistidas(h).map((s) => s.dataISO).sort());
  const soForca = [base(dia(20), 1), base(dia(18), 2)];

  it('anti-vacuidade: a data escolhida MOVE o relógio quando é força', () => {
    expect(semanaDe([...soForca, base(dia(13), 3)]), 'a data não discrimina — escolha outra')
      .toBeGreaterThan(semanaDe(soForca));
  });

  it('🔒 a MESMA data, como CARDIO, não move o relógio', () => {
    const antes = semanaDe(soForca);
    expect(semanaDe([...soForca, cardio(dia(13), 3)]), `o cardio moveu a semana de ${antes}`).toBe(antes);
  });

  it('🔒 nem três cardios seguidos, em semanas diferentes, movem', () => {
    const antes = semanaDe(soForca);
    const comCardio = [...soForca, cardio(dia(13), 3), cardio(dia(6), 4), cardio(dia(0), 5)];
    expect(semanaDe(comCardio), `3 cardios moveram a semana de ${antes}`).toBe(antes);
  });
});

/* ══════════════ A EMISSÃO — agora os três guards são exercitados de verdade ══════════════ */

describe('🔴 o montador EMITE o dia de cardio', () => {
  it('emite um dia por excedente, e a contagem bate com `diasCardioRecuperacao`', () => {
    const r = rotinaComExcedente();
    expect(r.diasCardio, 'o dia excedente continua sendo só um número').toHaveLength(r.diasCardioRecuperacao);
    expect(r.diasCardio.length).toBeGreaterThan(0);
    for (const d of r.diasCardio) {
      expect(d.padrao, 'o slot precisa ser de padrão cardio').toBe('cardio');
      expect(d.modalidade, 'a modalidade default é caminhada').toBe('caminhada');
    }
  });

  /** 🔒 A meta por dia é o teto desejado; cardio automático adapta-se ao orçamento sem +8 min. */
  it('a duração é a meta ÷ dias limitada ao tempo disponível — com prova numérica', () => {
    const r = rotinaComExcedente({ objetivo: 'saude', diasDisponiveis: 5 });
    const n = r.diasCardio.length;
    expect(n, 'sem excedente o caso não discrimina').toBeGreaterThan(0);
    expect(r.cardio.tipo).toBe('minutos_semana');
    // 🔒 A MESMA função do módulo puro — inclusive o teto de 90 (DF 2026-08-01).
    const alvoDoDia = duracaoDoDiaDeCardio((r.cardio as { min: number }).min, n);
    const esperado = Math.min(alvoDoDia, 60); // destino puro: orçamento integral de 60 min
    for (const d of r.diasCardio) expect(d.minutos, `${n} dias`).toBe(esperado);
    expect(alvoDoDia).toBe(90); // discrimina o clamp: sem adaptação seriam 90 min
    expect(esperado).toBe(60);
  });

  /** 🔴 O PISO da faixa, não o teto: 150 ÷ 3 = 50 min/dia contra 300 ÷ 3 = 100. Fator 2. */
  it('emagrecimento usa o PISO da faixa — o teto daria o dobro', () => {
    const r = rotinaComExcedente({ objetivo: 'emagrecimento', diasDisponiveis: 6 });
    const c = r.cardio as { tipo: string; min: number; max: number };
    expect(c.tipo).toBe('minutos_semana');
    expect(c.min, 'a faixa mudou — reveja o número da prova').toBe(150);
    expect(c.max).toBe(300);
    const n = r.diasCardio.length;
    const alvoPiso = arredondar5(c.min / n);
    expect(r.diasCardio[0]!.minutos).toBe(Math.min(alvoPiso, 60));
    expect(alvoPiso).toBe(75); // a meta desejada excede o orçamento de 60 min
    expect(arredondar5(c.max / n), 'o teto daria o dobro').toBe(arredondar5(c.min / n) * 2);
  });

  /** 🔒 Massa é meta qualitativa: sem duração explícita, não existe bloco canônico materializável. */
  it('massa preserva a meta em sessões como item explícito, sem inventar duração nem bloco', () => {
    const r = rotinaComExcedente({ objetivo: 'massa', diasDisponiveis: 6 });
    expect(r.cardio.tipo).toBe('sessoes_moderadas');
    expect(r.distribuicaoCardio?.blocosPorDia).toEqual([]);
    expect(r.diasCardio).toHaveLength(2);
    expect(r.diasCardio.every((d) => d.minutos === null && d.duracaoSegundos === undefined)).toBe(true);
    const afetados = r.planoFinalPorDia?.filter((d) => d.cardio) ?? [];
    expect(afetados).toHaveLength(2);
    expect(afetados.every((d) => d.duracao.estadoCalculo === 'NAO_AVALIADO')).toBe(true);
    expect(r.resultadoGeracao).toEqual({
      tipo: 'NAO_AVALIADO_ENTREGAVEL',
      motivos: expect.arrayContaining(['CARDIO_SEM_DURACAO']),
    });
  });

  it('sem dia excedente, nenhum dia de cardio é emitido', () => {
    const r = rotinaComExcedente({ diasDisponiveis: 3 });
    expect(r.diasCardioRecuperacao).toBe(0);
    expect(r.diasCardio).toEqual([]);
  });
});

describe('🔴 ① a EMISSÃO não faz o dia virar `treino` (o guard, agora exercitado)', () => {
  it('o dia emitido é rotulado `cardio`, e sem `sessionIdx`', () => {
    const r = rotinaComExcedente();
    const semana = montarSemana(['seg', 'ter', 'qua', 'qui', 'sex'], r.dias.map((d) => d.nome), 0, r.diasCardio);
    const cardios = semana.filter((d) => d.tipo === 'cardio');
    expect(cardios.length, 'a emissão não chegou à faixa da semana').toBe(r.diasCardio.length);
    for (const d of cardios) {
      // 🔴 `sessionIdx` é o que abre a sessão guiada. O dia de cardio nunca pode ter um.
      expect(d.sessionIdx, `${d.full} ganhou índice de sessão de força`).toBeUndefined();
      expect(d.cardioIdx, 'o índice do dia de cardio é de OUTRO array').not.toBeUndefined();
      expect(r.diasCardio[d.cardioIdx!], 'o índice aponta para fora do array').toBeTruthy();
    }
    // E nenhum dia virou 'treino' além das sessões de força que existem.
    expect(semana.filter((d) => d.tipo === 'treino')).toHaveLength(r.dias.length);
  });

  it('sem `diasCardio`, o comportamento anterior é byte-idêntico (excedente = recuperação)', () => {
    const r = rotinaComExcedente();
    const antes = montarSemana(['seg', 'ter', 'qua', 'qui', 'sex'], r.dias.map((d) => d.nome), 0);
    expect(antes.filter((d) => d.tipo === 'recuperacao').length).toBe(r.diasCardioRecuperacao);
    expect(antes.filter((d) => d.tipo === 'cardio')).toHaveLength(0);
  });
});

describe('🔴 ②/③ a emissão NÃO abriu caminho para a sessão guiada nem para o relógio', () => {
  it('🔒 `rotina.dias` continua só com força — é o que torna ② e ③ impossíveis', () => {
    const r = rotinaComExcedente();
    // `iniciarSessaoGuiada(idx)` indexa ESTE array. Um dia de cardio aqui dispararia
    // `sessao_iniciada` e, ao concluir, entraria no balde de `sessoesResistidas`.
    expect(r.dias.length, 'o dia de cardio entrou no array das sessões de força').toBe(r.diasForcaAgendados);
    for (const d of r.dias) {
      expect(d.slots.length, 'sessão de força sem slot').toBeGreaterThan(0);
      for (const s of d.slots) {
        expect(s.padrao, `${d.nome} recebeu slot de cardio`).not.toBe('cardio');
      }
    }
  });

  it('e os dois arrays são disjuntos — nenhum dia de cardio aparece em `dias`', () => {
    const r = rotinaComExcedente();
    const nomesForca = new Set(r.dias.map((d) => d.nome));
    for (const c of r.diasCardio) {
      expect(nomesForca.has(c.nome), `${c.nome} está nos dois arrays`).toBe(false);
    }
  });
});

/**
 * 🔒 A HONESTIDADE QUE VEM COM O TETO (DF 2026-08-01). Quando o teto morde, o app NÃO pode
 * afirmar que a meta semanal está coberta — nem explicar uma fórmula que deixou de valer.
 */
describe('🔴 o teto morde sem o app mentir sobre a semana', () => {
  const podarSrc = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  const semana = () => podarSrc(readFileSync('src/components/painel/SuaSemana.tsx', 'utf8'));

  it('a copy NÃO explica mais a fórmula — ela virou falsa quando o teto corta', () => {
    const s = semana();
    expect(s, 'a frase da divisão voltou e mente com 1 dia excedente')
      .not.toMatch(/meta da semana dividida/);
    expect(s).toMatch(/Dia ativo de cardio\. Pode trocar a modalidade/);
  });

  it('🔴 e não aparece contador do que "falta" da meta — futuro da atividade da pessoa', () => {
    const s = semana();
    for (const re of [/faltam?\s+\d/i, /restam?\s+\d/i, /de \d+ min da semana/i, /\d+\s*\/\s*\d+\s*min/]) {
      expect(re.test(s), `contador de meta na tela: ${re}`).toBe(false);
    }
  });

  it('anti-vacuidade: o recorte lê o arquivo certo e enxerga o cartão do dia', () => {
    expect(semana()).toMatch(/tipo === 'cardio'|sd\.cardio/);
    expect(semana().length).toBeGreaterThan(3000);
  });
});

/**
 * 🔴 O CARTÃO SEMANAL MEDE CONTRA O PLANO, E EM FORMA DE REGISTRO (DF 2026-08-01).
 *
 * Defeito ANTERIOR ao teto: o cartão dizia "Faltam 150 minutos para os 150" enquanto o
 * plano oferecia um único dia de cardio. 🔑 A varredura de afirmações nunca o pegou porque
 * procurava copy FALSA — e essa era verdadeira. Classe nova: **copy verdadeira que viola
 * trava de forma** (① alvo no futuro da atividade + ③ denominador).
 */
describe('🔴 o cartão de cardio: denominador do PLANO, forma de registro', () => {
  const podarSrc = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  const card = () => podarSrc(readFileSync('src/components/painel/Cardio.tsx', 'utf8'));

  it('(b) o "Faltam" SAIU — sem contagem regressiva', () => {
    const s = card();
    expect(s, 'a dívida voltou').not.toMatch(/Faltam? \$\{/);
    expect(s, 'a forma "para os Y" voltou').not.toMatch(/para os \$\{/);
    expect(s).toMatch(/Você registrou \$\{feito\} min de cardio nesta semana/);
  });

  it('(a) o denominador é o que o PLANO prescreve, não a meta abstrata', () => {
    const s = card();
    expect(s).toMatch(/prescrito != null && prescrito > 0 \? prescrito : meta\.alvo/);
    // 🔒 A barra e os rótulos usam `base` (o plano), não `meta.alvo` direto.
    expect(s).toMatch(/de \{base\} min no seu plano/);
    expect(s).toMatch(/\{base\} \(o cardio do seu plano\)/);
    expect(s, 'a barra voltou a medir contra a meta abstrata').not.toMatch(/\(feito \/ meta\.alvo\)/);
  });

  /**
   * 🔴 D4 (2026-09-10) — esta asserção CODIFICAVA o defeito. O describe promete "denominador
   * do PLANO"; a asserção exigia a soma de `diasCardio[].minutos`, que é o ENTREGUE. Medido:
   * prescrição de 160 min, entrega de 123, e a barra fechava 123/123 — o cartão não tinha como
   * mostrar falta nenhuma, porque o denominador encolhia junto com o numerador.
   *
   * A prescrição real é `rotina.cardioSemana.prescritoSegundos`. O que falta aparece na faixa
   * de avisos do motor (`AvisosMotor`), com planejado, entregue e faltante.
   */
  it('e o Painel passa a PRESCRIÇÃO do motor, não a soma do que coube', () => {
    const p = podarSrc(readFileSync('src/components/painel/Painel.tsx', 'utf8'));
    expect(p).toMatch(/prescritoMin:[\s\S]{0,200}cardioSemana\.prescritoSegundos/);
    expect(p, 'o denominador voltou a ser a soma do entregue')
      .not.toMatch(/prescritoMin: \(treino\.rotina\?\.diasCardio/);
  });

  it('anti-vacuidade: o recorte lê o cartão certo e enxerga a barra', () => {
    expect(card()).toMatch(/function BarraMinutos/);
    expect(card().length).toBeGreaterThan(3000);
  });
});
