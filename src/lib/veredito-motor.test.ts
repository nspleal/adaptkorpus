import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recomputarPlano } from './plano';
import { EXERCISES_SEED } from './data/seed';
import { vereditoDoPlano } from './veredito-motor';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { ResultadoGeracaoRotina, RotinaSemanal } from './engine/treino-types';
import type { Weekday } from './semana';

/**
 * 🔴 D1 (diagnóstico 2026-09-10, §6.2) — os avisos e o veredito CHEGAM à interface.
 *
 * Medido no SHA `34b2ede`: varredura de `src` (fora de `engine/` e dos testes) → **zero
 * consumidores** de `rotina.avisos`, `rotina.resultadoGeracao` e `rotina.duracaoIncompativel`.
 * O único `avisos` renderizado era o da DIETA (`Painel.tsx:1563`, onde `plano = dieta.plano!`).
 *
 * O que este arquivo cobra, nas duas metades que o diagnóstico separou (B1 e B2):
 *  · toda família de aviso do montador tem um caso que a produz E um caminho até um
 *    componente renderizado;
 *  · todos os valores de `ResultadoGeracaoRotina` viram texto na tela, inclusive o bom.
 */

const raiz = (...p: string[]) => join(process.cwd(), ...p);
const semComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

const MONTADOR = semComentarios(readFileSync(raiz('src', 'lib', 'engine', 'treino-montador.ts'), 'utf8'));
const COMPONENTE = semComentarios(readFileSync(raiz('src', 'components', 'painel', 'AvisosMotor.tsx'), 'utf8'));
const PAINEL = semComentarios(readFileSync(raiz('src', 'components', 'painel', 'Painel.tsx'), 'utf8'));
const TIPOS = readFileSync(raiz('src', 'lib', 'engine', 'treino-types.ts'), 'utf8');

const base = (o: Record<string, unknown> = {}): PerfilResumo => ({
  sexo: 'masculino', idade: 30, alturaCm: 178, pesoKg: 80,
  nivelAtividade: 'moderado', objetivo: 'massa',
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qui', 'sab'], tempoPorSessaoMin: 60,
  alergenos: [], preferencia: null, naoCurto: [], pratosCansados: [], favoritos: [], ...o,
} as unknown as PerfilResumo);

const gerar = (o: Record<string, unknown> = {}, opcoes: Record<string, unknown> = {}) =>
  recomputarPlano(base(o), { semanaCiclo: { semana: 1 }, ...opcoes }).treino.rotina;

const SEIS_DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
/** Desenho do usuário só com empurrar: dispara as três invariantes estruturais de uma vez. */
const SO_EMPURRAR = (() => {
  const ids = EXERCISES_SEED
    .filter((e) => e.padraoMovimento === 'empurrar' && e.local === 'academia')
    .slice(0, 3).map((e) => e.id);
  return { origem: 'usuario', dias: [
    { nome: 'A', diaId: 'seg', exercicioIds: ids },
    { nome: 'B', diaId: 'qui', exercicioIds: ids },
  ] };
})();

/* ══════════════════ O CANAL: motor → componente ══════════════════ */

describe('D1 — o canal existe e é verbatim', () => {
  it('anti-vacuidade: o montador realmente emite avisos (senão nada aqui é provado)', () => {
    const familias = (MONTADOR.match(/avisos\.push\(/g) ?? []).length;
    expect(familias, 'nenhum `avisos.push(` no montador — a varredura perdeu o alvo').toBeGreaterThanOrEqual(9);
  });

  it('o componente lê `rotina.avisos` e os renderiza um a um, sem filtrar nem reescrever', () => {
    expect(COMPONENTE).toMatch(/rotina\?\.avisos/);
    expect(COMPONENTE).toMatch(/avisos\.map\(/);
    // O texto vai como veio: nada de `.filter(`, `.slice(`, `.replace(` sobre os avisos.
    expect(/avisos[\s\S]{0,40}\.(filter|slice|replace)\(/.test(COMPONENTE),
      'o componente filtra ou reescreve os avisos do motor — vira um segundo sistema de avisos').toBe(false);
  });

  it('o componente é montado numa aba do Painel, com a rotina real', () => {
    expect(PAINEL, 'AvisosMotor não é importado no Painel').toMatch(/import AvisosMotor from '\.\/AvisosMotor'/);
    expect(PAINEL, 'AvisosMotor não é renderizado').toMatch(/<AvisosMotor\s+rotina=\{rotina\}/);
    expect(PAINEL, 'a rotina do motor não é repassada à aba').toMatch(/rotina=\{treino\.rotina \?\? null\}/);
  });

  it('o aviso renderizado NÃO é o da dieta (o único que já aparecia)', () => {
    expect(/dieta/i.test(COMPONENTE), 'o componente do motor foi ligado ao plano da dieta').toBe(false);
  });
});

/* ══════════════════ B1 — cada família de aviso tem um caso que a produz ══════════════════ */

/**
 * As famílias, com um perfil que as produz. O nº de entradas é cobrado contra o nº de
 * `avisos.push(` do montador: uma família nova nasce descoberta e derruba este teste, em vez
 * de entrar em silêncio. (`avisos.push(...avisosCustom)` é repasse, não família própria.)
 */
const FAMILIAS: readonly [string, RegExp, () => RotinaSemanal | null | undefined][] = [
  ['complementares ausentes', /Cobertura direta ausente/, () => gerar({ rotinaCustom: SO_EMPURRAR })],
  ['foco sem exercício', /O foco não foi atendido integralmente/, () => gerar({ equipamento: 'nenhum', foco: { grupo: 'antebraco', compensa: 'peito', semana: 1 } })],
  ['focos conflitantes', /duas escolhas de foco/, () => gerar({ foco: { grupo: 'peito', compensa: 'costas', semana: 1 }, focoAgregado: { grupo: 'bracos', semana: 1 } })],
  ['distribuição original limitada', /Distribuição planejada.*não atendida integralmente/, () => gerar({ nivelExperiencia: 'avancado', treinoDias: ['seg','ter','qua'], diasDisponiveis: 3, tempoPorSessaoMin: 90, focoAgregado: { grupo: 'pernas', semana: 1 } })],
  ['agenda limita', /agenda limita/, () => gerar({ treinoDias: ['seg','ter'], diasDisponiveis: 2 })],
  ['manual com foco', /ordem do seu treino foi preservada/, () => gerar({ rotinaCustom: SO_EMPURRAR, foco: { grupo: 'peito', compensa: 'costas', semana: 1 } })],
  ['escolhas inelegíveis', /não elegíveis no perfil/, () => gerar({ rotinaCustom: SO_EMPURRAR, equipamento: 'casa', equipamentosCasa: [] })],
  ['retomada · frequência limitada', /Retomada: frequ/, () => gerar({ rotinaCustom: { origem: 'usuario', dias: SEIS_DIAS.map(diaId => ({ nome: diaId, diaId, exercicioIds: ['e1'] })) } }, { semanaCiclo: { semana: 3, retomada: { semana: 1, fator: 0.5, volumeReferencia: 14 } } })],
  ['retomada · volume reduzido', /Retomada: volume reduzido/, () => gerar({}, { semanaCiclo: { semana: 3, retomada: { semana: 1, fator: 0.5, volumeReferencia: 14 } } })],
  ['alvo do grupo não cabe nos exercícios', /alvo de \d+ s[ée]ries para/, () => gerar({ nivelExperiencia: 'avancado', diasDisponiveis: 6, treinoDias: SEIS_DIAS, tempoPorSessaoMin: 90 }, { semanaCiclo: { semana: 5 } })],
  /**
   * 🔎 ACHADO desta rodada: as três invariantes estruturais abaixo NÃO são alcançáveis pelo
   * alocador automático — varri 1.800 perfis (5 equipamentos × 3 níveis × 4 agendas × 6
   * tempos × 2 semanas) e nenhuma disparou, porque o alocador as garante por construção (é o
   * que `treino-montador.test.ts` já cobra no smoke). Elas existem para o plano do USUÁRIO,
   * que pode desenhar o que quiser — e é por lá que este teste as produz. Não são aviso
   * morto: são a rede do editor guiado, que antes de D1 ninguém via.
   */
  ['puxar abaixo de empurrar', /volume de puxar ficou abaixo/, () => gerar({ rotinaCustom: SO_EMPURRAR })],
  ['dobradiça/quadril não coberta', /dobradi[çc]a\/quadril/, () => gerar({ rotinaCustom: SO_EMPURRAR })],
  ['core fora de 2–3×', /core fora da faixa/, () => gerar({ rotinaCustom: SO_EMPURRAR })],
  ['sessão curta', /Tempo por sess[ãa]o curto/, () => gerar({ tempoPorSessaoMin: 15 })],
  ['grupo abaixo do mínimo', /ficou abaixo do m[íi]nimo desta semana/, () => gerar({ equipamento: 'casa', equipamentosCasa: [] })],
  ['limite de catálogo (equipamento destrava)', /Chegamos ao limite de .* sem equipamento/, () => gerar({ equipamento: 'casa', equipamentosCasa: [], nivelExperiencia: 'iniciante', diasDisponiveis: 1, treinoDias: ['seg'], tempoPorSessaoMin: 10 })],
  ['equipamento limita o dia', /Seu equipamento dispon[íi]vel limita/, () => gerar({ equipamento: 'casa', equipamentosCasa: [] })],
  ['dia curto pelo teto semanal', /mais curtos? de prop[óo]sito/, () => gerar({ diasDisponiveis: 6, treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], nivelExperiencia: 'avancado', tempoPorSessaoMin: 90 })],
  ['séries manuais inválidas (D3)', /n[ãa]o [ée] um n[úu]mero inteiro/, () => gerar({ rotinaCustom: { origem: 'usuario', dias: [{ nome: 'A', diaId: 'seg', exercicioIds: ['e1'], seriesPorExercicio: { e1: 0 } }] } })],
  ['cardio faltante (D4)', /Cardio: o plano pede/, () => gerar({ objetivo: 'emagrecimento', diasDisponiveis: 3, treinoDias: ['seg', 'qua', 'sex'] }, { diasOferecidosCardio: ['ter', 'qua', 'sex', 'dom'] as readonly Weekday[] })],
  ['dias do desenho acima do teto do nível', /o seu n[íi]vel comporta/, () => gerar({ nivelExperiencia: 'iniciante', rotinaCustom: { origem: 'usuario', dias: (['seg', 'ter', 'qua', 'qui', 'sex'] as const).map((d) => ({ nome: d, diaId: d, exercicioIds: ['e1'] })) } })],
];

describe('D1 · B1 — cada família de aviso do montador tem caso e caminho até a tela', () => {
  it('a lista cobre TODOS os pontos de emissão do montador (um novo derruba este teste)', () => {
    const sites = (MONTADOR.match(/avisos\.push\(/g) ?? []).length
      + (MONTADOR.match(/avisosCustom\.push\(/g) ?? []).length
      - (MONTADOR.match(/avisos\.push\(\.\.\.avisosCustom\)/g) ?? []).length;
    // Tripwire: um `avisos.push` novo entra descoberto e derruba este teste em vez de virar
    // mais um aviso que ninguém prova que chega à tela — o defeito que D1 fecha.
    expect(sites, 'um ponto de emissão de aviso entrou (ou saiu) sem caso nesta lista').toBe(20);
    // ≥ porque um dos pontos (o guard de cobertura) emite DUAS mensagens, num ternário.
    expect(FAMILIAS.length, `${sites} pontos de emissão, ${FAMILIAS.length} casos`).toBeGreaterThanOrEqual(sites);
  });

  it.each(FAMILIAS)('%s: existe perfil que a produz, e o texto sai em `rotina.avisos`', (_nome, re, caso) => {
    const r = caso();
    expect(r, 'o perfil do caso não gerou rotina').toBeTruthy();
    expect(r!.avisos.find((a) => re.test(a)), `nenhum aviso casa com ${re}: ${JSON.stringify(r!.avisos)}`)
      .toBeDefined();
  });
});

/* ══════════════════ B2 — todos os vereditos viram texto ══════════════════ */

const VEREDITOS: readonly ResultadoGeracaoRotina[] = [
  { tipo: 'CERTIFICADO', capacidadeTerminal: 6 },
  { tipo: 'NAO_AVALIADO_ENTREGAVEL', motivos: ['CARDIO_SEM_DURACAO'] },
  { tipo: 'ENTREGUE_SEM_CERTIFICACAO', diasAcimaDoLimite: [0] },
  { tipo: 'INCOMPATIVEL', capacidadeMinimaTestada: 3 },
  { tipo: 'ERRO_ALOCADOR', motivo: 'INVARIANTE_VIOLADO', capacidadeTestada: 4, violacoesInvariantes: ['puxar'] },
];

const rotinaFake = (rg: ResultadoGeracaoRotina) =>
  ({ dias: [{ nome: 'Upper A', slots: [] }], resultadoGeracao: rg }) as unknown as RotinaSemanal;

describe('D1 · B2 — os CINCO valores de resultadoGeracao chegam à tela', () => {
  it('a lista cobre a união inteira do discriminante (um valor novo derruba este teste)', () => {
    const declarados = [...TIPOS.matchAll(/\|\s*\{\s*tipo:\s*'([A-Z_]+)'/g)].map((m) => m[1]!);
    expect(new Set(declarados), `declarados no tipo: ${declarados.join(', ')}`)
      .toEqual(new Set(VEREDITOS.map((v) => v.tipo)));
  });

  it.each(VEREDITOS)('$tipo vira uma frase com tom e sem jargão de discriminante', (rg) => {
    const v = vereditoDoPlano(rotinaFake(rg), 60);
    expect(v, `${rg.tipo} não produz veredito`).not.toBeNull();
    expect(v!.titulo.length, 'título vazio').toBeGreaterThan(20);
    expect(['ok', 'atencao', 'bloqueio']).toContain(v!.tom);
    // O nome interno do estado nunca aparece para a pessoa.
    expect(`${v!.titulo} ${v!.detalhe ?? ''}`).not.toContain(rg.tipo);
  });

  it('CERTIFICADO fala (um veredito que só aparece quando dá errado ensina a ignorá-lo)', () => {
    const v = vereditoDoPlano(rotinaFake({ tipo: 'CERTIFICADO', capacidadeTerminal: 6 }), 45);
    expect(v!.tom).toBe('ok');
    expect(v!.detalhe).toContain('45 min');
    expect(v!.detalhe).toContain('8 min');
  });

  it('ENTREGUE_SEM_CERTIFICACAO nomeia o dia sem prometer escolhas intactas no deload', () => {
    const v = vereditoDoPlano(rotinaFake({ tipo: 'ENTREGUE_SEM_CERTIFICACAO', diasAcimaDoLimite: [0] }), 60);
    expect(v!.detalhe).toContain('Upper A');
    expect(v!.detalhe).toMatch(/Revise o tempo/);
    expect(v!.detalhe).not.toMatch(/n[ãa]o mexemos/i);
  });

  it('sem rotina ou sem veredito, nada é inventado', () => {
    expect(vereditoDoPlano(null, 60)).toBeNull();
    expect(vereditoDoPlano({ dias: [], resultadoGeracao: undefined }, 60)).toBeNull();
  });

  it('o componente cobre os três tons (nenhum cai num ramo sem estilo)', () => {
    for (const tom of ['ok', 'atencao', 'bloqueio']) expect(COMPONENTE).toContain(`${tom}:`);
  });
});

/* ══════════════════ D4 — a conta do cardio na tela ══════════════════ */

describe('D1/D4 — a conta do cardio aparece UMA vez, pelo canal do motor', () => {
  it('os três números chegam à tela como aviso do motor, com planejado, entregue e faltante', () => {
    const r = gerar(
      { objetivo: 'emagrecimento', diasDisponiveis: 3, treinoDias: ['seg', 'qua', 'sex'] },
      { diasOferecidosCardio: ['ter', 'qua', 'sex', 'dom'] as readonly Weekday[] },
    )!;
    const c = r.cardioSemana!;
    const aviso = r.avisos.find((a) => /Cardio: o plano pede/.test(a))!;
    expect(aviso, 'a perda não virou aviso').toBeDefined();
    for (const seg of [c.prescritoSegundos, c.entregueSegundos, c.faltanteSegundos]) {
      expect(aviso).toContain(String(Math.round(seg / 60)));
    }
  });

  /**
   * 🔎 Medido no navegador (2026-09-10): a primeira versão desta faixa montava uma linha
   * PRÓPRIA de cardio ao lado dos avisos, e os mesmos três números apareciam duas vezes na
   * tela. A linha saiu: quem fala da conta é o motor.
   */
  it('o componente não monta uma segunda linha de cardio (seria o número repetido)', () => {
    expect(/cardioSemana/.test(COMPONENTE), 'o componente voltou a montar a conta do cardio').toBe(false);
    expect(/linhaCardio/.test(COMPONENTE)).toBe(false);
  });

  it('o cartão de cardio do Painel usa a PRESCRIÇÃO, não a soma do entregue', () => {
    expect(PAINEL).toMatch(/prescritoMin:[\s\S]{0,200}cardioSemana\.prescritoSegundos/);
    expect(/prescritoMin:\s*\(treino\.rotina\?\.diasCardio/.test(PAINEL),
      'o denominador voltou a ser a soma do entregue').toBe(false);
  });
});
