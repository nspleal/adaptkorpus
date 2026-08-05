import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FOCO_DELTA, FOCO_SEMANAS, INTERVALO_MIN_HORAS_MESMO_GRUPO, TRILHOS,
  aplicarFoco, faixaSemanal, focoVigente, mev, mrv, ordenarComFoco,
  tetoSeriesGrupoNaSessao, tetoSeriesPorExercicio,
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
