/**
 * 🔒 C1 — o GERADOR certifica o plano final pela fórmula canônica (§5.5), reusa a mesma função
 * do crítico (§8.1) e reduz exercícios para caber quando preciso (§6 + override 2026-08-20).
 *
 * 🔑 Achado medido: o reduce-to-fit é uma REDE DE SEGURANÇA dormente nos perfis alcançáveis — a
 * tabela de slots (`orcamentoSlotsDoDia`) escala com o tempo e a reserva dos pequenos mantém todo
 * dia MISTO (isolados baratos), então nenhum perfil real estoura o limite operacional. Por isso a
 * máquina de redução é provada em PEÇAS (predicado + alavanca + preservação de invariante), e a
 * certificação é provada de ponta a ponta.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina, precisaReduzir, type OpcoesSemana } from './treino-montador';
import { avaliarDuracaoResistida } from './duracao-plano';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino, RotinaSemanal } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (o: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...o,
});
const rotina = (p: PerfilTreino, over?: Partial<OpcoesSemana>) =>
  montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, undefined, { semana: 3, feedbackGrupos: new Map(), ...over });
const supino = EXERCISES.find((e) => e.id === 'e1')!;

const GRID: Array<Partial<PerfilTreino>> = [
  {},
  { tempoPorSessaoMin: 30 },
  { tempoPorSessaoMin: 75, nivelExperiencia: 'avancado', diasDisponiveis: 6 },
  { modoForca: true, nivelExperiencia: 'avancado', objetivo: 'emagrecimento', diasDisponiveis: 2, tempoPorSessaoMin: 75 },
];

describe('C1 gerador · certificação do plano final (§5.5)', () => {
  it('toda rotina gerada carrega duracaoDias, uma por dia, CALCULADO e dentro do limite operacional', () => {
    for (const over of GRID) {
      const r = rotina(perfil(over));
      expect(r.duracaoDias, JSON.stringify(over)).toBeDefined();
      expect(r.duracaoDias!.length).toBe(r.dias.length);
      for (const d of r.duracaoDias!) {
        expect(d.estadoCalculo, JSON.stringify(over)).toBe('CALCULADO');
        // o gerador nunca ENTREGA um plano acima do limite operacional (reduz antes, se preciso).
        expect(['DENTRO_DO_LIMITE', 'DENTRO_DA_TOLERANCIA']).toContain(d.estadoLimite);
      }
      expect(r.duracaoIncompativel ?? false, `rede de segurança disparou em ${JSON.stringify(over)}`).toBe(false);
    }
  });
});

describe('C1 gerador · MESMA função do crítico sobre o MESMO plano (§8.1)', () => {
  it('avaliar o dia gerado dá o mesmo resultado montando os slots como o crítico monta', () => {
    const r = rotina(perfil({ tempoPorSessaoMin: 75, nivelExperiencia: 'avancado', diasDisponiveis: 6 }));
    const orc = 75 * 60;
    for (const d of r.dias) {
      const viaGerador = avaliarDuracaoResistida(d.slots, 'avancado', orc);
      // o crítico monta {exercicio, series, descansoSeg} a partir do MESMO dia:
      const comoCritico = d.slots.map((s) => ({ exercicio: s.exercicio, series: s.series, descansoSeg: s.descansoSeg }));
      const viaCritico = avaliarDuracaoResistida(comoCritico, 'avancado', orc);
      expect(viaCritico).toEqual(viaGerador);
    }
  });
});

describe('C1 gerador · o predicado de redução (§6)', () => {
  const fake = (slots: Array<{ series: number; descansoSeg: number }>): RotinaSemanal => ({
    diasForcaAgendados: 1, diasCardioRecuperacao: 0, split: 'x', diasCardio: [], cardio: { tipo: 'sessoes_semana', min: 0, max: 0 } as never, avisos: [],
    dias: [{ nome: 'D', slots: slots.map((s) => ({ padrao: 'empurrar' as const, exercicio: supino, series: s.series, descansoSeg: s.descansoSeg })) }],
  });
  it('um dia que estoura o limite operacional ⇒ precisaReduzir true', () => {
    // 8×(4 séries @180): MIN 5600 > 4080 (=3600+480) ⇒ ACIMA.
    expect(precisaReduzir(fake(Array.from({ length: 8 }, () => ({ series: 4, descansoSeg: 180 }))), 'avancado', 3600)).toBe(true);
  });
  it('um dia que cabe ⇒ precisaReduzir false', () => {
    expect(precisaReduzir(fake([{ series: 3, descansoSeg: 60 }, { series: 3, descansoSeg: 60 }]), 'avancado', 3600)).toBe(false);
  });
});

describe('C1 gerador · a alavanca de redução preserva invariantes (§7.7)', () => {
  const contaPadrao = (r: RotinaSemanal, p: string) =>
    r.dias.reduce((n, d) => n + d.slots.filter((s) => s.exercicio.padraoMovimento === p).length, 0);
  const totalSlots = (r: RotinaSemanal) => r.dias.reduce((n, d) => n + d.slots.length, 0);

  it('budgetSlotsOverride menor produz MENOS (ou =) slots e mantém puxar ≥ empurrar', () => {
    const p = perfil({ tempoPorSessaoMin: 60, diasDisponiveis: 4, nivelExperiencia: 'avancado' });
    const cheio = rotina(p);
    const reduzido = rotina(p, { budgetSlotsOverride: 3 });
    expect(totalSlots(reduzido)).toBeLessThanOrEqual(totalSlots(cheio));
    expect(totalSlots(reduzido)).toBeGreaterThan(0);
    // a invariante do alocador sobrevive à redução (é reexecução completa, não corte do último slot):
    expect(contaPadrao(reduzido, 'puxar')).toBeGreaterThanOrEqual(contaPadrao(reduzido, 'empurrar'));
    // e o core continua presente (cobertura preservada):
    expect(reduzido.dias.some((d) => d.slots.some((s) => s.exercicio.padraoMovimento === 'core'))).toBe(true);
  });
});

describe('C1 gerador · custoDia não mantém aritmética própria (§5.4 / mutação §8.4)', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/engine/treino-montador.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  it('o custoDia projeta itens e chama a fórmula canônica (sem soma paralela sPlan×(40+…))', () => {
    expect(src).toMatch(/avaliarDuracaoSessao\(/); // planejamento roteado pela canônica
    expect(src).toMatch(/avaliarDuracaoResistida\(/); // certificação do plano final
    expect(/sPlan\s*\*\s*\(\s*40\s*\+/.test(src), 'a aritmética antiga sPlan×(40+descanso) voltou').toBe(false);
  });
});
