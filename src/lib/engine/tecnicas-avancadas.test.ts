import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  aceitaTecnica, DESCRICAO_TECNICA, elegibilidade, JANELA_REGRESSAO_DIAS,
  MIN_SESSOES_ELEGIVEL, serieDaTecnica, TECNICAS, tecnicaDaSessao,
} from './tecnicas-avancadas';
import { EXERCISES } from '../data/exercises';
import type { ComportamentoGate } from './types';

/**
 * Técnicas avançadas — portão de 10 critérios (§🥊, DF 2026-07-31).
 * Um teste por critério que o motor verifica; os de tela ficam no guard de copy.
 */

const OK = {
  nivel: 'intermediario', sessoesResistidas: MIN_SESSOES_ELEGIVEL,
  comportamentoGate: 'PERMITIR' as ComportamentoGate, regressaoAtiva: false, ligado: true,
} as const;

describe('🔒 o portão — os critérios verificáveis pelo motor', () => {
  it('o caso base é elegível (senão nenhum negativo abaixo discrimina)', () => {
    expect(elegibilidade({ ...OK })).toEqual({ elegivel: true, motivo: null });
    expect(elegibilidade({ ...OK, nivel: 'avancado' }).elegivel).toBe(true);
  });

  it('① experiência DEMONSTRADA: iniciante nunca, nem com histórico enorme', () => {
    expect(elegibilidade({ ...OK, nivel: 'iniciante', sessoesResistidas: 500 }))
      .toEqual({ elegivel: false, motivo: 'nivel' });
  });

  it('① … e nível alto sem histórico também não — são as DUAS condições', () => {
    expect(MIN_SESSOES_ELEGIVEL).toBe(6);
    for (const n of [0, 1, 5]) {
      expect(elegibilidade({ ...OK, sessoesResistidas: n }), `${n} sessões`)
        .toEqual({ elegivel: false, motivo: 'sem_historico' });
    }
    expect(elegibilidade({ ...OK, sessoesResistidas: 6 }).elegivel).toBe(true);
  });

  it('② aderência às séries retas: regressão ativa barra', () => {
    expect(JANELA_REGRESSAO_DIAS).toBe(14);
    expect(elegibilidade({ ...OK, regressaoAtiva: true }))
      .toEqual({ elegivel: false, motivo: 'regressao' });
  });

  it('③ ROTEAR nunca vê a feature — e nenhum outro comportamento protetivo passa', () => {
    for (const c of ['ROTEAR', 'RESTRINGIR', 'PISAR'] as ComportamentoGate[]) {
      expect(elegibilidade({ ...OK, comportamentoGate: c }), c)
        .toEqual({ elegivel: false, motivo: 'gate' });
    }
  });

  it('⑥ opt-in: desligado não é elegível, e é o ÚLTIMO motivo (a tela precisa do resto)', () => {
    expect(elegibilidade({ ...OK, ligado: false })).toEqual({ elegivel: false, motivo: 'desligado' });
    // Quem é iniciante E está desligado ouve "nivel", não "desligado": ligar não resolveria.
    expect(elegibilidade({ ...OK, nivel: 'iniciante', ligado: false }).motivo).toBe('nivel');
    expect(elegibilidade({ ...OK, sessoesResistidas: 0, ligado: false }).motivo).toBe('sem_historico');
  });

  it('entrada absurda cai para o lado seguro', () => {
    expect(elegibilidade({ ...OK, sessoesResistidas: Number.NaN }).elegivel).toBe(false);
    expect(elegibilidade({ ...OK, sessoesResistidas: -3 }).elegivel).toBe(false);
  });
});

describe('④ exercício compatível — só isolado ou máquina', () => {
  const porId = (id: string) => EXERCISES.find((e) => e.id === id)!;

  it('isolado com carga entra', () => {
    const iso = EXERCISES.find((e) => e.padraoMovimento === 'isolado' && e.tipo === 'forca_hipertrofia')!;
    expect(aceitaTecnica(iso), iso.nomePt).toBe(true);
  });

  it('🔴 NENHUM composto livre com carga entra', () => {
    const COMPOSTOS = ['empurrar', 'puxar', 'agachar', 'dobradica_quadril'];
    const vazados = EXERCISES.filter((e) =>
      COMPOSTOS.includes(e.padraoMovimento)
      && !/Máquina|Polia/i.test(e.equipamentoDetalhe ?? '')
      && aceitaTecnica(e));
    expect(vazados.map((e) => e.nomePt), 'composto livre aceitando técnica').toEqual([]);
    // Anti-vacuidade: a população precisa existir, senão o teste não olha nada.
    const livres = EXERCISES.filter((e) => COMPOSTOS.includes(e.padraoMovimento)
      && !/Máquina|Polia/i.test(e.equipamentoDetalhe ?? ''));
    expect(livres.length, 'não há composto livre no catálogo?').toBeGreaterThan(30);
  });

  it('composto GUIADO (máquina/polia) entra — é a trajetória que protege', () => {
    const guiados = EXERCISES.filter((e) =>
      e.padraoMovimento !== 'isolado' && e.tipo === 'forca_hipertrofia'
      && /Máquina|Polia/i.test(e.equipamentoDetalhe ?? ''));
    expect(guiados.length, 'sem guiados, o ramo é inalcançável').toBeGreaterThan(0);
    for (const g of guiados) expect(aceitaTecnica(g), g.nomePt).toBe(true);
  });

  it('cardio, pliométrico e mobilidade ficam fora', () => {
    for (const e of EXERCISES.filter((x) => x.tipo !== 'forca_hipertrofia')) {
      expect(aceitaTecnica(e), `${e.nomePt} (${e.tipo})`).toBe(false);
    }
  });

  it('peso corporal isolado entra (a técnica existe sem carga)', () => {
    const pc = EXERCISES.find((e) => e.padraoMovimento === 'isolado'
      && e.equipamentoDetalhe === 'Peso corporal' && e.tipo === 'forca_hipertrofia');
    if (pc) expect(aceitaTecnica(pc), pc.nomePt).toBe(true);
    expect(porId(EXERCISES[0]!.id)).toBeTruthy(); // sanidade do helper
  });
});

describe('⑤ dose pequena — 1 técnica por sessão, na última série', () => {
  it('duas escolhas viram UMA, sem virar erro', () => {
    const escolhas = [
      { exercicioId: 'e1', tecnica: 'drop_set' as const },
      { exercicioId: 'e2', tecnica: 'cluster' as const },
    ];
    expect(tecnicaDaSessao(escolhas)).toEqual({ exercicioId: 'e1', tecnica: 'drop_set' });
    expect(tecnicaDaSessao([])).toBeNull();
  });

  it('a série é sempre a ÚLTIMA', () => {
    expect(serieDaTecnica(3)).toBe(3);
    expect(serieDaTecnica(1)).toBe(1);
    expect(serieDaTecnica(0)).toBeNull();
    expect(serieDaTecnica(Number.NaN)).toBeNull();
  });
});

describe('⑦ explicação de execução E interrupção — para as quatro', () => {
  it('a lista é FECHADA nas quatro que a fonte nomeia', () => {
    expect([...TECNICAS].sort()).toEqual(['cluster', 'drop_set', 'myo_reps', 'rest_pause']);
  });

  it('cada técnica tem rótulo, como executar e como INTERROMPER', () => {
    for (const t of TECNICAS) {
      const d = DESCRICAO_TECNICA[t];
      expect(d.rotulo.length, t).toBeGreaterThan(3);
      expect(d.comoExecutar.length, t).toBeGreaterThan(40);
      // 🔒 O critério 7 pede as DUAS coisas. Só "como fazer" seria meia explicação.
      expect(d.comoInterromper, t).toMatch(/\b(Pare|Encerre)\b/);
    }
  });
});

/* ══════════════ ⑩ o motor NUNCA adiciona sozinho + a copy de honestidade ══════════════ */

const SRC = join(process.cwd(), 'src');
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}
const podar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
const FONTES = arquivos(SRC).map((f) => [relative(process.cwd(), f).replace(/\\/g, '/'), podar(readFileSync(f, 'utf8'))] as const);

describe('🔴 ⑩ o motor NUNCA adiciona técnica sozinho', () => {
  it('nenhum arquivo do MOTOR importa o módulo, exceto ele mesmo', () => {
    const importam = FONTES
      .filter(([f, src]) => f.startsWith('src/lib/engine/')
        && f !== 'src/lib/engine/tecnicas-avancadas.ts'
        && /tecnicas-avancadas/.test(src))
      .map(([f]) => f);
    // 🔒 Se o montador, a prescrição ou a progressão importarem isto, a técnica passou a
    // poder entrar por geração — que é exatamente o que o §10.1 proíbe, literal.
    expect(importam, 'o motor passou a poder adicionar técnica sozinho').toEqual([]);
  });

  it('o índice do motor não reexporta o módulo (não vira dependência por acidente)', () => {
    const idx = FONTES.find(([f]) => f === 'src/lib/engine/index.ts')![1];
    expect(idx).not.toMatch(/tecnicas-avancadas/);
  });

  it('anti-vacuidade: o extrator ACHA importações quando elas existem', () => {
    const comImport = FONTES.filter(([f, src]) => f.startsWith('src/lib/engine/') && /from '\.\//.test(src));
    expect(comImport.length, 'o varredor não lê nada').toBeGreaterThan(5);
  });
});

describe('🔒 a copy nunca apresenta as técnicas como MELHORES', () => {
  /**
   * Consequência de honestidade travada junto com a reabertura: o benefício **não é
   * superior** (meta-análise 2026), então vender como upgrade seria mentir. São opção de
   * ESTILO. O léxico é fechado e vive aqui.
   */
  const PROIBIDO = [
    /treino avançado/i, /n[íi]vel pro\b/i, /resultado acelerado/i,
    /mais eficaz/i, /mais eficiente/i, /potencializ/i, /maximiz/i,
    /leve seu treino a outro n[íi]vel/i, /destrave/i,
  ];

  it('o léxico pega o que tem de pegar (senão o guard é decorativo)', () => {
    for (const frase of [
      'Treino avançado', 'Nível pro', 'Resultado acelerado',
      'A técnica é mais eficaz que a série reta', 'Potencialize seus ganhos',
      'Maximize a hipertrofia', 'Leve seu treino a outro nível',
    ]) {
      expect(PROIBIDO.some((re) => re.test(frase)), frase).toBe(true);
    }
  });

  it('e NÃO pega o que deve ficar', () => {
    for (const frase of [
      'Drop set', 'Uma opção de estilo, não um upgrade.',
      'Ao terminar a última série, reduza a carga e continue sem descanso, na mesma forma.',
      'Pare assim que a execução perder a forma.',
      'Fica disponível quando o app já tiver seu histórico de treinos.',
    ]) {
      expect(PROIBIDO.some((re) => re.test(frase)), frase).toBe(false);
    }
  });

  it('nenhuma descrição do catálogo usa o léxico proibido', () => {
    for (const t of TECNICAS) {
      const d = DESCRICAO_TECNICA[t];
      for (const re of PROIBIDO) {
        expect(re.test(`${d.rotulo} ${d.comoExecutar} ${d.comoInterromper}`), `${t} :: ${re}`).toBe(false);
      }
    }
  });

  /**
   * 🔴 O VÃO QUE ESTE BLOCO FECHA (2026-08-05): o guard varria só o CATÁLOGO. A copy que a
   * pessoa lê está nas TELAS — e ali nada impedia um "leve seu treino a outro nível".
   * Descrição honesta com tela vendendo superioridade é a promessa de volta por outra porta,
   * exatamente como a página de garantia e o "trazer de volta".
   *
   * 🔑 A varredura é DERIVADA, não uma lista de arquivos: toda tela que IMPORTA o módulo das
   * técnicas entra. Tela nova que use a feature nasce coberta.
   */
  it('🔴 nenhuma TELA que usa técnicas vende superioridade', () => {
    const raiz = join(process.cwd(), 'src');
    const arquivos: string[] = [];
    (function varrer(dir: string) {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) varrer(caminho);
        else if (/\.tsx$/.test(nome)) arquivos.push(caminho);
      }
    })(raiz);
    const telas = arquivos.filter((f) => /tecnicas-avancadas/.test(readFileSync(f, 'utf8')));
    expect(telas.length, 'nenhuma tela importa o módulo — a varredura está vazia').toBeGreaterThanOrEqual(2);
    for (const tela of telas) {
      const src = readFileSync(tela, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
      for (const re of PROIBIDO) {
        expect(re.test(src), `${relative(process.cwd(), tela).replace(/\\/g, '/')} :: ${re}`).toBe(false);
      }
    }
  });

  it('🔑 e a tela DIZ que é estilo, não upgrade — a afirmação positiva, não só a ausência', () => {
    const sessao = readFileSync(join(process.cwd(), 'src/components/painel/SessaoTreino.tsx'), 'utf8');
    const perfil = readFileSync(join(process.cwd(), 'src/components/painel/EditarPerfil.tsx'), 'utf8');
    expect(`${sessao} ${perfil}`, 'nenhuma tela enquadra a técnica como opção de estilo')
      .toMatch(/estilo, n[ãa]o um upgrade|op[çc][ãa]o de estilo/i);
  });
});

describe('🔴 a entrada na tela EXISTE, e a linha do não-elegível não tem contador', () => {
  const EDITAR = 'src/components/painel/EditarPerfil.tsx';
  const src = () => FONTES.find(([f]) => f === EDITAR)![1];

  /** O bloco do toggle, recortado — `toMatch` no arquivo inteiro não prova onde está. */
  function blocoTecnicas(): string {
    const s = src();
    const i = s.indexOf('Técnicas avançadas');
    expect(i, 'a entrada sumiu do Editar perfil').toBeGreaterThanOrEqual(0);
    return s.slice(Math.max(0, i - 400), i + 1400);
  }

  it('a entrada é VISÍVEL mesmo para quem ainda não é elegível', () => {
    const b = blocoTecnicas();
    // 🔒 A spec é explícita: a entrada existe e é visível. Se o bloco inteiro ficasse atrás
    // de `tecnicasLiberadas &&`, a feature seria invisível justamente para quem a pediu.
    expect(b).toMatch(/!tecnicasLiberadas && \(/);
    expect(b, 'a entrada foi escondida atrás da elegibilidade').not.toMatch(/\{tecnicasLiberadas && \(\s*<div/);
  });

  it('🔴 a linha estática NÃO tem contador, denominador nem contagem regressiva', () => {
    const b = blocoTecnicas();
    expect(b).toMatch(/Fica disponível quando o app já tiver seu histórico de treinos/);
    // "faltam N sessões" é alvo no futuro da atividade da pessoa — classes ① e ③.
    expect(b, 'contador').not.toMatch(/faltam?\s|\bfalta\b|restam?\s/i);
    expect(b, 'denominador').not.toMatch(/\{sessoesResistidas\}|de \{|\/\s*\{?MIN_SESSOES/);
    expect(b, 'contagem regressiva').not.toMatch(/\bem \d+ (dias?|semanas?|sess)/i);
    // E nada de futuro da atividade dela.
    expect(b, 'fala no futuro da pessoa').not.toMatch(/você (vai|ir[áa]|ter[áa]|conseguir[áa])/i);
  });

  it('o toggle nasce DESLIGADO e não liga sozinho quando não é elegível', () => {
    const s = src();
    expect(s).toMatch(/useState\(inicial\.tecnicasAvancadas \?\? false\)/);
    // 🔒 Mesmo com o flag gravado `true`, sair da elegibilidade tem de zerar na gravação —
    // senão perder o histórico deixaria a feature ligada em silêncio.
    expect(s).toMatch(/tecnicasAvancadas: tecnicasLiberadas \? tecnicas : false/);
  });

  it('a tela NÃO decide elegibilidade por conta própria — o portão é do motor', () => {
    const s = src();
    expect(s).toMatch(/import \{ elegibilidade \} from '@\/lib\/engine\/tecnicas-avancadas'/);
    // Nenhuma comparação de sessões na tela: se houvesse, seriam duas respostas para
    // "quem pode", e é exatamente a classe de defeito que este lote inteiro fechou.
    expect(s, 'a tela recontou o histórico').not.toMatch(/sessoesResistidas\s*[<>]=?\s*\d/);
  });

  it('a copy da entrada não vende upgrade', () => {
    const b = blocoTecnicas();
    for (const re of [
      /treino avançado/i, /n[íi]vel pro\b/i, /resultado acelerado/i,
      /mais efic/i, /potencializ/i, /maximiz/i,
    ]) expect(re.test(b), String(re)).toBe(false);
    // E diz, em voz alta, as duas coisas que a spec exige que sejam ditas.
    expect(b).toMatch(/opção de estilo, não um upgrade/i);
    expect(b).toMatch(/o app nunca adiciona sozinho/i);
  });
});

/* ══════════ A SUPERFÍCIE DE USO — sem ela o toggle é SUCESSO SIMULADO (5ª classe) ══════════ */

describe('🔴 o toggle tem superfície: escolher, ler e responder', () => {
  const SESSAO = 'src/components/painel/SessaoTreino.tsx';
  const PAINEL = 'src/components/painel/Painel.tsx';
  const src = (f: string) => FONTES.find(([n]) => n === f)![1];

  /** O bloco do seletor, recortado — `toMatch` no arquivo não prova ONDE está. */
  /**
   * ⚠️ Âncoras PRECISAS, não janela por tamanho. A primeira escrita usava `i ± N chars` e
   * vazava para o cartão "Senti dor" — o guard passou a acusar CSS do vizinho como dose.
   * Início = a condição do próprio bloco; fim = `setDorOpen`, o 1º símbolo do bloco seguinte
   * (âncora de CÓDIGO, porque o comentário `senti dor` é podado antes).
   */
  function blocoSeletor(): string {
    const s = src(SESSAO);
    const ini = s.indexOf('tecnicasLiberadas && ex.aceitaTec');
    expect(ini, '🔴 o seletor não existe: o toggle ligaria e nada mudaria').toBeGreaterThanOrEqual(0);
    const fim = s.indexOf('setDorOpen(true)', ini);
    expect(fim, 'âncora de fim sumiu — o recorte pegaria a tela inteira').toBeGreaterThan(ini);
    return s.slice(ini, fim);
  }

  it('① o SELETOR existe e é gateado pelo portão E pelo exercício', () => {
    const b = blocoSeletor();
    expect(b).toMatch(/tecnicasLiberadas && ex\.aceitaTec/);
    // As quatro técnicas, vindas da lista fechada do motor — não de um array na tela.
    expect(b).toMatch(/TECNICAS\.map/);
  });

  it('① … e NADA vem pré-selecionado (o motor nunca adiciona sozinho)', () => {
    const s = src(SESSAO);
    expect(s).toMatch(/useState<\{ exercicioId: string; tecnica: TecnicaAvancada \} \| null>\(null\)/);
    // 🔴 Um default diferente de `null` seria o motor escolhendo pela pessoa.
    expect(s, 'a técnica nasce escolhida').not.toMatch(/useState<[^>]*TecnicaAvancada[^>]*>\((?!null)/);
  });

  it('② o TEXTO de execução E interrupção é renderizado — as duas partes', () => {
    const b = blocoSeletor();
    expect(b).toMatch(/DESCRICAO_TECNICA\[tecnicaAqui\.tecnica\]\.comoExecutar/);
    // 🔒 Sem a interrupção o critério 7 fica pela metade — e é a metade que protege.
    expect(b).toMatch(/DESCRICAO_TECNICA\[tecnicaAqui\.tecnica\]\.comoInterromper/);
    expect(b).toMatch(/Quando parar/);
  });

  it('③ a série é a ÚLTIMA, e vem do motor (a tela não recalcula)', () => {
    const b = blocoSeletor();
    expect(b).toMatch(/serieDaTecnica\(ex\.nSetsEx\)/);
    expect(b, 'a tela inventou a série').not.toMatch(/Na série 1 de|serie: 1/);
  });

  it('④ FEEDBACK OBRIGATÓRIO: o avanço fica preso, e o motivo é dito', () => {
    const s = src(SESSAO);
    expect(s).toMatch(/const exigeFeedback = tecnicaAqui != null;/);
    expect(s).toMatch(/const feedbackPendente = exigeFeedback && est\.fb == null;/);
    // 🔒 As DUAS travas: o botão desabilitado E o `return` na função. Só desabilitar
    // deixaria o caminho aberto para quem chamasse `avancar()` por outro lugar.
    expect(s).toMatch(/disabled=\{feedbackPendente\}/);
    expect(s).toMatch(/function avancar\(\) \{\s*if \(feedbackPendente\) return;/);
    // Botão apagado sem explicação é a tela deixando a pessoa adivinhar.
    expect(s).toMatch(/Marque como foi este exercício para seguir/);
  });

  it('⑤ DOSE PEQUENA por construção: o estado é UM, não uma lista', () => {
    const s = src(SESSAO);
    // 🔴 Se virasse array, "1 por sessão" passaria a depender de alguém lembrar de checar.
    expect(s, 'a técnica virou lista — a dose deixou de ser estrutural').not.toMatch(/setTecnica\(\[|tecnicas: TecnicaAvancada\[\]/);
    // ⚠️ O motivo mora num JSDoc, e `podar` corta comentário — a checagem lê o arquivo CRU.
    // (O guard falhou aqui na primeira escrita: procurava no fonte já podado.)
    const cru = readFileSync(SESSAO, 'utf8');
    expect(cru.replace(/\s*\n\s*\*\s*/g, ' ')).toMatch(/escolher no segundo exercício substitui/i);
  });

  it('⑥ a sessão NÃO decide elegibilidade — recebe pronto do Painel', () => {
    const s = src(SESSAO);
    expect(s, 'a sessão recalculou o portão').not.toMatch(/elegibilidade\(/);
    expect(s).toMatch(/tecnicasLiberadas\?: boolean;/);
    const p = src(PAINEL);
    expect(p).toMatch(/tecnicasLiberadas=\{tecnicasLiberadas\}/);
    // 🔒 O portão é resolvido UMA vez no Painel e distribuído — duas resoluções seriam
    // duas respostas para "quem pode", e uma delas envelheceria em silêncio.
    expect(p.match(/elegibilidade\(\{/g) ?? [], 'o portão foi resolvido mais de uma vez').toHaveLength(1);
    // E o opt-in da pessoa entra na conjunção: o portão sozinho não liga a feature.
    expect(p).toMatch(/portaoTecnicas && \(perfil\.tecnicasAvancadas \?\? false\)/);
  });

  it('⑦ a técnica escolhida chega ao HISTÓRICO — senão a sessão esquece o que houve', () => {
    const s = src(SESSAO);
    expect(s).toMatch(/tecnica: \{ \.\.\.tecnica, serie: serieTec \}/);
    // 🔒 Técnica órfã (exercício que saiu da sessão) NÃO entra: seria registrar algo que
    // não aconteceu — a 5ª classe outra vez, agora no dado em vez da tela.
    expect(s).toMatch(/const idxTec = tecnica \? exs\.findIndex/);
    expect(s).toMatch(/tecnica && serieTec != null \?/);
  });

  it('⑧ a superfície NÃO prescreve DOSE (o cofre não prescreve — DF 2026-07-31)', () => {
    // ⚠️ A checagem é sobre o que a pessoa LÊ, não sobre o fonte: `style={{...}}` está cheio
    // de `12px`/`.85rem` e faria o guard acusar CSS como dose. (Foi o que aconteceu na
    // primeira escrita — o guard cobrava a coisa certa no lugar errado.)
    const visivel = blocoSeletor().replace(/style=\{\{[\s\S]*?\}\}/g, ' ');
    // 🔴 "reduza 20%", "3 pausas de 15 s": descrever a técnica é orientação geral;
    // prescrever a dose dela encosta em prescrição.
    expect(visivel, 'apareceu percentual de dose').not.toMatch(/\d+\s*%/);
    expect(visivel, 'apareceu duração de dose').not.toMatch(/\d+\s*(s|seg|segundos)\b/);
    expect(visivel, 'apareceu contagem de dose').not.toMatch(/\d+\s*(reps?|repetições|pausas|blocos|mini-séries)/i);
    // Anti-vacuidade: a poda não pode ter comido o bloco inteiro.
    expect(visivel).toMatch(/Quando parar/);
  });

  it('anti-vacuidade: o recorte do bloco realmente contém o seletor', () => {
    const b = blocoSeletor();
    expect(b.length).toBeGreaterThan(800);
    expect(b).toMatch(/Drop set|DESCRICAO_TECNICA\[t\]\.rotulo/);
  });
});
