/**
 * 🔒 O CAMINHO REAL DO PLANO — guards sobre `recomputarPlano`, não sobre `montarRotina`.
 *
 * 🔑 Por que existe (validação do autor, 2026-08-15): quatro defeitos relatados na TELA
 * (foco polvilhando peito nos 6 dias; troca aplicando outro exercício; biblioteca não
 * aplicando; foco sem voltar a "Nenhum"). Todos foram MEDIDOS aqui, no caminho que o app
 * chama de verdade — `recomputarPlano` (session → plano → gerarTreino → montarRotina) — e
 * NENHUM se reproduz no código de `main`. O sintoma do D1 (peito +6 slots, o slot extra
 * saindo de bíceps/panturrilha/tríceps) é EXATAMENTE o boost pré-cascata removido em
 * `0d8f392` — comportamento de um build ANTIGO, não do código atual.
 *
 * A lição do B3: aquele guard ancorava em `montarRotina` e ficou verde — porque o código
 * está certo. O que faltava era guardar o CAMINHO REAL. É o que este arquivo faz: se um dia
 * o boost polvilhador voltar por qualquer caminho, ou a troca deixar de pousar no slot, ou o
 * "Nenhum" não voltar ao base, o gate fica VERMELHO aqui.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { avaliarTroca } from './engine/preferencias';
import { EXERCISES } from './data/exercises';
import type { PerfilResumo } from '@/components/painel/Painel';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const perfil = (over: Partial<PerfilResumo> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, alergenos: [], preferencia: 'onivoro', naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'avancado', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 6, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], ...over,
}) as PerfilResumo;
const SEMANA = { semanaCiclo: { semana: 3 } as never };
const rotina = (p: PerfilResumo) => recomputarPlano(p, SEMANA).treino.rotina!;
const seriesPorGrupo = (r: ReturnType<typeof rotina>) => {
  const m = new Map<string, number>();
  for (const d of r.dias) for (const s of d.slots) { const g = s.exercicio.grupoPrimario; if (g) m.set(g, (m.get(g) ?? 0) + (s.series ?? 0)); }
  return m;
};
const diasComGrupo = (r: ReturnType<typeof rotina>, g: string) => r.dias.filter((d) => d.slots.some((s) => s.exercicio.grupoPrimario === g)).length;
const assinatura = (r: ReturnType<typeof rotina>) => r.dias.map((d) => d.slots.map((s) => s.exercicio.id).join(',')).join('|');

describe('🔴 D1 — o foco no caminho real é a CASCATA (não o boost polvilhador)', () => {
  const sem = rotina(perfil());
  const com = rotina(perfil({ foco: { grupo: 'peito', compensa: 'ombros', semana: 1 } as never }));
  const a = seriesPorGrupo(sem); const b = seriesPorGrupo(com);

  it('peito NÃO é polvilhado: fica nos MESMOS dias de antes (não entra nos 6)', () => {
    expect(diasComGrupo(com, 'peito'), 'peito espalhou por mais dias — é o boost pré-cascata').toBe(diasComGrupo(sem, 'peito'));
  });

  it('NENHUM terceiro paga: só o par peito↔ombros muda', () => {
    const mexidos = [...new Set([...a.keys(), ...b.keys()])].filter((g) => (a.get(g) ?? 0) !== (b.get(g) ?? 0));
    expect(mexidos.sort(), `grupos alterados: ${mexidos.join(', ')}`).toEqual(['ombros', 'peito']);
  });

  it('nenhum grupo é ZERADO pelo foco (bíceps/panturrilha/tríceps intactos)', () => {
    for (const g of ['biceps', 'panturrilha', 'triceps'] as const) {
      expect(b.get(g) ?? 0, `${g} foi a zero — assinatura do boost polvilhador`).toBe(a.get(g) ?? 0);
      expect(b.get(g) ?? 0).toBeGreaterThan(0);
    }
  });

  it('o total da semana CONSERVA (o foco redistribui, não cresce)', () => {
    const tot = (m: Map<string, number>) => [...m.values()].reduce((x, y) => x + y, 0);
    expect(tot(b)).toBe(tot(a));
  });

  it('a saída carrega o ramo do foco (a frase da tela tem de onde sair)', () => {
    expect(com.foco, 'sem foco na saída, a tela não tem frase para mostrar').toBeTruthy();
    expect(com.foco!.degrau).toBeTruthy();
    expect(com.foco!.motivo).toBeTruthy();
  });
});

describe('🔴 D2/D3 — a troca escolhida ENTRA (id, nunca índice entre listas)', () => {
  it('a preferência {de,para} coloca `para` no slot tocado e remove `de`', () => {
    const base = rotina(perfil());
    let alvo: { di: number; si: number; de: string } | null = null;
    base.dias.forEach((d, di) => d.slots.forEach((s, si) => { if (!alvo && s.exercicio.grupoPrimario === 'costas') alvo = { di, si, de: s.exercicio.id }; }));
    expect(alvo, 'nenhum slot de costas no plano base').toBeTruthy();
    const { di, si, de } = alvo!;
    // um costas do mesmo padrão, disponível — a troca válida que a biblioteca ou as 3 sugestões dariam
    const deEx = EXERCISES.find((e) => e.id === de)!;
    const para = EXERCISES.find((e) => e.grupoPrimario === 'costas' && e.padraoMovimento === deEx.padraoMovimento && e.id !== de && e.local !== 'casa_sem')!;
    expect(avaliarTroca({ exercises: EXERCISES, equipamento: 'academia', nivelExperiencia: 'avancado' }, { de, para: para.id }).aceita).toBe(true);
    const com = rotina(perfil({ preferencias: { trocas: [{ de, para: para.id }], banidos: [] } as never }));
    expect(com.dias[di]!.slots[si]!.exercicio.id, 'o slot tocado NÃO mostra o escolhido').toBe(para.id);
    expect(com.dias.some((d) => d.slots.some((s) => s.exercicio.id === de)), '`de` continuou no plano').toBe(false);
  });
});

describe('🟠 D4 — "Nenhum" volta ao plano base', () => {
  it('foco=undefined ⇒ plano IDÊNTICO ao de quem nunca focou', () => {
    const base = rotina(perfil());
    const desmarcado = rotina(perfil({ foco: undefined }));
    expect(assinatura(desmarcado)).toBe(assinatura(base));
    expect(desmarcado.foco ?? null).toBeNull();
  });

  it('sanidade: com foco o plano MUDA (senão o teste acima seria vácuo)', () => {
    const base = rotina(perfil());
    const com = rotina(perfil({ foco: { grupo: 'peito', compensa: 'ombros', semana: 1 } as never }));
    expect(seriesPorGrupo(com).get('peito')).toBeGreaterThan(seriesPorGrupo(base).get('peito') ?? 0);
  });
});
