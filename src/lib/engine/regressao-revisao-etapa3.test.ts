/**
 * 🔴 REGRESSÕES DA REVISÃO INDEPENDENTE — etapa 3 (parecer de 2026-09-14).
 *
 * Cada caso aqui é a reprodução literal de um defeito do candidato `badcea47`, pela porta
 * pública (`gerarTreino`), com as MESMAS entradas nos dois lados da comparação. Todos falham
 * em `badcea47` pela conduta medida — não por API ausente, fixture nova ou infraestrutura —
 * e passam no corrigido.
 *
 * D-01 · o corte temporal cobrava do baseline para preservar um extra do foco.
 * D-02 · extras de um dia mudavam o corte de outro, e o grupo focado terminava com ganho
 *        líquido zero enquanto `blocoFoco` anunciava +4 séries.
 * D-03 · a guarda puxar/empurrar recusava o bloco de peito/tríceps/ombros em semana
 *        equilibrada, e nunca o de costas/bíceps.
 * P-01 · `INCOMPATIVEL` é TOM de aviso, não impedimento — a frase tinha de dizer isso e
 *        oferecer os caminhos reais, sem prometer que o treino cabe.
 */
import { describe, expect, it } from 'vitest';
import { gerarTreino } from './index';
import { EXERCISES } from '../data/exercises';
import { vereditoDoPlano } from '../veredito-motor';
import type { PerfilTreino, RotinaSemanal } from './treino-types';
import type { Weekday } from '../semana';
import type { GrupoPrimario } from '../data/types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> & { treinoDias: Weekday[] }): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', tempoPorSessaoMin: 60,
  diasDisponiveis: over.treinoDias.length, ...over,
});
const gerar = (p: PerfilTreino) =>
  gerarTreino(p, { exercises: EXERCISES, semanaCiclo: { semana: 1 } }).rotina!;

/** Assinatura de conteúdo do baseline: identidade, séries e descanso, por dia, sem o foco. */
const baselineFora = (r: RotinaSemanal, grupo: GrupoPrimario) => r.dias.map((d) => ({
  dia: d.diaId,
  slots: d.slots.filter((s) => s.exercicio.grupoPrimario !== grupo)
    .map((s) => `${s.exercicio.id}:${s.series}:${s.descansoSeg}`).sort(),
}));
const seriesDe = (r: RotinaSemanal, grupo: GrupoPrimario) =>
  r.dias.flatMap((d) => d.slots).filter((s) => s.exercicio.grupoPrimario === grupo)
    .reduce((n, s) => n + (s.series ?? 0), 0);
const porGrupo = (r: RotinaSemanal) => {
  const m = new Map<string, number>();
  for (const d of r.dias) for (const s of d.slots) {
    const g = s.exercicio.grupoPrimario; if (!g) continue;
    m.set(g, (m.get(g) ?? 0) + (s.series ?? 0));
  }
  return m;
};
const seriesDoBloco = (r: RotinaSemanal) => (r.blocoFoco?.adicionais ?? []).reduce((n, a) => n + a.series, 0);

describe('D-01 — o tempo tira o bloco adicional, nunca o baseline', () => {
  /**
   * Reprodução do parecer §2/D-01. Em `badcea47`, a quarta-feira perdia `e47` (costas):
   * 2 exercícios/6 séries → 1/3, porque o extra de bíceps era o único do seu grupo no dia e
   * o filtro `removivel` o protegia. O aviso falava só do bloco, nunca de costas.
   */
  const entrada = perfil({ nivelExperiencia: 'iniciante', tempoPorSessaoMin: 30, treinoDias: ['seg', 'qua', 'sex'] });
  const neutro = gerar(entrada);
  const comFoco = gerar({ ...entrada, foco: { grupo: 'biceps', semana: 1 } });

  it('anti-vacuidade: o tempo APERTA mesmo neste perfil (há corte a decidir)', () => {
    const bloco = comFoco.blocoFoco;
    expect(bloco, 'o perfil não ativou o bloco de foco — o caso não discrimina').toBeTruthy();
    expect(bloco!.adicionais.length, 'o bloco coube inteiro: sem disputa por tempo, nada é provado')
      .toBeLessThan(2);
  });

  it('nenhum exercício, série ou descanso dos outros grupos muda', () => {
    expect(baselineFora(comFoco, 'biceps')).toEqual(baselineFora(neutro, 'biceps'));
  });

  it('nenhum grupo fora do foco perde volume na semana', () => {
    const a = porGrupo(neutro); const b = porGrupo(comFoco);
    const perdas = [...a].filter(([g, n]) => g !== 'biceps' && (b.get(g) ?? 0) < n);
    expect(perdas, `grupos que pagaram pelo foco: ${perdas.map(([g, n]) => `${g} ${n}→${b.get(g) ?? 0}`).join(', ')}`).toEqual([]);
  });
});

describe('D-02 — extras de um dia não mexem no corte de outro, e o ganho é real', () => {
  /**
   * Reprodução do parecer §2/D-02. Em `badcea47`, a quinta-feira — que não recebeu extra
   * nenhum — trocava a remoção de `e74` (bíceps) por `e45` (costas) só porque dois extras de
   * `puxar` tinham entrado na segunda. Resultado: costas +0 séries líquidas, bíceps +4, e
   * `blocoFoco` anunciando "2 exercícios adicionais, 4 séries".
   */
  const entrada = perfil({
    nivelExperiencia: 'avancado', objetivo: 'emagrecimento', tempoPorSessaoMin: 45,
    treinoDias: ['seg', 'ter', 'qui', 'sex'],
  });
  const neutro = gerar(entrada);
  const comFoco = gerar({ ...entrada, foco: { grupo: 'costas', semana: 1 } });

  it('anti-vacuidade: o bloco realmente entregou extras neste perfil', () => {
    expect(comFoco.blocoFoco?.adicionais.length, 'sem extras entregues não há o que conferir').toBeGreaterThan(0);
  });

  it('o baseline dos outros grupos sai idêntico, dia a dia', () => {
    expect(baselineFora(comFoco, 'costas')).toEqual(baselineFora(neutro, 'costas'));
  });

  it('🔑 o ganho líquido do grupo focado é EXATAMENTE o que o bloco declara', () => {
    expect(seriesDe(comFoco, 'costas') - seriesDe(neutro, 'costas')).toBe(seriesDoBloco(comFoco));
    expect(seriesDoBloco(comFoco), 'bloco declarado vazio — a identidade seria trivial').toBeGreaterThan(0);
  });

  it('nenhum grupo fora do foco ganha nem perde séries', () => {
    const a = porGrupo(neutro); const b = porGrupo(comFoco);
    const mexidos = [...new Set([...a.keys(), ...b.keys()])]
      .filter((g) => g !== 'costas' && (a.get(g) ?? 0) !== (b.get(g) ?? 0));
    expect(mexidos, `grupos alterados sem estar no foco: ${mexidos.join(', ')}`).toEqual([]);
  });

  it('cada extra declarado existe no plano, no dia e com as séries anunciadas', () => {
    for (const a of comFoco.blocoFoco!.adicionais) {
      const dia = comFoco.dias.find((d) => d.diaId === a.diaId);
      expect(dia, `dia ${a.diaId} não existe no plano`).toBeTruthy();
      expect(dia!.slots.some((s) => s.exercicio.id === a.exercicioId && (s.series ?? 0) === a.series)).toBe(true);
    }
  });
});

describe('D-03 — o bloco de empurrar não é recusado para manter igualdade puxar/empurrar', () => {
  /**
   * Reprodução do parecer §2/D-03. A guarda só restringia `empurrar` e usava `>=`, então a
   * semana equilibrada já bloqueava. Neste perfil de `casa`, o pool de peito é quase todo
   * `empurrar`: `badcea47` entregava ZERO extras de peito e dois de costas, com as mesmas
   * entradas. O balanceamento continua exigido do baseline (foco-equilibrio-puxar-empurrar).
   */
  const entrada = perfil({
    nivelExperiencia: 'iniciante', equipamento: 'casa', tempoPorSessaoMin: 60, treinoDias: ['seg', 'qui'],
  });

  it('peito (empurrar) recebe o mesmo tamanho de bloco que costas (puxar)', () => {
    const peito = gerar({ ...entrada, foco: { grupo: 'peito', semana: 1 } });
    const costas = gerar({ ...entrada, foco: { grupo: 'costas', semana: 1 } });
    expect(costas.blocoFoco?.adicionais.length, 'costas não entregou — o par perde o sentido').toBe(2);
    expect(peito.blocoFoco?.adicionais.length, 'peito recusado enquanto costas foi aceito').toBe(2);
  });

  it('e o ganho chega ao plano: +4 séries de peito, sem tocar em ninguém', () => {
    const neutro = gerar(entrada);
    const peito = gerar({ ...entrada, foco: { grupo: 'peito', semana: 1 } });
    expect(seriesDe(peito, 'peito') - seriesDe(neutro, 'peito')).toBe(4);
    expect(baselineFora(peito, 'peito')).toEqual(baselineFora(neutro, 'peito'));
  });

  it('grupos de empurrar e de puxar entregam na mesma proporção na grade curta', () => {
    const agendas: Weekday[][] = [['dom', 'seg'], ['seg', 'qui'], ['seg', 'qua', 'sex']];
    const recusados: string[] = [];
    for (const treinoDias of agendas) for (const grupo of ['peito', 'triceps', 'costas', 'biceps'] as GrupoPrimario[]) {
      const r = gerar(perfil({ nivelExperiencia: 'iniciante', equipamento: 'casa', tempoPorSessaoMin: 60, treinoDias, foco: { grupo, semana: 1 } }));
      // Recusa legítima é a de CATÁLOGO (pool elegível esgotado), não a de padrão.
      const elegiveis = EXERCISES.filter((e) => e.grupoPrimario === grupo).length;
      if ((r.blocoFoco?.adicionais.length ?? 0) === 0 && elegiveis > 1) recusados.push(`${treinoDias.join('+')}/${grupo}`);
    }
    expect(recusados, `bloco recusado sem pool esgotado: ${recusados.join(', ')}`).toEqual([]);
  });
});

describe('P-01 — INCOMPATIVEL informa o conflito e os caminhos, sem prometer que cabe', () => {
  /**
   * `tom: 'bloqueio'` é aparência de aviso: `AvisosMotor` pinta a faixa e `TreinoTab` segue
   * renderizando os dias. O parecer pediu que a frase dissesse isso e nomeasse as saídas
   * reais — sem afrouxar limite, descanso ou cobertura para fabricar um certificado.
   */
  const entrada = perfil({ nivelExperiencia: 'avancado', tempoPorSessaoMin: 20, treinoDias: ['seg'] });
  const r = gerar(entrada);

  it('anti-vacuidade: este perfil realmente cai em INCOMPATIVEL', () => {
    expect(r.resultadoGeracao?.tipo).toBe('INCOMPATIVEL');
  });

  it('o plano continua entregue e utilizável (bloqueio é tom, não impedimento)', () => {
    expect(r.dias.length).toBeGreaterThan(0);
    expect(r.dias.every((d) => d.slots.length > 0)).toBe(true);
    expect(r.dias.flatMap((d) => d.slots).every((s) => (s.series ?? 0) > 0)).toBe(true);
  });

  it('a frase diz que dá para usar e lista alternativas, sem garantir que cabe', () => {
    const v = vereditoDoPlano(r, entrada.tempoPorSessaoMin)!;
    expect(v.tom).toBe('bloqueio');
    expect(v.detalhe).toMatch(/consultar, iniciar e registrar/);
    expect(v.detalhe).toMatch(/nenhum deles garante que caiba/);
    expect(v.detalhe).toMatch(/mais dias/);
    expect(v.detalhe).toMatch(/75\+/);
    // Nada de promessa: a frase não pode afirmar que o treino cabe no tempo escolhido.
    expect(v.detalhe).not.toMatch(/vai caber|passa a caber|resolve o tempo/i);
  });

  it('o limite escolhido, o descanso mínimo e a cobertura NÃO foram afrouxados para certificar', () => {
    const limite = entrada.tempoPorSessaoMin * 60;
    const excede = (r.duracaoDias ?? []).some((d) => d.estadoCalculo === 'CALCULADO' && (d.duracaoMaximaEstimadaSegundos ?? 0) > limite);
    expect(excede, 'INCOMPATIVEL sem dia acima do teto medido seria rótulo vazio').toBe(true);
    expect(r.dias.flatMap((d) => d.slots).every((s) => (s.descansoSeg ?? 0) >= 60)).toBe(true);
  });
});
