/**
 * 🔒 `puxar ≥ empurrar` — MONTADOR E CRÍTICO NO MESMO ESCOPO (decisão do autor, 2026-09-16).
 *
 * 🔑 O defeito, medido em `5c3a6c0` no caminho real (`recomputarPlano` → `montarRotina`):
 * o montador media o invariante no BASELINE desde a revisão D-03 de 15/09 — *"o bloco
 * adicional é autorizado a desequilibrar"* — e o crítico do editor contava o plano INTEIRO.
 * Em avançado/massa/3d/75min/S5 com foco no peito o resultado era: motor calado, tela
 * dizendo 🔴 *"Sua semana tem mais exercícios de empurrar (7) que de puxar (5)"*. Duas
 * réguas para o mesmo invariante, e quem falava era a que media o recorte errado.
 *
 * 🔵 A DECISÃO: a comparação é do BASELINE. Os extras identificados do bloco do foco ficam
 * fora **exclusivamente** dela — e continuam sujeitos a MRV ponderado, tempo, recuperação e
 * equipamento, o que a seção ③ verifica explicitamente.
 *
 * 🔒 A isenção usa a PROCEDÊNCIA REAL (`SlotExercicio.extraDoFoco`, marcado pelo montador a
 * partir do próprio Set que decidiu a adição), nunca o grupo nem o nome do exercício: um
 * peitoral do baseline num plano com foco em peito continua contando.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { avaliarSemana, type DiaDoEditor } from './engine/critico';
import { unificarAvisos } from './avisos-unificados';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './engine/alocador';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { RotinaSemanal } from './engine/treino-types';
import type { PadraoMovimento } from './data/types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;

const perfil = (over: Record<string, unknown> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, alergenos: [], preferencia: null, naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'avancado', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 3, tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite',
  treinoDias: DIAS.slice(0, 3), ...over,
}) as unknown as PerfilResumo;

const rotina = (p: PerfilResumo, opcoes: unknown): RotinaSemanal =>
  recomputarPlano(p, opcoes as never).treino.rotina!;

/** O adaptador REAL da tela: leva a procedência do slot ao crítico. */
const paraEditor = (r: RotinaSemanal): DiaDoEditor[] => r.dias.map((d) => ({
  nome: d.nome,
  exercicios: d.slots.map((s) => s.exercicio),
  series: d.slots.map((s) => s.series),
  descansoSeg: d.slots.map((s) => s.descansoSeg),
  holdSeg: d.slots.map((s) => s.holdSeg),
  extraDoFoco: d.slots.map((s) => s.extraDoFoco),
}));

const avaliar = (r: RotinaSemanal, over: Record<string, unknown> = {}) => avaliarSemana(paraEditor(r), {
  nivel: (over.nivelExperiencia as string) ?? 'avancado', objetivo: (over.objetivo as string) ?? 'massa',
  tempoPorSessaoMin: (over.tempoPorSessaoMin as number) ?? 75,
  limiteTempoTreino: (over.limiteTempoTreino as string) ?? 'sem_limite',
  treinoDias: (over.treinoDias as string[]) ?? DIAS.slice(0, 3), semana: 5,
  faixaSemanal: r.faixaVolumeSemana, tetoVolumeSemana: r.tetoVolumeSemana, faseVolume: r.faseVolume,
} as never);

const acusaCritico = (r: RotinaSemanal, over: Record<string, unknown> = {}) =>
  avaliar(r, over).avisos.some((a) => a.codigo === 'puxar_menor_que_empurrar');
const acusaMotor = (r: RotinaSemanal) =>
  r.avisos.some((a) => a.includes('volume de puxar ficou abaixo do de empurrar'));

const conta = (r: RotinaSemanal, p: PadraoMovimento, soBaseline: boolean) =>
  r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p && (!soBaseline || !s.extraDoFoco)).length, 0);

const FOCO = { foco: { grupo: 'peito', compensa: 'ombros', semana: 5 } };
const OPC = { semanaCiclo: { semana: 5 } };

// ── ① O caso medido: 7 empurrar × 5 puxar ────────────────────────────────────
describe('🔴 o caso medido: baseline equilibrado, extras do foco desequilibram', () => {
  const r = () => rotina(perfil(FOCO), OPC);

  it('anti-vacuidade: o plano ENTREGUE tem mesmo 7 empurrar × 5 puxar, e os extras são do foco', () => {
    const p = r();
    // 🔵 6 × 4 desde 2026-09-17 (era 7 × 5): com a faixa desejada menor o alocador dá menos
    // slots. O que o caso mede — plano desequilibrado, baseline equilibrado — é o mesmo.
    // A seleção por função muda a quantidade, não a propriedade: extras desequilibram
    // o plano inteiro; o baseline mantém puxar >= empurrar, sem alerta indevido.
    expect(conta(p, 'puxar', false)).toBeGreaterThan(0);
    expect(conta(p, 'empurrar', false), 'o cenário deixou de reproduzir o caso').toBeGreaterThan(conta(p, 'puxar', false));
    const extras = p.dias.flatMap((d) => d.slots.filter((s) => s.extraDoFoco));
    expect(extras.length, 'sem extras marcados o caso não prova nada').toBeGreaterThan(0);
    // 🔒 A marca vem do bloco, não do grupo: os extras têm de estar no `blocoFoco` publicado.
    const publicados = new Set((p.blocoFoco?.adicionais ?? []).map((a) => a.exercicioId));
    for (const e of extras) expect(publicados.has(e.exercicio.id), `${e.exercicio.id} marcado sem estar no bloco`).toBe(true);
  });

  it('o BASELINE está equilibrado — e é ele que o invariante mede', () => {
    const p = r();
    expect(conta(p, 'empurrar', true)).toBeGreaterThan(0);
    expect(conta(p, 'puxar', true)).toBeGreaterThanOrEqual(conta(p, 'empurrar', true));
  });

  it('🔑 nenhum alerta indevido: nem o motor nem o crítico acusam', () => {
    const p = r();
    expect(acusaMotor(p), 'o motor acusou um desequilíbrio que o baseline não tem').toBe(false);
    expect(acusaCritico(p, FOCO), 'o crítico acusou um desequilíbrio que o baseline não tem').toBe(false);
  });

  it('🔒 nada foi removido nem reordenado para "consertar" a avaliação', () => {
    const p = r();
    // O desequilíbrio do PLANO continua existindo: o que mudou foi o recorte medido, não o plano.
    expect(conta(p, 'empurrar', false)).toBeGreaterThan(conta(p, 'puxar', false));
    // E o baseline sai idêntico ao plano SEM foco — ids e séries, dia a dia.
    const sem = rotina(perfil(), OPC);
    const extras = new Set(p.dias.flatMap((d) => d.slots.filter((s) => s.extraDoFoco).map((s) => s.exercicio.id)));
    const soBaseline = (x: RotinaSemanal) => x.dias.map((d) => `${d.diaId}:${d.slots
      .filter((s) => !extras.has(s.exercicio.id)).map((s) => `${s.exercicio.id}x${s.series}`).sort().join(',')}`);
    expect(soBaseline(p)).toEqual(soBaseline(sem));
  });
});

// ── ② O desequilíbrio REAL continua sendo acusado ────────────────────────────
describe('🔒 baseline realmente desequilibrado continua recebendo alerta', () => {
  /** Desenho só de empurrar: não há extra nenhum, e todo exercício conta. */
  const soEmpurrar = () => {
    const auto = rotina(perfil(), OPC);
    const ids = auto.dias.flatMap((d) => d.slots).filter((s) => s.padrao === 'empurrar')
      .slice(0, 4).map((s) => s.exercicio.id);
    expect(ids.length, 'o seed precisa de exercícios de empurrar').toBeGreaterThan(2);
    return rotina(perfil({ rotinaCustom: { origem: 'usuario', dias: [
      { nome: 'A', diaId: 'seg', exercicioIds: ids }, { nome: 'B', diaId: 'ter', exercicioIds: ids },
    ] } }), OPC);
  };

  it('o crítico acusa, com os números', () => {
    const p = soEmpurrar();
    expect(conta(p, 'puxar', false)).toBe(0);
    expect(acusaCritico(p)).toBe(true);
  });

  it('o motor acusa pelo mesmo recorte', () => {
    expect(acusaMotor(soEmpurrar())).toBe(true);
  });

  it('🔒 UMA voz: `unificarAvisos` suprime a linha do motor pelo FATO, não pela frase', () => {
    const p = soEmpurrar();
    const av = avaliar(p);
    const u = unificarAvisos(p, av);
    expect(u.avisosMotor.some((a) => a.includes('volume de puxar ficou abaixo')), 'sobraram duas falas').toBe(false);
    expect(u.suprimidos.map((s) => s.porque).join(' ')).toMatch(/puxar_maior_igual_empurrar/);
    // 🔒 A decisão é por dado: as duas frases são DIFERENTES de propósito.
    const doMotor = p.avisos.find((a) => a.includes('volume de puxar ficou abaixo'))!;
    const doCritico = av.avisos.find((a) => a.codigo === 'puxar_menor_que_empurrar')!.texto;
    expect(doMotor).not.toBe(doCritico);
  });

  it('sem crítico na tela, a linha do motor FICA (nada some por falta de interlocutor)', () => {
    const p = soEmpurrar();
    expect(unificarAvisos(p, null).avisosMotor.some((a) => a.includes('volume de puxar ficou abaixo'))).toBe(true);
  });
});

// ── ③ Os extras continuam sujeitos a TODAS as outras regras ──────────────────
describe('🔒 a isenção vale SÓ para esta comparação', () => {
  it('os extras continuam dentro do MRV ponderado', () => {
    const p = rotina(perfil(FOCO), OPC);
    const pond = creditoPonderadoDaSemana(p.dias.flatMap((d) => d.slots));
    // 🔵 O teto é POR GRUPO desde 2026-09-17: cheio para quem está em foco, máximo automático
    // para os demais. `faixaVolumeSemana.max` virou o ALVO desejado e não serve de limite.
    const t = p.tetoVolumeSemana!;
    const teto = (g: string) => (t.gruposEmFoco.includes(g as never) ? t.cheio : t.semFoco);
    expect(GRUPOS_GRANDES.filter((g) => (pond.get(g) ?? 0) > teto(g))).toEqual([]);
  });

  it('os extras continuam respeitando o equipamento do perfil', () => {
    const p = rotina(perfil({ ...FOCO, equipamento: 'nenhum', treinoDias: DIAS.slice(0, 3) }), OPC);
    for (const d of p.dias) for (const s of d.slots) expect(s.exercicio.local).toBe('casa_sem');
  });

  it('os extras continuam sujeitos ao tempo: com limite curto o bloco cede primeiro', () => {
    const curto = rotina(perfil({ ...FOCO, tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado' }), OPC);
    const largo = rotina(perfil(FOCO), OPC);
    const extras = (r: RotinaSemanal) => r.dias.reduce((n, d) => n + d.slots.filter((s) => s.extraDoFoco).length, 0);
    expect(extras(curto)).toBeLessThanOrEqual(extras(largo));
  });

  it('a marca NÃO isenta do placar: os extras contam no volume por grupo', () => {
    const com = rotina(perfil(FOCO), OPC);
    const sem = rotina(perfil(), OPC);
    const peito = (r: RotinaSemanal) => creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots)).get('peito') ?? 0;
    expect(peito(com), 'o bloco do foco sumiu da conta de volume').toBeGreaterThan(peito(sem));
  });
});

// ── ④ Sem procedência, a avaliação de hoje é preservada ──────────────────────
describe('🔒 desenho manual sem procedência: tudo conta, como antes', () => {
  it('a marca nunca é deduzida do grupo focado — um peitoral do baseline conta', () => {
    const p = rotina(perfil(FOCO), OPC);
    const peitoraisBaseline = p.dias.flatMap((d) => d.slots)
      .filter((s) => s.exercicio.grupoPrimario === 'peito' && !s.extraDoFoco);
    // ⚠️ ANTI-VACUIDADE: o plano focado precisa MESMO ter peitoral de baseline.
    expect(peitoraisBaseline.length, 'sem peitoral de baseline o caso não prova nada').toBeGreaterThan(0);
    expect(conta(p, 'empurrar', true), 'o baseline perdeu empurrar por causa do grupo focado').toBe(conta(rotina(perfil(), OPC), 'empurrar', true));
  });

  it('o desenho da pessoa não recebe marca nenhuma', () => {
    const auto = rotina(perfil(FOCO), OPC);
    const dias = auto.dias.map((d) => ({ nome: d.nome, diaId: d.diaId, exercicioIds: d.slots.map((s) => s.exercicio.id) }));
    const custom = rotina(perfil({ ...FOCO, rotinaCustom: { origem: 'usuario', dias } }), OPC);
    expect(custom.dias.flatMap((d) => d.slots).some((s) => s.extraDoFoco), 'o desenho herdou procedência que não tem').toBe(false);
  });
});

// ── ⑤ O editor: mesma semana, mesmo veredito nas duas telas ──────────────────
describe('🔴 abrir "Montar meu treino" não muda o veredito da mesma semana', () => {
  /**
   * ⚠️ Caso medido no QA desta correção. Ao abrir o editor, o plano volta ao motor como
   * `rotinaCustom` — e o caminho custom não monta bloco nenhum, então o MONTADOR conta os 7
   * empurrar e emite a linha dele. O crítico, que recebe a procedência por id via `doPlano`,
   * conta 5 × 5 e fica calado. Duas telas, a mesma semana, vereditos opostos.
   */
  const abrirNoEditor = () => {
    const auto = rotina(perfil(FOCO), OPC);
    const editaveis = doPlano(auto.dias, DIAS.slice(0, 3), undefined, undefined);
    const extras = editaveis.flatMap((d) => d.extrasDoFoco ?? []);
    const prev = rotina(perfil({ ...FOCO, rotinaCustom: paraRotinaCustom(editaveis) }), OPC);
    const dias: DiaDoEditor[] = prev.dias.map((d) => ({
      nome: d.nome, exercicios: d.slots.map((s) => s.exercicio), series: d.slots.map((s) => s.series),
      descansoSeg: d.slots.map((s) => s.descansoSeg), holdSeg: d.slots.map((s) => s.holdSeg),
      extraDoFoco: d.slots.map((s) => extras.includes(s.exercicio.id)),
    }));
    return { prev, extras, avaliacao: avaliarSemana(dias, {
      nivel: 'avancado', objetivo: 'massa', tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite',
      treinoDias: DIAS.slice(0, 3), semana: 5, faixaSemanal: prev.faixaVolumeSemana, faseVolume: prev.faseVolume,
    } as never) };
  };

  it('`doPlano` carrega a procedência do plano de origem', () => {
    const auto = rotina(perfil(FOCO), OPC);
    const editaveis = doPlano(auto.dias, DIAS.slice(0, 3), undefined, undefined);
    const extras = editaveis.flatMap((d) => d.extrasDoFoco ?? []);
    expect(extras.length, 'a procedência não chegou ao editor').toBeGreaterThan(0);
    const publicados = new Set((auto.blocoFoco?.adicionais ?? []).map((a) => a.exercicioId));
    for (const id of extras) expect(publicados.has(id), `${id} não é do bloco`).toBe(true);
  });

  it('o crítico do editor mede o BASELINE e não acusa', () => {
    const { avaliacao } = abrirNoEditor();
    const auto = rotina(perfil(FOCO), OPC);
    expect(avaliacao.medidas.puxarEmpurrar).toEqual({ escopo: 'baseline', puxar: conta(auto, 'puxar', true), empurrar: conta(auto, 'empurrar', true) });
    expect(avaliacao.avisos.some((a) => a.codigo === 'puxar_menor_que_empurrar')).toBe(false);
  });

  it('🔑 e a linha do MOTOR, que mediu sem procedência, não sobra na tela', () => {
    const { prev, avaliacao } = abrirNoEditor();
    // ⚠️ ANTI-VACUIDADE: o motor precisa MESMO ter emitido — senão nada foi suprimido.
    expect(prev.avisos.some((a) => a.includes('volume de puxar ficou abaixo')), 'o motor não emitiu: o caso mudou').toBe(true);
    const u = unificarAvisos(prev, avaliacao);
    expect(u.avisosMotor.some((a) => a.includes('volume de puxar ficou abaixo')), 'duas telas, dois vereditos').toBe(false);
    expect(u.suprimidos.map((s) => s.porque).join(' ')).toMatch(/procedência do bloco/);
  });

  it('🔒 a supressão é ESTREITA: sem medição do crítico, a linha do motor fica', () => {
    const { prev, avaliacao } = abrirNoEditor();
    const semMedida = { recomendacoes: avaliacao.recomendacoes, avisos: avaliacao.avisos };
    expect(unificarAvisos(prev, semMedida).avisosMotor.some((a) => a.includes('volume de puxar ficou abaixo'))).toBe(true);
  });

  it('🔒 e não engole desequilíbrio REAL: com o crítico medindo 0 × 6, a fala continua', () => {
    const auto = rotina(perfil(), OPC);
    const ids = auto.dias.flatMap((d) => d.slots).filter((s) => s.padrao === 'empurrar').slice(0, 4).map((s) => s.exercicio.id);
    const p = rotina(perfil({ rotinaCustom: { origem: 'usuario', dias: [
      { nome: 'A', diaId: 'seg', exercicioIds: ids }, { nome: 'B', diaId: 'ter', exercicioIds: ids }] } }), OPC);
    const av = avaliar(p);
    expect(av.medidas.puxarEmpurrar.puxar).toBe(0);
    const u = unificarAvisos(p, av);
    // O motor some porque o CRÍTICO diz o mesmo com os números — e a fala do crítico fica.
    expect(u.avisosMotor.some((a) => a.includes('volume de puxar ficou abaixo'))).toBe(false);
    expect(av.avisos.some((a) => a.codigo === 'puxar_menor_que_empurrar')).toBe(true);
  });
});
