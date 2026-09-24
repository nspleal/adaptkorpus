import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { migrarSessao } from './session';
import { vereditoDoPlano } from './veredito-motor';
import { DELOAD_REDUCAO_VOLUME } from './engine/treino-constants';
import type { PerfilResumo } from '@/components/painel/Painel';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AvisosHidratacao from '@/components/painel/AvisosHidratacao';
import { chaveSessao } from './treino-historico';

const perfil: PerfilResumo = {
  sexo: 'masculino', idade: 30, alturaCm: 178, pesoKg: 80, nivelAtividade: 'moderado',
  objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
  diasDisponiveis: 4, treinoDias: ['seg', 'ter', 'qui', 'sab'], tempoPorSessaoMin: 60,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  alergenos: [], preferencia: null, naoCurto: [], pratosCansados: [], favoritos: [],
};

describe('Revisão final — contratos entre motor, hidratação e tela', () => {
  it('deload manual reduz a escolha uma vez, sem substituí-la pelo teto automático', () => {
    const p = { ...perfil, rotinaCustom: { origem: 'usuario' as const, dias: [{
      nome: 'Meu dia', diaId: 'seg' as const, exercicioIds: ['e5', 'e6', 'e9'],
      seriesPorExercicio: { e5: 99, e6: 99, e9: 99 },
    }] } };
    const r = recomputarPlano(p, { semanaCiclo: { semana: 6 } }).treino.rotina!;
    expect(r.dias[0]!.slots.length).toBe(3);
    expect(r.dias[0]!.slots.map(s => s.series)).toEqual([1, 2, 3].map(() => Math.round(99 * (1 - DELOAD_REDUCAO_VOLUME))));
    expect(p.rotinaCustom.dias[0]!.seriesPorExercicio.e5).toBe(99);
  });

  it('cardio sem duração não esconde nem entra no veredito do dia manual medido acima do limite', () => {
    const p = { ...perfil, rotinaCustom: { origem: 'usuario' as const, dias: [{
      nome: 'Meu dia', diaId: 'seg' as const, exercicioIds: ['e5', 'e6', 'e9'],
      seriesPorExercicio: { e5: 99, e6: 99, e9: 99 },
    }] } };
    const r = recomputarPlano(p, { semanaCiclo: { semana: 1 }, diasOferecidosCardio: ['dom'] }).treino.rotina!;
    expect(r.duracaoDias!.some(d => d.estadoLimite === 'ACIMA_DO_LIMITE_OPERACIONAL')).toBe(true);
    const texto = vereditoDoPlano(r, 60)!;
    expect(`${texto.titulo} ${texto.detalhe}`).toMatch(/acima|ultrapass|excede/i);
    // 2026-09-23 — o cardio (sessões, sem minutos) fica no próprio bloco e não entra no veredito do treino.
    expect(`${texto.titulo} ${texto.detalhe}`).not.toMatch(/cardio/i);
    expect(r.diasCardio).toEqual([expect.objectContaining({ diaId: 'dom', minutos: null })]);
  });

  it('certificação informa a tolerância; não promete caber no orçamento estrito', () => {
    const texto = vereditoDoPlano({ dias: [], resultadoGeracao: { tipo: 'CERTIFICADO', capacidadeTerminal: 6 } }, 60)!;
    expect(`${texto.titulo} ${texto.detalhe}`).toMatch(/8 min/);
    expect(texto.titulo).not.toContain('cabe nos 60 min');
  });

  it('veredito de erro não promete proteção de gravação que não controla', () => {
    const texto = vereditoDoPlano({ dias: [], resultadoGeracao: {
      tipo: 'ERRO_ALOCADOR', motivo: 'INVARIANTE_VIOLADO', capacidadeTestada: 4, violacoesInvariantes: [],
    } }, 60)!;
    expect(texto.detalhe).not.toMatch(/Nada foi salvo/);
  });

  it('preferência parcial preserva banimentos válidos e informa o saneamento', () => {
    const r = migrarSessao(JSON.stringify({ v: 2, perfil: { ...perfil, preferencias: { banidos: ['e5'] } } }))!;
    expect(r.perfil.preferencias?.banidos).toEqual(['e5']);
    expect((r.perfil as unknown as { avisosHidratacao?: string[] }).avisosHidratacao?.length).toBeGreaterThan(0);
    const plano = recomputarPlano(r.perfil, { semanaCiclo: { semana: 1 } });
    expect(plano.treino.rotina!.dias.flatMap(d => d.slots).some(s => s.exercicio.id === 'e5')).toBe(false);
    const html = renderToStaticMarkup(React.createElement(AvisosHidratacao, { avisos: r.perfil.avisosHidratacao }));
    expect(html).toContain('role="status"');
    expect(html).toContain('preferências de exercícios');
  });

  it('chaves visuais preservam sessões de aparelhos distintos com mesmo contador', () => {
    const sessao = { dataISO: '2026-09-11', n: 1, tipo: 'treino' as const };
    expect(chaveSessao({ ...sessao, id: 'aparelho-a' } as never)).not.toBe(chaveSessao({ ...sessao, id: 'aparelho-b' } as never));
    expect(chaveSessao(sessao as never)).toBe('2026-09-11|1|treino');
  });
});
