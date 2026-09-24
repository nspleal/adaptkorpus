/**
 * 🔴 OS RESÍDUOS DA PR #21 (revisão de 2026-09-24; DEC-007 e DEC-008 candidatas) — o cardio é
 * independente da musculação, e a correção só fecha sem contradição conhecida nas interações:
 *
 *  (1) o editor contava o dia complementar do automático como sessão excedente;
 *  (2) o cartão de cardio, sem dia escolhido, culpava a musculação ("Seus N dias estão ocupados");
 *  (3) o dia planejado sem exercício elegível: o crítico o esperava no dia errado, e a semana de
 *      deload o perdia sem declarar;
 *  (4) a faixa "Sua semana" chamava esse dia de recuperação;
 *  (5) na retomada, o plano prescrevia o cardio cheio enquanto o cartão dizia que a meta caiu.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { gerarTreino } from './index';
import { avaliarRotinaAutomaticaFinal } from './critico';
import { metaCardioComRetomada, metaCardioSemanal } from './cardio';
import { EXERCISES } from '../data/exercises';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import { CardioSemana } from '@/components/painel/Cardio';
import SuaSemana from '@/components/painel/SuaSemana';
import { montarSemana, ORDEM_SEMANA, type Weekday } from '../semana';
import type { PerfilTreino, RotinaCustom, RotinaSemanal } from './treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const SEIS: Weekday[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const perfil = (o: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 178, idade: 32, flagsSaude: SEM, objetivo: 'saude', nivelExperiencia: 'intermediario',
  equipamento: 'academia', equipamentosCasa: [], diasDisponiveis: 6, treinoDias: SEIS,
  tempoPorSessaoMin: 45, limiteTempoTreino: 'limitado', ...o,
} as PerfilTreino);
type Semana = 1 | 3 | 6;
const opcoes = (oferta: readonly Weekday[], semana: Semana) =>
  ({ exercises: EXERCISES, semanaCiclo: { semana }, diasOferecidosCardio: oferta });
const gerar = (p: PerfilTreino, oferta: readonly Weekday[] = [], semana: Semana = 1) => gerarTreino(p, opcoes(oferta, semana)).rotina!;
const copiar = (p: PerfilTreino, r: RotinaSemanal): RotinaCustom =>
  JSON.parse(JSON.stringify(paraRotinaCustom(doPlano(r.dias, p.treinoDias ?? [], undefined, undefined))));
const excede = (r: RotinaSemanal) => r.avisos.filter((a) => /excede/.test(a));
const convergencia = (p: PerfilTreino, r: RotinaSemanal, oferta: readonly Weekday[] = [], semana: Semana = 1) =>
  avaliarRotinaAutomaticaFinal(r, {
    semana, nivel: p.nivelExperiencia, objetivo: p.objetivo, tempoPorSessaoMin: p.tempoPorSessaoMin,
    limiteTempoTreino: p.limiteTempoTreino, diasNoHorizonteEsperado: 7, diasOferecidosCardioEsperados: oferta,
    diasTreinoEsperados: p.treinoDias ?? [], seriesPadrao: 2, diasDaSemanaIdx: r.dias.map((d) => ORDEM_SEMANA.indexOf(d.diaId!)),
  }).convergenciaPlanoFinal!;
const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('(1) editor: o dia complementar do automático não é sessão excedente', () => {
  const p = perfil();
  const r = gerar(p);

  it('copiar intermediário/6 dias, salvar, recarregar e recalcular: 5 dias, sem aviso de excesso, desenho intacto', () => {
    expect(r.dias.map((d) => d.nome)).toHaveLength(5);
    expect(r.dias[4]!.nome).toBe('Complementares');
    const salvo = copiar(p, r);
    for (const [semana, oferta] of [[1, []], [3, ['sex']], [6, ['sex', 'sab']]] as [Semana, Weekday[]][]) {
      const m = gerarTreino({ ...p, rotinaCustom: salvo }, opcoes(oferta, semana)).rotina!;
      expect(m.dias.map((d) => [d.diaId, d.nome, d.slots.map((s) => s.exercicio.id)]), `S${semana}`)
        .toEqual(r.dias.map((d) => [d.diaId, d.nome, d.slots.map((s) => s.exercicio.id)]));
      expect(excede(m), `S${semana} ${oferta}`).toEqual([]);
    }
  });

  it('alterar o dia complementar para ter grupo principal: agora excede, com a conta certa, e o desenho fica', () => {
    const salvo = copiar(p, r);
    salvo.dias[4]!.exercicioIds.push(r.dias[0]!.slots[0]!.exercicio.id);
    const m = gerarTreino({ ...p, rotinaCustom: salvo }, opcoes([], 1)).rotina!;
    expect(m.dias).toHaveLength(5);
    expect(excede(m)).toEqual(['Seu treino tem 5 dias, 5 com grupos principais, e o seu nível comporta até 4 sessões principais por semana, mais um dia só de complementares — 1 dia excede a recomendação atual. Seu desenho foi preservado.']);
  });

  it('um segundo dia só de complementares também excede', () => {
    const salvo = copiar(p, r);
    salvo.dias.push({ nome: 'Extra', diaId: 'sab', exercicioIds: [...salvo.dias[4]!.exercicioIds] });
    const m = gerarTreino({ ...p, rotinaCustom: salvo }, opcoes([], 1)).rotina!;
    expect(m.dias).toHaveLength(6);
    expect(excede(m)).toEqual(['Seu treino tem 6 dias, 4 com grupos principais, e o seu nível comporta até 4 sessões principais por semana, mais um dia só de complementares — 1 dia excede a recomendação atual. Seu desenho foi preservado.']);
  });

  it('quando a agenda é menor que o teto do nível, a frase não atribui o limite ao nível', () => {
    const quatro = perfil({ diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qua', 'qui'] });
    const salvo = copiar(quatro, gerar(quatro));
    const tres = perfil({ diasDisponiveis: 3, treinoDias: ['seg', 'ter', 'qua'], rotinaCustom: salvo });
    const m = gerarTreino(tres, opcoes([], 1)).rotina!;
    expect(m.dias).toHaveLength(4);
    expect(excede(m)).toEqual(['Seu treino tem 4 dias, 4 com grupos principais, e a recomendação é de até 3 sessões, uma por dia de treino escolhido — 1 dia excede a recomendação atual. Seu desenho foi preservado.']);
  });
});

describe('(2) cartão de cardio: sem dia escolhido, não culpa a musculação nem cobra minutos', () => {
  /** O cartão como o Painel o monta (`propsCardio`). */
  const cartao = (p: PerfilTreino, r: RotinaSemanal) => texto(renderToStaticMarkup(React.createElement(CardioSemana, {
    registros: [], meta: metaCardioSemanal(p.objetivo, false), retomada: null, hojeISO: '2026-09-21', acumuladoMin: 0,
    objetivo: p.objetivo, onRegistrar: () => {},
    prescritoMin: r.cardioSemana ? Math.round(r.cardioSemana.prescritoSegundos / 60) || undefined : undefined,
  })));

  it.each([1, 2, 3, 4, 5, 6, 7])('%i dia(s) de treino, nenhum dia oferecido', (d) => {
    const p = perfil({ diasDisponiveis: d, treinoDias: ORDEM_SEMANA.slice(0, d) });
    const c = cartao(p, gerar(p));
    expect(c).toContain('Nenhum dia está escolhido para a sugestão automática de cardio nesta semana.');
    expect(c).toContain('registre aqui embaixo');
    expect(c).not.toMatch(/ocupad|treino de força|min no seu plano|Falta/);
  });

  it.each([[['sex'], 90], [['dom'], 90], [['sex', 'dom'], 150]] as [Weekday[], number][])(
    'oferta %j (dia misto, dia só de cardio): mede contra os %i min prescritos', (oferta, minutos) => {
      const p = perfil();
      const r = gerar(p, oferta);
      const c = cartao(p, r);
      expect(c).toContain(`de ${minutos} min no seu plano`);
      expect(c).not.toMatch(/Nenhum dia está escolhido/);
    });

  it('massa (meta em sessões): continua contando sessões, sem minutos inventados, com ou sem dia escolhido', () => {
    const p = perfil({ objetivo: 'massa' });
    for (const oferta of [[], ['sex'], ['dom']] as Weekday[][]) {
      const c = cartao(p, gerar(p, oferta));
      expect(c, `${oferta}`).toMatch(/sessões/);
      expect(c, `${oferta}`).not.toMatch(/min no seu plano|Nenhum dia está escolhido/);
    }
  });
});

describe('(3) dia planejado sem exercício elegível: declarado no dia certo, e o crítico continua independente', () => {
  // O caso mínimo da grade: casa sem equipamento, a quinta ("Ombros + complementares") não tem exercício.
  const p = perfil({ equipamento: 'casa', equipamentosCasa: [], diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 30 });

  it.each([1, 3, 6] as Semana[])('S%i: a quinta é declarada não atendida, a sexta segue sendo a sessão dela, e gerador e crítico convergem', (semana) => {
    for (const oferta of [[], ['qui'], ['sex']] as Weekday[][]) {
      const r = gerar(p, oferta, semana);
      expect(r.diasNaoAtendidos, `S${semana} ${oferta}`).toEqual([{ nome: 'Ombros + complementares', diaId: 'qui', motivo: 'EQUIPAMENTO', slotsPedidos: 4 }]);
      expect(r.dias.map((d) => d.diaId)).toEqual(['seg', 'ter', 'qua', 'sex']);
      expect(r.dias.length + r.diasNaoAtendidos!.length + r.diasCardioRecuperacao).toBe(5);
      expect(r.planoFinalPorDia!.find((d) => d.diaId === 'qui')!.treinoIdx).toBeUndefined();
      const c = convergencia(p, r, oferta, semana);
      expect(c.estado, `S${semana} ${oferta}: ${c.motivosEstruturais.join(' | ')}`).toBe('CONVERGIU');
    }
  });

  it('a mensagem nomeia o motivo e não inventa exercício', () => {
    const r = gerar(p, [], 6);
    expect(r.avisos).toContain('Seu equipamento disponível limita este dia: Ombros + complementares. Com o que você marcou no perfil, não há exercício novo para acrescentar sem repetir o que já está lá.');
    expect(r.dias.find((d) => d.nome === 'Ombros + complementares')).toBeUndefined();
  });

  describe('e o crítico acusa as contradições reais', () => {
    const r = gerar(p);
    const acusa = (t: RotinaSemanal, motivo: RegExp) => {
      const c = convergencia(p, t);
      expect(c.estado).toBe('DIVERGIU');
      expect(c.motivosEstruturais.join(' | ')).toMatch(motivo);
    };
    it('dia planejado que some sem declaração', () => {
      const t = structuredClone(r); delete t.diasNaoAtendidos;
      acusa(t, /sessões divergem do calendário planejado/);
    });
    it('dia não atendido transformado em recuperação', () => {
      const t = structuredClone(r); delete t.diasNaoAtendidos; t.diasCardioRecuperacao += 1;
      acusa(t, /dias de recuperação divergentes/);
    });
    it('dia não atendido declarado fora do calendário planejado', () => {
      const t = structuredClone(r); t.diasNaoAtendidos![0]!.diaId = 'dom';
      acusa(t, /dia não atendido fora do calendário planejado: dom/);
    });
    /**
     * O crítico antigo conferia só as N primeiras datas da agenda para N sessões entregues: um dia
     * complementar sumido e contado como recuperação passava. Os campos derivados ficam coerentes,
     * para a acusação vir só do calendário.
     */
    it('dia complementar sumido e contado como recuperação', () => {
      const q = perfil();
      const t = structuredClone(gerar(q));
      const k = t.dias.length - 1;
      const diaId = t.dias[k]!.diaId!;
      t.dias.splice(k, 1); t.duracaoDias!.splice(k, 1); t.duracaoResistidaDias!.splice(k, 1);
      t.diasForcaAgendados -= 1; t.diasCardioRecuperacao += 1;
      const f = t.planoFinalPorDia!.find((d) => d.diaId === diaId)!;
      delete f.treinoIdx; f.tipo = 'VAZIO';
      f.duracao = structuredClone(t.planoFinalPorDia!.find((d) => d.diaId === 'dom')!.duracao);
      const c = convergencia(q, t);
      expect(c.estado).toBe('DIVERGIU');
      expect(c.motivosEstruturais.join(' | ')).toMatch(/sessões divergem do calendário planejado: 5 planejadas, 0 não atendidas, 4 entregues/);
    });
  });
});

describe('(5) retomada: o cardio do plano cai pelo fator da rampa, como o cartão diz', () => {
  const p = perfil();
  const retomada = { semana: 1, fator: 0.5, volumeReferencia: 12 };
  const naRampa = (oferta: Weekday[]) => gerarTreino(p, { exercises: EXERCISES, diasOferecidosCardio: oferta,
    semanaCiclo: { semana: 3, retomada } } as never).rotina!;

  it('150 min × 0,5 = 75 na semana, repartidos nos dias oferecidos (arredondados a 5), sem mexer na musculação', () => {
    const r = naRampa(['sex', 'sab']);
    expect(r.diasCardio.map((c) => [c.diaId, c.minutos])).toEqual([['sex', 40], ['sab', 40]]);
    expect(r.cardioSemana).toEqual({ prescritoSegundos: 4800 });
    expect(naRampa([]).dias).toEqual(r.dias);
    expect(gerar(p, ['sex', 'sab']).diasCardio.map((c) => c.minutos)).toEqual([75, 75]);
  });

  it('o cartão mede contra o que a rampa prescreveu e diz por quê', () => {
    const r = naRampa(['sex', 'sab']);
    const c = texto(renderToStaticMarkup(React.createElement(CardioSemana, {
      registros: [], meta: metaCardioComRetomada(metaCardioSemanal(p.objetivo, false), retomada.fator), retomada: { semana: 1, totalSemanas: 4 },
      hojeISO: '2026-09-21', acumuladoMin: 0, objetivo: p.objetivo, onRegistrar: () => {},
      prescritoMin: Math.round(r.cardioSemana!.prescritoSegundos / 60),
    })));
    expect(c).toContain('de 80 min no seu plano');
    expect(c).toContain('Sua meta está menor porque você está voltando');
  });

  it('o crítico reconstrói com o fator externo e acusa quem o ignora', () => {
    const r = naRampa(['sex', 'sab']);
    const ctx = {
      semana: 3 as const, nivel: p.nivelExperiencia, objetivo: p.objetivo, tempoPorSessaoMin: p.tempoPorSessaoMin,
      limiteTempoTreino: p.limiteTempoTreino, diasNoHorizonteEsperado: 7, diasOferecidosCardioEsperados: ['sex', 'sab'] as Weekday[],
      diasTreinoEsperados: SEIS, seriesPadrao: 2, diasDaSemanaIdx: r.dias.map((d) => ORDEM_SEMANA.indexOf(d.diaId!)),
    };
    const com = avaliarRotinaAutomaticaFinal(r, { ...ctx, fatorRetomadaEsperado: retomada.fator }).convergenciaPlanoFinal!;
    expect(com.estado, com.motivosEstruturais.join(' | ')).toBe('CONVERGIU');
    const sem = avaliarRotinaAutomaticaFinal(r, ctx).convergenciaPlanoFinal!;
    expect(sem.estado).toBe('DIVERGIU');
    expect(sem.motivosEstruturais.join(' | ')).toMatch(/fatos publicados divergem da reconstrução independente/);
  });
});

describe('(4) faixa "Sua semana": o dia não atendido não vira recuperação', () => {
  const p = perfil({ equipamento: 'casa', equipamentosCasa: [], diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 30 });

  it('sem oferta: a quinta é "sem sessão", com o nome do dia planejado', () => {
    const r = gerar(p);
    const semana = montarSemana(p.treinoDias!, r.dias.map((d) => d.nome), 0, r.diasCardio, r.dias.map((d) => d.diaId), r.diasNaoAtendidos);
    expect(semana[3]).toMatchObject({ weekday: 'qui', tipo: 'sem_sessao', sessionLabel: 'Ombros + complementares', isTraining: false });
    expect(semana.filter((d) => d.tipo === 'treino').map((d) => d.weekday)).toEqual(['seg', 'ter', 'qua', 'sex']);
    expect(semana.some((d) => d.tipo === 'recuperacao')).toBe(false);
    const html = texto(renderToStaticMarkup(React.createElement(SuaSemana, {
      treinoDias: [...p.treinoDias!], sessoesNomes: r.dias.map((d) => d.nome), sessoesDias: r.dias.map((d) => d.diaId),
      diasCardio: r.diasCardio, naoAtendidos: r.diasNaoAtendidos ?? [], onIrSessao: () => {}, onVerDieta: () => {}, onEditarPerfil: () => {},
    })));
    expect(html).toMatch(/Qui Sem sessão/);
    expect(html).not.toMatch(/Recuperação/);
  });

  it('com cardio oferecido nesse dia, o dia mostra o cardio: ele é independente da musculação', () => {
    const r = gerar(p, ['qui']);
    const semana = montarSemana(p.treinoDias!, r.dias.map((d) => d.nome), 0, r.diasCardio, r.dias.map((d) => d.diaId), r.diasNaoAtendidos);
    expect(semana[3]).toMatchObject({ weekday: 'qui', tipo: 'cardio' });
    expect(r.planoFinalPorDia!.find((d) => d.diaId === 'qui')!.tipo).toBe('CARDIO');
  });
});
