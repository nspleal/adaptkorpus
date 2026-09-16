/**
 * 🔒 A FAIXA É A DA SEMANA — regressão do "faixa mínima desta semana" mentiroso.
 *
 * 🔑 O defeito, medido em `3d86cbf`: na semana de DELOAD o motor reduz o volume de propósito
 * e o seu guard de cobertura se cala (`treino-montador.ts`: `semana !== 6 && !retomada`, com o
 * comentário *"lá o volume baixo é a feature"*). O crítico não tinha essa noção: comparava as
 * 8 séries entregues com o piso TERMINAL do mesociclo (13) e abria a tela com **6 de 6 grupos
 * acusados**, contradizendo a própria copy do editor ("nas fases de recuperação, o volume pode
 * ser reduzido"). Na retomada era igual: motor 0 × crítico 6.
 *
 * 🔒 O que NÃO mudou, e estes testes cobram: nas semanas normais a avaliação é idêntica, o
 * aviso de MÁXIMO continua valendo em todas as fases, e os avisos de corte por tempo seguem.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { avaliarSemana, type DiaDoEditor } from './engine/critico';
import { mev, mrv } from './engine/trilhos';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { RotinaSemanal } from './engine/treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilResumo> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, alergenos: [], preferencia: 'onivoro', naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'intermediario', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 4, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], ...over,
}) as PerfilResumo;

const plano = (p: PerfilResumo, opcoes: unknown) => recomputarPlano(p, opcoes as never).treino.rotina!;
const comoEditor = (r: RotinaSemanal): DiaDoEditor[] => r.dias.map((d) => ({
  nome: d.nome, exercicios: d.slots.map((s) => s.exercicio), series: d.slots.map((s) => s.series),
  descansoSeg: d.slots.map((s) => s.descansoSeg), holdSeg: d.slots.map((s) => s.holdSeg),
}));
/** O crítico como a TELA o chama depois da correção: com a faixa e a fase que o motor publicou. */
const criticar = (r: RotinaSemanal, semana: number) => avaliarSemana(comoEditor(r), {
  semana, nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado',
  ...(r.faixaVolumeSemana ? { faixaSemanal: r.faixaVolumeSemana } : {}),
  ...(r.faseVolume ? { faseVolume: r.faseVolume } : {}),
});
const deficits = (a: ReturnType<typeof criticar>) => a.recomendacoes.filter((i) => i.codigo === 'grupo_abaixo_do_minimo');
const deficitsDoMotor = (r: RotinaSemanal) => r.avisos.filter((a) => a.includes('abaixo do mínimo'));

describe('o motor PUBLICA a faixa da semana', () => {
  it('semana normal: a faixa é a do nível/objetivo, e a fase é `normal`', () => {
    const r = plano(perfil(), { semanaCiclo: { semana: 3 } });
    expect(r.faseVolume).toBe('normal');
    expect(r.faixaVolumeSemana).toEqual({ min: mev('intermediario', 'massa'), max: mrv('intermediario', 'massa') });
  });

  it('🔴 deload: a faixa é a REDUZIDA de `aplicarDeload`, não a terminal', () => {
    const r = plano(perfil(), { semanaCiclo: { semana: 6 } });
    expect(r.faseVolume).toBe('deload');
    expect(r.faixaVolumeSemana!.min, 'a faixa do deload continua sendo a terminal').toBeLessThan(mev('intermediario', 'massa'));
    expect(r.faixaVolumeSemana!.max).toBeLessThan(mrv('intermediario', 'massa'));
  });

  it('🔴 retomada: o piso é o alvo de `volumeDaRetomada`; o TETO não se mexe', () => {
    const r = plano(perfil(), { semanaCiclo: { semana: 1, retomada: { semana: 1, fator: 0.5, volumeReferencia: 16 } } });
    expect(r.faseVolume).toBe('retomada');
    expect(r.faixaVolumeSemana).toEqual({ min: 8, max: mrv('intermediario', 'massa') });
  });
});

describe('🔴 deload e retomada — o crítico para de acusar o que o motor prescreveu', () => {
  it('DELOAD: motor 0 déficits × crítico 0 (era 0 × 6)', () => {
    const r = plano(perfil(), { semanaCiclo: { semana: 6 } });
    const a = criticar(r, 6);
    // anti-vacuidade: o plano existe e tem volume
    expect(r.dias.flatMap((d) => d.slots).length).toBeGreaterThan(10);
    expect(deficitsDoMotor(r)).toHaveLength(0);
    expect(deficits(a).map((i) => i.texto)).toEqual([]);
    // e a sugestão de TROCA, que nasce do déficit, não aparece na semana de alívio
    expect(a.recomendacoes.some((i) => i.codigo === 'trocar_um_por_outro')).toBe(false);
  });

  for (const [rotulo, fator, ref] of [['rampa 1', 0.5, 16], ['rampa 2', 0.7, 16]] as const) {
    it(`RETOMADA ${rotulo}: motor 0 × crítico 0 (era 0 × 5–6)`, () => {
      const r = plano(perfil(), { semanaCiclo: { semana: 1, retomada: { semana: 1, fator, volumeReferencia: ref } } });
      const a = criticar(r, 1);
      expect(r.dias.flatMap((d) => d.slots).length).toBeGreaterThan(10);
      expect(deficitsDoMotor(r)).toHaveLength(0);
      expect(deficits(a)).toEqual([]);
    });
  }

  it('🔒 NÃO desliga o crítico: o MÁXIMO continua avaliado em deload', () => {
    // Um desenho artificialmente carregado de peito, na semana de deload: o teto da fase
    // é menor, então o aviso tem de sair — a supressão é só do mínimo.
    const r = plano(perfil(), { semanaCiclo: { semana: 6 } });
    const peito = r.dias.flatMap((d) => d.slots).find((s) => s.exercicio.grupoPrimario === 'peito')!;
    const dias: DiaDoEditor[] = [{ nome: 'Peito', exercicios: Array(8).fill(peito.exercicio), series: Array(8).fill(4) }];
    const a = avaliarSemana(dias, {
      semana: 6, nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 60,
      faixaSemanal: r.faixaVolumeSemana!, faseVolume: 'deload',
    });
    expect(a.avisos.some((i) => i.codigo === 'acima_do_maximo'), 'o teto sumiu junto com o piso').toBe(true);
  });

  it('🔒 os demais avisos continuam: puxar < empurrar segue sendo dito em deload', () => {
    const r = plano(perfil(), { semanaCiclo: { semana: 6 } });
    const empurrar = r.dias.flatMap((d) => d.slots).find((s) => s.exercicio.padraoMovimento === 'empurrar')!;
    const dias: DiaDoEditor[] = [{ nome: 'Só empurrar', exercicios: [empurrar.exercicio], series: [2] }];
    const a = avaliarSemana(dias, {
      semana: 6, nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 60,
      faixaSemanal: r.faixaVolumeSemana!, faseVolume: 'deload',
    });
    expect(a.avisos.some((i) => i.codigo === 'puxar_menor_que_empurrar')).toBe(true);
  });
});

describe('🔒 as semanas NORMAIS não mudaram', () => {
  for (const semana of [1, 2, 3, 4, 5] as const) {
    it(`S${semana}: motor e crítico declaram os MESMOS déficits`, () => {
      const r = plano(perfil(), { semanaCiclo: { semana } });
      const a = criticar(r, semana);
      expect(deficits(a).length).toBe(deficitsDoMotor(r).length);
    });
  }

  it('o déficit por corte de TEMPO continua sendo dito pelos dois', () => {
    const r = plano(perfil({ tempoPorSessaoMin: 30 } as never), { semanaCiclo: { semana: 3 } });
    const a = avaliarSemana(comoEditor(r), {
      semana: 3, nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado',
      faixaSemanal: r.faixaVolumeSemana!, faseVolume: r.faseVolume!,
    });
    expect(deficitsDoMotor(r).length, 'anti-vacuidade: sem déficit nada é provado').toBeGreaterThan(0);
    expect(deficits(a).length).toBe(deficitsDoMotor(r).length);
    expect(r.avisos.some((x) => /Para caber em 30 min/.test(x)), 'a causa do corte sumiu').toBe(true);
  });

  it('sem `faixaSemanal` o crítico volta ao comportamento de sempre (compat)', () => {
    const r = plano(perfil(), { semanaCiclo: { semana: 3 } });
    const comFaixa = criticar(r, 3);
    const semFaixa = avaliarSemana(comoEditor(r), {
      semana: 3, nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado',
    });
    expect(semFaixa.placar).toEqual(comFaixa.placar);
  });
});

describe('🔒 D16 — o fato do crítico casa com o do motor no editor', () => {
  it('mesma semana, mesmo grupo, mesmo limiar e mesmo valor', () => {
    const r = plano(perfil({ tempoPorSessaoMin: 30 } as never), { semanaCiclo: { semana: 3 } });
    const a = avaliarSemana(comoEditor(r), {
      semana: 3, nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado',
      faixaSemanal: r.faixaVolumeSemana!, faseVolume: r.faseVolume!,
    });
    const fatos = r.fatosCobertura ?? [];
    expect(fatos.length, 'anti-vacuidade: sem fato do motor nada casa').toBeGreaterThan(0);
    for (const fato of fatos.filter((f) => f.causa === 'orcamento')) {
      const par = deficits(a).find((i) => i.fato
        && i.fato.grupo === fato.grupo && i.fato.semana === fato.semana
        && i.fato.escopo === fato.escopo && i.fato.metrica === fato.metrica
        && i.fato.limiar === fato.limiar && i.fato.alvo === fato.alvo && i.fato.valor === fato.valor);
      expect(par, `o fato de ${fato.grupo} não casou — a supressão de duplicata falharia`).toBeTruthy();
    }
  });
});
