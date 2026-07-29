import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  emModoDiario, recursoLiberado, RECURSOS_AUSENTES, RECURSOS_DISPONIVEIS, type Recurso,
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

  it('as duas listas do cofre não se sobrepõem e cobrem todo recurso classificado', () => {
    const cruz = RECURSOS_DISPONIVEIS.filter((r) => (RECURSOS_AUSENTES as readonly Recurso[]).includes(r));
    expect(cruz).toEqual([]);
    // Um recurso novo tem de ser classificado por alguém: se cair fora das duas listas,
    // `recursoLiberado` o esconderia em silêncio — este teste força a decisão.
    const todos = [...RECURSOS_DISPONIVEIS, ...RECURSOS_AUSENTES];
    expect(new Set(todos).size).toBe(todos.length);
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
