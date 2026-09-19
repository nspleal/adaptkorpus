import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gerarTreino } from '@/lib/engine';
import type { PerfilTreino } from '@/lib/engine';
import { EXERCISES_SEED } from '@/lib/data/seed';
import { avaliarSemana, type Avaliacao, type ItemCritico } from '@/lib/engine/critico';
import { ORDEM_SEMANA, diasPadrao, type Weekday } from '@/lib/semana';
import type { FatoCoberturaGrupo, RotinaSemanal } from '@/lib/engine/treino-types';
import { unificarAvisos } from './avisos-unificados';
import { recomendacoesVisiveis } from '@/components/painel/EditorTreino';

/**
 * 🔴 D16 (auditoria 2026-09-11 sobre `a40f8af`) — O MESMO FATO, DITO UMA VEZ.
 *
 * Na aba Treino conviviam, sobre o mesmo grupo e a mesma semana:
 *   · do motor:   "Atenção: o volume de ombros ficou abaixo do mínimo desta semana."
 *   · do crítico: "Ombros está abaixo da faixa mínima desta semana (10 de 13 séries)."
 *
 * 🔒 O que estes testes travam, e é o que a decisão pede:
 *   · a comparação é por FATO (grupo, semana, escopo, métrica, limiar), nunca por texto;
 *   · a variante do motor que diz a CAUSA (catálogo/equipamento) é diferença LEGÍTIMA e fica;
 *   · nenhum aviso do crítico é removido — a tela não se limpa às custas do que alerta.
 */

const fato = (over: Partial<FatoCoberturaGrupo> = {}): FatoCoberturaGrupo => ({
  grupo: 'ombros', semana: 1, escopo: 'semana', metrica: 'series_ponderadas',
  limiar: 'mev', alvo: 13, valor: 10, causa: 'orcamento',
  aviso: 'Atenção: o volume de ombros ficou abaixo do mínimo desta semana.',
  ...over,
});

const itemCritico = (over: Partial<ItemCritico> = {}): ItemCritico => ({
  codigo: 'grupo_abaixo_do_minimo', severidade: 'recomendacao',
  texto: 'Ombros está abaixo da faixa mínima desta semana (10 de 13 séries).',
  fato: { grupo: 'ombros', semana: 1, valor: 10, escopo: 'semana', metrica: 'series_ponderadas', limiar: 'mev', alvo: 13 },
  ...over,
});

const rotinaCom = (avisos: string[], fatos: FatoCoberturaGrupo[]) =>
  ({ avisos, fatosCobertura: fatos }) as Pick<RotinaSemanal, 'avisos' | 'fatosCobertura'>;

const avaliacaoCom = (recomendacoes: ItemCritico[], avisos: ItemCritico[] = []) =>
  ({ recomendacoes, avisos }) as Pick<Avaliacao, 'recomendacoes' | 'avisos'>;

describe('D16 · o eco sai, o fato fica dito uma vez', () => {
  it('mesmo grupo, mesma semana, mesmo limiar: a linha do motor sai e a do crítico fica', () => {
    const f = fato();
    const r = unificarAvisos(rotinaCom([f.aviso, 'Tempo por sessão curto: priorizamos os exercícios fundamentais.'], [f]), avaliacaoCom([itemCritico()]));
    expect(r.avisosMotor).toEqual(['Tempo por sessão curto: priorizamos os exercícios fundamentais.']);
    expect(r.suprimidos).toHaveLength(1);
    expect(r.suprimidos[0]!.porque).toMatch(/ombros/);
  });

  it('a decisão NÃO é por texto: grupo diferente com a mesma forma de frase não é o mesmo fato', () => {
    const f = fato({ grupo: 'costas', aviso: 'Atenção: o volume de costas ficou abaixo do mínimo desta semana.' });
    const r = unificarAvisos(rotinaCom([f.aviso], [f]), avaliacaoCom([itemCritico()]));
    expect(r.avisosMotor).toEqual([f.aviso]);
    expect(r.suprimidos).toEqual([]);
  });

  it('limiar diferente (alvo distinto) não é o mesmo fato', () => {
    const f = fato({ alvo: 10 });
    const r = unificarAvisos(rotinaCom([f.aviso], [f]), avaliacaoCom([itemCritico()]));
    expect(r.avisosMotor).toEqual([f.aviso]);
  });

  it('métrica ou escopo diferentes não são o mesmo fato', () => {
    const f = fato();
    const criticoOutroEscopo = itemCritico({ fato: { grupo: 'ombros', escopo: 'semana', metrica: 'series_ponderadas', limiar: 'mrv', alvo: 13 } });
    expect(unificarAvisos(rotinaCom([f.aviso], [f]), avaliacaoCom([criticoOutroEscopo])).avisosMotor).toEqual([f.aviso]);
  });

  it('sem crítico na tela, nada é suprimido (não existe voz para assumir o fato)', () => {
    const f = fato();
    expect(unificarAvisos(rotinaCom([f.aviso], [f]), null).avisosMotor).toEqual([f.aviso]);
    expect(unificarAvisos(rotinaCom([f.aviso], [f]), avaliacaoCom([])).avisosMotor).toEqual([f.aviso]);
  });
});

describe('D16 · diferenças legítimas são preservadas', () => {
  it.each([{ semana: 2 as const }, { valor: 9 }, { valor: undefined }])('não apaga medição de outra semana, diferente ou ausente: %j', (alteracao) => {
    const f = fato(alteracao);
    expect(unificarAvisos(rotinaCom([f.aviso], [f]), avaliacaoCom([itemCritico()])).avisosMotor).toEqual([f.aviso]);
  });
  it('a frase de CATÁLOGO diz a causa e sobrevive mesmo com o crítico falando do grupo', () => {
    const f = fato({
      causa: 'catalogo',
      aviso: 'Seu equipamento disponível limita o volume de ombros nesta semana.',
    });
    const r = unificarAvisos(rotinaCom([f.aviso], [f]), avaliacaoCom([itemCritico()]));
    expect(r.avisosMotor, 'a explicação da causa foi apagada como se fosse eco').toEqual([f.aviso]);
    expect(r.suprimidos).toEqual([]);
  });

  it('avisos de outra natureza do motor nunca são tocados', () => {
    const f = fato();
    const outros = [
      'Atenção: volume de puxar ficou abaixo do de empurrar (alvo: puxar ≥ empurrar).',
      'Atenção: core fora da faixa de 2–3×/semana.',
      'Cardio: o plano pede 160 min nesta semana e couberam 136 min nos dias que você ofereceu — faltam 24 min.',
    ];
    const r = unificarAvisos(rotinaCom([...outros, f.aviso], [f]), avaliacaoCom([itemCritico()]));
    expect(r.avisosMotor).toEqual(outros);
  });

  it('o crítico não é filtrado por este módulo — ele não devolve lista de crítico nenhuma', () => {
    const r = unificarAvisos(rotinaCom([], []), avaliacaoCom([itemCritico()], [itemCritico({ codigo: 'acima_do_maximo', severidade: 'risco' })]));
    expect(Object.keys(r).sort()).toEqual(['avisosMotor', 'suprimidos']);
  });
});

describe('D16 · no plano de verdade', () => {
  /** O perfil medido na varredura: ombros pelo ORÇAMENTO e posterior pelo CATÁLOGO. */
  const perfil: PerfilTreino = {
    pesoKg: 75, alturaCm: 175, idade: 30,
    flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
    // 2026-09-19: em `saude` ombros passou a ser limitado pelo CATÁLOGO neste perfil; em `massa`
    // continua pelo ORÇAMENTO, que é o caso que este bloco mede (o crítico também fala).
    objetivo: 'massa', nivelExperiencia: 'iniciante', equipamento: 'casa', equipamentosCasa: [],
    diasDisponiveis: 3, treinoDias: diasPadrao(3) as Weekday[], tempoPorSessaoMin: 30,
  };
  const rotina = gerarTreino(perfil, { exercises: EXERCISES_SEED, semanaCiclo: { semana: 1 } }).rotina!;
  const avaliacao = avaliarSemana(
    rotina.dias.map((d) => ({
      nome: d.nome,
      exercicios: d.slots.map((s) => s.exercicio),
      series: d.slots.map((s) => s.series ?? 0),
      descansoSeg: d.slots.map((s) => s.descansoSeg),
      holdSeg: d.slots.map((s) => s.holdSeg),
    })),
    {
      nivel: perfil.nivelExperiencia, objetivo: perfil.objetivo, semana: 1,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin,
      diasDaSemanaIdx: perfil.treinoDias!.map((w) => ORDEM_SEMANA.indexOf(w)),
      seriesPadrao: 2,
    },
  );

  it('anti-vacuidade: os DOIS sistemas realmente falam de ombros nesta semana', () => {
    expect((rotina.fatosCobertura ?? []).some((f) => f.grupo === 'ombros' && f.causa === 'orcamento')).toBe(true);
    expect(avaliacao.recomendacoes.some((i) => i.fato?.grupo === 'ombros'), 'o crítico não falou de ombros — o caso mudou').toBe(true);
  });

  it('depois da unificação, ombros é dito UMA vez — e é a fala com os números', () => {
    const { avisosMotor, suprimidos } = unificarAvisos(rotina, avaliacao);
    expect(avisosMotor.filter((a) => a.includes('ombros'))).toEqual([]);
    expect(suprimidos.map((s) => s.aviso)).toContain('Atenção: o volume de ombros ficou abaixo do mínimo desta semana.');
    const doCritico = avaliacao.recomendacoes.filter((i) => i.fato?.grupo === 'ombros');
    expect(doCritico.length).toBeGreaterThan(0);
    expect(doCritico[0]!.texto).toMatch(/séries\)/);
  });

  it('o aviso de CATÁLOGO (posterior) continua na tela: ele diz a causa, e isso é outra fala', () => {
    const catalogo = (rotina.fatosCobertura ?? []).filter((f) => f.causa === 'catalogo');
    expect(catalogo.length, 'a fixture perdeu o caso de catálogo').toBeGreaterThan(0);
    const { avisosMotor } = unificarAvisos(rotina, avaliacao);
    for (const f of catalogo) expect(avisosMotor).toContain(f.aviso);
  });

  it('nada que não fosse eco saiu da lista do motor', () => {
    const { avisosMotor, suprimidos } = unificarAvisos(rotina, avaliacao);
    expect(avisosMotor.length + suprimidos.length).toBe(rotina.avisos.length);
  });
});

describe('D16 · o eco só sai se a fala do crítico estiver REALMENTE na tela', () => {
  /**
   * 🔴 O crítico do plano salvo é COMPACTO: mostra UMA recomendação. Comparar contra a lista
   * inteira faria o fato sumir das duas listas quando a fala do crítico ficasse de fora do
   * compacto — a tela mais limpa e um fato a menos, que é o oposto do pedido.
   */
  it('fala do crítico fora do compacto ⇒ o aviso do motor FICA', () => {
    const f = fato();
    const primeiro = itemCritico({
      texto: 'Costas está abaixo da faixa mínima desta semana (4 de 12 séries).',
      fato: { grupo: 'costas', escopo: 'semana', metrica: 'series_ponderadas', limiar: 'mev', alvo: 12 },
    });
    const completo = [primeiro, itemCritico()];
    expect(unificarAvisos(rotinaCom([f.aviso], [f]), avaliacaoCom(completo)).avisosMotor).toEqual([]);
    const visivel = recomendacoesVisiveis({ recomendacoes: completo }, true);
    expect(visivel).toHaveLength(1);
    expect(unificarAvisos(rotinaCom([f.aviso], [f]), avaliacaoCom(visivel)).avisosMotor).toEqual([f.aviso]);
  });

  it('o Painel compara contra o que o crítico EXIBE, usando a mesma régua do componente', () => {
    const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');
    expect(painel).toMatch(/unificarAvisos\(rotina, criticoPlano && \{ recomendacoes: recomendacoesVisiveis\(criticoPlano, true\)/);
    const editor = readFileSync('src/components/painel/EditorTreino.tsx', 'utf8');
    expect(editor, 'a régua do compacto voltou a existir em dois lugares')
      .toMatch(/const visiveis = recomendacoesVisiveis\(avaliacao, compacto\)/);
  });
});

describe('D16 · a tela usa a unificação, e a regra não mora no componente', () => {
  const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');
  const avisosMotor = readFileSync('src/components/painel/AvisosMotor.tsx', 'utf8');

  it('o Painel passa a lista unificada, e o crítico segue inteiro', () => {
    expect(painel).toMatch(/avisos=\{unificarAvisos\(rotina, criticoPlano && \{/);
    expect(painel).toMatch(/<PainelCritico avaliacao=\{criticoPlano\} compacto \/>/);
  });

  it('o componente continua renderizando verbatim — sem filtro próprio', () => {
    expect(avisosMotor).not.toMatch(/\.filter\(|includes\('Atenção/);
  });
});
