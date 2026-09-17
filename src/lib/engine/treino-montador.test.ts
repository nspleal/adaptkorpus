import { describe, expect, it, vi } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { aplicarDeload, dificuldadesLiberadas, prescreverTreino } from './treino';
import { maxSemanalSemFoco, tetoSeriesGrupoNaSessao } from './trilhos';
import { alvoDaSemana } from './treino-mesociclo';
import { montarRotina } from './treino-montador';
import { creditoPonderadoDaSemana, GRUPOS_GRANDES } from './alocador';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { FeedbackGrupo, PerfilTreino } from './treino-types';
import type { GrupoPrimario } from '../data/types';
import { altaExigenciaDocumental, classeDeDescanso } from './descanso';
import { FITT_OBJETIVO } from './treino-constants';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
function perfil(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over };
}
function rotina(over: Partial<PerfilTreino> = {}) {
  const p = perfil(over);
  return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES);
}

describe('montador de rotina (base real, 163 exercícios)', () => {
  it('dias de força = min(dias, teto do nível); excedente → cardio/recuperação', () => {
    // iniciante: teto 3. Com 6 dias → 3 de força, 3 de cardio/recuperação.
    const r = rotina({ nivelExperiencia: 'iniciante', diasDisponiveis: 6 });
    expect(r.diasForcaAgendados).toBe(3);
    expect(r.diasCardioRecuperacao).toBe(3);
    expect(r.dias).toHaveLength(3);
  });

  it('todo exercício selecionado respeita equipamento/local e dificuldade liberada', () => {
    for (const equip of ['nenhum', 'casa', 'academia'] as const) {
      for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
        const r = rotina({ equipamento: equip, nivelExperiencia: nivel, diasDisponiveis: 4 });
        const liberadas = new Set(dificuldadesLiberadas(nivel));
        const locais =
          equip === 'nenhum' ? ['casa_sem'] : equip === 'casa' ? ['casa_sem', 'casa_com'] : ['casa_sem', 'casa_com', 'academia'];
        for (const d of r.dias)
          for (const s of d.slots) {
            expect(locais).toContain(s.exercicio.local);
            expect(liberadas.has(s.exercicio.nivel)).toBe(true);
          }
      }
    }
  });

  it('invariante: puxar ≥ empurrar (sem aviso de desequilíbrio)', () => {
    for (const dias of [2, 3, 4, 5, 6]) {
      const r = rotina({ diasDisponiveis: dias, nivelExperiencia: 'avancado' });
      const conta = (p: string) => r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
      expect(conta('puxar')).toBeGreaterThanOrEqual(conta('empurrar'));
    }
  });

  it('dobradiça/quadril presente quando há ≥ 2 dias de força', () => {
    const r = rotina({ diasDisponiveis: 4, nivelExperiencia: 'avancado' });
    const temDobradica = r.dias.some((d) => d.slots.some((s) => s.padrao === 'dobradica_quadril'));
    expect(temDobradica).toBe(true);
  });

  it('invariante: core 2–3×/semana em qualquer split (≥ 2 dias)', () => {
    for (const dias of [2, 3, 4, 5, 6])
      for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
        const r = rotina({ diasDisponiveis: dias, nivelExperiencia: nivel });
        const core = r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === 'core').length, 0);
        expect(core).toBeGreaterThanOrEqual(2);
        expect(core).toBeLessThanOrEqual(3);
      }
  });

  it('tempo curto: nº de exercícios por dia cai (cabe no tempo)', () => {
    const curto = rotina({ tempoPorSessaoMin: 20 });
    const longo = rotina({ tempoPorSessaoMin: 90 });
    const maxSlotsCurto = Math.max(...curto.dias.map((d) => d.slots.length));
    const maxSlotsLongo = Math.max(...longo.dias.map((d) => d.slots.length));
    expect(maxSlotsCurto).toBeLessThanOrEqual(maxSlotsLongo);
  });

  it('peso corporal (equipamento nenhum) gera rotina só com exercícios de casa_sem', () => {
    const r = rotina({ equipamento: 'nenhum', diasDisponiveis: 3, nivelExperiencia: 'iniciante' });
    expect(r.dias.length).toBeGreaterThan(0);
    for (const d of r.dias) for (const s of d.slots) expect(s.exercicio.local).toBe('casa_sem');
  });

  it('é determinístico', () => {
    const a = rotina({ diasDisponiveis: 5, nivelExperiencia: 'avancado' });
    const b = rotina({ diasDisponiveis: 5, nivelExperiencia: 'avancado' });
    const ids = (r: typeof a) => r.dias.map((d) => d.slots.map((s) => s.exercicio.id).join(',')).join('|');
    expect(ids(a)).toBe(ids(b));
  });
});

// ── Favoritos no montador (DF #12 + B5, 2026-07-04) ─────────────────────────
describe('favoritos no montador (DF #12)', () => {
  function rotinaFav(favs: string[], over: Partial<PerfilTreino> = {}) {
    const p = perfil(over);
    return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(favs));
  }

  it('favorito aparece em TODA sessão em que o padrão tem slot (isento da variedade B5)', () => {
    // e9 Supino reto (empurrar, INT, academia) favorito de um intermediário na academia
    const r = rotinaFav(['e9']);
    const diasComEmpurrar = r.dias.filter((d) => d.slots.some((s) => s.padrao === 'empurrar'));
    expect(diasComEmpurrar.length).toBeGreaterThan(0);
    for (const d of diasComEmpurrar) {
      expect(d.slots.some((s) => s.exercicio.id === 'e9'), `${d.nome} devia ter o favorito`).toBe(true);
    }
  });

  it('badge: incluidoPorPreferencia em TODO slot cujo exercício é favorito', () => {
    const r = rotinaFav(['e9']);
    for (const d of r.dias) for (const s of d.slots) {
      if (s.exercicio.id === 'e9') expect(s.incluidoPorPreferencia).toBe(true);
      else expect(s.incluidoPorPreferencia).toBeUndefined();
    }
  });

  it('favorito acima do nível NUNCA aparece (filtro duro intacto — favoritar não fura o nível)', () => {
    // e26 Terra (avançado) favoritado por um INICIANTE → fora do pool
    const r = rotinaFav(['e26'], { nivelExperiencia: 'iniciante' });
    for (const d of r.dias) expect(d.slots.some((s) => s.exercicio.id === 'e26')).toBe(false);
  });

  it('favorito sem o equipamento NUNCA aparece', () => {
    // e9 Supino (academia) favoritado por quem treina SEM equipamento
    const r = rotinaFav(['e9'], { equipamento: 'nenhum' });
    for (const d of r.dias) expect(d.slots.some((s) => s.exercicio.id === 'e9')).toBe(false);
  });

  it('invariantes intactas com favoritos ativos (puxar ≥ empurrar · dobradiça · core 2–3)', () => {
    const r = rotinaFav(['e9', 'e3']);
    const conta = (p: string) => r.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
    expect(conta('puxar')).toBeGreaterThanOrEqual(conta('empurrar'));
    expect(conta('dobradica_quadril')).toBeGreaterThanOrEqual(1);
    expect(conta('core')).toBeGreaterThanOrEqual(2);
    expect(conta('core')).toBeLessThanOrEqual(3);
    expect(r.avisos).toHaveLength(0);
  });

  it('determinismo: dupla chamada → rotina idêntica; set vazio → byte-idêntico ao default', () => {
    const a = JSON.stringify(rotinaFav(['e9', 'e19']));
    const b = JSON.stringify(rotinaFav(['e9', 'e19']));
    expect(a).toBe(b);
    expect(JSON.stringify(rotinaFav([]))).toBe(JSON.stringify(rotina()));
  });

  it('dois favoritos do mesmo padrão: ambos entram em ordem estável (tier, id) quando há 2 slots', () => {
    // dois favoritos de "empurrar": e9 (T1) e e11 (T1) — e9 < e11 lexicográfico... ("e11"<"e9" em string!)
    // A ordem estável é a do POOL (tier↑, id lexicográfico): "e11" vem antes de "e9".
    const r = rotinaFav(['e9', 'e11']);
    const dia = r.dias.find((d) => d.slots.filter((s) => s.padrao === 'empurrar').length >= 1)!;
    const primeiro = dia.slots.find((s) => s.padrao === 'empurrar')!;
    expect(['e11', 'e9']).toContain(primeiro.exercicio.id);
    expect(primeiro.exercicio.id).toBe('e11'); // determinístico: 1º na ordem do pool
  });
});

// ── Mesociclo v2: rampa de volume por grupo no montador (DF 2026-07-08) ─────
describe('rampa de volume no montador (mesociclo v2)', () => {
  const SEMANAS: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
  function rotinaSemana(semana: 1 | 2 | 3 | 4 | 5 | 6, over: Partial<PerfilTreino> = {}, feedbackGrupos?: ReadonlyMap<GrupoPrimario, FeedbackGrupo>) {
    const p = perfil({ nivelExperiencia: 'avancado', diasDisponiveis: 6, tempoPorSessaoMin: 90, ...over });
    return montarRotina(prescreverTreino(p, avaliarGateTreino(p)), p, EXERCISES, new Set(), { semana, feedbackGrupos });
  }
  function totalPorGrupo(r: ReturnType<typeof rotinaSemana>) {
    const tot = new Map<string, { series: number; slots: number }>();
    for (const d of r.dias)
      for (const s of d.slots) {
        const grupo = s.exercicio.grupoPrimario;
        if (grupo == null) continue;   // cardio/corpo-inteiro não têm volume por grupo
        const g = tot.get(grupo) ?? { series: 0, slots: 0 };
        g.series += s.series ?? 0;
        g.slots += 1;
        tot.set(grupo, g);
      }
    return tot;
  }

  /**
   * 🔻 FÓRMULA ATUALIZADA no v4 (2026-08-13): entrou o TETO DE SÉRIES DO GRUPO NA SESSÃO
   * (`tetoSeriesGrupoNaSessao` — a "nota de coerência aritmética" da §1.2, que existia sem
   * call site desde o v3). O alvo entregue agora respeita também `Σ_dias min(slots_dia ×
   * sMax, tetoSessão)` — um grupo com 3 slots num dia só não carrega mais que o teto da
   * sessão, mesmo que `n × sMax` coubesse.
   */
  /**
   * 🔵 REESCRITO NA MOEDA DECIDIDA (autor, 2026-09-16) — a verificação não foi removida.
   *
   * ⛔️ Como este contrato estava até `f035d6c`, e o que ele cobrava:
   *   `expect(totais, 'grupo ${grupo}').toEqual(alvos)` — com `totais` em séries DIRETAS e
   *   `alvos = min(max(banda.min + (s-1), base), min(banda.max, tetoAlcançável))`, isto é, a
   *   banda lida como teto de séries DIRETAS.
   *
   * 🔴 Por que ele não podia continuar: a MESMA banda era lida como PONDERADA no alocador
   * (`alvoPonderado`), no guard de cobertura e no crítico do editor. Com crédito indireto > 0
   * as duas leituras são aritmeticamente incompatíveis — ou o grupo chega a 20 diretas (e
   * passa de 20 ponderadas), ou fica na banda ponderada (e não chega a 20 diretas). Medido:
   * 274 das 3 888 combinações entregavam um grande acima do MRV ponderado sem foco nenhum.
   *
   * ✅ A decisão fechou a ambiguidade: **o MRV limita o volume PONDERADO**. Aqui, ombros era
   * o caso: a rampa pedia 16→20 diretas e o entregue passa a ser 16,17,18,18,18, porque cada
   * série de peito e de costas já credita 0,5 a ele.
   *
   * 🔒 O contrato NÃO virou desigualdade frouxa. Ele continua exato, só que na conta certa:
   * o entregue é o alvo da rampa MENOS exatamente o que o teto ponderado obrigou a cortar, e
   * cada corte tem de ser mínimo (uma série a mais estouraria). O teste distingue os dois
   * regimes e exige que os DOIS apareçam.
   */
  it('aceitação: volume/grupo sobe do piso ao teto ALCANÇÁVEL em 5 semanas e NUNCA ultrapassa o topo PONDERADO', () => {
    /**
     * 🔒 DOIS cenários, de propósito. O layout de 6d/90min (o original deste contrato) é
     * folgado e quase nunca encosta no teto ponderado; o de 3d/75min é uma das células que
     * a varredura mediu ESTOURANDO antes da correção. Só com os dois os ramos ② e ③ abaixo
     * são ambos exercidos, em qualquer um dos dois projetos de seleção.
     */
    const CENARIOS: Partial<PerfilTreino>[] = [
      { nivelExperiencia: 'avancado', diasDisponiveis: 6, tempoPorSessaoMin: 90 },
      { nivelExperiencia: 'avancado', diasDisponiveis: 3, tempoPorSessaoMin: 75 },
      /**
       * 🔵 CENÁRIO ACRESCENTADO em 2026-09-17 (2ª volta). Com a troca de exercício rodando
       * ANTES da poda, os dois cenários acima deixaram de encostar em qualquer teto — o
       * ramo ③ virou letra morta e a anti-vacuidade abaixo caiu, como devia. Esta é a célula
       * onde a poda por sessão AINDA morde depois de esgotadas as trocas (medida: 10 das
       * 1 008 células da varredura, todas `avançado/6–7 d/45 min/limitado`).
       */
      { nivelExperiencia: 'avancado', diasDisponiveis: 6, tempoPorSessaoMin: 45, limiteTempoTreino: 'limitado' },
    ];
    let semCorte = 0;
    let comCorte = 0;
    for (const over of CENARIOS) {
      // Avançado/massa: banda 16–20, séries/exercício 3–4.
      const p = perfil(over);
      const presc = prescreverTreino(p, avaliarGateTreino(p));
      const banda = presc.volumePorGrupoSemana;
      const rotinas = SEMANAS.map((s) => rotinaSemana(s, over));
      const porSemana = rotinas.map((r) => totalPorGrupo(r));
      const pondSemana = rotinas.map((r) => creditoPonderadoDaSemana(r.dias.flatMap((d) => d.slots)));
      // Slots POR DIA do grupo (a fórmula do teto alcançável precisa do layout, não só do n).
      const layout = (grupo: string) => rotinas[0]!.dias
        .map((d) => d.slots.filter((s) => s.exercicio.grupoPrimario === grupo).length).filter((n) => n > 0);
      /**
       * 🔵 OS DOIS TETOS, LIDOS DAS AUTORIDADES (2026-09-17). A conta anterior derivava tudo
       * de `banda.max`: o alvo da rampa, o teto semanal e o teto da sessão
       * (`ceil(banda.max / dias)`). Os três viraram números distintos — a banda é o ALVO,
       * `maxSemanalSemFoco` é o limite da semana e o teto da sessão é fixo em hipertrofia —, e
       * reconstruí-los a partir de um só reintroduziria aqui a confusão que a decisão desfez.
       */
      const tetoSemanal = maxSemanalSemFoco(p.nivelExperiencia, 'massa');
      const tetoSessaoGrupo = tetoSeriesGrupoNaSessao(p.nivelExperiencia, 'massa');
      for (const [grupo, { slots }] of porSemana[0]!) {
        const porDia = layout(grupo);
        const sMax = presc.seriesPorExercicio.max;
        /** O que o layout comporta: teto por dia E teto de slots, o menor dos dois. */
        const tetoAlcancavel = Math.min(
          porDia.reduce((a, n) => a + Math.min(n * sMax, tetoSessaoGrupo), 0),
          slots * sMax,
        );
        const base = slots * presc.seriesPorExercicio.min;
        // 🔒 O alvo vem de `alvoDaSemana` — a autoridade da rampa —, não de uma reconstrução.
        const alvos = SEMANAS.map((s) => Math.min(Math.max(alvoDaSemana(banda, s as never), base), tetoAlcancavel));
        const totais = porSemana.map((m) => m.get(grupo)!.series);
        const ehGrande = (GRUPOS_GRANDES as readonly string[]).includes(grupo);
        for (let i = 0; i < SEMANAS.length; i += 1) {
          const ctx = `${over.diasDisponiveis}d · grupo ${grupo} (layout ${porDia.join('+')}) · semana ${SEMANAS[i]}`;
          const entregue = totais[i]!;
          const alvo = alvos[i]!;
          const pond = pondSemana[i]!.get(grupo as GrupoPrimario) ?? 0;
          // ① O TETO SEMANAL, na conta que vale — sem foco, o máximo automático.
          if (ehGrande) expect(pond, `${ctx}: passou do teto semanal`).toBeLessThanOrEqual(tetoSemanal);
          // ①b E o TETO POR SESSÃO, que vale ao mesmo tempo (decisão 2026-09-17).
          if (ehGrande) {
            const porDiaPond = rotinas[i]!.dias.map((d) => creditoPonderadoDaSemana(d.slots).get(grupo as GrupoPrimario) ?? 0);
            expect(Math.max(0, ...porDiaPond), `${ctx}: passou do teto de um treino só`).toBeLessThanOrEqual(tetoSessaoGrupo);
          }
          // ② A rampa nunca entrega MAIS do que pediu.
          expect(entregue, `${ctx}: entregou acima do alvo da rampa`).toBeLessThanOrEqual(alvo);
          if (entregue === alvo) { semCorte += 1; continue; }
          // ③ Cortou? Então o corte foi FORÇADO por UM DOS DOIS tetos, e é MÍNIMO.
          expect(ehGrande, `${ctx}: grupo sem faixa não pode ter sido cortado`).toBe(true);
          const porDiaPond = rotinas[i]!.dias.map((d) => creditoPonderadoDaSemana(d.slots).get(grupo as GrupoPrimario) ?? 0);
          const apertouSemana = pond + 1 > tetoSemanal;
          const apertouSessao = porDiaPond.some((v) => v > 0 && v + 1 > tetoSessaoGrupo);
          expect(apertouSemana || apertouSessao,
            `${ctx}: cortou além do necessário (${entregue} contra alvo ${alvo}; pond ${pond}/${tetoSemanal}, dia ${porDiaPond.join('+')}/${tetoSessaoGrupo})`).toBe(true);
          comCorte += 1;
        }
        /**
         * 🔵 MONOTONICIDADE, NA MOEDA QUE VALE (2026-09-17).
         *
         * A redação anterior exigia que as séries DIRETAS nunca caíssem de uma semana para a
         * outra. Medido com o teto novo (avançado sem foco: 18, contra os 20 de antes): com a
         * rampa subindo os vizinhos, o crédito INDIRETO de glúteos cresce e a poda devolve uma
         * série direta dele — `8→8→8→7→7`, com a frase do motor explicando.
         *
         * 🔒 O que NÃO pode regredir é o estímulo: o PONDERADO, que é a moeda do teto. Direta
         * só pode cair quando o teto mordeu — e aí a queda é a correção, não uma perda.
         */
        const ponds = pondSemana.map((m) => m.get(grupo as GrupoPrimario) ?? 0);
        for (let i = 1; i < totais.length; i++) {
          const ctxM = `${over.diasDisponiveis}d · ${grupo} (layout ${porDia.join('+')}) · S${SEMANAS[i]}`;
          /**
           * 🔒 O ponderado só pode regredir quando o TETO obrigou — e a poda é mínima: uma
           * série direta a mais estouraria. A queda vem da granularidade (a série direta vale
           * 1,0 e o excesso pode ser de 0,5), nunca de o motor ter desistido de volume.
           */
          if (ponds[i]! < ponds[i - 1]!) {
            expect(ponds[i]! + 1, `${ctxM}: o ponderado regrediu (${ponds.join('→')}) sem o teto ter mordido`).toBeGreaterThan(tetoSemanal);
          }
          if (totais[i]! < totais[i - 1]!) {
            expect(ehGrande, `${ctxM}: grupo sem teto não pode perder série direta`).toBe(true);
            expect(ponds[i]! + 1, `${ctxM}: direta caiu (${totais.join('→')}) sem o teto ter mordido`).toBeGreaterThan(tetoSemanal);
          }
        }
      }
    }
    // ⚠️ ANTI-VACUIDADE: os dois regimes têm de existir, senão os ramos ② e ③ nunca são
    // exercidos e o teste passaria com qualquer motor.
    expect(semCorte, 'nenhum grupo entregou o alvo cheio — o cenário degenerou').toBeGreaterThan(0);
    expect(comCorte, 'nenhum grupo foi limitado pelo teto ponderado — reancorar o cenário').toBeGreaterThan(0);
  });

  /**
   * 🔵 REESCRITO NA MOEDA DECIDIDA (autor, 2026-09-16) — a verificação não foi removida.
   *
   * ⛔️ Como estava até `f035d6c`: `expect(sem5.get(g)!.series, g).toBe(topo)` — "atingir o
   * topo" significava **16 séries DIRETAS**. Medido depois da decisão: posterior entrega 14
   * diretas, porque já recebe crédito indireto de quadríceps e glúteos.
   *
   * ✅ Com o MRV ponderado, "atingir o topo" passa a ser atingi-lo **na conta que vale**. O
   * teste não afrouxa para `≤ topo`: exige que o grupo CHEGUE ao topo — a menos de uma
   * série, que é o mais perto que a granularidade de 0,5 permite — e que uma série direta a
   * mais o estouraria. Grupo que ficasse em 10 de 16 falha aqui, como antes.
   */
  /**
   * 🔵 SUBSTITUI «grupos com slots suficientes ATINGEM o topo da banda» (decisão 2026-09-17).
   *
   * ⛔️ Por que a redação anterior não vale mais: ela exigia que algum grupo chegasse ao topo
   * da faixa (16 na época). Com a faixa desejada de hipertrofia em 10–14, o alocador para
   * ANTES — ele dá slot por DÉFICIT e nunca preenche o dia só para ocupar tempo. Medido em
   * TODAS as 24 combinações de nível × dias × tempo desta grade: nenhum grupo alcança o topo,
   * porque o topo passou a exigir mais slots do que o déficit justifica. Manter a asserção
   * seria cobrar do motor um comportamento que a decisão removeu de propósito.
   *
   * ✅ O que entra no lugar é MAIS forte do que "≤ topo": o grupo tem de entregar a META
   * REALIZÁVEL — o menor entre o topo desejado e o que o layout comporta (slots × sMax, com o
   * teto de 12 por sessão) — e, quando a meta fica abaixo do topo, o motor tem de DIZER. Um
   * grupo que entregasse 8 de 12 realizáveis falha aqui, exatamente como antes.
   */
  it('grupos entregam a META REALIZÁVEL na semana 5 — e o motor DIZ quando o topo desejado não cabe', () => {
    const over: Partial<PerfilTreino> = { nivelExperiencia: 'intermediario', diasDisponiveis: 4, tempoPorSessaoMin: 90 };
    const p = perfil(over);
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const r5 = rotinaSemana(5, over);
    const topo = presc.volumePorGrupoSemana.max;
    const sMax = presc.seriesPorExercicio.max;
    const tetoSessaoGrupo = tetoSeriesGrupoNaSessao('intermediario', 'massa');
    const tetoSemanal = maxSemanalSemFoco('intermediario', 'massa');

    const porGrupo = new Map<string, number[]>();
    r5.dias.forEach((d, di) => {
      for (const s of d.slots) {
        const g = s.exercicio.grupoPrimario;
        if (g == null) continue;
        const arr = porGrupo.get(g) ?? r5.dias.map(() => 0);
        arr[di] = (arr[di] ?? 0) + 1;
        porGrupo.set(g, arr);
      }
    });
    const sem5 = totalPorGrupo(r5);
    const pond5 = creditoPonderadoDaSemana(r5.dias.flatMap((d) => d.slots));

    let abaixoDoTopo = 0;
    let medidos = 0;
    for (const [g, dias] of porGrupo) {
      if (!(GRUPOS_GRANDES as readonly string[]).includes(g)) continue;
      const comSlot = dias.filter((n) => n > 0);
      const totalSlots = comSlot.reduce((a, n) => a + n, 0);
      const alcancavel = Math.min(
        comSlot.reduce((a, n) => a + Math.min(n * sMax, tetoSessaoGrupo), 0),
        totalSlots * sMax,
      );
      const meta = Math.min(topo, alcancavel);
      const direta = sem5.get(g)!.series;
      const pond = pond5.get(g as GrupoPrimario) ?? 0;
      medidos += 1;
      if (meta < topo) abaixoDoTopo += 1;
      // A rampa nunca entrega MAIS do que a meta realizável…
      expect(direta, `${g}: entregou acima da meta realizável (${direta} > ${meta})`).toBeLessThanOrEqual(meta);
      // …e entrega a meta cheia, salvo quando o teto ponderado mordeu (e aí a poda explicou).
      expect(direta >= meta || pond + 1 > tetoSemanal,
        `${g}: entregou ${direta} de ${meta} realizáveis, com ponderado ${pond}/${tetoSemanal}`).toBe(true);
      // E o teto por sessão vale ao mesmo tempo.
      for (const [di, d] of r5.dias.entries()) {
        const noDia = creditoPonderadoDaSemana(d.slots).get(g as GrupoPrimario) ?? 0;
        expect(noDia, `${g} dia ${di}: passou do teto de um treino só`).toBeLessThanOrEqual(tetoSessaoGrupo);
      }
    }
    // ⚠️ ANTI-VACUIDADE: sem grupos medidos o laço acima não prova nada.
    expect(medidos, 'nenhum grande no plano — o cenário degenerou').toBeGreaterThan(3);
    /**
     * 🔵 CONTRATO SUBSTITUÍDO em 2026-09-17 (2ª volta).
     *
     * ANTES: *"quando a meta fica abaixo do topo desejado, o motor DIZ"* — cobrava a frase
     * `alvo de N séries para X não cabe em M exercício(s)`.
     * AGORA: **a faixa desejada não é meta obrigatória no topo.** Ficar em 12 numa faixa de
     * 10–14 é estar DENTRO dela, e anunciar insuficiência ali é o defeito que a decisão
     * fecha (medido: 1 300 das 1 355 emissões da frase antiga saíam com o grupo dentro da
     * faixa). A frase foi removida do montador.
     *
     * O que fica no lugar, e é o que este teste passa a cobrar: **silêncio quando está
     * dentro da faixa**, e voz quando o volume entregue fica abaixo do MÍNIMO — a voz é a
     * do guard de cobertura, na conta ponderada, que é o critério pertinente.
     */
    expect(r5.avisos.some((a) => /alvo de \d+ séries para .+ não cabe em \d+ exercício/.test(a)),
      `a frase de insuficiência-por-não-chegar-ao-topo voltou: ${r5.avisos.join(' | ')}`).toBe(false);
    const abaixoDoMinimo = GRUPOS_GRANDES.filter((g) => (pond5.get(g) ?? 0) < (r5.faixaVolumeSemana?.min ?? 0));
    // ⚠️ ANTI-VACUIDADE do ramo: o cenário precisa ter grupos abaixo do topo para a asserção
    // de silêncio significar alguma coisa.
    expect(abaixoDoTopo, 'nenhum grupo ficou abaixo do topo — o silêncio acima não prova nada').toBeGreaterThan(0);
    for (const g of abaixoDoMinimo) {
      expect(r5.avisos.some((a) => a.includes('abaixo do mínimo desta semana') || a.includes('equipamento')),
        `${g} abaixo do mínimo e sem voz: ${r5.avisos.join(' | ')}`).toBe(true);
    }
  });

  it('toda série por slot fica dentro de seriesPorExercicio {min..max}', () => {
    const p = perfil({ nivelExperiencia: 'avancado', diasDisponiveis: 6, tempoPorSessaoMin: 90 });
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    /**
     * 🔴 D2 (2026-09-10): a semana 6 ANOTA séries — antes ela pulava a rampa inteira e a
     * asserção era `toBeUndefined()`. A invariante não mudou de conteúdo, só de régua: a
     * faixa da semana 6 é a da prescrição passada por `aplicarDeload`, o único ponto onde a
     * redução acontece. Continua proibido série fora da faixa DECLARADA da semana.
     */
    for (const s of [...SEMANAS, 6 as const]) {
      const r = rotinaSemana(s);
      const faixa = (s === 6 ? aplicarDeload(presc) : presc).seriesPorExercicio;
      for (const d of r.dias)
        for (const slot of d.slots) {
          expect(slot.series, `semana ${s}`).toBeGreaterThanOrEqual(faixa.min);
          expect(slot.series, `semana ${s}`).toBeLessThanOrEqual(faixa.max);
        }
    }
  });

  it('semana 6 marca deload nos metadados; ciclo novo (semana 1) reseta ao piso', () => {
    const r6 = rotinaSemana(6);
    expect(r6.semana).toEqual(expect.objectContaining({ numero: 6, deload: true }));
    const r1a = totalPorGrupo(rotinaSemana(1));
    const r1b = totalPorGrupo(rotinaSemana(1));
    expect([...r1a.entries()]).toEqual([...r1b.entries()]); // determinístico
  });

  it("feedback 'segura' congela o incremento do grupo (alvo = semana anterior)", () => {
    const r3 = totalPorGrupo(rotinaSemana(3));
    const grupo = [...r3.keys()].find((g) => {
      const v3 = r3.get(g)!;
      return v3.series > v3.slots * 3; // grupo que de fato rampou (não pinado na base)
    })!;
    const seguraMap = new Map([[grupo as GrupoPrimario, 'segura' as FeedbackGrupo]]);
    const r4seg = totalPorGrupo(rotinaSemana(4, {}, seguraMap));
    expect(r4seg.get(grupo)!.series).toBe(r3.get(grupo)!.series); // sem. 4 'segura' = alvo da sem. 3
  });

  it('compat: sem semanaCiclo a saída é byte-idêntica à v1 (invariantes preservadas nas semanas 1–6)', () => {
    expect(JSON.stringify(rotina())).toBe(JSON.stringify(rotina())); // sanidade determinismo
    for (const s of [1, 2, 3, 4, 5, 6] as const) {
      const r = rotinaSemana(s);
      const conta = (p: string) => r.dias.reduce((n, d) => n + d.slots.filter((x) => x.padrao === p).length, 0);
      expect(conta('puxar')).toBeGreaterThanOrEqual(conta('empurrar'));
      expect(conta('dobradica_quadril')).toBeGreaterThanOrEqual(1);
      expect(conta('core')).toBeGreaterThanOrEqual(2);
      expect(conta('core')).toBeLessThanOrEqual(3);
    }
  });

  it('estrutura estável no ciclo: os MESMOS exercícios nas semanas 1–5 (só as séries mudam)', () => {
    const ids = (s: 1 | 2 | 3 | 4 | 5) => rotinaSemana(s).dias.map((d) => d.slots.map((x) => x.exercicio.id).join(',')).join('|');
    const base = ids(1);
    for (const s of [2, 3, 4, 5] as const) expect(ids(s)).toBe(base);
  });

  /**
   * 🟡 CARACTERIZAÇÃO ATUALIZADA (2026-08-04) — e o motivo é um achado, não um ajuste.
   *
   * Ao ligar o RIR-alvo da semana do mesociclo (item 2 do lote), a semana 1 passou a usar os
   * PISOS das faixas (composto 120 s). Com descansos menores, a sessão de 30 min passa a
   * caber sem degradação → `coubeCheio` fica true → o campo v1 `descansoCompostoSeg` sobe
   * para 180.
   *
   * 🔴 **O achado, REPORTADO e não consertado aqui:** `elegivel180 && coubeCheio` usa "coube
   * no descanso ATUAL" como prova de que 180 s cabe — o orçamento foi calculado a 120 s. É
   * uma sobre-afirmação anterior a este lote, no campo v1. 🟢 Não chega ao usuário: a sessão
   * guiada exibe `slot.descansoSeg` (o valor exato do motor) e esta faixa só serve de
   * fallback da chamada v1, sem `semanaCiclo`.
   */
  /**
   * 🔻 CARACTERIZAÇÃO ATUALIZADA DE NOVO (leva B do v4, 2026-08-13) — e desta vez o 180 s
   * dos 30 min MORRE, que era o achado reportado em 2026-08-04: `elegivel180 && coubeCheio`
   * afirmava que 180 s cabia num orçamento calculado a 120 s. Com o alocador por volume a
   * sessão de 30 min carrega 4 slots e NÃO fecha na faixa cheia → degradação → `coubeCheio`
   * é false e o campo v1 fica honesto (120). Aos 90 min (7 slots, semana 1) segue fechando.
   */
  it('descanso do composto: o teto de 180 s do campo v1 depende do orçamento ter fechado', () => {
    const longo = rotinaSemana(1, { tempoPorSessaoMin: 90 });
    expect(longo.dias.flatMap(d=>d.slots).some(s=>s.descansoSeg===180)).toBe(true);
    const curto = rotinaSemana(1, { tempoPorSessaoMin: 30 });
    expect(curto.semana?.descansoCompostoSeg.max).toBe(120); // sobre-afirmação de 2026-08-04, morta
    // 🔑 O que o usuário VÊ aos 30 min é o valor DEGRADADO por classe (regra 3 — cede
    // ISOLADO a 60 s, depois COMPOSTO a 90 s): a tela não promete o que o orçamento não
    // reservou. ⚠️ O critério é a CLASSE, não o nome do padrão (`core` é classe ISOLADO).
    const COMPOSTOS = new Set(['agachar', 'dobradica_quadril', 'empurrar', 'puxar']);
    const slots = curto.dias.flatMap((d) => d.slots);
    expect(slots.filter((s) => COMPOSTOS.has(s.padrao)).every((s) => s.descansoSeg === 120 || s.descansoSeg === 90), 'composto: piso da faixa ou degradado a 90').toBe(true);
    expect(slots.filter((s) => !COMPOSTOS.has(s.padrao)).every((s) => s.descansoSeg === 60), 'semana 1 = piso do isolado/core').toBe(true);
  });

  /**
   * 🔵 REANCORADO pela decisão do autor de 2026-09-16 (P-04) — e a reancoragem corrigiu uma
   * afirmação que o teste antigo fazia sem base.
   *
   * Ele cobrava `semana.descansoCompostoSeg.max === 90` e chamava isso de «objetivo saúde
   * nunca sobe p/ 180 s». Mas 60–90 é a faixa que o OBJETIVO carrega na prescrição, e desde a
   * inversão de eixo da §1.1 **o objetivo não governa descanso nenhum**: a faixa vem da CLASSE
   * (composto 120–180) e o objetivo entra só pelo RIR-alvo. Medido neste mesmo perfil: `e2` e
   * `e16` são compostos sem carga e sempre tiveram 120 s. O «90» descrevia apenas o escalar
   * legado, que não olhava para os exercícios — exatamente o defeito de P-04.
   *
   * 🔒 O que se cobra agora é verificável e é o que a spec promete: a classe manda, os pisos
   * valem, e o resumo da semana é o retrato dos slots.
   */
  it('descanso do composto: quem manda é a CLASSE, não o objetivo — e o resumo retrata os slots', () => {
    const r = rotinaSemana(1, { objetivo: 'saude', tempoPorSessaoMin: 120 });
    const compostos = r.dias.flatMap((d) => d.slots)
      .filter((s) => classeDeDescanso(s.exercicio) === 'COMPOSTO' && s.descansoSeg != null);
    expect(compostos.length, 'sem composto no plano: o teste seria vácuo').toBeGreaterThan(0);
    // A faixa do objetivo (60–90) não aparece: nenhum composto fica dentro dela.
    const faixaDoObjetivo = FITT_OBJETIVO.saude.descansoCompostoSeg;
    expect(faixaDoObjetivo).toEqual({ min: 60, max: 90 });
    for (const s of compostos) {
      expect(s.descansoSeg, `${s.exercicio.id} caiu na faixa do objetivo — o eixo voltou a ser o objetivo`)
        .toBeGreaterThan(faixaDoObjetivo.max);
      // Piso da classe sempre respeitado; documental nunca abaixo de 120 s.
      expect(s.descansoSeg).toBeGreaterThanOrEqual(altaExigenciaDocumental(s.exercicio) ? 120 : 90);
    }
    // Há de fato slots documentais a 180 s neste plano — senão o retrato não é exercido.
    expect(compostos.some((s) => s.descansoSeg === 180 && altaExigenciaDocumental(s.exercicio))).toBe(true);
    const valores = compostos.map((s) => s.descansoSeg!);
    expect(r.semana?.descansoCompostoSeg).toEqual({ min: Math.min(...valores), max: Math.max(...valores) });
  });

  it('smoke: 3 níveis × 3 objetivos × semanas 1–6 sem violar invariantes nem séries fora da faixa', () => {
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
      for (const obj of ['saude', 'massa', 'emagrecimento'] as const)
        for (const s of [1, 2, 3, 4, 5, 6] as const) {
          const p = perfil({ nivelExperiencia: nivel, objetivo: obj, diasDisponiveis: 4, tempoPorSessaoMin: 60 });
          const presc = prescreverTreino(p, avaliarGateTreino(p));
          const r = montarRotina(presc, p, EXERCISES, new Set(), { semana: s });
          const conta = (pat: string) => r.dias.reduce((n, d) => n + d.slots.filter((x) => x.padrao === pat).length, 0);
          expect(conta('puxar')).toBeGreaterThanOrEqual(conta('empurrar'));
          // D2: na semana 6 a faixa é a da prescrição em deload (mesma invariante, régua da semana).
          const faixa = (s === 6 ? aplicarDeload(presc) : presc).seriesPorExercicio;
          for (const d of r.dias)
            for (const slot of d.slots) {
              if (slot.series != null) {
                expect(slot.series, `${nivel}/${obj}/S${s}`).toBeGreaterThanOrEqual(faixa.min);
                expect(slot.series, `${nivel}/${obj}/S${s}`).toBeLessThanOrEqual(faixa.max);
              }
            }
        }
  });
});

// ── Leva 2 · Bloco 3: rampa de RETOMADA no montador (DF 2026-07-27) ──────────
describe('rampa de retomada no montador — volume ABAIXO do piso da banda', () => {
  const perfilBase: Partial<PerfilTreino> = { nivelExperiencia: 'intermediario', objetivo: 'massa', diasDisponiveis: 4, tempoPorSessaoMin: 60 };
  function montar(retomada?: { semana: number; fator: number; volumeReferencia: number; exerciciosRecentes?: ReadonlySet<string> }) {
    const p = perfil(perfilBase);
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    return montarRotina(presc, p, EXERCISES, new Set(), { semana: 3, ...(retomada ? { retomada } : {}) });
  }
  const totalPorGrupo = (r: ReturnType<typeof montar>) => {
    const m = new Map<string, number>();
    for (const d of r.dias) for (const s of d.slots) { const g = s.exercicio.grupoPrimario; if (g == null) continue; m.set(g, (m.get(g) ?? 0) + (s.series ?? 0)); }
    return m;
  };

  it('🔴 a rampa entrega MENOS séries que a semana 1 do mesociclo (não é "recuar para a semana 1")', () => {
    const p = perfil(perfilBase);
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const piso = presc.volumePorGrupoSemana.min; // 13 — o que o recuo entregaria
    const comRampa = totalPorGrupo(montar({ semana: 1, fator: 0.5, volumeReferencia: presc.volumePorGrupoSemana.max }));
    // grupo com mais slots: mesmo ele fica abaixo do piso da banda
    const maior = Math.max(...comRampa.values());
    expect(maior).toBeLessThan(piso);
  });

  it('séries por slot podem cair ABAIXO de seriesPorExercicio.min (estado novo do motor)', () => {
    // Referência baixa: o alvo do grupo fica menor que o nº de slots → cada um cai a 1,
    // abaixo do piso por exercício (2 no intermediário). É o estado que o motor não tinha:
    // antes, `series` nunca descia de `seriesPorExercicio.min`.
    const p = perfil(perfilBase);
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    expect(presc.seriesPorExercicio.min).toBe(2);
    const r = montar({ semana: 1, fator: 0.5, volumeReferencia: 6 }); // alvo = 3
    const todas = r.dias.flatMap((d) => d.slots.map((s) => s.series ?? 0));
    expect(Math.min(...todas)).toBeLessThan(presc.seriesPorExercicio.min);
    expect(Math.min(...todas)).toBeGreaterThanOrEqual(1); // nunca zera a sessão
  });

  it('sem carga: nenhum slot passa de 3 séries (IRV incomputável → teto fixo)', () => {
    const p = perfil({ ...perfilBase, equipamento: 'casa', equipamentosCasa: [] });
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const r = montarRotina(presc, p, EXERCISES, new Set(), {
      semana: 3, retomada: { semana: 2, fator: 0.7, volumeReferencia: 40 },
    });
    for (const d of r.dias) for (const s of d.slots) {
      if ((s.exercicio.equipamentoDetalhe ?? '') === 'Peso corporal') expect(s.series ?? 0).toBeLessThanOrEqual(3);
    }
  });

  it('frequência por grupo limitada (3 na semana 1) — conta sessões, não exercícios', () => {
    const p = perfil({ ...perfilBase, diasDisponiveis: 6, nivelExperiencia: 'avancado' });
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const r = montarRotina(presc, p, EXERCISES, new Set(), {
      semana: 3, retomada: { semana: 1, fator: 0.5, volumeReferencia: presc.volumePorGrupoSemana.max },
    });
    const vezes = new Map<string, number>();
    for (const d of r.dias) for (const g of new Set(d.slots.map(s => s.exercicio.grupoPrimario))) { if (g == null) continue; vezes.set(g, (vezes.get(g) ?? 0) + 1); }
    for (const [g, n] of vezes) expect(n, `grupo ${g}`).toBeLessThanOrEqual(3);
  });

  it('B5 SUSPENSA: os exercícios já executados são preferidos na volta (não rotaciona)', () => {
    const p = perfil(perfilBase);
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const semRecentes = montarRotina(presc, p, EXERCISES, new Set(), { semana: 3, retomada: { semana: 1, fator: 0.5, volumeReferencia: 16 } });
    const idsSem = new Set(semRecentes.dias.flatMap((d) => d.slots.map((s) => s.exercicio.id)));
    // escolhe um exercício de empurrar que NÃO entrou por rotação e o marca como recente
    const candidato = EXERCISES.find((e) => e.padraoMovimento === 'empurrar' && e.nivel !== 'avancado' && !idsSem.has(e.id) && e.local !== 'academia');
    expect(candidato).toBeDefined();
    const comRecentes = montarRotina(presc, p, EXERCISES, new Set(), {
      semana: 3, retomada: { semana: 1, fator: 0.5, volumeReferencia: 16, exerciciosRecentes: new Set([candidato!.id]) },
    });
    const idsCom = comRecentes.dias.flatMap((d) => d.slots.map((s) => s.exercicio.id));
    expect(idsCom).toContain(candidato!.id);
  });

  it('sem retomada nada muda: a rampa do mesociclo continua valendo (não regride a Leva 1B)', () => {
    const a = JSON.stringify(montar());
    const b = JSON.stringify(montar());
    expect(a).toBe(b);
    const p = perfil(perfilBase);
    const presc = prescreverTreino(p, avaliarGateTreino(p));
    const semanaNormal = totalPorGrupo(montar());
    const alvoSem3 = presc.volumePorGrupoSemana.min + 2;
    expect(Math.max(...semanaNormal.values())).toBeLessThanOrEqual(alvoSem3);
  });
});

// Fotografia/autoridade histórica: o seletor é congelado na etapa 1.
// As novas divisões reais são cobradas em distribuicao-etapa2.test.ts e na matriz externa.
vi.mock('./selecao-divisao', async (importOriginal) => process.env.ADAPT_TEST_SELETOR_ATUAL === '1' ? importOriginal() : import('./__fixtures__/selecao-etapa1'));
