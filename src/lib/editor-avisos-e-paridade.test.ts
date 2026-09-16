/**
 * 🔒 O EDITOR DIZ O QUE O MOTOR EXPLICA — e devolve o mesmo treino.
 *
 * 🔑 Dois defeitos do relato de 2026-09-15, medidos em `3d86cbf`:
 *  · o corte por tempo era declarado pelo motor ("Para caber em 30 min, reduzimos séries…
 *    em 6 exercícios") e renderizado SÓ na aba do plano; em "Montar meu treino" o mesmo
 *    déficit aparecia sem causa nenhuma;
 *  · e como o editor não recebia `semana`, o fato do crítico nunca casava com o do motor —
 *    a conciliação D16 (`unificarAvisos`) não teria como suprimir a duplicata ali.
 *
 * 🔒 O que este arquivo também trava: abrir o editor SEM editar devolve o MESMO plano —
 * mesmos dias, ids, ordem e séries —, e salvar/reabrir não acumula perda nem deload duplo.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { recomputarPlano } from './plano';
import { avaliarSemana, type DiaDoEditor } from './engine/critico';
import { unificarAvisos } from './avisos-unificados';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { RotinaSemanal } from './engine/treino-types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilResumo> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, alergenos: [], preferencia: 'onivoro', naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'intermediario', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 4, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], ...over,
}) as PerfilResumo;

const gerar = (p: PerfilResumo, opcoes: unknown) => recomputarPlano(p, opcoes as never).treino.rotina!;

/** `preverPlano` do Painel, reproduzido pelo mesmo caminho (recompute com `rotinaCustom`). */
function preverPlano(p: PerfilResumo, dias: ReturnType<typeof doPlano>, opcoes: unknown) {
  const rotinaCustom = paraRotinaCustom(dias);
  if (rotinaCustom.dias.length === 0) return { dias: [] as DiaDoEditor[], avisos: [] as string[], rotina: undefined };
  const r = gerar({ ...p, rotinaCustom } as PerfilResumo, opcoes);
  return {
    dias: r.dias.map((d) => ({
      nome: d.nome, exercicios: d.slots.map((s) => s.exercicio), series: d.slots.map((s) => s.series),
      descansoSeg: d.slots.map((s) => s.descansoSeg), holdSeg: d.slots.map((s) => s.holdSeg),
    })) as DiaDoEditor[],
    avisos: r.avisos,
    rotina: r,
  };
}

const porSlot = (r: RotinaSemanal) =>
  r.dias.map((d) => `${d.diaId}/${d.nome}:${d.slots.map((s) => `${s.exercicio.id}x${s.series}`).join(',')}`);

describe('🔒 abrir o editor SEM editar devolve o MESMO treino', () => {
  const CASOS = [
    { nome: 'rampa S1', opcoes: { semanaCiclo: { semana: 1 } }, over: {} },
    { nome: 'rampa S3 com foco', opcoes: { semanaCiclo: { semana: 3 } }, over: { foco: { grupo: 'peito', compensa: 'ombros', semana: 3 } } },
    { nome: 'deload S6', opcoes: { semanaCiclo: { semana: 6 } }, over: {} },
    { nome: 'tempo curto 30 min', opcoes: { semanaCiclo: { semana: 3 } }, over: { tempoPorSessaoMin: 30 } },
    { nome: 'retomada rampa 1', opcoes: { semanaCiclo: { semana: 1, retomada: { semana: 1, fator: 0.5, volumeReferencia: 16 } } }, over: {} },
  ] as const;

  for (const c of CASOS) {
    it(`${c.nome}: dias, ids, ordem e séries idênticos`, () => {
      const p = perfil(c.over as never);
      const antes = gerar(p, c.opcoes);
      const editaveis = doPlano(antes.dias, p.treinoDias ?? [], undefined, (c.opcoes as never as { semanaCiclo?: { retomada?: never } }).semanaCiclo?.retomada);
      const depois = preverPlano(p, editaveis, c.opcoes).rotina!;
      expect(antes.dias.flatMap((d) => d.slots).length, 'plano vazio não prova paridade').toBeGreaterThan(5);
      expect(porSlot(depois)).toEqual(porSlot(antes));
    });
  }

  it('salvar e reabrir não acumula perda de séries nem deload duplicado', () => {
    const p = perfil();
    const opcoes = { semanaCiclo: { semana: 6 } };
    let rotina = gerar(p, opcoes);
    const inicial = porSlot(rotina);
    let perfilAtual = p;
    for (let volta = 0; volta < 3; volta += 1) {
      const editaveis = doPlano(rotina.dias, perfilAtual.treinoDias ?? [], perfilAtual.rotinaCustom, undefined);
      const rotinaCustom = paraRotinaCustom(editaveis);
      perfilAtual = { ...perfilAtual, rotinaCustom } as PerfilResumo;
      rotina = gerar(perfilAtual, opcoes);
      expect(porSlot(rotina), `volta ${volta + 1}: o plano encolheu ao reabrir`).toEqual(inicial);
    }
  });
});

describe('🔴 o editor mostra o que o motor explica', () => {
  /**
   * ⚠️ LIMITE DECLARADO, não defeito: a linha "Para caber em 30 min, reduzimos séries…" é do
   * ramo AUTOMÁTICO. A prévia do editor roda o desenho como `rotinaCustom`, e o contrato
   * vigente é que o manual **nunca** passa por reduce-to-fit — então naquele plano nada está
   * sendo reduzido, e repetir a frase ali seria afirmar o que não aconteceu. O que chega, e é
   * o que este caso cobra, são as explicações verdadeiras DAQUELE desenho: cobertura ausente,
   * sessão curta, fase de recuperação, e o déficit sem eco duplicado.
   */
  it('tempo curto: as explicações VERDADEIRAS do desenho chegam à lista unificada', () => {
    const p = perfil({ tempoPorSessaoMin: 30 } as never);
    const opcoes = { semanaCiclo: { semana: 3 } };
    const antes = gerar(p, opcoes);
    const editaveis = doPlano(antes.dias, p.treinoDias ?? [], undefined, undefined);
    const previsao = preverPlano(p, editaveis, opcoes);
    const avaliacao = avaliarSemana(previsao.dias, {
      semana: 3, nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 30, limiteTempoTreino: 'limitado',
      faixaSemanal: previsao.rotina!.faixaVolumeSemana!, faseVolume: previsao.rotina!.faseVolume!,
    });
    const { avisosMotor, suprimidos } = unificarAvisos(
      { avisos: previsao.avisos, fatosCobertura: previsao.rotina!.fatosCobertura },
      avaliacao,
    );
    expect(avisosMotor.some((a) => /Cobertura direta ausente/.test(a)), 'a explicação de cobertura não chega ao editor').toBe(true);
    expect(avisosMotor.length, 'o editor ficou sem nenhuma explicação do motor').toBeGreaterThan(0);
    /**
     * 🔒 UMA VOZ POR FATO — e por TODOS os fatos, não por alguns.
     *
     * ⚠️ A versão anterior deste caso exigia só `suprimidos.length > 0` e passava com 2 de 6
     * deduplicados: o QA achou costas, quadríceps, glúteos e ombros DUAS vezes na tela, uma
     * com número e outra sem. A causa era o `valor` do motor medido antes da dose manual. A
     * exigência agora é total, e por isso o defeito não volta em silêncio.
     */
    const doOrcamento = (previsao.rotina!.fatosCobertura ?? []).filter((f) => f.causa === 'orcamento');
    expect(doOrcamento.length, 'sem fato de orçamento nada é provado aqui').toBeGreaterThan(0);
    expect(suprimidos.map((s) => s.aviso).sort(), 'algum eco do motor sobreviveu ao lado do crítico')
      .toEqual(doOrcamento.map((f) => f.aviso).sort());
    for (const s of suprimidos) expect(avisosMotor).not.toContain(s.aviso);
    // e nenhuma linha do motor repete um grupo que o crítico já nomeou com números
    for (const rec of avaliacao.recomendacoes) {
      if (!rec.fato) continue;
      expect(avisosMotor.some((a) => a.includes(rec.fato!.grupo)),
        `${rec.fato.grupo} aparece duas vezes: no crítico e no motor`).toBe(false);
    }
    // e o plano AUTOMÁTICO, esse sim, carrega a frase do reduce-to-fit (o limite é do manual)
    expect(antes.avisos.some((a) => /Para caber em 30 min/.test(a))).toBe(true);
  });

  it('DELOAD: a redução planejada é explicada e o crítico não a chama de déficit', () => {
    const p = perfil();
    const opcoes = { semanaCiclo: { semana: 6 } };
    const antes = gerar(p, opcoes);
    const editaveis = doPlano(antes.dias, p.treinoDias ?? [], undefined, undefined);
    const previsao = preverPlano(p, editaveis, opcoes);
    const avaliacao = avaliarSemana(previsao.dias, {
      semana: 6, nivel: 'intermediario', objetivo: 'massa', tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado',
      faixaSemanal: previsao.rotina!.faixaVolumeSemana!, faseVolume: previsao.rotina!.faseVolume!,
    });
    expect(avaliacao.recomendacoes.filter((i) => i.codigo === 'grupo_abaixo_do_minimo')).toEqual([]);
    const { avisosMotor } = unificarAvisos({ avisos: previsao.avisos }, avaliacao);
    expect(avisosMotor.length, 'o editor ficaria sem explicação nenhuma na semana de alívio').toBeGreaterThan(0);
  });

  it('entrega PARCIAL do foco: a recusa pelo teto é explicada', () => {
    const p = perfil({ tempoPorSessaoMin: 75, foco: { grupo: 'peito', compensa: 'ombros', semana: 5 } } as never);
    const opcoes = { semanaCiclo: { semana: 5 } };
    const r = gerar(p, opcoes);
    expect(r.blocoFoco?.solicitados, 'sem intenção de bloco não há entrega parcial a explicar').toBeGreaterThan(0);
    if ((r.blocoFoco?.adicionais ?? []).length < (r.blocoFoco?.solicitados ?? 0)) {
      expect(r.avisos.some((a) => /m[áa]ximo do seu n[íi]vel/.test(a))).toBe(true);
    }
  });
});

describe('🔒 a fiação do editor (guards de fonte)', () => {
  const editor = readFileSync('src/components/painel/EditorTreino.tsx', 'utf8');
  const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');

  it('a lista do motor passa por `unificarAvisos` — não é um segundo sistema de avisos', () => {
    expect(editor).toMatch(/unificarAvisos\(/);
    expect(editor).toMatch(/<AvisosDoMotorNoEditor avisos=\{avisosMotor\}/);
  });

  it('os avisos são recalculados junto da prévia (nunca fala velha depois de editar)', () => {
    expect(editor).toMatch(/useMemo\(\s*\(\) => unificarAvisos\(/);
    expect(editor).toMatch(/\[previsao, avaliacao\]/);
  });

  it('o Painel entrega semana, faixa e fase ao editor', () => {
    expect(painel).toMatch(/semana=\{ciclo\.semanaEfetiva\}/);
    expect(painel).toMatch(/faixaVolumeSemana: nt\.rotina\.faixaVolumeSemana/);
    expect(painel).toMatch(/faseVolume: nt\.rotina\.faseVolume/);
  });

  it('o crítico do plano salvo usa a MESMA faixa/fase do motor', () => {
    expect(painel).toMatch(/faixaSemanal: treino\.rotina\.faixaVolumeSemana/);
    expect(painel).toMatch(/faseVolume: treino\.rotina\.faseVolume/);
  });

  it('nenhum bloqueio novo de salvamento entrou com a mudança', () => {
    const salvar = editor.slice(editor.indexOf('onSalvar('));
    expect(salvar.slice(0, 400)).not.toMatch(/avisosMotor|bloqueia|disabled=\{avis/);
  });
});
