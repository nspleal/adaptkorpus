import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FOCO_DELTA, FOCO_SEMANAS, INTERVALO_MIN_HORAS_MESMO_GRUPO, TRILHOS,
  aplicarFoco, faixaSemanal, focoVigente, mev, mrv, ordenarComFoco,
  tetoSeriesGrupoNaSessao, tetoSeriesPorExercicio,
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
    // MRV de massa: 12 / 16 / 20 (iniciante / intermediário / avançado).
    expect([mrv('iniciante', 'massa'), mrv('intermediario', 'massa'), mrv('avancado', 'massa')]).toEqual([12, 16, 20]);
    expect(mev('intermediario', 'massa')).toBe(13);
    // Séries do grupo na SESSÃO: 16 ÷ 2× ≈ 8.
    expect(tetoSeriesGrupoNaSessao('intermediario', 'massa', 2)).toBe(8);
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
    const teto = mrv('intermediario', 'massa'); // 16
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
    const efeito = aplicarFoco({ alvoBase: 15, alvoCompensaBase: 16, nivel: 'intermediario', objetivo: 'massa', delta: 4 });
    expect(efeito.alvoFocado).toBe(16);   // 15 + 4 = 19 → cortado no teto
    expect(efeito.deltaAplicado).toBe(1);
    expect(efeito.alvoCompensado).toBe(15);
  });

  it('o MEV do compensador também limita — não se desce abaixo do piso para focar', () => {
    const piso = mev('intermediario', 'massa'); // 13
    const efeito = aplicarFoco({ alvoBase: 13, alvoCompensaBase: piso, nivel: 'intermediario', objetivo: 'massa' });
    expect(efeito.deltaAplicado, 'o foco tirou volume de quem já estava no piso').toBe(0);
    expect(efeito.entrega).toBe('ordem');
  });

  it('nenhum nível/objetivo consegue passar do MRV, varrendo a tabela inteira', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
      for (const objetivo of ['saude', 'massa', 'emagrecimento'] as const)
        for (const delta of [2, 3, 4]) {
          const faixa = faixaSemanal(nivel, objetivo);
          for (const base of [faixa.min, faixa.max - 1, faixa.max]) {
            const e = aplicarFoco({ alvoBase: base, alvoCompensaBase: faixa.max, nivel, objetivo, delta });
            expect(e.alvoFocado, `${nivel}/${objetivo} base ${base} +${delta}`).toBeLessThanOrEqual(faixa.max);
            expect(e.alvoCompensado, `${nivel}/${objetivo} compensador abaixo do MEV`).toBeGreaterThanOrEqual(faixa.min);
          }
        }
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

  it('🔴 e o volume total da semana NÃO cresce — o foco redistribui', () => {
    const soma = (r: ReturnType<typeof plano>) => [...seriesPorGrupo(r).values()].reduce((a, b) => a + b, 0);
    expect(soma(plano(comFoco))).toBe(soma(plano(perfil())));
  });

  it('nenhum grupo do plano ultrapassa o MRV, com foco ou sem', () => {
    const teto = mrv('intermediario', 'massa');
    for (const p of [perfil(), comFoco])
      for (const [grupo, series] of seriesPorGrupo(plano(p)))
        expect(series, `${grupo} passou do MRV`).toBeLessThanOrEqual(teto);
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

  it('🔑 a copy NÃO promete volume a quem já está no topo', () => {
    const favs = fonte('src/components/painel/Favoritos.tsx');
    const i = favs.indexOf('export function GrupoEmFoco');
    const bloco = favs.slice(i, i + 2200);
    // A janela declarada e a compensação 1:1 aparecem…
    expect(bloco).toMatch(/4 a 6 semanas/);
    expect(bloco).toMatch(/o total da sua semana não muda/);
    // …e o caso do teto duro é dito, não escondido.
    expect(bloco, 'a copy some com o caso "já está no topo" — que é a maioria de quem foca')
      .toMatch(/j[áa] estiver no topo/i);
  });

  it('meio foco não é foco: sem o compensador, nada é salvo', () => {
    const editar = fonte('src/components/painel/EditarPerfil.tsx');
    expect(editar).toMatch(/foco: focoGrupo && focoCompensa/);
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
   */
  const COM_FOLGA = perfil({ nivelExperiencia: 'iniciante', objetivo: 'saude', diasDisponiveis: 3 });
  const SEMANA_COM_FOLGA = 2;
  const slotsCore = (r: ReturnType<typeof plano>) => r.dias.flatMap((d) => d.slots).filter((s) => s.exercicio.grupoPrimario === 'core');
  const seriesCore = (r: ReturnType<typeof plano>) => slotsCore(r).reduce((a, s) => a + (s.series ?? 0), 0);
  /** A estrutura da semana: dias, slots e exercícios — tudo menos as séries. */
  const estrutura = (r: ReturnType<typeof plano>) =>
    r.dias.map((d) => ({ nome: d.nome, slots: d.slots.map((s) => s.exercicio.id) }));

  it('a fixture é real: folga no core E no compensador', () => {
    const r = plano(COM_FOLGA, SEMANA_COM_FOLGA);
    expect(slotsCore(r).length).toBe(3);
    expect(seriesCore(r)).toBe(7);                       // 7 de 9
    expect(folgaDeCore(3, 7, 'iniciante')).toBe(2);
    expect(mev('iniciante', 'saude')).toBe(6);           // compensador em 7 → cede 1
  });

  it('🔴 aceite 1 — com folga: séries sobem nos slots existentes, ESTRUTURA idêntica', () => {
    const sem = plano(COM_FOLGA, SEMANA_COM_FOLGA);
    const com = plano(perfil({ ...COM_FOLGA, foco: { grupo: 'core' as never, compensa: 'costas' as never, semana: 1 } }), SEMANA_COM_FOLGA);
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
      expect(s.series ?? 0, 'um slot de core furou o teto por exercício').toBeLessThanOrEqual(tetoSeriesPorExercicio('iniciante'));
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
  it('🔑 no plano, o total semanal NÃO muda — VARRIDO, não um cenário', () => {
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
              const [a, b] = [soma(base, semana), soma(comFoco, semana)];
              if (a !== b) quebras.push(`${nivel}/${objetivo}/${dias}d/sem${semana}/${compensa}: ${a} → ${b}`);
            }
    expect(quebras, `o foco de core mudou o volume total em ${quebras.length} cenário(s): ${quebras.slice(0, 3).join(' · ')}`).toEqual([]);
  });

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
    const favoritos = fonte('src/components/painel/Favoritos.tsx');
    const i = favoritos.indexOf('vir primeiro na sessão');
    expect(i, 'a frase da saída por ordem sumiu — reancore este guard').toBeGreaterThan(-1);

    // Sobe até o início da expressão condicional que a governa e exige que ela cite core.
    const antes = favoritos.slice(Math.max(0, i - 400), i);
    expect(antes, 'a promessa de ordem está solta — core a lê como se valesse para ele')
      .toMatch(/foco\s*===\s*'core'|foco\s*!==\s*'core'/);

    // E o ramo do core precisa dizer o que de fato acontece: sem folga, avisa e não ativa.
    const j = favoritos.indexOf("foco === 'core'");
    const ramo = favoritos.slice(j, i);
    expect(ramo, 'o ramo do core não diz que pode não ativar').toMatch(/não ativa o foco/);
    expect(ramo, 'o ramo do core promete mexer nos dias, e a DF os deixa intocados')
      .toMatch(/dias não muda/);
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
