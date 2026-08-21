/**
 * 🔒 C1 §8.4 — GUARDS que fecham as mutações que sobreviveram na primeira rodada do runner
 * (`scripts/mutantes-c1.mjs`). Cada teste aqui existe para MATAR um mutante específico; o número
 * da mutação normativa está no título.
 */
import { describe, expect, it } from 'vitest';
import { itensResistidosDeSlots } from './duracao-plano';
import { gerarPlanoTemporal, type Alocador, type InvariantesTreino, type ItemPlanoTemporal } from './geracao-temporal';
import { construirDistribuicaoCardioSemana, type EntradaDistribuicaoSemana } from './distribuicao-cardio-semana';
import { EXERCISES } from '../data/exercises';

const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;

// ── Mutação 3 / fixture 38 ────────────────────────────────────────────────────────────────────
describe('C1 mutação 3 (fixture 38) · a constante 40 não pode ser substituída por campo do item', () => {
  it('um slot que CARREGA um tempo por série próprio é ignorado: a conta usa 40 s', () => {
    // injeta os campos que uma implementação relapsa poderia ler no lugar da constante única.
    const slotAdulterado = {
      exercicio: byId('e1'), series: 3, descansoSeg: 60,
      segPorSerie: 1, segundosEstimadosPorSerie: 1, tempoPorSerieSeg: 1, execucaoSegundos: 1,
    } as unknown as Parameters<typeof itensResistidosDeSlots>[0][number];

    const { itens, faltou } = itensResistidosDeSlots([slotAdulterado]);
    expect(faltou).toHaveLength(0);
    const it0 = itens[0]!;
    expect(it0.tipo).toBe('RESISTIDO');
    if (it0.tipo !== 'RESISTIDO') return;
    expect(it0.execucao).toEqual({ tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 });
    // 🔴 o valor `1` injetado NUNCA pode aparecer.
    expect(it0.execucao.tipo === 'REPETICOES' && it0.execucao.segundosEstimadosPorSerie).not.toBe(1);
  });
});

// ── Mutação 17 / 20 · o laço de capacidade ────────────────────────────────────────────────────
describe('C1 mutações 17 e 20 · o laço de capacidade recheca e nunca vai a negativo', () => {
  const INV: InvariantesTreino = { coberturaObrigatoria: ['puxar', 'empurrar', 'agachar'], equipamentosDisponiveis: ['halter'] };
  const item = (id: string, padrao: 'puxar' | 'empurrar' | 'agachar'): ItemPlanoTemporal => ({
    id, padrao, grupo: id, equipamento: 'halter', series: 3, descansoSeg: 90,
    execucao: { tipo: 'REPETICOES', segundosEstimadosPorSerie: 40 },
  });
  const TRES = [item('A', 'puxar'), item('B', 'empurrar'), item('C', 'agachar')];

  it('mutação 20: o alocador NUNCA é chamado com capacidade negativa', () => {
    const pedidas: number[] = [];
    const alocar: Alocador = (cap) => { pedidas.push(cap); return { tipo: 'PLANO', itens: TRES.slice(0, Math.max(cap, 0)) }; };
    // capacidade inicial já inválida (negativa): o laço não pode rodar nem pedir plano.
    const r = gerarPlanoTemporal({ capacidadeInicial: -1, niveisDescanso: 1, alocar, invariantes: INV, orcamentoSegundos: 900 });
    expect(pedidas).toHaveLength(0);
    expect(pedidas.every((c) => c >= 0)).toBe(true);
    expect(r.tipo).toBe('INCOMPATIVEL');
    // e num laço normal, nenhuma capacidade pedida é negativa.
    const pedidas2: number[] = [];
    gerarPlanoTemporal({
      capacidadeInicial: 3, niveisDescanso: 1, invariantes: INV, orcamentoSegundos: 60,
      alocar: (cap) => { pedidas2.push(cap); return { tipo: 'PLANO', itens: TRES.slice(0, Math.max(cap, 0)) }; },
    });
    expect(pedidas2.every((c) => c >= 0)).toBe(true);
  });

  it('mutação 17: o RECHECK após reduzir decide — a 1ª tentativa que não cabe NÃO é adotada', () => {
    // capacidade 4 não cabe; capacidade 3 cabe. Adotar a 1ª tentativa (sem rechecar) devolveria 4.
    const alocar: Alocador = (cap) => (cap >= 4
      ? { tipo: 'PLANO', itens: [...TRES, item('D', 'puxar')] }
      : cap === 3 ? { tipo: 'PLANO', itens: TRES } : { tipo: 'SEM_PLANO_MENOR' });
    const r = gerarPlanoTemporal({ capacidadeInicial: 4, niveisDescanso: 1, alocar, invariantes: INV, orcamentoSegundos: 900 });
    expect(r.tipo).toBe('CERTIFICADO');
    if (r.tipo !== 'CERTIFICADO') return;
    expect(r.capacidadeTerminal).toBe(3); // o recheck rejeitou a capacidade 4
    expect(r.planoTerminal.map((i) => i.id)).toEqual(['A', 'B', 'C']);
  });
});

// ── Mutações 34, 35, 36 · materialização e identidade da distribuição semanal ─────────────────
describe('C1 mutações 34/35/36 · bloco zero, prescricao_id e ordem_prescricao', () => {
  const entrada = (over: Partial<EntradaDistribuicaoSemana>): EntradaDistribuicaoSemana => ({
    aggregateId: 'u1:semana', expectedRevision: 0, formulaVersion: 'tempo-v2',
    diasHorizonte: [{ diaId: 'seg', ordemNoHorizonte: 0, oferecido: true }],
    planosResistidosTerminais: [], orcamentoPorDia: [{ diaId: 'seg', orcamentoSegundos: 3600 }],
    prescricoesCardio: [], ...over,
  });

  it('mutação 34: soma ZERO no dia NÃO materializa bloco (e todo bloco = soma da linhagem)', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      diasHorizonte: [{ diaId: 'seg', ordemNoHorizonte: 0, oferecido: true }],
      // musculação ocupa TODO o orçamento ⇒ capacidade 0 ⇒ uso 0 e nenhum destino posterior.
      planosResistidosTerminais: [{ diaId: 'seg', temMusculacao: true, maxResistidaSegundos: 3600 }],
      prescricoesCardio: [{ prescricaoId: 'p1', diaOrigemId: 'seg', ordemPrescricao: 0, duracaoPrescritaSegundos: 900 }],
    }));
    expect(d.contratosPorPrescricao[0]!.duracaoUsadaNaSessaoSegundos).toBe(0);
    expect(d.blocosPorDia).toHaveLength(0); // 🔴 duração 0 nunca vira ItemContinuo
    // e onde há bloco, a duração é EXATAMENTE a soma da linhagem.
    for (const b of d.blocosPorDia) expect(b.linhagens.reduce((s, l) => s + l.segundos, 0)).toBe(b.duracaoTotalSegundos);
  });

  it('mutação 35: `prescricao_id` reutilizado entre origens ⇒ NAO_AVALIADA_ESTRUTURAL, zero commit', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      diasHorizonte: [
        { diaId: 'seg', ordemNoHorizonte: 0, oferecido: true },
        { diaId: 'qua', ordemNoHorizonte: 1, oferecido: true },
      ],
      orcamentoPorDia: [{ diaId: 'seg', orcamentoSegundos: 3600 }, { diaId: 'qua', orcamentoSegundos: 3600 }],
      prescricoesCardio: [
        { prescricaoId: 'DUP', diaOrigemId: 'seg', ordemPrescricao: 0, duracaoPrescritaSegundos: 600 },
        { prescricaoId: 'DUP', diaOrigemId: 'qua', ordemPrescricao: 0, duracaoPrescritaSegundos: 600 },
      ],
    }));
    expect(d.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
    expect(d.motivos.join(' ')).toMatch(/prescricao_id duplicado/);
    expect(d.contratosPorPrescricao).toHaveLength(0);
    expect(d.blocosPorDia).toHaveLength(0);
  });

  it('mutação 36: `ordem_prescricao` duplicada no mesmo dia ⇒ NAO_AVALIADA_ESTRUTURAL', () => {
    const d = construirDistribuicaoCardioSemana(entrada({
      prescricoesCardio: [
        { prescricaoId: 'p1', diaOrigemId: 'seg', ordemPrescricao: 0, duracaoPrescritaSegundos: 600 },
        { prescricaoId: 'p2', diaOrigemId: 'seg', ordemPrescricao: 0, duracaoPrescritaSegundos: 600 },
      ],
    }));
    expect(d.estado).toBe('NAO_AVALIADA_ESTRUTURAL');
    expect(d.motivos.join(' ')).toMatch(/ordem_prescricao duplicada/);
    expect(d.contratosPorPrescricao).toHaveLength(0);
  });
});
