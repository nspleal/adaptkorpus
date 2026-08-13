/**
 * 🔴 Leva A2 do v4 — a entrega do foco é MEDIDA do plano, nunca afirmada do alvo.
 * Par discriminante do defeito: o alvo dizia 'volume'; o plano não mudava.
 */
import { describe, expect, it } from 'vitest';
import { medirEntregaDoFoco } from './foco-entrega';
import { gerarTreino } from '@/lib/engine';
import { EXERCISES_SEED } from '@/lib/data/seed';
import type { PerfilTreino, ResultadoTreino } from '@/lib/engine';

const P = (foco?: PerfilTreino['foco']): PerfilTreino => ({
  pesoKg: 80, alturaCm: 178, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'massa', nivelExperiencia: 'avancado', equipamento: 'academia',
  diasDisponiveis: 4, tempoPorSessaoMin: 60,
  ...(foco ? { foco } : {}),
});

const gerar = (foco?: PerfilTreino['foco']): ResultadoTreino =>
  gerarTreino(P(foco), { exercises: EXERCISES_SEED, semanaCiclo: { semana: 3 } });

describe('🔴 medirEntregaDoFoco — do plano montado, não do alvo', () => {
  /**
   * 🔑 O PAR DISCRIMINANTE. Avançado/massa/4d: `aplicarFoco` no ALVO diz delta 2 ('volume'),
   * mas a distribuição trunca em n_slots × sMax e o plano entrega as MESMAS séries — só a
   * ordem muda. A medição tem que dizer 'ordem', não 'volume'. (Com o alocador da leva B o
   * delta passa a materializar e este perfil migra para 'volume' — aí o teste acompanha.)
   */
  it('plano com séries idênticas e ordem diferente → ordem, delta 0', () => {
    const sem = gerar();
    const com = gerar({ grupo: 'peito', compensa: 'costas', semana: 1 });
    const efeito = medirEntregaDoFoco(com, sem, 'peito');
    expect(efeito).not.toBeNull();
    if (efeito!.entrega === 'volume') {
      // Se um dia o motor materializar volume aqui, o delta tem que ser REAL (> 0).
      expect(efeito!.delta).toBeGreaterThan(0);
    } else {
      expect(efeito).toEqual({ entrega: 'ordem', delta: 0 });
    }
  });

  it('planos idênticos → null (o evento não dispara; ausência é o dado)', () => {
    const sem = gerar();
    expect(medirEntregaDoFoco(sem, sem, 'peito')).toBeNull();
  });

  it('séries do grupo sobem → volume, com o delta MEDIDO', () => {
    const sem = gerar();
    // Fabrica o contrafactual: +2 séries no 1º slot de peito (o que a leva B fará de verdade).
    const com: ResultadoTreino = JSON.parse(JSON.stringify(sem));
    const slot = com.rotina!.dias.flatMap((d) => d.slots).find((s) => s.exercicio.grupoPrimario === 'peito')!;
    slot.series = (slot.series ?? 0) + 2;
    expect(medirEntregaDoFoco(com, sem, 'peito')).toEqual({ entrega: 'volume', delta: 2 });
  });

  it('🔒 core NUNCA devolve ordem (DF 2026-08-05) — borda com delta 0 responde silêncio', () => {
    const sem = gerar();
    // Mesmas séries, ordem trocada (reordena o 1º dia): para core a resposta é null, não 'ordem'.
    const com: ResultadoTreino = JSON.parse(JSON.stringify(sem));
    com.rotina!.dias[0]!.slots.reverse();
    expect(medirEntregaDoFoco(com, sem, 'core')).toBeNull();
    // …e o mesmo cenário para um grupo comum diz 'ordem' — o silêncio é do core, não do caso.
    expect(medirEntregaDoFoco(com, sem, 'peito')).toEqual({ entrega: 'ordem', delta: 0 });
  });
});
