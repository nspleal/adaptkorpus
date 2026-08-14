/**
 * 🔴 CHIPS DA BIBLIOTECA — nome acessível não-vazio e fileira que não é esmagada
 * (pedido-ui-biblioteca-e-voltar-2026-08-13, item 1c).
 *
 * O defeito fotografado pelo autor — "pílulas sem nenhum texto, desalinhadas e sobrepostas"
 * — NÃO era rótulo faltando. Medido no Chromium a 390×844 com o componente real: os 20 chips
 * tinham texto, cor `rgba(234,229,219,.8)` e `visibility: visible`; o que quebrava era a
 * ALTURA. As fileiras são itens flex da coluna do modal (`maxHeight: 88vh`) e nasciam com o
 * `flex-shrink: 1` do default; a lista irmã tem `scrollHeight` ~3200px e `min-height: auto`,
 * então se recusava a ceder e o navegador tirava a altura de quem podia encolher:
 *
 *   fileira 14px · chip 16px (o padding do chip sozinho já são 14px) → rótulo cortado
 *   com `flexShrink: 0` + `minHeight: 0`: fileira 39px · chip 31px → rótulo inteiro
 *
 * 🔒 Guard em DUAS pernas, ambas como REGRA GLOBAL (família do "13 de 17 sem foco" — nunca
 * elemento a elemento):
 *  ① todo valor de filtro tem rótulo não-vazio, senão o chip nasce sem nome acessível;
 *  ② toda fileira de chips declara `flexShrink: 0` e a lista declara `minHeight: 0` — as
 *    duas metades do conserto, que só funcionam juntas.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROTULO_GRUPO, ROTULO_PADRAO } from '../../lib/frequencia-grupos';

const ARQ = 'src/components/painel/SeletorExercicio.tsx';
const fonte = readFileSync(ARQ, 'utf8');
/** Sem comentários: um `flexShrink: 0` citado em JSDoc não pode fazer o guard passar. */
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Os valores que viram chip, lidos da FONTE — não uma segunda lista escrita aqui. */
const listaDoArquivo = (nome: string): string[] => {
  const m = codigo.match(new RegExp(`const ${nome}[^=]*=\\s*\\[([^\\]]*)\\]`));
  expect(m, `${nome} não encontrado em ${ARQ}`).toBeTruthy();
  return [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
};

describe('🔴 chips da biblioteca — ① nome acessível não-vazio', () => {
  it('todo grupo filtrável tem rótulo não-vazio', () => {
    const semRotulo = listaDoArquivo('GRUPOS').filter((g) => !(ROTULO_GRUPO[g] ?? '').trim());
    expect(semRotulo, `grupos sem rótulo: ${semRotulo.join(', ')}`).toEqual([]);
  });

  it('todo padrão filtrável tem rótulo não-vazio', () => {
    const semRotulo = listaDoArquivo('PADROES_FILTRO').filter((p) => !(ROTULO_PADRAO[p] ?? '').trim());
    expect(semRotulo, `padrões sem rótulo: ${semRotulo.join(', ')}`).toEqual([]);
  });

  /**
   * PAR DISCRIMINANTE: não basta o mapa ter a chave — o chip precisa RENDERIZAR o rótulo.
   * Um `<button style={chip(...)} />` sem filho passaria nos dois testes acima.
   */
  it('todo chip renderiza conteúdo entre as tags (nenhum botão de chip vazio)', () => {
    const vazios = [...codigo.matchAll(/<button[^>]*style=\{chip\([^)]*\)\}[^>]*>([\s\S]*?)<\/button>/g)]
      .map((m) => m[1]!.trim())
      .filter((interno) => interno === '');
    expect(vazios.length, 'há chip renderizado sem nenhum conteúdo').toBe(0);
    // e existem chips de fato (o regex acima não pode passar por não achar nada)
    expect(codigo.match(/style=\{chip\(/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

describe('🔴 chips da biblioteca — ② a fileira não pode ser esmagada', () => {
  it('toda fileira de chips declara flexShrink: 0', () => {
    // As fileiras são as divs com scroll horizontal; todas passam pelo helper `fileiraChips`.
    const inline = [...codigo.matchAll(/<div style=\{\{[^}]*overflowX: 'auto'[^}]*\}\}/g)].map((m) => m[0]!);
    const semShrink = inline.filter((d) => !/flexShrink: 0/.test(d));
    expect(semShrink, `fileira com scroll horizontal sem flexShrink: 0:\n${semShrink.join('\n')}`).toEqual([]);
    const helper = codigo.match(/const fileiraChips[\s\S]*?\}\);/)?.[0] ?? '';
    expect(helper, 'o helper fileiraChips sumiu ou perdeu o flexShrink: 0').toMatch(/flexShrink: 0/);
    expect(helper).toMatch(/overflowX: 'auto'/);
  });

  it('a lista declara minHeight: 0 — a outra metade do conserto', () => {
    const lista = codigo.match(/<div style=\{\{ flex: 1[^}]*\}\}/)?.[0] ?? '';
    expect(lista, `lista rolável não encontrada em ${ARQ}`).not.toBe('');
    expect(lista, 'sem minHeight: 0 a lista se recusa a encolher e esmaga os chips de novo').toMatch(/minHeight: 0/);
  });

  it('cabeçalho e busca também não encolhem (era o desalinhamento da captura)', () => {
    const cabecalho = codigo.match(/<div style=\{\{[^}]*justifyContent: 'space-between'[^}]*\}\}/)?.[0] ?? '';
    expect(cabecalho).toMatch(/flexShrink: 0/);
    const busca = codigo.match(/style=\{\{[^}]*boxSizing: 'border-box'[^}]*\}\}/)?.[0] ?? '';
    expect(busca).toMatch(/flexShrink: 0/);
  });
});
