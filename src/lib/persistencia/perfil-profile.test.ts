import { describe, expect, it } from 'vitest';
import type { PerfilResumo } from '@/components/painel/Painel';
import { linhaComConsentimentos, linhaParaPerfil, perfilParaLinha } from './perfil-profile';

/**
 * Contrato schema↔tipo (DF 2026-07-05): os ~9 campos sem coluna vivem no jsonb `preferencias`;
 * o resto são colunas planas. O mapeamento é uma bijeção (round-trip fiel).
 */
const perfil: PerfilResumo = {
  sexo: 'masculino', idade: 30, alturaCm: 180, pesoKg: 80, objetivo: 'massa',
  nivelAtividade: 'moderado', nivelExperiencia: 'intermediario', equipamento: 'casa',
  preferencia: null, alergenos: ['gluten'], diasDisponiveis: 4, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], naoCurto: ['f1'], favoritos: ['e9'],
  equipamentosCasa: ['halteres', 'banco'], pratosCansados: [{ id: 'r1', ate: '2026-08-01' }],
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
};

describe('perfil-profile — mapeador PerfilResumo ↔ linha de profile', () => {
  it('round-trip fiel: linhaParaPerfil(perfilParaLinha(p)) === p', () => {
    expect(linhaParaPerfil(perfilParaLinha(perfil))).toEqual(perfil);
  });

  it('os 9 campos sem coluna ficam DENTRO de `preferencias` (não como coluna de topo)', () => {
    const linha = perfilParaLinha(perfil);
    expect(linha.preferencias).toEqual({
      nivelExperiencia: 'intermediario', equipamento: 'casa', equipamentosCasa: ['halteres', 'banco'],
      treinoDias: ['seg', 'ter', 'qui', 'sex'], diasDisponiveis: 4, tempoPorSessaoMin: 60,
      naoCurto: ['f1'], favoritos: ['e9'], pratosCansados: [{ id: 'r1', ate: '2026-08-01' }],
    });
    // não vazam como colunas de topo
    for (const k of ['favoritos', 'treinoDias', 'equipamentosCasa', 'nivelExperiencia']) {
      expect(k in linha).toBe(false);
    }
  });

  it('colunas planas mapeiam certo (camel→snake, flags de saúde, preferência null)', () => {
    const linha = perfilParaLinha(perfil);
    expect(linha.peso_kg).toBe(80);
    expect(linha.altura_cm).toBe(180);
    expect(linha.nivel_atividade).toBe('moderado');
    expect(linha.preferencia_alimentar).toBeNull();
    expect(linha.alergenos).toEqual(['gluten']);
    expect(linha.gestacao_amamentacao).toBe(false);
    expect(linha.diabetes).toBe(false);
  });

  it('opcionais ausentes (favoritos/equipamentosCasa) sobrevivem ao round-trip', () => {
    const semOpc: PerfilResumo = { ...perfil, favoritos: undefined, equipamentosCasa: undefined };
    expect(linhaParaPerfil(perfilParaLinha(semOpc))).toEqual(semOpc);
  });

  it('mesociclo + modo força (v2, DF 2026-07-08) vão no jsonb e fazem round-trip fiel', () => {
    const v2: PerfilResumo = { ...perfil, mesocicloInicio: '2026-07-08', mesocicloSemana: 3, modoForca: true };
    const linha = perfilParaLinha(v2);
    expect(linha.preferencias.mesocicloInicio).toBe('2026-07-08');
    expect(linha.preferencias.mesocicloSemana).toBe(3);
    expect(linha.preferencias.modoForca).toBe(true);
    for (const k of ['mesocicloInicio', 'mesocicloSemana', 'modoForca']) expect(k in linha).toBe(false); // não vazam como coluna
    expect(linhaParaPerfil(linha)).toEqual(v2);
    // ausentes (conta v1) seguem ausentes — nada de default fantasma
    const semV2 = perfilParaLinha(perfil);
    expect('mesocicloInicio' in semV2.preferencias).toBe(false);
    expect(linhaParaPerfil(semV2)).toEqual(perfil);
  });

  it('linhaComConsentimentos: mescla aceite_18/termos/lgpd + carimbo (LGPD quer o registro)', () => {
    const linha = perfilParaLinha(perfil);
    const out = linhaComConsentimentos(linha, { aceite18: true, aceiteTermos: true, aceiteLgpd: true }, '2026-07-06T00:00:00.000Z');
    expect(out.aceite_18).toBe(true);
    expect(out.aceite_termos).toBe(true);
    expect(out.aceite_lgpd).toBe(true);
    expect(out.aceite_em).toBe('2026-07-06T00:00:00.000Z');
    expect(out.peso_kg).toBe(80); // linha original preservada
  });
});
