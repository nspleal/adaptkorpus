import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * TRAVAS DA REFEIÇÃO GUIADA — Leva 2.5 (cofre, DF 2026-07-26; handoff PEÇA A).
 *
 * Os dois testes de aceite que o autor pediu para o Bloco B:
 *  - FALHA se a refeição guiada emitir evento de "sessão concluída" ou expuser timer;
 *  - FALHA se caloria aparecer no REGISTRO de refeição.
 *
 * 🟢 O guarda-corpo, verbatim do cofre: "a refeição guiada é LEVE — sem timer, sem passo a
 * passo, sem cerimônia de 'sessão concluída'. Treino é evento com começo e fim; COMER NÃO É,
 * e transformar refeição em ritual cronometrado é exatamente como apps de contagem viram
 * obsessão."
 *
 * São guardas ESTÁTICOS sobre o fonte (padrão da casa — `rls-migrations.test.ts`): comentário
 * é removido antes da checagem, senão a própria documentação da trava derrubaria o teste.
 */

const FONTE = (caminho: string): string =>
  readFileSync(caminho, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const GUIADA = 'src/components/painel/DiaDaDieta.tsx';
const REGISTRO = 'src/components/painel/RegistroRefeicao.tsx';

describe('a refeição guiada não vira ritual cronometrado', () => {
  const src = FONTE(GUIADA);

  it('NÃO tem timer nem cronômetro', () => {
    // Nada de contagem regressiva: nem API de tempo por segundo, nem vocabulário de timer.
    expect(src).not.toMatch(/setTimeout|requestAnimationFrame/);
    expect(src).not.toMatch(/\btimer\b|cron[óo]metro|contagem regressiva|tempo restante/i);
    expect(src).not.toMatch(/\bsegundos?\b|\bminutos? restantes?\b/i);
    // `setInterval` existe UMA vez e é o relógio de parede (relê a hora a cada minuto para
    // saber qual é a próxima refeição) — não uma contagem da refeição em si.
    const intervals = src.match(/setInterval/g) ?? [];
    expect(intervals.length).toBe(1);
    expect(src).toMatch(/setInterval\(\(\) => setAgoraMin\(agoraEmMinutos\(\)\), 60_000\)/);
  });

  it('NÃO emite "sessão concluída" nem cerimônia de conclusão', () => {
    expect(src).not.toMatch(/sess[ãa]o (iniciada|conclu[ií]da|comec|finaliz)/i);
    expect(src).not.toMatch(/onConcluir|concluirSessao|onIniciar|iniciarSessao/);
    expect(src).not.toMatch(/parab[ée]ns|dia perfeito|conf[ée]te|trof[ée]u/i);
  });

  it('NÃO tem passo a passo nem barra de progresso de execução', () => {
    expect(src).not.toMatch(/passo \d|etapa \d|pr[óo]ximo passo|step\b/i);
    expect(src).not.toMatch(/progresso da refei[çc][ãa]o|barra de progresso/i);
  });

  it('NÃO tem modo de preparo (decisão travada: não somos app de culinária)', () => {
    expect(src).not.toMatch(/modo de preparo|como (fazer|preparar)|receita passo/i);
    expect(src).not.toMatch(/em breve/i); // nem o slot "em breve" para ele
  });

  it('o encerramento do dia é calmo — a copy travada do handoff', () => {
    expect(src).toContain('Constância, não perfeição');
    expect(src).toContain('Você registrou todas as refeições de hoje. Constância, não perfeição.');
    expect(src).not.toContain('quatro refeições');
  });
});

describe('caloria NÃO aparece no registro de refeição', () => {
  it('o controle de registro (seguiu/fora) não mostra kcal nem macro', () => {
    // 🔒 O `~X kcal` existe só no CARDÁPIO (que é o plano), nunca no registro nem no
    // histórico — `registro-de-aderencia-adaptkorpus`.
    const src = FONTE(REGISTRO);
    const i = src.indexOf('export function ControleRegistro');
    expect(i).toBeGreaterThan(-1);
    const j = src.indexOf('export function HistoricoDieta');
    const controle = src.slice(i, j > i ? j : undefined);
    // Proibido é o VALOR exibido: a unidade `kcal` e o acesso aos macros. A palavra
    // "calorias" em prosa é permitida — a copy travada usa justamente a negação
    // ("Sem calorias, sem cobrança"), que é a promessa, não a violação.
    expect(controle).not.toMatch(/kcal/i);
    expect(controle).not.toMatch(/\.(kcal|proteinaG|carboidratoG|gorduraG)\b/);
    expect(controle).not.toMatch(/\bmacros\b/);
  });

  it('o histórico de refeições não mostra kcal nem macro', () => {
    const src = FONTE(REGISTRO);
    const hist = src.slice(src.indexOf('export function HistoricoDieta'));
    expect(hist).not.toMatch(/kcal/i);
    expect(hist).not.toMatch(/\.(kcal|proteinaG|carboidratoG|gorduraG)\b/);
    expect(hist).not.toMatch(/\bmacros\b/);
  });

  it('na folha guiada o kcal fica no cabeçalho do PRATO, não no bloco de registro', () => {
    const src = FONTE(GUIADA);
    const i = src.indexOf('<ControleRegistro');
    expect(i).toBeGreaterThan(-1);
    // Do <ControleRegistro> até o fim da folha não pode haver kcal.
    const depois = src.slice(i, src.indexOf('function BotaoTracejado'));
    expect(depois).not.toMatch(/kcal/i);
  });
});

describe('travas de copy do handoff (valem para a peça inteira)', () => {
  const src = FONTE(GUIADA);

  it('nunca "IA" e nunca "curtir"', () => {
    expect(src).not.toMatch(/\bIA\b|intelig[êe]ncia artificial/i);
    expect(src).not.toMatch(/curtir/i);
  });

  it('separa kcal do cardápio atual da referência calculada, sem meta exata', () => {
    expect(src).toContain('kcal · cardápio atual');
    expect(src).toContain('Referência calculada do plano:');
    expect(src).toContain('É um guia, não uma meta exata.');
    expect(src).not.toMatch(/meta (di[áa]ria|exata) de (kcal|caloria)/i);
  });

  it('a ressalva do "guia, não meta" aparece UMA VEZ (só no cabeçalho do dia)', () => {
    // O handoff é explícito: não repetir no cartão da próxima refeição.
    const n = (src.match(/não uma meta exata/g) ?? []).length;
    expect(n).toBe(1);
  });

  it('sem vermelho e sem ícone de alerta — Alerta não aparece nesta peça', () => {
    expect(src).not.toContain('#E5484D');
    expect(src).not.toMatch(/você (faltou|errou|perdeu)|passou \d+ kcal/i);
  });

  it('"comi outra coisa" é neutro: nenhuma cor de falha na linha registrada', () => {
    // A linha registrada só troca a COR DO MARCADOR (Folha × Bone); o peso do texto é igual.
    expect(src).toContain("'Segui o plano' : 'Comi outra coisa'");
    expect(src).not.toMatch(/rgba\(229,\s*72,\s*77/); // Alerta em rgba
  });
});

describe('o relógio do dispositivo não entra no motor', () => {
  it('o motor não importa nem conhece a linha do dia', () => {
    // ⚠️ Mesmo padrão de `semana.ts`: o relógio fica na UI. `lib/engine` segue clock-free.
    const engine = FONTE('src/lib/engine/index.ts');
    expect(engine).not.toContain('dia-da-dieta');
    expect(engine).not.toContain('agoraEmMinutos');
  });

  it('quem lê o relógio é o componente, e passa os minutos para o módulo puro', () => {
    const src = FONTE(GUIADA);
    expect(src).toMatch(/linhaDoDia\(refeicoes, logs, agoraMin\)/);
    expect(src).toMatch(/agoraEmMinutos\(\)/);
  });
});
