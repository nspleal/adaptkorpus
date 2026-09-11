import { describe, expect, it, vi } from 'vitest';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { EntradaPlanoVisivel } from '@/lib/plano-cas-comando';
import { carregarFonteCorrecao, mesclarPerfilCorrigido, persistirCorrecao } from './recuperacao-perfil';
import { leituraParaCorrecaoDoPlanoCas } from './leitura-plano-atomica';
import { linhaParaPerfil, perfilParaLinha } from './perfil-profile';

const perfil: PerfilResumo = {
  sexo: 'masculino', idade: 30, alturaCm: 180, pesoKg: 80, objetivo: 'massa',
  nivelAtividade: 'moderado', nivelExperiencia: 'avancado', equipamento: 'academia',
  preferencia: null, alergenos: [], diasDisponiveis: 3, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'qua', 'sex'], naoCurto: [], favoritos: ['e14'],
  pratosCansados: [{ id: 'receita', ate: '2099-09-11' }],
  rotinaCustom: { origem: 'usuario', dias: [{ nome: 'Meu treino', diaId: 'seg', exercicioIds: ['e14'] }] },
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
};
const opcoes: EntradaPlanoVisivel = {
  pesoEfetivoKg: 79, diasOferecidosCardio: ['ter'],
  semanaCiclo: { semana: 6, feedbackGrupos: [] }, escolhasExecucao: [],
};
const consent = { aceite18: true, aceiteTermos: true, aceiteLgpd: true };

describe('recuperação D11 com servidor', () => {
  it('usa perfil e revisão do servidor, mesmo com cache antigo ou inexistente', async () => {
    const servidor = { perfil, revision: 8, entradaPlano: opcoes };
    for (const local of [null, { perfil: { ...perfil, favoritos: ['antigo'], rotinaCustom: undefined } }]) {
      const fonte = await carregarFonteCorrecao(local, true, vi.fn().mockResolvedValue(servidor));
      expect(fonte).toEqual({ ...servidor, remoto: true });
    }
  });
  it('falha de leitura não vira revisão zero nem autorização de usar cache', async () => {
    expect(await carregarFonteCorrecao({ perfil }, true, vi.fn().mockResolvedValue(null))).toBeNull();
  });
  it('local não precisa de servidor; ausência confirmada usa revisão zero', async () => {
    const carregar = vi.fn();
    expect(await carregarFonteCorrecao({ perfil, entradaPlano: opcoes }, false, carregar))
      .toEqual({ perfil, entradaPlano: opcoes, revision: 0, remoto: false });
    expect(carregar).not.toHaveBeenCalled();
    expect(await carregarFonteCorrecao({ perfil }, true, vi.fn().mockResolvedValue('sem_perfil')))
      .toMatchObject({ revision: 0, remoto: true });
  });
  it('preserva o desenho e os campos não editados pelo questionário', () => {
    const { rotinaCustom: _, favoritos: _f, ...wizard } = perfil;
    const corrigido = mesclarPerfilCorrigido(perfil, { ...wizard, nivelExperiencia: 'intermediario', pratosCansados: [] });
    expect(corrigido.rotinaCustom).toEqual(perfil.rotinaCustom);
    expect(corrigido.favoritos).toEqual(perfil.favoritos);
    expect(corrigido.pratosCansados).toEqual(perfil.pratosCansados);
    expect(corrigido.nivelExperiencia).toBe('intermediario');
  });
  it('aguarda confirmação, preserva opções e usa a revisão mostrada, sem releitura oportunista', async () => {
    let liberar!: (r: { tipo: 'CONFIRMADO'; revision: number; entradaPlano: EntradaPlanoVisivel }) => void;
    const salvar = vi.fn(() => new Promise<{ tipo: 'CONFIRMADO'; revision: number; entradaPlano: EntradaPlanoVisivel }>(r => { liberar = r; }));
    let concluido = false;
    const pendente = persistirCorrecao({ perfil, revision: 8, entradaPlano: opcoes, remoto: true }, perfil, consent, salvar)
      .then(r => { concluido = true; return r; });
    await Promise.resolve();
    expect(concluido).toBe(false);
    expect(salvar).toHaveBeenCalledWith(perfil, 8, opcoes, consent);
    liberar({ tipo: 'CONFIRMADO', revision: 9, entradaPlano: opcoes });
    expect(await pendente).toEqual({ ok: true, entradaPlano: opcoes });
  });
  it.each(['CONFLITO_REVISAO', 'CONFLITO_VERSAO_OU_HASH', 'FALHA'] as const)('não redireciona nem reenvia %s como sucesso', async tipo => {
    const salvar = vi.fn().mockResolvedValue({ tipo, revisaoAtual: 99 });
    expect(await persistirCorrecao({ perfil, revision: 8, remoto: true }, perfil, consent, salvar))
      .toMatchObject({ ok: false, mensagem: expect.any(String) });
    expect(salvar).toHaveBeenCalledTimes(1);
  });
  it('CAS inválido oferece recuperação do mesmo snapshot sem tocar opções ou revisão', () => {
    const invalido = { ...perfil, nivelExperiencia: 'profissional' };
    const recuperado = leituraParaCorrecaoDoPlanoCas({ revision: 8, payload: { entrada: { perfil: invalido, opcoes } } });
    expect(recuperado?.revision).toBe(8);
    expect(recuperado?.entradaPlano).toEqual(opcoes);
    expect(recuperado?.perfil.nivelExperiencia).toBe('profissional');
    expect(recuperado?.perfil.camposInvalidos).toContain('nivelExperiencia');
    expect(recuperado?.perfil.rotinaCustom).toEqual(perfil.rotinaCustom);
    expect(leituraParaCorrecaoDoPlanoCas({ revision: 8, payload: { entrada: { perfil: invalido } } })).toBeNull();
  });
  it('linha legada com preferencias nulas suspende sem TypeError', () => {
    const row = { ...perfilParaLinha(perfil), preferencias: null };
    const lido = linhaParaPerfil(row as unknown as Parameters<typeof linhaParaPerfil>[0]);
    expect(lido.camposInvalidos).toContain('nivelExperiencia');
    expect(lido.camposInvalidos).toContain('tempoPorSessaoMin');
  });
});
