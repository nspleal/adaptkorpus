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
  /**
   * 🔴 L-04 (revisão independente 15/09) — A TAUTOLOGIA SAIU.
   *
   * A etapa 3 tinha trocado `expect(r.duracaoIncompativel ?? false).toBe(false)` por
   * `.toBe(r.resultadoGeracao?.tipo === 'INCOMPATIVEL')` — verdadeiro POR CONSTRUÇÃO, já que
   * o montador atribui o booleano exatamente a partir do discriminante. O que se cobra agora
   * é a propriedade que a troca apagou: `INCOMPATIVEL` não é rótulo. Quando ele aparece,
   * algum dia tem de exceder o teto MEDIDO pela fórmula canônica; quando não aparece, nenhum
   * dia pode exceder. Os dois ramos são exercidos pela grade (anti-vacuidade abaixo).
   */
  it('toda rotina gerada carrega duracaoDias, uma por dia, CALCULADO e coerente com o teto medido', () => {
    let certificados = 0; let incompativeis = 0;
    for (const over of GRID) {
      const p = perfil(over);
      const r = rotina(p);
      const teto = p.tempoPorSessaoMin * 60;
      expect(r.duracaoDias, JSON.stringify(over)).toBeDefined();
      expect(r.duracaoDias!.length).toBe(r.dias.length);
      expect(r.fatosReducao, JSON.stringify(over)).toBeDefined();
      expect(r.fatosReducao!.slotsAntes, JSON.stringify(over)).toBe(r.fatosReducao!.slotsDepois);
      for (const d of r.duracaoDias!) expect(d.estadoCalculo, JSON.stringify(over)).toBe('CALCULADO');
      const excedem = r.duracaoDias!.filter((d) => (d.duracaoMaximaEstimadaSegundos ?? 0) > teto);
      if (r.resultadoGeracao?.tipo === 'INCOMPATIVEL') {
        incompativeis += 1;
        expect(excedem.length, `${JSON.stringify(over)}: INCOMPATIVEL sem nenhum dia acima do teto medido`).toBeGreaterThan(0);
      } else {
        certificados += 1;
        // O gerador nunca ENTREGA um plano acima do limite sem dizer: reduz antes, se preciso.
        expect(excedem.map((d) => d.duracaoMaximaEstimadaSegundos), `${JSON.stringify(over)}: dia acima do teto sem INCOMPATIVEL`).toEqual([]);
        for (const d of r.duracaoDias!) expect(d.estadoLimite, JSON.stringify(over)).toBe('DENTRO_DO_LIMITE');
      }
    }
    expect(certificados, 'a grade não produziu nenhum plano dentro do teto').toBeGreaterThan(0);
    expect(incompativeis, 'a grade não produziu nenhum INCOMPATIVEL — o outro ramo não foi exercido').toBeGreaterThan(0);
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

describe('C1 gerador · o HOLD isométrico é TRANSPORTADO ao plano (§1 / fixture 3)', () => {
  it('plano CUSTOM com prancha (e7) transporta holdSeg ao slot; a certificação não é HOLD_AUSENTE', () => {
    // isométricos não são escolhidos pelo gerador (o alocador prefere core não-isométrico por
    // tier/id); o caminho real de um isométrico é o plano do usuário.
    const rotinaCustom = { dias: [{ nome: 'Core', exercicioIds: ['e7', 'e1'] }] };
    const r = rotina(perfil({ rotinaCustom } as never));
    const prancha = r.dias.flatMap((d) => d.slots).find((s) => s.exercicio.id === 'e7');
    expect(prancha, 'prancha não entrou no plano custom').toBeDefined();
    expect(prancha!.holdSeg, 'holdSeg NÃO transportado ao slot isométrico').toBe(40);
    const somentePrancha = avaliarDuracaoResistida([prancha!], perfil().nivelExperiencia, 3600);
    expect(somentePrancha.componentes?.execucaoSegundos).toBe((prancha!.series ?? 0) * 40);
    const semHold = avaliarDuracaoResistida([{ ...prancha!, holdSeg: undefined }], perfil().nivelExperiencia, 3600);
    expect(semHold.estadoCalculo).toBe('NAO_AVALIADO');
    expect(semHold.motivosNaoAvaliados.join(' ')).toMatch(/HOLD_AUSENTE/);
    for (const d of r.duracaoDias ?? []) expect(d.motivosNaoAvaliados.join(' ')).not.toMatch(/HOLD_AUSENTE/);
  });
  it('nenhum plano gerado (sem isométrico) reporta HOLD_AUSENTE', () => {
    for (const over of [{}, { tempoPorSessaoMin: 45 }, { nivelExperiencia: 'avancado' as const, diasDisponiveis: 6, tempoPorSessaoMin: 75 }]) {
      const r = rotina(perfil(over));
      for (const d of r.duracaoDias!) expect(d.motivosNaoAvaliados.join(' ')).not.toMatch(/HOLD_AUSENTE/);
    }
  });
});

/**
 * 🔴 D2 (2026-09-10) — o VEÍCULO mudou, a propriedade não. A ausência de séries era produzida
 * pelo deload (semana 6), e isso era o defeito: agora a semana 6 anota séries reduzidas e é
 * certificada como as outras cinco. O produtor de ausência que RESTA é o caminho v1 — chamar
 * o montador **sem `semanaCiclo`** —, e é sobre ele que a convergência continua sendo cobrada:
 * nem o gerador nem o crítico inventam piso quando o dado não existe.
 */
describe('C1 gerador · convergência na AUSÊNCIA de dados (o motor não inventa) (§5.6/§8.1)', () => {
  it('sem semanaCiclo o motor não anota séries ⇒ gerador e crítico convergem em NAO_AVALIADO', () => {
    const p = perfil({ tempoPorSessaoMin: 60, diasDisponiveis: 4 });
    const r = montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, undefined);
    expect(r.duracaoDias, 'a certificação existe mesmo sem a semana do ciclo').toBeDefined();
    const semSerie = r.dias.filter((d) => d.slots.some((s) => s.series == null));
    expect(semSerie.length, 'a fixture assume que o caminho v1 não anota séries').toBeGreaterThan(0);
    r.dias.forEach((d, i) => {
      if (d.slots.some((s) => s.series == null)) {
        // gerador: NAO_AVALIADO (não inventa piso)…
        expect(r.duracaoDias![i]!.estadoCalculo).toBe('NAO_AVALIADO');
        // …e o crítico, sobre os MESMOS slots crus, também se abstém (mesma função, mesmo objeto).
        const comoCritico = d.slots.map((s) => ({ exercicio: s.exercicio, series: s.series, descansoSeg: s.descansoSeg }));
        expect(avaliarDuracaoResistida(comoCritico, p.nivelExperiencia, 3600).estadoCalculo).toBe('NAO_AVALIADO');
      }
    });
  });
});

describe('C1 gerador · o plano do USUÁRIO também é certificado (§5.5 / DF②)', () => {
  it('rotinaCustom carrega duracaoDias (o contrato não quebra no caminho do editor)', () => {
    const base = rotina(perfil());
    const rotinaCustom = { dias: base.dias.slice(0, 2).map((d) => ({ nome: d.nome, exercicioIds: d.slots.map((s) => s.exercicio.id) })) };
    const r = rotina(perfil({ rotinaCustom } as never));
    expect(r.duracaoDias).toBeDefined();
    expect(r.duracaoDias!.length).toBe(r.dias.length);
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
