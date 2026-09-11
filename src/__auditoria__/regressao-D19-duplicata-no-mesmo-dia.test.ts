/**
 * 🔴 D19 — a biblioteca oferecia "Selecionar" para um exercício JÁ presente no dia, e a
 * inclusão individual não tinha trava nenhuma (`[...d.exercicios, ex]`).
 *
 * Guard em quatro pernas:
 *  ① identidade é o ID canônico do catálogo, nunca o texto do nome;
 *  ② a trava vive na OPERAÇÃO de adicionar — individual E em lote;
 *  ③ o escopo é o DIA: outro dia e variantes legítimas continuam livres;
 *  ④ duplicata histórica é preservada, e "já adicionado" ≠ "selecionado nesta abertura".
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adicionarSemDuplicar, identidadeCanonica, identidadesDe, jaNesteTreino } from '../lib/exercicio-identidade';
import { EXERCISES_SEED } from '../lib/data/seed';
import { mesmaFamilia } from '../lib/engine/familias';

const ex = (id: string) => EXERCISES_SEED.find((e) => e.id === id)!;
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const BARRA_FIXA = ex('e21');          // o caso relatado
const CHIN_UP = ex('e22');             // variante REALMENTE distinta (mesma família)
const PUXADA = ex('e49');
const TRIANGULO = ex('e50');

describe('🔴 D19 ① — identidade canônica é o id, não o nome', () => {
  it('o catálogo sustenta a escolha: todo id é único', () => {
    const ids = EXERCISES_SEED.map((e) => e.id);
    expect(new Set(ids).size, 'id duplicado no catálogo quebraria a trava').toBe(ids.length);
  });

  it('nomes diferentes com o mesmo id são o MESMO exercício', () => {
    expect(identidadeCanonica({ id: 'e21' })).toBe(identidadeCanonica('e21'));
    // Rótulo trocado (é o que D20 faz com e49/e126) não muda a identidade.
    const renomeado: typeof BARRA_FIXA = { ...BARRA_FIXA, nomePt: 'outro rótulo qualquer' };
    expect(identidadeCanonica(renomeado)).toBe('e21');
    expect(jaNesteTreino([BARRA_FIXA], renomeado)).toBe(true);
  });

  it('id vindo com espaço ou caixa trocada não fura a trava', () => {
    expect(jaNesteTreino([BARRA_FIXA], ' E21 ')).toBe(true);
  });

  it('nomes PARECIDOS de exercícios distintos não colidem', () => {
    expect(jaNesteTreino([PUXADA], TRIANGULO)).toBe(false);
    expect(PUXADA.nomePt.startsWith('Puxada')).toBe(true);
    expect(TRIANGULO.nomePt.startsWith('Puxada')).toBe(true);
  });

  it('a trava NÃO é por família — variantes da mesma família continuam disponíveis', () => {
    expect(mesmaFamilia('e21', 'e22'), 'fixture inválida: deveriam ser a mesma família').toBe(true);
    expect(jaNesteTreino([BARRA_FIXA], CHIN_UP), 'chin-up bloqueado por causa da barra fixa').toBe(false);
    expect(mesmaFamilia('e49', 'e50')).toBe(true);
    expect(jaNesteTreino([PUXADA], TRIANGULO)).toBe(false);
  });
});

describe('🔴 D19 ② — a trava está na OPERAÇÃO, individual e em lote', () => {
  it('inclusão individual do que já está no dia é recusada — o caso relatado', () => {
    const r = adicionarSemDuplicar([BARRA_FIXA], [BARRA_FIXA]);
    expect(r.lista.map((e) => e.id)).toEqual(['e21']);
    expect(r.adicionados).toEqual([]);
    expect(r.bloqueados.map((e) => e.id)).toEqual(['e21']);
  });

  it('seleção em LOTE respeita a trava e ainda aceita o que é novo', () => {
    const r = adicionarSemDuplicar([BARRA_FIXA], [BARRA_FIXA, CHIN_UP, PUXADA]);
    expect(r.lista.map((e) => e.id)).toEqual(['e21', 'e22', 'e49']);
    expect(r.bloqueados.map((e) => e.id)).toEqual(['e21']);
  });

  it('lote com o MESMO exercício repetido dentro dele entra uma vez só', () => {
    const r = adicionarSemDuplicar([], [PUXADA, PUXADA, PUXADA]);
    expect(r.lista.map((e) => e.id)).toEqual(['e49']);
    expect(r.bloqueados).toHaveLength(2);
  });

  it('os DOIS call sites do editor passam pela mesma trava', () => {
    const editor = semComentarios(readFileSync('src/components/painel/EditorTreino.tsx', 'utf8'));
    const trecho = editor.slice(editor.indexOf('<SeletorExercicio'), editor.indexOf('</SeletorExercicio') + 1 || undefined);
    const bloco = trecho || editor;
    expect(bloco).toContain('onEscolher={(ex) => { mut(abrindoEm, (d) => ({ ...d, exercicios: adicionarSemDuplicar(d.exercicios, [ex]).lista }))');
    expect(bloco).toContain('onEscolherVarios={(selecionados) => { mut(abrindoEm, (d) => ({ ...d, exercicios: adicionarSemDuplicar(d.exercicios, selecionados).lista }))');
    // O concat cru que causava o defeito não pode voltar.
    expect(bloco).not.toContain('exercicios: [...d.exercicios, ex]');
  });

  it('a trava não depende da aparência: a marcação é derivada, a decisão é da função', () => {
    const seletor = semComentarios(readFileSync('src/components/painel/SeletorExercicio.tsx', 'utf8'));
    expect(seletor).toContain('jaAdicionados?.has(identidadeCanonica(ex))');
    // O seletor NÃO adiciona: ele só avisa e desabilita.
    expect(seletor).not.toContain('adicionarSemDuplicar');
  });
});

describe('🔴 D19 ③ — o escopo é o dia', () => {
  it('o mesmo exercício em OUTRO dia continua permitido', () => {
    const segunda = [BARRA_FIXA];
    const quarta: typeof segunda = [];
    expect(jaNesteTreino(quarta, BARRA_FIXA)).toBe(false);
    expect(adicionarSemDuplicar(quarta, [BARRA_FIXA]).adicionados.map((e) => e.id)).toEqual(['e21']);
    expect(segunda.map((e) => e.id), 'o outro dia foi tocado').toEqual(['e21']);
  });

  it('o editor consulta SÓ o dia que está aberto', () => {
    const editor = semComentarios(readFileSync('src/components/painel/EditorTreino.tsx', 'utf8'));
    expect(editor).toContain('jaAdicionados={identidadesDe(dias[abrindoEm]?.exercicios ?? [])}');
    expect(editor).not.toMatch(/jaAdicionados=\{identidadesDe\(dias\.flatMap/);
  });

  it('na TROCA, o slot que está saindo não é marcado como já presente', () => {
    const painel = semComentarios(readFileSync('src/components/painel/Painel.tsx', 'utf8'));
    expect(painel).toContain('.filter((_, i) => i !== biblioteca.s)');
    expect(painel).toContain('jaAdicionados={identidadesDe(');
  });
});

describe('🔴 D19 ④ — histórico preservado e estados distintos', () => {
  it('duplicata JÁ gravada não é removida em silêncio', () => {
    const diaLegado = [BARRA_FIXA, PUXADA, BARRA_FIXA];
    const r = adicionarSemDuplicar(diaLegado, [CHIN_UP]);
    expect(r.lista.map((e) => e.id)).toEqual(['e21', 'e49', 'e21', 'e22']);
  });

  it('a lista de entrada nunca é mutada', () => {
    const atuais = [BARRA_FIXA];
    const copia = [...atuais];
    adicionarSemDuplicar(atuais, [PUXADA, BARRA_FIXA]);
    expect(atuais).toEqual(copia);
  });

  it('identidadesDe ignora entradas sem id, sem inventar identidade', () => {
    expect([...identidadesDe([BARRA_FIXA, '', '  '])]).toEqual(['e21']);
  });

  it('"Já neste treino" é estado DIFERENTE de "Selecionado"', () => {
    const seletor = semComentarios(readFileSync('src/components/painel/SeletorExercicio.tsx', 'utf8'));
    expect(seletor).toContain('Já neste treino');
    expect(seletor).toContain('Selecionado');
    // o item já presente tem botão PRÓPRIO, desabilitado, e não entra em `selecionados`.
    const ramo = seletor.slice(seletor.indexOf(') : noTreino ? ('), seletor.indexOf(') : ('));
    expect(ramo).toContain('disabled');
    expect(ramo).not.toContain('setSelecionados');
  });

  it('o item já presente continua VISÍVEL — a lista não mente sobre a biblioteca', () => {
    const seletor = semComentarios(readFileSync('src/components/painel/SeletorExercicio.tsx', 'utf8'));
    // nada filtra a lista por `jaAdicionados`; a marcação é só visual + botão travado.
    expect(seletor).not.toMatch(/lista[\s\S]{0,80}?filter\([^)]*jaAdicionados/);
    expect(seletor).toContain('data-no-treino');
  });
});
