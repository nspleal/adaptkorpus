import { describe, expect, it } from 'vitest';
import {
  ESCADAS_DIFICULDADE, escadaComNomes, localizarNaEscada, posicaoNaEscada,
  sugerirProximaVariacao, sugerirVariacaoAnterior,
} from './escadas';
import { EXERCISES } from '../data/exercises';
import type { NivelExercicio } from '../data/types';

/**
 * Âncoras da spec TRAVADA (cofre): `fontes/ranking-exercicios-evokorpus` §"Escadas de
 * dificuldade" (DF 2026-07-03). Espelha os cenários do harness do autor (validacao-motor C6),
 * agora sobre os IDs reais do app ("eN") e a biblioteca real (163 exercícios).
 */
const byId = new Map(EXERCISES.map((e) => [e.id, e]));
const ORDEM: Record<NivelExercicio, number> = { iniciante: 0, intermediario: 1, avancado: 2 };

describe('escadas de dificuldade — integridade contra a biblioteca real', () => {
  it('todos os ids das escadas existem na biblioteca (41 exercícios na malha travada)', () => {
    // Nota: a prosa do doc de análise diz "35"; o grafo travado do motor tem 38 ids
    // distintos (recontagem fiel). Divergência de prosa reportada ao autor — o grafo manda.
    // 🔒 2026-08-15: 38 + 3 = 41 — `e166`/`e164`/`e165` entraram como degraus do meio da
    // escada de puxar (DF do autor). `e167`/`e168` da mesma leva ficam FORA de propósito:
    // são laterais do `e116` (mesma dificuldade), e a malha é de progressão, não de catálogo.
    const ids = Object.values(ESCADAS_DIFICULDADE).flat(2);
    for (const id of ids) expect(byId.has(id), `${id} não existe`).toBe(true);
    expect(ids.length).toBe(41);
  });

  /** O corolário da nota acima, dito como asserção: a malha NÃO é o catálogo. */
  it('e167/e168 estão fora da malha — laterais não são degraus', () => {
    const ids = Object.values(ESCADAS_DIFICULDADE).flat(2);
    for (const id of ['e167', 'e168']) {
      expect(ids, `${id} virou degrau: lateral do e116 não é progressão`).not.toContain(id);
      expect(byId.has(id), `${id} sumiu da biblioteca`).toBe(true);
    }
  });

  it('nenhum exercício aparece em duas escadas', () => {
    const ids = Object.values(ESCADAS_DIFICULDADE).flat(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * Exigência de ENTRADA do degrau, DERIVADA de `equipamentoExigido` — nunca de uma lista
   * de exceções escrita à mão (que seria o buraco de amanhã). É a MENOR exigência entre as
   * variantes equivalentes, porque é ela que torna o degrau alcançável: `filtrarDegrau`
   * mantém qualquer variante disponível. (Ex.: `['e102','e101']` — e102 pede halteres, e101
   * não pede nada; o degrau entra sem equipamento, e a fronteira ali NÃO existe.)
   */
  const exigenciaDoDegrau = (degrau: readonly string[]): string[] => {
    const sets = degrau.map((id) => [...(byId.get(id)!.equipamentoExigido ?? [])].sort());
    sets.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
    return sets[0]!;
  };
  const mesmoRamo = (a: readonly string[], b: readonly string[]) => a.join('+') === b.join('+');

  /**
   * 🔑 O que torna "topo do ramo" bem definido. Se uma escada pedisse barra num degrau e
   * voltasse a não pedir no seguinte, quem não tem barra teria um BURACO no meio da escada,
   * e `filtrarDegrau` (que devolve null e não pula degrau) esconderia os degraus de cima que
   * a pessoa conseguiria fazer. Exigir monotonia faz o alcance de cada usuário ser sempre um
   * PREFIXO da escada — que é a semântica que os hints assumem.
   */
  it('requisito de equipamento NUNCA regride ao subir (o alcance é um prefixo)', () => {
    for (const [nome, degraus] of Object.entries(ESCADAS_DIFICULDADE)) {
      for (let i = 1; i < degraus.length; i += 1) {
        const antes = exigenciaDoDegrau(degraus[i - 1]!);
        const agora = exigenciaDoDegrau(degraus[i]!);
        for (const eq of antes) {
          expect(agora, `${nome} degrau ${i + 1}: soltou "${eq}" que o degrau anterior exigia`).toContain(eq);
        }
      }
    }
  });

  /**
   * 🔒 DF do autor 2026-08-15 — REFORMULADO, não afrouxado.
   *
   * Antes: "dificuldade não-decrescente ao subir cada escada". Aquilo acoplava os dois eixos
   * que o próprio `escadas.ts` documenta como INDEPENDENTES (grosso = `nivel`; fino =
   * posição na escada), e valia por sorte nas 10 escadas de então — não era invariante
   * desenhada. A escada de puxar já atravessava de puxar-HORIZONTAL para puxar-VERTICAL
   * (`e116 → e22`); a leva `e164`–`e168` só subiu o topo do lado horizontal até passar do
   * ponto de entrada do vertical, e o acoplamento apareceu.
   *
   * Agora: não-decrescente DENTRO de cada ramo de equipamento; na TRAVESSIA, o guard não
   * afirma nada. Um guard que diz menos e diz certo é mais forte que um que diz mais por
   * acidente — e afirmar ali exigiria responder "remada invertida unilateral é mais difícil
   * que um chin-up?", pergunta de domínio que este repositório não decide sozinho.
   */
  it('dificuldade não-decrescente DENTRO de cada ramo de equipamento', () => {
    for (const [nome, degraus] of Object.entries(ESCADAS_DIFICULDADE)) {
      let anterior = -1;
      let ramoAnterior: string[] | null = null;
      for (const [i, degrau] of degraus.entries()) {
        const ramo = exigenciaDoDegrau(degrau);
        // menor nível do degrau (variantes equivalentes) governa o piso do degrau
        const nivelDegrau = Math.min(...degrau.map((id) => ORDEM[byId.get(id)!.nivel]));
        if (ramoAnterior !== null && !mesmoRamo(ramoAnterior, ramo)) {
          anterior = -1; // travessia: o guard declina de comparar e recomeça a contar
        } else {
          expect(nivelDegrau, `${nome} degrau ${i + 1}: dificuldade caiu dentro do ramo`).toBeGreaterThanOrEqual(anterior);
        }
        anterior = nivelDegrau;
        ramoAnterior = ramo;
      }
    }
  });

  /**
   * 🔑 A reformulação é LOAD-BEARING, não decorativa. Se alguém "simplificar" o guard acima
   * de volta para a versão global, a suíte fica vermelha — e é isto aqui que diz por quê:
   * existe queda de nível real, e ela acontece EXATAMENTE numa fronteira de equipamento
   * (hoje `e165` avançado → `e22` intermediário, na escada de puxar). Sem esta asserção, a
   * divisão por ramo pareceria zelo desnecessário e voltaria a ser apertada por engano.
   */
  it('a divisão por ramo é necessária: há queda de nível, e só na travessia', () => {
    const quedas: string[] = [];
    for (const [nome, degraus] of Object.entries(ESCADAS_DIFICULDADE)) {
      for (let i = 1; i < degraus.length; i += 1) {
        const nivel = (d: readonly string[]) => Math.min(...d.map((id) => ORDEM[byId.get(id)!.nivel]));
        if (nivel(degraus[i]!) < nivel(degraus[i - 1]!)) {
          quedas.push(`${nome}:${i}`);
          expect(
            mesmoRamo(exigenciaDoDegrau(degraus[i - 1]!), exigenciaDoDegrau(degraus[i]!)),
            `${nome} degrau ${i + 1}: dificuldade caiu SEM mudar de equipamento — isso é escada errada, não travessia`,
          ).toBe(false);
        }
      }
    }
    expect(quedas.length, 'nenhuma queda: o guard por ramo virou equivalente ao global').toBeGreaterThan(0);
  });

  it('exatamente 5 degraus exigem implemento (e22/e21/e88/e8 barra/roda · e102 halter)', () => {
    const comImplemento = Object.values(ESCADAS_DIFICULDADE)
      .flat(2)
      .filter((id) => byId.get(id)!.local !== 'casa_sem')
      .sort();
    expect(comImplemento).toEqual(['e102', 'e21', 'e22', 'e8', 'e88']);
  });
});

describe('escadas — hints de progressão/regressão/posição (cofre C6)', () => {
  it('e1 Flexão → sugere e113 Diamante (próximo degrau)', () => {
    expect(sugerirProximaVariacao('e1')).toEqual(['e113']);
  });
  it('e16 Afundo → e78 Búlgaro (degrau agrupado sobe junto)', () => {
    expect(sugerirProximaVariacao('e16')).toEqual(['e78']);
  });
  it('e145 Pistol = topo → sem hint', () => {
    expect(sugerirProximaVariacao('e145')).toBeNull();
  });
  it('e9 Supino (carga) fora da malha → progride por peso, sem hint', () => {
    expect(sugerirProximaVariacao('e9')).toBeNull();
  });
  it('regressão: e83 Nórdica → e86 Curl deslizante', () => {
    expect(sugerirVariacaoAnterior('e83')).toEqual(['e86']);
  });
  it('e1 Flexão = degrau 3 de 6 (insumo da escada visual)', () => {
    expect(posicaoNaEscada('e1')).toEqual({ degrau: 3, total: 6, escada: 'empurrarHorizontal' });
  });
  it('fora da malha → localizar/posição null', () => {
    expect(localizarNaEscada('e9')).toBeNull();
    expect(posicaoNaEscada('e9')).toBeNull();
  });
});

describe('escadas — o hint RESPEITA equipamento (regra do cofre "barra fixa exige barra")', () => {
  // 🔒 2026-08-15 — a regra ("degrau que exige barra não vira hint sem barra") é a mesma;
  // o degrau na beira da travessia passou a ser o `e165`. Ver escadas.ts §DF 2026-08-15.
  it('e165 → próximo degrau é chin-up (barra): casa-SEM não recebe hint', () => {
    expect(sugerirProximaVariacao('e165', EXERCISES, 'nenhum')).toBeNull();
  });
  it('e165 com equipamento "casa" → hint e22 chin-up', () => {
    expect(sugerirProximaVariacao('e165', EXERCISES, 'casa')).toEqual(['e22']);
  });
  /** E o ramo de peso corporal inteiro anda sem equipamento — é o ponto da leva. */
  it('a rampa de casa-sem vai do e116 ao e165 sem pedir implemento', () => {
    expect(sugerirProximaVariacao('e116', EXERCISES, 'nenhum')).toEqual(['e166']);
    expect(sugerirProximaVariacao('e166', EXERCISES, 'nenhum')).toEqual(['e164']);
    expect(sugerirProximaVariacao('e164', EXERCISES, 'nenhum')).toEqual(['e165']);
  });
  it('e146 → e8 Roda abdominal exige roda: casa-sem sem hint (não pula degrau)', () => {
    expect(sugerirProximaVariacao('e146', EXERCISES, 'nenhum')).toBeNull();
  });
});

describe('escadaComNomes — insumo da lista expandida / seletor (V8.3/V8.1)', () => {
  const resolver = (id: string) => byId.get(id);

  it('e1 Flexão: 6 degraus com nomes, atual = 3º', () => {
    const r = escadaComNomes('e1', resolver)!;
    expect(r.total).toBe(6);
    expect(r.degrau).toBe(3);
    expect(r.degraus.map((d) => d.nome)).toEqual([
      'Flexão na parede',
      'Flexão inclinada (mãos elevadas)',
      'Flexão de braço',
      'Flexão diamante',
      'Flexão com pés elevados',
      'Paralelas (mergulho)',
    ]);
    expect(r.degraus.map((d) => d.atual)).toEqual([false, false, true, false, false, false]);
  });

  it('degrau multi-id (agachar: [e16,e160,e17]) usa o 1º id como representante', () => {
    const r = escadaComNomes('e16', resolver)!;
    expect(r.degraus[1]!.idRepresentativo).toBe('e16');
    expect(r.degraus[1]!.nome).toBe('Afundo (avanço)');
    expect(r.degraus[1]!.atual).toBe(true);
    // e160/e17 (variantes do mesmo degrau) apontam pro MESMO degrau atual
    expect(escadaComNomes('e17', resolver)!.degrau).toBe(2);
  });

  it('fora da malha (e9 carga) → null', () => {
    expect(escadaComNomes('e9', resolver)).toBeNull();
  });
});
