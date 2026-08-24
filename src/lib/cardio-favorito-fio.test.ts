/**
 * 🏃 C2 — O FIO do cardio favorito, ponta a ponta.
 *
 * 🔑 A lição do v3 (2026-08-12) e da reincidência de 2026-08-14: **campo novo sem teste de
 * FIO morre calado.** O controle aparece na tela, grava no perfil, emite telemetria — e não
 * muda o plano, porque um elo entre zod, mapper e motor não foi ligado. Este teste atravessa
 * a cadeia inteira e afirma o EFEITO, não a presença.
 */
import { describe, expect, it } from 'vitest';
import { perfilResumoSchema } from './validation/perfil-resumo';
import { linhaParaPerfil, perfilParaLinha } from './persistencia/perfil-profile';
import { recomputarPlano } from './plano';
import { MODALIDADES_CARDIO } from './engine/cardio';
import type { PerfilResumo } from '@/components/painel/Painel';

/** Perfil com dia excedente: 2 dias de treino oferecidos, 4 disponíveis na agenda. */
const BASE = {
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30,
  nivelAtividade: 'moderado', objetivo: 'emagrecimento', preferencia: null,
  alergenos: [], refeicoesPorDia: 4, treinoDias: ['seg', 'ter', 'qua', 'qui'],
  nivelExperiencia: 'iniciante', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
} as Record<string, unknown>;

const pelaRota = (extra: Record<string, unknown> = {}): PerfilResumo => {
  const p = perfilResumoSchema.safeParse({ ...BASE, ...extra });
  if (!p.success) throw new Error(`zod rejeitou: ${JSON.stringify(p.error.issues[0])}`);
  const linha = perfilParaLinha(p.data as never) as unknown as Record<string, unknown>;
  return linhaParaPerfil({ ...linha, id: 'u1' } as never) as PerfilResumo;
};

describe('🏃 C2 — o cardio favorito chega ao plano', () => {
  it('sobrevive ao zod e ao round-trip do banco', () => {
    expect(pelaRota({ cardioFavorito: 'bike' }).cardioFavorito).toBe('bike');
  });

  it('ausente = ausente (não inventa preferência)', () => {
    expect(pelaRota().cardioFavorito).toBeUndefined();
  });

  /** 🔑 O EFEITO: o dia excedente sai com a modalidade escolhida, não com o default. */
  it('o dia de cardio sai com a modalidade escolhida', () => {
    const r = recomputarPlano(pelaRota({ cardioFavorito: 'bike' }), {
      semanaCiclo: { semana: 3 }, diasOferecidosCardio: [3],
    });
    const dias = r.treino.rotina?.diasCardio ?? [];
    expect(dias.length, 'fixture sem dia excedente — o teste não provaria nada').toBeGreaterThan(0);
    expect(dias.every((d) => d.modalidade === 'bike'), `modalidades: ${dias.map((d) => d.modalidade).join(',')}`).toBe(true);
  });

  /**
   * PAR DISCRIMINANTE: sem escolha, o default da spec (caminhada) — e ele é DIFERENTE do
   * escolhido acima. Sem este par, um motor que ignorasse o campo e sempre devolvesse
   * 'bike' passaria no teste anterior.
   */
  it('sem escolha, o default da spec é caminhada — e difere do escolhido', () => {
    const r = recomputarPlano(pelaRota(), {
      semanaCiclo: { semana: 3 }, diasOferecidosCardio: [3],
    });
    const dias = r.treino.rotina?.diasCardio ?? [];
    expect(dias.length).toBeGreaterThan(0);
    expect(dias.every((d) => d.modalidade === 'caminhada')).toBe(true);
  });

  it('as 6 modalidades do registro passam no schema — a UI não oferece opção inválida', () => {
    for (const m of MODALIDADES_CARDIO) {
      expect(perfilResumoSchema.safeParse({ ...BASE, cardioFavorito: m }).success, m).toBe(true);
    }
  });
});
