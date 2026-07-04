import { describe, expect, it } from 'vitest';
import {
  ESCADAS_DIFICULDADE, localizarNaEscada, posicaoNaEscada,
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
  it('todos os ids das escadas existem na biblioteca (38 exercícios na malha travada)', () => {
    // Nota: a prosa do doc de análise diz "35"; o grafo travado do motor tem 38 ids
    // distintos (recontagem fiel). Divergência de prosa reportada ao autor — o grafo manda.
    const ids = Object.values(ESCADAS_DIFICULDADE).flat(2);
    for (const id of ids) expect(byId.has(id), `${id} não existe`).toBe(true);
    expect(ids.length).toBe(38);
  });

  it('nenhum exercício aparece em duas escadas', () => {
    const ids = Object.values(ESCADAS_DIFICULDADE).flat(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('dificuldade não-decrescente ao subir cada escada (eixo grosso coerente)', () => {
    for (const [nome, degraus] of Object.entries(ESCADAS_DIFICULDADE)) {
      let anterior = -1;
      for (const degrau of degraus) {
        // menor nível do degrau (variantes equivalentes) governa o piso do degrau
        const nivelDegrau = Math.min(...degrau.map((id) => ORDEM[byId.get(id)!.nivel]));
        expect(nivelDegrau, `${nome}: dificuldade caiu`).toBeGreaterThanOrEqual(anterior);
        anterior = nivelDegrau;
      }
    }
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
  it('e116 → próximo degrau é chin-up (barra): casa-SEM não recebe hint', () => {
    expect(sugerirProximaVariacao('e116', EXERCISES, 'nenhum')).toBeNull();
  });
  it('e116 com equipamento "casa" → hint e22 chin-up', () => {
    expect(sugerirProximaVariacao('e116', EXERCISES, 'casa')).toEqual(['e22']);
  });
  it('e146 → e8 Roda abdominal exige roda: casa-sem sem hint (não pula degrau)', () => {
    expect(sugerirProximaVariacao('e146', EXERCISES, 'nenhum')).toBeNull();
  });
});
