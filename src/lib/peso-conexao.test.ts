import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fazEmFaixaProtetiva, pesagensDatadas } from './peso-plano';
import { avaliarGateSaude } from '@/lib/engine';
import type { PerfilUsuario } from '@/lib/engine';
import { resolverPesoDoPlano } from '@/lib/engine/peso-suavizado';
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
    // 🔄 2026-09-11: a gravação passou a ser a RPC `registrar_peso_dia` (um registro por
    // dia, sob índice único). A propriedade defendida é a MESMA — o dia do CLIENTE chega
    // ao banco —, só mudou o nome do parâmetro: `data: dataOk` → `p_dia: dataOk`.
    expect(rota, 'a data do cliente não chega à gravação').toMatch(/p_dia: dataOk/);
    expect(rota, 'a gravação passa pela RPC que arbitra o dia').toMatch(/registrar_peso_dia/);
    // 🔒 Continua BOUNDED: data muito futura cai no default do banco e nunca entra na
    // janela. O teto virou `hoje_utc + 1` porque o dia é o CIVIL LOCAL da pessoa e quem
    // vive em fuso à frente de UTC está legitimamente num dia maior que o do servidor —
    // recusá-lo seria aplicar UTC à revelia da regra.
    expect(rota).toMatch(/d <= amanhaUtc/);
    expect(rota).toMatch(/amanhaUtc = new Date\(Date\.now\(\) \+ 86_400_000\)/);
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

  it('Painel: toda chamada usa a porta única que carrega `pesoEfetivoKg`', () => {
    const cs = chamadas(PAINEL);
    expect(cs.length).toBeGreaterThanOrEqual(4);
    for (const c of cs) expect(c, c).toMatch(/opcoesDoPlano/);
    const src = semComentarios(PAINEL);
    const porta = corpoDe(src, 'function opcoesDoPlano(');
    expect(porta).toMatch(/opcoesDeEntradaPlano\(entradaDoPlano\(perfil, sobrescrever\)\)/);
    const entrada = corpoDe(src, 'function entradaDoPlano(');
    expect(entrada).toMatch(/pesoEfetivoKg: sobrescrever\?\.pesoEfetivoKg \?\? pesoMotorKg/);
  });

  it('/app: mount e recarregamento de conflito usam peso resolvido quando não há snapshot C1', () => {
    const cs = chamadas(APP);
    expect(cs).toHaveLength(3); // mount, guarda antes de gravar e recarga remota
    for (const c of cs) expect(c, c).toMatch(/opcoes/);
    const src = semComentarios(APP);
    /**
     * 🔴 D7 (2026-09-10) — a régua mudou de FORMA, não de conteúdo. Os dois call sites
     * usavam `entradaPlano ? … : { pesoEfetivoKg }`: o peso resolvido chegava, mas a
     * `semanaCiclo` não, e sem ela o motor devolve plano sem séries. Agora ambos passam pela
     * porta única `normalizarEntradaPlanoVisivel(perfil, { pesoEfetivoKg })` — a mesma do
     * servidor —, que carrega o peso resolvido E fixa a semana. O que este teste cobra
     * continua sendo: nenhum dos dois volta ao peso cru quando não há snapshot C1.
     */
    const PORTA_UNICA = /opcoesDeEntradaPlano\([^)]*normalizarEntradaPlanoVisivel\([^)]*\{ pesoEfetivoKg \}\)\)/;
    const montar = corpoDe(src, 'function montar(');
    expect(montar).toMatch(PORTA_UNICA);
    expect(montar, 'o fallback v1 voltou ao mount').not.toMatch(/:\s*\{ pesoEfetivoKg \}/);
    const recarregar = corpoDe(src, 'async function recarregarVersaoSalva(');
    expect(recarregar).toMatch(PORTA_UNICA);
    expect(recarregar, 'o fallback v1 voltou ao recarregamento de conflito').not.toMatch(/:\s*\{ pesoEfetivoKg \}/);
  });

  /**
   * 🔒 C1.1-C fecha a antiga exceção: a rota não recalcula a partir do perfil cru. Ela recebe
   * explicitamente a entrada visível (inclusive peso resolvido) e o comando puro certifica
   * essa mesma fotografia antes de chamar o CAS.
   */
  it('a rota do perfil certifica a entrada visível em vez de recomputar sem peso resolvido', () => {
    const cs = chamadas('src/app/api/dados/perfil/route.ts');
    expect(cs).toHaveLength(0);
    const rota = readFileSync('src/app/api/dados/perfil/route.ts', 'utf8');
    expect(rota).toMatch(/entradaPlanoVisivelSchema/);
    expect(rota).toMatch(/comandoCommitDePlano\([^\n]+entrada\?\.data/);
  });
});

describe('🔒 editar o perfil REANCORA — e o gate não ganha porta dos fundos', () => {
  it('`recalcular` usa o novo peso na prévia e só reancora depois da aceitação', () => {
    const corpo = corpoDe(semComentarios(PAINEL), 'function recalcular(');
    expect(corpo).toMatch(/novo\.pesoKg !== perfil\.pesoKg.*reancorarPesoDoPlanoLocal\(novo\.pesoKg/s);
    // A prévia usa o peso digitado sem gravar a âncora antes da confirmação.
    expect(corpo).toMatch(/const pesoEfetivoKg = novo\.pesoKg !== perfil\.pesoKg \? novo\.pesoKg/);
    expect(corpo.indexOf('reancorarPesoDoPlanoLocal')).toBeGreaterThan(corpo.indexOf('if (!aceitarGeracao(nt)) return'));
    expect(corpo.indexOf('reancorarPesoDoPlanoLocal')).toBeGreaterThan(corpo.indexOf('assinatura !== assinaturaConfirmada'));
  });

  it('a reancoragem PRESERVA a faixa e o pino (a linha que fecha a porta)', () => {
    const corpo = corpoDe(semComentarios('src/lib/engine/peso-suavizado.ts'), 'export function reancorar(');
    // 🔴 Se qualquer um dos dois voltasse a `FAIXA_INICIAL`/`null`, digitar um número
    // limparia a carência do gate — e nenhum outro teste desta suíte notaria.
    expect(corpo).toMatch(/faixa: anterior\?\.faixa \?\? FAIXA_INICIAL/);
    expect(corpo).toMatch(/pesoNaFaixaKg: anterior\?\.pesoNaFaixaKg \?\? null/);
    // E a âncora reancorada precisa se declarar DIGITADA — é o carimbo que gradua a saída.
    expect(corpo).toMatch(/ancoraMedida: false/);
  });

  it('o estado GRAVADO antes do refinamento é lido como MEDIDO (default conservador)', () => {
    const src = semComentarios('src/lib/peso-plano.ts');
    // 🔴 `!!f?.porMedicao` trataria toda âncora antiga como digitada e abriria a saída por
    // teclado no upgrade — para quem já estava em faixa protetiva medida, em produção.
    expect(src).toMatch(/porMedicao: f\?\.porMedicao !== false/);
    expect(src).toMatch(/ancoraMedida: o\.ancoraMedida !== false/);
    expect(src, 'coerção que inverteria o default').not.toMatch(/porMedicao: !!/);
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

/**
 * 🔒 O EIXO KCAL DO GATE ENTRA NA HISTERESE ASSIMÉTRICA (DF 2026-08-01,
 * `gate-de-saude-adaptkorpus` §Histerese assimétrica · prova em
 * `parametros-motor-dieta-adaptkorpus` §⚖️ regra 2).
 *
 * O desfecho `GET ≤ piso_seguro → ROTEAR` (1250 F / 1550 M) tem de se comportar como os
 * cortes de IMC: **entrar a cada leitura sobre o suavizado** (o limiar de Δ e o teto de
 * 1×/semana não bloqueiam) · **sair só depois de 14 dias**.
 *
 * 🔑 **Por que este bloco existe mesmo com o código já correto.** A conexão de 2026-07-31
 * usou um critério DERIVADO (`comportamento !== 'PERMITIR'`), então o eixo kcal entrou de
 * graça — mas **a prova daquele dia foi toda sobre IMC**. Código certo sem prova é código
 * que a próxima refatoração quebra em silêncio: trocar o predicado por uma checagem de
 * faixas de IMC passaria em toda a suíte anterior. **O guard não conserta nada aqui; ele
 * impede o conserto de ser desfeito.**
 *
 * ⚠️ E é COMPORTAMENTAL de propósito — executa o predicado de produção com um suavizado
 * sub-piso. Um guard que casasse a escrita ("a chamada de ROTEAR está fora do bloco da
 * histerese") ficaria cego para a mutação mais natural; foi o degrau achado em `f52bd12`.
 */
describe('🔒 o eixo kcal do gate — entrar imediato, sair em 14 dias', () => {
  const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
  /** Feminino · 155 cm · 60 a · sedentária: cruza o piso de 1250 em 53,392 kg — com IMC 22,2. */
  const MULHER = { sexo: 'feminino', alturaCm: 155, idade: 60, nivelAtividade: 'sedentario', objetivo: 'saude', flagsSaude: SEM, pesoKg: 54.2 } as const;
  const perfilCom = (p: Omit<PerfilUsuario, 'pesoKg'>, pesoKg: number): PerfilUsuario => ({ ...p, pesoKg });
  const serie = (kg: number, dias: readonly string[]) => dias.map((d) => ({ dataISO: d, kg }));
  const ancoraEm = (kg: number, desde: string) => ({
    ancoraKg: kg, ancoraDesdeISO: desde, ancoraMedida: true,
    faixa: { ativa: false, foraDesdeISO: null, porMedicao: false }, pesoNaFaixaKg: null, reancoraISO: null,
  });

  /**
   * 🔑 O PAR DISCRIMINANTE que prova que isto é o eixo KCAL e não o de IMC: em 53,30 kg o
   * IMC é 22,19 — **longe de todos os cortes** (16 · 18,5 · 25 · 30). Um predicado escrito
   * sobre faixas de IMC devolveria "fora da faixa" aqui e o encaminhamento sumiria.
   */
  it('o caso é invisível para qualquer regra de IMC — quem fala é o piso calórico', () => {
    const g = avaliarGateSaude(perfilCom(MULHER, 53.3));
    expect(g.derivados.imc).toBeCloseTo(22.19, 2);
    expect(g.derivados.get).toBeCloseTo(1248.9, 1);
    expect(g.derivados.get).toBeLessThanOrEqual(g.derivados.pisoSeguro);
    expect(g.comportamento).toBe('ROTEAR');
    // …e o predicado DE PRODUÇÃO enxerga esse peso como faixa protetiva.
    expect(fazEmFaixaProtetiva(MULHER)(53.3)).toBe(true);
    // O par: 54,2 kg (GET 1259,7 > 1250) é PERMITIR — o mesmo perfil, só o peso muda.
    expect(avaliarGateSaude(perfilCom(MULHER, 54.2)).comportamento).toBe('PERMITIR');
    expect(fazEmFaixaProtetiva(MULHER)(54.2)).toBe(false);
  });

  it('ENTRAR: Δ = 0,90 kg < 1 kg suprime a recomputação, e o ROTEAR sai na mesma leitura', () => {
    const r = resolverPesoDoPlano({
      pesagens: serie(53.3, ['2026-07-30', '2026-07-31', '2026-08-01']),
      hojeISO: '2026-08-01',
      pesoPerfilKg: 54.2,
      anterior: ancoraEm(54.2, '2026-07-29'),
      emFaixaProtetiva: fazEmFaixaProtetiva(MULHER),
    });
    // A histerese de RECOMPUTAÇÃO continua valendo: a âncora não se moveu, não houve evento.
    expect(54.2 - 53.3).toBeCloseTo(0.9, 10);
    expect(r.estado.ancoraKg).toBe(54.2);
    expect(r.evento).toBeNull();
    // …e mesmo assim o plano é resolvido no peso da LEITURA, que o gate rotea.
    expect(r.pesoKg).toBe(53.3);
    expect(avaliarGateSaude(perfilCom(MULHER, r.pesoKg)).comportamento).toBe('ROTEAR');
    expect(r.estado.faixa).toMatchObject({ ativa: true, porMedicao: true });
  });

  it('SAIR: volta acima do piso e continua em ROTEAR por 14 dias — prova própria', () => {
    let estado = resolverPesoDoPlano({
      pesagens: serie(53.3, ['2026-07-30', '2026-07-31', '2026-08-01']),
      hojeISO: '2026-08-01', pesoPerfilKg: 54.2, anterior: ancoraEm(54.2, '2026-07-29'),
      emFaixaProtetiva: fazEmFaixaProtetiva(MULHER),
    }).estado;
    const pesagens = [...serie(53.3, ['2026-07-30', '2026-07-31', '2026-08-01']), ...serie(55, ['2026-08-02', '2026-08-03', '2026-08-04'])];
    const ler = (hojeISO: string) => {
      const r = resolverPesoDoPlano({ pesagens, hojeISO, pesoPerfilKg: 54.2, anterior: estado, emFaixaProtetiva: fazEmFaixaProtetiva(MULHER) });
      estado = r.estado;
      return { peso: r.pesoKg, gate: avaliarGateSaude(perfilCom(MULHER, r.pesoKg)).comportamento };
    };
    // 2026-08-04: a leitura já saiu do piso, mas o PINO segura o peso de dentro da faixa.
    expect(ler('2026-08-04')).toEqual({ peso: 53.3, gate: 'ROTEAR' });
    expect(ler('2026-08-10')).toEqual({ peso: 53.3, gate: 'ROTEAR' });
    // Véspera do 14º dia: ainda dentro.
    expect(ler('2026-08-17')).toEqual({ peso: 53.3, gate: 'ROTEAR' });
    // 14 dias completos a partir de 2026-08-04 → a carência vence e o plano volta à âncora.
    expect(ler('2026-08-18')).toEqual({ peso: 54.2, gate: 'PERMITIR' });
    expect(estado.faixa.ativa).toBe(false);
  });

  it('🟢 INOCENTE 1: suavizado se move SEM cruzar o piso → nada muda e o plano não recomputa', () => {
    const r = resolverPesoDoPlano({
      // 54,2 → 53,8: GET 1254,4 > 1250, e Δ = 0,4 kg < 1 kg.
      pesagens: serie(53.8, ['2026-07-30', '2026-07-31', '2026-08-01']),
      hojeISO: '2026-08-01', pesoPerfilKg: 54.2, anterior: ancoraEm(54.2, '2026-07-29'),
      emFaixaProtetiva: fazEmFaixaProtetiva(MULHER),
    });
    expect(avaliarGateSaude(perfilCom(MULHER, 53.8)).comportamento).toBe('PERMITIR');
    expect(r.estado.faixa.ativa).toBe(false);
    expect(r.evento).toBeNull();          // a proteção contra churn do cardápio segue de pé
    expect(r.estado.ancoraKg).toBe(54.2);
    expect(r.pesoKg).toBe(54.2);          // faixa calada → quem manda é a âncora
  });

  it('🟢 INOCENTE 2: o caso de IMC de 2026-07-31 (1,60 m · 41,5 → 40,8) não regrediu', () => {
    const magra = { sexo: 'feminino', alturaCm: 160, idade: 30, nivelAtividade: 'sedentario', objetivo: 'saude', flagsSaude: SEM, pesoKg: 41.5 } as const;
    expect(avaliarGateSaude(perfilCom(magra, 41.5)).derivados.imc).toBeCloseTo(16.21, 2);
    expect(avaliarGateSaude(perfilCom(magra, 40.8)).derivados.imc).toBeCloseTo(15.94, 2);
    const r = resolverPesoDoPlano({
      pesagens: serie(40.8, ['2026-07-30', '2026-07-31', '2026-08-01']),
      hojeISO: '2026-08-01', pesoPerfilKg: 41.5, anterior: ancoraEm(41.5, '2026-07-29'),
      emFaixaProtetiva: fazEmFaixaProtetiva(magra),
    });
    expect(41.5 - 40.8).toBeCloseTo(0.7, 10);   // Δ < 1 kg: recomputação suprimida
    expect(r.estado.ancoraKg).toBe(41.5);
    expect(r.pesoKg).toBe(40.8);
    expect(avaliarGateSaude(perfilCom(magra, r.pesoKg)).comportamento).toBe('ROTEAR');
  });
});
