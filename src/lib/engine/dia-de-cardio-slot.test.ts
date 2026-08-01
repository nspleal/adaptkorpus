import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina, type OpcoesSemana } from './treino-montador';
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
  return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, undefined, opc);
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
