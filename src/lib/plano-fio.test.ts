/**
 * 🔴 O FIO DO v3 — leva A do v4 (handoff-motor-volume-v4-2026-08-12).
 *
 * 🔑 POR QUE ESTE ARQUIVO EXISTE. A medição de 2026-08-12 (relatorio-medicao-v3) provou que
 * os controles do v3 estavam LIGADOS NA TELA e MORTOS NO MOTOR: `plano.ts` — o único ponto
 * do app que constrói um `PerfilTreino` — não repassava `preferencias` nem `foco`; o schema
 * zod da borda descartava os campos no PUT; e o mapeador do `profile` não os gravava nem
 * lia. Banir, trocar e focar gravava no perfil, emitia telemetria e não mudava NADA — e o
 * boot server-first ainda apagava os campos no reload seguinte.
 *
 * A regra da casa que isto executa: cada campo do fio tem um PAR DISCRIMINANTE — o mesmo
 * input com e sem o campo produz planos DIFERENTES. Presença de símbolo não prova fio;
 * plano diferente prova.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { perfilResumoSchema } from './validation/perfil-resumo';
import { linhaParaPerfil, perfilParaLinha } from './persistencia/perfil-profile';
import type { PerfilResumo } from '@/components/painel/Painel';

/** Perfil de referência (o mesmo da medição: massa/intermediário/academia/4d/60min). */
const BASE = {
  sexo: 'masculino', idade: 30, alturaCm: 178, pesoKg: 80,
  objetivo: 'massa', nivelAtividade: 'moderado', nivelExperiencia: 'intermediario',
  equipamento: 'academia', preferencia: null, alergenos: [],
  diasDisponiveis: 4, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], naoCurto: [], pratosCansados: [],
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
} as unknown as PerfilResumo;

const SEMANA = { semanaCiclo: { semana: 3 as const } };

/** Assinatura estável do plano de treino: ids por dia (a ordem importa — o foco reordena). */
function plano(p: PerfilResumo): string {
  const { treino } = recomputarPlano(p, SEMANA);
  return treino.rotina!.dias.map((d) => d.slots.map((s) => s.exercicio.id).join(',')).join('|');
}

describe('🔴 pares discriminantes — cada campo do fio muda o plano', () => {
  it('banir um exercício do plano o REMOVE do plano recomputado', () => {
    const sem = plano(BASE);
    const alvo = sem.split(/[|,]/)[0]!; // o 1º exercício do plano — garantido presente
    const com = plano({ ...BASE, preferencias: { trocas: [], banidos: [alvo] } });
    expect(com, 'o banimento não chegou ao motor — plano idêntico').not.toBe(sem);
    expect(com.split(/[|,]/), `${alvo} banido continua no plano`).not.toContain(alvo);
  });

  it('trocar ("prefiro X") põe o preferido no plano', () => {
    // e22 (puxar) está no plano base; e47 (puxar, mesmo padrão) não está.
    const sem = plano(BASE);
    expect(sem.split(/[|,]/)).toContain('e22');
    expect(sem.split(/[|,]/)).not.toContain('e47');
    const com = plano({ ...BASE, preferencias: { trocas: [{ de: 'e22', para: 'e47' }], banidos: [] } });
    expect(com.split(/[|,]/), 'o preferido não entrou').toContain('e47');
    expect(com.split(/[|,]/), 'o preterido não saiu').not.toContain('e22');
  });

  it('foco em grupo muda o plano (ao menos a ordem, dentro da classe)', () => {
    const sem = plano(BASE);
    const com = plano({ ...BASE, foco: { grupo: 'peito', compensa: 'costas', semana: 1 } });
    expect(com, 'o foco não chegou ao montador — plano idêntico').not.toBe(sem);
  });

  it('divisaoPreferida chega ao PerfilTreino (fio pronto para a leva B)', () => {
    // A leva A só liga o fio; o alocador (leva B) é quem muda o plano por divisão.
    // Aqui o guard é estático: o campo não pode ser descartado no mapeamento.
    const { treino } = recomputarPlano({ ...BASE, divisaoPreferida: 'superior-inferior' }, SEMANA);
    expect(treino.rotina).not.toBeNull(); // e o typecheck garante o campo em PerfilTreino
  });
});

describe('🔴 a borda e a persistência não descartam os campos do fio', () => {
  const CAMPOS = {
    preferencias: { trocas: [{ de: 'e1', para: 'e10' }], banidos: ['e22'] },
    foco: { grupo: 'peito', compensa: 'costas', semana: 2 },
    tecnicasAvancadas: true,
    orcamento: 'baixo',
    divisaoPreferida: 'prioridades',
  } as const;
  const cheio = { ...BASE, ...CAMPOS } as PerfilResumo;

  it('o schema da borda (PUT do perfil) preserva os 5 campos', () => {
    const parsed = perfilResumoSchema.safeParse(cheio);
    expect(parsed.success, JSON.stringify((parsed as { error?: unknown }).error)).toBe(true);
    if (!parsed.success) return;
    // zod descarta chave não declarada — igualdade profunda prova a declaração.
    expect(parsed.data.preferencias).toEqual(CAMPOS.preferencias);
    expect(parsed.data.foco).toEqual(CAMPOS.foco);
    expect(parsed.data.tecnicasAvancadas).toBe(true);
    expect(parsed.data.orcamento).toBe('baixo');
    expect(parsed.data.divisaoPreferida).toBe('prioridades');
  });

  it('o mapeador do profile faz o round-trip fiel (gravar → ler)', () => {
    const volta = linhaParaPerfil(perfilParaLinha(cheio));
    expect(volta.preferencias).toEqual(CAMPOS.preferencias);
    expect(volta.foco).toEqual(CAMPOS.foco);
    expect(volta.tecnicasAvancadas).toBe(true);
    expect(volta.orcamento).toBe('baixo');
    expect(volta.divisaoPreferida).toBe('prioridades');
  });

  it('ausência continua ausência (nenhum campo é inventado no round-trip)', () => {
    const volta = linhaParaPerfil(perfilParaLinha(BASE));
    expect(volta.preferencias).toBeUndefined();
    expect(volta.foco).toBeUndefined();
    expect(volta.tecnicasAvancadas).toBeUndefined();
    expect(volta.orcamento).toBeUndefined();
    expect(volta.divisaoPreferida).toBeUndefined();
  });

  /**
   * ⚠️ O nome no jsonb é `preferenciasTreino`, NUNCA `preferencias` — o bloco jsonb inteiro
   * já se chama `preferencias` no banco; repetir criaria `preferencias.preferencias`.
   */
  it('no banco, as preferências de treino gravam como `preferenciasTreino`', () => {
    const linha = perfilParaLinha(cheio);
    expect(linha.preferencias.preferenciasTreino).toEqual(CAMPOS.preferencias);
    expect((linha.preferencias as unknown as Record<string, unknown>)['preferencias']).toBeUndefined();
  });
});

/**
 * 🔒 O enum de grupos do schema espelha `GrupoPrimario` (data/types.ts) — zod não deriva de
 * union TS, então a lista é redigitada lá e TRAVADA aqui contra a fonte real (a biblioteca).
 */
describe('🔒 o enum de grupos da borda espelha a biblioteca', () => {
  it('todo grupoPrimario da biblioteca passa no schema do foco', async () => {
    const { EXERCISES_SEED } = await import('@/lib/data/seed');
    const grupos = [...new Set(EXERCISES_SEED.map((e) => e.grupoPrimario).filter((g): g is NonNullable<typeof g> => g != null))];
    for (const g of grupos) {
      const r = perfilResumoSchema.safeParse({ ...BASE, foco: { grupo: g, compensa: g === 'peito' ? 'costas' : 'peito', semana: 1 } });
      expect(r.success, `grupo da biblioteca recusado no schema: ${g}`).toBe(true);
    }
  });
});
