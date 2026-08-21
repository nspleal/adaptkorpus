/**
 * 🔒 C1 §8.3 — REGRESSÃO MEDIDA dos cinco casos, pelo GERADOR REAL. Além de imprimir a tabela
 * (orçamento · slots inicial/final · séries/descansos finais · duração canônica · degradação ·
 * gerador × crítico · motivo estruturado), ASSEGURA a convergência gerador↔crítico em todos eles.
 */
import { describe, expect, it } from 'vitest';
import { gerarTreino } from './index';
import { orcamentoSlotsDoDia } from './alocador';
import { avaliarDuracaoResistida } from './duracao-plano';
import { descansoDoExercicio } from './descanso';
import { rirAlvoDaSemana } from './treino-mesociclo';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino, SemanaCiclo } from './treino-types';
import type { FlagsSaude } from './types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

interface Caso { nome: string; objetivo: string; nivel: string; dias: number; tempo: number; semana: SemanaCiclo }
const CASOS: Caso[] = [
  { nome: 'A · sessão curta (30 min)', objetivo: 'emagrecimento', nivel: 'intermediario', dias: 4, tempo: 30, semana: 1 },
  { nome: 'B · força pesada (60 min)', objetivo: 'massa', nivel: 'avancado', dias: 4, tempo: 60, semana: 1 },
  { nome: 'C · sessão longa (90 min)', objetivo: 'massa', nivel: 'intermediario', dias: 5, tempo: 90, semana: 1 },
  { nome: 'D · tempo impossível (10 min)', objetivo: 'massa', nivel: 'intermediario', dias: 4, tempo: 10, semana: 1 },
  { nome: 'E · deload sem séries (semana 6)', objetivo: 'massa', nivel: 'intermediario', dias: 4, tempo: 60, semana: 6 },
];

describe('C1 §8.3 · regressão medida dos cinco casos (gerador real)', () => {
  const linhas: string[] = [];

  it.each(CASOS)('$nome — gerador e crítico convergem e a linha da tabela é registrada', (c) => {
    const perfil = {
      pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: c.objetivo,
      nivelExperiencia: c.nivel, equipamento: 'academia', diasDisponiveis: c.dias, tempoPorSessaoMin: c.tempo,
    } as unknown as PerfilTreino;

    const presc = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const r = gerarTreino(perfil, { exercises: EXERCISES, semanaCiclo: { semana: c.semana } });
    const rot = r.rotina!;
    const orcamentoSeg = c.tempo * 60;
    const slotsInicial = orcamentoSlotsDoDia(c.tempo);
    const rg = rot.resultadoGeracao!;

    // nível de degradação observado: descanso final < descanso sem degradar.
    const rir = presc.rirAlvoSemana ?? rirAlvoDaSemana(presc.rir, c.semana);
    const degradou = rot.dias.some((d) => d.slots.some((s) => {
      const n0 = descansoDoExercicio({ exercicio: s.exercicio, rirAlvo: rir, modoForca: presc.modoForca === true, semanaRampa: null, degradacao: 0 });
      return n0 != null && s.descansoSeg != null && s.descansoSeg < n0;
    }));

    // 🔒 CONVERGÊNCIA: o crítico avalia o MESMO plano final pela MESMA função.
    const doCritico = rot.dias.map((d) => avaliarDuracaoResistida(d.slots, perfil.nivelExperiencia, orcamentoSeg));
    expect(doCritico).toEqual(rot.duracaoDias);

    const d0 = rot.dias[0];
    const dur0 = rot.duracaoDias?.[0];
    const motivo = rg.tipo === 'NAO_AVALIADO_ENTREGAVEL' ? rg.motivos[0] ?? '—'
      : rg.tipo === 'INCOMPATIVEL' ? `menor plano com cobertura (cap ${rg.capacidadeMinimaTestada}) ainda excede B+480`
        : rg.tipo === 'ERRO_ALOCADOR' ? rg.violacoesInvariantes.join('; ')
          : '—';

    linhas.push([
      c.nome,
      `${orcamentoSeg}s (${c.tempo}min)`,
      `${slotsInicial} → ${rot.dias.map((d) => d.slots.length).join('/')}`,
      d0 ? d0.slots.map((s) => `${s.series ?? '—'}×${s.descansoSeg ?? '—'}s`).join(' ') : '—',
      dur0?.estadoCalculo === 'CALCULADO' ? `${dur0.duracaoMinimaEstimadaSegundos}–${dur0.duracaoMaximaEstimadaSegundos}s` : 'NAO_AVALIADO',
      degradou ? 'sim' : 'não',
      rg.tipo,
      dur0?.estadoLimite ?? '—',
      motivo,
    ].join(' | '));

    // invariantes universais da regressão
    expect(rot.duracaoDias).toBeDefined();
    expect(rot.duracaoIncompativel ?? false).toBe(rg.tipo === 'INCOMPATIVEL');
  });

  it('imprime a tabela §8.3', () => {
    console.log('\n=== §8.3 · CINCO CASOS MEDIDOS (SHA do run) ===');
    console.log('caso | orçamento | slots inicial→final | séries×descanso (dia 1) | duração canônica (dia 1) | degradou | gerador | crítico (estado limite) | motivo estruturado');
    for (const l of linhas) console.log(l);
    expect(linhas.length).toBe(CASOS.length);
  });
});
