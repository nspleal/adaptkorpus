import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DiaDaDieta from '@/components/painel/DiaDaDieta';
import { Hoje } from '@/components/painel/Painel';
import { FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import { gerarDieta, listarSubstituicoesPrato } from '@/lib/engine';
import { escolherPorcao, totaisDosItens, type ItemPorcionado } from './dia-da-dieta';

const flagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const deps = { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED };

function dietaDe(pesoKg: number, objetivo: 'emagrecimento' | 'massa', preferencia: 'vegetariano' | null) {
  return gerarDieta({ sexo: 'feminino', pesoKg, alturaCm: 160, idade: 25,
    nivelAtividade: 'sedentario', objetivo, flagsSaude },
  { ...deps, restricoes: { alergenos: [], preferencia, excluirAlimentoIds: [], excluirPratoIds: [], orcamento: null } });
}

describe('números e controles da dieta', () => {
  const quatro = dietaDe(50, 'massa', 'vegetariano');
  const tres = dietaDe(50, 'emagrecimento', 'vegetariano');

  it('50% → 100% restaura a sugestão; repetir 50% não acumula escala', () => {
    const item = quatro.cardapio!.itens[0]!;
    const metade = escolherPorcao(item, 50, FOODS_BY_ID_SEED)!;
    const metadeOutraVez = escolherPorcao(metade, 50, FOODS_BY_ID_SEED)!;
    const restaurado = escolherPorcao(metadeOutraVez, 100, FOODS_BY_ID_SEED)!;
    expect(metade.escala).toBeCloseTo(item.escala / 2, 10);
    expect(metadeOutraVez.escala).toBeCloseTo(metade.escala, 10);
    expect(restaurado.escala).toBeCloseTo(item.escala, 10);
    expect(restaurado.macros).toEqual(item.macros);
    expect([metade.porcentagemEscolhida, metadeOutraVez.porcentagemEscolhida, restaurado.porcentagemEscolhida]).toEqual([50, 50, 100]);
  });

  it('troca após edição usa o dia editado e a nova sugestão vira 100%', () => {
    const d = dietaDe(50, 'emagrecimento', null);
    const itens = d.cardapio!.itens;
    const almoco = itens.findIndex((x) => x.refeicao === 'almoco');
    const jantar = itens.findIndex((x) => x.refeicao === 'jantar');
    const editados = itens.slice();
    editados[almoco] = escolherPorcao(itens[almoco]!, 50, FOODS_BY_ID_SEED)!;
    const totais = totaisDosItens(editados);
    expect(totais.kcal).toBeLessThan(d.plano!.janela.minKcal);
    const opcoes = listarSubstituicoesPrato({ pratoAtual: editados[jantar]!.prato,
      slot: 'jantar', ...deps, plano: d.plano!, totaisDiaAtual: totais,
      escalaAtual: editados[jantar]!.escala,
      restricoes: { alergenos: [], preferencia: null },
      gosto: { excluirPratoIds: editados.filter((_, i) => i !== jantar).map((x) => x.prato.id), excluirAlimentoIds: [] } }, 3);
    expect(opcoes.length).toBeGreaterThan(0);
    const opcao = opcoes[0]!;
    expect(opcao.totaisDiaNovo!.kcal).toBeCloseTo(totais.kcal, 6);
    expect(opcao.totaisDiaNovo!.proteinaG).toBeGreaterThanOrEqual(Math.min(d.plano!.macros.proteinaPisoG, totais.proteinaG) - 1e-6);
    const novo: ItemPorcionado = { refeicao: 'jantar', prato: opcao.prato!, escala: opcao.escala!, macros: opcao.macrosNovo!, escalaSugerida: opcao.escala!, porcentagemEscolhida: 100 };
    const restaurado = escolherPorcao(escolherPorcao(novo, 50, FOODS_BY_ID_SEED)!, 100, FOODS_BY_ID_SEED)!;
    expect(restaurado.escala).toBeCloseTo(opcao.escala!, 10);
    expect(restaurado.macros).toEqual(novo.macros);
    expect(restaurado.porcentagemEscolhida).toBe(100);
  });

  it.each([['três', tres], ['quatro', quatro]] as const)('%s refeições: tela mostra cardápio real, referência e conclusão neutra', (_nome, d) => {
    const itens = d.cardapio!.itens;
    const alterados = itens.slice();
    alterados[0] = escolherPorcao(itens[0]!, 50, FOODS_BY_ID_SEED)!;
    const total = totaisDosItens(alterados);
    const logs = Object.fromEntries(alterados.map((it) => [it.refeicao, 'seguiu' as const]));
    const html = renderToStaticMarkup(createElement(DiaDaDieta, {
      itens: alterados, totais: total, plano: d.plano!, foodsById: FOODS_BY_ID_SEED,
      logs, notes: {}, trocados: new Set(['p0']), dataHoje: 'Hoje',
      onStatus: () => {}, onNote: () => {}, onTrocar: () => {}, onPorcao: () => {},
      onDetalhe: () => {}, onCompras: () => {},
    }));
    expect(html).toContain(`${Math.round(total.kcal).toLocaleString('pt-BR')}`);
    expect(html).toContain('kcal · cardápio atual');
    expect(html).toContain(`Proteína · ${Math.round(total.proteinaG)} g`);
    expect(html).toContain('Referência calculada do plano:');
    expect(html).toContain(`${itens.length} de ${itens.length} registradas`);
    expect(html).toContain('Você registrou todas as refeições de hoje. Constância, não perfeição.');
    expect(html).not.toContain('quatro refeições');
  });

  it('Hoje recebe o total atual dos alimentos, separado da referência do plano', () => {
    const itens = quatro.cardapio!.itens.slice();
    itens[0] = escolherPorcao(itens[0]!, 50, FOODS_BY_ID_SEED)!;
    const total = totaisDosItens(itens);
    const html = renderToStaticMarkup(createElement(Hoje, { dieta: quatro, cardTotais: total,
      dia: undefined, mostrarC: false, onFecharC: () => {}, onComecar: () => {},
      onRegistrar: () => {}, onRegistrarTreino: () => {}, deload: false }));
    expect(html).toContain('Cardápio atual');
    expect(html).toContain(`${Math.round(total.kcal)}`);
    expect(html).toContain(`Proteína</`);
    expect(html).toContain(`${Math.round(total.proteinaG)} g`);
    expect(html).toContain('Referência calculada do plano:');
  });

  it('não declara ok quando a composição fica abaixo do piso proteico calculado', () => {
    const d = gerarDieta({ sexo: 'feminino', pesoKg: 65, alturaCm: 160, idade: 45,
      nivelAtividade: 'sedentario', objetivo: 'emagrecimento', flagsSaude },
    { ...deps, restricoes: { alergenos: [], preferencia: 'vegetariano',
      excluirAlimentoIds: [], excluirPratoIds: [], orcamento: null } });
    expect(d.cardapio!.totais.proteinaG).toBeLessThan(d.plano!.macros.proteinaPisoG);
    expect(d.cardapio!.status).toBe('abaixo_piso_proteina');
    const html = renderToStaticMarkup(createElement(DiaDaDieta, {
      itens: d.cardapio!.itens, totais: d.cardapio!.totais, plano: d.plano!,
      foodsById: FOODS_BY_ID_SEED, logs: {}, notes: {}, trocados: new Set(), dataHoje: 'Hoje',
      onStatus: () => {}, onNote: () => {}, onTrocar: () => {}, onPorcao: () => {},
      onDetalhe: () => {}, onCompras: () => {},
    }));
    expect(html).toContain('Esta composição não atende esse requisito.');
  });
});
