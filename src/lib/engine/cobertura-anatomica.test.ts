/**
 * 🦴 A COBERTURA ANATÔMICA NO MOTOR — e a prova de que ela não comprou nada.
 *
 * O autor pediu duas coisas que puxam em direções opostas: o seletor automático tem de
 * complementar os alvos diretos ainda não abordados, e **tempo, dose, descanso, recuperação,
 * tetos, foco, sequência de dias e o treino manual não podem piorar**. Este arquivo sustenta
 * as duas, e em nenhum lugar afrouxa a segunda para conseguir a primeira:
 *
 *  1. **a troca é conservativa por construção** — desfazendo as trocas relatadas, o plano
 *     volta ao que era, slot a slot, com a MESMA classe de intercâmbio (padrão, tipo, carga,
 *     isometria, lateralidade, secundários). Mesma classe ⇒ mesmo descanso, mesma execução,
 *     mesmo crédito ponderado, mesmo padrão contado;
 *  2. **a troca melhora de verdade** — toda troca relatada aumenta a cobertura do dia; troca
 *     de empate não existe, porque mexer no pool ordenado por popularidade sem ganhar alvo
 *     nenhum piora a escolha do usuário em troca de nada;
 *  3. **o desenho manual não muda** — o caminho `rotinaCustom` não passa pelo alocador, e o
 *     teste cobra os ids exatos que a pessoa escolheu;
 *  4. **não existe API de política** — nenhum peso de ativação ou hipertrofia, nenhuma quota
 *     regional, nenhum score de substituição. Se alguém acrescentar um, cai aqui;
 *  5. **falta de alvo vira diagnóstico**, com motivo, e nunca aviso de perigo ou bloqueio.
 */
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { alocarSemana, templatesDaSemana, type ArgsAlocacao, type DiaAlocado } from './alocador';
import { exercicioDisponivel } from './equipamento';
import { dificuldadesLiberadas } from './treino';
import { avaliarDuracaoResistida } from './duracao-plano';
import { EXERCISES } from '../data/exercises';
import { ALVOS_ANATOMICOS } from '../data/alvos-anatomicos';
import * as cobertura from './cobertura-anatomica';
import {
  GRUPOS_COM_ALVOS, abordadosNoDia, alvosDesejadosDoDia, classeDeIntercambio, diagnosticarDia,
  diretosDoExercicio, otimizarCoberturaAnatomica, type TrocaAnatomica,
} from './cobertura-anatomica';
import type { Exercise, GrupoPrimario } from '../data/types';
import type { FlagsSaude } from './types';
import type { PerfilTreino, RotinaCustom } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
  ...over,
});
const plano = (p: PerfilTreino) => montarRotina(
  prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana: 3, feedbackGrupos: new Map() },
);

/** Os cenários pedidos: peito/ombros, braços, pernas, full-body curto, foco e casa. */
const GRADE: Array<{ nome: string; over: Partial<PerfilTreino> }> = [
  { nome: 'prioridades 4d (peito+ombros / costas+bíceps / pernas / braços+core)', over: { divisaoPreferida: 'prioridades' } },
  { nome: 'automático 4d/60 min, intermediário', over: {} },
  { nome: 'automático 6d/75 min, avançado', over: { diasDisponiveis: 6, tempoPorSessaoMin: 75, nivelExperiencia: 'avancado' } },
  { nome: 'automático 5d/90 min, avançado', over: { diasDisponiveis: 5, tempoPorSessaoMin: 90, nivelExperiencia: 'avancado' } },
  { nome: 'sessão curta 3d/30 min', over: { diasDisponiveis: 3, tempoPorSessaoMin: 30 } },
  { nome: 'sessão muito curta 2d/20 min, iniciante', over: { diasDisponiveis: 2, tempoPorSessaoMin: 20, nivelExperiencia: 'iniciante' } },
  { nome: 'foco em ombros (compensa peito)', over: { foco: { grupo: 'ombros', compensa: 'peito', semana: 1 } } },
  { nome: 'foco em bíceps (compensa costas)', over: { foco: { grupo: 'biceps', compensa: 'costas', semana: 1 } } },
  { nome: 'casa com halteres e elástico', over: { equipamento: 'casa', equipamentosCasa: ['halteres', 'elastico'], diasDisponiveis: 3, tempoPorSessaoMin: 45 } },
  { nome: 'casa sem equipamento, iniciante', over: { equipamento: 'casa', equipamentosCasa: [], diasDisponiveis: 3, tempoPorSessaoMin: 40, nivelExperiencia: 'iniciante' } },
];

/** Monta os argumentos reais do alocador para um perfil — o mesmo caminho do montador. */
function argsDoPerfil(p: PerfilTreino, relato: TrocaAnatomica[]): ArgsAlocacao {
  const liberadas = new Set(dificuldadesLiberadas(p.nivelExperiencia));
  const pool = EXERCISES.filter((e) => exercicioDisponivel(e, p.equipamento, p.equipamentosCasa) && liberadas.has(e.nivel));
  const { dias: templates } = templatesDaSemana(p.diasDisponiveis, p.nivelExperiencia, p.divisaoPreferida ?? 'auto');
  const alvoPonderado = new Map<GrupoPrimario, number>(GRUPOS_COM_ALVOS.map((g) => [g, 16]));
  return {
    templates,
    budgetPorDia: p.tempoPorSessaoMin >= 75 ? 7 : 6,
    pool,
    favoritos: new Set<string>(),
    alvoPonderado,
    seriesPlanejamento: 4,
    tetoSlotsSemana: () => Number.POSITIVE_INFINITY,
    coreMin: 2,
    coreMax: 3,
    nivel: p.nivelExperiencia,
    relatoCoberturaAnatomica: relato,
  };
}

/** Desfaz as trocas relatadas — devolve o plano tal como o alocador o tinha antes do passe. */
function desfazer(dias: DiaAlocado[], trocas: readonly TrocaAnatomica[]): DiaAlocado[] {
  const copia = dias.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s })) }));
  for (const t of [...trocas].reverse()) {
    const slot = copia[t.dia]!.slots[t.slot]!;
    expect(slot.exercicio.id, `relato inconsistente em ${t.dia}/${t.slot}`).toBe(t.para);
    slot.exercicio = EXERCISES.find((e) => e.id === t.de)!;
  }
  return copia;
}

describe('① a troca é conservativa: o esqueleto do plano não se move', () => {
  it.each(GRADE)('$nome', ({ over }) => {
    const p = perfil(over);
    const relato: TrocaAnatomica[] = [];
    const dias = alocarSemana(argsDoPerfil(p, relato));
    const antes = desfazer(dias, relato);

    for (let d = 0; d < dias.length; d += 1) {
      const dep = dias[d]!.slots; const ant = antes[d]!.slots;
      expect(dep.length, `nº de slots do dia ${d}`).toBe(ant.length);
      for (let i = 0; i < dep.length; i += 1) {
        // Mesmo grupo, mesmo estado de favorito, MESMA classe de intercâmbio.
        expect(dep[i]!.grupo, `grupo ${d}/${i}`).toBe(ant[i]!.grupo);
        expect(dep[i]!.favorito, `favorito ${d}/${i}`).toBe(ant[i]!.favorito);
        expect(classeDeIntercambio(dep[i]!.exercicio, p.nivelExperiencia), `classe ${d}/${i}`)
          .toBe(classeDeIntercambio(ant[i]!.exercicio, p.nivelExperiencia));
      }
      // Nenhum exercício repetido no dia depois da troca.
      const ids = dep.map((s) => s.exercicio.id);
      expect(new Set(ids).size, `repetido no dia ${d}`).toBe(ids.length);
      // A contagem de padrões da semana — base de `puxar ≥ empurrar` — é a mesma.
      expect(dep.map((s) => s.exercicio.padraoMovimento).sort())
        .toEqual(ant.map((s) => s.exercicio.padraoMovimento).sort());
    }
  });
});

describe('② a troca melhora de verdade — e só por isso acontece', () => {
  it.each(GRADE)('$nome', ({ over }) => {
    const p = perfil(over);
    const relato: TrocaAnatomica[] = [];
    const dias = alocarSemana(argsDoPerfil(p, relato));
    const { dias: templates } = templatesDaSemana(p.diasDisponiveis, p.nivelExperiencia, p.divisaoPreferida ?? 'auto');
    const antes = desfazer(dias, relato);

    for (let d = 0; d < dias.length; d += 1) {
      const desejados = alvosDesejadosDoDia(templates[d]!.grupos);
      const cobDepois = abordadosNoDia(dias[d]!.slots.map((s) => s.exercicio.id), desejados);
      const cobAntes = abordadosNoDia(antes[d]!.slots.map((s) => s.exercicio.id), desejados);
      // Nunca perde cobertura...
      for (const a of cobAntes) expect(cobDepois.has(a), `perdeu ${a} no dia ${d}`).toBe(true);
      // ...e se houve troca neste dia, ganhou.
      if (relato.some((t) => t.dia === d)) expect(cobDepois.size, `dia ${d}`).toBeGreaterThan(cobAntes.size);
    }
    for (const t of relato) expect(t.alvosGanhos.length, `${t.de}→${t.para}`).toBeGreaterThan(0);
  });

  it('o passe é um ponto fixo: rodar de novo não troca mais nada', () => {
    for (const { over } of GRADE) {
      const p = perfil(over);
      const dias = alocarSemana(argsDoPerfil(p, []));
      const { dias: templates } = templatesDaSemana(p.diasDisponiveis, p.nivelExperiencia, p.divisaoPreferida ?? 'auto');
      const liberadas = new Set(dificuldadesLiberadas(p.nivelExperiencia));
      const porGrupo = (g: GrupoPrimario): Exercise[] => EXERCISES.filter((e) => e.grupoPrimario === g
        && e.padraoMovimento !== 'cardio' && exercicioDisponivel(e, p.equipamento, p.equipamentosCasa) && liberadas.has(e.nivel));
      const denovo = otimizarCoberturaAnatomica(
        dias.map((dia, d) => ({ grupos: templates[d]!.grupos, slots: dia.slots })),
        (g, favorito) => (favorito ? [] : porGrupo(g)),
        p.nivelExperiencia,
      );
      expect(denovo, JSON.stringify(over)).toEqual([]);
    }
  });
});

describe('③ tempo, dose e recuperação não pioram', () => {
  it.each(GRADE)('$nome — duração certificada e dentro do limite', ({ over }) => {
    const p = perfil(over);
    const r = plano(p);
    expect(r.duracaoDias).toBeDefined();
    expect(r.duracaoDias!.length).toBe(r.dias.length);
    for (const d of r.duracaoDias!) {
      expect(d.estadoCalculo, JSON.stringify(over)).toBe('CALCULADO');
      expect(d.estadoLimite, JSON.stringify(over)).toBe('DENTRO_DO_LIMITE');
    }
  });

  it.each(GRADE)('$nome — o dia avaliado pelo alocador antes e depois ocupa o mesmo tempo', ({ over }) => {
    const p = perfil(over);
    const relato: TrocaAnatomica[] = [];
    const dias = alocarSemana(argsDoPerfil(p, relato));
    const antes = desfazer(dias, relato);
    // Mesma prescrição de séries/descanso nos dois (4×120 é arbitrário e igual dos dois lados):
    // o que muda de um lado para o outro é SÓ a identidade do exercício, e a fórmula canônica
    // tem de devolver o mesmo número.
    const comoItens = (ds: DiaAlocado[], i: number) => ds[i]!.slots.map((s) => ({ exercicio: s.exercicio, series: 4, descansoSeg: 120 }));
    for (let i = 0; i < dias.length; i += 1) {
      const a = avaliarDuracaoResistida(comoItens(antes, i), p.nivelExperiencia, p.tempoPorSessaoMin * 60);
      const b = avaliarDuracaoResistida(comoItens(dias, i), p.nivelExperiencia, p.tempoPorSessaoMin * 60);
      expect(b.duracaoMinimaEstimadaSegundos, `dia ${i} min`).toBe(a.duracaoMinimaEstimadaSegundos);
      expect(b.duracaoMaximaEstimadaSegundos, `dia ${i} max`).toBe(a.duracaoMaximaEstimadaSegundos);
      expect(b.estadoCalculo, `dia ${i}`).toBe(a.estadoCalculo);
    }
  });

  it('o mesmo perfil dá o mesmo plano — nada de relógio, rede ou aleatório', () => {
    for (const { over } of GRADE) {
      const um = plano(perfil(over)).dias.map((d) => d.slots.map((s) => [s.exercicio.id, s.series, s.descansoSeg]));
      const dois = plano(perfil(over)).dias.map((d) => d.slots.map((s) => [s.exercicio.id, s.series, s.descansoSeg]));
      expect(dois, JSON.stringify(over)).toEqual(um);
    }
  });
});

describe('④ o treino manual não muda', () => {
  const DESENHO: RotinaCustom = {
    origem: 'usuario',
    dias: [
      // Peito só com empurrar/adução e um puxar — o passe anatômico adoraria diversificar aqui.
      { nome: 'Meu dia A', exercicioIds: ['e9', 'e10', 'e11', 'e15', 'e22'] },
      { nome: 'Meu dia B', exercicioIds: ['e16', 'e17', 'e57'] },
    ],
  };

  it('🔴 os ids são exatamente os da pessoa, na ordem dela', () => {
    const r = plano(perfil({ rotinaCustom: DESENHO }));
    expect(r.dias.map((d) => d.nome)).toEqual(['Meu dia A', 'Meu dia B']);
    expect(r.dias.map((d) => d.slots.map((s) => s.exercicio.id)))
      .toEqual([['e9', 'e10', 'e11', 'e15', 'e22'], ['e16', 'e17', 'e57']]);
  });

  it('nem mesmo um dia com deltoide posterior descoberto é "corrigido"', () => {
    const r = plano(perfil({ rotinaCustom: DESENHO }));
    const desejados = alvosDesejadosDoDia(['peito', 'costas']);
    const cobertos = abordadosNoDia(r.dias[0]!.slots.map((s) => s.exercicio.id), desejados);
    // O dia manual segue sem `dp` — e o motor não trocou nada para consegui-lo.
    expect(cobertos.has('dp')).toBe(false);
    expect(r.dias[0]!.slots.map((s) => s.exercicio.id)).toEqual(['e9', 'e10', 'e11', 'e15', 'e22']);
  });
});

describe('⑤ integrar informação não criou política de treino', () => {
  it('o módulo não exporta peso, quota, score, equivalência nem prescrição', () => {
    const proibidos = /peso|quota|score|equivalen|ativacao|ativação|hipertrofia|prescr|substitu|frequencia|frequência/i;
    expect(Object.keys(cobertura).filter((k) => proibidos.test(k))).toEqual([]);
  });

  it('o único número do módulo é contagem de presença', () => {
    const desejados = alvosDesejadosDoDia(['ombros']);
    expect(cobertura.complementoAnatomico('e41', desejados, new Set())).toBe(2); // da + dl
    expect(cobertura.complementoAnatomico('e41', desejados, new Set(['da', 'dl']))).toBe(0);
    // 🔴 2 não é "o dobro do estímulo": é "dois alvos ainda não abordados".
    expect(Number.isInteger(cobertura.complementoAnatomico('e41', desejados, new Set()))).toBe(true);
  });

  it('nenhum grupo novo nasce dos alvos: adutores, flexores do quadril e perna anterior ficam fora', () => {
    const todos = new Set(GRUPOS_COM_ALVOS.flatMap((g) => [...alvosDesejadosDoDia([g])]));
    for (const fora of ['ad', 'hf', 'it']) expect(todos.has(fora), fora).toBe(false);
    expect(new Set(GRUPOS_COM_ALVOS)).toEqual(new Set(
      EXERCISES.map((e) => e.grupoPrimario).filter((g): g is GrupoPrimario => g != null),
    ));
    // e os alvos desses grupos existem — só não são obrigação de dia.
    expect(ALVOS_ANATOMICOS.ad!.grupo).toBe('adutores');
    expect(ALVOS_ANATOMICOS.hf!.grupo).toBe('flexores_quadril');
  });

  it('cardio não entra em slot de força, então não entra na cobertura', () => {
    for (const { over } of GRADE) {
      for (const d of plano(perfil(over)).dias) {
        for (const s of d.slots) expect(s.exercicio.padraoMovimento, s.exercicio.id).not.toBe('cardio');
      }
    }
  });
});

describe('⑥ falta de alvo vira diagnóstico — nunca perigo nem bloqueio', () => {
  it('diz O QUE não foi identificado e POR QUÊ, sem propor exercício novo', () => {
    const p = perfil({ equipamento: 'casa', equipamentosCasa: [], diasDisponiveis: 3, tempoPorSessaoMin: 40, nivelExperiencia: 'iniciante' });
    const liberadas = new Set(dificuldadesLiberadas(p.nivelExperiencia));
    const elegiveis = EXERCISES.filter((e) => exercicioDisponivel(e, p.equipamento, p.equipamentosCasa) && liberadas.has(e.nivel)).map((e) => e.id);
    const r = plano(p);
    const diag = diagnosticarDia({
      nome: r.dias[0]!.nome,
      grupos: [...new Set(r.dias[0]!.slots.map((s) => s.exercicio.grupoPrimario).filter((g): g is GrupoPrimario => g != null))],
      idsEscolhidos: r.dias[0]!.slots.map((s) => s.exercicio.id),
      idsElegiveis: elegiveis,
      slotsDisponiveis: r.dias[0]!.slots.length,
    });
    expect(diag.naoIdentificados.length).toBeGreaterThan(0);
    for (const n of diag.naoIdentificados) {
      expect(n.nome).toBe(ALVOS_ANATOMICOS[n.alvo]!.nome);
      expect(['sem_candidato_no_catalogo', 'sem_candidato_elegivel', 'condicao_de_execucao_nao_declarada', 'slots_do_dia_esgotados'])
        .toContain(n.motivo);
    }
    expect(diag.ressalva).toMatch(/Não é veredito de segurança ou bloqueio/);
    // Nada no diagnóstico propõe id fora do que já era elegível.
    for (const n of diag.naoIdentificados) for (const id of n.candidatosElegiveis) expect(elegiveis).toContain(id);
  });

  it('alvo sem candidato no catálogo é dito como tal, e não vira condição inventada', () => {
    const diag = diagnosticarDia({
      nome: 'Lombar', grupos: ['lombar'], idsEscolhidos: ['e103'],
      idsElegiveis: EXERCISES.map((e) => e.id), slotsDisponiveis: 1,
    });
    const mu = diag.naoIdentificados.find((n) => n.alvo === 'mu')!;
    expect(mu.motivo).toBe('sem_candidato_no_catalogo');
    expect(mu.candidatosElegiveis).toEqual([]);
    expect(mu.condicoesQueResolveriam).toEqual([]);
  });

  it('condição de execução não declarada é dita com a condição que a resolveria', () => {
    const diag = diagnosticarDia({
      nome: 'Punho', grupos: ['antebraco'], idsEscolhidos: ['e139'],
      idsElegiveis: ['e139'], slotsDisponiveis: 1,
    });
    const wf = diag.naoIdentificados.find((n) => n.alvo === 'wf')!;
    expect(wf.motivo).toBe('condicao_de_execucao_nao_declarada');
    expect(wf.condicoesQueResolveriam).toContainEqual({ acaoPunho: 'flexao' });
  });

  it('participação auxiliar aparece separada, e não fecha cobertura', () => {
    const diag = diagnosticarDia({
      nome: 'Peito', grupos: ['peito', 'triceps'], idsEscolhidos: ['e9'],
      idsElegiveis: ['e9'], slotsDisponiveis: 1,
    });
    expect(diag.abordados).toEqual(['pc', 'pe']);
    expect(diag.participacaoAuxiliar).toEqual(['tl', 'tm', 'tt']);
    expect(diag.naoIdentificados.map((n) => n.alvo)).toEqual(['tl', 'tm', 'tt']);
  });

  it('nenhum aviso novo entrou no plano por causa da cobertura anatômica', () => {
    // 🔴 O plano JÁ tem avisos de volume ("alvo de 18 séries para costas…") e eles continuam
    // como eram. O que não pode existir é aviso DESTA camada: o diagnóstico anatômico é
    // consultado sob demanda, e falta de alvo nunca vira alerta na rotina.
    const nomesDeAlvo = Object.values(ALVOS_ANATOMICOS).map((a) => a.nome);
    for (const { over } of GRADE) {
      for (const aviso of plano(perfil(over)).avisos) {
        expect(aviso, JSON.stringify(over)).not.toMatch(/cobertura anatômica|não identificad|inferência anatômica/i);
        for (const nome of nomesDeAlvo) expect(aviso, `${nome} em "${aviso}"`).not.toContain(nome);
      }
    }
  });
});

describe('⑦ inferência não é medição, nem no dado nem na conta', () => {
  it('condicional pendente não conta como cobertura em nenhum dia gerado', () => {
    // e104 é o único id do pool de força sem alvo direto incondicional.
    expect([...diretosDoExercicio('e104')]).toEqual([]);
    const diag = diagnosticarDia({
      nome: 'Lombar', grupos: ['lombar'], idsEscolhidos: ['e104'],
      idsElegiveis: ['e104'], slotsDisponiveis: 1,
    });
    expect(diag.abordados).toEqual([]);
    expect(diag.naoIdentificados.find((n) => n.alvo === 'er')!.motivo).toBe('condicao_de_execucao_nao_declarada');
  });
});
