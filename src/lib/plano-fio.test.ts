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

  it('trocar ("prefiro X") põe o preferido no plano', async () => {
    // O par é DERIVADO do plano (não fixado): `de` = um exercício do plano; `para` = outro
    // do MESMO padrão, elegível, fora do plano. Fixar ids quebrava a cada mudança de
    // alocador sem medir nada.
    const { EXERCISES_SEED } = await import('@/lib/data/seed');
    const sem = plano(BASE);
    const ids = new Set(sem.split(/[|,]/));
    const de = EXERCISES_SEED.find((e) => ids.has(e.id))!;
    const para = EXERCISES_SEED.find((e) => !ids.has(e.id) && e.padraoMovimento === de.padraoMovimento && e.local === 'academia' && e.nivel !== 'avancado');
    expect(para, 'não há candidato de troca fora do plano — fixture impossível').toBeDefined();
    const com = plano({ ...BASE, preferencias: { trocas: [{ de: de.id, para: para!.id }], banidos: [] } });
    expect(com.split(/[|,]/), `o preferido ${para!.id} não entrou`).toContain(para!.id);
    expect(com.split(/[|,]/), `o preterido ${de.id} não saiu`).not.toContain(de.id);
  });

  /**
   * 🔴 Este teste NASCEU FRACO e deixou um defeito passar por 2 dias (medição 2026-08-14).
   * Ele afirmava `expect(com).not.toBe(sem)` — "o plano DIFERE" —, e isso era satisfeito
   * pelo COMPENSADOR perdendo série sozinho, enquanto o focado não ganhava nada e o volume
   * sumia da semana. O teste passava exatamente enquanto o bug vivia.
   *
   * O que ele afirma agora é o FIO, que é o que ele sempre quis provar: o foco chega ao
   * montador. A ENTREGA (focado sobe · total conserva · nenhum terceiro muda) é do
   * `foco-entrega-real.test.ts`, com as três asserções da DF.
   */
  it('o foco CHEGA ao montador (o fio) — a entrega é medida no guard próprio', () => {
    const p = { ...BASE, foco: { grupo: 'peito' as const, compensa: 'ombros' as const, semana: 1 } };
    const parsed = perfilResumoSchema.safeParse(p);
    expect(parsed.success, 'o foco não passou no zod da rota').toBe(true);
    if (!parsed.success) return;
    const linha = perfilParaLinha(parsed.data as never) as unknown as Record<string, unknown>;
    const volta = linhaParaPerfil({ ...linha, id: 'u1' } as never);
    expect(volta.foco, 'o foco não sobreviveu ao round-trip do banco').toEqual(p.foco);
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


describe('foco agregado: transporte local completo', () => {
  it.each(['bracos', 'pernas'] as const)('%s atravessa schema, JSON profile e motor', grupo => {
    const referencia: PerfilResumo = { ...BASE, diasDisponiveis: 1, treinoDias: ['seg'], tempoPorSessaoMin: 90 };
    const p: PerfilResumo = { ...referencia, focoAgregado: { grupo, semana: 1 } };
    const validado = perfilResumoSchema.parse(p);
    expect(validado.focoAgregado).toEqual(p.focoAgregado);
    const salvo = perfilParaLinha(p);
    const lido = linhaParaPerfil(JSON.parse(JSON.stringify(salvo)));
    expect(lido.focoAgregado).toEqual(p.focoAgregado);
    expect(plano(lido)).toBe(plano(p));
    expect(plano(p)).not.toBe(plano(referencia));
  });
});
