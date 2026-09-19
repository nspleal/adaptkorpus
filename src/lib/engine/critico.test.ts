/**
 * 🧭 O CRÍTICO — aceites do handoff-editor-guiado-2026-08-13, medidos.
 *
 * 🔑 O guard que mais importa neste arquivo é o de NÃO-DUPLICAÇÃO: o placar tem de ser a
 * saída de `creditoPonderadoDaSemana` (a conta do alocador v4), não um número parecido
 * calculado aqui. Duas verdades para o mesmo número é a classe que o cofre já nomeou.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { avaliarSemana, placarDaSemana, recomendacoes, avisos, type DiaDoEditor, type ContextoCritico } from './critico';
import { creditoPonderadoDaSemana } from './alocador';
import { INTERVALO_MIN_HORAS_MESMO_GRUPO, mev, mrv } from './trilhos';
import { EXERCISES } from '../data/exercises';

const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;
const ex = byId;
const CTX: ContextoCritico = { nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 60, seriesPadrao: 4 };

/** Um dia com N exercícios de um grupo (pelo pool real da biblioteca). */
const diaDe = (nome: string, ids: string[]): DiaDoEditor => ({ nome, exercicios: ids.map(byId) });

/** Dia com séries/descanso por slot (o plano final que a fórmula canônica C1 avalia). */
const diaCompleto = (nome: string, ids: string[], series = 4, desc = 90): DiaDoEditor =>
  ({ nome, exercicios: ids.map(byId), series: ids.map(() => series), descansoSeg: ids.map(() => desc) });

describe('🔒 o placar É a conta do alocador v4 — nunca uma segunda conta', () => {
  it('o ponderado do placar bate com `creditoPonderadoDaSemana` slot a slot', () => {
    const dias = [diaDe('A', ['e1', 'e22', 'e14']), diaDe('B', ['e16', 'e26', 'e19'])];
    const placar = placarDaSemana(dias, CTX);
    const esperado = creditoPonderadoDaSemana(
      dias.flatMap((d) => d.exercicios.map((e) => ({ exercicio: e, series: 4 }))),
    );
    for (const linha of placar) {
      expect(linha.ponderado, linha.grupo).toBe(Math.round((esperado.get(linha.grupo) ?? 0) * 10) / 10);
    }
  });

  it('o secundário conta 0,5 — o peito de uma flexão credita tríceps e ombros', () => {
    // e1 Flexão: primário peito · secundários tríceps + ombros.
    const placar = placarDaSemana([diaDe('A', ['e1'])], CTX);
    const peito = placar.find((l) => l.grupo === 'peito')!;
    const ombros = placar.find((l) => l.grupo === 'ombros')!;
    expect(peito.ponderado).toBe(4);   // 4 séries × 1,0
    expect(ombros.ponderado).toBe(2);  // 4 séries × 0,5
  });

  it('as bandas vêm de `mev`/`mrv` — o placar não redigita número de nível', () => {
    const placar = placarDaSemana([diaDe('A', ['e1'])], CTX);
    // 2026-09-19: só quem TEM faixa carrega mev/mrv; os demais estão no placar sem referência.
    expect(placar.filter((l) => l.temFaixa)).toHaveLength(6);
    for (const l of placar) {
      if (!l.temFaixa) { expect(l.mev).toBeUndefined(); expect(l.status).toBe('sem_referencia'); continue; }
      expect(l.mev).toBe(mev('intermediario', 'massa'));
      expect(l.mrv).toBe(mrv('intermediario', 'massa'));
    }
  });

  /** 🔒 Guard estático: o arquivo não pode ter uma soma ponderada própria. */
  it('o módulo não reimplementa a contagem (sem 0.5 solto, sem soma paralela)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/engine/critico.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
    expect(src, 'o crítico deixou de chamar a conta do alocador').toMatch(/creditoPonderadoDaSemana\(/);
    expect(/\b0\.5\b/.test(src), 'peso 0,5 redigitado — a conta voltou a ser duplicada').toBe(false);
    expect(/secundariosDe\(/.test(src), 'o crítico passou a derivar secundários por conta própria').toBe(false);
  });
});

describe('🟡 recomendações — o exemplo literal do autor', () => {
  it('🔴 aceite — ombros abaixo + peito acima ⇒ sugere trocar 1 por 1', () => {
    // 5 exercícios de peito (20 séries ponderadas > MRV 16) e nenhum de ombro direto.
    const dias = [diaDe('A', ['e1', 'e10', 'e11', 'e14', 'e15']), diaDe('B', ['e16', 'e17'])];
    const { recomendacoes: recs } = avaliarSemana(dias, CTX);
    const troca = recs.find((r) => r.codigo === 'trocar_um_por_outro');
    expect(troca, `recomendações: ${recs.map((r) => r.codigo).join(',')}`).toBeDefined();
    expect(troca!.texto).toMatch(/^Tente trocar 1 exerc[íi]cio de peito por 1 de /);
    expect(troca!.severidade).toBe('recomendacao');
  });

  it('grupo grande esquecido ganha a frase da faixa mínima', () => {
    const recs = recomendacoes(placarDaSemana([diaDe('A', ['e1'])], CTX));
    const abaixo = recs.filter((r) => r.codigo === 'grupo_abaixo_do_minimo');
    expect(abaixo.length).toBeGreaterThan(0);
    expect(abaixo[0]!.texto).toMatch(/abaixo da faixa mínima desta semana/);
  });

  it('semana equilibrada não inventa recomendação de troca', () => {
    // Nada acima do MRV → sem sugestão de troca (só as de faixa mínima, que são informativas).
    const recs = recomendacoes(placarDaSemana([diaDe('A', ['e1', 'e22'])], CTX));
    expect(recs.some((r) => r.codigo === 'trocar_um_por_outro')).toBe(false);
  });
});

describe('🔴 avisos — risco explicado que NÃO trava (DF①)', () => {
  it('🔴 aceite — peito em dias seguidos dispara o aviso (e nada no retorno bloqueia)', () => {
    const dias = [diaDe('Seg', ['e1']), diaDe('Ter', ['e10']), diaDe('Qua', ['e11'])];
    const itens = avisos(dias, placarDaSemana(dias, CTX), { ...CTX, diasDaSemanaIdx: [0, 1, 2] });
    const consecutivos = itens.filter((a) => a.codigo === 'dias_consecutivos');
    expect(consecutivos.length).toBeGreaterThan(0);
    expect(consecutivos[0]!.texto).toMatch(new RegExp(`${INTERVALO_MIN_HORAS_MESMO_GRUPO} horas`));
    expect(consecutivos[0]!.severidade).toBe('risco');
    // 🔒 DF①: o objeto do aviso NÃO tem como travar — não existe campo de bloqueio.
    expect(Object.keys(consecutivos[0]!).sort()).toEqual(['codigo', 'severidade', 'texto']);
  });

  it('dias espaçados (Seg/Qui) NÃO disparam o aviso — o par discriminante', () => {
    const dias = [diaDe('Seg', ['e1']), diaDe('Qui', ['e10'])];
    const itens = avisos(dias, placarDaSemana(dias, CTX), { ...CTX, diasDaSemanaIdx: [0, 3] });
    expect(itens.some((a) => a.codigo === 'dias_consecutivos')).toBe(false);
  });

  it('a volta da semana conta: Sáb + Seg são 48 h — passa; Dom + Seg são 24 h — avisa', () => {
    const sabSeg = [diaDe('Sáb', ['e1']), diaDe('Seg', ['e10'])];
    expect(avisos(sabSeg, placarDaSemana(sabSeg, CTX), { ...CTX, diasDaSemanaIdx: [5, 0] })
      .some((a) => a.codigo === 'dias_consecutivos')).toBe(false);
    const domSeg = [diaDe('Dom', ['e1']), diaDe('Seg', ['e10'])];
    expect(avisos(domSeg, placarDaSemana(domSeg, CTX), { ...CTX, diasDaSemanaIdx: [6, 0] })
      .some((a) => a.codigo === 'dias_consecutivos')).toBe(true);
  });

  it('sem agenda declarada, o aviso de intervalo NÃO é emitido (não se afirma sem base)', () => {
    const dias = [diaDe('A', ['e1']), diaDe('B', ['e10'])];
    expect(avisos(dias, placarDaSemana(dias, CTX), CTX).some((a) => a.codigo === 'dias_consecutivos')).toBe(false);
  });

  /**
   * 🔵 2026-09-17 — o número do aviso passou de 16 para 19: `acima_do_maximo` é medido contra
   * o TETO CHEIO, não contra o topo da faixa desejada. A redação anterior cobrava
   * «contra 16 séries», que hoje é o máximo AUTOMÁTICO e tem aviso próprio.
   */
  it('acima do TETO CHEIO avisa, com o número medido', () => {
    const dias = [diaDe('A', ['e1', 'e10', 'e11', 'e14', 'e15'])];
    const itens = avisos(dias, placarDaSemana(dias, CTX), CTX);
    const acima = itens.find((a) => a.codigo === 'acima_do_maximo');
    expect(acima).toBeDefined();
    expect(acima!.texto).toMatch(/contra 19 séries/);
    expect(acima!.severidade).toBe('risco');
  });

  /**
   * 🔵 A ZONA INTERMEDIÁRIA (decisão 2026-09-17) — e a frase que ela NÃO pode dizer.
   *
   * ⚠️ ANTI-VACUIDADE: o cenário é construído para cair ENTRE 16 e 19. Se algum dia as duas
   * linhas voltarem a coincidir, o `toBeDefined` abaixo cai junto.
   */
  it('entre o máximo automático (16) e o teto cheio (19): orienta, e NÃO diz que passou do teto', () => {
    const dias = [{ nome: 'A', exercicios: [ex('e1'), ex('e10'), ex('e11')], series: [6, 6, 5] }];
    const placar = placarDaSemana(dias, CTX);
    const peito = placar.find((l) => l.grupo === 'peito')!;
    expect(peito.ponderado, 'o cenário precisa cair na zona intermediária').toBeGreaterThan(peito.maxAutomatico!);
    expect(peito.ponderado).toBeLessThanOrEqual(peito.mrv!);
    expect(peito.status).toBe('acima_do_automatico');
    const itens = avisos(dias, placar, CTX);
    const orienta = itens.find((a) => a.codigo === 'acima_do_maximo_automatico');
    expect(orienta).toBeDefined();
    expect(orienta!.severidade, 'é orientação, não risco — nada aqui trava').toBe('recomendacao');
    expect(orienta!.texto).toMatch(/16/);
    expect(orienta!.texto).toMatch(/19/);
    expect(itens.some((a) => a.codigo === 'acima_do_maximo'), 'não ultrapassou o teto — não pode dizer que ultrapassou').toBe(false);
  });

  /** 🔵 O teto POR SESSÃO vale ao mesmo tempo que o semanal e tem aviso próprio. */
  it('12 ponderadas de um grupo num único dia disparam o aviso da SESSÃO', () => {
    const dias = [{ nome: 'Seg', exercicios: [ex('e1'), ex('e10'), ex('e11')], series: [5, 5, 5] }];
    const placar = placarDaSemana(dias, CTX);
    const itens = avisos(dias, placar, CTX);
    const sessao = itens.find((a) => a.codigo === 'acima_do_maximo_na_sessao');
    expect(sessao, `avisos: ${itens.map((i) => i.codigo).join(', ')}`).toBeDefined();
    expect(sessao!.fato?.escopo).toBe('sessao');
    expect(sessao!.fato?.dia).toBe(0);
    expect(sessao!.texto).toMatch(/Seg/);
  });

  it('sessão estourando o tempo do perfil avisa com a estimativa (fórmula canônica C1)', () => {
    // 6 itens × 4 séries @90: MIN 2580 + transição 450 = MAX 3030 s (50 min) → cabe em 60.
    const cabe = [diaCompleto('A', ['e1', 'e10', 'e11', 'e14', 'e15', 'e22'])];
    expect(avisos(cabe, placarDaSemana(cabe, CTX), CTX).some((a) => a.codigo === 'sessao_longa')).toBe(false);
    // 8 itens × 4 séries @90: MAX 4070 s (68 min) > 3600 → estoura (o editor informa a diferença).
    const estoura = [diaCompleto('A', ['e1', 'e10', 'e11', 'e14', 'e15', 'e22', 'e45', 'e46'])];
    const item = avisos(estoura, placarDaSemana(estoura, CTX), CTX).find((a) => a.codigo === 'sessao_longa');
    expect(item, 'a sessão longa não foi avisada').toBeDefined();
    expect(item!.texto).toMatch(/acima dos 60 min/);
  });

  it('🔒 sem séries/descanso por slot: NÃO inventa 1 série / 90 s (NAO_AVALIADO ⇒ sem aviso de tempo)', () => {
    // 8 itens que ESTOURARIAM com o fallback antigo 1/90; sem os dados finais, o crítico se
    // cala em vez de afirmar (ou negar) que cabe — a regra que a norma C1 trava.
    const semDados = [diaDe('A', ['e1', 'e10', 'e11', 'e14', 'e15', 'e22', 'e45', 'e46'])];
    expect(avisos(semDados, placarDaSemana(semDados, CTX), CTX).some((a) => a.codigo === 'sessao_longa')).toBe(false);
  });

  it('puxar < empurrar avisa (a invariante do motor, aqui como aviso — não como trava)', () => {
    const dias = [diaDe('A', ['e1', 'e10'])]; // 2 empurrar, 0 puxar
    const item = avisos(dias, placarDaSemana(dias, CTX), CTX).find((a) => a.codigo === 'puxar_menor_que_empurrar');
    expect(item).toBeDefined();
    const equilibrado = [diaDe('A', ['e1', 'e22'])];
    expect(avisos(equilibrado, placarDaSemana(equilibrado, CTX), CTX)
      .some((a) => a.codigo === 'puxar_menor_que_empurrar')).toBe(false);
  });
});

/**
 * 🔒 A COPY dos itens passa pelas mesmas réguas do resto do app: sem promessa de resultado,
 * sem "IA", e o aviso diz o mecanismo ("pode prejudicar a recuperação"), nunca o desfecho.
 */
describe('🔒 copy do crítico — sem promessa, sem IA, com o porquê', () => {
  const todos = (() => {
    const dias = [diaDe('Seg', ['e1', 'e10', 'e11', 'e14', 'e15']), diaDe('Ter', ['e2']), diaDe('Qua', ['e16'])];
    const a = avaliarSemana(dias, { ...CTX, diasDaSemanaIdx: [0, 1, 2] });
    return [...a.recomendacoes, ...a.avisos].map((x) => x.texto);
  })();

  it('o corpus não é vazio (anti-vacuidade)', () => {
    expect(todos.length).toBeGreaterThanOrEqual(4);
  });

  it('nenhuma frase promete resultado nem garante desfecho', () => {
    const PROIBIDO = /\bgarant|\bvocê vai (ganhar|perder|conquistar)|resultado garantido|em \d+ (dias|semanas) você/i;
    for (const t of todos) expect(PROIBIDO.test(t), t).toBe(false);
  });

  it('a copy nunca diz "IA" (princípio 1 do enquadramento)', () => {
    for (const t of todos) expect(/\bIA\b|intelig[êe]ncia artificial/i.test(t), t).toBe(false);
  });

  it('todo aviso de risco explica o PORQUÊ', () => {
    const dias = [diaDe('Seg', ['e1', 'e10', 'e11', 'e14', 'e15']), diaDe('Ter', ['e2'])];
    const riscos = avisos(dias, placarDaSemana(dias, CTX), { ...CTX, diasDaSemanaIdx: [0, 1] });
    for (const r of riscos) {
      expect(/recupera|equilibr|acima d|atrapalha|perfil/i.test(r.texto), `sem porquê: ${r.texto}`).toBe(true);
    }
  });
});
