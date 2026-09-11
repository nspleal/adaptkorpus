/**
 * 🔴 D18 — "Registrar treino feito" só oferecia "Montar do zero" mesmo com plano cheio.
 *
 * Causa: o Painel passava `diaHoje={diaDeHoje}`, e `diaDeHoje` é
 * `sessaoHojeIdx != null ? rotinaDias[sessaoHojeIdx] : undefined` — ou seja, `undefined`
 * em todo dia que não é dia agendado. O cartão do plano dependia de `diaHoje && prescricao`,
 * então "hoje não é dia de treino" e "você não tem plano" viravam a mesma tela.
 *
 * Guard em quatro pernas:
 *  ① todo dia COM exercício do plano é oferecido como modelo, independente do dia de hoje;
 *  ② escolher um modelo COPIA — nenhuma estrutura do plano é compartilhada por referência;
 *  ③ carregando / ausência real / falha de leitura são estados distintos;
 *  ④ o call site do Painel passa o plano inteiro, não só o dia de hoje.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { linhasDoModelo, modelosDoPlano, type EstadoPlano } from '../components/painel/RegistrarTreino';
import { EXERCISES_SEED } from '../lib/data/seed';
import type { DiaTreino, PrescricaoFITT } from '../lib/engine/treino-types';

const ex = (id: string) => EXERCISES_SEED.find((e) => e.id === id)!;
/** Guards leem CÓDIGO, não JSDoc: uma frase citada em comentário não pode fazê-los passar. */
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const dia = (nome: string, ids: string[]): DiaTreino => ({
  nome,
  slots: ids.map((id) => ({
    exercicio: ex(id),
    padrao: ex(id).padraoMovimento,
    series: 3,
  })),
} as unknown as DiaTreino);

/** Plano real de 3 dias + um dia vazio (que D14 já trata como não-sessão). */
const PLANO: DiaTreino[] = [
  dia('Push', ['e9', 'e43']),
  dia('Pull', ['e49', 'e21']),
  dia('Legs', ['e3']),
  dia('Dia vazio', []),
];

const PRESCRICAO = {
  seriesPorExercicio: { min: 3, max: 4 },
  repsComposto: { min: 6, max: 10 },
  repsIsolado: { min: 10, max: 15 },
} as unknown as PrescricaoFITT;

describe('🔴 D18 ① — o plano existente aparece como modelo', () => {
  it('oferece TODOS os dias com exercício, e não só o de hoje', () => {
    const modelos = modelosDoPlano(PLANO, 1);
    expect(modelos.map((m) => m.nome)).toEqual(['Pull', 'Push', 'Legs']);
  });

  it('continua oferecendo os dias quando HOJE não é dia de treino — o defeito relatado', () => {
    const modelos = modelosDoPlano(PLANO, null);
    expect(modelos.length, 'plano cheio e nenhum modelo oferecido').toBe(3);
    expect(modelos.some((m) => m.ehHoje)).toBe(false);
  });

  it('o dia de hoje vem primeiro e marcado, sem esconder os outros', () => {
    const modelos = modelosDoPlano(PLANO, 2);
    expect(modelos[0]!.nome).toBe('Legs');
    expect(modelos[0]!.ehHoje).toBe(true);
    expect(modelos.map((m) => m.nome)).toContain('Push');
  });

  it('dia sem exercício não vira modelo (copiar zero é a lista vazia de "Montar do zero")', () => {
    expect(modelosDoPlano(PLANO, null).some((m) => m.nome === 'Dia vazio')).toBe(false);
  });

  it('plano genuinamente vazio não produz modelo algum', () => {
    expect(modelosDoPlano([], null)).toEqual([]);
    expect(modelosDoPlano(undefined, null)).toEqual([]);
  });

  it('cada modelo declara quantos exercícios copia', () => {
    expect(modelosDoPlano(PLANO, null).map((m) => m.qtd)).toEqual([2, 2, 1]);
  });
});

describe('🔴 D18 ② — escolher modelo COPIA, sem mutar o plano', () => {
  it('copia os exercícios do dia, na ordem, com a identidade preservada', () => {
    const linhas = linhasDoModelo(PLANO[1]!, PRESCRICAO);
    expect(linhas.map((l) => l.refId)).toEqual(['e49', 'e21']);
    expect(linhas.map((l) => l.nome)).toEqual([ex('e49').nomePt, ex('e21').nomePt]);
    expect(linhas.every((l) => l.custom === false)).toBe(true);
  });

  it('pré-preenche séries e reps da prescrição, com carga em branco', () => {
    const linhas = linhasDoModelo(PLANO[1]!, PRESCRICAO);
    expect(linhas[0]!.sets).toHaveLength(3);
    expect(linhas[0]!.sets.every((s) => s.reps === '10' && s.kg === '' && s.rir === '')).toBe(true);
  });

  it('NENHUMA estrutura do plano é compartilhada por referência', () => {
    const antes = JSON.parse(JSON.stringify(PLANO[1]));
    const linhas = linhasDoModelo(PLANO[1]!, PRESCRICAO);
    // Mexe no registro como a pessoa mexeria: tira exercício, muda reps, lança carga.
    linhas.pop();
    linhas[0]!.sets[0]!.reps = '99';
    linhas[0]!.sets[0]!.kg = '80';
    linhas[0]!.nome = 'outro nome';
    linhas[0]!.sets.push({ reps: '5', kg: '5', rir: '1' });
    expect(JSON.parse(JSON.stringify(PLANO[1])), 'o plano foi mutado pelo registro').toEqual(antes);
  });

  it('cada linha tem uid próprio — duas cópias do mesmo dia não se confundem', () => {
    const a = linhasDoModelo(PLANO[1]!, PRESCRICAO);
    const b = linhasDoModelo(PLANO[1]!, PRESCRICAO);
    expect(new Set([...a, ...b].map((l) => l.uid)).size).toBe(a.length + b.length);
  });

  it('prescrição ausente NÃO cancela o modelo — só não pré-preenche reps', () => {
    const linhas = linhasDoModelo(PLANO[1]!, null);
    expect(linhas.map((l) => l.refId)).toEqual(['e49', 'e21']);
    expect(linhas[0]!.sets.every((s) => s.reps === '')).toBe(true);
  });

  it('exercício de SEGUNDOS não recebe reps de exercício de repetições', () => {
    const isometrico = EXERCISES_SEED.find((e) => e.id !== '' && linhasDoModelo(dia('x', [e.id]), PRESCRICAO)[0]!.repUnit === 'segundos');
    expect(isometrico, 'nenhum isométrico no catálogo para exercitar o caso').toBeTruthy();
    const linha = linhasDoModelo(dia('Iso', [isometrico!.id]), PRESCRICAO)[0]!;
    expect(linha.sets.every((s) => s.reps === '')).toBe(true);
  });
});

describe('🔴 D18 ③ — carregando, ausência e erro são estados distintos', () => {
  const codigo = readFileSync('src/components/painel/RegistrarTreino.tsx', 'utf8');

  it('os quatro estados existem no tipo', () => {
    const estados: EstadoPlano[] = ['carregando', 'pronto', 'sem-plano', 'erro'];
    expect(estados).toHaveLength(4);
    expect(codigo).toContain("export type EstadoPlano = 'carregando' | 'pronto' | 'sem-plano' | 'erro'");
  });

  it('cada estado tem uma frase PRÓPRIA — nenhum silêncio compartilhado', () => {
    expect(codigo).toMatch(/estadoEfetivo === 'carregando'[\s\S]{0,400}?Carregando seu plano/);
    expect(codigo).toMatch(/estadoEfetivo === 'sem-plano'[\s\S]{0,400}?ainda não tem treinos no plano/);
    expect(codigo).toMatch(/estadoEfetivo === 'erro'[\s\S]{0,400}?Não foi possível ler seu plano/);
  });

  it('a falha de leitura é anunciada como alerta, não como ausência', () => {
    expect(codigo).toMatch(/role="alert"[\s\S]{0,300}?Não foi possível ler seu plano/);
  });

  it('"Montar do zero" existe FORA de qualquer condicional de estado do plano', () => {
    // Sem comentários: um "Montar do zero" citado em JSDoc não pode fazer o guard passar.
    const jsx = semComentarios(codigo);
    const bloco = jsx.slice(jsx.indexOf('Como você quer começar?'), jsx.indexOf('Ponto de partida'));
    const zero = bloco.indexOf('Montar do zero');
    expect(zero, 'cartão "Montar do zero" não encontrado na partida').toBeGreaterThan(-1);
    const guard = bloco.indexOf("estadoEfetivo === 'pronto' && modelos.map");
    expect(guard, 'os modelos deveriam estar sob um guard de estado').toBeGreaterThan(-1);
    // O guard dos modelos fecha ANTES do cartão do zero: o zero não está dentro dele.
    const fecha = bloco.indexOf('))}', guard);
    expect(fecha).toBeGreaterThan(guard);
    expect(fecha, 'o cartão do zero caiu dentro do guard dos modelos').toBeLessThan(zero);
    // E nenhum outro guard de estado se abre entre o fim dos modelos e o cartão do zero.
    expect(bloco.slice(fecha, zero)).not.toContain('estadoEfetivo ===');
  });
});

describe('🔴 D18 ④ — o Painel passa o plano inteiro', () => {
  const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');

  it('o call site entrega rotinaDias, não só o dia de hoje', () => {
    const trecho = painel.slice(painel.indexOf('<RegistrarTreino'), painel.indexOf('<RegistrarTreino') + 700);
    expect(trecho).toContain('diasDoPlano={rotinaDias}');
    expect(trecho).toContain('idxDeHoje={sessaoHojeIdx}');
    expect(trecho).toContain('estadoPlano=');
  });

  it('o estado vem da EXISTÊNCIA do plano, não do dia de hoje', () => {
    const trecho = painel.slice(painel.indexOf('<RegistrarTreino'), painel.indexOf('<RegistrarTreino') + 700);
    expect(trecho).toContain("rotinaDias.length === 0 ? 'sem-plano' : 'pronto'");
    expect(trecho).not.toMatch(/estadoPlano=\{[^}]*diaDeHoje/);
  });
});

describe('🔴 D18 ⑤ — só a confirmação grava', () => {
  const codigo = readFileSync('src/components/painel/RegistrarTreino.tsx', 'utf8');

  it('onSalvar é INVOCADO num único lugar: dentro de salvar()', () => {
    const jsx = semComentarios(codigo);
    const invocacoes = [...jsx.matchAll(/onSalvar\(/g)].map((m) => m.index!);
    expect(invocacoes).toHaveLength(1);
    const salvarIni = jsx.indexOf('function salvar()');
    const salvarFim = jsx.indexOf('function registrarOutro');
    expect(invocacoes[0]).toBeGreaterThan(salvarIni);
    expect(invocacoes[0]).toBeLessThan(salvarFim);
  });

  it('escolher modelo copia e NÃO grava', () => {
    const jsx = semComentarios(codigo);
    const escolher = jsx.slice(jsx.indexOf('function escolherModelo'), jsx.indexOf('function escolherZero'));
    expect(escolher).toContain('linhasDoModelo');
    expect(escolher).not.toContain('onSalvar');
  });

  it('cancelar chama apenas onCancelar — nenhum registro é criado', () => {
    const jsx = semComentarios(codigo);
    expect(jsx).toContain('onClick={onCancelar}');
    // Nenhum handler de cancelar grava: não existe onCancelar acompanhado de onSalvar.
    for (const m of jsx.matchAll(/onClick=\{[^}]*onCancelar[^}]*\}/g)) {
      expect(m[0]).not.toContain('onSalvar');
    }
  });

  it('o segundo clique em salvar não grava de novo: o guard sai do estado "editando"', () => {
    expect(codigo).toContain("const canSave = temExercicios && status === 'editando';");
    const salvar = codigo.slice(codigo.indexOf('function salvar()'), codigo.indexOf('function registrarOutro'));
    expect(salvar).toContain('if (!canSave) return;');
    expect(salvar).toContain("setStatus('salvando')");
    // grava → sai de 'editando' → canSave vira false → o onSalvar não roda duas vezes.
    expect(salvar.indexOf('onSalvar(')).toBeLessThan(salvar.indexOf("setStatus('salvando')"));
  });
});
