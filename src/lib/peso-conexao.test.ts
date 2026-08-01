import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pesagensDatadas } from './peso-plano';
import type { RegistroPeso } from './treino-historico';

/**
 * 🔒 A CONEXÃO do peso ao motor (Leva D, DF 2026-07-31) — guards ESTRUTURAIS.
 *
 * 🔴 Por que este arquivo existe: a suíte da Leva D anterior provava a FUNÇÃO
 * (`peso-suavizado.test.ts`) e nenhuma linha provava a MONTAGEM. O módulo puro podia estar
 * perfeito e o app continuar gerando o plano com `perfil.pesoKg` — que é exatamente o
 * defeito que a leva veio fechar. É a mesma lição que já se repetiu oito vezes nesta série:
 * **a suíte prova função, não montagem** — o extrator faz parte do guard.
 *
 * As duas regressões que este arquivo torna impossíveis, nomeadas pelo autor:
 *  · `lerPesos` voltar a devolver número cru (a série perde a data → some a janela de 7 dias);
 *  · a rota voltar a mapear a data PARA FORA (mesmo efeito, do outro lado do fio).
 */

const podar = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
const semComentarios = (p: string): string => podar(readFileSync(p, 'utf8'));

/** Da posição de um `(`/`{`, o índice do delimitador que o fecha. */
function fecha(src: string, abre: number): number {
  const par = src[abre] === '(';
  const [a, b] = par ? ['(', ')'] : ['{', '}'];
  let nivel = 0;
  for (let j = abre; j < src.length; j += 1) {
    if (src[j] === a) nivel += 1;
    else if (src[j] === b) { nivel -= 1; if (nivel === 0) return j; }
  }
  throw new Error('delimitador não fechou');
}

/**
 * Corpo de uma função nomeada.
 *
 * ⚠️ O ingênuo (`indexOf('{')` depois do nome) pega a chave ERRADA duas vezes seguidas em
 * `recomputarPlano`: primeiro o objeto de OPÇÕES do parâmetro, depois o TIPO DE RETORNO
 * (`): { dieta; treino } {`). Isto já derrubou um guard desta série. Aqui: fecha-se a lista
 * de parâmetros, e cada `{...}` seguido de outro `{` é anotação de tipo, não corpo.
 */
function corpoDe(src: string, assinatura: string): string {
  const i = src.indexOf(assinatura);
  expect(i, `assinatura não encontrada: ${assinatura}`).toBeGreaterThanOrEqual(0);
  let pos = fecha(src, src.indexOf('(', i)) + 1;
  for (;;) {
    const abre = src.indexOf('{', pos);
    if (abre < 0) throw new Error(`corpo não encontrado: ${assinatura}`);
    const fim = fecha(src, abre);
    const depois = src.slice(fim + 1).match(/^\s*(.)/)?.[1];
    if (depois !== '{') return src.slice(abre, fim + 1); // não é anotação de tipo → é o corpo
    pos = fim + 1;
  }
}

const HISTORICO = 'src/lib/treino-historico.ts';
const ROTA = 'src/app/api/dados/peso/route.ts';
const PLANO = 'src/lib/plano.ts';
const PAINEL = 'src/components/painel/Painel.tsx';
const APP = 'src/app/app/page.tsx';

describe('🔒 o extrator do guard (3 testes próprios — regra ⑩ do cofre)', () => {
  it('positivo conhecido: acha o corpo e para na chave certa', () => {
    const corpo = corpoDe('function f(a: number) { if (a) { return 1; } return 2; }\nconst x = 3;', 'function f(');
    expect(corpo).toBe('{ if (a) { return 1; } return 2; }');
  });

  it('negativo conhecido: assinatura inexistente falha em vez de devolver vazio', () => {
    expect(() => corpoDe('const a = 1;', 'function inexistente(')).toThrow();
  });

  it('anti-vacuidade: comentário com a assinatura NÃO conta (o corte de comentários vem antes)', () => {
    const src = podar('// function isca() { return 9; }\nfunction f() { return 1; }');
    expect(src).not.toMatch(/function isca/);
    expect(corpoDe(src, 'function f(')).toBe('{ return 1; }');
  });

  it('a armadilha real: opções no parâmetro E tipo de retorno em chaves', () => {
    const src = 'function g(o?: { a?: number }): { x: number } { return { x: 1 }; }';
    expect(corpoDe(src, 'function g(')).toBe('{ return { x: 1 }; }');
  });
});

describe('🔒 a série de pesos carrega DATA — nas duas pontas', () => {
  it('`lerPesos` é declarada devolvendo RegistroPeso[], nunca number[]', () => {
    const src = semComentarios(HISTORICO);
    expect(src).toMatch(/export function lerPesos\(\): RegistroPeso\[\]/);
    // 🔴 A regressão nomeada: voltar a `number[]`. Sem data não existe janela de 7 dias.
    expect(src).not.toMatch(/export function lerPesos\(\): number\[\]/);
    // E o tipo tem de ter mesmo o campo — não basta o nome bater.
    expect(src).toMatch(/export interface RegistroPeso \{[\s\S]{0,300}?dataISO: string \| null;/);
  });

  it('o gráfico tem porta PRÓPRIA (`lerPesosKg`) — o legado sem data não some da tela', () => {
    const src = semComentarios(HISTORICO);
    expect(src).toMatch(/export function lerPesosKg\(\): number\[\]/);
    expect(corpoDe(src, 'export function lerPesosKg(')).toMatch(/lerPesos\(\)\.map/);
  });

  it('a ROTA mapeia a data PARA DENTRO — `data` primeiro, `created_at` só de reserva', () => {
    const src = semComentarios(ROTA);
    // 🔴 A regressão nomeada: o `select` voltar a pedir só o payload, ou o `map` a devolver
    //    número cru. Qualquer uma das duas mata a janela sem quebrar nenhum outro teste.
    expect(src, 'o select precisa trazer as duas colunas de data').toMatch(/select\(\s*['"]payload, data, created_at['"]\s*\)/);
    const corpo = src.slice(src.indexOf('const pesos'), src.indexOf('const pesos') + 600);
    expect(corpo, 'o objeto devolvido precisa ter dataISO').toMatch(/dataISO:/);
    // A ORDEM é a spec: a data DECLARADA vence; `created_at` só quando não houver declarada
    // (pesagem offline sincronizada dias depois — as duas divergem, e a certa é a declarada).
    expect(corpo).toMatch(/declarada \?\? recebida/);
    expect(corpo).not.toMatch(/recebida \?\? declarada/);
  });

  it('a SUBIDA leva o dia da pesagem — a re-subida offline não carimba tudo de hoje', () => {
    const sync = semComentarios('src/lib/persistencia/sync.ts');
    expect(sync).toMatch(/registrarPesoServidor\(pesoKg: number, dataISO\?: string \| null\)/);
    expect(corpoDe(sync, 'export async function registrarPesoServidor(')).toMatch(/dataISO/);
    // E o servidor tem de aceitar o campo — senão o cliente manda para o vazio.
    const rota = semComentarios(ROTA);
    expect(rota).toMatch(/dataISO\?: unknown/);
    expect(rota, 'a data do cliente não chega ao insert').toMatch(/data: dataOk/);
    // 🔒 Só passado: data futura tem de cair no default do banco, nunca entrar na janela.
    expect(rota).toMatch(/d <= hoje/);
  });

  it('TODA subida do Painel leva a data — inclusive a re-subida do que ficou local', () => {
    const src = semComentarios(PAINEL);
    const sites = [...src.matchAll(/registrarPesoServidor\(([^)]*)\)/g)].map((m) => m[1]!);
    expect(sites.length, 'call sites de subida de peso').toBeGreaterThanOrEqual(2);
    // 🔴 Uma subida sem data é uma pesagem carimbada com o dia da SINCRONIZAÇÃO. O guard
    // cobra os dois argumentos em todo call site — foi assim que a re-subida foi pega.
    for (const args of sites) expect(args.split(',').length, args).toBe(2);
  });

  it('`pesagensDatadas` deixa o legado FORA da janela e o mantém no gráfico', () => {
    const mista: RegistroPeso[] = [
      { dataISO: null, kg: 80 },
      { dataISO: '2026-07-30', kg: 79.4 },
      { dataISO: null, kg: 78 },
    ];
    expect(pesagensDatadas(mista)).toEqual([{ dataISO: '2026-07-30', kg: 79.4 }]);
    // Anti-vacuidade: com tudo datado, nada é descartado (senão o filtro estaria mentindo).
    expect(pesagensDatadas([{ dataISO: '2026-07-30', kg: 79.4 }])).toHaveLength(1);
  });
});

describe('🔒 o motor recebe o peso RESOLVIDO — e é um knob só', () => {
  it('`recomputarPlano` deriva um `pesoKg` único e o entrega aos DOIS perfis', () => {
    const corpo = corpoDe(semComentarios(PLANO), 'export function recomputarPlano(');
    // ⚠️ `const pesoKg = ` sozinho SOBREVIVEU à mutação `= perfil.pesoKg`: a declaração
    // continuava lá e o peso resolvido era simplesmente ignorado. O guard tem de cobrar o
    // LADO DIREITO, não a existência da variável.
    const decl = corpo.match(/const pesoKg = [^;]*;/)?.[0] ?? '';
    expect(decl, 'a declaração do peso sumiu').not.toBe('');
    expect(decl, 'o peso resolvido não é lido').toMatch(/opcoes[?!]?\.?.*pesoEfetivoKg/);
    // O ponto da fonte única: se um dos dois voltasse a `perfil.pesoKg`, dieta e treino
    // passariam a ser gerados com pesos diferentes — e nada mais na suíte notaria.
    expect(corpo).toMatch(/const perfilU: PerfilUsuario = \{[\s\S]{0,400}?[^.]\bpesoKg\b/);
    expect(corpo).toMatch(/const perfilT: PerfilTreino = \{[\s\S]{0,400}?[^.]\bpesoKg\b/);
    expect(corpo, 'nenhum dos perfis pode ler o peso do perfil direto').not.toMatch(/pesoKg: perfil\.pesoKg/);
  });

  it('não existe um segundo knob de peso no motor (uma resposta só para "com que peso")', () => {
    const src = semComentarios(PLANO);
    expect(src).toMatch(/pesoEfetivoKg\?: number;/);
    // A série NÃO entra aqui: quem suaviza é `lib/peso-plano`, e duas entradas para a mesma
    // pergunta produziriam duas respostas para a auditoria do determinismo.
    expect(src).not.toMatch(/pesagens\?:/);
  });
});

describe('🔒 TODO call site do cliente passa o peso resolvido', () => {
  /** Chamadas a `recomputarPlano(` num arquivo, com a lista de argumentos completa. */
  function chamadas(arquivo: string): string[] {
    const src = semComentarios(arquivo);
    const achados: string[] = [];
    for (const m of src.matchAll(/recomputarPlano\(/g)) {
      const abre = m.index! + m[0].length - 1;
      let nivel = 0;
      for (let j = abre; j < src.length; j += 1) {
        if (src[j] === '(') nivel += 1;
        else if (src[j] === ')') { nivel -= 1; if (nivel === 0) { achados.push(src.slice(abre, j + 1)); break; } }
      }
    }
    return achados;
  }

  it('o extrator acha as chamadas (anti-vacuidade: um arquivo sem chamada devolve [])', () => {
    expect(chamadas(PAINEL).length, 'nenhuma chamada encontrada no Painel').toBeGreaterThanOrEqual(4);
    expect(chamadas(HISTORICO)).toEqual([]);
  });

  it('Painel: as QUATRO chamadas passam `pesoEfetivoKg`', () => {
    const cs = chamadas(PAINEL);
    expect(cs.length).toBeGreaterThanOrEqual(4);
    for (const c of cs) expect(c, c).toMatch(/pesoEfetivoKg/);
  });

  it('/app: o plano do mount nasce com o peso resolvido, não com o do perfil', () => {
    const cs = chamadas(APP);
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatch(/pesoEfetivoKg/);
    const src = semComentarios(APP);
    expect(src).toMatch(/resolverPesoDoPlanoLocal\(/);
  });

  /**
   * ⚠️ EXCEÇÃO DECLARADA. O `PUT /api/dados/perfil` grava um snapshot em `plans` e roda no
   * SERVIDOR, onde não existe a âncora (`evk_peso_plano` é do navegador). Ele segue no
   * `perfil.pesoKg` de propósito: inventar ali uma segunda resolução criaria um plano
   * auditável que discorda do que a pessoa vê. Fica nomeado aqui para não virar esquecimento.
   */
  it('a rota do perfil NÃO passa peso resolvido — e isso está declarado', () => {
    const cs = chamadas('src/app/api/dados/perfil/route.ts');
    expect(cs).toHaveLength(1);
    expect(cs[0]).not.toMatch(/pesoEfetivoKg/);
  });
});

describe('🔒 a frase do recálculo diz o que já aconteceu', () => {
  const trecho = (): string => {
    const src = semComentarios(PAINEL);
    const i = src.indexOf('const notaPesoPlano');
    expect(i, 'a nota sumiu do Painel').toBeGreaterThanOrEqual(0);
    return src.slice(i, i + 400);
  };

  it('está no PASSADO e é sobre o app, não sobre a pessoa', () => {
    const t = trecho();
    expect(t).toMatch(/Seu plano foi recalculado/);
    // Sem futuro e sem promessa de resultado (princípio 3 do projeto).
    expect(t).not.toMatch(/vai |ser[áa] |voc[êe] (vai|ir[áa])|emagrec|ganho de/i);
  });

  it('não aparece em MODO DIÁRIO (lá não há plano para recalcular)', () => {
    expect(trecho()).toMatch(/!modoDiario &&/);
  });

  it('só aparece quando o peso do plano REALMENTE deixou de ser o do perfil', () => {
    // A condição de exibir e a de ter acontecido têm de ser a MESMA — senão a tela conta
    // um recálculo que não houve, que é a versão nova do defeito que a leva veio fechar.
    expect(trecho()).toMatch(/pesoMotorKg !== perfil\.pesoKg/);
  });

  it('o subtítulo do registro segue unificado — a nota não reabriu a ramificação', () => {
    const src = semComentarios(PAINEL);
    expect(src).toContain('Um registro rápido guarda a sua variação.');
    expect(src).not.toMatch(/mant[ée]m seu plano calibrado/);
  });
});
