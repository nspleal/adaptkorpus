/**
 * REGRESSÃO D12 — auditoria 2026-09-11, snapshot a40f8af36cca9ce6b86919ed8869dff7e6a0a050.
 *
 * CONTRATO (fonte: src/lib/engine/treino-types.ts, doc de `ResultadoGeracaoRotina`):
 *   "CERTIFICADO: todo dia cabe em B+480 (musculação) após a adaptação".
 *
 * ORÁCULO INDEPENDENTE (não copia a implementação): o PRÓPRIO motor já classifica
 * `LIMITE_INDETERMINADO` como "não cabe" no ramo automático — `precisaReduzir`
 * (src/lib/engine/treino-montador.ts:127-133) trata `ACIMA_DO_LIMITE_OPERACIONAL` **e**
 * `LIMITE_INDETERMINADO` como motivo para reduzir o plano. O ramo MANUAL não passa por
 * `precisaReduzir`, e o guard de D3 em `finalizar` (treino-montador.ts:1068) só rebaixa
 * `CERTIFICADO` quando o dia é `ACIMA_DO_LIMITE_OPERACIONAL`. Resultado: o mesmo estado
 * significa "reduza" num produtor e "certificado" no outro.
 *
 * O que a pessoa vê: 🟢 "A duração calculada está dentro dos limites do app."
 *
 * FALHA no snapshot auditado. Não corrige código.
 */
import { describe, expect, it } from 'vitest';
import { gerarTreino } from '@/lib/engine';
import type { PerfilTreino, RotinaCustom } from '@/lib/engine';
import { EXERCISES_SEED } from '@/lib/data/seed';
import { vereditoDoPlano } from '@/lib/veredito-motor';
import type { Weekday } from '@/lib/semana';

const TEMPO = 70;

/** Desenho manual mínimo que reproduz o caso: 5 exercícios × 6 séries em 1 dia de 60 min. */
const EXERCICIOS = ['e14', 'e22', 'e16', 'e72', 'e70'];

const perfil: PerfilTreino = {
  pesoKg: 75, alturaCm: 175, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'saude', nivelExperiencia: 'intermediario', equipamento: 'academia',
  diasDisponiveis: 1, treinoDias: ['seg'] as Weekday[], tempoPorSessaoMin: TEMPO,
  rotinaCustom: {
    origem: 'usuario',
    dias: [{
      nome: 'Meu treino', diaId: 'seg', exercicioIds: EXERCICIOS,
      seriesPorExercicio: Object.fromEntries(EXERCICIOS.map((id) => [id, 6])),
    }],
  } satisfies RotinaCustom,
};

describe('REGRESSÃO D12 · plano manual não pode ser CERTIFICADO com dia de limite indeterminado', () => {
  const rotina = gerarTreino(perfil, { exercises: EXERCISES_SEED, semanaCiclo: { semana: 1 } }).rotina!;
  const dia0 = rotina.duracaoDias![0]!;

  it('o motor MEDE o dia como LIMITE_INDETERMINADO (pré-condição do caso)', () => {
    expect(dia0.estadoCalculo).toBe('CALCULADO');
    expect(dia0.estadoLimite).toBe('LIMITE_INDETERMINADO');
    // max ultrapassa o limite operacional; min não. É exatamente o "pode não caber".
    expect(dia0.duracaoMaximaEstimadaSegundos!).toBeGreaterThan(dia0.limiteOperacionalSegundos!);
    expect(dia0.duracaoMinimaEstimadaSegundos!).toBeLessThanOrEqual(dia0.limiteOperacionalSegundos!);
  });

  it('não pode receber o terminal CERTIFICADO', () => {
    expect(rotina.resultadoGeracao!.tipo).not.toBe('CERTIFICADO');
  });

  it('não pode exibir o veredito verde de duração dentro do limite', () => {
    const v = vereditoDoPlano(rotina, TEMPO);
    expect(v?.tom).not.toBe('ok');
  });

  it('invariante geral: nenhum dia fora de DENTRO_DO_LIMITE/DENTRO_DA_TOLERANCIA sob CERTIFICADO', () => {
    if (rotina.resultadoGeracao!.tipo !== 'CERTIFICADO') return;
    for (const [i, d] of rotina.duracaoDias!.entries()) {
      expect(['DENTRO_DO_LIMITE', 'DENTRO_DA_TOLERANCIA'], `dia ${i}`).toContain(d.estadoLimite);
    }
  });
});
