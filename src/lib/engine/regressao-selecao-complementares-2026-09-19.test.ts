/**
 * 🔒 REGRESSÃO — seleção por referência e complementares (decisão do autor, 2026-09-19).
 *
 * O relato: "Gerar novo treino" entregava, em Prioridades 4d, um dia de peito com duas
 * variações de crucifixo e uma flexão sem supino, um dia de pernas com três variações de
 * stiff e nenhuma flexora, um dia de braços com CINCO exercícios de tríceps, e core em dias
 * que já tinham outro complementar.
 *
 * A fixture identificada reproduz a estrutura do relato em `origin/main` (6cc5ec2): três dos
 * quatro dias saem byte a byte iguais ao relatado (Costas + Bíceps, Pernas, Braços + Core), e
 * o quarto difere em três exercícios por preferências locais que não estão na fixture.
 *
 * Casos de defeito e de preservação estão separados. A prova contra a base é registrada
 * por identidade; testes de preservação não precisam falhar na base.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina, poolElegivel } from './treino-montador';
import { creditoPonderadoDaSemana } from './alocador';
import { diretosDoExercicio, tracosMecanicos } from './cobertura-anatomica';
import { COMPLEMENTARES, ehComplementar, ehDiaDePernas, ehReferencia, funcaoDe } from './selecao-referencia';
import type { GrupoPrimario } from '../data/types';
import type { FlagsSaude } from './types';
import type { DiaTreino, PerfilTreino, RotinaCustom, RotinaSemanal, SemanaCiclo } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [], diasDisponiveis: 4,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado', ...over,
});
const montar = (p: PerfilTreino, semana: SemanaCiclo = 3, extra: Record<string, unknown> = {}): RotinaSemanal =>
  montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana, feedbackGrupos: new Map(), ...extra });

/** A fixture do relato (identificada por varredura; ver o registro da tarefa). */
const RELATADO: PerfilTreino = perfil({
  divisaoPreferida: 'prioridades', tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite',
  focoAgregado: { grupo: 'bracos', semana: 1 }, variacaoTreino: 1,
});

const grupoDe = (d: DiaTreino, g: GrupoPrimario) => d.slots.filter((s) => s.exercicio.grupoPrimario === g);
const funcoes = (d: DiaTreino, g: GrupoPrimario) => grupoDe(d, g).map((s) => funcaoDe(s.exercicio));
const baseline = (d: DiaTreino) => d.slots.filter((s) => !s.extraDoFoco);
const dia = (r: RotinaSemanal, nome: string) => {
  const d = r.dias.find((x) => x.nome === nome);
  if (!d) throw new Error(`dia "${nome}" ausente: ${r.dias.map((x) => x.nome).join(' / ')}`);
  return d;
};

describe('🔴 o caso relatado — Prioridades 4d, intermediário, 75+ , foco agregado em braços, variação 1', () => {
  const r = montar(RELATADO, 5);

  it('peito: um supino entra quando ele é elegível — não duas variações de crucifixo e uma flexão', () => {
    const f = funcoes(dia(r, 'Peito + Ombros'), 'peito');
    expect(f.some((x) => x.startsWith('supino') || x === 'peito/empurrar'), `peito sem supino: ${f.join(', ')}`).toBe(true);
    expect(f.filter((x) => x === 'crucifixo-peito').length).toBeLessThanOrEqual(1);
  });

  it('costas: puxada E remada antes de acumular variantes semelhantes', () => {
    const f = funcoes(dia(r, 'Costas + Bíceps'), 'costas');
    // A cobertura pode compensar uma troca com barra fixa, preservando tração vertical.
    expect(grupoDe(dia(r, 'Costas + Bíceps'), 'costas').some(s => ['e22','e23','e24','e49','e50','e51'].includes(s.exercicio.id))).toBe(true);
    expect(f).toContain('remada-horizontal');
  });

  it('pernas: flexora ao lado do stiff — nunca três stiffs; agachamento/leg press/hack e extensora presentes', () => {
    const pernas = dia(r, 'Pernas');
    const post = funcoes(pernas, 'posterior');
    expect(post.filter((x) => x === 'stiff-terra').length).toBeLessThanOrEqual(1);
    expect(post).toContain('flexora-posterior');
    const quad = funcoes(pernas, 'quadriceps');
    expect(quad).toContain('agachamento-bilateral');
    expect(quad).toContain('quadriceps/isolado');
  });

  it('braços: a dose redundante do caso é consolidada, sem impor teto universal', () => {
    const bracos = dia(r, 'Braços + Core');
    // Sem quota de três: cada slot mantido deve trazer cobertura/traço exclusivo
    // ou ser necessário para conservar a dose dentro do máximo por exercício.
    const ss=baseline(bracos).filter(s=>s.exercicio.grupoPrimario==='triceps');
    expect(ss.length).toBeGreaterThan(1);
    const alvos=(xs:typeof ss)=>new Set(xs.flatMap(s=>[...diretosDoExercicio(s.exercicio.id)]));
    const tracos=(xs:typeof ss)=>new Set(xs.flatMap(s=>[...tracosMecanicos(s.exercicio.id)]));
    const max=prescreverTreino(RELATADO,avaliarGateTreino(RELATADO)).seriesPorExercicio.max;
    for(const slot of ss){
      const outros=ss.filter(s=>s!==slot);
      const perdeAlvo=[...alvos(ss)].some(a=>!alvos(outros).has(a));
      const perdeTraco=[...tracos(ss)].some(a=>!tracos(outros).has(a));
      const faltaDose=outros.length*max<ss.reduce((n,s)=>n+s.series!,0);
      expect(perdeAlvo||perdeTraco||faltaDose,`redundância removível: ${slot.exercicio.id}`).toBe(true);
    }
    // O foco acrescenta só os slots publicados; não inventa exercício de baseline.
    for(const s of grupoDe(bracos,'triceps').filter(s=>s.extraDoFoco))
      expect(r.blocoFoco?.adicionais.some(a=>a.exercicioId===s.exercicio.id)).toBe(true);
  });

  /**
   * 🔵 REANCORADO em 2026-09-20. A redação anterior fotografava a AUSÊNCIA da panturrilha
   * («a sessão tem os sete slots ocupados, todos principais» + o aviso de que ela não entrou)
   * como se fosse contrato. Aquilo era o RESÍDUO que o autor mandou corrigir, não uma regra:
   * por decisão dele de 20/09, em "sem limite de tempo" o dia de pernas recebe um slot além
   * do orçamento, exclusivamente para a panturrilha, sem tirar série de nenhum grupo. O que
   * este `it` cobra segue sendo o mesmo: UM complementar por dia, panturrilha no dia de
   * pernas, antebraço nos superiores, core 2–3×, e nenhum principal retirado.
   * Ver `regressao-triceps-panturrilha-2026-09-20.test.ts`.
   */
  it('complementares: um por dia, panturrilha no dia de pernas e demais nos superiores', () => {
    for (const d of r.dias) {
      const comp = d.slots.filter((s) => ehComplementar(s.exercicio.grupoPrimario));
      expect(comp.length, `${d.nome}: ${comp.map((s) => s.exercicio.grupoPrimario).join(', ')}`).toBeLessThanOrEqual(1);
    }
    // Não retirar principal: os sete slots principais continuam ali; a panturrilha SOMA o oitavo.
    const pernas = dia(r, 'Pernas');
    expect(pernas.slots.filter(s => !ehComplementar(s.exercicio.grupoPrimario))).toHaveLength(8);
    expect(grupoDe(pernas, 'panturrilha')).toHaveLength(1);
    expect(r.avisos.some(a => a.startsWith('Panturrilhas não entrou'))).toBe(false);
    expect(grupoDe(dia(r, 'Costas + Bíceps'), 'antebraco')).toHaveLength(1);
    const core = r.dias.filter((d) => grupoDe(d, 'core').length > 0).length;
    expect(core).toBeGreaterThanOrEqual(2);
    expect(core).toBeLessThanOrEqual(3);
  });

  it('o que não mudou: puxar ≥ empurrar no baseline, nenhum grande acima do teto semanal, determinismo', () => {
    expect(r.avisos.some((a) => a.includes('puxar ficou abaixo'))).toBe(false);
    const c = creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));
    for (const g of ['peito', 'costas', 'quadriceps', 'posterior', 'gluteos', 'ombros'] as const) {
      expect(c.get(g) ?? 0, g).toBeLessThanOrEqual(r.tetoVolumeSemana!.cheio);
    }
    const outra = montar(RELATADO, 5);
    expect(JSON.stringify(outra.dias.map((d) => d.slots.map((s) => [s.exercicio.id, s.series])))).toBe(
      JSON.stringify(r.dias.map((d) => d.slots.map((s) => [s.exercicio.id, s.series]))),
    );
  });
});

/**
 * A grade: divisões de 1 a 7 dias, três níveis, três inventários, tempo curto e 75+, foco,
 * deload e retomada. Propriedades, não fotografias.
 */
const GRADE: Array<{ nome: string; p: PerfilTreino; semana?: SemanaCiclo; extra?: Record<string, unknown> }> = [];
const AGENDAS: Record<number, PerfilTreino['treinoDias']> = {
  1: ['qua'], 2: ['seg', 'qui'], 3: ['seg', 'qua', 'sex'], 4: ['seg', 'ter', 'qui', 'sex'],
  5: ['seg', 'ter', 'qua', 'qui', 'sex'], 6: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], 7: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
};
for (const dias of [1, 2, 3, 4, 5, 6, 7]) {
  for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
    for (const eq of [{ equipamento: 'academia' as const }, { equipamento: 'casa' as const, equipamentosCasa: ['halteres', 'elastico'] as PerfilTreino['equipamentosCasa'] }, { equipamento: 'casa' as const, equipamentosCasa: [] as PerfilTreino['equipamentosCasa'] }]) {
      for (const tempo of [{ tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado' as const }, { tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado' as const }, { tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite' as const }]) {
        GRADE.push({ nome: `${dias}d ${nivel} ${eq.equipamento}${eq.equipamentosCasa ? `[${eq.equipamentosCasa.length}]` : ''} ${tempo.tempoPorSessaoMin}${tempo.limiteTempoTreino === 'sem_limite' ? '+' : ''}`, p: perfil({ diasDisponiveis: dias, treinoDias: AGENDAS[dias], nivelExperiencia: nivel, ...eq, ...tempo }) });
      }
    }
  }
}
const FOCOS: Array<{ nome: string; p: PerfilTreino; semana?: SemanaCiclo; extra?: Record<string, unknown> }> = [
  { nome: 'foco agregado braços 4d', p: perfil({ focoAgregado: { grupo: 'bracos', semana: 1 } }) },
  { nome: 'foco agregado pernas 4d', p: perfil({ focoAgregado: { grupo: 'pernas', semana: 1 } }) },
  { nome: 'foco core 4d', p: perfil({ foco: { grupo: 'core', compensa: 'peito', semana: 1 } }) },
  { nome: 'foco ombros 4d 75+', p: perfil({ foco: { grupo: 'ombros', compensa: 'peito', semana: 1 }, tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite' }) },
  { nome: 'prioridades 4d 60', p: perfil({ divisaoPreferida: 'prioridades' }) },
  { nome: 'superior-inferior 4d 60', p: perfil({ divisaoPreferida: 'superior-inferior' }) },
  { nome: 'deload S6 4d', p: perfil(), semana: 6 },
  { nome: 'retomada 4d', p: perfil(), extra: { retomada: { semana: 1, fator: 0.6, volumeReferencia: 12 } } },
  { nome: 'variação 5 · prioridades', p: perfil({ divisaoPreferida: 'prioridades', variacaoTreino: 5 }) },
  { nome: 'variação 12 · 5d avançado', p: perfil({ diasDisponiveis: 5, treinoDias: AGENDAS[5], nivelExperiencia: 'avancado', variacaoTreino: 12 }) },
];

describe('🔒 propriedades na grade (1–7 dias × níveis × inventários × tempo) e nas fases', () => {
  const casos = [...GRADE, ...FOCOS];
  it('a grade não é vazia (anti-vacuidade)', () => { expect(casos.length).toBeGreaterThan(150); });

  it.each(casos.map((c) => [c.nome, c] as const))('%s — um complementar por dia misto, panturrilha nas pernas e funções complementares', (_n, c) => {
    const r = montar(c.p, c.semana ?? 3, c.extra ?? {});
    const pool = poolElegivel(EXERCISES, c.p, c.p.preferencias);
    for (const d of r.dias) {
      const gruposDoDia = new Set(d.slots.map((s) => s.exercicio.grupoPrimario));
      const diaDisponivel = [...gruposDoDia].every((g) => ehComplementar(g) || g === 'lombar');
      const comp = d.slots.filter((s) => ehComplementar(s.exercicio.grupoPrimario));
      // Um complementar por dia misto, inclusive full-body de um dia.
      if (!diaDisponivel) {
        const distintos = new Set(comp.map((s) => s.exercicio.grupoPrimario));
        expect(distintos.size, `${d.nome}: ${[...distintos].join(', ')}`).toBeLessThanOrEqual(1);
      }
      // Cada complementar entra uma vez por dia; panturrilha só onde há pernas.
      for (const g of COMPLEMENTARES) {
        const n = d.slots.filter((s) => s.exercicio.grupoPrimario === g).length;
        expect(n, `${d.nome}: ${g} ${n}×`).toBeLessThanOrEqual(1);
      }
      if (d.slots.some((s) => s.exercicio.grupoPrimario === 'panturrilha')) {
        expect(ehDiaDePernas([...gruposDoDia].filter((g): g is GrupoPrimario => g != null)), `${d.nome} tem panturrilha sem pernas`).toBe(true);
      }
      /**
       * Complementaridade por função: o dia usa tantas funções DE REFERÊNCIA distintas do grupo
       * quantas o pool oferece (limitado pelo nº de slots). Função fora da lista de referência
       * (pullover, remada invertida sem família) só entra depois de repetir uma referência — por
       * isso não conta aqui. A troca pelo teto de sessão (`Trocamos …`) pode consolidar uma
       * função depois do alocador; nesse plano a tolerância é de uma função.
       */
      for (const g of ['peito', 'costas', 'quadriceps', 'posterior', 'ombros'] as const) {
        const f = baseline(d).filter((s) => s.exercicio.grupoPrimario === g).map((s) => funcaoDe(s.exercicio));
        if (f.length < 3) continue;
        /**
         * As referências que o dia PODIA usar: função com exercício elegível fora do padrão
         * `empurrar` (a trava `puxar ≥ empurrar` pode fechar o empurrar do dia) ou função que o
         * dia de fato usou. Os passes posteriores (teto de sessão, redundância, cobertura) podem
         * consolidar UMA função; o que nunca pode acontecer é o dia inteiro do grupo numa função
         * só quando havia outra referência elegível — o "três stiffs" do relato.
         */
        const elegiveis = pool.filter((e) => e.grupoPrimario === g && e.padraoMovimento !== 'cardio' && ehReferencia(e));
        const referencias = new Set([...elegiveis.filter((e) => e.padraoMovimento !== 'empurrar').map(funcaoDe), ...f]);
        const distintas = new Set(f).size;
        expect(distintas, `${d.nome}: ${g} usou ${[...new Set(f)].join(', ')} com ${[...referencias].join(', ')} elegíveis`).toBeGreaterThanOrEqual(Math.min(f.length, referencias.size) - 1);
      }
    }
    // Antebraço: presente, ou o impedimento é dito (só no automático com 2+ dias).
    if (r.dias.length >= 2) {
      const tem = r.dias.some((d) => d.slots.some((s) => s.exercicio.grupoPrimario === 'antebraco'));
      if (!tem) expect(r.avisos.some((a) => a.startsWith('Antebraço não entrou neste plano:')), r.avisos.join(' | ')).toBe(true);
      const temPant = r.dias.some((d) => d.slots.some((s) => s.exercicio.grupoPrimario === 'panturrilha'));
      if (!temPant) expect(r.avisos.some((a) => a.startsWith('Panturrilhas não entrou neste plano:')), r.avisos.join(' | ')).toBe(true);
    }
  });
});

describe('🔒 gerar, reabrir e atualizar não desmontam a estrutura', () => {
  const comoOEditorEnvia = (r: RotinaSemanal): RotinaCustom => ({
    origem: 'usuario',
    dias: r.dias.map((d) => ({
      nome: d.nome, ...(d.diaId ? { diaId: d.diaId } : {}),
      exercicioIds: d.slots.map((s) => s.exercicio.id),
      seriesPorExercicio: Object.fromEntries(d.slots.filter((s) => s.series != null).map((s) => [s.exercicio.id, s.series!])),
    })),
  });
  it('reabrir o plano no editor e salvar sem editar devolve os mesmos exercícios e séries', () => {
    const r = montar(RELATADO, 5);
    const reaberto = montar({ ...RELATADO, rotinaCustom: comoOEditorEnvia(r) }, 5);
    expect(reaberto.dias.map((d) => d.slots.map((s) => [s.exercicio.id, s.series])))
      .toEqual(r.dias.map((d) => d.slots.map((s) => [s.exercicio.id, s.series])));
  });
  it('a variação de "Gerar novo treino" troca QUAL supino/remada, não a presença deles', () => {
    for (const v of [0, 1, 2, 3, 5, 8]) {
      const r = montar({ ...RELATADO, variacaoTreino: v }, 5);
      const peito = funcoes(dia(r, 'Peito + Ombros'), 'peito');
      expect(peito.some((x) => x.startsWith('supino') || x === 'peito/empurrar'), `v=${v}: ${peito.join(', ')}`).toBe(true);
      const costas = funcoes(dia(r, 'Costas + Bíceps'), 'costas');
      expect(grupoDe(dia(r, 'Costas + Bíceps'), 'costas').some(s => ['e22','e23','e24','e49','e50','e51'].includes(s.exercicio.id)), `v=${v}: tração vertical ausente`).toBe(true);
      expect(costas, `v=${v}`).toContain('remada-horizontal');
      expect(funcoes(dia(r, 'Pernas'), 'posterior').filter((x) => x === 'stiff-terra').length, `v=${v}`).toBeLessThanOrEqual(1);
    }
  });
  it('o desenho manual salvo é intocado: os exercícios da pessoa não são trocados por referência', () => {
    const desenho: RotinaCustom = { origem: 'usuario', dias: [
      { nome: 'Meu A', diaId: 'seg', exercicioIds: ['e80', 'e81', 'e82', 'e14', 'e55'] },
      { nome: 'Meu B', diaId: 'qui', exercicioIds: ['e46', 'e47', 'e48', 'e147'] },
    ] };
    const r = montar({ ...RELATADO, rotinaCustom: desenho }, 5);
    expect(r.dias.map((d) => d.slots.map((s) => s.exercicio.id))).toEqual([['e80', 'e81', 'e82', 'e14', 'e55'], ['e46', 'e47', 'e48', 'e147']]);
  });
});
