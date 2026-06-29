import { describe, it, expect } from 'vitest';
import { avaliarGateTreino } from './src/lib/engine/treino-gate';
import { prescreverTreino } from './src/lib/engine/treino';
import { montarRotina } from './src/lib/engine/treino-montador';
import { EXERCISES } from './src/lib/data/exercises';
import type { PerfilTreino } from './src/lib/engine/treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

describe('ACHADO: core não é verificado (invariante travado line 220 spec)', () => {
  it('PPL×2 com tempo muito curto pode deixar core abaixo de 2×', () => {
    const perfil: PerfilTreino = {
      pesoKg: 80,
      alturaCm: 180,
      idade: 30,
      flagsSaude: SEM,
      objetivo: 'massa',
      nivelExperiencia: 'avancado',
      equipamento: 'academia',
      diasDisponiveis: 6,
      tempoPorSessaoMin: 20, // MUITO curto
    };

    const prescricao = prescreverTreino(perfil, avaliarGateTreino(perfil));
    const rotina = montarRotina(prescricao, perfil, EXERCISES);

    const contaPadrao = (p: string) => rotina.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
    const coreCount = contaPadrao('core');

    // Spec linha 220: "Core 2–3×/semana"
    console.log(`Core count: ${coreCount}×`);
    console.log(`Spec exige: 2–3×`);
    console.log(`Avisos: ${rotina.avisos.join('; ')}`);

    // Se coreCount < 2 ou > 3, é violação + não há aviso
    if (coreCount < 2 || coreCount > 3) {
      console.log(`\n✗ INVARIANTE QUEBRADA: core ${coreCount}× ≠ 2–3×`);
      console.log(`✗ Aviso gerado? ${rotina.avisos.some(a => a.includes('core')) ? 'SIM' : 'NÃO'}`);
    }
  });
});
