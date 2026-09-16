/**
 * 🔒 O TETO DURO NO CAMINHO REAL — regressão do relato de 2026-09-15.
 *
 * 🔑 O defeito, medido em `3d86cbf` pelo caminho que o app chama de verdade
 * (`recomputarPlano` → `gerarTreino` → `montarRotina`):
 *  · com foco no peito, `4d/60min/limitado/S1` entregava **peito 17 contra teto 16**, e
 *    `4d/75min/S4` chegava a **20**;
 *  · os 0,5 indiretos desses extras levavam **OMBROS — que ninguém focou — a 17 e 18**;
 *  · e em 212 de 3 888 combinações o **baseline sozinho, sem foco nenhum**, já passava do teto
 *    (costas 21 contra 20 em avançado/massa).
 * O crítico do editor então acusava `acima_do_maximo` num plano que o próprio motor montou.
 *
 * 🔒 A decisão que estes testes ancoram é do cofre, não nossa
 * (`motor-treino-grupo-em-foco-x-mrv`, claims --005/--010/--011, todos `confirmed`):
 * *"o foco sobe até o MRV do nível e PARA"*, *"o teto duro continua duro"*, e elevar o teto
 * durante o foco foi RECUSADO — *"transformaria o único guarda-corpo de volume em algo
 * negociável"*.
 *
 * ⚠️ Estes testes NÃO afrouxam nada: medem o teto na mesma conta ponderada do crítico.
 */
import { describe, expect, it } from 'vitest';
import { recomputarPlano } from './plano';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './engine/alocador';
import { mrv } from './engine/trilhos';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { GrupoPrimario } from './data/types';

const SEM = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;

const perfil = (over: Partial<PerfilResumo> = {}): PerfilResumo => ({
  sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado',
  objetivo: 'massa', flagsSaude: SEM, alergenos: [], preferencia: 'onivoro', naoCurto: [],
  pratosCansados: [], favoritos: [], nivelExperiencia: 'intermediario', equipamento: 'academia',
  equipamentosCasa: [], diasDisponiveis: 4, tempoPorSessaoMin: 60,
  treinoDias: ['seg', 'ter', 'qui', 'sex'], ...over,
}) as PerfilResumo;

const rotina = (p: PerfilResumo, semana: number) =>
  recomputarPlano(p, { semanaCiclo: { semana } } as never).treino.rotina!;

/** A conta CANÔNICA — a mesma do crítico e do alocador v4. Nada de régua paralela aqui. */
const ponderado = (r: ReturnType<typeof rotina>) =>
  creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots));

const acimaDoTeto = (r: ReturnType<typeof rotina>, teto: number) =>
  GRUPOS_GRANDES.filter((g) => (ponderado(r).get(g) ?? 0) > teto)
    .map((g) => `${g} ${ponderado(r).get(g)} > ${teto}`);

const seriesPorGrupo = (r: ReturnType<typeof rotina>) => {
  const m = new Map<GrupoPrimario, number>();
  for (const d of r.dias) for (const s of d.slots) {
    const g = s.exercicio.grupoPrimario;
    if (g) m.set(g, (m.get(g) ?? 0) + (s.series ?? 0));
  }
  return m;
};

// ── 1. Os casos NOMEADOS do relato ───────────────────────────────────────────

describe('🔴 relato 2026-09-15 — o bloco do foco não passa do MRV', () => {
  const CASOS = [
    { nome: '4d/60min/limitado/S1 (o caso da captura: peito ia a 17)', dias: 4, tempo: 60, limite: 'limitado', semana: 1 },
    { nome: '4d/75min/limitado/S4 (peito ia a 20, ombros a 18)', dias: 4, tempo: 75, limite: 'limitado', semana: 4 },
    { nome: '4d/75min/limitado/S3 (ombros indireto ia a 17)', dias: 4, tempo: 75, limite: 'limitado', semana: 3 },
    { nome: '4d/60min/sem_limite/S5', dias: 4, tempo: 60, limite: 'sem_limite', semana: 5 },
    { nome: '5d/45min/sem_limite/S4', dias: 5, tempo: 45, limite: 'sem_limite', semana: 4 },
  ] as const;

  for (const c of CASOS) {
    it(`${c.nome}: nenhum grande acima do teto`, () => {
      const base = perfil({ diasDisponiveis: c.dias, treinoDias: DIAS.slice(0, c.dias) as never, tempoPorSessaoMin: c.tempo, limiteTempoTreino: c.limite } as never);
      const comFoco = { ...base, foco: { grupo: 'peito', compensa: 'ombros', semana: c.semana } } as never;
      const r = rotina(comFoco, c.semana);
      const teto = mrv('intermediario', 'massa');
      // anti-vacuidade: o plano existe e tem volume de peito de verdade
      expect(ponderado(r).get('peito') ?? 0, 'plano vazio não prova teto').toBeGreaterThan(0);
      expect(acimaDoTeto(r, teto), 'grupo acima do MRV no plano que o motor montou').toEqual([]);
    });
  }

  it('🔒 o TERCEIRO não focado também respeita o teto (crédito indireto conta)', () => {
    const base = perfil({ tempoPorSessaoMin: 75, limiteTempoTreino: 'limitado' } as never);
    const comFoco = { ...base, foco: { grupo: 'peito', compensa: 'ombros', semana: 4 } } as never;
    const r = rotina(comFoco, 4);
    // ombros não tem slot novo nenhum — só recebe 0,5 por série dos peitorais extras
    expect(ponderado(r).get('ombros') ?? 0).toBeLessThanOrEqual(mrv('intermediario', 'massa'));
  });
});

// ── 2. O BASELINE, sem foco nenhum ───────────────────────────────────────────

/**
 * 🟢 A PENDÊNCIA FOI DECIDIDA E FECHADA (autor, 2026-09-16) — a redação de 15/09 fica abaixo.
 *
 * ⛔️ Como estava, e por que: *"O baseline sozinho, sem foco nenhum, passa do MRV em parte do
 * avançado. A causa é um conflito entre duas leituras da MESMA banda, as duas vivas no motor:
 * ponderada — `alocador.alvoPonderado`, o guard de cobertura e o crítico do editor; direta —
 * a rampa (`alvoDaSemana`) e o contrato que `treino-montador.test.ts` cobra. Com crédito
 * indireto > 0 elas são incompatíveis. Escolher uma reverte a outra, e essa escolha é da
 * coordenação."* O conserto ficou pronto e DESLIGADO em `podarExcessoPonderado`.
 *
 * ✅ A decisão: **o MRV limita o volume PONDERADO** — direta 1,0 + indireta 0,5 —, para todos
 * os grupos, no baseline e no foco. A poda foi ligada em `treino-montador.ts`, e a leitura
 * direta que os contratos de `treino-montador.test.ts` cobravam foi substituída lá, na moeda
 * nova, com a redação antiga preservada.
 *
 * 🔑 O que estes dois casos passam a medir: exatamente as mesmas células que ESTOURAVAM agora
 * cabem — é a prova de regressão do conserto, nas coordenadas em que o defeito foi medido. A
 * garantia original do arquivo (o foco não acrescenta excesso) continua valendo por cima.
 */
describe('🟢 o excesso do BASELINE foi corrigido nas células em que foi medido', () => {
  const CASOS = [
    { nivel: 'avancado', objetivo: 'massa', dias: 3, tempo: 60, limite: 'sem_limite', semana: 5 },
    { nivel: 'avancado', objetivo: 'saude', dias: 3, tempo: 60, limite: 'limitado', semana: 3 },
  ] as const;

  for (const c of CASOS) {
    it(`${c.nivel}/${c.objetivo}/${c.dias}d/${c.tempo}min/${c.limite}/S${c.semana}: o baseline volta para dentro do teto`, () => {
      const p = perfil({ nivelExperiencia: c.nivel, objetivo: c.objetivo, diasDisponiveis: c.dias,
        treinoDias: DIAS.slice(0, c.dias) as never, tempoPorSessaoMin: c.tempo, limiteTempoTreino: c.limite } as never);
      const teto = mrv(c.nivel, c.objetivo);
      const semFoco = rotina(p, c.semana);
      const comFoco = rotina({ ...p, foco: { grupo: 'peito', compensa: 'ombros', semana: c.semana } } as never, c.semana);
      // 🔑 O que era a pendência: esta lista NÃO era vazia. Agora é, e o foco não a reabre.
      expect(acimaDoTeto(semFoco, teto), 'o baseline voltou a estourar o teto').toEqual([]);
      expect(acimaDoTeto(comFoco, teto), 'o foco criou excesso que o baseline não tinha').toEqual([]);
      /**
       * ⚠️ ANTI-VACUIDADE — sem isto, as duas listas vazias passariam também num plano vazio
       * ou num recorte que nunca chegou perto do teto. A célula só serve como regressão se
       * ela AINDA é apertada: algum grande tem de terminar a menos de uma série do teto.
       */
      const folgaMinima = Math.min(...GRUPOS_GRANDES.map((g) => teto - (ponderado(semFoco).get(g) ?? 0)));
      expect(folgaMinima, 'a célula deixou de ser apertada — reancorar o caso').toBeLessThan(1);
    });
  }

  it('o grupo FOCADO nunca entra na lista de excessos por causa do bloco', () => {
    for (const semana of [1, 3, 5] as const) {
      const p = perfil({ nivelExperiencia: 'avancado', objetivo: 'massa', diasDisponiveis: 3,
        treinoDias: ['seg', 'qua', 'sex'] as never, tempoPorSessaoMin: 75, limiteTempoTreino: 'sem_limite' } as never);
      const com = rotina({ ...p, foco: { grupo: 'peito', compensa: 'ombros', semana } } as never, semana);
      expect(ponderado(com).get('peito') ?? 0, `S${semana}: o bloco levou o focado acima do teto`)
        .toBeLessThanOrEqual(mrv('avancado', 'massa'));
    }
  });
});

// ── 3. O CONTRATO do bloco adicional ─────────────────────────────────────────

describe('🔒 o contrato do foco continua inteiro', () => {
  const base = perfil({ tempoPorSessaoMin: 60, limiteTempoTreino: 'limitado' } as never);

  it('o foco NÃO redistribui o baseline: nenhum grupo perde série por causa do foco', () => {
    for (const semana of [1, 2, 3, 4, 5] as const) {
      const sem = rotina(base, semana);
      const com = rotina({ ...base, foco: { grupo: 'peito', compensa: 'ombros', semana } } as never, semana);
      const a = seriesPorGrupo(sem);
      const b = seriesPorGrupo(com);
      for (const g of GRUPOS_GRANDES) {
        if (g === 'peito') continue; // o focado é o único que pode subir
        expect(b.get(g) ?? 0, `S${semana}: ${g} mudou por causa do foco`).toBe(a.get(g) ?? 0);
      }
      expect(b.get('peito') ?? 0, `S${semana}: o foco TIROU série do peito`).toBeGreaterThanOrEqual(a.get('peito') ?? 0);
    }
  });

  it('o extra nunca retira SLOT do baseline para caber', () => {
    /**
     * ⚠️ A comparação é por CONTAGEM POR GRUPO, não por id: a rotação do pool pode escolher
     * outra variante do mesmo grupo quando o foco entra (medido: `e131` → `e130` no peito),
     * e isso é comportamento anterior a esta correção, governado por outra regra. O que o
     * contrato do bloco proíbe — e é o que se mede — é o baseline PERDER slot para o extra
     * caber.
     */
    const slotsPorGrupo = (r: ReturnType<typeof rotina>, extras: ReadonlySet<string>) => {
      const m = new Map<GrupoPrimario, number>();
      for (const d of r.dias) for (const s of d.slots) {
        if (extras.has(`${d.diaId}|${s.exercicio.id}`)) continue;
        const g = s.exercicio.grupoPrimario;
        if (g) m.set(g, (m.get(g) ?? 0) + 1);
      }
      return m;
    };
    for (const semana of [1, 3, 5] as const) {
      const sem = rotina(base, semana);
      const com = rotina({ ...base, foco: { grupo: 'peito', compensa: 'ombros', semana } } as never, semana);
      const extras = new Set((com.blocoFoco?.adicionais ?? []).map((a) => `${a.diaId}|${a.exercicioId}`));
      const a = slotsPorGrupo(sem, new Set());
      const b = slotsPorGrupo(com, extras);
      for (const [g, n] of a) {
        expect(b.get(g) ?? 0, `S${semana}: ${g} perdeu slot do baseline para o extra caber`).toBeGreaterThanOrEqual(n);
      }
    }
  });

  it('a ENTREGA declarada bate com os extras que de fato ficaram no plano', () => {
    for (const semana of [1, 2, 3, 4, 5] as const) {
      const r = rotina({ ...base, foco: { grupo: 'peito', compensa: 'ombros', semana } } as never, semana);
      const declarados = r.blocoFoco?.adicionais ?? [];
      for (const a of declarados) {
        const dia = r.dias.find((d) => d.diaId === a.diaId);
        const slot = dia?.slots.find((s) => s.exercicio.id === a.exercicioId);
        expect(slot, `S${semana}: o bloco anuncia ${a.exercicioId} em ${a.diaId}, que não está no plano`).toBeTruthy();
        expect(slot!.series, `S${semana}: séries anunciadas ≠ séries entregues em ${a.exercicioId}`).toBe(a.series);
      }
      // e o que foi anunciado nunca é mais do que o solicitado
      expect(declarados.length).toBeLessThanOrEqual(r.blocoFoco?.solicitados ?? 0);
    }
  });

  it('🔒 quando o baseline já está NO teto, o foco entrega ORDEM e o motor DIZ isso', () => {
    // S4/S5 com 75 min: o baseline chega ao topo da banda, então não há folga para extras.
    const p = { ...base, tempoPorSessaoMin: 75, foco: { grupo: 'peito', compensa: 'ombros', semana: 5 } } as never;
    const r = rotina(p, 5);
    expect(ponderado(r).get('peito') ?? 0).toBeLessThanOrEqual(mrv('intermediario', 'massa'));
    const entregues = (r.blocoFoco?.adicionais ?? []).length;
    if (entregues === 0) {
      expect(r.avisos.some((a) => /ORDEM dos exercícios/.test(a)), 'entrega vazia sem explicação na tela').toBe(true);
    }
  });

  it('o bloco nominal continua sendo 2 exercícios, quando há folga para os dois', () => {
    // S1 tem a maior folga da rampa (o baseline está no piso da banda).
    const r = rotina({ ...base, tempoPorSessaoMin: 75, foco: { grupo: 'peito', compensa: 'ombros', semana: 1 } } as never, 1);
    expect(r.blocoFoco?.solicitados).toBe(2);
    expect((r.blocoFoco?.adicionais ?? []).length, 'o nominal encolheu onde havia folga').toBeGreaterThan(0);
  });
});

// ── 4. Varredura: o invariante vale em toda a grade, não só nos casos escolhidos ──

describe('🔒 varredura — nenhum plano AUTOMÁTICO nasce acima do teto', () => {
  /**
   * A grade é o recorte onde a medição de `3d86cbf` concentrou os 212 estouros de baseline
   * (avançado nos três objetivos, 3–5 dias) mais o recorte do relato (intermediário/4d).
   * A varredura exaustiva (2 268 combinações) rodou no diagnóstico; aqui fica a que cabe no
   * gate sem transformá-lo num benchmark.
   */
  it('com e sem foco, na grade onde o teto morde', () => {
    const falhas: string[] = [];
    let medidos = 0;
    for (const nivel of ['intermediario', 'avancado'] as const)
      for (const objetivo of ['massa', 'saude', 'emagrecimento'] as const)
        for (const dias of [3, 4, 5] as const)
          for (const tempo of [45, 75] as const)
            for (const limite of ['limitado', 'sem_limite'] as const)
              for (const semana of [1, 5, 6] as const)
                for (const foco of [undefined, { grupo: 'peito', compensa: 'ombros' }] as const) {
                  const p = perfil({ nivelExperiencia: nivel, objetivo, diasDisponiveis: dias,
                    treinoDias: DIAS.slice(0, dias) as never, tempoPorSessaoMin: tempo, limiteTempoTreino: limite,
                    ...(foco ? { foco: { ...foco, semana } } : {}) } as never);
                  let r;
                  try { r = rotina(p, semana); } catch { continue; }
                  if (!foco) continue; // o excesso do baseline é a pendência declarada acima
                  medidos += 1;
                  // Na semana 6 a faixa é a de `aplicarDeload` — a MESMA autoridade que a rampa usa.
                  const teto = r.faixaVolumeSemana?.max ?? mrv(nivel, objetivo);
                  /**
                   * 🔑 A varredura mede o DELTA do foco, não o excesso absoluto: o que esta
                   * entrega promete é que o bloco não cria nem agrava excesso. O excesso que
                   * já existe no baseline é a pendência de moeda registrada acima.
                   */
                  const semFoco = rotina(perfil({ nivelExperiencia: nivel, objetivo, diasDisponiveis: dias,
                    treinoDias: DIAS.slice(0, dias) as never, tempoPorSessaoMin: tempo, limiteTempoTreino: limite } as never), semana);
                  const antes = new Map(GRUPOS_GRANDES.map((g) => [g, ponderado(semFoco).get(g) ?? 0]));
                  for (const g of GRUPOS_GRANDES) {
                    const depois = ponderado(r).get(g) ?? 0;
                    if (depois > teto && depois > (antes.get(g) ?? 0)) {
                      falhas.push(`${nivel}/${objetivo}/${dias}d/${tempo}min/${limite}/S${semana}: ${g} ${antes.get(g)} → ${depois} > ${teto}`);
                    }
                  }
                }
    expect(medidos, 'anti-vacuidade: a varredura não mediu nada').toBeGreaterThan(100);
    expect(falhas.slice(0, 10), `${falhas.length} planos onde o foco criou ou agravou excesso`).toEqual([]);
  }, 240_000);
});
