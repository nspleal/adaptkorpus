import { verificarDistribuicaoComplementares } from './__fixtures__/complementares-contrato';
/**
 * 🎛️ v4 · DF③ (2026-08-12) — a DIVISÃO como escolha do usuário (leva B2 do
 * handoff-motor-volume-v4). `auto` = padrão por dias · `superior-inferior` força Sup/Inf
 * onde os dias permitem · `prioridades` monta dias por tema (template travado: 4 dias).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { templatesDaSemana } from './alocador';
import { EXERCISES } from '../data/exercises';
import type { PerfilTreino } from './treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60,
  ...over,
});
const plano = (p: PerfilTreino) => montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana: 3 });

describe('🎛️ DF③ — as três divisões', () => {
  it('ausente ≡ auto: o plano é byte-idêntico (ninguém ganha divisão que não pediu)', () => {
    const sem = JSON.stringify(plano(perfil()));
    const auto = JSON.stringify(plano(perfil({ divisaoPreferida: 'auto' })));
    expect(auto).toBe(sem);
  });

  it('superior-inferior é preferência: calendário pode reagrupar; 1 dia é full-body', () => {
    expect(plano(perfil({ divisaoPreferida: 'superior-inferior', diasDisponiveis: 2 })).split).toBe('Upper / Lower');
    expect(plano(perfil({ divisaoPreferida: 'superior-inferior', diasDisponiveis: 3 })).split).toBe('Upper / Lower / Full');
    expect(plano(perfil({ divisaoPreferida: 'superior-inferior', diasDisponiveis: 5, nivelExperiencia: 'avancado' })).split).toBe('Distribuição pela agenda');
    expect(plano(perfil({ divisaoPreferida: 'superior-inferior', diasDisponiveis: 1 })).split).toBe('Full-body');
  });

  it('prioridades mantém braços sem preencher o orçamento por quota de exercícios', () => {
    const r = plano(perfil({ divisaoPreferida: 'prioridades' }));
    expect(r.split).toBe('Prioridades (4 dias)');
    const bracos = r.dias.find((d) => d.nome === 'Braços + Core');
    expect(bracos, 'o dia de braços não existe').toBeDefined();
    const conta = (g: string) => bracos!.slots.filter((s) => s.exercicio.grupoPrimario === g).length;
    expect(conta('biceps'), `bíceps no dia de braços: ${conta('biceps')}`).toBeGreaterThanOrEqual(1);
    expect(conta('biceps')).toBeLessThanOrEqual(3);
    expect(conta('triceps'), `tríceps no dia de braços: ${conta('triceps')}`).toBeGreaterThanOrEqual(1);
    expect(conta('triceps')).toBeLessThanOrEqual(5); // teto vigente das prioridades, sem quota por sessão
  });

  it('prioridades: as invariantes seguem de pé (core 2–3× · puxar ≥ empurrar · dobradiça)', () => {
    const r = plano(perfil({ divisaoPreferida: 'prioridades' }));
    const contaPadrao = (p: string) => r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
    // Autor 19/09: localização e um complementar por dia precedem core 2x.
    verificarDistribuicaoComplementares(r);
    expect(contaPadrao('puxar')).toBeGreaterThanOrEqual(contaPadrao('empurrar'));
    expect(contaPadrao('dobradica_quadril')).toBeGreaterThanOrEqual(1);
  });

  it('prioridades fora de 4 dias cai no padrão por dias (template travado só p/ 4 — declarado)', () => {
    for (const dias of [2, 3, 5]) {
      const auto = plano(perfil({ diasDisponiveis: dias, nivelExperiencia: 'avancado' })).split;
      expect(plano(perfil({ divisaoPreferida: 'prioridades', diasDisponiveis: dias, nivelExperiencia: 'avancado' })).split).toBe(auto);
    }
  });

  it('os templates são dados fechados: toda divisão × 1–6 dias resolve sem grupo fora do vocabulário', () => {
    const GRUPOS = new Set(['antebraco', 'biceps', 'core', 'costas', 'gluteos', 'lombar', 'ombros', 'panturrilha', 'peito', 'posterior', 'quadriceps', 'triceps']);
    for (const divisao of ['auto', 'superior-inferior', 'prioridades'] as const) {
      for (const dias of [1, 2, 3, 4, 5, 6]) {
        for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
          const { dias: templates } = templatesDaSemana(dias, nivel, divisao);
          expect(templates).toHaveLength(dias);
          for (const t of templates) for (const g of t.grupos) expect(GRUPOS.has(g), `${divisao}/${dias}d: grupo desconhecido ${g}`).toBe(true);
        }
      }
    }
  });
});

/**
 * 🔒 DESCOBRIBILIDADE (a regra de 2026-08-08, aplicada de novo): o seletor RENDERIZA no
 * Editar perfil, sem condicional — controle atrás de condição some em silêncio.
 */
describe('🔒 a divisão tem porta encontrável', () => {
  const fonte = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

  it('o Editar perfil monta o seletor, fora de condicional, e grava no salvar', () => {
    const editar = fonte('src/components/painel/EditarPerfil.tsx');
    const i = editar.indexOf('<SeletorDivisao');
    expect(i, 'o seletor não é montado no Editar perfil').toBeGreaterThan(-1);
    const antes = editar.slice(Math.max(0, i - 60), i).trimEnd();
    expect(antes.endsWith('&&') || antes.endsWith('?'), 'o seletor está atrás de condição').toBe(false);
    expect(editar).toMatch(/divisaoPreferida: divisao === 'auto' \? undefined : divisao/);
  });

  it('a copy do seletor declara o limite do prioridades (4 dias) em vez de fingir', () => {
    const favs = fonte('src/components/painel/Favoritos.tsx');
    const i = favs.indexOf('export function SeletorDivisao');
    expect(i).toBeGreaterThan(-1);
    expect(favs.slice(i, i + 2600)).toMatch(/Vale com 4 dias/);
  });
});
