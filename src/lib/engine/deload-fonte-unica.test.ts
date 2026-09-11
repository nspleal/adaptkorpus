import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recomputarPlano } from '@/lib/plano';
import { DELOAD_REDUCAO_VOLUME } from './treino-constants';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { SemanaCiclo } from './treino-types';

/**
 * 🔴 D2 + D9 (diagnóstico 2026-09-10, §6.3 e §6.1) — UMA autoridade sobre séries, UMA redução.
 *
 * O defeito medido no SHA `34b2ede`: a semana 6 saía do montador com **zero séries anotadas**
 * (`resultadoGeracao = NAO_AVALIADO_ENTREGAVEL`, um motivo `"séries ausente"` por slot, todo
 * `duracaoDias` em `NAO_AVALIADO`) — e quem decidia o número exibido era `lib/series-treino.ts ·
 * seriesDoSlot`, com **regra própria de deload** (`ceil(base/2)` ≈ −50 %), diferente da regra
 * registrada no cofre (`DELOAD_REDUCAO_VOLUME = 0.45`, banda −40–50 %).
 *
 * 🔒 A regra vigente NÃO foi alterada: a constante é a mesma e `aplicarDeload` (que já existia,
 * já era testada e **não tinha nenhum chamador de produção**) passou a ser o único ponto onde a
 * redução acontece. Este teste trava as duas metades: o motor anota séries nas 6 semanas, e a
 * tela não tem uma segunda régua.
 */

const base = (o: Record<string, unknown> = {}): PerfilResumo => ({
  sexo: 'masculino', idade: 30, alturaCm: 178, pesoKg: 80,
  nivelAtividade: 'moderado', objetivo: 'massa',
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qui', 'sab'], tempoPorSessaoMin: 60,
  alergenos: [], preferencia: null, naoCurto: [], pratosCansados: [], favoritos: [], ...o,
} as unknown as PerfilResumo);

const SEMANAS = [1, 2, 3, 4, 5, 6] as const;

function rotinaDaSemana(semana: SemanaCiclo, perfil = base()) {
  const r = recomputarPlano(perfil, { semanaCiclo: { semana } }).treino.rotina;
  expect(r, `semana ${semana} não gerou rotina`).toBeTruthy();
  return r!;
}

const totalSeries = (r: { dias: { slots: { series?: number }[] }[] }) =>
  r.dias.reduce((n, d) => n + d.slots.reduce((m, s) => m + (s.series ?? 0), 0), 0);

describe('D2 — o motor anota séries e certifica a duração nas SEIS semanas do mesociclo', () => {
  it.each(SEMANAS)('semana %i: todo slot tem série decidida pelo motor', (semana) => {
    const r = rotinaDaSemana(semana);
    const semSerie = r.dias.flatMap((d, di) =>
      d.slots.filter((s) => s.series == null).map((s) => `dia ${di}: ${s.exercicio.id}`));
    expect(semSerie, `slots sem série na semana ${semana}`).toEqual([]);
  });

  it.each(SEMANAS)('semana %i: nenhum motivo "séries ausente" no resultado da geração', (semana) => {
    const rg = rotinaDaSemana(semana).resultadoGeracao;
    const motivos = rg?.tipo === 'NAO_AVALIADO_ENTREGAVEL' ? rg.motivos : [];
    expect(motivos.filter((m) => /s[ée]ries? ausente/i.test(m)), `semana ${semana}`).toEqual([]);
  });

  it.each(SEMANAS)('semana %i: a duração de todo dia é CALCULADA (nada fica NAO_AVALIADO)', (semana) => {
    const r = rotinaDaSemana(semana);
    expect(r.duracaoDias?.length, `semana ${semana} sem duracaoDias`).toBeGreaterThan(0);
    for (const [i, d] of (r.duracaoDias ?? []).entries()) {
      expect(d.estadoCalculo, `semana ${semana}, dia ${i}: ${d.motivosNaoAvaliados.join(' | ')}`).toBe('CALCULADO');
    }
  });
});

describe('D2 — a redução do deload é aplicada UMA vez, na banda registrada no cofre', () => {
  /**
   * Ancorado na FONTE, não na implementação: `motor-treino-mesociclo-v2` (2026-07-08) registra
   * "deload agendado na semana 6, universal, −40–50 % do volume". A asserção é a banda inteira —
   * se alguém trocar o ponto de 45 % por outro dentro dela, isto continua verde; se alguém
   * aplicar a redução DUAS vezes (≈ −70 %) ou nenhuma, cai em vermelho.
   */
  it('a semana 6 corta entre 40 % e 50 % do volume da semana 5', () => {
    const s5 = totalSeries(rotinaDaSemana(5));
    const s6 = totalSeries(rotinaDaSemana(6));
    expect(s5, 'semana 5 sem volume — a medição não vale').toBeGreaterThan(0);
    const corte = 1 - s6 / s5;
    expect(corte, `semana 5 = ${s5} séries, semana 6 = ${s6} (corte ${(corte * 100).toFixed(1)} %)`)
      .toBeGreaterThanOrEqual(0.4);
    expect(corte, `semana 5 = ${s5} séries, semana 6 = ${s6} (corte ${(corte * 100).toFixed(1)} %)`)
      .toBeLessThanOrEqual(0.5);
  });

  it('a rampa das semanas 1–5 não regrediu (monótona não decrescente, semana 6 abaixo de todas)', () => {
    const totais = SEMANAS.map((s) => totalSeries(rotinaDaSemana(s)));
    for (let i = 1; i < 5; i += 1) {
      expect(totais[i]!, `semana ${i + 1} (${totais[i]}) < semana ${i} (${totais[i - 1]})`)
        .toBeGreaterThanOrEqual(totais[i - 1]!);
    }
    expect(Math.min(...totais.slice(0, 5)), `semana 6 = ${totais[5]}`).toBeGreaterThan(totais[5]!);
  });

  it('a rotina marca a semana 6 como deload (a tela lê daqui, não deriva por conta)', () => {
    expect(rotinaDaSemana(6).semana).toMatchObject({ numero: 6, deload: true });
    expect(rotinaDaSemana(5).semana).toMatchObject({ numero: 5, deload: false });
  });

  /** A constante continua a do cofre — este teste falha se alguém "ajustar o percentual". */
  it('DELOAD_REDUCAO_VOLUME segue em 0,45 (ponto da banda −40–50 %)', () => {
    expect(DELOAD_REDUCAO_VOLUME).toBe(0.45);
  });
});

/* ══════════════════ D9 — fonte única: a tela não tem régua própria ══════════════════ */

const raiz = (...p: string[]) => join(process.cwd(), ...p);
const semComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

describe('D9 — `seriesDoSlot` não decide deload (call-site, molde de carga-fonte-unica)', () => {
  const fonteSeries = semComentarios(readFileSync(raiz('src', 'lib', 'series-treino.ts'), 'utf8'));

  it('anti-vacuidade: a varredura encontra os consumidores de seriesDoSlot', () => {
    const consumidores = ['src/components/painel/Painel.tsx', 'src/components/painel/SessaoTreino.tsx']
      .filter((arq) => readFileSync(raiz(...arq.split('/')), 'utf8').includes('seriesDoSlot('));
    expect(consumidores.length, 'nenhum consumidor encontrado — o teste passaria por não achar nada')
      .toBeGreaterThanOrEqual(2);
  });

  it('a função não recebe nem aplica bandeira de deload', () => {
    expect(/deload/i.test(fonteSeries), 'seriesDoSlot voltou a conhecer deload').toBe(false);
    expect(/Math\.ceil\s*\(\s*base\s*\/\s*2\s*\)/.test(fonteSeries), 'a régua ceil(base/2) voltou').toBe(false);
  });

  it('nenhum consumidor passa deload para seriesDoSlot', () => {
    for (const arq of ['src/components/painel/Painel.tsx', 'src/components/painel/SessaoTreino.tsx']) {
      const codigo = semComentarios(readFileSync(raiz(...arq.split('/')), 'utf8'));
      for (const m of codigo.matchAll(/seriesDoSlot\(([^)]*)\)/g)) {
        expect(/deload/i.test(m[1]!), `${arq}: seriesDoSlot(${m[1]}) ainda recebe deload`).toBe(false);
      }
    }
  });

  it('a redução de volume do deload só existe no motor (um único ponto no repositório)', () => {
    const produtores = ['src/lib/engine/treino.ts', 'src/lib/engine/treino-montador.ts', 'src/lib/series-treino.ts']
      .filter((arq) => /1\s*-\s*DELOAD_REDUCAO_VOLUME|aplicarDeload\s*\(/.test(
        semComentarios(readFileSync(raiz(...arq.split('/')), 'utf8'))));
    // `treino.ts` define a redução; `treino-montador.ts` a consome. A tela não entra na lista.
    expect(produtores).toEqual(['src/lib/engine/treino.ts', 'src/lib/engine/treino-montador.ts']);
  });
});
