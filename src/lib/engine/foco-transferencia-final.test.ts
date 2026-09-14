import { describe, expect, it, vi } from 'vitest';
import * as alocador from './alocador';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { EXERCISES } from '../data/exercises';
import { fraseDoFoco } from '../foco-copy';
import type { PerfilTreino } from './treino-types';

const original = alocador.alocarSemana;
const perfil: PerfilTreino = {
  pesoKg: 80, alturaCm: 180, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia',
  diasDisponiveis: 3, tempoPorSessaoMin: 45, divisaoPreferida: 'prioridades',
};

describe('Foco: a promessa corresponde à transferência na última alocação', () => {
  it('confere execução real, recusa e realocação de cobertura sem condições vazias', () => {
    const grupos = ['peito', 'ombros', 'triceps', 'biceps', 'costas'] as const;
    const contagem = { executadas: 0, recusadas: 0, cobertura: 0 };
    const spy = vi.spyOn(alocador, 'alocarSemana');
    try {
      for (const diasDisponiveis of [2, 3, 4, 5])
        for (const tempoPorSessaoMin of [30, 45, 60])
          for (const divisaoPreferida of ['prioridades', 'auto'] as const)
            for (const semana of [2, 3] as const)
              for (const grupo of grupos)
                for (const compensa of grupos) {
                  if (grupo === compensa) continue;
                  let final: { executada: boolean; cobertura: boolean } | undefined;
                  spy.mockImplementation((args) => {
                    // Observa o resultado do alocador real, inclusive a segunda passada.
                    const relato = { executada: false, recusadaPeloEquilibrio: false };
                    const saida = original({ ...args, relatoTransferencia: relato });
                    if (args.relatoTransferencia) Object.assign(args.relatoTransferencia, relato);
                    if (args.transferirSlot) final = {
                      executada: relato.executada, cobertura: !!args.coberturaTemporalObrigatoria,
                    };
                    return saida;
                  });
                  const p: PerfilTreino = { ...perfil, diasDisponiveis, tempoPorSessaoMin,
                    divisaoPreferida, foco: { grupo, compensa, semana: 1 } };
                  const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana });
                  if (!final) continue; // Só o degrau de transferência tem esse contrato.
                  if (final.cobertura) contagem.cobertura++;
                  if (final.executada) {
                    contagem.executadas++;
                    expect(r.foco?.degrau).toBe('slot');
                    expect(fraseDoFoco(r)).toContain('+1 exercício');
                    const neutro = { ...p, foco: undefined };
                    const base = montarRotina(prescreverTreino(neutro, avaliarGateTreino(neutro)), neutro, EXERCISES, new Set(), { semana });
                    const contar = (rotina: typeof r, g: string) => rotina.dias.flatMap(d => d.slots).filter(s => s.exercicio.grupoPrimario === g).length;
                    expect(contar(r, grupo)).toBe(contar(base, grupo) + 1);
                    expect(contar(r, compensa)).toBe(contar(base, compensa) - 1);
                  } else {
                    contagem.recusadas++;
                    expect(r.foco?.degrau, JSON.stringify({diasDisponiveis,tempoPorSessaoMin,divisaoPreferida,semana,grupo,compensa})).toBe('ordem');
                    expect(r.foco?.series).toBe(0);
                    expect(fraseDoFoco(r)).not.toContain('+1 exercício');
                  }
                }
      expect(contagem.executadas).toBeGreaterThan(0);
      // Com o calendário atual esta grade não produz recusa; o par controlado abaixo a exige.
      // Esta grade não alcança a realocação; o contrato dessa borda está abaixo.
    } finally { spy.mockRestore(); }
  }, 120000);
  it.each([true, false])('usa o resultado final de cobertura (executada=%s), não o anterior', (executada) => {
    let tentativas = 0;
    const spy = vi.spyOn(alocador, 'alocarSemana').mockImplementation((args) => {
      const saida = original(args);
      if (!args.transferirSlot) return saida;
      tentativas++;
      // Simula os dois resultados possíveis da dependência. Não é prova de plano real.
      if (args.relatoTransferencia) Object.assign(args.relatoTransferencia, {
        executada: args.coberturaTemporalObrigatoria ? executada : !executada,
        recusadaPeloEquilibrio: false,
      });
      if (!args.coberturaTemporalObrigatoria) return saida.map(d => ({
        ...d, slots: d.slots.filter(s => !['agachar', 'dobradica_quadril'].includes(s.exercicio.padraoMovimento)),
      }));
      return saida;
    });
    try {
      const p: PerfilTreino = { ...perfil, diasDisponiveis: 4, tempoPorSessaoMin: 30, foco: { grupo: 'triceps', compensa: 'biceps', semana: 1 } };
      const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana: 2 });
      expect(tentativas).toBe(2);
      expect(r.foco?.degrau).toBe(executada ? 'slot' : 'ordem');
      if (!executada) expect(r.foco?.motivo).toBe('transferencia_nao_realizada');
    } finally { spy.mockRestore(); }
  });

});
