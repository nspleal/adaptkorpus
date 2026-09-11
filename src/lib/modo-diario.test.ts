import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blocoNaoModoDiario, condicoesQueEnvolvem } from './guards-modo-diario';
import {
  DISPONIBILIDADE, FALA_NO_FUTURO, SUBSTANTIVOS_DE_PRESCRICAO, afirmaDenominador, disponibilidade, emModoDiario, falaNoFuturo, pressupoePrescricao,
  recursoLiberado, RECURSOS_AUSENTES, RECURSOS_DISPONIVEIS, RECURSOS_SEM_ALVO, type Recurso,
} from './modo-diario';
import { gerarDieta, gerarTreino } from './engine';
import { metaCardioSemanal } from './engine/cardio';
import { EXERCISES_SEED, FOODS_BY_ID_SEED, RECIPES_SEED } from './data/seed';
import type { PerfilUsuario } from './engine/types';
import type { PerfilTreino } from './engine/treino-types';

/**
 * MODO DIÁRIO (cofre, DF 2026-07-27 — `gate-de-saude-evokorpus`).
 *
 * Os testes de aceite que o autor pediu para a Leva 2.1 · Bloco A:
 *  - FALHA se um usuário em `ROTEAR` receber plano, cardápio ou meta de cardio;
 *  - FALHA se o app perguntar qualquer coisa sobre a condição de saúde;
 *  - FALHA se a porta continuar fechada (o defeito vivo: `ROTEAR` não criava sessão e o
 *    `/app` chutava de volta para o onboarding).
 */

/** Perfil que o gate ROTEIA por condição declarada (gestação — trava do gate de saúde). */
const PERFIL_ROTEADO: PerfilUsuario = {
  sexo: 'feminino', pesoKg: 62, alturaCm: 165, idade: 30,
  nivelAtividade: 'moderado', objetivo: 'emagrecimento',
  flagsSaude: { gestacaoAmamentacao: true, renal: false, cardiaca: false, lesao: false, diabetes: false },
};
/** Mesmo perfil sem a condição — a testemunha de que o corte é do gate, não do teste. */
const PERFIL_NORMAL: PerfilUsuario = {
  ...PERFIL_ROTEADO,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
};

const semComentarios = (caminho: string): string =>
  readFileSync(caminho, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('modo diário — a classificação dos recursos', () => {
  it('modo diário é exatamente o gate ROTEAR', () => {
    expect(emModoDiario('ROTEAR')).toBe(true);
    for (const g of ['PERMITIR', 'PISAR', 'RESTRINGIR'] as const) expect(emModoDiario(g)).toBe(false);
  });

  it('os TRÊS estados particionam o universo — nenhum recurso sem classe, nenhum em duas', () => {
    const todos = [...RECURSOS_DISPONIVEIS, ...RECURSOS_AUSENTES];
    expect(new Set(todos).size).toBe(todos.length);
    expect(new Set(todos)).toEqual(new Set(Object.keys(DISPONIBILIDADE)));
    // `sem_alvo` é subconjunto dos que APARECEM (some a camada de alvo, não a tela).
    for (const r of RECURSOS_SEM_ALVO) expect(RECURSOS_DISPONIVEIS).toContain(r);
  });

  it('a classificação inicial ratificada pelo autor (DF 2026-07-29)', () => {
    expect([...RECURSOS_SEM_ALVO].sort()).toEqual(['chama', 'frequencia_grupos', 'registro_cardio']);
    expect(Object.keys(DISPONIBILIDADE).filter((r) => DISPONIBILIDADE[r as Recurso] === 'completo').sort())
      .toEqual(['historico', 'registro_peso', 'registro_refeicao', 'registro_treino_manual']);
  });

  it('`sem_alvo` continua liberado — o que some é o alvo, não a tela', () => {
    for (const r of RECURSOS_SEM_ALVO) {
      expect(disponibilidade(r, true)).toBe('sem_alvo');
      expect(recursoLiberado(r, true), r).toBe(true);
      // Fora do modo diário nada é podado.
      expect(disponibilidade(r, false)).toBe('completo');
    }
  });

  it('DISPONÍVEL em modo diário — a lista verbatim da DF', () => {
    // "registro manual de treino · registro de refeição · registro de cardio · registro de
    //  peso · Chama · histórico · a visão de frequência por grupo"
    for (const r of ['registro_treino_manual', 'registro_refeicao', 'registro_cardio',
      'registro_peso', 'chama', 'historico', 'frequencia_grupos'] as const) {
      expect(recursoLiberado(r, true), r).toBe(true);
    }
  });

  it('AUSENTE em modo diário — a lista verbatim da DF', () => {
    // "plano de treino gerado · sessão guiada · cardápio · 'o dia da dieta' com prescrição ·
    //  meta de cardio · progressão/mesociclo/rampa"
    for (const r of ['plano_treino', 'sessao_guiada', 'cardapio', 'dia_da_dieta',
      'meta_cardio', 'progressao'] as const) {
      expect(recursoLiberado(r, true), r).toBe(false);
    }
  });

  it('fora do modo diário nada é escondido', () => {
    for (const r of [...RECURSOS_DISPONIVEIS, ...RECURSOS_AUSENTES]) {
      expect(recursoLiberado(r, false), r).toBe(true);
    }
  });
});

describe('ROTEAR não recebe prescrição (motor)', () => {
  it('nem plano de dieta, nem cardápio', () => {
    const d = gerarDieta(PERFIL_ROTEADO, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED });
    expect(d.gate.comportamento).toBe('ROTEAR');
    expect(d.plano).toBeNull();
    expect(d.cardapio).toBeNull();
    // Testemunha: sem a condição, o mesmo perfil recebe as duas coisas.
    const ok = gerarDieta(PERFIL_NORMAL, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED });
    expect(ok.plano).not.toBeNull();
    expect(ok.cardapio).not.toBeNull();
  });

  it('nem prescrição, nem rotina de treino', () => {
    const extra = {
      nivelExperiencia: 'iniciante', equipamento: 'academia',
      diasDisponiveis: 3, tempoPorSessaoMin: 60,
    } as const;
    const roteado: PerfilTreino = { ...PERFIL_ROTEADO, ...extra };
    const t = gerarTreino(roteado);
    expect(t.gate.comportamento).toBe('ROTEAR');
    expect(t.prescricao).toBeNull();
    expect(t.rotina).toBeNull();
    // Testemunha: sem a condição, o mesmo perfil recebe prescrição e rotina.
    const ok = gerarTreino({ ...PERFIL_NORMAL, ...extra }, { exercises: EXERCISES_SEED });
    expect(ok.prescricao).not.toBeNull();
    expect(ok.rotina).not.toBeNull();
  });

  it('nem meta de cardio — em NENHUM objetivo', () => {
    for (const objetivo of ['emagrecimento', 'massa', 'saude'] as const) {
      expect(metaCardioSemanal(objetivo, true), objetivo).toBeNull();
      expect(metaCardioSemanal(objetivo, false), objetivo).not.toBeNull();
    }
  });
});

describe('a porta do modo diário está aberta (o defeito vivo da Leva 2)', () => {
  it('o onboarding CRIA sessão no ROTEAR — o `salvarSessao` não fica dentro do `else`', () => {
    const src = semComentarios('src/app/onboarding/page.tsx');
    // O ramo do gate agora só escolhe a TELA; a sessão é salva antes, para todos.
    // A correção conserva também a entrada do plano; o salvamento continua
    // incondicional em relação ao ramo ROTEAR.
    expect(src).toMatch(/salvarSessao\(resumo, entradaCorrigida\);[\s\S]{0,400}comportamento === 'ROTEAR'/);
    // A regressão que este teste existe para pegar: voltar a condicionar a criação da conta.
    expect(src).not.toMatch(/ROTEAR'\)\s*\{\s*setFase\('resultado'\);\s*\}\s*else\s*\{[\s\S]{0,200}salvarSessao/);
  });

  it('o /app NÃO limpa a sessão de quem foi roteado', () => {
    const src = semComentarios('src/app/app/page.tsx');
    expect(src).toContain('emModoDiario');
    // A linha antiga — `gate.comportamento === 'ROTEAR' || !dieta.plano` no guard que
    // chama limparSessao() — mandava o roteado de volta ao onboarding para sempre.
    expect(src).not.toMatch(/comportamento === 'ROTEAR' \|\|/);
    expect(src).toMatch(/modoDiario=\{emModoDiario\(/);
  });
});

describe('o app não pergunta nada sobre a condição de saúde', () => {
  const TELAS = [
    'src/components/painel/ModoDiario.tsx',
    'src/components/painel/Painel.tsx',
    'src/components/painel/Cardio.tsx',
    'src/components/painel/FiqueiDoente.tsx',
  ];

  it('nenhuma pergunta sobre a condição nas telas do modo diário', () => {
    // Interrogativas sobre a condição em si. O gate pergunta UMA VEZ, no onboarding (PAR-Q,
    // sim/não, minimizado — LGPD); dentro do app a condição nunca é reaberta, graduada nem
    // reavaliada. 🔴 "REGISTRAR É INERTE, PRESCREVER SERIA ORIENTAÇÃO."
    // Uma PERGUNTA cujo objeto é a condição: substantivo de saúde + '?' na mesma frase.
    // "Como está o peso hoje?" (registro de peso) não casa — peso não é a condição.
    const perguntaSobreCondicao = /(condição|doença|diagn[óo]stico|sintoma|gravidez|gesta(ção|nte)|lesão|diabetes|renal|card[ií]aca)[^.!?]{0,80}\?/i;
    const perguntaDeEstado = /como (você )?(está|anda|se sente)[^.!?]{0,20}(de saúde|se sentindo)[^.!?]{0,30}\?/i;
    const termos = new RegExp(`${perguntaSobreCondicao.source}|${perguntaDeEstado.source}`, 'i');
    for (const f of TELAS) {
      const src = semComentarios(f);
      expect(termos.test(src), `${f} pergunta sobre a condição`).toBe(false);
    }
  });

  it('o modo diário não lê a condição — nem `flagsSaude`, nem os motivos do gate', () => {
    const src = semComentarios('src/components/painel/ModoDiario.tsx');
    // Se o componente nunca recebe a condição, ele não tem como adaptar nada "para ela"
    // (🔴 trava de escopo da DF: o app dá um passo atrás, não gradua nem sugere protocolo).
    expect(src).not.toContain('flagsSaude');
    expect(src).not.toContain('gate.motivos');
    expect(src).not.toContain('gestacao');
    expect(src).not.toMatch(/\brenal\b|\bcardiaca\b|\bdiabetes\b/);
  });

  it('o cartão permanente não é alarme: sem vermelho, sem cadeado, sem "desbloqueie"', () => {
    const src = semComentarios('src/components/painel/ModoDiario.tsx');
    expect(src).not.toContain('#E5484D');           // Alerta — banido nestas telas
    expect(src).not.toMatch(/desbloquei|bloquead|cadead/i);
    expect(src).not.toMatch(/você não pode|indisponível|premium/i);
  });
});

describe('o registro do modo diário é inerte', () => {
  it('a aba Dieta do diário não mostra caloria, macro nem cardápio', () => {
    const src = semComentarios('src/components/painel/ModoDiario.tsx');
    expect(src).not.toMatch(/kcal/i);
    expect(src).not.toMatch(/prote[ií]na|carboidrato|gordura/i);
    // "Segui o plano"/"Comi outra coisa" são afirmações SOBRE UM PLANO — não existem aqui.
    expect(src).not.toContain('Segui o plano');
    expect(src).not.toContain('Comi outra coisa');
  });
});

describe('🔒 EM MODO DIÁRIO, NADA FALA NO FUTURO DA ATIVIDADE DA PESSOA', () => {
  /**
   * A regra generalizável (DF 2026-07-29) que saiu de CINCO vazamentos numa leva só:
   * a copy da meta no cardio · a régua da frequência · os pips · a legenda "abaixo da
   * referência" · os "Próximos marcos" da Chama.
   *
   * Teste de uma linha: **a frase fala do FUTURO da atividade dela? Se sim, é alvo, e sai.**
   * Passa contagem do que ocorreu ("14 dias de chama", "hoje você registrou", "Variação").
   */

  it('o léxico pega os cinco vazamentos desta leva', () => {
    for (const frase of [
      'faltam 7 dias', 'falta 1 dia', 'Próximos marcos',
      'cada padrão ao menos 2× por semana', 'Abaixo da referência — não é erro',
      'distribuem os padrões ao longo do ciclo', 'não entra nos minutos da meta',
      'com 1 dia por semana, 1× por padrão é o esperado',
      'o que está em 1× hoje pode fechar em 2× ou mais',
      'Um registro rápido mantém seu plano calibrado.',
      // 12º padrão (DF 2026-07-29) — o cartão de meio de semana da frequência:
      '3 de 7 dias desta semana já passaram. A contagem abaixo ainda vai crescer.',
      'ainda vai crescer',
    ]) {
      expect(falaNoFuturo(frase), frase).toBe(true);
    }
  });

  it('e NÃO pega nada do que deve ficar', () => {
    for (const frase of [
      'Você já completou 14 dias de treino.', 'Hoje você registrou', '3 treinos',
      '25 min de cardio', 'Variação', '2 de 4 registradas', 'Peito, 2 vezes nesta semana',
      'Com registro no período', 'Sem registro no período',
      'É um espelho do que aconteceu, não uma nota.',
      'Um registro rápido guarda a sua variação.',
      'Um período sem registro não é um problema — é só um período sem registro.',
      'Constância, não perfeição.', 'Sua sequência começa hoje',
      'Treinos registrados à mão, com exercícios fora da biblioteca, contam na sua chama '
        + 'mas não têm grupo para somar aqui.',
    ]) {
      expect(falaNoFuturo(frase), frase).toBe(false);
    }
  });

  it('o léxico não está vazio nem virou catch-all', () => {
    expect(FALA_NO_FUTURO.length).toBeGreaterThanOrEqual(10);
    expect(falaNoFuturo('')).toBe(false);
    expect(falaNoFuturo('registro')).toBe(false);
  });

  /**
   * O guard que o terceiro estado existe para destravar: **TODO recurso `sem_alvo` precisa
   * de prova estática de que a camada de alvo some.** Foi a ausência dele que deixou os
   * cinco passarem. Um `sem_alvo` novo sem entrada aqui quebra a suíte.
   */
  const PROVAS: Record<string, { arquivo: string; provas: RegExp[] }> = {
    // A régua nem chega a ser calculada; o neutro substitui o esmaecimento; legenda e pips somem.
    frequencia_grupos: {
      arquivo: 'src/components/painel/FrequenciaGrupos.tsx',
      provas: [
        /if \(modoDiario\) return null;[\s\S]{0,120}reguaDoPadrao/,
        /const forte = semReferencia \|\| emDia;/,
        /const barra = semReferencia \?/,
        /\{!modoDiario && \(\s*<p style=\{\{ \.\.\.apoio/,
        /\{!semReferencia && \(/,
      ],
    },
    // Toda a meta vive sob `meta == null ? … : …`; a copy do leve não cita meta sem meta.
    registro_cardio: {
      arquivo: 'src/components/painel/Cardio.tsx',
      provas: [
        /\{meta == null \? \(/,
        /meta == null \? 'Movimento registrado — fica guardado no seu histórico\.'/,
      ],
    },
    // O bloco "Próximos marcos" inteiro fica atrás de `!modoDiario`.
    chama: {
      arquivo: 'src/components/painel/ChamaContador.tsx',
    // ⚠️ Âncora no SÍMBOLO que decide (`proximos`), não no título do bloco: o título
    // mudou de "Próximos marcos" para "Os marcos da chama" quando o "faltam N" saiu
    // (DF 2026-08-01), e ancorar em decoração faz o guard cair por edição de copy. A REGRA
    // não mudou — o bloco dos marcos à frente continua fora do modo diário.
      provas: [/estado="futuro"/],
    },
  };

  it('todo recurso `sem_alvo` tem guard estático declarado', () => {
    expect(Object.keys(PROVAS).sort()).toEqual([...RECURSOS_SEM_ALVO].sort());
  });

  for (const [recurso, { arquivo, provas }] of Object.entries(PROVAS)) {
    it(`\`${recurso}\` — a camada de alvo some, provado no fonte`, () => {
      const src = semComentarios(arquivo);
      for (const re of provas) expect(re.test(src), `${arquivo} :: ${re}`).toBe(true);
    });
  }

  it('o Painel passa o modo diário para as três telas podadas', () => {
    const src = semComentarios('src/components/painel/Painel.tsx');
    expect(src).toMatch(/<ContadorTreinos[^>]*modoDiario=\{modoDiario\}/);
    expect(src).toMatch(/modoDiario=\{modoDiario\}/);
    // O cardio recebe a poda pelo motor (meta null), não por prop — checado acima.
  });

  it('as telas EXCLUSIVAS do modo diário não falam no futuro (copy 100% nossa)', () => {
    // Onde controlamos toda a copy, a regra é absoluta — sem exceção guardada.
    const src = semComentarios('src/components/painel/ModoDiario.tsx');
    expect(falaNoFuturo(src), 'ModoDiario.tsx fala no futuro da atividade').toBe(false);
  });

  it('o subtítulo do registro de peso é UNIFICADO de propósito (DF 2026-07-29, revista)', () => {
    // 🔴 NÃO "conserte" isto de volta para uma ramificação. A frase "mantém seu plano
    // calibrado" PARECE verdadeira para quem tem plano e não é: `registrarPeso` não alimenta
    // `perfil.pesoKg`, e é o perfil que a TMB lê (health-gate.ts:66-70). Registrar peso não
    // recalibra nada — em NENHUM modo. Ver o JSDoc de `RegistrarPesoRow`.
    const src = semComentarios('src/components/painel/Painel.tsx');
    expect(src).toContain('Um registro rápido guarda a sua variação.');
    expect(src).not.toMatch(/mant[ée]m seu plano calibrado/);
    // E a prova de que não voltou a ramificar por outro caminho: nem a assinatura do
    // componente nem nenhuma TAG dele mencionam o modo. (Janela restrita à própria tag —
    // 200 chars alcançavam o `modoDiario` do `Progresso`, que é de outro cartão.)
    expect(src).not.toMatch(/function RegistrarPesoRow[^)]*modoDiario/);
    for (const tag of src.match(/<RegistrarPesoRow[^/]*\/>/g) ?? []) {
      expect(tag, tag).not.toMatch(/modoDiario/);
    }
  });

  it('o motivo da unificação está ESCRITO no código, não só no commit', () => {
    // A trava contra o "conserto" de daqui a um mês: quem for mexer tem de topar com o
    // caminho do código que torna a frase antiga falsa.
    const comComentarios = readFileSync('src/components/painel/Painel.tsx', 'utf8');
    const i = comComentarios.indexOf('function RegistrarPesoRow');
    const jsdoc = comComentarios.slice(Math.max(0, i - 2000), i);
    expect(jsdoc).toMatch(/UNIFICADO DE PROP[ÓO]SITO/i);
    // (1) NOMEIA a frase proibida — sem isto o motivo técnico fica solto e ninguém liga
    //     uma coisa à outra daqui a um mês;
    expect(jsdoc).toMatch(/Um registro rápido mantém seu plano calibrado/);
    // (2) diz POR QUE ela é falsa;
    expect(jsdoc).toMatch(/N[ÃA]O alimenta `perfil\.pesoKg`/);
    // (3) e ONDE conferir — os dois lados da cadeia.
    expect(jsdoc).toMatch(/health-gate\.ts:66-70/);
    expect(jsdoc).toMatch(/EditarPerfil/);
  });
});

describe('🔒 CLASSE 2 — nada pressupõe um plano que essa pessoa não tem', () => {
  /**
   * A segunda regra travada (DF 2026-07-29): **a frase pressupõe um plano ou prescrição que
   * essa pessoa não tem?** Nasceu de seis achados que a regra do futuro nunca pegaria —
   * eles falam no PRESENTE de algo que não existe.
   */

  it('o guard pega os seis vazamentos da classe 2', () => {
    for (const frase of [
      'Movimento registrado — não entra nos minutos da meta.',
      'Um registro rápido mantém seu plano calibrado.',
      'Como seu plano evolui',
      'A cada avanço seu, o treino e a dieta se recalculam pelas regras adaptativas.',
      'Elas ficam aqui como informação — não mudam o seu cardápio.',
      'Plano e preferências',
      'Modo força — Ativo — compostos a 6 reps',
      'Sem promessa de prazo',
    ]) {
      expect(pressupoePrescricao(frase), frase).toBe(true);
    }
  });

  it('e NÃO pega o que deve ficar', () => {
    for (const frase of [
      'Você já completou 14 dias de treino.', 'Hoje você registrou', 'Variação',
      '30 min de cardio', '2 de 4 registradas', 'Suas preferências',
      'Um período sem registro não é um problema — é só um período sem registro.',
      'É um espelho do que aconteceu, não uma nota.',
      'Um registro rápido guarda a sua variação.',
      'Constância, não perfeição.', 'Com registro no período', 'Aquecendo',
      'Treinos registrados à mão, com exercícios fora da biblioteca, contam na sua chama '
        + 'mas não têm grupo para somar aqui.',
      'Anote o que você treinou — exercícios, séries e cargas. Fica tudo no seu histórico.',
      'Peito, 2 vezes nesta semana',
    ]) {
      expect(pressupoePrescricao(frase), frase).toBe(false);
    }
  });

  it('o vocabulário é fechado e não virou catch-all', () => {
    expect(SUBSTANTIVOS_DE_PRESCRICAO.length).toBeGreaterThanOrEqual(9);
    expect(pressupoePrescricao('')).toBe(false);
    expect(pressupoePrescricao('registro')).toBe(false);
  });

  /**
   * ⚠️ EXCEÇÃO DECLARADA, com motivo. NEGAR a prescrição não é pressupô-la — e o modo
   * diário PRECISA negá-la em voz alta. Cada exceção mora aqui, nomeada; o que não estiver
   * nesta tabela e usar o vocabulário quebra a suíte.
   */
  const EXCECOES: { trecho: string; motivo: string }[] = [
    {
      trecho: 'o app não monta treino nem cardápio para você',
      motivo: 'cartão permanente de encaminhamento: a frase NEGA o plano — é a mensagem '
        + 'central do modo diário, não um pressuposto dele.',
    },
    {
      trecho: 'Seu plano vem de um profissional',
      motivo: 'título do mesmo cartão: atribui o plano a QUEM O FAZ (o profissional), '
        + 'justamente para dizer que não vem do app.',
    },
    {
      trecho: 'Sem meta semanal por aqui',
      motivo: 'título do cartão de cardio sem meta (Cardio.tsx): a frase NEGA a meta. É a '
        + 'forma que a DF 2026-07-27 pede — "registro SIM, meta NÃO" dito em voz alta, '
        + 'em vez de a seção sumir sem explicação.',
    },
  ];

  it('as exceções declaradas realmente usam o vocabulário (senão são exceção morta)', () => {
    for (const e of EXCECOES) {
      expect(pressupoePrescricao(e.trecho), `exceção sem vocabulário: ${e.trecho}`).toBe(true);
      expect(e.motivo.length).toBeGreaterThan(30);
    }
  });

  it('as telas EXCLUSIVAS do modo diário só usam o vocabulário nas exceções declaradas', () => {
    // ModoDiario.tsx é 100% copy nossa — aqui a regra é absoluta, menos o que está na tabela.
    let src = semComentarios('src/components/painel/ModoDiario.tsx');
    for (const e of EXCECOES) src = src.split(e.trecho).join('«EXCECAO»');
    // Sobrou vocabulário fora das exceções? (JSX quebra frases; checamos o fonte podado.)
    const sobrou = SUBSTANTIVOS_DE_PRESCRICAO.filter((re) => re.test(src)).map(String);
    expect(sobrou, `vocabulário de prescrição fora das exceções: ${sobrou.join(', ')}`).toEqual([]);
  });
});

describe('🔒 CLASSE 2 — prova estrutural de cada vazamento consertado', () => {
  /**
   * ⚠️ Esta tabela existe porque a MUTAÇÃO a exigiu. A regra absoluta só roda em
   * `ModoDiario.tsx`; os seis vazamentos da classe 2 vivem em arquivos COMPARTILHADOS
   * (`Painel.tsx`, `Cardio.tsx`, `chama.ts`), onde a copy é legítima com plano. Sem uma
   * prova por vazamento, remover qualquer guard passaria batido — foi o que a mutação
   * mostrou em 5 dos 7 na primeira tentativa.
   *
   * Cada entrada: onde estava, e a expressão que prova que agora está atrás do modo.
   */
  const CONSERTOS: { achado: string; arquivo: string; prova: RegExp }[] = [
    {
      achado: 'B · cartão "Como seu plano evolui" (motor adaptativo que ela não tem)',
      arquivo: 'src/components/painel/Painel.tsx',
      prova: /\{!modoDiario && \([\s\S]{0,900}Como seu plano evolui/,
    },
    {
      achado: 'C · "Modo força — Ativo — compostos a 6 reps" no Perfil',
      arquivo: 'src/components/painel/Painel.tsx',
      prova: /\{!modoDiario && perfil\.modoForca/,
    },
    {
      achado: 'C · o CONTROLE do modo força no Editar perfil (não só o rótulo)',
      arquivo: 'src/components/painel/EditarPerfil.tsx',
      prova: /experiencia !== 'iniciante' && !modoDiario && \(/,
    },
    {
      achado: 'D · título "Plano e preferências" do cartão do Perfil',
      arquivo: 'src/components/painel/Painel.tsx',
      prova: /modoDiario \? 'Suas preferências' : 'Plano e preferências'/,
    },
    {
      achado: 'D · "não mudam o seu cardápio" na tela de cardio',
      arquivo: 'src/components/painel/Cardio.tsx',
      prova: /\{meta != null && <p[^>]*>As calorias são estimativas/,
    },
    {
      achado: 'E · "· antes do 1º marco" na pílula da Chama',
      arquivo: 'src/lib/chama.ts',
      prova: /modoDiario \? 'Aquecendo' : 'Aquecendo · antes do 1º marco'/,
    },
    {
      achado: 'peso · subtítulo unificado (a frase antiga era falsa nos DOIS modos)',
      arquivo: 'src/components/painel/Painel.tsx',
      prova: /<div style=\{\{ fontSize: '\.85rem'[^}]*\}\}>Um registro rápido guarda a sua variação\.<\/div>/,
    },
  ];

  for (const { achado, arquivo, prova } of CONSERTOS) {
    it(`${achado}`, () => {
      expect(prova.test(semComentarios(arquivo)), `${arquivo} :: ${prova}`).toBe(true);
    });
  }

  it('o Painel passa `modoDiario` para as quatro telas que ramificam', () => {
    const src = semComentarios('src/components/painel/Painel.tsx');
    // `[^>]*` não serve: as props contêm `=>`. Janela não-gulosa até o modoDiario.
    for (const alvo of [/<Progresso[\s\S]{0,300}?modoDiario=\{modoDiario\}/, /<EditarPerfil[\s\S]{0,300}?modoDiario=\{modoDiario\}/]) {
      expect(alvo.test(src), String(alvo)).toBe(true);
    }
    // Perfil e ContadorTreinos recebem pelo mesmo atributo (assinaturas diferentes).
    expect((src.match(/modoDiario=\{modoDiario\}/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('o registro de peso NÃO ramifica — nenhum call site passa modo', () => {
    // 🔴 A regressão de 2026-07-29 (um dos três call sites sem a flag, e a Hoje dizendo
    // "mantém seu plano calibrado") deixou de ser possível: sem ramificação não há flag a
    // esquecer. Este teste guarda a AUSÊNCIA — se alguém reintroduzir a prop, cai aqui e no
    // teste do motivo escrito.
    const src = semComentarios('src/components/painel/Painel.tsx');
    const sites = src.match(/<RegistrarPesoRow[^/]*\/>/g) ?? [];
    expect(sites.length, 'call sites do registro de peso').toBeGreaterThanOrEqual(3);
    for (const site of sites) expect(site, site).not.toMatch(/modoDiario/);
  });
});

describe('🔒 REDE 3 — o DENOMINADOR (alvo sem verbo e sem substantivo)', () => {
  /**
   * A terceira forma. Nenhuma das duas redes anteriores a pegava: o léxico procura futuro,
   * o guard procura substantivo, o detector procura desenho. `1 de 4` é só um par de
   * números — e já afirma um total esperado.
   */

  it('pega o denominador em todas as formas que apareceram', () => {
    for (const frase of [
      '1 de 4 refeições', '1 de 4 registradas', '0 de 1 a 2 sessões',
      '3 de 7 dias', '2/4 registradas', '0 de 4',
    ]) {
      expect(afirmaDenominador(frase), frase).toBe(true);
    }
  });

  it('e NÃO pega datas, faixas de data nem contagem pura — a outra direção', () => {
    for (const frase of [
      // datas e intervalos: o falso-positivo óbvio
      '27/07 a 02/08', 'Semana de 27/07 a 02/08', '29 de julho',
      // o caso real do DOM: innerText junta linhas, e o `\s` atravessava o `\n`
      '27/07 a 02/08\nSemana de 27/07 a 02/08', '02/08\nSem meta semanal por aqui',
      'Quarta-feira, 29 de julho', '29/07/2026', '12/2026',
      // contagem pura (a forma correta, que este lote instituiu)
      '1 refeição registrada', '3 refeições registradas', '2 treinos',
      '30 min de cardio', 'Você já completou 14 dias de treino.',
      'Peito, 2 vezes nesta semana', '1×', '61.4 kg', '2 registros',
      'Sem registro no período', 'Nada ainda. O que você registrar hoje aparece aqui.',
    ]) {
      expect(afirmaDenominador(frase), frase).toBe(false);
    }
  });

  it('a tela exclusiva do modo diário não afirma denominador em lugar nenhum', () => {
    // ModoDiario.tsx é 100% copy nossa: regra absoluta, sem exceção declarada.
    //
    // ⚠️ A extração precisa incluir TEMPLATE LITERALS. A primeira versão deste teste olhava
    // só o texto JSX entre `>` e `<` e excluía `{}` — e o denominador morava exatamente
    // dentro de `${...}`. A mutação pegou: o guard não era load-bearing.
    const src = semComentarios('src/components/painel/ModoDiario.tsx');
    const literais = [
      ...(src.match(/`[^`]*`/g) ?? []),   // templates (onde o "1 de 4" estava)
      ...(src.match(/'[^']*'/g) ?? []),   // strings simples
      ...(src.match(/>[^<>{}]{4,}</g) ?? []), // texto JSX solto
    ]
      // `${expr}` vira um número: é o que ele será em tela, e é o que torna o par visível.
      .map((t) => t.replace(/\$\{[^}]*\}/g, '9'))
      .join(' | ');
    const culpados = literais.split(' | ').filter((t) => afirmaDenominador(t));
    expect(culpados, `denominador em: ${culpados.join(' ; ').slice(0, 300)}`).toEqual([]);
  });
});

describe('🔒 a LEGENDA da frequência é guarda-corpo, não decoração', () => {
  /**
   * A barra 0–4× FICA (decisão do autor), mas a medição mostrou que o trilho é **sulco
   * visível** (`rgba(234,229,219,.075)`, 7px, raio 4) — pelo critério literal, o pip em
   * forma contínua. **O que a salva é a legenda**: "Com registro no período / Sem registro
   * no período" converte o vazio em AUSÊNCIA DE REGISTRO, não em alvo não atingido.
   *
   * ⚠️ Logo a legenda não é decoração. Se uma limpeza de copy futura a remover, o F vira
   * vazamento em silêncio. Este teste existe para que isso não seja silencioso.
   */
  const src = semComentarios('src/components/painel/FrequenciaGrupos.tsx');

  it('a legenda de contagem pura existe, com as duas linhas', () => {
    expect(src).toContain("texto: 'Com registro no período'");
    expect(src).toContain("texto: 'Sem registro no período'");
  });

  it('ela é a variante de MODO DIÁRIO da legenda, não um texto solto', () => {
    // O par tem de estar no ramo `modoDiario` do seletor da legenda — se virar texto
    // incondicional, o ramo do plano perde as bandas e o teste do espelho cai junto.
    expect(src).toMatch(/\(modoDiario\s*\?[\s\S]{0,400}Com registro no período/);
  });

  it('as barras e a legenda vivem no MESMO bloco — uma não sobrevive sem a outra', () => {
    // `LinhaGrupo` (as barras) e a legenda "Como ler" estão ambas sob o painel do período.
    const iBarras = src.indexOf('<LinhaGrupo');
    const iLegenda = src.indexOf('Como ler');
    expect(iBarras).toBeGreaterThan(-1);
    expect(iLegenda).toBeGreaterThan(iBarras);
    // E a legenda não está atrás de `!modoDiario` (senão sumiria justo onde é guarda-corpo).
    const trecho = src.slice(iLegenda - 400, iLegenda);
    expect(trecho).not.toMatch(/\{!modoDiario && \($/);
  });
});

/**
 * 🔒 O PAREAMENTO condição↔bloco, provado por CASAMENTO DE CHAVES (2026-08-01).
 *
 * 🔻 A prova antiga era `/\{!modoDiario && \([\s\S]{0,400}…/` e quebrou quando um bloco novo
 * (os marcos ALCANÇADOS) entrou entre a condição e a âncora. Janela por tamanho quebra por
 * edição de vizinho — o defeito é do anchor, não do código.
 */
describe('🔒 os marcos À FRENTE ficam fora do modo diário — sem janela de caracteres', () => {
  const src = () => readFileSync('src/components/painel/ChamaContador.tsx', 'utf8');

  it('o bloco existe e contém a lista dos marcos à frente', () => {
    const bloco = blocoNaoModoDiario(src());
    expect(bloco, 'o guard `!modoDiario` sumiu do ChamaContador').not.toBe('');
    expect(bloco, 'os marcos à frente saíram de dentro do guard').toMatch(/proximos\.length === 0/);
    expect(bloco).toMatch(/proximos\.map/);
  });

  /**
   * 🔑 CRITÉRIO AVALIADO, não forma casada. A 1ª escrita provava "o `alcancados.map` não
   * está dentro do bloco `{!modoDiario && (`" — e uma mutação que escondia o passado por
   * OUTRA forma (`{!modoDiario && alcancados.length > 0 && (`) SOBREVIVEU, porque o literal
   * deixava de casar. Agora a prova pega TODA condição que envolve os alcançados e a
   * **executa** com `modoDiario = true`: se alguma delas apagar o passado de quem está em
   * modo diário, falha — qualquer que seja a forma escrita.
   */
  it('🔑 e os marcos ALCANÇADOS aparecem nos DOIS modos — passado é leitura', () => {
    const s = src();
    expect(s, 'os alcançados não são renderizados').toMatch(/alcancados\.map/);
    const gates = condicoesQueEnvolvem(s, 'alcancados.map');
    const alcancados = [{ dias: 15, cor: 'amber', nome: 'Âmbar' }];
    for (const g of gates) {
      expect(g.reconhecida, `forma de gate não reconhecida: ${g.cond}`).toBe(true);
      const vale = new Function('modoDiario', 'alcancados', 'proximos', `return !!(${g.cond});`);
      expect(vale(true, alcancados, []), `este gate esconde o passado em modo diário: ${g.cond}`).toBe(true);
    }
  });

  it('anti-vacuidade do critério: um gate que ESCONDE o passado é reprovado', () => {
    const impostor = 'const x = 1;\n{!modoDiario && (\n  <div>{alcancados.map((m) => m.dias)}</div>\n)}\n';
    const gates = condicoesQueEnvolvem(impostor, 'alcancados.map');
    expect(gates).toHaveLength(1);
    expect(new Function('modoDiario', `return !!(${gates[0]?.cond});`)(true)).toBe(false);
    // …e a forma que sobreviveu à 1ª escrita do guard é pega igual.
    const impostor2 = impostor.replace('!modoDiario &&', '!modoDiario && alcancados.length > 0 &&');
    const g2 = condicoesQueEnvolvem(impostor2, 'alcancados.map');
    expect(g2).toHaveLength(1);
    expect(new Function('modoDiario', 'alcancados', `return !!(${g2[0]?.cond});`)(true, [{ dias: 15 }])).toBe(false);
  });

  it('anti-vacuidade: o recorte devolve um bloco de verdade, não a string toda', () => {
    const bloco = blocoNaoModoDiario(src());
    expect(bloco.length).toBeGreaterThan(300);
    expect(bloco.length, 'o recorte pegou o arquivo inteiro').toBeLessThan(src().length);
    expect(blocoNaoModoDiario('const a = 1;'), 'sem o padrão, devolve vazio').toBe('');
  });
});
