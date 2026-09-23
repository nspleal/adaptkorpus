/**
 * 🔴 O CASO RELATADO EM 2026-09-15, REPRODUZIDO PONTO A PONTO.
 *
 * 🔑 A captura (`relato-volume.png`) mostra a tela "Montar meu treino" com
 * **peito 17 · costas 12 · quadríceps 8 · posterior 4 · glúteos 4 · ombros 13** e seis linhas
 * do crítico. As ENTRADAS foram conferidas em leitura na conta real em 2026-09-16, com
 * autorização do autor, e reproduzem a captura com diferença ZERO — no comportamento
 * publicado (`3d86cbf`) e neste candidato.
 *
 * ⚠️ O QUE A CONFERÊNCIA CORRIGIU NA HIPÓTESE INICIAL. O diagnóstico de 15/09 atribuiu o
 * `peito 17` ao bloco adicional do foco. **Não é o caso deste relato.** O perfil real tem
 * `focoAgregado: { grupo: 'bracos' }` — não peito — e um DESENHO MANUAL salvo
 * (`rotinaCustom.origem === 'usuario'`) com série escolhida para cada exercício. O peito
 * chega a 17 porque `e130` e `e156` aparecem em DOIS dias do desenho da própria pessoa.
 * O app está certo ao dizer `acima_do_maximo`: ele não alterou nada, ele relatou.
 *
 * 🔒 Por isso este arquivo trava o comportamento nos dois sentidos: os números da captura E o
 * fato de que o candidato **não mexe** no desenho salvo para "consertar" o excesso.
 *
 * 🔒 PRIVACIDADE: nenhum identificador, e-mail ou preferência de dieta. Sexo, idade, altura e
 * peso estão nos valores neutros dos demais testes — medido: o placar de TREINO e os slots
 * entregues saem idênticos com os valores reais e com os neutros, então nada se perde.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { avaliarSemana, type DiaDoEditor } from './engine/critico';
import { unificarAvisos } from './avisos-unificados';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import type { PerfilResumo } from '@/components/painel/Painel';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

/** O desenho salvo, exatamente como está na conta (ids do catálogo, não dados pessoais). */
const ROTINA_CUSTOM = {
  origem: 'usuario',
  dias: [
    { diaId: 'seg', nome: 'Peito + Tríceps', exercicioIds: ['e130', 'e156', 'e55', 'e56', 'e100', 'e67', 'e69'],
      seriesPorExercicio: { e130: 4, e156: 3, e55: 3, e56: 3, e100: 3, e67: 4, e69: 4 } },
    { diaId: 'ter', nome: 'Costas + Bíceps', exercicioIds: ['e21', 'e22', 'e45', 'e46', 'e47', 'e72', 'e75'],
      seriesPorExercicio: { e21: 4, e22: 3, e45: 3, e46: 3, e47: 3, e72: 4, e75: 4 } },
    { diaId: 'qua', nome: 'Pernas', exercicioIds: ['e16', 'e26', 'e17', 'e64', 'e27', 'e147'],
      seriesPorExercicio: { e16: 4, e26: 4, e17: 4, e64: 4, e27: 4, e147: 4 } },
    { diaId: 'qui', nome: 'Ombros + Braços', exercicioIds: ['e156', 'e130', 'e54', 'e95', 'e111', 'e107', 'e68', 'e74', 'e114'],
      seriesPorExercicio: { e156: 2, e130: 2, e54: 3, e95: 4, e111: 3, e107: 3, e68: 4, e74: 4, e114: 3 } },
    { diaId: 'sex', nome: 'Complementares', exercicioIds: ['e36', 'e37', 'e38', 'e39', 'e158', 'e147'],
      seriesPorExercicio: { e36: 4, e37: 3, e38: 3, e39: 3, e158: 3, e147: 4 } },
  ],
};

const PERFIL = {
  sexo: 'masculino', idade: 30, alturaCm: 180, pesoKg: 80, nivelAtividade: 'moderado',
  objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia',
  equipamentosCasa: [], preferencia: null, alergenos: [], naoCurto: [], pratosCansados: [],
  favoritos: [], diasDisponiveis: 5, tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite',
  treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], divisaoPreferida: 'prioridades',
  modoForca: false, tecnicasAvancadas: false, cardioFavorito: 'pular_corda',
  mesocicloInicio: '2026-07-09', flagsSaude: SEM,
  focoAgregado: { grupo: 'bracos', semana: 1 },
  preferencias: { banidos: [], trocas: [
    { de: 'e14', para: 'e130' }, { de: 'e52', para: 'e53' }, { de: 'e53', para: 'e106' },
    { de: 'e106', para: 'e52' }, { de: 'e1', para: 'e156' },
  ] },
  rotinaCustom: ROTINA_CUSTOM,
} as unknown as PerfilResumo;

const OPC = { semanaCiclo: { semana: 1 }, diasOferecidosCardio: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] };
/** O placar da captura, lido da imagem. */
const CAPTURA = { peito: 17, costas: 12, quadriceps: 8, posterior: 4, gluteos: 4, ombros: 13 };

/** O caminho REAL da tela: plano → `doPlano` → prévia do desenho → crítico. */
function telaMontarMeuTreino(p: PerfilResumo = PERFIL) {
  const plano = recomputarPlano(p, OPC as never).treino.rotina!;
  const editaveis = doPlano(plano.dias, p.treinoDias ?? [], p.rotinaCustom, undefined);
  const previa = recomputarPlano({ ...p, rotinaCustom: paraRotinaCustom(editaveis) } as PerfilResumo, OPC as never).treino.rotina!;
  const dias: DiaDoEditor[] = previa.dias.map((d) => ({
    nome: d.nome, exercicios: d.slots.map((s) => s.exercicio), series: d.slots.map((s) => s.series),
    descansoSeg: d.slots.map((s) => s.descansoSeg), holdSeg: d.slots.map((s) => s.holdSeg),
    extraDoFoco: d.slots.map((s) => s.extraDoFoco),
  }));
  const avaliacao = avaliarSemana(dias, {
    nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite',
    treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], semana: 1,
    faixaSemanal: previa.faixaVolumeSemana, tetoVolumeSemana: previa.tetoVolumeSemana,
    faseVolume: previa.faseVolume,
  } as never);
  return { plano, previa, avaliacao };
}

const placarDe = (a: ReturnType<typeof telaMontarMeuTreino>['avaliacao']) =>
  Object.fromEntries(a.placar.map((l) => [l.grupo, l.ponderado]));

describe('🔴 o caso relatado — os seis números da captura', () => {
  it('o placar de "Sua semana" bate com a imagem, grupo a grupo', () => {
    expect(placarDe(telaMontarMeuTreino().avaliacao)).toMatchObject(CAPTURA);
  });

  // Decisão de 17/09: peito 17 ultrapassa o automático (16), mas não o teto (19).
  // O desenho manual permanece intacto. Os avisos por sessão usam a política atual.
  // Teto por sessão também diagnostica os demais grupos; não muda o desenho manual.
  it('o crítico mantém a orientação de peito e informa os quatro excessos por sessão', () => {
    const { avaliacao } = telaMontarMeuTreino();
    expect([...avaliacao.avisos, ...avaliacao.recomendacoes].map((x) => x.texto)).toEqual([
      'Peito está com 17 séries nesta semana: acima das 16 que o app usa quando monta sozinho, e ainda dentro do teto de 19. Se a escolha foi sua, ela vale — só acompanhe como você recupera.',
      'Peito soma 13 séries em Peito + Tríceps — acima das 12 por grupo num mesmo treino, contando o trabalho indireto. Distribuir parte delas em outro dia costuma caber melhor na recuperação.',
      'Bíceps soma 14 séries em Costas + Bíceps — acima das 12 por grupo num mesmo treino, contando o trabalho indireto. Distribuir parte delas em outro dia costuma caber melhor na recuperação.',
      'Ombros soma 13 séries em Ombros + Braços — acima das 12 por grupo num mesmo treino, contando o trabalho indireto. Distribuir parte delas em outro dia costuma caber melhor na recuperação.',
      'Panturrilhas soma 16 séries em Complementares — acima das 12 por grupo num mesmo treino, contando o trabalho indireto. Distribuir parte delas em outro dia costuma caber melhor na recuperação.',
      'Tente trocar 1 exercício de peito por 1 de posterior — assim a semana fica mais equilibrada entre os grupos.',
      'Posterior está abaixo da faixa mínima desta semana (4 de 10 séries).',
      'Glúteos está abaixo da faixa mínima desta semana (4 de 10 séries).',
      'Quadríceps está abaixo da faixa mínima desta semana (8 de 10 séries).',
    ]);
  });

  /** 🔒 A frase que o app NÃO pode dizer neste caso — a metade negativa da decisão. */
  it('nenhuma linha afirma que a pessoa ultrapassou o TETO: 17 está abaixo de 19', () => {
    const { avaliacao } = telaMontarMeuTreino();
    expect(avaliacao.avisos.some((a) => a.codigo === 'acima_do_maximo'), 'disse que passou do teto').toBe(false);
    const peito = avaliacao.placar.find((l) => l.grupo === 'peito')!;
    expect(peito.status).toBe('acima_do_automatico');
    expect([peito.maxAutomatico, peito.mrv]).toEqual([16, 19]);
  });
});

describe('🔑 a CAUSA: é o desenho da pessoa, não o bloco do foco', () => {
  it('o foco vigente é de BRAÇOS — peito não é grupo focado', () => {
    expect((PERFIL as unknown as { focoAgregado: { grupo: string } }).focoAgregado.grupo).toBe('bracos');
    expect((PERFIL as unknown as { foco?: unknown }).foco).toBeUndefined();
  });

  it('não há bloco adicional nenhum no plano: o caminho é o do desenho manual', () => {
    const { plano, previa } = telaMontarMeuTreino();
    expect(plano.blocoFoco).toBeUndefined();
    expect(previa.dias.flatMap((d) => d.slots).some((s) => s.extraDoFoco)).toBe(false);
  });

  it('o excesso de peito vem de DOIS dias do próprio desenho (e130 e e156 repetidos)', () => {
    const diasComPeito = ROTINA_CUSTOM.dias.filter((d) => d.exercicioIds.includes('e130') || d.exercicioIds.includes('e156'));
    expect(diasComPeito.map((d) => d.diaId)).toEqual(['seg', 'qui']);
  });
});

describe('🔒 o candidato NÃO mexe no desenho salvo para esconder o excesso', () => {
  it('cada série escolhida sobrevive exatamente como está na conta', () => {
    const { previa } = telaMontarMeuTreino();
    for (const dia of previa.dias) {
      const salvo = ROTINA_CUSTOM.dias.find((d) => d.diaId === dia.diaId)!;
      for (const slot of dia.slots) {
        const escolhida = (salvo.seriesPorExercicio as unknown as Record<string, number>)[slot.exercicio.id];
        if (escolhida == null) continue;
        expect(slot.series, `${dia.diaId}/${slot.exercicio.id}`).toBe(escolhida);
        expect(slot.seriesDefinidasPeloUsuario).toBe(true);
      }
    }
  });

  it('a poda do MRV não age aqui — não há dose do app para corrigir', () => {
    const { previa } = telaMontarMeuTreino();
    expect(previa.avisos.some((a) => a.includes('para não passar do máximo desta semana'))).toBe(false);
  });

  it('e o excesso continua DITO, pelo crítico, com os DOIS números', () => {
    const { avaliacao } = telaMontarMeuTreino();
    // 🔵 Agora como orientação (`acima_do_maximo_automatico`), com 16 e 19 na mesma frase.
    // 🔒 Ela vive em `avisos` (é fato sobre um limite, como `acima_do_maximo`), mas com
    // severidade de RECOMENDAÇÃO — a tela a pinta de âmbar, não de vermelho.
    const linha = avaliacao.avisos.find((a) => a.codigo === 'acima_do_maximo_automatico');
    expect(linha, `avisos: ${avaliacao.avisos.map((r) => r.codigo).join(', ')}`).toBeDefined();
    expect(linha!.texto).toContain('17 séries');
    expect(linha!.texto).toContain('16');
    expect(linha!.texto).toContain('19');
    expect(linha!.severidade, 'orientação, não risco — e nada trava').toBe('recomendacao');
    // Teto por sessão: peito, bíceps, ombros e panturrilha, com as séries manuais intactas.
    expect(avaliacao.avisos.filter((a) => a.codigo === 'acima_do_maximo_na_sessao')).toHaveLength(4);
  });
});

describe('🔒 nenhuma mensagem duplicada nesta tela', () => {
  it('os déficits que o crítico diz com número saem uma vez só', () => {
    const { previa, avaliacao } = telaMontarMeuTreino();
    const u = unificarAvisos(previa, avaliacao);
    expect(u.avisosMotor.some((a) => a.includes('ficou abaixo do mínimo desta semana')), 'déficit dito duas vezes').toBe(false);
    // ⚠️ ANTI-VACUIDADE: o motor precisa MESMO ter emitido, senão nada foi deduplicado.
    /**
     * 🔵 3 e não 4 desde 2026-09-17: `costas` (12 ponderadas) deixou de ser déficit porque o
     * piso da faixa desejada caiu de 13 para 10. Os três que sobram — posterior, glúteos e
     * quadríceps — continuam sendo ditos uma vez só, que é o que este caso protege.
     */
    expect(u.suprimidos.length, 'nada foi suprimido — o caso deixou de exercitar a conciliação').toBeGreaterThanOrEqual(3);
    expect(u.suprimidos.map((s) => s.aviso).join(' ')).toMatch(/posterior/);
  });

  it('não sobra fala do motor sobre puxar ≥ empurrar: o desenho está equilibrado', () => {
    const { previa, avaliacao } = telaMontarMeuTreino();
    expect(avaliacao.medidas.puxarEmpurrar.puxar).toBeGreaterThanOrEqual(avaliacao.medidas.puxarEmpurrar.empurrar);
    expect(unificarAvisos(previa, avaliacao).avisosMotor.some((a) => a.includes('volume de puxar ficou abaixo'))).toBe(false);
  });
});
