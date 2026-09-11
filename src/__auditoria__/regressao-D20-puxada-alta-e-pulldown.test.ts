/**
 * 🔴 D20 — "Puxada alta (pulldown)" confundia dois exercícios.
 *
 * O que a conferência às fontes achou: NÃO havia fusão a separar. O catálogo já tinha os
 * dois movimentos, com ids, padrões, equipamentos e instruções próprios e corretos:
 *   · e49  — puxada vertical, flexão de cotovelo, sentado, até o peito   → padrão `puxar`
 *   · e126 — braços quase estendidos, em arco, isolando o dorsal         → padrão `isolado`
 * O problema era só o RÓTULO: "(pulldown)" sozinho nomeia os dois na academia, e e126 nem
 * aparecia numa busca por "pulldown". Esclareceu-se o NOME; nenhum id foi reaproveitado
 * para outro movimento, nenhum exercício novo foi inventado e nenhum parâmetro clínico
 * foi criado.
 */
import { describe, expect, it } from 'vitest';
import { EXERCISES_SEED } from '../lib/data/seed';
import { FAMILIAS } from '../lib/engine/familias';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ex = (id: string) => EXERCISES_SEED.find((e) => e.id === id)!;

describe('🔴 D20 ① — os dois movimentos seguem distintos e no lugar', () => {
  it('e49 continua sendo a puxada vertical (padrão puxar, costas, polia)', () => {
    const e = ex('e49');
    expect(e.padraoMovimento).toBe('puxar');
    expect(e.grupoPrimario).toBe('costas');
    expect(e.equipamentoDetalhe).toBe('Polia / Máquina');
    expect(e.nomeEn).toBe('Lat Pulldown');
    expect(e.comoFazer).toContain('até a altura do peito');
  });

  it('e126 continua sendo o de braços estendidos (padrão isolado)', () => {
    const e = ex('e126');
    expect(e.padraoMovimento).toBe('isolado');
    expect(e.grupoPrimario).toBe('costas');
    expect(e.comoFazer).toContain('braços quase estendidos');
  });

  it('nenhum id foi trocado de movimento: são identidades diferentes', () => {
    expect(ex('e49').padraoMovimento).not.toBe(ex('e126').padraoMovimento);
  });

  it('nenhum exercício novo foi inventado para resolver o nome', () => {
    expect(EXERCISES_SEED).toHaveLength(168);
  });
});

describe('🔴 D20 ② — o nome deixou de ser ambíguo', () => {
  it('e49 não se apresenta mais só como "(pulldown)"', () => {
    expect(ex('e49').nomePt).toBe('Puxada alta na polia (lat pulldown)');
    expect(ex('e49').nomePt).not.toBe('Puxada alta (pulldown)');
  });

  it('e126 diz, no próprio nome, que é o de braços estendidos', () => {
    expect(norm(ex('e126').nomePt)).toContain('bracos estendidos');
    expect(norm(ex('e126').nomePt)).toContain('pulldown');
  });

  it('nenhum nome do catálogo termina com a palavra inglesa nua "(pulldown)"', () => {
    const ambiguos = EXERCISES_SEED.filter((e) => /\(pulldown\)\s*$/i.test(e.nomePt)).map((e) => e.id);
    expect(ambiguos).toEqual([]);
  });

  it('buscar "pulldown" agora encontra OS DOIS — a confusão fica visível e resolvida', () => {
    const achados = EXERCISES_SEED
      .filter((e) => norm(e.nomePt).includes('pulldown') || norm(e.nomeEn ?? '').includes('pulldown'))
      .map((e) => e.id);
    expect(achados).toContain('e49');
    expect(achados).toContain('e126');
  });

  it('buscar "puxada alta" continua chegando em e49', () => {
    const achados = EXERCISES_SEED.filter((e) => norm(e.nomePt).includes('puxada alta')).map((e) => e.id);
    expect(achados).toContain('e49');
  });
});

describe('🔴 D20 ③ — identidade, planos e histórico preservados', () => {
  it('o catálogo continua sem id, nome ou nome em inglês repetido', () => {
    for (const campo of ['id', 'nomePt', 'nomeEn'] as const) {
      const vals = EXERCISES_SEED.map((e) => e[campo]).filter(Boolean);
      expect(new Set(vals).size, `${campo} duplicado`).toBe(vals.length);
    }
  });

  it('as famílias continuam citando os mesmos ids — nenhuma referência quebrou', () => {
    expect(FAMILIAS['puxada-vertical']).toEqual(['e49', 'e50', 'e51']);
    const todos = new Set(EXERCISES_SEED.map((e) => e.id));
    for (const [fam, ids] of Object.entries(FAMILIAS)) {
      for (const id of ids) expect(todos.has(id), `${fam} cita ${id}, que não existe`).toBe(true);
    }
  });

  it('e126 NÃO entrou na família da puxada vertical: é outro movimento', () => {
    expect(FAMILIAS['puxada-vertical']).not.toContain('e126');
  });

  it('planos e histórico chaveiam por id, então o rótulo pode mudar sem perder nada', () => {
    expect(ex('e49').id).toBe('e49');
    expect(ex('e126').id).toBe('e126');
  });

  it('os erros comuns de e49 seguem descrevendo a puxada vertical', async () => {
    const { ERROS_COMUNS } = await import('../lib/data/erros-comuns');
    expect(ERROS_COMUNS['e49']!.join(' ')).toContain('atrás da nuca');
  });
});
