/**
 * 🧭 O EDITOR GUIADO na TELA — aceites do handoff-editor-guiado-2026-08-13.
 *
 * Guards estáticos, no padrão da casa. O que se prova aqui é o que a suíte de motor não
 * alcança: que a porta EXISTE, que o aviso NÃO trava (DF①), que a prescrição não é
 * editável (DF②), e que o editor é inalcançável em ROTEAR pelo MESMO mecanismo das demais
 * superfícies de treino (P0.3) — sem checagem nova para manter em dia.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISPONIBILIDADE } from './modo-diario';

const fonte = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

const painel = fonte('src/components/painel/Painel.tsx');
const editor = fonte('src/components/painel/EditorTreino.tsx');

describe('🧭 a porta do editor é ENCONTRÁVEL (pedido nº 5)', () => {
  it('a aba Treino oferece "Montar meu treino", fora de condicional', () => {
    expect(painel, 'o botão do editor sumiu').toMatch(/Montar meu treino/);
    const i = painel.indexOf('onClick={onMontar}');
    expect(i, 'o botão não chama o editor').toBeGreaterThan(-1);
    const antes = painel.slice(Math.max(0, i - 120), i);
    expect(/&&\s*$|\?\s*$/.test(antes.trimEnd()), 'a porta ficou atrás de condição').toBe(false);
  });

  it('as duas entradas existem: editar o plano atual e montar do zero', () => {
    expect(painel, 'não parte do plano atual').toMatch(/doPlano\(rotinaDias/);
    // "Começar vazio" = adicionar dia num editor sem exercícios; o botão existe.
    expect(editor).toMatch(/\+ Adicionar dia/);
    expect(editor).toMatch(/\+ Adicionar exercício/);
  });
});

/**
 * 🔒 P0.3 — ROTEAR NÃO EDITA, pelo mesmo mecanismo de sempre. O editor vive DENTRO do ramo
 * `prescricao`; em modo diário `plano_treino` é 'ausente' e `prescricao` é null, então a
 * superfície não existe. Nenhuma checagem nova — é a lição do modo diário: lista própria de
 * guard vira terceira cópia da verdade.
 */
describe('🔒 P0.3 — o editor não alcança quem o gate roteou', () => {
  it('o plano de treino continua AUSENTE em modo diário (a fonte da decisão)', () => {
    expect(DISPONIBILIDADE.plano_treino).toBe('ausente');
    expect(DISPONIBILIDADE.sessao_guiada).toBe('ausente');
  });

  it('o editor é renderizado dentro do ramo que exige `prescricao`', () => {
    const i = painel.indexOf('<EditorTreino');
    expect(i, 'o editor não é montado').toBeGreaterThan(-1);
    const antes = painel.slice(Math.max(0, i - 400), i);
    expect(antes, 'o editor deixou de depender de `prescricao` — ROTEAR passaria a editar')
      .toMatch(/aba === 'treino' && prescricao && editorDias/);
  });

  it('a porta também: o botão "Montar" vive na TreinoTab, que só existe com prescrição', () => {
    const iTab = painel.indexOf("aba === 'treino' && !editorDias && (prescricao");
    expect(iTab, 'a aba Treino deixou de exigir prescrição').toBeGreaterThan(-1);
    expect(painel.indexOf('onMontar={abrirEditor}')).toBeGreaterThan(iTab);
  });
});

describe('🔒 DF① — o aviso NÃO trava', () => {
  it('o salvar só desabilita com treino vazio ou agenda inválida, nunca por aviso', () => {
    const i = editor.indexOf('Salvar meu treino');
    const bloco = editor.slice(Math.max(0, i - 700), i);
    expect(bloco, 'o botão de salvar não é o esperado').toMatch(/disabled=\{total === 0 \|\| !diasUnicos\}/);
    // 🔑 O par discriminante: nenhuma forma de aviso pode aparecer na condição do disabled.
    expect(/disabled=\{[^}]*avis/i.test(bloco), 'o aviso passou a travar o salvamento').toBe(false);
    expect(/disabled=\{[^}]*risco/i.test(bloco), 'o risco passou a travar o salvamento').toBe(false);
  });

  it('o crítico não devolve nada que possa bloquear (o tipo não tem campo de trava)', () => {
    const critico = fonte('src/lib/engine/critico.ts');
    expect(/bloqueia|impede|travar|proibid/i.test(critico), 'apareceu conceito de bloqueio no crítico').toBe(false);
  });
});

describe('🔒 DF② — edição manual de séries; reps e RIR permanecem automáticos', () => {
  it('não há campo de rep ou RIR editável', () => {
    // O editor NÃO estima séries: a prévia vem do motor (`preverPlano`). Aqui se prova só
    // que não existe edição de prescrição na tela.
    expect(/onChange[^;]{0,120}(reps|rir)/i.test(editor), 'apareceu edição de prescrição').toBe(false);
    expect(/setReps|setRir/i.test(editor), 'apareceu estado de prescrição no editor').toBe(false);
  });

  it('persiste a referência contextual autorizada, sem tornar reps/RIR editáveis', () => {
    expect(editor).toMatch(/exercicioIds: d\.exercicios\.map\(\(e\) => e\.id\)/);
    const i = editor.indexOf('export function paraRotinaCustom');
    const corpo = editor.slice(i, editor.indexOf('\n}', i));
    // Decisão de 20/09: descanso do automático atravessa a persistência com contexto.
    // Paridade e invalidação são exercitadas pelo motor em paridade-plano-editor.test.ts.
    expect(corpo).toContain('referenciaDescanso: d.referenciaDescanso');
    expect(/\breps\b|\brir\b/i.test(corpo)).toBe(false);
  });

  /**
   * 🔑 A PRÉVIA É O MOTOR, não uma estimativa. Defeito achado no aceite 3 e consertado: com
   * um número fixo de séries, 5 exercícios de peito apareciam "abaixo do mínimo" enquanto o
   * plano salvo entregaria 16 — o crítico mentindo sobre o número que ele existe para
   * explicar.
   */
  it('o placar do editor vem do motor (preverPlano), nunca de séries chutadas', () => {
    expect(editor, 'o editor voltou a estimar séries por conta própria').not.toMatch(/seriesPadrao/);
    // 🔵 2026-09-15: a prévia passou a devolver TAMBÉM o contexto (faixa/fase da semana e os
    // avisos do motor), então os dias saem de `previsao.dias`. O que este guard protege é o
    // mesmo de sempre — o placar vem de `preverPlano`, na mesma memo, nunca de estimativa.
    expect(editor).toMatch(/const previsao = useMemo\(\(\) => preverPlano\(dias\)/);
    expect(editor).toMatch(/const previsto = previsao\.dias/);
    expect(painel, 'a prévia não usa o mesmo recompute do salvamento').toMatch(/function preverPlano[\s\S]{0,600}recomputarPlano\(\{ \.\.\.perfil, rotinaCustom \}/);
  });

  it('o crítico permanece no plano JÁ SALVO, no mesmo componente (faixa compacta)', () => {
    expect(painel, 'a faixa do crítico sumiu do plano salvo').toMatch(/<PainelCritico avaliacao=\{criticoPlano\} compacto \/>/);
    expect(editor, 'o componente do crítico deixou de ser compartilhado').toMatch(/export function PainelCritico/);
  });

  /**
   * 🔵 2026-09-16 — "Voltar ao recomendado" VIROU "Gerar novo treino", COM PRÉVIA.
   *
   * O guard anterior fixava o comportamento antigo: o botão do editor chamava
   * `onVoltarAoRecomendado`, que apagava `rotinaCustom` e recomputava, e a confirmação era um
   * diálogo sem prévia dentro do próprio editor. Ele fica mais FORTE aqui, não mais fraco: o
   * que se exige agora é que a substituição passe por uma proposta calculada, mostrada e só
   * então aplicada — e que o desenho salvo não seja tocado antes disso.
   */
  it('substituir o treino exige PRÉVIA e confirmação, e só então grava', () => {
    // A porta do editor abre a proposta; ela não apaga nada por conta própria.
    expect(editor, 'a porta "Gerar novo treino" sumiu do editor').toMatch(/onClick=\{onGerarNovo\}/);
    const corpoDoEditor = editor.slice(0, editor.indexOf('function CampoSeries'));
    expect(/rotinaCustom:\s*undefined/.test(corpoDoEditor), 'o editor voltou a apagar o desenho direto').toBe(false);
    // O Painel calcula a proposta e SÓ o "aplicar" escreve no perfil.
    expect(painel).toMatch(/function pedirProposta/);
    expect(painel).toMatch(/function aplicarProposta/);
    const pedir = painel.slice(painel.indexOf('function pedirProposta'), painel.indexOf('function aplicarProposta'));
    expect(/setPerfil\(|notificarPerfil\(/.test(pedir), 'calcular a proposta já gravava o perfil').toBe(false);
    // Cancelar não escreve.
    const cancelar = painel.slice(painel.indexOf('function cancelarProposta'));
    const corpoCancelar = cancelar.slice(0, cancelar.indexOf('  }'));
    // 🔑 A âncora tem de ter pegado o corpo certo — senão o guard passaria por fatia vazia.
    expect(corpoCancelar, 'a âncora de `cancelarProposta` não pegou o corpo').toMatch(/setProposta\(null\)/);
    expect(/setPerfil\(|notificarPerfil\(|recomputarPlano\(/.test(corpoCancelar), 'cancelar passou a gravar').toBe(false);
    // E a confirmação continua existindo, agora com a prévia do plano proposto.
    const proposta = fonte('src/components/painel/PropostaTreino.tsx');
    expect(proposta, 'a confirmação sumiu').toMatch(/Manter o meu/);
    expect(proposta, 'a prévia do plano proposto sumiu').toMatch(/proposta\.rotina\.dias/);
  });

  /** 🔒 O desenho manual continua sendo da pessoa: a troca de origem é DITA. */
  it('substituir um desenho manual por um plano automático é declarado na tela', () => {
    const proposta = fonte('src/components/painel/PropostaTreino.tsx');
    expect(proposta).toMatch(/origemAntes === 'manual' && .*origemDepois === 'automatico'/);
    expect(proposta).toMatch(/montado pelo app/);
  });
});

describe('🔒 telemetria do editor — payload fechado, e o adverso incluído', () => {
  it('os três eventos têm call site', () => {
    expect(painel).toMatch(/registrarEvento\('editor_aberto'/);
    expect(painel).toMatch(/registrarEvento\('treino_custom_salvo'/);
    expect(painel).toMatch(/registrarEvento\('aviso_risco_mostrado'/);
  });

  it('o salvamento leva `avisos_ativos` — sem ele a DF① fica sem evidência', () => {
    expect(painel).toMatch(/avisos_ativos: avaliacao\.avisos\.length/);
  });

  it('o aviso emitido é o CÓDIGO do vocabulário fechado, nunca o texto da tela', () => {
    // ⚠️ Só a CHAMADA (até o `)`), e `texto` com fronteira de palavra: `contexto` contém
    // "texto" e derrubava o guard sem nada estar errado — âncora por substring de novo.
    const i = painel.indexOf("registrarEvento('aviso_risco_mostrado'");
    const chamada = painel.slice(i, painel.indexOf(')', i) + 1);
    expect(chamada).toMatch(/codigo/);
    expect(/\btexto\b|\bmensagem\b/i.test(chamada), 'o texto do aviso vazou para a telemetria').toBe(false);
  });
});
