import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recomputarPlano } from './plano';
import { normalizarEntradaPlanoVisivel, opcoesDeEntradaPlano } from './plano-cas-comando';
import type { PerfilResumo } from '@/components/painel/Painel';

/**
 * 🔴 D7 (diagnóstico 2026-09-10, §6.8) — o primeiro carregamento caía no caminho v1.
 *
 * Medido no SHA `34b2ede`, em `src/app/app/page.tsx · montar()`:
 * `const opcoes = entradaPlano ? opcoesDeEntradaPlano(entradaPlano) : { pesoEfetivoKg }`.
 * Sem `entradaPlano` — sessão só local, ou linha legada sem o snapshot C1 — não havia
 * `semanaCiclo`, e o motor devolvia plano **sem séries e sem descanso**, com
 * `resultadoGeracao = NAO_AVALIADO_ENTREGAVEL` e `rotina.foco` ausente mesmo com foco no
 * perfil (a cascata do foco exige a semana). A tela disfarçava o buraco com o piso
 * `prescricao.seriesPorExercicio.min` — o mesmo piso que D9 removeu.
 *
 * 🔒 O conserto não inventa regra nova: usa a função que o SERVIDOR já usava,
 * `normalizarEntradaPlanoVisivel`, que fixa `semana ?? 1`. Cliente e servidor passam a
 * hidratar pela mesma porta.
 */

const base = (o: Record<string, unknown> = {}): PerfilResumo => ({
  sexo: 'masculino', idade: 30, alturaCm: 178, pesoKg: 80,
  nivelAtividade: 'moderado', objetivo: 'massa',
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qui', 'sab'], tempoPorSessaoMin: 60,
  alergenos: [], preferencia: null, naoCurto: [], pratosCansados: [], favoritos: [], ...o,
} as unknown as PerfilResumo);

const PAGINA = join(process.cwd(), 'src', 'app', 'app', 'page.tsx');
const codigo = readFileSync(PAGINA, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

describe('D7 — anti-vacuidade: o caminho v1 realmente entrega plano incompleto', () => {
  it('sem semanaCiclo o motor não anota séries nem descanso (é por isso que o fallback era defeito)', () => {
    const r = recomputarPlano(base(), { pesoEfetivoKg: 80 }).treino.rotina!;
    expect(r.dias.flatMap((d) => d.slots).every((s) => s.series == null)).toBe(true);
    expect(r.resultadoGeracao?.tipo).toBe('NAO_AVALIADO_ENTREGAVEL');
  });

  it('sem semanaCiclo o foco do perfil não chega ao plano (a cascata exige a semana)', () => {
    const perfil = base({ foco: { grupo: 'peito', compensa: 'costas', semana: 1 } });
    expect(recomputarPlano(perfil, { pesoEfetivoKg: 80 }).treino.rotina!.foco).toBeUndefined();
  });
});

describe('D7 — o primeiro carregamento hidrata pela MESMA porta do servidor', () => {
  it('anti-vacuidade: a varredura está lendo as duas funções que montam opções', () => {
    // O diagnóstico media só `montar()`; `recarregarVersaoSalva()` tinha o MESMO fallback.
    expect(codigo, 'montar() sumiu de app/page.tsx — a varredura perdeu o alvo').toMatch(/function montar\(/);
    expect(codigo, 'recarregarVersaoSalva() sumiu').toMatch(/async function recarregarVersaoSalva\(/);
    // Montar, recarregar e agora verificar ANTES de persistir usam a mesma porta.
    expect((codigo.match(/opcoesDeEntradaPlano\(/g) ?? []).length).toBe(3);
  });

  it('nenhum call site monta opções sem semanaCiclo (o fallback v1 saiu dos DOIS)', () => {
    expect(/:\s*\{\s*pesoEfetivoKg\s*\}/.test(codigo),
      'o fallback `: { pesoEfetivoKg }` voltou — esse render cai no caminho v1').toBe(false);
  });

  it('os dois call sites usam normalizarEntradaPlanoVisivel quando não há entradaPlano', () => {
    expect((codigo.match(/normalizarEntradaPlanoVisivel\(/g) ?? []).length).toBe(2);
  });

  /** O que a porta única entrega, medido — não só a presença do nome no arquivo. */
  const opcoesDoPrimeiroBoot = (perfil: PerfilResumo, pesoEfetivoKg = 80) =>
    opcoesDeEntradaPlano(normalizarEntradaPlanoVisivel(perfil, { pesoEfetivoKg }));

  it('a semana cai em 1 e todo slot recebe séries e descanso', () => {
    const opcoes = opcoesDoPrimeiroBoot(base());
    expect(opcoes.semanaCiclo.semana).toBe(1);
    const r = recomputarPlano(base(), opcoes).treino.rotina!;
    for (const s of r.dias.flatMap((d) => d.slots)) {
      expect(s.series, s.exercicio.id).toBeGreaterThan(0);
      expect(s.descansoSeg, s.exercicio.id).toBeGreaterThan(0);
    }
    expect(r.resultadoGeracao?.tipo).toBe('CERTIFICADO');
  });

  it('o foco do perfil chega ao plano no primeiro boot', () => {
    const perfil = base({ foco: { grupo: 'peito', compensa: 'costas', semana: 1 } });
    const r = recomputarPlano(perfil, opcoesDoPrimeiroBoot(perfil)).treino.rotina!;
    expect(r.blocoFoco).toMatchObject({grupos:['peito']});
  });

  it('o peso RESOLVIDO continua mandando (a porta única não devolveu o plano ao perfil.pesoKg)', () => {
    expect(opcoesDoPrimeiroBoot(base(), 61.4).pesoEfetivoKg).toBe(61.4);
  });

  it('cliente e servidor produzem o MESMO plano para o mesmo perfil sem entrada salva', () => {
    const perfil = base({ foco: { grupo: 'peito', compensa: 'costas', semana: 1 } });
    const cliente = recomputarPlano(perfil, opcoesDoPrimeiroBoot(perfil)).treino.rotina;
    const servidor = recomputarPlano(perfil, opcoesDeEntradaPlano(normalizarEntradaPlanoVisivel(perfil, { pesoEfetivoKg: 80 }))).treino.rotina;
    expect(JSON.stringify(cliente)).toBe(JSON.stringify(servidor));
  });

  it('quando HÁ entradaPlano salvo, ele continua mandando (a semana salva não é jogada fora)', () => {
    const perfil = base();
    const salvo = normalizarEntradaPlanoVisivel(perfil, { pesoEfetivoKg: 80, semanaCiclo: { semana: 4, feedbackGrupos: [] } });
    expect(opcoesDeEntradaPlano(salvo).semanaCiclo.semana).toBe(4);
  });
});
