import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GrupoEmFoco } from '../../components/painel/Favoritos';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FOCO_DELTA, FOCO_SEMANAS, INTERVALO_MIN_HORAS_MESMO_GRUPO, TRILHOS,
  aplicarFoco, faixaSemanal, focoVigente, maxSemanalSemFoco, mev, mrv, ordenarComFoco,
  tetoSemanalDoGrupo, tetoSeriesGrupoNaSessao, tetoSeriesPorExercicio,
  FOCO_CORE, aplicarFocoCore, folgaDeCore,
} from './trilhos';
import { montarRotina } from './treino-montador';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';

/**
 * 🎛️ v3 · BLOCO B — TRILHOS E FOCO (DF 2026-07-31, cofre §"🎛️ v3 — os trilhos do editor").
 */

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, nivelExperiencia: 'intermediario',
  equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
  ...over,
} as PerfilTreino);

const plano = (p: PerfilTreino, semana = 5) => {
  const presc = prescreverTreino(p, avaliarGateTreino(p));
  return montarRotina(presc, p, EXERCISES, new Set(), { semana } as never);
};
/** Séries semanais por grupo, contando só a série DIRETA (`grupoPrimario`) — o trilho 6. */
const seriesPorGrupo = (r: ReturnType<typeof plano>) => {
  const m = new Map<string, number>();
  for (const d of r.dias)
    for (const sl of d.slots) {
      const g = sl.exercicio.grupoPrimario;
      if (g) m.set(g, (m.get(g) ?? 0) + (sl.series ?? 0));
    }
  return m;
};

describe('🔒 os 7 trilhos carregam procedência e versão', () => {
  it('todo trilho tem rótulo legível — sem ele a auditoria herda a confusão', () => {
    const nomes = Object.keys(TRILHOS);
    expect(nomes).toHaveLength(7);
    for (const [nome, t] of Object.entries(TRILHOS)) {
      expect(['evidencia', 'politica'], `${nome} sem procedência válida`).toContain(t.procedencia);
      expect(t.versao, `${nome} sem versão`).toMatch(/^v\d+\.\d+$/);
      expect(t.desde, `${nome} sem data`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.origem.length, `${nome} sem origem declarada`).toBeGreaterThan(0);
    }
  });

  it('os defaults batem com a tabela §1.2 do cofre', () => {
    expect(tetoSeriesPorExercicio('iniciante')).toBe(3);
    expect(tetoSeriesPorExercicio('intermediario')).toBe(4);
    expect(tetoSeriesPorExercicio('avancado')).toBe(4);
    /**
     * 🔵 SUBSTITUIÇÃO EXPLÍCITA (decisão do autor 2026-09-17). A redação anterior era:
     *   «MRV de massa: 12 / 16 / 20» · «mev intermediário = 13» · «16 ÷ 2× ≈ 8».
     * Ela lia `volumePorGrupoSemana.max` como teto — e a decisão separou os dois papéis:
     * a faixa passou a ser o ALVO desejado (6–10 · 10–14 · 12–18) e o teto virou tabela
     * própria (13 · 19 · 21), com máximo automático de teto − 3 para quem não está em foco.
     */
    expect([mrv('iniciante', 'massa'), mrv('intermediario', 'massa'), mrv('avancado', 'massa')]).toEqual([13, 19, 21]);
    expect([maxSemanalSemFoco('iniciante', 'massa'), maxSemanalSemFoco('intermediario', 'massa'), maxSemanalSemFoco('avancado', 'massa')]).toEqual([10, 16, 18]);
    expect(mev('intermediario', 'massa')).toBe(10);
    expect([faixaSemanal('iniciante', 'massa'), faixaSemanal('intermediario', 'massa'), faixaSemanal('avancado', 'massa')])
      .toEqual([{ min: 6, max: 10 }, { min: 10, max: 14 }, { min: 12, max: 18 }]);
    // 🔵 Séries do grupo na SESSÃO, em hipertrofia: 12 PONDERADAS, fixo — a frequência não divide.
    expect(tetoSeriesGrupoNaSessao('intermediario', 'massa', 2)).toBe(12);
    expect(tetoSeriesGrupoNaSessao('iniciante', 'massa', 3)).toBe(12);
    expect(tetoSeriesGrupoNaSessao('avancado', 'massa', 4)).toBe(12);
    // 🔒 Fora da hipertrofia nada mudou: teto semanal ÷ frequência, na banda de sempre.
    expect(mrv('intermediario', 'saude')).toBe(12);
    expect(maxSemanalSemFoco('intermediario', 'saude')).toBe(12);
    expect(tetoSeriesGrupoNaSessao('intermediario', 'saude', 2)).toBe(6);
    expect(INTERVALO_MIN_HORAS_MESMO_GRUPO).toBe(48);
    expect(FOCO_DELTA).toEqual({ min: 2, max: 4 });
    expect(FOCO_SEMANAS).toEqual({ min: 4, max: 6 });
  });
});

/**
 * 🔴 O TESTE DE REGRESSÃO DA CONTRADIÇÃO (error-hunt de 2026-07-31).
 *
 * O MRV é teto DURO e o foco soma +2–4. Massa/intermediário com peito já em **16** — o topo —
 * e foco no peito daria **18–20 > 16**. As duas regras não podiam valer juntas.
 * 🔒 Resolução travada: **o foco sobe até o MRV e para ali. Quem já está no topo ganha ORDEM,
 * não volume.**
 */
describe('🔒 MRV × foco — a contradição, como regressão', () => {
  it('🔴 grupo JÁ NO TOPO: volume inalterado, delta zero, entrega = ordem', () => {
    const teto = mrv('intermediario', 'massa'); // 🔵 19 desde 2026-09-17 (era 16)
    const efeito = aplicarFoco({ alvoBase: teto, alvoCompensaBase: teto, nivel: 'intermediario', objetivo: 'massa' });
    expect(efeito.alvoFocado, 'o foco furou o teto duro').toBe(teto);
    expect(efeito.deltaAplicado).toBe(0);
    expect(efeito.entrega).toBe('ordem');
    // …e o compensador não perde nada quando ninguém ganhou: 1:1 vale nos dois sentidos.
    expect(efeito.alvoCompensado).toBe(teto);
  });

  it('grupo COM folga: sobe, e o compensador cede exatamente o mesmo (1:1)', () => {
    const efeito = aplicarFoco({ alvoBase: 13, alvoCompensaBase: 16, nivel: 'intermediario', objetivo: 'massa' });
    expect(efeito.deltaAplicado).toBe(2);           // o piso do FOCO_DELTA, conservador
    expect(efeito.alvoFocado).toBe(15);
    expect(efeito.alvoCompensado).toBe(14);
    // 🔑 O total não cresce: foco é redistribuição, não aumento com outro nome.
    expect(efeito.alvoFocado + efeito.alvoCompensado).toBe(13 + 16);
  });

  it('a folga até o MRV limita o delta — sobe só o que cabe', () => {
    // 🔵 A base subiu junto com o teto (19): 18 + 4 = 22 → cortado em 19. Antes era 15 + 4 → 16.
    const efeito = aplicarFoco({ alvoBase: 18, alvoCompensaBase: 19, nivel: 'intermediario', objetivo: 'massa', delta: 4 });
    expect(efeito.alvoFocado).toBe(19);
    expect(efeito.deltaAplicado).toBe(1);
    expect(efeito.alvoCompensado).toBe(18);
  });

  it('o MEV do compensador também limita — não se desce abaixo do piso para focar', () => {
    const piso = mev('intermediario', 'massa'); // 🔵 10 desde 2026-09-17 (era 13)
    const efeito = aplicarFoco({ alvoBase: 13, alvoCompensaBase: piso, nivel: 'intermediario', objetivo: 'massa' });
    expect(efeito.deltaAplicado, 'o foco tirou volume de quem já estava no piso').toBe(0);
    expect(efeito.entrega).toBe('ordem');
  });

  it('nenhum nível/objetivo consegue passar do TETO CHEIO, varrendo a tabela inteira', () => {
    /**
     * 🔵 O limite da varredura passou a ser `mrv` (o teto cheio), não `faixa.max` (o alvo
     * desejado). É o que a decisão de 2026-09-17 separou: o grupo EM FOCO pode subir acima do
     * alvo — é para isso que a margem existe — mas nunca acima do teto.
     */
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
      for (const objetivo of ['saude', 'massa', 'emagrecimento'] as const)
        for (const delta of [2, 3, 4]) {
          const faixa = faixaSemanal(nivel, objetivo);
          const teto = mrv(nivel, objetivo);
          for (const base of [faixa.min, faixa.max - 1, faixa.max, teto - 1, teto]) {
            const e = aplicarFoco({ alvoBase: base, alvoCompensaBase: teto, nivel, objetivo, delta });
            expect(e.alvoFocado, `${nivel}/${objetivo} base ${base} +${delta}`).toBeLessThanOrEqual(teto);
            expect(e.alvoCompensado, `${nivel}/${objetivo} compensador abaixo do MEV`).toBeGreaterThanOrEqual(faixa.min);
          }
        }
  });

  /**
   * 🔵 A MARGEM DE 3 É DO GRUPO EM FOCO — regressão da decisão de 2026-09-17.
   *
   * ⚠️ ANTI-VACUIDADE: sem esta asserção, trocar `maxSemanalSemFoco` por `mrv` passaria em
   * todo o resto do arquivo. É ela que prova que os dois números são DIFERENTES em
   * hipertrofia e IGUAIS fora dela.
   */
  it('máximo automático = teto − 3 em hipertrofia, e = teto nos demais objetivos', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      expect(mrv(nivel, 'massa') - maxSemanalSemFoco(nivel, 'massa'), `${nivel}/massa`).toBe(3);
      for (const objetivo of ['saude', 'emagrecimento'] as const) {
        expect(maxSemanalSemFoco(nivel, objetivo), `${nivel}/${objetivo}`).toBe(mrv(nivel, objetivo));
      }
    }
  });

  /** 🔵 A exceção é do GRUPO: quem não foi nomeado para no máximo automático. */
  it('tetoSemanalDoGrupo dá o teto cheio só a quem está em foco', () => {
    const teto = tetoSemanalDoGrupo({ nivel: 'intermediario', objetivo: 'massa', emFoco: ['peito'] });
    expect(teto('peito')).toBe(19);
    expect(teto('ombros'), 'um extra de peito não libera ombros').toBe(16);
    expect(teto('triceps'), 'nem triceps').toBe(16);
  });

  /** 🔵 A fase impõe o MENOR limite — e a margem não é subtraída de novo da dose reduzida. */
  it('o teto da fase corta por cima, sem segunda subtração de 3', () => {
    const teto = tetoSemanalDoGrupo({ nivel: 'intermediario', objetivo: 'massa', emFoco: ['peito'], tetoDaFase: 8 });
    expect(teto('peito')).toBe(8);
    expect(teto('ombros')).toBe(8);
    // 🔴 8, não 5: subtrair 3 da dose já reduzida seria aplicar a margem duas vezes.
    expect(teto('ombros')).not.toBe(5);
  });
});

/**
 * 🔴 A RESSALVA DA 2ª PASSADA: *"vem primeiro na sessão"* sem qualificação inverteria
 * composto → isolado num foco de músculo pequeno, criando **pré-exaustão** por acidente — a
 * técnica que a seção vizinha decidiu não prescrever por default.
 */
describe('🔒 a ordem do foco é DENTRO DA CLASSE — nunca cruza composto → isolado', () => {
  type S = { id: string; classe: 'composto' | 'isolado'; grupo: string };
  const leitura = { classe: (x: S) => x.classe, grupo: (x: S) => x.grupo as never };
  const sessao: S[] = [
    { id: 'c1', classe: 'composto', grupo: 'costas' },
    { id: 'c2', classe: 'composto', grupo: 'peito' },
    { id: 'i1', classe: 'isolado', grupo: 'triceps' },
    { id: 'i2', classe: 'isolado', grupo: 'biceps' },
  ];

  it('🔴 foco num músculo pequeno NÃO o traz para antes dos compostos', () => {
    const fora = ordenarComFoco(sessao, 'biceps' as never, leitura).map((x) => x.id);
    expect(fora.slice(0, 2), 'um isolado subiu para antes dos compostos — isso é pré-exaustão').toEqual(['c1', 'c2']);
    expect(fora).toEqual(['c1', 'c2', 'i2', 'i1']); // sobe só dentro do bloco de isolados
  });

  it('foco num composto ordena entre compostos, sem tocar nos isolados', () => {
    expect(ordenarComFoco(sessao, 'peito' as never, leitura).map((x) => x.id)).toEqual(['c2', 'c1', 'i1', 'i2']);
  });

  it('sem foco, a ordem é a original — byte a byte', () => {
    expect(ordenarComFoco(sessao, undefined, leitura)).toEqual(sessao);
  });

  it('a reordenação é ESTÁVEL: quem não é do grupo focado mantém a ordem relativa', () => {
    const muitos: S[] = [
      { id: 'a', classe: 'composto', grupo: 'costas' },
      { id: 'b', classe: 'composto', grupo: 'pernas' },
      { id: 'c', classe: 'composto', grupo: 'peito' },
      { id: 'd', classe: 'composto', grupo: 'ombros' },
    ];
    expect(ordenarComFoco(muitos, 'peito' as never, leitura).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd']);
  });
});

describe('🔒 o foco tem janela — não se renova sozinho', () => {
  it.each([[1, true], [4, true], [6, true], [7, false], [0, false]])('semana %i vigente=%s', (semana, esperado) => {
    expect(focoVigente({ grupo: 'peito' as never, compensa: 'costas' as never, semana })).toBe(esperado);
  });
  it('sem foco declarado, não há foco', () => {
    expect(focoVigente(undefined)).toBe(false);
  });
});

/**
 * 🔑 E o que fecha o bloco: o PLANO EMITIDO. As asserções acima são de função — a lição da
 * série é que elas passam com a montagem quebrada.
 */
describe('🔒 o foco chega ao PLANO', () => {
  const comFoco = perfil({ foco: { grupo: 'peito' as never, compensa: 'costas' as never, semana: 1 } });

  it('sem foco, o plano é byte-idêntico ao de antes do Bloco B', () => {
    const semFoco = plano(perfil()).dias.flatMap((d) => d.slots.map((s) => `${s.exercicio.id}:${s.series}`));
    const focoForaDaJanela = plano(perfil({ foco: { grupo: 'peito' as never, compensa: 'costas' as never, semana: 9 } }))
      .dias.flatMap((d) => d.slots.map((s) => `${s.exercicio.id}:${s.series}`));
    expect(focoForaDaJanela).toEqual(semFoco);
  });

  it('com foco, o grupo focado vem primeiro dentro da classe em toda sessão que o tem', () => {
    for (const dia of plano(comFoco).dias) {
      const compostos = dia.slots.filter((s) => s.padrao !== 'isolado' && s.padrao !== 'core');
      const idx = compostos.findIndex((s) => s.exercicio.grupoPrimario === 'peito');
      if (idx < 0) continue;
      expect(idx, `${dia.nome}: o peito não veio primeiro entre os compostos`).toBe(0);
    }
  });

  it('autor14/09: só os extras aumentam o volume total', () => {
    const soma = (r: ReturnType<typeof plano>) => [...seriesPorGrupo(r).values()].reduce((a, b) => a + b, 0);
    const com=plano({...comFoco,limiteTempoTreino:'sem_limite'});
    expect(soma(com)).toBe(soma(plano(perfil({limiteTempoTreino:'sem_limite'})))+(com.blocoFoco?.adicionais.reduce((n,a)=>n+a.series,0)??0));
  });

  /**
   * 🔴 L-01 (revisão independente 15/09) — a mesma identidade com tempo LIMITADO, onde o
   * candidato `badcea47` tirava do baseline para acomodar o bloco. O total sobe exatamente o
   * que o bloco entregou, e nenhum grupo fora do foco muda de volume.
   */
  it('tempo LIMITADO: o total sobe só o que o bloco entregou, e ninguém mais muda', () => {
    const soma = (r: ReturnType<typeof plano>) => [...seriesPorGrupo(r).values()].reduce((a, b) => a + b, 0);
    /**
     * 🔵 2026-09-15 — a semana mudou de 5 para 2, e a razão é a correção do relato.
     *
     * Na semana 5 a rampa leva o baseline ao TOPO da banda (16 de 16 em intermediário/massa) e
     * o teto duro barra o bloco — que é justamente o defeito corrigido: antes ele entrava assim
     * mesmo e entregava 20. A identidade "o total sobe só o que o bloco entregou" precisa de
     * uma semana com folga para não ser trivial; a recusa no topo tem caso próprio em
     * `foco-teto-mrv.test.ts`, com a explicação exigida na tela.
     *
     * 🔵 2026-09-19 — a semana desceu de 2 para 1 pela MESMA razão, um degrau antes: com a
     * seleção por execução bilateral e o improviso doméstico fora da academia, o baseline do
     * SELETOR HISTÓRICO já chega ao topo na semana 2 e o bloco fica vazio ali. A semana 1
     * ainda tem folga nos dois seletores, e a identidade volta a ter conteúdo.
     */
    const controle = { nivelExperiencia: 'iniciante' as const, diasDisponiveis: 5, treinoDias: ['seg','ter','qua','qui','sex'] as const, limiteTempoTreino: 'limitado' as const, tempoPorSessaoMin: 60 };
    const sem = plano(perfil({ ...controle, treinoDias: [...controle.treinoDias] }), 1);
    const com = plano({ ...comFoco, ...controle, treinoDias: [...controle.treinoDias] }, 1);
    const entregue = com.blocoFoco?.adicionais.reduce((n, a) => n + a.series, 0) ?? 0;
    expect(entregue, 'bloco vazio — a identidade seria trivial').toBeGreaterThan(0);
    expect(soma(com)).toBe(soma(sem) + entregue);
    const a = seriesPorGrupo(sem); const b = seriesPorGrupo(com);
    const mexidos = [...new Set([...a.keys(), ...b.keys()])].filter((g) => g !== 'peito' && (a.get(g) ?? 0) !== (b.get(g) ?? 0));
    expect(mexidos, `grupos alterados fora do foco: ${mexidos.join(', ')}`).toEqual([]);
  });

  /**
   * 🔵 REANCORADO em 2026-09-15 — a exceção de 14/09 (extras podiam passar do MRV) foi
   * SUBSTITUÍDA pela instrução vigente desta correção: o teto vale inclusive para os extras.
   * A decisão anterior foi deliberada e está preservada como histórico em
   * `etapa3-foco-tempo.test.ts`; aqui o que se cobra é o teto, sem folga de 4.
   */
  it('MRV preservado no baseline E com o bloco do foco — sem exceção', () => {
    const teto = mrv('intermediario', 'massa');
    for (const p of [perfil(), comFoco])
      for (const [grupo, series] of seriesPorGrupo(plano(p)))
        expect(series, `${grupo} passou do teto`).toBeLessThanOrEqual(teto);
  });
});

/**
 * 🔒 O BLOCO B TEM SUPERFÍCIE E EVENTOS — a regra do sucesso simulado, aplicada de novo.
 */
describe('🔒 o foco tem superfície, e ela promete o que o motor cumpre', () => {
  const fonte = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

  it('o seletor existe, escolhe o grupo E o compensador', () => {
    const favs = fonte('src/components/painel/Favoritos.tsx');
    expect(favs).toMatch(/export function GrupoEmFoco/);
    expect(favs, 'sem escolher quem cede, não há 1:1 — e sem 1:1 o foco é aumento geral').toMatch(/Qual grupo cede as séries\?/);
    const editar = fonte('src/components/painel/EditarPerfil.tsx');
    const i = editar.indexOf('<GrupoEmFoco');
    expect(i, 'o seletor não é montado no Editar perfil').toBeGreaterThan(-1);
    const antes = editar.slice(Math.max(0, i - 60), i).trimEnd();
    expect(antes.endsWith('&&') || antes.endsWith('?'), 'o seletor está atrás de uma condição').toBe(false);
  });

  it('copy14/09 explicita adição e restrição temporal', () => {
    const favs = fonte('src/components/painel/Favoritos.tsx');
    const i = favs.indexOf('export function GrupoEmFoco');
    const bloco = favs.slice(i, i + 2200);
    // A janela declarada e a compensação 1:1 aparecem…
    expect(bloco).toMatch(/4 a 6 semanas/);
    expect(bloco).toMatch(/até dois exercícios de duas séries/);
    // …e o caso do teto duro é dito, não escondido.
    expect(bloco, 'a copy some com o caso "já está no topo" — que é a maioria de quem foca')
      .toMatch(/tempo disponível pode reduzir o bloco/i);
  });

  it('compensador só é exigido para core', () => {
    const editar = fonte('src/components/painel/EditarPerfil.tsx');
    expect(editar).toContain("focoGrupo !== 'core' || focoCompensa");
  });

  it('os dois eventos do bloco têm call site', () => {
    const painel = fonte('src/components/painel/Painel.tsx');
    expect(painel).toMatch(/registrarEvento\('foco_ativado'/);
    expect(painel).toMatch(/registrarEvento\('foco_encerrado'/);
    // `entrega` vem do motor, não de um literal — é o campo que carrega o achado.
    expect(painel).toMatch(/entrega: efeito\.entrega/);
  });
});

/**
 * 🔒 FOCO DE CORE — spec travada (DF 2026-08-05, cofre §"Foco de CORE") · `politica · v3.1`.
 *
 * 🔑 A mecânica escolhida entre três: **séries nos slots que JÁ existem**. Zero número novo,
 * zero mudança de montagem — e é isso que deixa a invariante de frequência (2–3×/sem) e a
 * montagem de dias **intocadas por construção**, não por cuidado de quem implementa.
 *
 * 🔴 E a regra que separa core dos demais grupos: **`entrega = 'ordem'` NÃO EXISTE para
 * core.** Com tipicamente 1 slot por sessão, reordenar é INERTE — e entrega inerte é sucesso
 * simulado. Sem folga ⇒ recusa explicada.
 */
describe('🔒 foco de CORE — séries nos slots existentes', () => {
  /**
   * 🔑 Fixture MEDIDA, não inventada — e a medição corrigiu a primeira escolha: em
   * `iniciante/saúde` na **semana 1** o core tem folga (6 de 9), mas TODOS os grupos estão no
   * MEV, então o compensador não pode ceder e a recusa é correta. O aceite 1 precisa de folga
   * nos DOIS lados: **semana 2** → core 7/9 (folga 2) e um compensador que REALMENTE pode
   * ceder. Medido: com `peito` (2 slots, já em 6 = 2×3) o delta é 0 e a recusa é correta; com
   * `costas` (3 slots) o core vai 7→8 e o total fica em 37.
   * *(Varredura: 21 combinações satisfazem isso; esta é a primeira.)*
   *
   * 🔵 FIXTURE REANCORADA (2026-09-19). Com um complementar por dia, o full-body ×3 do
   * iniciante cede o terceiro core à panturrilha (core 2×, no teto por exercício 3 → sem
   * folga). A folga real com 3 slots de core existe onde há três dias de superiores:
   * `avancado/saude/6d`, semana 1 → core 10 de 12 (folga 2) e costas 12 acima do MEV 10.
   */
  /**
   * 🔵 FIXTURE REMEDIDA EM 2026-09-20. Com 5 dias o intermediário passou a receber 5 sessões
   * (antes eram 4 — a agenda era cortada no teto do nível) e a dose de core preenche o dia: a
   * folga que este caso existe para exercitar sumiu DESTE perfil. Varredura de 192 combinações
   * (nível × objetivo × 3–6 dias × 45/60/75/90 min × limite × semana): 13 células ainda têm folga
   * de core E compensador acima do MEV. Esta é a mais próxima da original — só o número de
   * dias muda (5 → 6), com folga de 2 e costas em 12.
   */
  const COM_FOLGA = perfil({ nivelExperiencia: 'intermediario', objetivo: 'massa', diasDisponiveis: 6,treinoDias:['seg','ter','qua','qui','sex','sab'],tempoPorSessaoMin:75,limiteTempoTreino:'limitado' });
  const SEMANA_COM_FOLGA = 1;
  const slotsCore = (r: ReturnType<typeof plano>) => r.dias.flatMap((d) => d.slots).filter((s) => s.exercicio.grupoPrimario === 'core');
  const seriesCore = (r: ReturnType<typeof plano>) => slotsCore(r).reduce((a, s) => a + (s.series ?? 0), 0);
  /** A estrutura da semana: dias, slots e exercícios — tudo menos as séries. */
  const estrutura = (r: ReturnType<typeof plano>) =>
    r.dias.map((d) => ({ nome: d.nome, slots: d.slots.map((s) => s.exercicio.id) }));

  it('a fixture é real: folga no core E no compensador', () => {
    const r = plano(COM_FOLGA, SEMANA_COM_FOLGA);
    expect(slotsCore(r).length).toBeGreaterThan(0);
    const folga=folgaDeCore(slotsCore(r).length,seriesCore(r),COM_FOLGA.nivelExperiencia);
    // The retired selector fills the available core dose; its refusal is checked below.
    if(process.env.ADAPT_TEST_SELETOR_ATUAL==='0')expect(folga).toBe(0);
    else expect(folga).toBeGreaterThan(0);
  });

  it('🔴 aceite 1 — com folga: séries sobem nos slots existentes, ESTRUTURA idêntica', () => {
    const sem = plano(COM_FOLGA, SEMANA_COM_FOLGA);
    const com = plano(perfil({ ...COM_FOLGA, foco: { grupo: 'core' as never, compensa: 'costas' as never, semana: 1 } }), SEMANA_COM_FOLGA);
    if (process.env.ADAPT_TEST_SELETOR_ATUAL === '0') {
      // Sob o seletor histórico (PPL ×2) o core deste perfil não tem folga nos limites do dia:
      // nada é somado, e o plano DIZ isso (decisão do autor de 19/09). A estrutura fica.
      expect(seriesCore(com)).toBe(seriesCore(sem));
      expect(com.avisos).toContain('Foco de core salvo, mas nenhum extra foi aplicado por falta de espaço nos limites do treino (séries por exercício, volume e tempo).');
      expect(estrutura(com)).toEqual(estrutura(sem));
      return;
    }
    expect(seriesCore(com), 'o core não ganhou séries').toBeGreaterThan(seriesCore(sem));
    expect(seriesCore(com) - seriesCore(sem)).toBeLessThanOrEqual(FOCO_DELTA.max);
    // 🔑 Mesmos dias, mesmos slots, mesmos exercícios — só as séries mudaram.
    expect(estrutura(com), 'a montagem da semana mudou — a mecânica tocou o que não devia').toEqual(estrutura(sem));
  });

  it('🔴 aceite 2 — slot no teto do nível não sobe (iniciante 3/3 continua 3)', () => {
    expect(folgaDeCore(3, 9, 'iniciante')).toBe(0);
    const e = aplicarFocoCore({ nSlotsCore: 3, seriesCoreAtuais: 9, alvoCompensaBase: 12, nivel: 'iniciante', objetivo: 'massa' });
    expect(e.aceita).toBe(false);
    // …e nenhum slot do plano real passa do teto por exercício, com foco ou sem.
    const com = plano(perfil({ ...COM_FOLGA, foco: { grupo: 'core' as never, compensa: 'costas' as never, semana: 1 } }), SEMANA_COM_FOLGA);
    for (const s of slotsCore(com))
      expect(s.series ?? 0, 'um slot de core furou o teto por exercício').toBeLessThanOrEqual(tetoSeriesPorExercicio(COM_FOLGA.nivelExperiencia));
  });

  it('🔴 aceite 3 — sem folga: recusa EXPLICADA, com motivo, e plano inalterado', () => {
    const e = aplicarFocoCore({ nSlotsCore: 3, seriesCoreAtuais: 12, alvoCompensaBase: 16, nivel: 'intermediario', objetivo: 'massa' });
    expect(e.aceita).toBe(false);
    expect(e.motivo).toBe('core_sem_folga');
    expect(e.explicacao ?? '', 'recusa sem explicação é recusa silenciosa').not.toBe('');
    expect(e.explicacao).toMatch(/teto de séries do seu nível/i);
    expect(e.deltaAplicado).toBe(0);
    // O plano de quem já está no teto sai IGUAL ao de quem não pediu foco nenhum.
    const base = perfil({ nivelExperiencia: 'intermediario', objetivo: 'massa' });
    const comFoco = perfil({ ...base, foco: { grupo: 'core' as never, compensa: 'costas' as never, semana: 1 } });
    expect(plano(comFoco, 5).dias.flatMap((d) => d.slots.map((s) => `${s.exercicio.id}:${s.series}`)))
      .toEqual(plano(base, 5).dias.flatMap((d) => d.slots.map((s) => `${s.exercicio.id}:${s.series}`)));
  });

  /**
   * ⚠️ ESTE TESTE NASCEU DE UMA MUTAÇÃO SOBREVIVENTE: inflar `slotsCore` no montador passava
   * em tudo. O motivo é sutil — a distribuição trunca no teto real, então nenhum slot fura o
   * limite; mas o COMPENSADOR cede o delta cheio, e o core absorve menos. O 1:1 quebra e o
   * volume semanal ENCOLHE, sem que nada acuse. A soma é a única asserção que enxerga isso.
   */
  it('🔑 core automático soma apenas a dose entregue sem cessão — 216 cenários', () => {
    /**
     * ⚠️ A 1ª escrita usava UM cenário, e três mutações passaram por ela (slots de core
     * inflados · compensador pelo alvo cru · piso real removido). Num único par
     * (compensador, semana) os números fecham por coincidência. O invariante é do PLANO
     * inteiro, então é varrendo que ele se prova.
     */
    const soma = (p: PerfilTreino, semana: number) => plano(p, semana).dias
      .flatMap((d) => d.slots).reduce((a, s) => a + (s.series ?? 0), 0);
    const quebras: string[] = [];
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
      for (const objetivo of ['saude', 'massa', 'emagrecimento'] as const)
        for (const dias of [3, 4] as const)
          for (const semana of [1, 2, 3, 5] as const)
            for (const compensa of ['costas', 'peito', 'quadriceps'] as const) {
              const base = perfil({ nivelExperiencia: nivel, objetivo, diasDisponiveis: dias });
              const comFoco = perfil({ ...base, foco: { grupo: 'core' as never, compensa: compensa as never, semana: 1 } });
              // Uma montagem por lado: a soma e a dose adicional saem do MESMO plano com foco.
              // A 3ª montagem por cenário levava esta varredura a 4,8 s no gate (limite 5 s)
              // e a 6,1 s na suíte completa local — timeout, não defeito do motor.
              const a = soma(base, semana);
              const r = plano(comFoco, semana);
              const b = r.dias.flatMap((d) => d.slots).reduce((n, s) => n + (s.series ?? 0), 0);
              const adicional = r.focoCoreAdicional?.entregues ?? 0;
              if (b !== a + adicional) quebras.push(`${nivel}/${objetivo}/${dias}d/sem${semana}/${compensa}: ${a} → ${b}`);
            }
    expect(quebras, `o foco de core divergiu da dose adicional entregue em ${quebras.length} cenário(s): ${quebras.slice(0, 3).join(' · ')}`).toEqual([]);
  }, 30_000);

  it('🔴 aceite 4 — a FREQUÊNCIA de core não muda em cenário nenhum', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
      for (const objetivo of ['saude', 'massa', 'emagrecimento'] as const)
        for (const dias of [3, 4, 5]) {
          const base = perfil({ nivelExperiencia: nivel, objetivo, diasDisponiveis: dias });
          const comFoco = perfil({ ...base, foco: { grupo: 'core' as never, compensa: 'costas' as never, semana: 1 } });
          // Frequência = em quantas SESSÕES o core aparece.
          const freq = (p: PerfilTreino) => plano(p, 1).dias.filter((d) => d.slots.some((s) => s.exercicio.grupoPrimario === 'core')).length;
          expect(freq(comFoco), `${nivel}/${objetivo}/${dias}d: a frequência de core mudou`).toBe(freq(base));
        }
  });

  it('🔴 aceite 5 — a compensação 1:1 continua, e o compensador é protegido pelo MEV', () => {
    const e = aplicarFocoCore({ nSlotsCore: 3, seriesCoreAtuais: 6, alvoCompensaBase: 10, nivel: 'iniciante', objetivo: 'saude' });
    expect(e.aceita).toBe(true);
    expect(e.alvoCore - 6).toBe(e.deltaAplicado);
    expect(10 - e.alvoCompensado, 'a compensação deixou de ser 1:1').toBe(e.deltaAplicado);
    // Compensador no piso: não se tira dele para focar core.
    const noPiso = aplicarFocoCore({ nSlotsCore: 3, seriesCoreAtuais: 6, alvoCompensaBase: mev('iniciante', 'saude'), nivel: 'iniciante', objetivo: 'saude' });
    expect(noPiso.aceita).toBe(false);
  });

  it('🔴 entrega para core é SEMPRE volume — `ordem` nunca é entregue, logo nunca emitido', () => {
    for (const [slots, series] of [[3, 6], [3, 9], [1, 1], [0, 0]] as const) {
      const e = aplicarFocoCore({ nSlotsCore: slots, seriesCoreAtuais: series, alvoCompensaBase: 12, nivel: 'iniciante', objetivo: 'saude' });
      expect(e.entrega, 'core não pode entregar "ordem": com 1 slot por sessão, reordenar é inerte').toBe('volume');
    }
  });

  it('o trilho do foco de core tem rótulo e versão próprios', () => {
    expect(FOCO_CORE.procedencia).toBe('politica');
    expect(FOCO_CORE.versao).toBe('v3.1');
    expect(FOCO_CORE.origem).toMatch(/sem número novo/i);
  });
});

describe('🔒 foco de core — superfície, evento e copy', () => {
  const fonte = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

  it('🔴 aceite 6 — o seletor lista Core', () => {
    const editar = fonte('src/components/painel/EditarPerfil.tsx');
    const i = editar.indexOf('const GRUPOS_FOCO');
    const bloco = editar.slice(i, i + 500);
    expect(bloco, 'core não está entre os focáveis').toMatch(/'core'/);
    expect(bloco, 'lombar entrou, e a DF o manteve fora').not.toMatch(/'lombar'/);
  });

  it('🔴 foco de core NUNCA emite entrega "ordem" — o valor vem do motor, não de literal', () => {
    const painel = fonte('src/components/painel/Painel.tsx');
    const i = painel.indexOf("focoDepois.grupo === 'core'");
    expect(i, 'o caminho do core não existe no Painel').toBeGreaterThan(-1);
    // ⚠️ Recortar até `} else {` pegava o if/else INTERNO da recusa e cortava antes do
    // `entrega:` — âncora por forma de novo. O fim do bloco do core é o começo do caminho
    // regular, que é código: `aplicarFoco({`.
    const bloco = painel.slice(i, painel.indexOf('aplicarFoco({', i));
    expect(bloco).toMatch(/aplicarFocoCore\(/);
    expect(bloco).toMatch(/entrega: efeito\.entrega/);
    expect(bloco, "'ordem' aparece literal no caminho do core").not.toMatch(/'ordem'/);
    expect(bloco, 'a recusa não é medida').toMatch(/registrarEvento\('preferencia_recusada'/);
    expect(bloco, 'o foco recusado continuou sendo salvo').toMatch(/foco: undefined/);
  });

  it('a recusa CHEGA à tela, e não fica atrás de condição morta', () => {
    const painel = fonte('src/components/painel/Painel.tsx');
    expect(painel).toMatch(/setAvisoFoco\(efeito\.explicacao/);
    const i = painel.indexOf('{avisoFoco && (');
    expect(i, 'a recusa não é renderizada').toBeGreaterThan(-1);
  });

  /**
   * 🔴 Achado do smoke desta leva: o parágrafo do seletor prometia, a QUEM ESCOLHESSE CORE,
   * a saída por ordem ("passa a vir primeiro na sessão") — que para o core NÃO EXISTE. Copy
   * verdadeira para 10 grupos e falsa para o 11º é vazamento, não detalhe.
   *
   * O guard ancora no CRITÉRIO (a promessa é inalcançável quando o foco é core), não na
   * forma da frase: qualquer redação serve, desde que fique atrás de uma condição que
   * distinga o core.
   */
  it('🔴 a saída por ORDEM não é prometida a quem escolhe Core', () => {
    for (const manual of [false, true]) {
      const html = renderToStaticMarkup(createElement(GrupoEmFoco, {
        grupos: [{id:'core',rotulo:'Core'}], foco:'core', compensa:null,
        onFoco:()=>{}, onCompensa:()=>{}, manual,
      }));
      expect(html).not.toContain('Braços e ombros vêm primeiro na sessão');
      if (manual) expect(html).toContain('não ativa o foco');
      else {
        expect(html).toContain('sem retirar séries de outros grupos');
        expect(html).toContain('Os dias não mudam');
        expect(html).not.toContain('Qual grupo cede');
      }
    }
  });

  it('🔴 aceite 6 — copy sem superlativo, e a recusa não soa como culpa', () => {
    const PROIBIDO = [/mais eficaz/i, /mais eficiente/i, /potencializ/i, /maximiz/i, /n[íi]vel pro\b/i, /destrave/i, /resultado acelerado/i];
    const alvos = ['src/lib/engine/trilhos.ts', 'src/components/painel/Favoritos.tsx', 'src/components/painel/EditarPerfil.tsx'];
    for (const a of alvos)
      for (const re of PROIBIDO) expect(re.test(fonte(a)), `${a} :: ${re}`).toBe(false);
    // A recusa explica o limite e aponta a saída, sem acusar a pessoa.
    const e = aplicarFocoCore({ nSlotsCore: 3, seriesCoreAtuais: 9, alvoCompensaBase: 12, nivel: 'iniciante', objetivo: 'massa' });
    expect(e.explicacao, 'a recusa culpa a pessoa').not.toMatch(/você (não|nunca|deveria)/i);
    expect(e.explicacao, 'a recusa não diz o que muda o cenário').toMatch(/conforme você avança/i);
  });
});

// Fotografia/autoridade histórica: o seletor é congelado na etapa 1.
// As novas divisões reais são cobradas em distribuicao-etapa2.test.ts e na matriz externa.
vi.mock('./selecao-divisao', async (importOriginal) => process.env.ADAPT_TEST_SELETOR_ATUAL === '1' ? importOriginal() : import('./__fixtures__/selecao-etapa1'));
