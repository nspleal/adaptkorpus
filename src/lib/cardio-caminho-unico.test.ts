import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { modalidadeDoExercicio, MODALIDADE_POR_EXERCICIO } from './engine/cardio';
import { gerarTreino } from './engine';
import { EXERCISES } from './data/exercises';
import type { PerfilTreino } from './engine/treino-types';

/**
 * 🔒 REGISTRO DE CARDIO UNIFICADO (DF 2026-07-27, `parametros-motor-treino-adaptkorpus`
 * §Cardio). O catálogo tem 13 exercícios `tipo: cardio` e 14 com `padraoMovimento: cardio`
 * que o montador põe na rotina — quem fazia a esteira NA SESSÃO GUIADA e também registrava
 * em "Registrar cardio" somava nos dois.
 *
 * **Existe UM único caminho de registro, alcançado de dois lugares.** Contar duas vezes
 * deixa de ser algo evitado por regra e passa a ser IMPOSSÍVEL POR CONSTRUÇÃO — não há
 * segunda fonte para divergir.
 *
 * 🔴 Critério de aceite literal: "teste que falha se existir MAIS DE UM CAMINHO capaz de
 * somar minutos/kcal de cardio". É o que este arquivo trava.
 */

const RAIZ = process.cwd();
const SRC = join(RAIZ, 'src');

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}
const rel = (f: string) => relative(process.cwd(), f).replace(/\\/g, '/');
/** Só o CÓDIGO: comentários citam `tipo: 'cardio'` para documentar a regra, não para gravar. */
const semComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const FONTES = arquivos(SRC).map((f) => [rel(f), semComentarios(readFileSync(f, 'utf8'))] as const);

describe('🔒 um único caminho grava cardio', () => {
  /**
   * ⚠️ A ISENÇÃO É DERIVADA, NÃO UMA LISTA DE NOMES (endurecida em 2026-08-01).
   *
   * 🔴 O que obrigou a mudança: o padrão `tipo: 'cardio'` acusou DUAS vezes um discriminante
   * legítimo — `engine/dia-de-cardio.ts` (união cardio × recuperação) e depois `semana.ts`
   * (o `DiaTipo` da faixa da semana). Uma lista enumerada cresceria a cada peça nova, e a
   * tentação a cada vez seria acrescentar o reincidente à lista — que é como um guard morre.
   *
   * 🔒 A regra que o guard realmente defende é *"só um lugar CRIA entrada de histórico de
   * cardio"*. Um arquivo que **não consegue gravar** não pode criar uma: não importa o
   * histórico, não toca storage, não monta payload (`kcal`/`met`/`kcalLiquida`). Isso é
   * verificável, então vira o critério — e fica ESTRITAMENTE MAIS FORTE que a lista: um
   * arquivo novo que PODE gravar cai aqui mesmo que ninguém lembre de cadastrá-lo.
   */
  const podeGravar = (src: string): boolean =>
    /treino-historico/.test(src) || /localStorage|sessionStorage/.test(src)
    || /kcalLiquida|met:|kcal:/.test(src);

  it('só `treino-historico.ts` cria entrada com `tipo: cardio`', () => {
    const criam = FONTES
      .filter(([, src]) => /tipo:\s*'cardio'/.test(src))
      .filter(([, src]) => podeGravar(src))
      .map(([f]) => f);
    expect(criam, 'apareceu um segundo caminho capaz de gravar cardio').toEqual(['src/lib/treino-historico.ts']);
  });

  it('e os ISENTOS são mesmo incapazes de gravar — não é confiança, é verificação', () => {
    const isentos = FONTES
      .filter(([f, src]) => /tipo:\s*'cardio'/.test(src) && f !== 'src/lib/treino-historico.ts')
      .map(([f]) => f);
    // Anti-vacuidade: se não houver isento nenhum, o critério derivado não provou nada e
    // este teste passaria de graça. Hoje é o `DiaTipo` da semana (o módulo do dia perdeu a união
    // cardio × recuperação em 2026-09-24, com a regra do dia excedente).
    expect(isentos.length, 'nenhum isento — o critério ficou sem sujeito').toBeGreaterThanOrEqual(1);
    for (const f of isentos) {
      const src = FONTES.find(([n]) => n === f)![1];
      expect(podeGravar(src), `${f} usa o padrão E consegue gravar`).toBe(false);
    }
  });

  it('🔒 o critério DERIVADO pega um gravador novo que uma lista de nomes deixaria passar', () => {
    // Simula o arquivo que a lista esqueceria: usa o padrão E importa o histórico.
    const impostor = "import { registrarCardio } from './treino-historico'; const x = { tipo: 'cardio' };";
    expect(/tipo:\s*'cardio'/.test(impostor)).toBe(true);
    expect(podeGravar(impostor), 'o critério não enxerga um gravador').toBe(true);
    // …e um discriminante puro continua isento, sem precisar de cadastro.
    const inocente = "export type DiaTipo = 'treino' | 'cardio'; const d = { tipo: 'cardio' as const };";
    expect(podeGravar(inocente), 'o critério acusou um discriminante puro').toBe(false);
  });

  it('só `registrarCardioEm` monta o payload de cardio da sessão', () => {
    const hist = readFileSync(join(SRC, 'lib', 'treino-historico.ts'), 'utf8');
    // uma função de escrita, e uma só (o `registrarCardio` de hoje delega nela)
    expect(hist.match(/export function registrarCardio\w*/g)).toEqual(
      ['export function registrarCardioEm', 'export function registrarCardio'],
    );
    expect(hist).toMatch(/return registrarCardioEm\(payload, hojeISO\(agora\)/);
  });

  it('a UI só grava cardio pelo `registrarCardio` do adaptador', () => {
    // A CHAMADA, não o nome da prop (`onRegistrarCardio` é repasse, não escrita).
    const importam = FONTES.filter(([f, src]) => f.startsWith('src/components') && /(?<![A-Za-z])registrarCardio\(/.test(src));
    // O Painel importa e chama; a sessão guiada e a tela avulsa recebem por PROP.
    expect(importam.map(([f]) => f).sort()).toEqual(['src/components/painel/Painel.tsx']);
    const painel = importam[0]![1];
    expect(painel.match(/(?<![A-Za-z])registrarCardio\(/g)).toHaveLength(1);
  });

  it('a sessão guiada NÃO monta payload de cardio por conta própria', () => {
    const sessao = semComentarios(readFileSync(join(SRC, 'components', 'painel', 'SessaoTreino.tsx'), 'utf8'));
    expect(sessao).not.toMatch(/kcalLiquida|(?<![A-Za-z])registrarCardio\(|tipo:\s*'cardio'/);
    // ela só repassa o payload que a peça de registro produziu
    expect(sessao).toMatch(/onSalvar=\{async \(payload\) => \{[^}]*await onRegistrarCardio\(payload\)/);
    expect(sessao.indexOf('await onRegistrarCardio(payload)')).toBeLessThan(sessao.indexOf('setCardioAberto(null); avancar();'));
  });
});

describe('🔒 um único lugar calcula minutos e kcal', () => {
  it('`kcalLiquida` só é chamada pela peça de registro', () => {
    const chamam = FONTES.filter(([f, src]) => /kcalLiquida\(/.test(src) && f !== 'src/lib/engine/cardio.ts')
      .map(([f]) => f);
    expect(chamam).toEqual(['src/components/painel/Cardio.tsx']);
  });

  it('`minutosNaMeta` é a única conversão de minutos → meta, e vive no motor', () => {
    const definem = FONTES.filter(([, src]) => /export function minutosNaMeta/.test(src)).map(([f]) => f);
    expect(definem).toEqual(['src/lib/engine/cardio.ts']);
  });

  it('nenhuma tela soma minutos de cardio por fora do resumo do motor', () => {
    for (const [f, src] of FONTES) {
      if (f === 'src/lib/engine/cardio.ts') continue;
      expect(src, `${f} não pode somar minutos de cardio na mão`).not.toMatch(/minutos\s*\+=|\+=\s*r\.minutos/);
    }
  });

  it('o resumo da semana lê UM balde só: as entradas `tipo: cardio` do histórico', () => {
    const adaptador = readFileSync(join(SRC, 'lib', 'cardio-semana.ts'), 'utf8');
    expect(adaptador.match(/s\.tipo === 'cardio'/g)).toHaveLength(1);
  });
});

describe('pré-preenchimento do item da rotina', () => {
  it('mapeia só os pares inequívocos; o resto cai em `outro`', () => {
    expect(modalidadeDoExercicio('e24')).toBe('corrida');   // Corrida na esteira
    expect(modalidadeDoExercicio('e150')).toBe('corrida');  // Corrida no lugar
    expect(modalidadeDoExercicio('e29')).toBe('bike');      // Bicicleta ergométrica
    expect(modalidadeDoExercicio('e92')).toBe('pular_corda');
    expect(modalidadeDoExercicio('e30')).toBe('outro');     // Burpee
    expect(modalidadeDoExercicio('inexistente')).toBe('outro');
  });

  it('🔴 "Caminhada do fazendeiro" NÃO vira caminhada — é carregamento com carga', () => {
    const carry = EXERCISES.find((e) => e.nomePt.startsWith('Caminhada do fazendeiro'))!;
    expect(modalidadeDoExercicio(carry.id)).toBe('outro');
  });

  it('todo id mapeado existe no catálogo e é mesmo um item de cardio da rotina', () => {
    for (const id of Object.keys(MODALIDADE_POR_EXERCICIO)) {
      const ex = EXERCISES.find((e) => e.id === id);
      expect(ex, `id ${id} não existe no catálogo`).toBeTruthy();
      expect(ex!.padraoMovimento, `${ex!.nomePt} não é slot de cardio`).toBe('cardio');
    }
  });

  it('o item da rotina é decidido pelo PADRÃO do slot, não pelo nome do exercício', () => {
    const sessao = readFileSync(join(SRC, 'components', 'painel', 'SessaoTreino.tsx'), 'utf8');
    expect(sessao).toMatch(/sl\.padrao === 'cardio' \? \{ modalidade: modalidadeDoExercicio\(sl\.exercicio\.id\) \}/);
  });

  it('🔒 pular o item não registra nada: o avanço não chama o registro', () => {
    const sessao = readFileSync(join(SRC, 'components', 'painel', 'SessaoTreino.tsx'), 'utf8');
    const avancar = sessao.slice(sessao.indexOf('function avancar()'), sessao.indexOf('function voltar()'));
    expect(avancar).not.toMatch(/onRegistrarCardio|setCardioAberto/);
  });
});


/**
 * ⚠️ ACHADO (2026-07-28) — a entrada da sessão guiada está PRONTA e DORMENTE.
 *
 * O montador nunca emite slot com `padrao: 'cardio'` dentro de uma sessão de força: o cardio
 * sai como item próprio (`rotina.diasCardio`), nos dias oferecidos para ele (DEC-007). Ou seja,
 * o "conta duas vezes" que a DF veio fechar **não é alcançável em produção** — o catálogo
 * tem os 14 exercícios, mas a alocação por padrão nunca os escolhe.
 *
 * O guard fica: se um dia o cardio virar slot da sessão de força, o caminho único já está no
 * lugar, e este teste avisa na hora em que a premissa mudar.
 */
describe('⚠️ hoje nenhuma rotina gerada tem item de cardio', () => {
  const perfil = (objetivo: 'saude' | 'emagrecimento' | 'massa', diasDisponiveis: number): PerfilTreino => ({
    sexo: 'masculino', idade: 30, alturaCm: 180, pesoKg: 80, objetivo,
    nivelAtividade: 'moderado', nivelExperiencia: 'intermediario', equipamento: 'academia',
    diasDisponiveis, tempoPorSessaoMin: 60,
    flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  } as PerfilTreino);

  it('nenhum slot de cardio em 12 combinações de objetivo × dias', () => {
    const comCardio: string[] = [];
    for (const objetivo of ['saude', 'emagrecimento', 'massa'] as const) {
      for (const dias of [3, 4, 5, 6]) {
        const r = gerarTreino(perfil(objetivo, dias), { exercises: EXERCISES });
        const slots = (r.rotina?.dias ?? []).flatMap((d) => d.slots);
        if (slots.some((s) => s.padrao === 'cardio')) comCardio.push(`${objetivo}/${dias}d`);
        // e nenhum exercício de cardio entra por outro padrão
        for (const s of slots) {
          const ex = EXERCISES.find((e) => e.id === s.exercicio.id)!;
          expect(ex.padraoMovimento, `${ex.nomePt} entrou num slot ${s.padrao}`).not.toBe('cardio');
        }
      }
    }
    // Quando isto passar a falhar, a entrada da sessão guiada acordou — é o esperado.
    expect(comCardio).toEqual([]);
  });
});
