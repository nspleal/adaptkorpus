/**
 * 🔁🦴 AS DUAS AÇÕES DO TREINO E A COBERTURA MUSCULAR — os guards de TELA.
 *
 * Guards estáticos, no padrão da casa: o que a suíte de motor não alcança é se a porta
 * EXISTE, se a copy diz o que pode dizer, e se nenhuma trava nova nasceu. Regra e número
 * continuam sendo provados nos testes de comportamento (`proposta-treino`,
 * `engine/cobertura-editor`, `engine/variacao-montagem`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const fonte = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
/** Sem comentários: o que se mede é o que a pessoa vê, não o que o código explica. */
const semComentarios = (p: string) => fonte(p)
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

const painel = semComentarios('src/components/painel/Painel.tsx');
const editor = semComentarios('src/components/painel/EditorTreino.tsx');
const proposta = semComentarios('src/components/painel/PropostaTreino.tsx');
const cobertura = semComentarios('src/components/painel/CoberturaMuscular.tsx');

describe('🔁 as DUAS ações existem e são distinguíveis', () => {
  it('a aba Treino oferece "Gerar novo treino" E "Atualizar treino"', () => {
    expect(painel).toMatch(/Gerar novo treino/);
    expect(painel).toMatch(/Atualizar treino/);
    expect(painel).toMatch(/onClick=\{onGerarNovo\}/);
    expect(painel).toMatch(/onClick=\{onAtualizar\}/);
  });

  it('a diferença entre as duas é TEXTO VISÍVEL, não um `title` que o celular não mostra', () => {
    const linha = painel.replace(/\s+/g, ' ');
    expect(linha, 'o "atualizar" não explica que preserva o compatível')
      .toMatch(/Atualizar treino<\/strong> adapta o que você já tem às suas preferências atuais, preservando o que continua compatível/);
    expect(linha, 'o "gerar" não avisa que há prévia antes de substituir')
      .toMatch(/Nos dois casos você vê antes de substituir/);
    // 🔒 `title` sobrescreve o NOME ACESSÍVEL do botão: o leitor de tela anunciava a frase
    // inteira no lugar do rótulo. Nenhum dos dois botões pode voltar a usá-lo.
    for (const gatilho of ['onClick={onAtualizar}', 'onClick={onGerarNovo}']) {
      const i = painel.indexOf(gatilho);
      expect(/title=/.test(painel.slice(i, i + 400)), `${gatilho} voltou a usar title`).toBe(false);
    }
  });

  it('o editor diz que a proposta parte do treino SALVO, não do rascunho aberto', () => {
    expect(editor.replace(/\s+/g, ' ')).toMatch(/monta uma proposta do app a partir do seu treino <strong>salvo<\/strong>/);
  });

  it('as duas passam pela MESMA porta, com o tipo explícito', () => {
    expect(painel).toMatch(/pedirProposta\('gerar'\)/);
    expect(painel).toMatch(/pedirProposta\('atualizar'\)/);
  });
});

describe('🔒 carregamento, falha e clique repetido', () => {
  it('o pedido é ignorado enquanto há cálculo em curso ou proposta na tela', () => {
    const i = painel.indexOf('function pedirProposta');
    const corpo = painel.slice(i, i + 400);
    expect(corpo).toMatch(/if \(calculandoProposta \|\| proposta \|\| aplicandoPropostaRef\.current\) return;/);
  });

  it('o estado de carregamento chega aos botões e os desabilita', () => {
    expect(painel).toMatch(/disabled=\{calculandoProposta != null\}/);
    expect(painel).toMatch(/Montando…|Conferindo…/);
  });

  it('aplicar é fechado por ref — clique repetido não grava duas vezes', () => {
    const i = painel.indexOf('function aplicarProposta');
    const corpo = painel.slice(i, painel.indexOf('function cancelarProposta'));
    expect(corpo).toMatch(/if \(!proposta \|\| aplicandoPropostaRef\.current\) return;/);
    expect(corpo).toMatch(/aplicandoPropostaRef\.current = true;/);
  });

  it('falha de cálculo é DITA, e diz que nada mudou', () => {
    expect(painel).toMatch(/Não foi possível montar uma proposta agora\. Seu treino atual continua como está\./);
    expect(painel).toMatch(/role="alert"[\s\S]{0,300}erroProposta/);
  });

  /**
   * 🔴 VALIDAÇÃO 16/09 — proposta velha não grava, e aplicar é REBASE sobre o perfil CORRENTE.
   *
   * Gravar `proposta.perfilProposto` inteiro devolvia ao perfil tudo o que mudou entre montar e
   * aplicar. E aplicar uma proposta montada sobre preferências antigas gravaria um treino que
   * não descreve mais o que a pessoa escolheu.
   */
  it('aplicar recusa proposta velha e rebase sobre o perfil corrente', () => {
    const i = painel.indexOf('function aplicarProposta');
    const corpo = painel.slice(i, painel.indexOf('function cancelarProposta'));
    expect(corpo, 'a base da gravação deixou de ser o perfil corrente').toMatch(/const atual = perfilRef\.current;/);
    expect(corpo, 'a assinatura das entradas não é conferida').toMatch(/proposta\.assinaturaDasEntradas !== assinaturaDasEntradas\(atual, entradaDoPlano\(atual\)\)/);
    expect(corpo.replace(/\s+/g, ' ')).toMatch(/setPropostaDesatualizada\(true\); return;/);
    expect(corpo, 'voltou a gravar a fotografia inteira').toMatch(/aplicarPropostaSobre\(atual, proposta\)/);
    expect(/novoPerfil = proposta\.perfilProposto/.test(corpo), 'a gravação voltou a substituir o perfil').toBe(false);
    // A recusa tem saída: montar de novo com o que vale agora.
    expect(painel).toMatch(/function remontarProposta/);
    expect(proposta).toMatch(/Montar de novo/);
    expect(proposta).toMatch(/Suas preferências mudaram depois que esta proposta foi montada/);
    // E no estado desatualizado o botão de aplicar não existe.
    expect(proposta).toMatch(/\{!nada && !desatualizada && \(/);
  });

  it('a assinatura da proposta sai da MESMA entrada canônica que o CAS certifica', () => {
    expect(painel).toMatch(/entrada: entradaDoPlano\(perfil\)/);
    expect(fonte('src/lib/proposta-treino.ts')).toMatch(/canonicalInputHash\(\{ perfil: semDecisao, opcoes: entrada \}\)/);
  });

  it('a gravação usa o caminho normal do perfil (fila, CAS, conflito), não um atalho', () => {
    const i = painel.indexOf('function aplicarProposta');
    const corpo = painel.slice(i, painel.indexOf('function cancelarProposta'));
    expect(corpo).toMatch(/notificarPerfil\(novoPerfil\)/);
    expect(/fetch\(|salvarPerfilServidor\(/.test(corpo), 'a aplicação abriu um caminho de gravação próprio').toBe(false);
  });
});

describe('🔒 a proposta explica o que muda, e o que NÃO muda', () => {
  it('lista o que entra, o que sai e o que continua', () => {
    expect(proposta).toMatch(/titulo="Entram"/);
    expect(proposta).toMatch(/titulo="Saem"/);
    expect(proposta).toMatch(/titulo="Continuam"/);
  });

  it('afirma a preservação de histórico, registros, progresso e fase do ciclo', () => {
    expect(proposta).toMatch(/histórico[\s\S]{0,140}registrados[\s\S]{0,140}progresso[\s\S]{0,140}ciclo/i);
  });

  it('a prévia mostra o plano REAL da proposta, não um resumo paralelo', () => {
    expect(proposta).toMatch(/proposta\.rotina\.dias/);
    expect(proposta).toMatch(/seriesDoSlot\(s\)/);
  });

  it('quando não há montagem diferente, a tela DIZ — e não oferece aplicar', () => {
    expect(proposta).toMatch(/Sem uma montagem diferente desta/);
    // Sem mudança ⇒ nenhum dos dois botões de ação existe (nem aplicar, nem remontar).
    expect(proposta).toMatch(/\{!nada && desatualizada && \(/);
    expect(proposta).toMatch(/\{!nada && !desatualizada && \(/);
  });

  /** 🔴 QA 16/09: "nada a mudar" tem de considerar o DESENHO salvo, não só a tela. */
  it('"nada a mudar" olha a rotina E o desenho salvo', () => {
    expect(proposta).toMatch(/function nadaMuda\(p: Proposta\): boolean \{\s*return p\.mudancas\.identica && !p\.desenhoAlterado\.mudou;/);
    expect(proposta).toMatch(/const nada = nadaMuda\(proposta\);/);
    expect(proposta, 'a tela não explica o que sai do treino salvo')
      .toMatch(/O que muda é o seu treino salvo[\s\S]{0,120}dele de vez/);
  });

  it('nome de exercício, nunca id interno, na lista de mudanças', () => {
    expect(proposta).toMatch(/nomeDoExercicio/);
    expect(painel).toMatch(/nomeDoExercicio=\{\(id\) => EXERCISES_SEED\.find\(\(e\) => e\.id === id\)\?\.nomePt \?\? id\}/);
  });
});

describe('🦴 a cobertura muscular: o que a tela pode afirmar', () => {
  it('usa a frase acordada, e NUNCA "não é ativada"', () => {
    expect(cobertura).toMatch(/Sem exercício identificado para esta região/);
    expect(/não é ativad|nao e ativad|não trabalha|não recruta/i.test(cobertura), 'apareceu negação de ativação').toBe(false);
  });

  it('nomeia inferência anatômica e participação auxiliar como coisas distintas', () => {
    expect(cobertura).toMatch(/Participação auxiliar \(por inferência anatômica\) — não fecha cobertura/);
    expect(cobertura).toMatch(/titulo=\{ROTULO_CONDICIONAL\}/);
  });

  /**
   * 🔴 DECISÃO DO AUTOR (2026-09-16): sem superfície para declarar execução nesta entrega.
   * Então o condicional usa o rótulo fechado, com a condição em português, e DIZ que escolher
   * o mesmo exercício não resolve — senão a tela induz a uma conclusão que o dado não sustenta.
   */
  it('o condicional usa o rótulo fechado e avisa que adicionar não resolve', () => {
    const copy = fonte('src/lib/condicao-execucao-copy.ts');
    expect(copy).toMatch(/export const ROTULO_CONDICIONAL = 'Depende da execução; não confirmado';/);
    expect(copy.replace(/\s+/g, ' ')).toMatch(/export const AVISO_NAO_RESOLVE = 'Adicionar não confirma esta região/);
    // O aviso acompanha as DUAS superfícies do condicional: a parte pendente e a sugestão.
    expect(cobertura).toMatch(/nota=\{AVISO_NAO_RESOLVE\}/);
    expect(cobertura.replace(/\s+/g, ' ')).toMatch(/\{ROTULO_CONDICIONAL\}\.<\/strong> Ele só contempla esta região \{condicoes\.join\(' ou '\)\}\. \{AVISO_NAO_RESOLVE\}/);
    // 🔒 Condicional NUNCA conta como cobertura: o estado é próprio e o motor não o soma.
    expect(fonte('src/lib/engine/cobertura-editor.ts'))
      .toMatch(/identificadas: partes\.filter\(\(p\) => p\.estado === 'identificada'\)\.length/);
  });

  it('a frase da condição tem UMA fonte, lida pelas duas telas', () => {
    const copy = fonte('src/lib/condicao-execucao-copy.ts');
    expect(copy).toMatch(/export function fraseDaCondicao/);
    expect(cobertura).toMatch(/fraseDaCondicao/);
    expect(fonte('src/components/painel/AlvosAnatomicos.tsx')).toMatch(/fraseDaCondicao/);
    // Nenhuma das duas telas pode voltar a ter a tabela própria.
    for (const arquivo of ['src/components/painel/CoberturaMuscular.tsx', 'src/components/painel/AlvosAnatomicos.tsx']) {
      expect(/const TEXTO_CONDICAO/.test(fonte(arquivo)), `${arquivo} recriou a tabela de condições`).toBe(false);
    }
  });

  it('não confunde cobertura com dose, ênfase ou resultado', () => {
    expect(cobertura).toMatch(/cobertura\.ressalva/);
    expect(cobertura).toMatch(/Cobertura não diz dose suficiente nem qual região predomina/);
    expect(/garante|garantia|hipertrofia|suficiente para/i.test(
      cobertura.replace('Cobertura não diz dose suficiente nem qual região predomina', ''),
    ), 'a tela passou a prometer resultado').toBe(false);
  });

  it('declara a lacuna do catálogo em vez de inventar sugestão', () => {
    expect(cobertura).toMatch(/Nenhum exercício do catálogo aborda esta região diretamente/);
    expect(cobertura).toMatch(/nenhum está liberado pelo seu equipamento/);
  });

  it('não expõe código interno de alvo — só o nome da ficha', () => {
    expect(cobertura).toMatch(/\{p\.nome\}/);
    // ⚠️ `key={p.alvo}` é identidade de lista, não texto. O que não pode é o id ser RENDERIZADO:
    // toda ocorrência de `p.alvo`/`parte.alvo` tem de estar dentro de um `key=`.
    const ocorrencias = [...cobertura.matchAll(/(\w*)=?\{(?:p|parte)\.alvo\}/g)];
    expect(ocorrencias.length, 'nenhuma ocorrência do alvo — o guard perdeu a âncora').toBeGreaterThan(0);
    for (const m of ocorrencias) expect(m[1], `o id do alvo saiu em "${m[0]}"`).toBe('key');
  });

  it('não adiciona nada sozinha: a inclusão passa pela mesma trava do seletor', () => {
    expect(cobertura).toMatch(/onAdicionar\(ex\)/);
    expect(/useEffect/.test(cobertura), 'apareceu efeito que poderia mexer no desenho sozinho').toBe(false);
    const i = editor.indexOf('<CoberturaMuscular');
    expect(i, 'a cobertura não é montada no editor').toBeGreaterThan(-1);
    expect(editor.slice(i, i + 600)).toMatch(/onAdicionar=\{\(ex\) => mut\(i, \(dia\) => \(\{ \.\.\.dia, exercicios: adicionarSemDuplicar\(dia\.exercicios, \[ex\]\)\.lista \}\)\)\}/);
  });

  it('não cria trava de salvamento por cobertura incompleta', () => {
    const i = editor.indexOf('Salvar meu treino');
    const bloco = editor.slice(Math.max(0, i - 700), i);
    expect(bloco).toMatch(/disabled=\{total === 0 \|\| !diasUnicos\}/);
    expect(/disabled=\{[^}]*cobertura/i.test(bloco), 'a cobertura passou a travar o salvamento').toBe(false);
    // A própria tela afirma que não trava — e o componente não tem controle desabilitável.
    expect(cobertura.replace(/\s+/g, ' ')).toMatch(/não impede salvar o seu treino/);
    expect(/disabled=/.test(cobertura), 'a cobertura ganhou um controle desabilitável').toBe(false);
  });

  it('a consequência de uma sugestão vem do cálculo do motor, sob demanda', () => {
    expect(editor).toMatch(/const efeitoDeAdicionar = useCallback/);
    expect(editor).toMatch(/avaliarDesenho\(hipotese\)/);
    expect(editor, 'o tempo deixou de vir da certificação do motor').toMatch(/previsao\.duracaoSegPorDia/);
    expect(painel, 'a prévia não publica o tempo certificado do motor').toMatch(/duracaoResistidaDias/);
    // Só calcula quando a pessoa pede: o botão é a porta.
    expect(cobertura).toMatch(/onClick=\{\(\) => setEfeito\(efeitoDe\(ex\)\)\}/);
  });

  it('abstenção do motor vira abstenção na tela, não um número inventado', () => {
    expect(cobertura).toMatch(/o app não conseguiu calcular o tempo deste dia/);
    expect(painel).toMatch(/estadoCalculo === 'CALCULADO'[\s\S]{0,140}: null/);
  });

  /**
   * 🔴 Defeito medido no QA de 16/09: o placar do crítico cobre só os grupos GRANDES, e a
   * primeira versão devolvia `0 − 0 = 0` para core/braços — a tela dizia "sem mudança no
   * volume semanal de Core", que é afirmação sem conta. Onde não há linha, não há frase.
   */
  it('não afirma volume semanal de grupo que o placar não acompanha', () => {
    expect(editor).toMatch(/const semanal = linhaAntes && linhaDepois \? linhaDepois\.ponderado - linhaAntes\.ponderado : null;/);
    expect(cobertura).toMatch(/efeito\.deltaSeriesDoGrupo == null\s*\?\s*null/);
  });

  /** 🔒 Alvo de toque do app: 44 px. Medido a 375 px no QA — as duas saíam com 40. */
  it('os controles da sugestão têm alvo de toque de 44 px', () => {
    const botoes = [...cobertura.matchAll(/minHeight: (\d+) \}\}/g)].map((m) => Number(m[1]));
    expect(botoes.length, 'nenhum botão com minHeight — o guard perdeu a âncora').toBeGreaterThan(0);
    for (const h of botoes) expect(h).toBeGreaterThanOrEqual(44);
  });

  it('fica fechada por padrão — resumo legível, detalhe sob demanda', () => {
    expect(cobertura).toMatch(/<details style=\{\{ marginTop: 10/);
    expect(/<details[^>]*\bopen\b/.test(cobertura), 'a cobertura passou a abrir sozinha').toBe(false);
  });
});

describe('🔒 o pool das sugestões é o do MOTOR', () => {
  it('o editor recebe `elegiveis` de `poolElegivel`, não o catálogo inteiro', () => {
    expect(painel).toMatch(/poolElegivel\(EXERCISES_SEED, perfil, perfil\.preferencias\)/);
    expect(painel).toMatch(/elegiveis=\{elegiveisDoPerfil\}/);
    const i = editor.indexOf('<CoberturaMuscular');
    expect(editor.slice(i, i + 400)).toMatch(/elegiveis=\{elegiveis\}/);
  });
});
