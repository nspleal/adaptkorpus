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
 *
 * Lote de 2026-09-24 sobre a main pública `a3ad985`:
 *  (6) o fator da retomada tinha duas contas (tela e motor/crítico); agora é uma;
 *  (7) o detalhe do dia só de cardio perguntava pelos dias EXCEDENTES da força: sem excedente,
 *      o dia que o plano prescrevia virava "Recuperação ativa", sem o botão de registrar;
 *  (8) em agenda não contígua, a faixa lia `ordemNoHorizonte` (posição na semana) como posição
 *      entre os dias de treino e copiava o cardio de um dia para outro.
 *
 * Fechamento de 2026-09-24 (decisões de Nicolas), sem a regra do "dia excedente = dia de cardio":
 *  (9) massa com a meta semanal de sessões batida: a faixa e a lista da aba Cardio deixam de sugerir
 *      cardio em todos os dias;
 *  (10) fator de retomada 0: o cartão diz que a meta é zero, não que nenhum dia foi escolhido;
 *  (11) emagrecimento na retomada: referência normal (150–300) × meta desta semana;
 *  (12) o cardio só nasce dos dias oferecidos, também na falha do alocador e na agenda vazia;
 *  (13) desenho salvo sem `diaId`: sem cardio duplicado ou deslocado.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { gerarTreino } from './index';
import { avaliarRotinaAutomaticaFinal } from './critico';
import { metaCardioComRetomada, metaCardioSemanal, metaCumprida, resumoCardioSemana } from './cardio';
import type { RegistroCardioDatado } from '../cardio-semana';
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

describe('(6) retomada: uma só fórmula aplica o fator ao cardio (cartão, montador e crítico)', () => {
  it('o motor não exporta uma segunda conta do fator', async () => {
    expect('metaCardioDaRetomada' in (await import('./index'))).toBe(false);
  });

  /** Minutos por dia da regra (150 × fator, ÷ dias, a 5 min, teto 90), por nº de dias oferecidos. */
  const POR_DIA: Record<number, [number, number, number]> = {
    0: [0, 0, 0], 0.5: [75, 40, 25], 0.7: [90, 55, 35], 0.8: [90, 60, 40], 0.9: [90, 70, 45], 1: [90, 75, 50],
  };
  const OFERTAS: Weekday[][] = [['dom'], ['sex', 'sab'], ['ter', 'qui', 'sab']];
  const naRampa = (p: PerfilTreino, oferta: Weekday[], fator: number) => gerarTreino(p, { exercises: EXERCISES,
    diasOferecidosCardio: oferta, semanaCiclo: { semana: 1, retomada: { semana: 1, fator, volumeReferencia: 12 } } } as never).rotina!;

  for (const objetivo of ['saude', 'emagrecimento'] as const) {
    it(`${objetivo}: plano, cartão e crítico concordam nos fatores 0 a 1, sem mexer na musculação`, () => {
      const p = perfil({ objetivo });
      for (const [fator, esperados] of Object.entries(POR_DIA)) for (const [i, oferta] of OFERTAS.entries()) {
        const f = Number(fator);
        const porDia = esperados[i]!;
        const r = naRampa(p, oferta, f);
        const k = `fator ${f} oferta ${oferta}`;
        expect(r.diasCardio.map((c) => [c.diaId, c.minutos]), k).toEqual(porDia > 0 ? oferta.map((d) => [d, porDia]) : []);
        expect(r.cardioSemana?.prescritoSegundos, k).toBe(porDia > 0 ? porDia * oferta.length * 60 : undefined);
        expect(r.dias, k).toEqual(naRampa(p, [], f).dias);
        const meta = metaCardioComRetomada(metaCardioSemanal(objetivo, false), f)!;
        expect(meta.alvo, k).toBe(Math.round(150 * f));
        const c = texto(renderToStaticMarkup(React.createElement(CardioSemana, {
          registros: [], meta, retomada: null, hojeISO: '2026-09-21', acumuladoMin: 0, objetivo, onRegistrar: () => {},
          prescritoMin: r.cardioSemana ? Math.round(r.cardioSemana.prescritoSegundos / 60) : undefined,
        })));
        if (porDia > 0) expect(c, k).toContain(`de ${porDia * oferta.length} min no seu plano`);
        else expect(c, k).not.toMatch(/min no seu plano/);
        const conv = avaliarRotinaAutomaticaFinal(r, {
          semana: 1, nivel: p.nivelExperiencia, objetivo, tempoPorSessaoMin: p.tempoPorSessaoMin,
          limiteTempoTreino: p.limiteTempoTreino, diasNoHorizonteEsperado: 7, diasOferecidosCardioEsperados: oferta,
          diasTreinoEsperados: SEIS, seriesPadrao: 2, diasDaSemanaIdx: r.dias.map((d) => ORDEM_SEMANA.indexOf(d.diaId!)),
          fatorRetomadaEsperado: f,
        }).convergenciaPlanoFinal!;
        expect(conv.estado, `${k}: ${conv.motivosEstruturais.join(' | ')}`).toBe('CONVERGIU');
      }
    });
  }

  it('massa: a meta segue em sessões (1 na rampa, 1 a 2 fora dela) e nenhum dia ganha minutos', () => {
    const p = perfil({ objetivo: 'massa' });
    for (const f of [0, 0.5, 0.9, 1]) {
      const r = naRampa(p, ['sex', 'sab'], f);
      expect(r.diasCardio.map((c) => [c.diaId, c.minutos]), `fator ${f}`).toEqual([['sex', null], ['sab', null]]);
      expect(r.cardioSemana, `fator ${f}`).toBeUndefined();
      const c = texto(renderToStaticMarkup(React.createElement(CardioSemana, {
        registros: [], meta: metaCardioComRetomada(metaCardioSemanal('massa', false), f), retomada: null,
        hojeISO: '2026-09-21', acumuladoMin: 0, objetivo: 'massa', onRegistrar: () => {},
      })));
      expect(c, `fator ${f}`).toContain(f < 1 ? 'de 1 sessão' : 'de 1 a 2 sessões');
      expect(c, `fator ${f}`).not.toMatch(/min no seu plano/);
    }
  });

  it('gate ROTEAR: sem plano e sem meta, com ou sem rampa', () => {
    const p = perfil({ pesoKg: 5 });
    expect(gerarTreino(p, { exercises: EXERCISES, diasOferecidosCardio: ['dom'] } as never)).toMatchObject({ rotina: null, prescricao: null });
    expect(metaCardioComRetomada(metaCardioSemanal('saude', true), 0.5)).toBeNull();
  });
});

/** Registros de cardio moderado da semana (contam na meta), para ligar a faixa como o Painel. */
const registros = (n: number): RegistroCardioDatado[] => Array.from({ length: n }, (_, i) => ({
  modalidade: 'caminhada' as const, intensidade: 'moderado' as const, minutos: 30, met: 4.3, kcal: 120,
  dataISO: `2026-09-2${1 + i}`,
}));

/** A faixa no dia `dia` (células e detalhe), com `cardioEncerrado` ligado como o Painel liga. */
function faixaNoDia(p: PerfilTreino, r: RotinaSemanal, dia: Weekday, fator: number | null = null, sessoesFeitas = 0) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 21 + ORDEM_SEMANA.indexOf(dia), 12)); // seg 21/09/2026
  try {
    const meta = metaCardioComRetomada(metaCardioSemanal(p.objetivo, false), fator);
    const cardioEncerrado = meta?.tipo === 'sessoes' && metaCumprida(meta, resumoCardioSemana(registros(sessoesFeitas)));
    const props = {
      treinoDias: [...p.treinoDias!], sessoesNomes: r.dias.map((d) => d.nome), sessoesDias: r.dias.map((d) => d.diaId),
      cardioEncerrado, diasCardio: r.diasCardio, naoAtendidos: r.diasNaoAtendidos ?? [],
      onIrSessao: () => {}, onVerDieta: () => {}, onEditarPerfil: () => {}, onRegistrarCardio: () => {},
    };
    const t = texto(renderToStaticMarkup(React.createElement(SuaSemana, props)));
    return { detalhe: t.slice(t.indexOf('Hoje ·'), t.indexOf('A semana segue')), celulas: t.slice(t.indexOf('Seg — Dom'), t.indexOf('Hoje ·')) };
  } finally { vi.useRealTimers(); }
}
const detalheDaFaixa = (...a: Parameters<typeof faixaNoDia>) => faixaNoDia(...a).detalhe;

describe('(7) faixa: o dia só de cardio do plano é cardio também no detalhe', () => {
  it('o Painel não pergunta mais por dia excedente: passa à faixa só se a meta de sessões foi batida', () => {
    const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');
    expect(painel).not.toMatch(/conteudoDoDiaExcedente|diaExcedente/);
    expect(painel).toMatch(/const cardioEncerrado = metaCardio\?\.tipo === 'sessoes' && metaCumprida\(metaCardio, resumoCardioSemana\(registrosCardioSemana\)\)/);
    expect(painel).toMatch(/cardioEncerrado=\{cardioEncerrado\}/);
  });

  const cinco = perfil({ diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'] });

  it('saúde, seg–sex sem dia vago, oferta no domingo: o detalhe é o cardio de 90 min, com registrar', () => {
    const r = gerar(cinco, ['dom']);
    expect(r.diasCardioRecuperacao).toBe(0);
    const d = detalheDaFaixa(cinco, r, 'dom');
    expect(d).toMatch(/^Hoje · Cardio Caminhada · 90 min/);
    expect(d).toContain('Registrar cardio');
    expect(d).not.toMatch(/Recuperação/);
  });

  it('na retomada, o detalhe mostra os minutos da rampa', () => {
    const r = gerarTreino(cinco, { exercises: EXERCISES, diasOferecidosCardio: ['dom'],
      semanaCiclo: { semana: 1, retomada: { semana: 1, fator: 0.5, volumeReferencia: 12 } } } as never).rotina!;
    expect(detalheDaFaixa(cinco, r, 'dom', 0.5)).toMatch(/^Hoje · Cardio Caminhada · 75 min/);
  });

  it('o detalhe usa a modalidade que o plano emitiu (cardio favorito), a mesma do registro', () => {
    const bike = perfil({ ...cinco, cardioFavorito: 'bike' });
    const r = gerar(bike, ['dom']);
    expect(r.diasCardio.map((c) => c.modalidade)).toEqual(['bike']);
    expect(detalheDaFaixa(bike, r, 'dom')).toMatch(/^Hoje · Cardio Bike · 90 min/);
  });

  it('sem oferta, o dia de recuperação não cobra cardio', () => {
    const p = perfil({ nivelExperiencia: 'iniciante' });
    const r = gerar(p);
    expect(r.diasCardioRecuperacao).toBeGreaterThan(0);
    const d = detalheDaFaixa(p, r, 'sab');
    expect(d).toMatch(/^Hoje · Recuperação Recuperação ativa/);
    expect(d).not.toMatch(/Registrar cardio|Dia ativo de cardio/);
  });

  it('força não atendida por equipamento: com cardio no dia a faixa mostra só o cardio; o motivo segue declarado para a aba Treino', () => {
    const casa = perfil({ equipamento: 'casa', equipamentosCasa: [], diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 30 });
    const sem = gerar(casa);
    const com = gerar(casa, ['qui']);
    for (const r of [sem, com]) expect(r.diasNaoAtendidos).toEqual([expect.objectContaining({ diaId: 'qui', motivo: 'EQUIPAMENTO' })]);
    expect(com.dias).toEqual(sem.dias);
    expect(detalheDaFaixa(casa, sem, 'qui')).toMatch(/^Hoje · Sem sessão/);
    const d = detalheDaFaixa(casa, com, 'qui');
    expect(d).toMatch(/^Hoje · Cardio Caminhada · 90 min/);
    expect(d).not.toMatch(/Sem sessão|Recuperação/);
  });
});

describe('(8) faixa: em agenda não contígua o cardio fica no dia oferecido', () => {
  for (const [agenda, oferta] of [[['ter', 'qui', 'sab'], ['ter']], [['seg', 'qua', 'sex'], ['qua']], [['seg', 'qua', 'sex', 'dom'], ['qua', 'dom']]] as [Weekday[], Weekday[]][]) {
    it(`agenda ${agenda.join('/')}, oferta ${oferta.join('/')}: só esses dias têm cardio`, () => {
      const p = perfil({ nivelExperiencia: 'iniciante', diasDisponiveis: agenda.length, treinoDias: agenda });
      const r = gerar(p, oferta);
      expect(r.diasCardio.map((c) => c.diaId)).toEqual(oferta);
      const semana = montarSemana(agenda, r.dias.map((d) => d.nome), 0, r.diasCardio, r.dias.map((d) => d.diaId), r.diasNaoAtendidos);
      expect(semana.filter((d) => d.cardio != null).map((d) => d.weekday)).toEqual(oferta);
      expect(semana.filter((d) => d.tipo === 'treino').map((d) => d.weekday)).toEqual(r.dias.map((d) => d.diaId));
    });
  }
});

describe('(9) massa: batida a meta semanal de sessões, a semana deixa de sugerir cardio em todos os dias', () => {
  const massa = perfil({ objetivo: 'massa', diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'] });
  const r = gerar(massa, ['sex', 'dom']);

  it('antes da meta: dia misto com cardio depois da musculação e domingo só de cardio', () => {
    expect(r.planoFinalPorDia!.filter((d) => d.cardio).map((d) => [d.diaId, d.tipo])).toEqual([['sex', 'TREINO_E_CARDIO'], ['dom', 'CARDIO']]);
    expect(faixaNoDia(massa, r, 'sex', null, 0).detalhe).toMatch(/Depois do treino: cardio · Caminhada\./);
    expect(faixaNoDia(massa, r, 'dom', null, 0).detalhe).toMatch(/^Hoje · Cardio Caminhada Dia ativo/);
  });

  it('meta batida: o dia misto fica só com a musculação e o domingo é recuperação; a musculação não muda', () => {
    const sex = faixaNoDia(massa, r, 'sex', null, 1);
    expect(sex.detalhe).toMatch(/^Hoje · Treino Complementares/);
    expect(sex.detalhe).not.toMatch(/cardio/i);
    const dom = faixaNoDia(massa, r, 'dom', null, 1);
    expect(dom.detalhe).toMatch(/^Hoje · Recuperação Recuperação ativa/);
    expect(dom.detalhe).not.toMatch(/Registrar cardio|Dia ativo de cardio/);
    expect(dom.celulas).not.toMatch(/Cardio/);
    expect(dom.celulas).toMatch(/Sex Complementares .*Dom Recuperação/);
    // As sessões de força são as mesmas nos dois estados da faixa.
    expect(faixaNoDia(massa, r, 'seg', null, 1).celulas.replace(/Recuperação|Cardio|Descanso/g, ''))
      .toBe(faixaNoDia(massa, r, 'seg', null, 0).celulas.replace(/Recuperação|Cardio|Descanso/g, ''));
  });

  it('o dia vago oferecido vira recuperação e o dia de força não atendido volta a "Sem sessão"', () => {
    const seis = perfil({ objetivo: 'massa', nivelExperiencia: 'iniciante' });
    const r6 = gerar(seis, ['sab']);
    expect(faixaNoDia(seis, r6, 'sab', null, 0).detalhe).toMatch(/^Hoje · Cardio/);
    expect(faixaNoDia(seis, r6, 'sab', null, 1).detalhe).toMatch(/^Hoje · Recuperação/);
    const casa = perfil({ objetivo: 'massa', equipamento: 'casa', equipamentosCasa: [], diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 30 });
    const rc = gerar(casa, ['qui']);
    expect(faixaNoDia(casa, rc, 'qui', null, 0).detalhe).toMatch(/^Hoje · Cardio/);
    expect(faixaNoDia(casa, rc, 'qui', null, 1).detalhe).toMatch(/^Hoje · Sem sessão/);
  });

  it('na retomada a meta é 1 sessão, e com ela batida a faixa também para de sugerir', () => {
    expect(faixaNoDia(massa, r, 'dom', 0.5, 1).detalhe).toMatch(/^Hoje · Recuperação/);
  });

  it('a regra é da meta em sessões: em minutos, a meta cumprida não tira o cardio do plano', () => {
    const saude = perfil({ diasDisponiveis: 5, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'] });
    expect(faixaNoDia(saude, gerar(saude, ['dom']), 'dom', null, 9).detalhe).toMatch(/^Hoje · Cardio Caminhada · 90 min/);
  });

  it('o cartão diz que a meta foi cumprida e mantém os registros', () => {
    const c = texto(renderToStaticMarkup(React.createElement(CardioSemana, {
      registros: registros(1), meta: metaCardioSemanal('massa', false), retomada: null, hojeISO: '2026-09-24',
      acumuladoMin: 30, objetivo: 'massa', onRegistrar: () => {},
    })));
    expect(c).toContain('Meta da semana cumprida');
    expect(c).toMatch(/Caminhada · 30 min/);
  });

  it('a lista "Ver sugestão automática" da aba Cardio segue a mesma regra, e só ela troca', () => {
    const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');
    const inicio = painel.indexOf('<summary>Ver sugestão automática</summary>');
    const lista = painel.slice(inicio, painel.indexOf('</details>', inicio));
    // Meta batida: a mensagem no lugar dos itens; os itens e seus "Registrar cardio" só no outro ramo.
    expect(lista).toMatch(/\{cardioEncerrado\s*\?\s*<p [^>]*>Meta da semana cumprida<\/p>\s*:\s*<div [^]*treino\.rotina\?\.diasCardio[^]*>Registrar cardio<\/button>/);
    // A escolha de dias continua, e o botão geral de registro mora fora da lista (no cartão).
    expect(lista.indexOf('<OfertaCardio')).toBeGreaterThan(0);
    expect(lista.indexOf('<OfertaCardio')).toBeLessThan(lista.indexOf('cardioEncerrado'));
    expect(painel.slice(painel.indexOf('</details>', inicio))).toMatch(/^<\/details>\s*<\/>\}\s*<CardioSemana \{\.\.\.propsCardio\} \/>/);
    const c = texto(renderToStaticMarkup(React.createElement(CardioSemana, {
      registros: registros(1), meta: metaCardioSemanal('massa', false), retomada: null, hojeISO: '2026-09-24',
      acumuladoMin: 30, objetivo: 'massa', onRegistrar: () => {},
    })));
    expect(c).toContain('Registrar cardio');
  });
});

describe('(10) fator de retomada 0: dias escolhidos, zero minutos, e o cartão diz por quê', () => {
  const p = perfil();
  const r = gerarTreino(p, { exercises: EXERCISES, diasOferecidosCardio: ['sex', 'dom'],
    semanaCiclo: { semana: 1, retomada: { semana: 1, fator: 0, volumeReferencia: 12 } } } as never).rotina!;
  const meta = metaCardioComRetomada(metaCardioSemanal('saude', false), 0)!;

  it('o plano não prescreve minutos, e nenhum dia vira cardio', () => {
    expect(r.diasCardio).toEqual([]);
    expect(r.cardioSemana).toBeUndefined();
    expect(meta.alvo).toBe(0);
  });

  it('o cartão diz que a meta é zero — não que nenhum dia foi escolhido — e não a chama de cumprida', () => {
    const c = texto(renderToStaticMarkup(React.createElement(CardioSemana, {
      registros: [], meta, retomada: { semana: 1, totalSemanas: 2 }, hojeISO: '2026-09-24', acumuladoMin: 0,
      objetivo: 'saude', onRegistrar: () => {},
    })));
    expect(c).toContain('Nesta semana a meta de cardio é zero, então o plano não prescreve minutos de cardio.');
    expect(c).not.toMatch(/Nenhum dia está escolhido|min no seu plano|cumprida/);
    expect(c).toContain('Registrar cardio');
  });

  it('sem retomada, a frase de sem dia escolhido continua a mesma', () => {
    const c = texto(renderToStaticMarkup(React.createElement(CardioSemana, {
      registros: [], meta: metaCardioSemanal('saude', false), retomada: null, hojeISO: '2026-09-24', acumuladoMin: 0,
      objetivo: 'saude', onRegistrar: () => {},
    })));
    expect(c).toContain('Nenhum dia está escolhido para a sugestão automática de cardio nesta semana.');
  });
});

describe('(11) emagrecimento na retomada: a referência normal e a meta desta semana ficam distintas', () => {
  const cartao = (fator: number | null, prescritoMin: number) => texto(renderToStaticMarkup(React.createElement(CardioSemana, {
    registros: [], meta: metaCardioComRetomada(metaCardioSemanal('emagrecimento', false), fator),
    retomada: fator != null ? { semana: 1, totalSemanas: 2 } : null, hojeISO: '2026-09-24', acumuladoMin: 0,
    objetivo: 'emagrecimento', onRegistrar: () => {}, prescritoMin,
  })));

  it('na rampa: "Meta desta semana · 75–150 min", "normal 150–300 min" e a faixa desta semana', () => {
    const c = cartao(0.5, 80);
    expect(c).toContain('Meta desta semana · 75–150 min');
    expect(c).toContain('Emagrecimento · normal 150–300 min');
    expect(c).toContain('150 (faixa desta semana)');
    expect(c).not.toContain('faixa recomendada');
    expect(c).toContain('de 80 min no seu plano');
  });

  it('fora da rampa, nada muda', () => {
    const c = cartao(null, 150);
    expect(c).toContain('Meta da semana');
    expect(c).toContain('Emagrecimento · 150–300 min');
    expect(c).toContain('300 (faixa recomendada)');
    expect(c).not.toMatch(/normal|desta semana/);
  });
});

describe('(12) o cardio só nasce dos dias oferecidos, inclusive na falha do alocador e na agenda vazia', () => {
  // Catálogo real com um campo adulterado (os `puxar` viram `empurrar`): o alocador perde a
  // cobertura obrigatória e devolve ERRO_ALOCADOR — o mesmo gatilho de c1-caminho-publico.
  const semPuxar = EXERCISES.map((e) => (e.padraoMovimento === 'puxar' ? { ...e, padraoMovimento: 'empurrar' as const } : e));
  const p = perfil({ nivelExperiencia: 'iniciante' });
  const comErro = (oferta: Weekday[]) => gerarTreino(p, { exercises: semPuxar, semanaCiclo: { semana: 1 }, diasOferecidosCardio: oferta } as never).rotina!;

  it('o caso é mesmo o caminho de erro, com dia vago na agenda', () => {
    const r = comErro([]);
    expect(r.resultadoGeracao?.tipo).toBe('ERRO_ALOCADOR');
    expect(r.diasCardioRecuperacao, 'sem dia vago o caso não discrimina').toBeGreaterThan(0);
    expect(r.planoFinalPorDia).toBeUndefined();
  });

  it('sem oferta, o dia vago não ganha cardio', () => {
    expect(comErro([]).diasCardio).toEqual([]);
  });

  it('com oferta, o cardio é o dos dias oferecidos, pela fórmula de sempre', () => {
    const r = comErro(['dom']);
    expect(r.diasCardio.map((c) => [c.diaId, c.minutos])).toEqual([['dom', 90]]);
    expect(r.cardioSemana).toEqual({ prescritoSegundos: 5400 });
  });

  /**
   * O gatilho REAL do mesmo caminho: favoritar só exercícios de peito (e1, e2, e9, e10) derruba
   * hoje a força deste perfil em ERRO_ALOCADOR ("puxar < empurrar") — falha da musculação,
   * registrada à parte. O cardio não depende dela: sai dos dias oferecidos.
   */
  it('com favoritos que derrubam a força, o cardio continua nos dias oferecidos', () => {
    const q = perfil({ diasDisponiveis: 3, treinoDias: ['seg', 'ter', 'qua'] });
    for (const [oferta, min] of [[['sex'], 90], [['sex', 'sab'], 75]] as [Weekday[], number][]) {
      const r = gerarTreino(q, { exercises: EXERCISES, favoritos: new Set(['e1', 'e2', 'e9', 'e10']), semanaCiclo: { semana: 1 }, diasOferecidosCardio: oferta } as never).rotina!;
      expect(r.diasCardio.map((c) => [c.diaId, c.minutos]), `oferta ${oferta}`).toEqual(oferta.map((d) => [d, min]));
    }
  });

  it('agenda vazia (as bordas exigem ≥ 1 dia): nenhum cardio nasce de dia vago', () => {
    const r = gerarTreino(perfil({ diasDisponiveis: 0, treinoDias: [] }), { exercises: EXERCISES, semanaCiclo: { semana: 1 }, diasOferecidosCardio: ['dom'] } as never).rotina;
    expect(r?.dias ?? []).toEqual([]);
    expect(r?.diasCardio ?? []).toEqual([]);
  });
});

describe('(13) desenho salvo sem `diaId` (legado): o cardio não duplica nem muda de dia', () => {
  const p = perfil({ nivelExperiencia: 'iniciante', diasDisponiveis: 3, treinoDias: ['ter', 'qui', 'sab'] });
  const auto = gerar(p);
  const atual = copiar(p, auto);
  const legado: RotinaCustom = { ...atual, dias: atual.dias.map(({ diaId: _diaId, ...d }) => d) };

  it('o desenho legado monta os mesmos dias de força, e o cardio fica só nos dias oferecidos', () => {
    const a = gerarTreino({ ...p, rotinaCustom: atual }, opcoes(['ter', 'dom'], 1)).rotina!;
    const l = gerarTreino({ ...p, rotinaCustom: legado }, opcoes(['ter', 'dom'], 1)).rotina!;
    expect(l.dias.map((d) => [d.diaId, d.slots.map((s) => s.exercicio.id)])).toEqual(a.dias.map((d) => [d.diaId, d.slots.map((s) => s.exercicio.id)]));
    expect(l.diasCardio.map((c) => c.diaId)).toEqual(['ter', 'dom']);
    const semana = montarSemana(p.treinoDias!, l.dias.map((d) => d.nome), 0, l.diasCardio, l.dias.map((d) => d.diaId), l.diasNaoAtendidos);
    expect(semana.filter((d) => d.cardio != null).map((d) => d.weekday)).toEqual(['ter', 'dom']);
  });

  it('item de cardio sem dia nem ordem não ocupa dia vago na faixa', () => {
    const semana = montarSemana(['seg', 'ter', 'qua', 'qui'], ['A', 'B'], 0, [{ modalidade: 'caminhada', minutos: 30 }]);
    expect(semana.filter((d) => d.cardio != null || d.tipo === 'cardio')).toEqual([]);
    expect(semana.filter((d) => d.tipo === 'recuperacao').map((d) => d.weekday)).toEqual(['qua', 'qui']);
  });
});
