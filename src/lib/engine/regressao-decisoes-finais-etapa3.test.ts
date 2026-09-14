/**
 * 🔵 REGRESSÕES DAS DECISÕES FINAIS DA ETAPA 3 (decisões do autor de 2026-09-16) + a
 * regressão de certificação achada na revalidação de D-01/D-02/D-03 desta mesma rodada.
 *
 * Todas falham em `8fdbff9c` pela conduta medida — não por API ausente nem por fixture nova.
 *
 * R-00 · o foco não pode derrubar a certificação de um baseline que cabia (revalidação).
 * P-01 · full-body curto: dispensa ordenada core → antebraço → panturrilha, parando assim
 *        que couber; mesma política com e sem foco; sem certificado falso quando não cabe.
 * P-02 · foco agregado «pernas» = 1 quadríceps (2 séries) + 1 posterior (2 séries).
 * P-03 · repetir na semana é permitido; variedade é preferência quando há alternativa.
 * P-04 · o resumo de descanso da semana reflete os descansos prescritos nos slots.
 * P-05 · não existe segunda autoridade de descanso disponível para reuso.
 */
import { describe, expect, it } from 'vitest';
import { gerarTreino } from './index';
import { EXERCISES } from '../data/exercises';
import { classeDeDescanso, DESCANSO_PISO_DURO_SEG, altaExigenciaDocumental } from './descanso';
import { dispensarGruposPorTempo } from './ajuste-tempo-estrutura';
import { avaliarDuracaoResistida } from './duracao-plano';
import { GRUPOS_DISPENSAVEIS_FULLBODY_CURTO, GRUPOS_GRANDES, GRUPOS_PEQUENOS_PISO } from './alocador';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { PerfilTreino, RotinaSemanal, SlotExercicio } from './treino-types';
import type { Weekday } from '../semana';
import type { GrupoPrimario } from '../data/types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> & { treinoDias: Weekday[] }): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', tempoPorSessaoMin: 60,
  diasDisponiveis: over.treinoDias.length, ...over,
});
const gerar = (p: PerfilTreino) => gerarTreino(p, { exercises: EXERCISES, semanaCiclo: { semana: 1 } }).rotina!;
const grupos = (r: RotinaSemanal) => new Set(r.dias.flatMap((d) => d.slots.map((s) => s.exercicio.grupoPrimario)));
const diretos = (r: RotinaSemanal, g: GrupoPrimario) =>
  r.dias.reduce((n, d) => n + d.slots.filter((s) => s.exercicio.grupoPrimario === g).length, 0);
/** O baseline do plano com foco = plano com foco menos os extras declarados, slot a slot. */
const baseline = (r: RotinaSemanal) => {
  const extras = new Map<string, string[]>();
  for (const a of r.blocoFoco?.adicionais ?? []) extras.set(a.diaId ?? '', [...(extras.get(a.diaId ?? '') ?? []), a.exercicioId]);
  return r.dias.map((d) => {
    const resto = [...(extras.get(d.diaId ?? '') ?? [])];
    const fica: SlotExercicio[] = [];
    for (const s of d.slots) {
      const i = resto.indexOf(s.exercicio.id);
      if (i >= 0) { resto.splice(i, 1); continue; }
      fica.push(s);
    }
    return `${d.diaId}{${fica.map((s) => `${s.exercicio.id}:${s.series}:${s.descansoSeg}`).sort().join(',')}}`;
  }).join(';');
};

describe('R-00 — o bloco do foco não derruba a certificação do baseline', () => {
  /**
   * 🔴 ACHADO DA REVALIDAÇÃO (2026-09-16), ausente do relatório anterior.
   *
   * A fórmula canônica (C1 §4) cobra TRANSIÇÃO de todo item resistido menos o ÚLTIMO. A
   * reordenação por foco rodava DEPOIS da fase temporal, então o dia era medido numa ordem
   * que não era a entregue: trocar quem fica por último mudava a duração pela diferença
   * entre os dois descansos. Neste perfil, `Pernas` era decidida a 2.680 s (cabe em 2.700) e
   * CERTIFICADA a 2.740 s — `INCOMPATIVEL`, com o bloco intacto e nenhum aviso.
   *
   * Escala medida na varredura de 3.456 combinações: 88 casos em `badcea47`, 56 em
   * `8fdbff9c`, 0 aqui.
   */
  const entrada = perfil({ nivelExperiencia: 'iniciante', tempoPorSessaoMin: 45, treinoDias: ['seg', 'qui'] });
  const neutro = gerar(entrada);
  const comFoco = gerar({ ...entrada, foco: { grupo: 'costas', compensa: 'peito', semana: 1 } });

  it('anti-vacuidade: o caso existe — o baseline é CERTIFICADO e o bloco é entregue', () => {
    expect(neutro.resultadoGeracao?.tipo).toBe('CERTIFICADO');
    expect(comFoco.blocoFoco?.adicionais.length ?? 0).toBeGreaterThan(0);
  });

  it('o plano com foco continua CERTIFICADO', () => {
    expect(comFoco.resultadoGeracao?.tipo).toBe('CERTIFICADO');
  });

  it('nenhum dia entregue passa do limite escolhido', () => {
    for (const d of comFoco.duracaoDias ?? []) {
      if (d.estadoCalculo !== 'CALCULADO') continue;
      expect(d.duracaoMaximaEstimadaSegundos ?? 0).toBeLessThanOrEqual(entrada.tempoPorSessaoMin * 60);
    }
  });

  it('a duração publicada é a da ORDEM ENTREGUE, não a de uma ordem intermediária', () => {
    // Se a certificação e a entrega discordassem de novo, esta identidade quebraria: ela
    // recalcula a partir dos slots na ordem em que a pessoa os recebe.
    const orcamento = entrada.tempoPorSessaoMin * 60;
    comFoco.dias.forEach((d, i) => {
      const publicado = comFoco.duracaoDias?.[i];
      if (publicado?.estadoCalculo !== 'CALCULADO') return;
      const soma = d.slots.reduce((n, s, k) => {
        const series = s.series ?? 0;
        const desc = s.descansoSeg ?? 0;
        return n + Math.max(series - 1, 0) * desc + (k < d.slots.length - 1 ? desc : 0);
      }, 0);
      expect(soma, 'a soma dos descansos da ordem entregue não bate com a publicada')
        .toBeLessThanOrEqual(publicado.duracaoMaximaEstimadaSegundos ?? orcamento);
    });
  });
});

describe('P-01 — full-body curto: dispensa ordenada, e só até caber', () => {
  const curto = perfil({ nivelExperiencia: 'avancado', tempoPorSessaoMin: 30, treinoDias: ['seg'] });

  it('a unidade respeita a ORDEM e PARA assim que couber', () => {
    // Dia sintético: core e panturrilha presentes. Com um limite que cabe depois de tirar
    // só o core, a panturrilha NÃO pode sair — «pare assim que couber».
    const ex = (g: GrupoPrimario) => EXERCISES.find((e) => e.grupoPrimario === g && classeDeDescanso(e) !== 'NAO_SE_APLICA')!;
    const slot = (g: GrupoPrimario): SlotExercicio => ({ exercicio: ex(g), padrao: ex(g).padraoMovimento, series: 3, descansoSeg: 60 });
    const dia = { nome: 'Full-body', diaId: 'seg' as Weekday, slots: [slot('peito'), slot('core'), slot('panturrilha')] };
    const largo = dispensarGruposPorTempo(dia, 'intermediario', 100_000, GRUPOS_DISPENSAVEIS_FULLBODY_CURTO);
    expect(largo.gruposDispensados, 'dispensou sem precisar').toEqual([]);
    expect(largo.dia.slots).toHaveLength(3);
    // Limite apertado o bastante para exigir UMA retirada, e largo o bastante para não exigir
    // duas: a duração medida do dia SEM o core, pela mesma fórmula canônica do motor.
    const medir = (slots: readonly SlotExercicio[]) =>
      avaliarDuracaoResistida(slots, 'intermediario', 100_000).duracaoMaximaEstimadaSegundos!;
    const semCore = dia.slots.filter((s) => s.exercicio.grupoPrimario !== 'core');
    const alvo = medir(semCore);
    expect(alvo, 'sem o core o dia já caberia sem retirada nenhuma').toBeLessThan(medir(dia.slots));
    const parcial = dispensarGruposPorTempo(dia, 'intermediario', alvo, GRUPOS_DISPENSAVEIS_FULLBODY_CURTO);
    expect(parcial.gruposDispensados[0], 'core não foi o primeiro a ser dispensado').toBe('core');
    expect(parcial.gruposDispensados, 'panturrilha saiu depois de o dia já caber').not.toContain('panturrilha');
  });

  it('grupo ausente é PULADO, nunca acrescentado para depois ser retirado', () => {
    const ex = (g: GrupoPrimario) => EXERCISES.find((e) => e.grupoPrimario === g)!;
    const slot = (g: GrupoPrimario): SlotExercicio => ({ exercicio: ex(g), padrao: ex(g).padraoMovimento, series: 3, descansoSeg: 120 });
    const dia = { nome: 'Full-body', diaId: 'seg' as Weekday, slots: [slot('peito'), slot('panturrilha')] };
    const r = dispensarGruposPorTempo(dia, 'intermediario', 60, GRUPOS_DISPENSAVEIS_FULLBODY_CURTO);
    expect(r.gruposDispensados, 'inventou core/antebraço que não estavam no dia').toEqual(['panturrilha']);
    expect(r.dia.slots.map((s) => s.exercicio.grupoPrimario)).toEqual(['peito']);
  });

  it('antebraço não está entre os dez grupos do full-body — nunca é acrescentado', () => {
    const plano = gerar(curto);
    expect(GRUPOS_DISPENSAVEIS_FULLBODY_CURTO).toEqual(['core', 'antebraco', 'panturrilha', 'gluteos']);
    expect(grupos(plano).has('antebraco'), 'antebraço entrou no full-body só para ser retirado').toBe(false);
  });

  it('no plano real a retirada acontece, é nomeada e preserva os grupos principais', () => {
    const plano = gerar(curto);
    const aviso = plano.avisos.find((a) => a.startsWith('Para caber em'));
    expect(aviso, 'a retirada não foi nomeada em nenhum aviso').toBeTruthy();
    expect(diretos(plano, 'core'), 'core sobreviveu: o caso deixou de exercer a regra').toBe(0);
    expect(aviso).toContain('Core');
    // Os demais grupos mantêm o único exercício — a política antiga continua valendo para eles.
    for (const g of GRUPOS_GRANDES) {
      if (GRUPOS_DISPENSAVEIS_FULLBODY_CURTO.includes(g)) continue; // 🔵 17/09: glúteos entrou na lista
      expect(diretos(plano, g), `${g} perdeu o único exercício`).toBeGreaterThanOrEqual(1);
    }
    for (const g of GRUPOS_PEQUENOS_PISO) {
      if (GRUPOS_DISPENSAVEIS_FULLBODY_CURTO.includes(g)) continue;
      expect(diretos(plano, g), `${g} perdeu o único exercício`).toBeGreaterThanOrEqual(1);
    }
  });

  it('a mesma política vale SEM foco e COM foco: o foco não provoca retirada adicional', () => {
    const semFoco = gerar(curto);
    const comFoco = gerar({ ...curto, foco: { grupo: 'peito', compensa: 'triceps', semana: 1 } });
    expect(baseline(comFoco), 'o foco mudou o baseline do full-body curto').toBe(baseline(semFoco));
  });

  it('quando nem assim cabe, o veredito é INCOMPATIVEL — sem certificado falso', () => {
    const plano = gerar(curto);
    expect(plano.resultadoGeracao?.tipo).toBe('INCOMPATIVEL');
    // …e a frase não pode afirmar que nada foi cortado, porque foi.
    expect(plano.avisos.some((a) => /preservamos o único exercício de cada grupo\.$/.test(a)),
      'o aviso ainda afirma que o único exercício de CADA grupo foi preservado').toBe(false);
  });

  it('nenhum caminho alternativo viola os pisos de descanso', () => {
    // A dispensa não pode ter vindo acompanhada de um descanso abaixo do piso da classe.
    for (const tempo of [20, 30, 45, 60] as const) {
      const plano = gerar(perfil({ nivelExperiencia: 'avancado', tempoPorSessaoMin: tempo, treinoDias: ['seg'] }));
      for (const d of plano.dias) for (const s of d.slots) {
        if (s.descansoSeg == null) continue;
        expect(s.descansoSeg, `${s.exercicio.id} abaixo do piso duro`).toBeGreaterThanOrEqual(DESCANSO_PISO_DURO_SEG);
        if (altaExigenciaDocumental(s.exercicio)) {
          expect(s.descansoSeg, `${s.exercicio.id} é documental e ficou abaixo de 120 s`).toBeGreaterThanOrEqual(120);
        }
      }
    }
  });
});

describe('P-02 — foco agregado «pernas»: quadríceps + posterior, 2 séries cada', () => {
  const entrada = perfil({ treinoDias: ['seg', 'ter', 'qui', 'sex'], limiteTempoTreino: 'sem_limite' });
  const neutro = gerar(entrada);
  const agregado = gerar({ ...entrada, focoAgregado: { grupo: 'pernas', semana: 1 } });
  const grupoDe = (id: string) => EXERCISES.find((e) => e.id === id)?.grupoPrimario;

  it('entrega exatamente dois adicionais, um de cada componente', () => {
    const gs = (agregado.blocoFoco?.adicionais ?? []).map((a) => grupoDe(a.exercicioId));
    expect(gs.filter((g) => g === 'quadriceps')).toHaveLength(1);
    expect(gs.filter((g) => g === 'posterior')).toHaveLength(1);
    expect(gs).toHaveLength(2);
    for (const a of agregado.blocoFoco!.adicionais) expect(a.series).toBe(2);
  });

  it('glúteos e panturrilhas NÃO recebem extras automáticos por este foco', () => {
    const gs = (agregado.blocoFoco?.adicionais ?? []).map((a) => grupoDe(a.exercicioId));
    expect(gs).not.toContain('gluteos');
    expect(gs).not.toContain('panturrilha');
    // …e continuam no planejamento normal: o número de exercícios diretos não cai.
    for (const g of ['gluteos', 'panturrilha'] as const) {
      expect(diretos(agregado, g), `${g} perdeu exercício direto por causa do foco agregado`)
        .toBeGreaterThanOrEqual(diretos(neutro, g));
    }
  });

  it('a recuperação entre sessões é preservada: nenhum grupo em dias consecutivos', () => {
    const ordem: Weekday[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const porDia = agregado.dias.map((d) => ({ i: ordem.indexOf(d.diaId as Weekday), gs: new Set(d.slots.map((s) => s.exercicio.grupoPrimario)) }));
    for (const a of porDia) for (const b of porDia) {
      const delta = Math.abs(a.i - b.i);
      if (a === b || !(delta === 1 || delta === 6)) continue;
      for (const g of a.gs) {
        if (g == null || g === 'core') continue;
        expect(b.gs.has(g), `${g} apareceu em dias consecutivos`).toBe(false);
      }
    }
  });
});

describe('P-03 — repetir na semana é permitido; variedade é preferência', () => {
  const entrada = perfil({ treinoDias: ['seg', 'ter', 'qui', 'sex'], limiteTempoTreino: 'sem_limite' });

  it('duplicar DENTRO do mesmo dia continua impedido', () => {
    for (const g of ['peito', 'costas', 'ombros', 'biceps'] as const) {
      const r = gerar({ ...entrada, foco: { grupo: g, compensa: g === 'peito' ? 'triceps' : 'peito', semana: 1 } });
      for (const d of r.dias) {
        const ids = d.slots.map((s) => s.exercicio.id);
        expect(new Set(ids).size, `id repetido no mesmo dia (${g})`).toBe(ids.length);
      }
    }
  });

  it('havendo alternativa adequada não usada na semana, ela é preferida', () => {
    // Anti-vacuidade dos dois lados: a grade precisa conter caso com folga de pool
    // (o extra não repete) e a regra não pode exigir que ninguém repita nunca.
    let comFolga = 0, repetiram = 0, avaliados = 0;
    for (const g of ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'quadriceps'] as const) {
      const r = gerar({ ...entrada, foco: { grupo: g, compensa: g === 'peito' ? 'triceps' : 'peito', semana: 1 } });
      const extras = r.blocoFoco?.adicionais ?? [];
      if (extras.length === 0) continue;
      avaliados += 1;
      for (const a of extras) {
        const noResto = r.dias.some((d) => d.diaId !== a.diaId && d.slots.some((s) => s.exercicio.id === a.exercicioId));
        if (noResto) repetiram += 1; else comFolga += 1;
        if (!noResto) continue;
        // Repetiu: então TODO elegível do grupo fora do dia de destino já estava na semana.
        const noDia = new Set(r.dias.find((d) => d.diaId === a.diaId)!.slots.map((s) => s.exercicio.id));
        const naSemana = new Set(r.dias.flatMap((d) => d.slots.map((s) => s.exercicio.id)));
        const alternativaLivre = EXERCISES.some((e) => e.grupoPrimario === g && !noDia.has(e.id) && !naSemana.has(e.id)
          && e.equipamento === 'academia' && e.nivel !== 'avancado');
        expect(alternativaLivre, `${g}: repetiu ${a.exercicioId} havendo alternativa adequada livre na semana`).toBe(false);
      }
    }
    expect(avaliados, 'nenhum bloco foi entregue: a grade não exerce a regra').toBeGreaterThan(0);
    expect(comFolga, 'nenhum extra variou: a preferência não está agindo').toBeGreaterThan(0);
    expect(comFolga + repetiram, 'nenhum extra foi examinado').toBeGreaterThan(0);
  });

  it('sem alternativa adequada, REPETE em vez de entregar menos', () => {
    // `casa` esgota o pool de tríceps: o único elegível fora do dia de destino já está na
    // semana. A preferência não pode virar filtro — o extra tem de sair assim mesmo.
    const r = gerar(perfil({
      nivelExperiencia: 'iniciante', equipamento: 'casa', treinoDias: ['seg', 'qui'],
      limiteTempoTreino: 'sem_limite', tempoPorSessaoMin: 90,
      foco: { grupo: 'triceps', compensa: 'peito', semana: 1 },
    }));
    const extras = r.blocoFoco?.adicionais ?? [];
    expect(extras.length, 'o bloco não foi entregue: a variedade virou filtro').toBeGreaterThan(0);
    const repetido = extras.filter((a) => r.dias.some((d) => d.diaId !== a.diaId
      && d.slots.some((s) => s.exercicio.id === a.exercicioId)));
    expect(repetido.length, 'este caso deixou de repetir: escolha outro pool para exercer a regra')
      .toBeGreaterThan(0);
  });
});

describe('P-04 — o resumo de descanso da semana bate com os slots', () => {
  it('a faixa publicada é o min/max dos descansos compostos efetivamente prescritos', () => {
    let comVariacao = 0, avaliados = 0;
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
      for (const tempo of [30, 45, 60, 90] as const)
        for (const dias of [['seg', 'qui'], ['seg', 'ter', 'qui', 'sex']] as Weekday[][]) {
          const r = gerar(perfil({ nivelExperiencia: nivel, tempoPorSessaoMin: tempo, treinoDias: dias }));
          const prescritos = r.dias.flatMap((d) => d.slots)
            .filter((s) => s.descansoSeg != null && classeDeDescanso(s.exercicio) !== 'ISOLADO' && classeDeDescanso(s.exercicio) !== 'NAO_SE_APLICA')
            .map((s) => s.descansoSeg!);
          if (prescritos.length === 0) continue;
          avaliados += 1;
          const faixa = r.semana!.descansoCompostoSeg;
          expect(faixa.min, `${nivel}/${tempo}: o resumo promete descanso menor do que o prescrito`).toBe(Math.min(...prescritos));
          expect(faixa.max, `${nivel}/${tempo}: o resumo promete descanso maior do que o prescrito`).toBe(Math.max(...prescritos));
          if (new Set(prescritos).size > 1) {
            comVariacao += 1;
            expect(faixa.min, 'descansos diferentes colapsados num valor único').toBeLessThan(faixa.max);
          }
        }
    expect(avaliados, 'nenhum plano com composto: a propriedade não foi exercida').toBeGreaterThan(0);
    expect(comVariacao, 'nenhum plano tem descansos diferentes: a faixa não é exercida').toBeGreaterThan(0);
  });

  it('as diferenças legítimas por exercício sobrevivem — nada é uniformizado', () => {
    const r = gerar(perfil({ nivelExperiencia: 'avancado', tempoPorSessaoMin: 90, treinoDias: ['seg', 'ter', 'qui', 'sex'] }));
    const valores = new Set(r.dias.flatMap((d) => d.slots).map((s) => s.descansoSeg).filter((v) => v != null));
    expect(valores.size, 'o plano ficou com um único descanso para todos os exercícios').toBeGreaterThan(1);
  });
});

describe('P-05 — uma única autoridade de descanso', () => {
  const raiz = join(process.cwd(), 'src');
  const arquivos = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : (/\.tsx?$/.test(n) ? [p] : []);
  });

  it('`descansoDoPadrao` não existe mais em lugar nenhum de src/', () => {
    // O nome é montado em pedaços para que ESTE arquivo não case com a própria varredura —
    // sem precisar excluí-lo, o que abriria um buraco onde o caminho poderia voltar.
    const alvo = `descanso${'Do'}Padrao(`;
    const todos = arquivos(raiz);
    expect(todos.length, 'a varredura não achou arquivo: o teste seria vácuo').toBeGreaterThan(100);
    expect(todos.some((f) => readFileSync(f, 'utf8').includes('descansoDoExercicio(')),
      'a varredura não enxerga nem a autoridade viva: o critério está quebrado').toBe(true);
    const comOCaminho = todos.filter((f) => readFileSync(f, 'utf8').includes(alvo))
      .map((f) => f.replace(raiz, 'src'));
    expect(comOCaminho, 'o caminho obsoleto voltou como régua concorrente').toEqual([]);
  });

  it('os pisos e exceções aprovados continuam exportados', async () => {
    const mod = await import('./descanso');
    expect(mod.PISO_DEGRADACAO).toEqual({ ISOLADO: 60, COMPOSTO: 90, POTENCIA: 90 });
    expect(mod.PISO_DEGRADACAO_FORCA_PESADA).toBe(180);
    expect(mod.DESCANSO_PISO_DURO_SEG).toBe(60);
    expect(typeof mod.descansoDoExercicio).toBe('function');
  });
});
