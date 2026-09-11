/**
 * REGRESSÃO D11 — auditoria 2026-09-11, snapshot a40f8af36cca9ce6b86919ed8869dff7e6a0a050.
 *
 * CONTRATO (critério de conclusão de D6, TABELA-MELHORIAS.md):
 *   "Dados ausentes, parciais, nulos ou malformados são tratados NA ENTRADA LOCAL E
 *    PERSISTIDA, sem falha não tratada nem perda silenciosa."
 *
 * MEDIDO: `sanearBlocosDeTreino` (src/lib/validation/perfil-resumo.ts:108) cobre apenas os
 * QUATRO blocos de treino (`preferencias`, `foco`, `divisaoPreferida`, `rotinaCustom`). Os
 * campos ESCALARES do perfil não passam por régua nenhuma nos dois caminhos de hidratação:
 *   · local:    `migrarSessao` → `normalizarPerfil` (src/lib/session.ts:97)
 *   · servidor: `linhaParaPerfil` (src/lib/persistencia/perfil-profile.ts:156), cujo GET só
 *               exige `preferencias?.nivelExperiencia` TRUTHY (src/app/api/dados/perfil/route.ts:60)
 *               e cujo cliente (`carregarPerfilServidor`, src/lib/persistencia/sync.ts:69-79)
 *               não valida o corpo recebido.
 *
 * Consequência A — FALHA NÃO TRATADA: `nivelExperiencia`, `objetivo` ou `flagsSaude` fora do
 * domínio lançam TypeError dentro de `montar()` (src/app/app/page.tsx:99), que não tem
 * try/catch → o painel cai no error boundary. É o mesmo modo de falha que D6 fechou para
 * `prefs.trocas`.
 * Consequência B — PERDA SILENCIOSA: `treinoDias` com um valor fora do domínio reduz a agenda
 * sem nenhum `avisosHidratacao` e com veredito verde.
 *
 * FALHA no snapshot auditado. Não corrige código.
 */
import { describe, expect, it } from 'vitest';
import { migrarSessao } from '@/lib/session';
import { recomputarPlano } from '@/lib/plano';
import { linhaParaPerfil, type ProfileRow } from '@/lib/persistencia/perfil-profile';
import type { PerfilResumo } from '@/components/painel/Painel';
import { vereditoDoPlano } from '@/lib/veredito-motor';

const PERFIL_BOM = {
  sexo: 'masculino', idade: 30, alturaCm: 175, pesoKg: 75, objetivo: 'saude',
  nivelAtividade: 'moderado', nivelExperiencia: 'intermediario', equipamento: 'academia',
  preferencia: null, alergenos: [], diasDisponiveis: 4, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], naoCurto: [], pratosCansados: [],
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
};

const hidratarLocal = (mut: Record<string, unknown>): PerfilResumo => {
  const r = migrarSessao(JSON.stringify({ v: 2, perfil: { ...PERFIL_BOM, ...mut } }));
  expect(r, 'a migração não deve descartar o perfil inteiro').not.toBeNull();
  return r!.perfil;
};

const gerar = (p: PerfilResumo) => recomputarPlano(p, { semanaCiclo: { semana: 1 } });

describe('REGRESSÃO D11 · hidratação precisa sanear os campos escalares', () => {
  const FORA_DO_DOMINIO: { nome: string; mut: Record<string, unknown> }[] = [
    { nome: 'nivelExperiencia fora do enum', mut: { nivelExperiencia: 'profissional' } },
    { nome: 'objetivo fora do enum', mut: { objetivo: 'hipertrofia' } },
    { nome: 'flagsSaude nulo', mut: { flagsSaude: null } },
  ];

  for (const c of FORA_DO_DOMINIO) {
    it(`local: ${c.nome} não pode derrubar a geração com falha não tratada`, () => {
      const perfil = hidratarLocal(c.mut);
      expect(() => gerar(perfil)).not.toThrow();
    });
  }

  it('local: campo escalar recusado precisa gerar aviso de recuperação', () => {
    const perfil = hidratarLocal({ nivelExperiencia: 'profissional' });
    const avisos = (perfil as unknown as { avisosHidratacao?: string[] }).avisosHidratacao ?? [];
    expect(avisos.length, 'nenhum avisosHidratacao foi emitido').toBeGreaterThan(0);
  });

  it('local: agenda com dia fora do domínio não pode encolher em silêncio', () => {
    const perfil = hidratarLocal({ treinoDias: ['xyz', 'seg'] });
    const avisos = (perfil as unknown as { avisosHidratacao?: string[] }).avisosHidratacao ?? [];
    const rot = gerar(perfil).treino.rotina!;
    expect(
      avisos.length > 0 || rot.dias.length === 4,
      `agenda virou ${rot.dias.length} dia(s) sem aviso nenhum (perfil declarava 4)`,
    ).toBe(true);
  });

  /**
   * ✏️ CORREÇÃO FUNDAMENTADA DA EXPECTATIVA (2026-09-11, correção de D11–D16).
   *
   * O oráculo original media `orcamentoSegundos <= 240 * 60`, o que só é verificável se um
   * plano for gerado — isto é, ele pressupunha que o app CLAMPASSE o valor ilegível para o
   * teto da régua. A decisão da coordenação proíbe exatamente isso: *"não assuma 'saudável',
   * 'iniciante' ou outro valor para esconder corrupção"*. 240 min/sessão é um valor tão
   * inventado quanto os outros dois.
   *
   * A expectativa corrigida é ESTRITAMENTE MAIS FORTE que a original: nenhum orçamento chega
   * ao motor, porque nenhum plano é gerado, e portanto não existe certificação — verde ou de
   * qualquer outra cor — apoiada nesse campo. O título do caso continua valendo ao pé da letra.
   */
  it('local: tempoPorSessaoMin absurdo não pode virar certificação verde', () => {
    const perfil = hidratarLocal({ tempoPorSessaoMin: 1e9 });
    const r = gerar(perfil);
    expect((perfil as unknown as { camposInvalidos?: string[] }).camposInvalidos)
      .toContain('tempoPorSessaoMin');
    expect(r.treino.rotina, 'plano gerado sobre um tempo por sessão ilegível').toBeNull();
    expect(r.treino.prescricao, 'prescrição gerada sobre um tempo por sessão ilegível').toBeNull();
    expect(vereditoDoPlano(r.treino.rotina, 60), 'veredito emitido sem plano').toBeNull();
  });

  for (const c of FORA_DO_DOMINIO) {
    it(`servidor: ${c.nome} em linha legada não pode derrubar a geração`, () => {
      const row = {
        sexo: 'masculino', peso_kg: 75, altura_cm: 175, idade: 30,
        nivel_atividade: 'moderado',
        objetivo: (c.mut.objetivo as string) ?? 'saude',
        gestacao_amamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false,
        preferencia_alimentar: null, alergenos: [],
        preferencias: {
          nivelExperiencia: (c.mut.nivelExperiencia as string) ?? 'intermediario',
          equipamento: 'academia', equipamentosCasa: [],
          treinoDias: ['seg', 'ter', 'qui', 'sex'], diasDisponiveis: 4,
          tempoPorSessaoMin: 60, naoCurto: [], favoritos: [], pratosCansados: [],
        },
      } as unknown as ProfileRow;
      const perfil = linhaParaPerfil(row);
      expect(() => gerar(perfil)).not.toThrow();
    });
  }

  it('servidor: linha legada sem tempoPorSessaoMin não pode produzir orçamento NaN', () => {
    const row = {
      sexo: 'masculino', peso_kg: 75, altura_cm: 175, idade: 30,
      nivel_atividade: 'moderado', objetivo: 'saude',
      gestacao_amamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false,
      preferencia_alimentar: null, alergenos: [],
      preferencias: {
        nivelExperiencia: 'intermediario', equipamento: 'academia', equipamentosCasa: [],
        treinoDias: ['seg', 'ter', 'qui', 'sex'], diasDisponiveis: 4,
        naoCurto: [], favoritos: [], pratosCansados: [],
      },
    } as unknown as ProfileRow;
    /**
     * ✏️ CORREÇÃO FUNDAMENTADA (mesma razão do caso local acima). `orcamentoSegundos = NaN`
     * era o defeito medido; a correção não é escolher um número no lugar do NaN — é não
     * calcular orçamento nenhum. `PreferenciasPerfil.tempoPorSessaoMin` é obrigatório e toda
     * versão do app o grava (`perfilParaLinha`), então uma linha sem ele não é legado
     * legítimo: é dado estrangeiro ou corrompido.
     */
    const perfil = linhaParaPerfil(row);
    const r = gerar(perfil);
    expect((perfil as unknown as { camposInvalidos?: string[] }).camposInvalidos)
      .toContain('tempoPorSessaoMin');
    expect(r.treino.rotina, 'plano gerado sobre orçamento indefinido').toBeNull();
  });
});
