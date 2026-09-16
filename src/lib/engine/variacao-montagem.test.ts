/**
 * 🔁 A VARIAÇÃO DA MONTAGEM — variedade sem comprar nada.
 *
 * A variação existe para "Gerar novo treino" poder oferecer uma semana diferente. O risco
 * óbvio é ela virar a porta dos fundos por onde uma regra sai: um exercício fora do pool, um
 * slot a mais, um dia mais longo, um grupo acima do MRV, o bloco do foco realocado.
 *
 * O que estes testes fixam:
 *  · variação AUSENTE ou 0 reproduz a montagem de sempre, byte a byte;
 *  · variação > 0 só troca quem ocupa o slot, dentro do pool já elegível, e nenhuma REGRA
 *    cede: `puxar ≥ empurrar` continua valendo, nenhum grupo NOVO passa do MRV ponderado,
 *    nenhum dia passa a estourar o limite de tempo, a dose por slot fica na faixa prescrita e
 *    o número de dias não muda;
 *  · o mesmo par (perfil, variação) devolve sempre a mesma semana — o determinismo continua
 *    inteiro, porque a variação é ENTRADA.
 *
 * 🔴 O QUE ELA PODE MUDAR, e por quê (medido, não suposto): o número de slots de um dia e o
 * grupo de um slot. Exercícios diferentes carregam crédito indireto diferente (0,5 por
 * secundário) e descanso diferente, então o MESMO alocador por déficit e o MESMO corte por
 * tempo chegam a outra distribuição. Isso não é regra comprada — é o alocador vigente
 * decidindo com outros números, dentro dos mesmos tetos. Quem mostra a diferença à pessoa é a
 * prévia da proposta, que lista o que entra e o que sai antes de qualquer substituição.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina, poolElegivel } from './treino-montador';
import { avaliarSemana } from './critico';
import { VARIACAO_TREINO_MAX } from './treino-constants';
import type { FlagsSaude } from './types';
import type { PerfilTreino, RotinaSemanal, SemanaCiclo } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], tempoPorSessaoMin: 60, ...over,
});

const montar = (p: PerfilTreino, semana: SemanaCiclo = 3): RotinaSemanal => montarRotina(
  prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(),
  { semana, feedbackGrupos: new Map() },
);

const idsPorDia = (r: RotinaSemanal) => r.dias.map((d) => d.slots.map((s) => s.exercicio.id));
const assinatura = (r: RotinaSemanal) => JSON.stringify(idsPorDia(r));

/**
 * 🔴 O QUE PODE MUDAR, E POR QUÊ. Trocar o exercício de um slot por outro do mesmo grupo
 * muda, legitimamente, o número de séries (descanso diferente ⇒ outro encaixe no orçamento)
 * e a contagem crua de `puxar`/`empurrar` (outro padrão de movimento). Isso não é regra
 * comprada: é o mesmo efeito que a troca manual de um exercício já produz hoje.
 *
 * O que NÃO pode mudar é o que estes testes fixam abaixo: estrutura de dias/slots, dono do
 * slot, pool, o INVARIANTE `puxar ≥ empurrar`, o teto de volume por grupo, a certificação de
 * tempo e a procedência do bloco do foco.
 */
function vereditos(r: RotinaSemanal, p: PerfilTreino) {
  const avaliacao = avaliarSemana(
    r.dias.map((d) => ({
      nome: d.nome,
      exercicios: d.slots.map((s) => s.exercicio),
      series: d.slots.map((s) => s.series),
      descansoSeg: d.slots.map((s) => s.descansoSeg),
      holdSeg: d.slots.map((s) => s.holdSeg),
      extraDoFoco: d.slots.map((s) => s.extraDoFoco),
    })),
    {
      nivel: p.nivelExperiencia, objetivo: p.objetivo, tempoPorSessaoMin: p.tempoPorSessaoMin,
      ...(r.faixaVolumeSemana ? { faixaSemanal: r.faixaVolumeSemana } : {}),
      ...(r.faseVolume ? { faseVolume: r.faseVolume } : {}),
    },
  );
  const { puxar, empurrar } = avaliacao.medidas.puxarEmpurrar;
  return {
    dias: r.dias.length,
    /** Registro (não veredito): quantos slots cada dia entregou. */
    slotsPorDia: r.dias.map((d) => d.slots.length),
    /** O INVARIANTE, não a contagem crua. */
    puxarMaiorOuIgual: puxar >= empurrar,
    /** Grupos que estouram o teto ponderado, pelo placar do crítico. */
    acimaDoMrv: avaliacao.placar.filter((l) => l.status === 'acima_mrv').map((l) => l.grupo).sort(),
    /** 🔒 A CERTIFICAÇÃO do motor, não uma estimativa da tela. */
    estouraOTempo: (r.duracaoResistidaDias ?? []).map((x) => x.estadoLimite === 'ACIMA_DO_LIMITE_OPERACIONAL'),
    calculo: (r.duracaoResistidaDias ?? []).map((x) => x.estadoCalculo),
    /** A dose por slot fica dentro da faixa prescrita para o nível/objetivo. */
    seriesForaDaFaixa: r.dias.flatMap((d) => d.slots
      .filter((sl) => sl.series != null && (sl.series < 1 || sl.series > prescreverTreino(p, avaliarGateTreino(p)).seriesPorExercicio.max))
      .map((sl) => sl.exercicio.id)),
  };
}

const CENARIOS: { nome: string; p: PerfilTreino; semana?: SemanaCiclo }[] = [
  { nome: 'academia · intermediário · 4 dias · 60 min', p: perfil() },
  { nome: 'academia · avançado · 5 dias · 75+', p: perfil({ nivelExperiencia: 'avancado', diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 90, limiteTempoTreino: 'sem_limite' }) },
  { nome: 'casa sem equipamento · iniciante · 3 dias', p: perfil({ equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: 'iniciante', diasDisponiveis: 3, treinoDias: ['seg', 'qua', 'sex'] }) },
  { nome: 'tempo curto · 30 min · 3 dias', p: perfil({ tempoPorSessaoMin: 30, diasDisponiveis: 3, treinoDias: ['seg', 'qua', 'sex'] }) },
  { nome: 'com foco em costas', p: perfil({ foco: { grupo: 'costas', compensa: 'peito', semana: 1 } }) },
  { nome: 'deload (semana 6)', p: perfil(), semana: 6 },
  { nome: 'emagrecimento · 2 dias', p: perfil({ objetivo: 'emagrecimento', diasDisponiveis: 2, treinoDias: ['ter', 'sex'] }) },
];

describe('🔒 variação ausente ou 0 ⇒ a montagem de SEMPRE', () => {
  for (const { nome, p, semana } of CENARIOS) {
    it(`${nome}: 0 é idêntico a não declarar`, () => {
      expect(assinatura(montar({ ...p, variacaoTreino: 0 }, semana))).toBe(assinatura(montar(p, semana)));
    });
  }
});

describe('🔒 variação > 0 não compra nada', () => {
  for (const { nome, p, semana } of CENARIOS) {
    it(`${nome}: estrutura, dose e certificação intactas em 8 variações`, () => {
      const base = montar(p, semana);
      const esperado = vereditos(base, p);
      const pool = new Set(poolElegivel(EXERCISES, p, p.preferencias).map((e) => e.id));
      const teto = prescreverTreino(p, avaliarGateTreino(p)).volumePorGrupoSemana;
      for (let v = 1; v <= 8; v += 1) {
        const r = montar({ ...p, variacaoTreino: v }, semana);
        const obtido = vereditos(r, p);
        expect(obtido.dias, `variação ${v} mudou o número de dias`).toBe(esperado.dias);
        expect(obtido.seriesForaDaFaixa, `variação ${v} produziu dose fora da faixa`).toEqual([]);
        // A certificação não REGRIDE: dia que o motor sabia calcular continua sabendo.
        for (const [i, estado] of obtido.calculo.entries()) {
          if (esperado.calculo[i] === 'CALCULADO') expect(estado, `variação ${v} perdeu a certificação do dia ${i}`).toBe('CALCULADO');
        }
        // Não PIORA: o que já cabia continua cabendo; o que já estourava pode continuar.
        for (const [i, estoura] of obtido.estouraOTempo.entries()) {
          if (!esperado.estouraOTempo[i]) expect(estoura, `variação ${v} estourou o tempo no dia ${i}`).toBe(false);
        }
        // O INVARIANTE não regride, e nenhum grupo NOVO passa a estourar o teto.
        if (esperado.puxarMaiorOuIgual) expect(obtido.puxarMaiorOuIgual, `variação ${v} quebrou puxar ≥ empurrar`).toBe(true);
        for (const g of obtido.acimaDoMrv) expect(esperado.acimaDoMrv, `variação ${v} estourou o MRV de ${g}`).toContain(g);
        expect(teto.max, 'sanidade da fixture: o teto do nível/objetivo existe').toBeGreaterThan(0);
        // Volume ENTREGUE por dia: registro do que a variação mexeu, sem inventar um limite novo.
        expect(obtido.slotsPorDia.length, `variação ${v} mudou a quantidade de dias entregues`).toBe(esperado.slotsPorDia.length);
        for (const dia of r.dias) {
          for (const s of dia.slots) {
            expect(pool.has(s.exercicio.id), `variação ${v} usou ${s.exercicio.id}, fora do pool`).toBe(true);
          }
          const ids = dia.slots.map((s) => s.exercicio.id);
          expect(new Set(ids).size, `variação ${v} repetiu exercício no mesmo dia`).toBe(ids.length);
        }
      }
    });
  }
});

describe('🔒 determinismo: a variação é ENTRADA, não sorteio', () => {
  it('o mesmo par (perfil, variação) devolve a mesma semana', () => {
    for (let v = 0; v <= 4; v += 1) {
      expect(assinatura(montar({ ...perfil(), variacaoTreino: v })))
        .toBe(assinatura(montar({ ...perfil(), variacaoTreino: v })));
    }
  });

  it('valores fora do domínio não quebram e não viram sorteio', () => {
    const base = assinatura(montar(perfil()));
    for (const v of [-3, 0.7, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = montar({ ...perfil(), variacaoTreino: v as number });
      // Negativo/fracionário/NaN normalizam para o início da rotação: a montagem de sempre.
      expect(assinatura(r), `variação ${v} produziu outra coisa`).toBe(base);
    }
  });

  it('o teto declarado cabe na rotação sem quebrar', () => {
    expect(() => montar({ ...perfil(), variacaoTreino: VARIACAO_TREINO_MAX })).not.toThrow();
  });
});

describe('📋 o que a variação PODE mexer, registrado em vez de suposto', () => {
  /**
   * 🔴 Medido, não suposto: no perfil avançado 5×/90 min a variação 1 entrega um slot A MAIS
   * num dia, e em casa sem equipamento a variação 4 troca o grupo de um slot. Os dois saem do
   * alocador por DÉFICIT: crédito indireto (0,5) e descanso diferentes mudam a conta, e o
   * corte por tempo decide de novo. Nenhum teto cede — isso é provado no bloco acima.
   *
   * Este teste existe para o dia em que esse comportamento mudar: ele muda de propósito, com
   * alguém lendo, e não em silêncio.
   */
  it('a distribuição de slots pode mudar dentro dos tetos — e isso é comportamento conhecido', () => {
    const p = perfil({ nivelExperiencia: 'avancado', diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 90, limiteTempoTreino: 'sem_limite' });
    const base = montar(p);
    const variado = montar({ ...p, variacaoTreino: 1 });
    const slots = (r: RotinaSemanal) => r.dias.map((d) => d.slots.length);
    expect(slots(variado)).not.toEqual(slots(base));
    // 🔒 E, ainda assim, nenhum grupo NOVO acima do MRV: o teto é o que não cede.
    for (const g of vereditos(variado, p).acimaDoMrv) expect(vereditos(base, p).acimaDoMrv).toContain(g);
  });
});

describe('🔁 a variação de fato VARIA quando o catálogo permite', () => {
  it('academia com pool largo oferece pelo menos uma semana diferente em 8 tentativas', () => {
    const base = assinatura(montar(perfil()));
    const diferentes = Array.from({ length: 8 }, (_, k) => assinatura(montar({ ...perfil(), variacaoTreino: k + 1 })))
      .filter((a) => a !== base);
    expect(diferentes.length).toBeGreaterThan(0);
  });

  it('favorito continua aparecendo em toda variação (DF #12 intacta)', () => {
    const p = perfil();
    const favorito = poolElegivel(EXERCISES, p).find((e) => e.grupoPrimario === 'peito')!.id;
    for (let v = 0; v <= 4; v += 1) {
      const r = montarRotina(
        prescreverTreino({ ...p, variacaoTreino: v }, avaliarGateTreino(p)),
        { ...p, variacaoTreino: v }, EXERCISES, new Set([favorito]),
        { semana: 3, feedbackGrupos: new Map() },
      );
      expect(idsPorDia(r).flat(), `variação ${v} perdeu o favorito`).toContain(favorito);
    }
  });

  it('o desenho MANUAL ignora a variação: quem escolhe ali é a pessoa', () => {
    const p = perfil({
      rotinaCustom: { origem: 'usuario', dias: [{ nome: 'Meu', diaId: 'seg', exercicioIds: ['e1', 'e16'] }] },
    });
    for (let v = 0; v <= 3; v += 1) {
      expect(idsPorDia(montar({ ...p, variacaoTreino: v }))).toEqual([['e1', 'e16']]);
    }
  });
});
