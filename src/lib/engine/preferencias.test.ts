import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avaliarBanimento, avaliarTroca, preferenciasEfetivas, PREFERENCIAS_TRILHO, PREFERENCIAS_VAZIAS } from './preferencias';
import { montarRotina } from './treino-montador';
import { prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { substituirExercicio } from './substituicao';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';

/**
 * 🎛️ v3 · BLOCO A — A PREFERÊNCIA É INPUT DO GERADOR (DF 2026-07-31).
 *
 * 🔴 O defeito que a forma evita, medido no Passo 0 da Leva G: a rotina **não é persistida**
 * e **cinco lugares** a sobrescrevem. Override de saída morreria no primeiro reload — e,
 * pior, congelaria a pessoa fora de todo conserto futuro do motor. Por isso a preferência
 * vive no PERFIL e entra pelo trilho dos favoritos, o único que já sobrevive ao recompute.
 */

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return {
    sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
    objetivo: 'massa', flagsSaude: SEM, nivelExperiencia: 'intermediario',
    equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
    ...over,
  } as PerfilTreino;
}

/** `favoritos` não é campo de `PerfilTreino` — é parâmetro do montador. Fica explícito aqui. */
function rotina(p: PerfilTreino, semana = 1, extra?: { retomada?: object; favoritos?: string[] }) {
  const presc = prescreverTreino(p, avaliarGateTreino(p));
  return montarRotina(presc, p, EXERCISES, new Set(extra?.favoritos ?? []), { semana, ...(extra?.retomada ? { retomada: extra.retomada } : {}) } as never);
}
const ids = (r: ReturnType<typeof rotina>) => r.dias.flatMap((d) => d.slots.map((s) => s.exercicio.id));

/** Um par (de → para) real: mesmo padrão, ambos elegíveis em academia/intermediário. */
function parReal(p: PerfilTreino) {
  const usados = ids(rotina(p));
  for (const de of usados) {
    const alvo = EXERCISES.find((e) => e.id === de)!;
    const para = EXERCISES.find(
      (e) => e.id !== de && !usados.includes(e.id) && e.padraoMovimento === alvo.padraoMovimento && e.nivel !== 'avancado' && e.local !== 'casa_sem',
    );
    if (para) return { de, para: para.id };
  }
  throw new Error('nenhum par de troca disponível no catálogo — fixture inválida');
}

describe('🔒 aceite 1 — a preferência SOBREVIVE aos 6 gatilhos de recompute', () => {
  const base = perfil();
  const troca = parReal(base);
  const comPref = perfil({ preferencias: { trocas: [troca], banidos: [] } });

  it('a troca entra no plano — e o preterido sai', () => {
    const antes = ids(rotina(base));
    const depois = ids(rotina(comPref));
    expect(antes, 'a fixture não continha o exercício preterido').toContain(troca.de);
    expect(depois, 'o preterido continuou no plano').not.toContain(troca.de);
    expect(depois, 'o preferido não entrou').toContain(troca.para);
  });

  /**
   * 🔑 OS SEIS GATILHOS, nomeados no Passo 0: reload · virada de semana do mesociclo · rampa
   * de retomada · âncora de peso · favorito novo · edição de perfil. Todos recomputam a
   * rotina do zero; um override de saída morreria em qualquer um deles.
   */
  it.each([
    ['reload (mesma entrada, montagem nova)', () => rotina(comPref)],
    ['virada de semana do mesociclo', () => rotina(comPref, 5)],
    ['rampa de retomada', () => rotina(comPref, 1, { retomada: { semana: 1, fator: 0.5, volumeReferencia: 10 } })],
    ['âncora de peso mexeu', () => rotina(perfil({ ...comPref, pesoKg: 74 }))],
    ['favorito novo', () => rotina(comPref, 1, { favoritos: ['e9'] })],
    ['edição de perfil (tempo por sessão)', () => rotina(perfil({ ...comPref, tempoPorSessaoMin: 45 }))],
  ])('%s', (_nome, montar) => {
    const lista = ids(montar());
    expect(lista, 'o preferido sumiu depois do recompute').toContain(troca.para);
    expect(lista, 'o preterido voltou depois do recompute').not.toContain(troca.de);
  });
});

describe('🔒 aceite 2 — preferência que fura trilho é RECUSADA COM EXPLICAÇÃO', () => {
  const ctx = { exercises: EXERCISES, equipamento: 'nenhum' as const, nivelExperiencia: 'iniciante' as const };

  /** 🔑 A asserção é no TEXTO, não só no booleano: recusa sem explicação é recusa silenciosa. */
  const recusa = (v: ReturnType<typeof avaliarTroca>) => {
    expect(v.aceita).toBe(false);
    expect(v.motivo, 'recusa sem motivo tipado').toBeDefined();
    expect(v.explicacao ?? '', 'recusa sem explicação para a pessoa').not.toBe('');
    return v;
  };

  it('equipamento que a pessoa não tem → recusa que diz o que fazer', () => {
    const emCasa = EXERCISES.find((e) => e.local === 'casa_sem')!;
    const soAcademia = EXERCISES.find((e) => e.local === 'academia' && e.padraoMovimento === emCasa.padraoMovimento)!;
    const v = recusa(avaliarTroca(ctx, { de: emCasa.id, para: soAcademia.id }));
    expect(v.motivo).toBe('equipamento');
    expect(v.explicacao).toMatch(/equipamento/i);
    expect(v.explicacao).toContain(soAcademia.nomePt);
  });

  it('acima do nível liberado → recusa que não culpa a pessoa', () => {
    const ini = EXERCISES.find((e) => e.nivel === 'iniciante' && e.local === 'casa_sem')!;
    const av = EXERCISES.find((e) => e.nivel === 'avancado' && e.padraoMovimento === ini.padraoMovimento && e.local === 'casa_sem');
    if (!av) return; // sem par no catálogo: nada a afirmar
    const v = recusa(avaliarTroca(ctx, { de: ini.id, para: av.id }));
    expect(v.motivo).toBe('nivel');
    expect(v.explicacao, 'a recusa não pode soar como culpa').not.toMatch(/você (não|nunca)/i);
  });

  it('outro movimento → recusa explica QUE o lugar do treino tem um papel', () => {
    const puxar = EXERCISES.find((e) => e.padraoMovimento === 'puxar' && e.local === 'casa_sem')!;
    const isolado = EXERCISES.find((e) => e.padraoMovimento === 'isolado' && e.local === 'casa_sem')!;
    const v = recusa(avaliarTroca(ctx, { de: puxar.id, para: isolado.id }));
    expect(v.motivo).toBe('papel_diferente');
    expect(v.explicacao).toMatch(/movimento/i);
  });

  it('🟢 e o caminho que DEVE passar passa — o guard não é um "não" genérico', () => {
    const p = perfil();
    const t = parReal(p);
    const v = avaliarTroca({ exercises: EXERCISES, equipamento: 'academia', nivelExperiencia: 'intermediario' }, t);
    expect(v.aceita, `o par real foi recusado: ${v.motivo} — ${v.explicacao}`).toBe(true);
  });

  it('a preferência recusada NÃO entra no plano (nem em silêncio)', () => {
    const emCasa = EXERCISES.find((e) => e.local === 'casa_sem')!;
    const soAcademia = EXERCISES.find((e) => e.local === 'academia' && e.padraoMovimento === emCasa.padraoMovimento)!;
    const p = perfil({ equipamento: 'nenhum', nivelExperiencia: 'iniciante', preferencias: { trocas: [{ de: emCasa.id, para: soAcademia.id }], banidos: [] } });
    expect(ids(rotina(p))).not.toContain(soAcademia.id);
  });
});

describe('🔒 aceite 3 — banimento que esvaziaria o slot é RECUSADO', () => {
  /**
   * 🔑 O caso real: `e116` (Remada invertida) é o único PUXAR de casa-sem-equipamento — o
   * furo conhecido do catálogo. Banir ele deixaria o dia de puxar sem opção, e o vazio
   * apareceria NO MEIO DO TREINO, não na hora do banimento.
   */
  const ctxCasa = { exercises: EXERCISES, equipamento: 'nenhum' as const, nivelExperiencia: 'iniciante' as const };

  it('o último exercício do movimento não pode ser banido', () => {
    const v = avaliarBanimento(ctxCasa, 'e116');
    expect(v.aceita).toBe(false);
    expect(v.motivo).toBe('esvaziaria_o_treino');
    expect(v.explicacao ?? '').not.toBe('');
    expect(v.explicacao).toMatch(/último/i);
  });

  it('o arranjo é real: e116 é mesmo o único puxar desse equipamento', () => {
    const puxarCasa = EXERCISES.filter((e) => e.padraoMovimento === 'puxar' && e.local === 'casa_sem' && e.nivel === 'iniciante');
    expect(puxarCasa.map((e) => e.id)).toEqual(['e116']);
  });

  it('🟢 banir quando SOBRA opção é aceito — a trava não vira "nunca"', () => {
    const v = avaliarBanimento({ exercises: EXERCISES, equipamento: 'academia', nivelExperiencia: 'intermediario' }, 'e9');
    expect(v.aceita, `banimento inofensivo recusado: ${v.explicacao}`).toBe(true);
  });

  it('o banimento recusado é IGNORADO na geração — o exercício continua no pool', () => {
    const p = perfil({ equipamento: 'nenhum', nivelExperiencia: 'iniciante', diasDisponiveis: 3, preferencias: { trocas: [], banidos: ['e116'] } });
    expect(ids(rotina(p)), 'o banimento recusado foi obedecido e o puxar sumiu').toContain('e116');
  });

  it('🔒 a invariante dos 3 conjuntos vazios NÃO cresce com preferências', () => {
    // A mesma varredura da substituição: banir o que se pode banir não cria vazio novo.
    const banidos = ['e9', 'e11'];
    const vazios: string[] = [];
    for (const e of EXERCISES)
      for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
        for (const eq of ['nenhum', 'casa', 'academia'] as const) {
          const r = substituirExercicio({ exercicioAtual: e, equipamento: eq, nivelExperiencia: nivel, exercises: EXERCISES.filter((x) => !banidos.includes(x.id)) });
          if (r.status === 'sinalizado') vazios.push(`${e.id}·${nivel}·${eq}`);
        }
    // e9/e11 são compostos de empurrar com muitos pares: banir os dois não abre buraco novo
    // além do furo conhecido do e116 (3 combinações) e dos próprios banidos, que saem da base.
    expect(vazios.filter((v) => v.startsWith('e116·')).length).toBe(3);
  });
});

describe('🔒 aceite 6 — o trilho carrega procedência e versão', () => {
  it('rótulo legível, como o §16 exige', () => {
    expect(PREFERENCIAS_TRILHO.procedencia).toBe('politica');
    expect(PREFERENCIAS_TRILHO.versao).toMatch(/^v\d+\.\d+$/);
    expect(PREFERENCIAS_TRILHO.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('🔒 a preferência é INPUT — nunca patch na saída', () => {
  /**
   * 🔴 A prova ESTRUTURAL da forma travada: se alguém voltar a remendar `rotinaDias` no
   * lugar de gravar no perfil, a edição volta a morrer no reload — e nenhum teste de função
   * notaria. É a lição de "a suíte prova função, não montagem".
   */
  it('o Painel grava a troca no PERFIL e recomputa — não escreve na rotina', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/painel/Painel.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
    const i = src.indexOf('function aplicarEx(');
    expect(i, 'o handler da troca sumiu').toBeGreaterThan(-1);
    const corpo = src.slice(i, src.indexOf('\n  }', i));
    expect(corpo, 'a troca não vai para o perfil').toMatch(/preferencias:/);
    expect(corpo, 'a troca não passa pelo gerador').toMatch(/recomputarPlano\(/);
    expect(corpo, 'voltou a remendar a rotina no lugar de gravar a preferência')
      .not.toMatch(/novos\[d\]!\.slots\[s\] = /);
  });

  it('sem preferências, a rotina é BYTE-IDÊNTICA à de antes do v3', () => {
    const semPrefs = ids(rotina(perfil()));
    const comVazias = ids(rotina(perfil({ preferencias: PREFERENCIAS_VAZIAS })));
    expect(comVazias).toEqual(semPrefs);
  });

  it('preferência que deixou de caber é ignorada, não apagada — e o plano sai correto', () => {
    const soAcademia = EXERCISES.find((e) => e.local === 'academia')!;
    const prefs = { trocas: [{ de: 'e1', para: soAcademia.id }], banidos: [] };
    const efetivas = preferenciasEfetivas({ exercises: EXERCISES, equipamento: 'nenhum', nivelExperiencia: 'iniciante' }, prefs);
    expect(efetivas.preferidos.size, 'preferência inválida entrou na geração').toBe(0);
    expect(prefs.trocas.length, 'a preferência foi apagada do perfil em vez de ignorada').toBe(1);
  });
});

/**
 * 🔒 A SUPERFÍCIE DO *"não quero mais Y"* — motor sem botão é sucesso simulado.
 *
 * 🔴 Regra da casa, aprendida na Leva F: *"toggle 'ativado' sem superfície de uso é SUCESSO
 * SIMULADO"*. O banimento tinha motor, validação e telemetria prontos e **nenhum botão** —
 * por isso o Bloco A não foi dado por entregue no relatório anterior.
 *
 * ⚠️ E o par que fecha: a confirmação diz *"dá para trazer de volta em Editar perfil"*.
 * **Copy que promete controle inexistente é a classe que este projeto vem fechando** — a
 * frase e o botão de volta entram juntos, e este guard não deixa um sobreviver sem o outro.
 */
describe('🔒 o banimento tem SUPERFÍCIE — e o caminho de volta existe', () => {
  const fonte = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

  it('existe o botão de banir, e ele chama o handler do motor', () => {
    const modal = fonte('src/components/painel/DetalheModais.tsx');
    expect(modal, 'o botão "não quero mais" não existe').toMatch(/Não quero mais este exercício/);
    expect(modal).toMatch(/onClick=\{onBanir\}/);
    const painel = fonte('src/components/painel/Painel.tsx');
    expect(painel, 'o botão não está ligado ao Painel').toMatch(/onBanir=\{/);
    expect(painel, 'o handler não consulta o motor').toMatch(/avaliarBanimento\(/);
  });

  it('a recusa e a confirmação chegam à tela — nenhuma das duas é silenciosa', () => {
    const modal = fonte('src/components/painel/DetalheModais.tsx');
    expect(modal, 'a resposta do motor não é renderizada').toMatch(/\{banidoTexto\}/);
    const painel = fonte('src/components/painel/Painel.tsx');
    expect(painel).toMatch(/setBanimentoTexto\(veredito\.explicacao/);
  });

  it('🔑 a promessa da copy tem controle atrás dela', () => {
    const painel = fonte('src/components/painel/Painel.tsx');
    const prometeVolta = /trazer de volta em Editar perfil/.test(painel);
    if (!prometeVolta) return; // copy mudou: nada a exigir
    const favoritos = fonte('src/components/painel/Favoritos.tsx');
    expect(favoritos, 'a copy promete um controle que não existe').toMatch(/export function ExerciciosBanidos/);
    expect(favoritos).toMatch(/Trazer de volta/);
    const editar = fonte('src/components/painel/EditarPerfil.tsx');
    const i = editar.indexOf('<ExerciciosBanidos');
    expect(i, 'o Editar perfil não monta a lista de banidos').toBeGreaterThan(-1);
    // ⚠️ Casar a PRESENÇA da tag deixou passar `{false && <ExerciciosBanidos` — a mutação M2
    // sobreviveu à 1ª escrita. O que vale é RENDERIZAR: o componente já devolve `null` com a
    // lista vazia, então o call site não pode estar atrás de condição nenhuma.
    const antes = editar.slice(Math.max(0, i - 60), i).trimEnd();
    expect(antes.endsWith('&&') || antes.endsWith('?'), 'a lista de banidos está atrás de uma condição — pode nunca renderizar').toBe(false);
    expect(editar, 'a edição dos banidos não persiste no Salvar').toMatch(/preferencias: \{ trocas:.*banidos \}/);
  });

  it('os dois eventos do bloco têm call site — declarado não conta', () => {
    const painel = fonte('src/components/painel/Painel.tsx');
    expect(painel).toMatch(/registrarEvento\('preferencia_criada', \{ tipo: 'banimento'/);
    expect(painel).toMatch(/registrarEvento\('preferencia_recusada', \{ tipo: 'banimento'/);
  });
});
