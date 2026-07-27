import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  contarFrequencia, ESCALA_MAX, GRUPOS_ORDEM, janelaSemana, janelaSemanasFechadas,
  LEGENDA_UM_DIA, mediaPorSemana, PADROES, REFERENCIA_PADRAO, REGIOES, reguaDoPadrao,
  ROTULO_REGUA, rotuloContagem, type SessaoParaFrequencia,
} from './frequencia-grupos';
import { EXERCISES } from './data/exercises';
import type { Exercise } from './data/types';

/**
 * Frequência por grupo — ancorado nas 4 CORREÇÕES OBRIGATÓRIAS do cofre
 * (`parametros-motor-treino-evokorpus` §"Como a régua de 2× pode e não pode ser exibida",
 * DF 2026-07-27). Cada uma tem aqui o teste que o critério de aceite nomeia.
 */

const porId = (id: string) => EXERCISES.find((e) => e.id === id);
const ex = (grupo: string, padrao: string): Exercise =>
  EXERCISES.find((e) => e.grupoPrimario === grupo && e.padraoMovimento === padrao)!;

const sessao = (dataISO: string, ids: string[], tipo?: string): SessaoParaFrequencia =>
  ({ dataISO, ...(tipo ? { tipo } : {}), exercicios: ids.map((id) => ({ id })) });

describe('vocabulário e ordem', () => {
  it('os 18 grupos, em ordem ANATÔMICA e fixa (nunca por contagem)', () => {
    expect(GRUPOS_ORDEM).toHaveLength(18);
    expect(REGIOES.map((r) => r.titulo)).toEqual(['Superior', 'Tronco', 'Inferior', 'Outros']);
    expect(GRUPOS_ORDEM[0]).toBe('peito');
    expect(GRUPOS_ORDEM.indexOf('costas')).toBeLessThan(GRUPOS_ORDEM.indexOf('gluteos'));
  });

  it('🔒 a lista sai do CATÁLOGO REAL — nenhum grupo do catálogo fica de fora', () => {
    const noCatalogo = new Set(EXERCISES.map((e) => e.grupoPrimario));
    for (const g of noCatalogo) expect(GRUPOS_ORDEM, `grupo ${g} sumiu da tela`).toContain(g);
    // e nada de inventado: todo grupo exibido existe no catálogo
    for (const g of GRUPOS_ORDEM) expect(noCatalogo, `grupo ${g} não existe no catálogo`).toContain(g);
  });

  it('os 7 padrões de movimento do catálogo', () => {
    const noCatalogo = new Set(EXERCISES.map((e) => e.padraoMovimento));
    expect(PADROES).toHaveLength(7);
    for (const p of noCatalogo) expect(PADROES).toContain(p);
  });

  it('a escala é fixa 0–4× (a marca fica sempre no mesmo ponto)', () => {
    expect(ESCALA_MAX).toBe(4);
    expect(REFERENCIA_PADRAO).toBe(2);
  });
});

describe('🔴 correção 1 — a régua é CONDICIONAL a ≥ 2 dias de força', () => {
  it('teste que FALHA se o marcador aparecer com 1 dia de força agendado', () => {
    expect(reguaDoPadrao({ padrao: 'empurrar', diasForca: 1, objetivo: 'massa' })).toBeNull();
  });

  it('com 2 dias ou mais a régua é 2×', () => {
    expect(reguaDoPadrao({ padrao: 'empurrar', diasForca: 2, objetivo: 'massa' })).toEqual({ tipo: 'vezes', valor: 2 });
    expect(reguaDoPadrao({ padrao: 'puxar', diasForca: 5, objetivo: 'saude' })).toEqual({ tipo: 'vezes', valor: 2 });
  });

  it('a legenda de 1 dia diz que 1× é o ESPERADO (não uma falta)', () => {
    expect(LEGENDA_UM_DIA).toBe('com 1 dia por semana, 1× por padrão é o esperado');
    expect(LEGENDA_UM_DIA).not.toMatch(/abaixo|falta|meta|ideal/i);
  });
});

describe('🔴 correção 2 — o padrão `cardio` usa o alvo do OBJETIVO, nunca o 2×', () => {
  it('teste que FALHA se a régua do cardio for 2 em objetivo massa', () => {
    const r = reguaDoPadrao({ padrao: 'cardio', diasForca: 4, objetivo: 'massa' });
    expect(r).toEqual({ tipo: 'vezes', valor: 1 });
    expect(r).not.toEqual({ tipo: 'vezes', valor: 2 });
  });

  it('saúde e emagrecimento têm referência em MINUTOS — sem marca de vezes aqui', () => {
    expect(reguaDoPadrao({ padrao: 'cardio', diasForca: 4, objetivo: 'saude' })).toEqual({ tipo: 'minutos', alvo: 150 });
    expect(reguaDoPadrao({ padrao: 'cardio', diasForca: 4, objetivo: 'emagrecimento' }))
      .toEqual({ tipo: 'minutos', alvo: 150, max: 300 });
  });

  it('durante a rampa de retomada o cardio cai para 1 sessão', () => {
    expect(reguaDoPadrao({ padrao: 'cardio', diasForca: 4, objetivo: 'saude', retomadaAtiva: true }))
      .toEqual({ tipo: 'vezes', valor: 1 });
  });

  it('o cardio não herda a condicional dos dias de força', () => {
    expect(reguaDoPadrao({ padrao: 'cardio', diasForca: 1, objetivo: 'massa' })).toEqual({ tipo: 'vezes', valor: 1 });
  });
});

describe('🔴 correção 3 — "4 semanas" = 4 semanas FECHADAS, sem a corrente', () => {
  it('a janela termina no domingo ANTERIOR à semana de hoje', () => {
    // 2026-07-29 é quarta; a semana corrente abre em 27/07.
    expect(janelaSemana('2026-07-29')).toEqual({ inicioISO: '2026-07-27', fimISO: '2026-08-02' });
    expect(janelaSemanasFechadas('2026-07-29')).toEqual({ inicioISO: '2026-06-29', fimISO: '2026-07-26' });
  });

  it('são exatamente 28 dias — 4 baldes, não 5', () => {
    const j = janelaSemanasFechadas('2026-07-29');
    const dias = (Date.parse(`${j.fimISO}T00:00:00Z`) - Date.parse(`${j.inicioISO}T00:00:00Z`)) / 86_400_000 + 1;
    expect(dias).toBe(28);
  });

  it('um treino da semana CORRENTE não entra na janela de 4 semanas', () => {
    const hoje = '2026-07-29';
    const j = janelaSemanasFechadas(hoje);
    const c = contarFrequencia([sessao('2026-07-28', [ex('peito', 'empurrar').id])], j, porId);
    expect(c.sessoes).toBe(0);
  });

  it('média com uma casa decimal', () => {
    expect(mediaPorSemana(10, 4)).toBe(2.5);
    expect(rotuloContagem(2.5)).toBe('2,5×');
    expect(rotuloContagem(3)).toBe('3×');
  });
});

describe('🔴 correção 4 — a régua pertence ao PADRÃO, e o rótulo diz isso', () => {
  it('o rótulo atribui a marca aos padrões, não ao grupo', () => {
    expect(ROTULO_REGUA).toBe('2× — referência dos padrões');
    expect(ROTULO_REGUA).toMatch(/padr/i);
  });
});

describe('agregação: 1× por SESSÃO, sobre grupoPrimario', () => {
  const j = janelaSemana('2026-07-29');

  it('dois exercícios do mesmo grupo na mesma sessão contam 1×', () => {
    const doisDoPeito = EXERCISES.filter((e) => e.grupoPrimario === 'peito').slice(0, 2).map((e) => e.id);
    expect(doisDoPeito).toHaveLength(2);
    const c = contarFrequencia([sessao('2026-07-28', doisDoPeito)], j, porId);
    expect(c.porGrupo.peito).toBe(1);
  });

  it('o mesmo grupo em sessões diferentes soma', () => {
    const p = ex('peito', 'empurrar').id;
    const c = contarFrequencia([sessao('2026-07-28', [p]), sessao('2026-07-30', [p])], j, porId);
    expect(c.porGrupo.peito).toBe(2);
    expect(c.sessoes).toBe(2);
  });

  it('calibração e sinal de fadiga não contam sessão nenhuma', () => {
    const p = ex('peito', 'empurrar').id;
    const c = contarFrequencia(
      [sessao('2026-07-28', [p], 'calibracao'), sessao('2026-07-29', [p], 'sinal_fadiga')], j, porId,
    );
    expect(c.sessoes).toBe(0);
    expect(c.porGrupo.peito).toBeUndefined();
  });

  it('a sessão de cardio conta no grupo e no padrão `cardio`', () => {
    const c = contarFrequencia([{ dataISO: '2026-07-28', tipo: 'cardio', exercicios: [] }], j, porId);
    expect(c.porGrupo.cardio).toBe(1);
    expect(c.porPadrao.cardio).toBe(1);
  });

  it('🟡 treino manual sem grupo mapeado não entra na contagem — mas fica contabilizado', () => {
    const c = contarFrequencia([sessao('2026-07-28', ['exercicio-livre-do-usuario'])], j, porId);
    expect(c.sessoes).toBe(1);           // a Chama contaria o dia
    expect(c.semGrupo).toBe(1);          // e a tela sabe explicar por que não aparece aqui
    expect(Object.keys(c.porGrupo)).toHaveLength(0);
  });

  it('grupos sem registro simplesmente não aparecem no mapa (a tela os renderiza em 0×)', () => {
    const c = contarFrequencia([sessao('2026-07-28', [ex('peito', 'empurrar').id])], j, porId);
    expect(c.porGrupo.panturrilha).toBeUndefined();
    // e a ordem da lista é a fixa, não a das contagens
    expect(GRUPOS_ORDEM.indexOf('panturrilha')).toBeGreaterThan(GRUPOS_ORDEM.indexOf('peito'));
  });
});

/**
 * Guard-rail ESTÁTICO da peça — molde do `rls-migrations.test.ts`. Trava o que uma
 * refatoração bem-intencionada apagaria sem quebrar nada visível.
 */
describe('a tela é espelho, não nota (guard-rail da peça)', () => {
  const PECA = readFileSync(join(process.cwd(), 'src', 'components', 'painel', 'FrequenciaGrupos.tsx'), 'utf8');
  const CODIGO = PECA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('🔒 vocabulário proibido: meta · ideal · ótimo · negligenciado · ranking · score', () => {
    expect(CODIGO).not.toMatch(/\bmeta\b|\bideal\b|\bótimo\b|\botimo\b|negligenciad|\branking\b|\bscore\b/i);
  });

  it('não chama de erro quem está abaixo da marca', () => {
    expect(CODIGO).toMatch(/sem que isso seja problema/);
    expect(CODIGO).not.toMatch(/você (deveria|precisa) (treinar|fazer)|corrija|está errado/i);
  });

  it('SOMENTE LEITURA: nenhum campo e nenhum controle que altere o plano', () => {
    expect(CODIGO).not.toMatch(/<(input|textarea|select|form)\b/);
    expect(CODIGO).not.toMatch(/onSalvar|onAlterar|recomputarPlano|setPerfil/);
  });

  it('a ordem da lista vem de REGIOES (fixa) — nunca de um sort por contagem', () => {
    expect(CODIGO).toContain('REGIOES.map');
    expect(CODIGO).not.toMatch(/\.sort\(/);
  });

  it('o marcador é condicional — a barra só recebe marca quando existe régua', () => {
    expect(CODIGO).toMatch(/marca != null && \(/);
  });

  it('o seletor de período é tablist real, com aria-selected', () => {
    expect(CODIGO).toMatch(/role="tablist"/);
    expect(CODIGO).toMatch(/role="tab"/);
    expect(CODIGO).toMatch(/aria-selected=\{on\}/);
  });

  it('as linhas-fantasma do estado vazio são decorativas (aria-hidden)', () => {
    expect(CODIGO).toMatch(/<div aria-hidden style=\{\{ opacity: 0\.35 \}\}>/);
  });
});
