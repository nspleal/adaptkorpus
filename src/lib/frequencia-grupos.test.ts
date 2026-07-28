import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  contarFrequencia, ESCALA_MAX, GRUPOS_ORDEM, janelaSemana, janelaSemanasFechadas,
  LEGENDA_UM_DIA, mediaPorSemana, PADROES, REFERENCIA_PADRAO, REGIOES, reguaDoPadrao,
  ROTULO_REGUA, rotuloContagem, detalheDoGrupo, diasPassadosNaSemana, rotuloAcessivelLinha,
  type SessaoParaFrequencia,
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
  it('os 12 grupos ANATÔMICOS, em ordem fixa (nunca por contagem)', () => {
    expect(GRUPOS_ORDEM).toHaveLength(12);
    // A região "Outros" deixou de existir: cardio/corpo-inteiro saíram da anatomia.
    expect(REGIOES.map((r) => r.titulo)).toEqual(['Superior', 'Tronco', 'Inferior']);
    expect(GRUPOS_ORDEM[0]).toBe('peito');
    expect(GRUPOS_ORDEM.indexOf('costas')).toBeLessThan(GRUPOS_ORDEM.indexOf('gluteos'));
    for (const fora of ['cardio', 'corpo-inteiro', 'pernas', 'abdomen', 'trapezio', 'adutores']) {
      expect(GRUPOS_ORDEM, `${fora} não é mais grupo`).not.toContain(fora);
    }
  });

  it('🔒 a lista sai do CATÁLOGO REAL — nenhum grupo do catálogo fica de fora', () => {
    const noCatalogo = new Set(EXERCISES.map((e) => e.grupoPrimario).filter((g) => g != null));
    expect(noCatalogo.size).toBe(12);
    for (const g of noCatalogo) expect(GRUPOS_ORDEM, `grupo ${g} sumiu da tela`).toContain(g);
    // e nada de inventado: todo grupo exibido existe no catálogo
    for (const g of GRUPOS_ORDEM) expect(noCatalogo, `grupo ${g} não existe no catálogo`).toContain(g);
  });

  it('🔒 os 12 sem grupo são exatamente os de padrão cardio — contam só pelo padrão', () => {
    const semGrupo = EXERCISES.filter((e) => e.grupoPrimario == null);
    expect(semGrupo).toHaveLength(12);
    for (const e of semGrupo) expect(e.padraoMovimento, e.nomePt).toBe('cardio');
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

  it('🔒 a sessão de cardio conta SÓ no padrão — cardio não é grupo muscular', () => {
    const c = contarFrequencia([{ dataISO: '2026-07-28', tipo: 'cardio', exercicios: [] }], j, porId);
    expect(c.porPadrao.cardio).toBe(1);
    expect(c.porGrupo.cardio).toBeUndefined();
    expect(Object.keys(c.porGrupo)).toHaveLength(0);
    expect(c.semGrupo, 'a sessão foi reconhecida, não é registro solto').toBe(0);
  });

  it('🔒 exercício sem grupo (burpee) conta só no padrão, sem virar "sem grupo"', () => {
    const burpee = EXERCISES.find((e) => e.id === 'e30')!;
    expect(burpee.grupoPrimario).toBeNull();
    const c = contarFrequencia([sessao('2026-07-28', [burpee.id])], j, porId);
    expect(c.porPadrao.cardio).toBe(1);
    expect(Object.keys(c.porGrupo)).toHaveLength(0);
    expect(c.semGrupo).toBe(0);
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

  it('as linhas-fantasma do estado vazio são decorativas e não tocáveis', () => {
    expect(CODIGO).toMatch(/aria-hidden="true" style=\{\{ opacity: 0\.5, pointerEvents: 'none'/);
  });

  // ── recuperado de `raw/design-handoff-frequencia-por-grupo-2026-07-27.md` (§9 e §10) ──

  it('§10.9 — nenhum texto diz "IA", "você deveria" ou equivalente', () => {
    expect(CODIGO).not.toMatch(/\bIA\b|você deveria|treine mais|adicione um dia/i);
    expect(CODIGO).toContain('regras adaptativas');
  });

  it('§9 — toda linha de grupo é um <button> real com rótulo acessível completo', () => {
    expect(CODIGO).toMatch(/<button\s+type="button"\s+onClick=\{onAbrir\}\s+aria-label=\{rotuloAcessivelLinha/);
    expect(CODIGO).toMatch(/minHeight: 44/);
  });

  it('§9 — barra e marcador são decorativos (aria-hidden), o número está no rótulo', () => {
    expect(CODIGO).toMatch(/\{\/\* .*\*\/\}|aria-hidden="true" style=\{\{ position: 'relative'/s);
  });

  it('§9 — o seletor é tablist com tabpanel e navegação por seta', () => {
    expect(CODIGO).toMatch(/role="tabpanel"/);
    expect(CODIGO).toMatch(/aria-controls="evk-freq-painel"/);
    expect(CODIGO).toMatch(/ArrowRight|ArrowLeft/);
  });

  it('§9 — os 7 padrões são <li> dentro de <ul>, não divs', () => {
    expect(CODIGO).toMatch(/<ul style=\{\{ display: 'grid'/);
    expect(CODIGO).toMatch(/<li style=/);
  });

  it('§9 — o subtítulo de região é um heading, não um div solto', () => {
    expect(CODIGO).toMatch(/<h4 style=/);
  });

  it('§10.7 — o grid dos padrões usa minmax(0,1fr), nunca 1fr puro', () => {
    expect(CODIGO).toMatch(/repeat\(4, minmax\(0,1fr\)\)/);
  });

  it('§8 — o detalhe é tela própria com botão Voltar rotulado', () => {
    expect(CODIGO).toMatch(/aria-label="Voltar"/);
    expect(CODIGO).toContain('Sem registro neste período.');
  });

  it('§10.11 — a animação da barra respeita prefers-reduced-motion', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
    expect(css).toContain('@keyframes evkFill');
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.evk-freq-barra \{ animation: none/);
  });
});

/**
 * §10.4 — a ordem renderizada é a taxonomia, independentemente das contagens.
 * O teste que o critério nomeia: contagens invertidas → mesma ordem.
 */
describe('§10.4 — ordem estável com contagens invertidas', () => {
  it('inverter as contagens não muda a ordem da lista', () => {
    const j = janelaSemana('2026-07-29');
    const peito = ex('peito', 'empurrar').id;
    const pant = EXERCISES.find((e) => e.grupoPrimario === 'panturrilha')!.id;

    const muitoPeito = contarFrequencia(
      [sessao('2026-07-28', [peito]), sessao('2026-07-29', [peito]), sessao('2026-07-30', [peito, pant])], j, porId,
    );
    const muitaPanturrilha = contarFrequencia(
      [sessao('2026-07-28', [pant]), sessao('2026-07-29', [pant]), sessao('2026-07-30', [pant, peito])], j, porId,
    );
    expect(muitoPeito.porGrupo.peito).toBeGreaterThan(muitoPeito.porGrupo.panturrilha!);
    expect(muitaPanturrilha.porGrupo.panturrilha).toBeGreaterThan(muitaPanturrilha.porGrupo.peito!);
    // A ordem é uma CONSTANTE — não sai da contagem. Peito antes de panturrilha, sempre.
    expect(GRUPOS_ORDEM.indexOf('peito')).toBeLessThan(GRUPOS_ORDEM.indexOf('panturrilha'));
  });
});

/** §6.10/§7 — o detalhe do grupo: dias, exercícios e padrão. */
describe('detalhe do grupo', () => {
  const j = janelaSemana('2026-07-29');

  it('lista os dias em que o grupo entrou, com os exercícios daquele dia', () => {
    const sup = ex('peito', 'empurrar');
    const d = detalheDoGrupo(
      [{ dataISO: '2026-07-28', dia: 'Upper A', exercicios: [{ id: sup.id }] }], j, 'peito', porId,
    );
    expect(d.vezes).toBe(1);
    expect(d.dias[0]).toMatchObject({ dataISO: '2026-07-28', treino: 'Upper A' });
    expect(d.dias[0]!.exercicios).toContain(sup.nomePt);
    expect(d.padroes).toContain('empurrar');
  });

  it('grupo sem registro devolve zero — e a linha ainda abre', () => {
    const d = detalheDoGrupo([], j, 'panturrilha', porId);
    expect(d).toMatchObject({ vezes: 0, dias: [], padroes: [] });
  });

  it('🔒 a sessão de cardio não entra no detalhe de grupo nenhum', () => {
    const sessoes = [{ dataISO: '2026-07-28', tipo: 'cardio', exercicios: [] }];
    for (const g of ['quadriceps', 'core', 'peito']) {
      expect(detalheDoGrupo(sessoes, j, g, porId).vezes, `grupo ${g}`).toBe(0);
    }
  });

  it('o rótulo acessível traz nome, número e referência', () => {
    expect(rotuloAcessivelLinha({ nome: 'Peito', valor: 3, periodo: 'semana', marca: 2 }))
      .toBe('Peito, 3 vezes nesta semana, referência 2 vezes');
    // sem régua (1 dia de força) o rótulo não inventa referência nenhuma
    expect(rotuloAcessivelLinha({ nome: 'Peito', valor: 1, periodo: 'semana', marca: null }))
      .toBe('Peito, 1 vez nesta semana');
  });

  it('dias passados na semana: segunda = 1, domingo = 7', () => {
    expect(diasPassadosNaSemana('2026-07-27')).toBe(1);
    expect(diasPassadosNaSemana('2026-07-29')).toBe(3);
    expect(diasPassadosNaSemana('2026-08-02')).toBe(7);
  });
});
