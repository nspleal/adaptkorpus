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

/* ═══════════════ ① O dia marcado que não vira sessão é DITO ═══════════════ */

describe('① dias alterados: o teto do nível é dito, nunca calado', () => {
  it('sete dias marcados, plano com menos: o motor nomeia os dias que viraram cardio/recuperação', () => {
    const r = montar(comDias(TODOS));
    const frase = r.avisos.find((a) => DITO_DIAS.test(a));
    expect(frase, `nenhum aviso explica os dias que sobraram: ${r.avisos.join(' | ')}`).toBeDefined();
    const ROTULO: Partial<Record<Weekday, string>> = { sab: 'sábado', dom: 'domingo', sex: 'sexta-feira' };
    const sobraram = TODOS.filter((d) => !diasDo(r).includes(d));
    expect(sobraram.length, 'o caso degenerou: a agenda coube inteira').toBeGreaterThan(0);
    for (const dia of sobraram) {
      expect(frase!.toLowerCase(), `${dia} não foi nomeado no aviso`).toContain(ROTULO[dia] ?? dia);
    }
    expect(frase).toContain(`${tetoSessoesForca('intermediario')} sessões de força`);
  });

  it('agenda inteiramente atendida não inventa aviso nenhum', () => {
    for (const n of [1, 2, 3, 4]) {
      const r = montar(comDias(TODOS.slice(0, n)));
      expect(r.avisos.filter((a) => DITO_DIAS.test(a)), `${n} dias`).toEqual([]);
    }
  });

  it('o teto que a tela mostra é o MESMO do motor — uma leitura só', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      const r = montar(comDias(TODOS, { nivelExperiencia: nivel }));
      const semComplementar = r.dias.filter((d) => !/Complementares/i.test(d.nome)).length;
      expect(semComplementar, nivel).toBeLessThanOrEqual(tetoSessoesForca(nivel));
    }
  });
});

describe('① mudar os dias recalcula a semana inteira', () => {
  it('5 → 7 e 4 → 6: os dias entregues saem da agenda confirmada, e o excedente é declarado', () => {
    for (const [de, para] of [[5, 7], [4, 6]] as const) {
      const agendaDe = TODOS.slice(0, de);
      const agendaPara = TODOS.slice(0, para);
      const antes = montar(comDias(agendaDe));
      const depois = montar(comDias(agendaPara));
      for (const [r, agenda] of [[antes, agendaDe], [depois, agendaPara]] as const) {
        expect(new Set(diasDo(r)).size, 'dia repetido no plano').toBe(r.dias.length);
        for (const d of diasDo(r)) expect(agenda, `${d} fora da agenda confirmada`).toContain(d!);
      }
      const naoAtendidos = agendaPara.filter((d) => !diasDo(depois).includes(d));
      if (naoAtendidos.length > 0) expect(depois.avisos.some((a) => DITO_DIAS.test(a)), `${para} dias`).toBe(true);
    }
  });

  it('7 → 3: o plano encolhe de verdade — divisão, dias e distribuição mudam juntos', () => {
    const sete = montar(comDias(TODOS));
    const tres = montar(comDias(['seg', 'qua', 'sex']));
    expect(tres.dias.length).toBe(3);
    expect(diasDo(tres)).toEqual(['seg', 'qua', 'sex']);
    expect(tres.split, 'a divisão não acompanhou a agenda').not.toBe(sete.split);
    expect(assinatura(tres)).not.toBe(assinatura(sete));
    expect(tres.avisos.filter((a) => DITO_DIAS.test(a)), 'com 3 dias nada sobra para declarar').toEqual([]);
  });

  it('trocar QUAIS dias, mantendo a quantidade, move o plano para os novos dias', () => {
    const a = montar(comDias(['seg', 'ter', 'qui', 'sex']));
    const b = montar(comDias(['ter', 'qua', 'sex', 'sab']));
    expect(diasDo(a)).toEqual(['seg', 'ter', 'qui', 'sex']);
    expect(diasDo(b)).toEqual(['ter', 'qua', 'sex', 'sab']);
  });

  it('mais dias não multiplica o volume semanal (os tetos dos PRs 17–19 seguem de pé)', () => {
    const tres = montar(comDias(['seg', 'qua', 'sex']));
    const sete = montar(comDias(TODOS));
    const direto = (r: RotinaSemanal) => slots(r).reduce((n, s) => n + (s.series ?? 0), 0);
    expect(direto(sete)).toBeLessThanOrEqual(direto(tres) * 2);
    for (const r of [tres, sete]) {
      const teto = r.tetoVolumeSemana!;
      for (const d of r.dias) {
        const porGrupo = new Map<string, number>();
        for (const s of d.slots) {
          const g = s.exercicio.grupoPrimario;
          if (!g) continue;
          porGrupo.set(g, (porGrupo.get(g) ?? 0) + (s.series ?? 0));
        }
        for (const [g, v] of porGrupo) expect(v, `${d.diaId}/${g}`).toBeLessThanOrEqual(teto.sessao ?? Number.POSITIVE_INFINITY);
      }
    }
  });
});

describe('① montagem manual: os dias do desenho valem, e o que falta é dito', () => {
  const desenhoDe = (r: RotinaSemanal): RotinaCustom => ({
    origem: 'usuario',
    dias: r.dias.map((d) => ({ nome: d.nome, diaId: d.diaId!, exercicioIds: d.slots.map((s) => s.exercicio.id) })),
  });

  it('um desenho de sete dias entrega sete sessões — o teto do nível não apaga o desenho', () => {
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

  it('dia da agenda que o desenho não cobre é NOMEADO (antes virava recuperação em silêncio)', () => {
    const base = montar(comDias(['seg', 'ter', 'qui', 'sex']));
    const r = montar(comDias(TODOS, { rotinaCustom: desenhoDe(base) }));
    const frase = r.avisos.find((a) => DITO_DIAS.test(a));
    expect(frase, `o desenho cobre 4 de 7 e nada é dito: ${r.avisos.join(' | ')}`).toBeDefined();
    expect(frase).toContain('Quarta-feira');
    expect(frase).toContain('não reescreve o seu desenho');
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
   *  · TRAÇOS mecânicos (`tracosMecanicos`) — medido: a elevação lateral na polia `e53`
   *    (unilateral) entra no lugar da `e52` (bilateral) com os MESMOS alvos, porque o passe
   *    anatômico só aceita a troca quando o candidato traz traço novo (`trazTracoNovo`), e a
   *    polia traz. O alocador havia escolhido a bilateral; quem trocou foi a cobertura.
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
     * 🔵 RESÍDUO DECLARADO, com a causa medida — 4 células das 144 varridas.
     *
     * Nelas o ALOCADOR escolhe a bilateral `e52` Elevação lateral (traçado no `escolher`), e
     * quem a substitui depois é o PAR COMPENSADO do passe de cobertura anatômica
     * (`procurarCompensacao`, `cobertura-anatomica.ts`): para uma troca que abre cobertura de
     * ombro posterior, ele precisa de um segundo slot do mesmo grupo com crédito DIFERENTE, e
     * dentro da função `elevacao-lateral` as duas únicas alternativas à `e52` (`e53` na polia e
     * `e54` deitada) são unilaterais. Não existe par bilateral válido: manter a preferência ali
     * custaria a cobertura que o par foi buscar.
     *
     * 🔒 A lista é FECHADA de propósito: qualquer célula nova entra como falha, em vez de
     * engordar um resíduo em silêncio. Para fechá-la de vez o catálogo precisaria de uma
     * elevação lateral bilateral com outro perfil de crédito — decisão de catálogo, do autor.
     */
    const RESIDUO = [
      'academia/avancado/4d/45/v0: qui/e53 (havia e52)',
      'academia/avancado/4d/75/v0: qui/e53 (havia e52)',
      'academia/avancado/5d/45/v0: qui/e53 (havia e52)',
      'academia/avancado/5d/75/v0: qui/e53 (havia e52)',
    ];
    expect(fora.sort(), `${fora.length} slots unilaterais com bilateral disponível na mesma função`).toEqual(RESIDUO);
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
