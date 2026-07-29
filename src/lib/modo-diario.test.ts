import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DISPONIBILIDADE, FALA_NO_FUTURO, disponibilidade, emModoDiario, falaNoFuturo,
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
    expect(src).toMatch(/salvarSessao\(resumo\);[\s\S]{0,400}comportamento === 'ROTEAR'/);
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
      provas: [/\{!modoDiario && \([\s\S]{0,400}Próximos marcos/],
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

  it('o subtítulo do registro de peso não pendura mais referência a plano', () => {
    const src = semComentarios('src/components/painel/Painel.tsx');
    expect(src).not.toMatch(/mant[ée]m seu plano calibrado/);
    expect(src).toContain('Um registro rápido guarda a sua variação.');
  });
});
