/**
 * 🔒 REGRESSÃO — os três relatos de 2026-09-19, cada um com a causa medida no código.
 *
 * ① DIAS ALTERADOS NÃO REFAZEM A SEMANA. Causa: `diasForca = min(dias da agenda, teto de
 *    sessões do nível)` (`treino-montador.ts`), a regra do Passo 3 travada no cofre
 *    (`motor-treino-volume-e-frequencia-por-nivel`, claims --007 e --010). Ela está certa; o
 *    defeito era o SILÊNCIO: um intermediário marcando os sete dias recebia segunda a sexta,
 *    sábado e domingo viravam `diasCardioRecuperacao` sem uma única frase, e o Editar perfil
 *    ainda rotulava os sete como "Treino". Medido: iniciante com 7 dias ⇒ plano de segunda a
 *    quinta, `avisos` sem nenhuma menção aos outros três.
 *
 * ② IMPROVISO DOMÉSTICO EM TREINO DE ACADEMIA. Causa: `exercicioDisponivel` devolve `true`
 *    para TUDO quando o equipamento é `academia`, então os sete exercícios de `local:
 *    'casa_sem'` cujo `equipamentoDetalhe` traz a montagem entre parênteses (mesa firme, duas
 *    cadeiras, cabo de vassoura, apoio no sofá) concorriam com máquinas e polias. Medido numa
 *    varredura de 1 620 perfis de academia: 928 (57 %) tinham pelo menos um, 1 133 slots.
 *
 * ③ UNILATERAL ONDE CABIA BILATERAL. Causa: nem o alocador nem a troca olhavam `execucao` —
 *    a rotação escolhia "o próximo do pool" dentro da função, e o stiff unilateral (e82) ou a
 *    puxada unilateral na polia (e51) entravam no lugar de equivalentes bilaterais da MESMA
 *    família.
 *
 * Cada `it` abaixo FALHA sobre `origin/main` em d43376c.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino, tetoSessoesForca } from './treino';
import { montarRotina, poolElegivel } from './treino-montador';
import { creditoPonderadoDaSemana } from './alocador';
import { tetoSeriesPorExercicio } from './trilhos';
import { ehImprovisoDomestico, servePelaSelecaoAutomatica } from './equipamento';
import { substituirExercicio } from './substituicao';
import { funcaoDe } from './selecao-referencia';
import { diretosDoExercicio, tracosMecanicos } from './cobertura-anatomica';
import { ehBilateral } from '../data/lateralidade';
import { ORDEM_SEMANA, type Weekday } from '../semana';
import type { EquipamentoCasa, EquipamentoDisp, Exercise } from '../data/types';
import type { FlagsSaude } from './types';
import type { DivisaoPreferida, PerfilTreino, RotinaCustom, RotinaSemanal, SemanaCiclo } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const TODOS: Weekday[] = [...ORDEM_SEMANA];
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qui', 'sex'],
  tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado', ...over,
});
const comDias = (dias: Weekday[], over: Partial<PerfilTreino> = {}) =>
  perfil({ diasDisponiveis: dias.length, treinoDias: dias, ...over });
const montar = (p: PerfilTreino, semana: SemanaCiclo = 5): RotinaSemanal =>
  montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana, feedbackGrupos: new Map() });
const diasDo = (r: RotinaSemanal) => r.dias.map((d) => d.diaId);
const slots = (r: RotinaSemanal) => r.dias.flatMap((d) => d.slots);
const assinatura = (r: RotinaSemanal) =>
  r.dias.map((d) => `${d.diaId}:${d.nome}:${d.slots.map((s) => `${s.exercicio.id}x${s.series}`).join(',')}`).join('|');
const DITO_DIAS = /Você marcou \d+ dias e o (plano usou|seu treino cobre)/;

/* ═══════════ ① Todo dia marcado para musculação vira sessão ═══════════ */

/**
 * 🔵 A DECISÃO DE 2026-09-20 SUBSTITUI A DE 19/09, e os testes seguem a decisão.
 *
 * Em 19/09 o corte `min(dias da agenda, teto do nível)` foi mantido e apenas DITO; os `it`
 * desta seção cobravam a frase. A revisão recusou: dizer não atende quem marcou sete dias e
 * recebeu cinco sessões. Agora a agenda manda, e o que se cobra aqui é o comportamento novo —
 * quantidade exata de sessões, dias entregues, recálculo real da distribuição e os limites de
 * volume de pé. As asserções antigas não foram afrouxadas: elas mediam uma regra que deixou
 * de existir, e no lugar delas entraram asserções mais fortes sobre a regra que existe.
 */
describe('① a agenda manda: todo dia marcado vira sessão', () => {
  it('de 1 a 7 dias, em todos os níveis: tantas sessões quantos dias, e nos dias certos', () => {
    for (const nivelExperiencia of ['iniciante', 'intermediario', 'avancado'] as const) {
      for (let n = 1; n <= 7; n += 1) {
        const agenda = TODOS.slice(0, n);
        const r = montar(comDias(agenda, { nivelExperiencia }));
        const rot = `${nivelExperiencia}/${n}d`;
        expect(r.dias.length, `${rot}: sessões entregues`).toBe(n);
        expect(diasDo(r), `${rot}: dias entregues`).toEqual(agenda);
        expect(r.diasForcaAgendados, `${rot}: contador`).toBe(n);
        expect(r.diasCardioRecuperacao, `${rot}: dia descartado como recuperação`).toBe(0);
        for (const d of r.dias) expect(d.slots.length, `${rot}: ${d.diaId} veio vazio`).toBeGreaterThan(0);
        const assinaturas = r.dias.map((d) => d.slots.map((s) => s.exercicio.id).sort().join(','));
        expect(new Set(assinaturas).size, `${rot}: sessão duplicada para preencher a contagem`).toBe(n);
      }
    }
  });

  it('nenhuma frase de dia perdido sobra no caminho automático', () => {
    for (let n = 1; n <= 7; n += 1) {
      const r = montar(comDias(TODOS.slice(0, n)));
      expect(r.avisos.filter((a) => DITO_DIAS.test(a)), `${n} dias`).toEqual([]);
    }
  });

  it('a referência do nível continua legível pela MESMA função — só deixou de cortar', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      const referencia = tetoSessoesForca(nivel);
      expect(referencia, `${nivel}: a referência sumiu`).toBeGreaterThan(0);
      const r = montar(comDias(TODOS, { nivelExperiencia: nivel }));
      expect(r.dias.length, `${nivel}: a referência voltou a cortar a agenda`).toBe(7);
    }
  });
});

describe('① mudar os dias recalcula a semana inteira', () => {
  /** Quantos dias distintos tocam cada grupo — a frequência real entregue. */
  const frequencia = (r: RotinaSemanal) => {
    const m = new Map<string, number>();
    for (const d of r.dias) {
      for (const g of new Set(d.slots.flatMap((s) => (s.exercicio.grupoPrimario ? [s.exercicio.grupoPrimario] : [])))) {
        m.set(g, (m.get(g) ?? 0) + 1);
      }
    }
    return m;
  };
  const totalSeries = (r: RotinaSemanal) => slots(r).reduce((n, s) => n + (s.series ?? 0), 0);

  it.each([[5, 7], [4, 6], [7, 3]] as const)('%i → %i: dias, divisão, distribuição e séries mudam juntos', (de, para) => {
    const agendaDe = TODOS.slice(0, de);
    const agendaPara = TODOS.slice(0, para);
    const antes = montar(comDias(agendaDe));
    const depois = montar(comDias(agendaPara));
    expect(diasDo(antes)).toEqual(agendaDe);
    expect(diasDo(depois)).toEqual(agendaPara);
    expect(antes.dias).toHaveLength(de);
    expect(depois.dias).toHaveLength(para);
    /**
     * Não basta anexar dias. O RÓTULO da divisão não serve de prova — quando o calendário
     * reagrupa, os dois planos se chamam "Distribuição pela agenda" —, então o que se cobra é o
     * conteúdo: a sequência de sessões e a FREQUÊNCIA por grupo têm de se mover na direção certa.
     */
    expect(assinatura(depois), 'o plano é o mesmo com dias colados').not.toBe(assinatura(antes));
    expect(depois.dias.map((d) => d.nome), 'as sessões são as mesmas').not.toEqual(antes.dias.map((d) => d.nome));
    const fa = frequencia(antes); const fd = frequencia(depois);
    const cresceu = para > de;
    expect([...fd.entries()].some(([g, v]) => (cresceu ? v > (fa.get(g) ?? 0) : v < (fa.get(g) ?? 0))),
      `nenhum grupo ${cresceu ? 'ganhou' : 'perdeu'} exposição: antes ${JSON.stringify([...fa])} depois ${JSON.stringify([...fd])}`).toBe(true);
    // Duração: cada dia é recalculado, nenhum fica sem estimativa.
    for (const d of depois.dias) expect(d.slots.length, `${d.diaId} vazio`).toBeGreaterThan(0);
  });

  it('trocar QUAIS dias, mantendo a quantidade, move o plano para os novos dias', () => {
    const a = montar(comDias(['seg', 'ter', 'qui', 'sex']));
    const b = montar(comDias(['ter', 'qua', 'sex', 'sab']));
    expect(diasDo(a)).toEqual(['seg', 'ter', 'qui', 'sex']);
    expect(diasDo(b)).toEqual(['ter', 'qua', 'sex', 'sab']);
    expect(a.dias).toHaveLength(4);
    expect(b.dias).toHaveLength(4);
  });

  /**
   * 🔵 TÍTULO CORRIGIDO EM 2026-09-20 (3ª volta). Ele dizia "a dose é repartida", e a medição
   * diz outra coisa: a dose CRESCE — só que muito menos que a agenda. Em intermediário /
   * academia / 60 min / semana 5, 4 → 7 dias é +75 % de dias e +31 % de séries diretas
   * (84 → 110), +30 % de crédito ponderado (108 → 140). O que o teste sempre cobrou é isso:
   * nem encolher, nem acompanhar o número de dias. A promessa de dose invariável saiu também
   * da tela (`DiasEPreferencias`, `EditarPerfil`) e dos comentários do motor.
   */
  it('MAIS DIAS NÃO MULTIPLICA O VOLUME: a dose cresce menos que a agenda, e os tetos dos PRs 17–19 seguem de pé', () => {
    for (const nivelExperiencia of ['iniciante', 'intermediario', 'avancado'] as const) {
      const quatro = montar(comDias(TODOS.slice(0, 4), { nivelExperiencia }));
      const sete = montar(comDias(TODOS, { nivelExperiencia }));
      const rot = `${nivelExperiencia}`;
      // Nem encolhe (mais dias não pode piorar) nem multiplica na proporção dos dias.
      expect(totalSeries(sete), `${rot}: 7 dias entregaram menos que 4`).toBeGreaterThanOrEqual(totalSeries(quatro));
      expect(totalSeries(sete), `${rot}: o volume acompanhou o número de dias`)
        .toBeLessThan(totalSeries(quatro) * (7 / 4));
      // 🔒 E a mesma régua na OUTRA moeda: crédito ponderado (direto 1,0 + indireto 0,5).
      //    As duas medições do relatório usam moedas e semanas diferentes; aqui ficam juntas
      //    para que nenhuma promessa de "mesma dose" volte por uma delas.
      const pond = (r: RotinaSemanal) => [...creditoPonderadoDaSemana(slots(r)).values()].reduce((n, v) => n + v, 0);
      expect(pond(sete), `${rot}: ponderado encolheu com mais dias`).toBeGreaterThanOrEqual(pond(quatro));
      expect(pond(sete), `${rot}: ponderado acompanhou o número de dias`).toBeLessThan(pond(quatro) * (7 / 4));
      for (const r of [quatro, sete]) {
        const teto = r.tetoVolumeSemana!;
        // ① teto SEMANAL por grupo, na conta ponderada que o motor usa.
        const semana = creditoPonderadoDaSemana(slots(r));
        for (const [g, v] of semana) expect(v, `${rot}/${g}: semana`).toBeLessThanOrEqual(teto.cheio);
        // ② teto por SESSÃO, também ponderado.
        for (const d of r.dias) {
          const dia = creditoPonderadoDaSemana(d.slots);
          for (const [g, v] of dia) expect(v, `${rot}/${d.diaId}/${g}: sessão`)
            .toBeLessThanOrEqual(teto.sessao ?? Number.POSITIVE_INFINITY);
        }
        // ③ teto por EXERCÍCIO, do nível.
        for (const s of slots(r)) expect(s.series ?? 0, `${rot}/${s.exercicio.id}`)
          .toBeLessThanOrEqual(tetoSeriesPorExercicio(nivelExperiencia));
      }
    }
  });

  it('o cardio explicitamente escolhido sobrevive à mudança de dias', () => {
    const oferecidos: Weekday[] = ['qua', 'sab'];
    const p = comDias(['seg', 'ter', 'qui', 'sex', 'sab']);
    const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(),
      { semana: 5, feedbackGrupos: new Map() }, undefined, undefined, oferecidos);
    const daOferta = (r.fatosDistribuicaoCardio?.diasHorizonte ?? []).filter((d) => d.oferecido).map((d) => d.diaId);
    expect(daOferta, 'a oferta de cardio não chegou aos fatos publicados').toEqual(oferecidos);
    expect(r.dias).toHaveLength(5);
  });
});

describe('① montagem manual: os dias do desenho valem, e o que falta é dito', () => {
  const desenhoDe = (r: RotinaSemanal): RotinaCustom => ({
    origem: 'usuario',
    dias: r.dias.map((d) => ({ nome: d.nome, diaId: d.diaId!, exercicioIds: d.slots.map((s) => s.exercicio.id) })),
  });

  it('um desenho de sete dias entrega sete sessões', () => {
    const base = montar(comDias(['seg', 'ter', 'qui', 'sex']));
    const sete: RotinaCustom = {
      origem: 'usuario',
      dias: [
        ...desenhoDe(base).dias,
        { nome: 'Extra A', diaId: 'qua', exercicioIds: ['e9', 'e49'] },
        { nome: 'Extra B', diaId: 'sab', exercicioIds: ['e32', 'e64'] },
        { nome: 'Extra C', diaId: 'dom', exercicioIds: ['e41', 'e19'] },
      ],
    };
    const r = montar(comDias(TODOS, { rotinaCustom: sete }));
    expect(r.dias).toHaveLength(7);
    expect(diasDo(r).slice().sort()).toEqual([...TODOS].sort());
    expect(r.avisos.filter((a) => DITO_DIAS.test(a)), 'nada falta quando o desenho cobre tudo').toEqual([]);
  });

  it('salvar o perfil NÃO apaga o desenho: o dia que ele não cobre é nomeado, não reescrito', () => {
    const base = montar(comDias(['seg', 'ter', 'qui', 'sex']));
    const desenho = desenhoDe(base);
    const r = montar(comDias(TODOS, { rotinaCustom: desenho }));
    // O desenho original continua byte a byte no plano.
    for (const d of desenho.dias) {
      const entregue = r.dias.find((x) => x.diaId === d.diaId);
      expect(entregue, `${d.diaId} sumiu do desenho`).toBeTruthy();
      expect(entregue!.slots.map((s) => s.exercicio.id), d.diaId).toEqual(d.exercicioIds);
    }
    const frase = r.avisos.find((a) => DITO_DIAS.test(a));
    expect(frase, `o desenho cobre 4 de 7 e nada é dito: ${r.avisos.join(' | ')}`).toBeDefined();
    expect(frase).toContain('Quarta-feira');
    expect(frase).toContain('não reescreve o seu desenho');
  });

  it('a geração automática, pedida depois, usa a agenda atual e entrega os sete dias', () => {
    // O mesmo perfil, SEM o desenho: é o que "gerar novo treino" faz depois da confirmação.
    const r = montar(comDias(TODOS));
    expect(r.dias).toHaveLength(7);
    expect(diasDo(r)).toEqual([...TODOS]);
  });
});

/* ═══════════ ② Academia não recebe improviso doméstico ═══════════ */

const IMPROVISOS = ['e59', 'e100', 'e116', 'e164', 'e165', 'e166', 'e168'];

describe('② academia: improviso doméstico fora da seleção automática', () => {
  it('a classificação é por ambiente + montagem, não por "peso corporal"', () => {
    const porId = new Map(EXERCISES.map((e) => [e.id, e]));
    for (const id of IMPROVISOS) expect(ehImprovisoDomestico(porId.get(id)!), id).toBe(true);
    // Peso corporal LEGÍTIMO continua dentro: flexão, barra fixa, prancha, agachamento livre.
    for (const id of ['e1', 'e21', 'e7', 'e3', 'e57', 'e17']) {
      expect(ehImprovisoDomestico(porId.get(id)!), id).toBe(false);
    }
    expect(EXERCISES.filter(ehImprovisoDomestico).map((e) => e.id).sort()).toEqual([...IMPROVISOS].sort());
  });

  it('nenhum plano AUTOMÁTICO de academia traz improviso — em toda a grade varrida', () => {
    const achados: string[] = [];
    let medidos = 0;
    for (const nivelExperiencia of ['iniciante', 'intermediario', 'avancado'] as const) {
      for (const objetivo of ['massa', 'saude', 'emagrecimento'] as const) {
        for (const n of [1, 3, 5, 7]) {
          for (const tempoPorSessaoMin of [30, 60, 90]) {
            for (const divisaoPreferida of ['auto', 'superior-inferior', 'prioridades'] as DivisaoPreferida[]) {
              for (const variacaoTreino of [0, 1, 2]) {
                medidos += 1;
                const r = montar(comDias(TODOS.slice(0, n), {
                  nivelExperiencia, objetivo, tempoPorSessaoMin, divisaoPreferida,
                  limiteTempoTreino: tempoPorSessaoMin >= 75 ? 'sem_limite' : 'limitado',
                  ...(variacaoTreino ? { variacaoTreino } : {}),
                }));
                const maus = slots(r).filter((s) => ehImprovisoDomestico(s.exercicio));
                if (maus.length > 0) {
                  achados.push(`${nivelExperiencia}/${objetivo}/${n}d/${tempoPorSessaoMin}/${divisaoPreferida}/v${variacaoTreino}: ${maus.map((s) => s.exercicio.id).join(',')}`);
                }
              }
            }
          }
        }
      }
    }
    expect(medidos, 'a varredura degenerou').toBeGreaterThan(300);
    expect(achados.slice(0, 10), `${achados.length} planos de academia com improviso doméstico`).toEqual([]);
  });

  it('o mesmo exercício continua elegível em CASA — a regra é de ambiente, não de catálogo', () => {
    const casa = poolElegivel(EXERCISES, { equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: 'avancado' });
    for (const id of IMPROVISOS) {
      const e = casa.find((x) => x.id === id);
      expect(e, `${id} sumiu do perfil de casa`).toBeTruthy();
      expect(servePelaSelecaoAutomatica(e!, 'casa'), id).toBe(true);
    }
  });

  it('o desenho MANUAL da pessoa é preservado: a regra filtra a escolha do app, não a dela', () => {
    const custom: RotinaCustom = {
      origem: 'usuario',
      dias: [{ nome: 'Costas', diaId: 'seg', exercicioIds: ['e166', 'e49'] }],
    };
    const r = montar(comDias(['seg'], { rotinaCustom: custom }));
    expect(slots(r).map((s) => s.exercicio.id)).toContain('e166');
    expect(r.avisos.some((a) => /não elegíveis no perfil/.test(a)), 'o desenho foi tratado como inelegível').toBe(false);
  });

  it('a TROCA automática em academia também não oferece improviso', () => {
    const porId = new Map(EXERCISES.map((e) => [e.id, e]));
    for (const atual of ['e49', 'e46', 'e9']) {
      for (let k = 0; k < 6; k += 1) {
        const r = substituirExercicio({
          exercicioAtual: porId.get(atual)!,
          equipamento: 'academia',
          equipamentosCasa: [],
          nivelExperiencia: 'avancado',
          exercises: EXERCISES,
          historicoRecenteIds: IMPROVISOS.slice(0, k),
        });
        if (r.exercicio) expect(ehImprovisoDomestico(r.exercicio), `${atual} → ${r.exercicio.id}`).toBe(false);
      }
    }
  });
});

/* ═══════════ ③ Bilateral primeiro, dentro da mesma função ═══════════ */

describe('③ execução bilateral como padrão', () => {
  /**
   * Havia bilateral ELEGÍVEL, livre, da MESMA função e que cobre os MESMOS alvos anatômicos
   * diretos? Então o unilateral era evitável.
   *
   * 🔒 A cobertura entra no predicado porque ela vence a preferência — e deve vencer, nas DUAS
   * moedas que o motor usa:
   *  · ALVOS diretos (`diretosDoExercicio`) — medido: o `e147` Bird dog (unilateral alternado)
   *    ocupa um slot de core onde a prancha `e7` (bilateral) estava livre, e os dois não cobrem
   *    os mesmos alvos;
   *  · TRAÇOS mecânicos (`tracosMecanicos`) — medido: o `e133` e o `e40` têm o mesmo alvo e
   *    traços diferentes, e trocar um pelo outro custaria o traço. As duas moedas entram no
   *    predicado porque as duas são cobertura.
   * A preferência por execução escolhe entre equivalentes; ela não é autorização para perder
   * alvo nem traço.
   */
  const unilateralEvitavel = (r: RotinaSemanal, pool: readonly Exercise[]) => {
    const fora: string[] = [];
    for (const d of r.dias) {
      const usados = new Set(d.slots.map((s) => s.exercicio.id));
      for (const s of d.slots) {
        if (ehBilateral(s.exercicio)) continue;
        const f = funcaoDe(s.exercicio);
        const alvos = [...diretosDoExercicio(s.exercicio.id)];
        const alternativa = pool.find((e) => {
          if (e.id === s.exercicio.id || usados.has(e.id)) return false;
          if (e.grupoPrimario !== s.exercicio.grupoPrimario || funcaoDe(e) !== f || !ehBilateral(e)) return false;
          const dela = diretosDoExercicio(e.id);
          if (!alvos.every((a) => dela.has(a))) return false;
          const tracos = tracosMecanicos(e.id);
          return [...tracosMecanicos(s.exercicio.id)].every((t) => tracos.has(t));
        });
        if (alternativa) fora.push(`${d.diaId}/${s.exercicio.id} (havia ${alternativa.id})`);
      }
    }
    return fora;
  };

  it('os dois casos do relato: stiff unilateral e puxada unilateral não entram quando há bilateral da mesma função', () => {
    const achados: string[] = [];
    for (const nivelExperiencia of ['iniciante', 'intermediario', 'avancado'] as const) {
      for (const n of [3, 4, 5, 6]) {
        for (const tempoPorSessaoMin of [45, 60, 75, 90]) {
          for (const variacaoTreino of [0, 1, 2, 3]) {
            const r = montar(comDias(TODOS.slice(0, n), {
              nivelExperiencia, tempoPorSessaoMin, variacaoTreino,
              limiteTempoTreino: tempoPorSessaoMin >= 75 ? 'sem_limite' : 'limitado',
            }));
            for (const id of ['e82', 'e51']) {
              if (slots(r).some((s) => s.exercicio.id === id)) {
                achados.push(`${nivelExperiencia}/${n}d/${tempoPorSessaoMin}/v${variacaoTreino}: ${id}`);
              }
            }
          }
        }
      }
    }
    expect(achados.slice(0, 10), `${achados.length} planos com o unilateral que o autor recusou`).toEqual([]);
  });

  it('varredura: nenhum unilateral ocupa slot onde cabia um bilateral da MESMA função', () => {
    const fora: string[] = [];
    let medidos = 0;
    for (const equipamento of ['academia', 'casa'] as EquipamentoDisp[]) {
      for (const nivelExperiencia of ['iniciante', 'intermediario', 'avancado'] as const) {
        for (const n of [3, 4, 5, 6]) {
          for (const tempoPorSessaoMin of [45, 75]) {
            for (const variacaoTreino of [0, 1, 2]) {
              const equipamentosCasa: EquipamentoCasa[] = equipamento === 'casa' ? ['halteres', 'elastico', 'banco'] : [];
              const p = comDias(TODOS.slice(0, n), {
                equipamento, equipamentosCasa, nivelExperiencia, tempoPorSessaoMin, variacaoTreino,
                limiteTempoTreino: tempoPorSessaoMin >= 75 ? 'sem_limite' : 'limitado',
              });
              medidos += 1;
              const pool = poolElegivel(EXERCISES, p).filter((e) => servePelaSelecaoAutomatica(e, equipamento));
              fora.push(...unilateralEvitavel(montar(p), pool)
                .map((x) => `${equipamento}/${nivelExperiencia}/${n}d/${tempoPorSessaoMin}/v${variacaoTreino}: ${x}`));
            }
          }
        }
      }
    }
    expect(medidos).toBeGreaterThan(100);
    /**
     * 🔵 O RESÍDUO DE 19/09 FECHOU — e a explicação de 19/09 estava errada.
     *
     * A lista fechada tinha 4 células e a causa registrada era "o passe anatômico precisa do
     * traço novo que a polia traz". Medido em 20/09, não é isso: a `e52` e a `e53` têm os MESMOS
     * alvos diretos (`dl`) e os MESMOS traços (`acao:elevacao_lateral`). O que acontecia era
     * outra coisa — o alocador punha a `e52` num slot e a `e53` no outro (a função
     * `elevacao-lateral` não tem uma segunda bilateral); depois a cobertura trocava a `e52` pela
     * `e107` Crucifixo invertido na máquina, por causa do alvo `dp`, e a `e52` ficava LIVRE sem
     * que ninguém revisse o slot da `e53`.
     *
     * `trocarParaBilateral` é essa releitura, e roda depois de todos os passes. A exceção não
     * era necessária: era uma volta que faltava.
     */
    expect(fora.sort(), `${fora.length} slots unilaterais com bilateral disponível na mesma função`).toEqual([]);
  });

  it('a troca automática prefere o bilateral entre equivalentes', () => {
    const porId = new Map(EXERCISES.map((e) => [e.id, e]));
    for (const atual of ['e82', 'e51', 'e63']) {
      const r = substituirExercicio({
        exercicioAtual: porId.get(atual)!,
        equipamento: 'academia',
        equipamentosCasa: [],
        nivelExperiencia: 'avancado',
        exercises: EXERCISES,
      });
      expect(r.exercicio, atual).toBeTruthy();
      expect(ehBilateral(r.exercicio!), `${atual} → ${r.exercicio!.id} (${r.exercicio!.execucao})`).toBe(true);
    }
  });

  it('SEM alternativa bilateral o unilateral entra normalmente — a preferência não é filtro', () => {
    // A família `afundo` é inteiramente unilateral: não há bilateral para preferir.
    const pool = poolElegivel(EXERCISES, { equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: 'avancado' });
    const afundo = pool.filter((e) => funcaoDe(e) === 'afundo');
    expect(afundo.length, 'a família afundo sumiu do pool').toBeGreaterThan(0);
    expect(afundo.every((e) => !ehBilateral(e)), 'a família deixou de ser inteiramente unilateral').toBe(true);
    const r = montar(comDias(['seg', 'ter', 'qua', 'qui'], { equipamento: 'casa', equipamentosCasa: [] }));
    expect(slots(r).length, 'o plano de casa degenerou').toBeGreaterThan(6);
    expect(slots(r).some((s) => !ehBilateral(s.exercicio)), 'nenhum unilateral entrou — virou filtro').toBe(true);
  });

  it('escolha manual de um unilateral é preservada', () => {
    const custom: RotinaCustom = {
      origem: 'usuario',
      dias: [{ nome: 'Pernas', diaId: 'seg', exercicioIds: ['e82', 'e28'] }],
    };
    const r = montar(comDias(['seg'], { equipamento: 'casa', equipamentosCasa: ['halteres', 'banco'], rotinaCustom: custom }));
    expect(slots(r).map((s) => s.exercicio.id)).toContain('e82');
  });
});
