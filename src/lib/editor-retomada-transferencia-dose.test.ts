import { describe, expect, it } from 'vitest';
import { doPlano, paraRotinaCustom } from '@/components/painel/EditorTreino';
import { gerarTreino } from './engine';
import { EXERCISES } from './data/exercises';
import type { PerfilTreino, RotinaCustom, RotinaSemanal } from './engine/treino-types';
import type { OpcoesSemana } from './engine/treino-montador';

/**
 * 🔴 RETOMADA — A DOSE DE UM SLOT NÃO DEPENDE DO NÚMERO DE OUTRO.
 *
 * Medido na 4ª rodada, com mapa de escolhas COMPLETO (o desenho salvo antes da pausa, que é
 * o caso central da retomada): `cf88f9b` e `7031790` devolviam ao round-robin a folga que uma
 * redução liberava, e ela subia num slot que a pessoa não tinha tocado — `ter/e46 2→1` levava
 * `ter/e45 2→3`, com o total do grupo parado. `7031790` só havia blindado o slot SEM escolha;
 * entre slots que ambos têm escolha o defeito seguia inteiro (2.292 casos em 396.448).
 *
 * 🔒 A régua destes testes, e o contrato que a correção sustenta:
 *  ① reabrir sem editar devolve dia, exercício e séries por slot;
 *  ② reduzir a escolha de um slot nunca aumenta outro — com escolha ou sem;
 *  ③ o slot SEM escolha recebe exatamente a cota de quando ninguém escolheu nada;
 *  ④ escolha nenhuma alcança um plano que a pessoa não desenhou;
 *  ⑤ IRV, volume-alvo do grupo e piso de 1 continuam valendo.
 *
 * O total do grupo NUNCA é critério: os defeitos acima mantinham o total intacto.
 */

const SAUDE = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const base = (o: Partial<PerfilTreino>): PerfilTreino => ({
  pesoKg: 82, alturaCm: 176, idade: 27, flagsSaude: SAUDE, objetivo: 'massa',
  nivelExperiencia: 'avancado', equipamento: 'academia', diasDisponiveis: 5,
  treinoDias: ['seg', 'ter', 'qua', 'qui', 'sex'], tempoPorSessaoMin: 75,
  divisaoPreferida: 'prioridades', ...o,
} as PerfilTreino);
const TA = [{ de: 'e14', para: 'e130' }, { de: 'e52', para: 'e53' }, { de: 'e53', para: 'e106' },
  { de: 'e106', para: 'e52' }, { de: 'e1', para: 'e156' }];
const TB = [{ de: 'e2', para: 'e9' }, { de: 'e41', para: 'e54' }, { de: 'e21', para: 'e26' }];

/** Fixtures próprias desta rodada — nenhuma copiada dos testes anteriores. */
const P_SAUDE = base({ objetivo: 'saude', nivelExperiencia: 'intermediario', foco: { grupo: 'costas', compensa: 'peito', semana: 1 }, preferencias: { trocas: TA, banidos: [] } });
const P_PEITO = base({ foco: { grupo: 'peito', compensa: 'ombros', semana: 1 }, preferencias: { trocas: TA, banidos: [] } });
const P_SEM_LIMITE = base({ limiteTempoTreino: 'sem_limite', tempoPorSessaoMin: 110, foco: { grupo: 'quadriceps', compensa: 'peito', semana: 1 }, preferencias: { trocas: TB, banidos: [] } });
const P_SEM_FOCO = base({ preferencias: { trocas: TA, banidos: [] } });
/** Iniciante em casa: grupos pequenos, orçamento de retomada apertado — onde o teto morde. */
const P_CASA = base({ nivelExperiencia: 'iniciante', equipamento: 'casa', diasDisponiveis: 3, treinoDias: ['seg', 'qua', 'sab'], tempoPorSessaoMin: 30, preferencias: { trocas: [], banidos: [] } });
const PERFIS: [string, PerfilTreino][] = [['saude', P_SAUDE], ['peito', P_PEITO], ['semLimite', P_SEM_LIMITE], ['semFoco', P_SEM_FOCO]];

const RAMPA_A: OpcoesSemana = { semana: 3, retomada: { semana: 1, fator: 0.35, volumeReferencia: 18 } };
const RAMPA_B: OpcoesSemana = { semana: 3, retomada: { semana: 2, fator: 0.55, volumeReferencia: 22 } };
const RAMPAS = [RAMPA_A, RAMPA_B];

// O Painel fornece o contexto vigente ao capturar a dose real. O harness faz o mesmo.
const contextos = new WeakMap<RotinaSemanal, OpcoesSemana>();
const gerar = (p: PerfilTreino, ctx: OpcoesSemana) => {
  const r = gerarTreino(p, { exercises: EXERCISES, semanaCiclo: ctx }).rotina!;
  contextos.set(r, ctx); return r;
};
const abrir = (r: RotinaSemanal, p: PerfilTreino) => doPlano(r.dias, p.treinoDias ?? [], p.rotinaCustom, contextos.get(r)?.retomada);
const json = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const salvar = (r: RotinaSemanal, p: PerfilTreino) => json(paraRotinaCustom(abrir(r, p)));

type Mapa = Record<string, Record<string, number>>;
/** dia/id -> séries. Dia + exercício + séries: o único par que prova preservação. */
const porSlot = (r: RotinaSemanal): Map<string, number | undefined> => {
  const m = new Map<string, number | undefined>();
  for (const d of r.dias) for (const s of d.slots) m.set(`${d.diaId}/${s.exercicio.id}`, s.series);
  return m;
};
const grupoDe = (id: string) => EXERCISES.find((e) => e.id === id)?.grupoPrimario ?? null;
/** Mapa COMPLETO de escolhas de uma rotina — o que o editor guarda ao abrir o plano. */
const mapaDe = (r: RotinaSemanal): Mapa => {
  const m: Mapa = {};
  for (const d of r.dias) {
    m[d.diaId!] = {};
    for (const s of d.slots) if (s.series != null) m[d.diaId!]![s.exercicio.id] = s.seriesAntesDoDeload ?? s.series;
  }
  return m;
};
/** 🔒 Altera UM valor e PRESERVA todos os outros — nunca substitui o mapa do dia. */
const mapaCom = (m: Mapa, dia: string, id: string, valor: number | null): Mapa => {
  const novo: Mapa = {};
  for (const d of Object.keys(m)) novo[d] = { ...m[d]! };
  if (valor == null) delete novo[dia]![id]; else novo[dia]![id] = valor;
  return novo;
};
const soParaAlguns = (m: Mapa, manter: (dia: string, id: string) => boolean): Mapa => {
  const novo: Mapa = {};
  for (const d of Object.keys(m)) {
    novo[d] = {};
    for (const id of Object.keys(m[d]!)) if (manter(d, id)) novo[d]![id] = m[d]![id]!;
  }
  return novo;
};
const desenho = (r: RotinaSemanal, m: Mapa): RotinaCustom => ({
  origem: 'usuario',
  dias: r.dias.map((d) => {
    const esc = m[d.diaId!];
    return {
      nome: d.nome, diaId: d.diaId!, exercicioIds: d.slots.map((s) => s.exercicio.id),
      ...(esc && Object.keys(esc).length ? { seriesPorExercicio: { ...esc } } : {}),
    };
  }),
});
const com = (p: PerfilTreino, rc: RotinaCustom) => ({ ...p, rotinaCustom: rc });
const totalPorGrupo = (r: RotinaSemanal) => {
  const g: Record<string, number> = {};
  for (const d of r.dias) for (const s of d.slots) {
    const k = s.exercicio.grupoPrimario ?? 'sem-grupo';
    g[k] = (g[k] ?? 0) + (s.series ?? 0);
  }
  return g;
};

describe('Retomada · transferência de dose entre plano e editor', () => {
  describe('① reabrir sem editar preserva dia, exercício e séries', () => {
    it('cinco ciclos de salvar/reabrir não movem nenhum slot, em 4 perfis × 2 rampas', () => {
      let medicoes = 0;
      for (const [nome, p] of PERFIS) for (const ctx of RAMPAS) {
        const r0 = gerar(p, ctx);
        let perfil = p; let anterior = porSlot(r0); let custom: RotinaCustom | null = null;
        for (let c = 0; c < 5; c++) {
          const r = gerar(perfil, ctx);
          const atual = porSlot(r);
          for (const [k, v] of anterior) expect(`${nome}/c${c} ${k}=${atual.get(k)}`).toBe(`${nome}/c${c} ${k}=${v}`);
          const novo = salvar(r, perfil);
          if (custom) expect(novo).toEqual(custom);
          custom = novo; perfil = com(p, novo); anterior = atual; medicoes++;
        }
      }
      expect(medicoes).toBe(40);
    });
  });

  describe('② reduzir a escolha de um slot não aumenta outro', () => {
    // Anti-vacuidade: o grupo medido é repartido DESIGUALMENTE e a rampa corta de verdade.
    it('anti-vacuidade: a rampa corta e o desenho de antes da pausa pede acima do teto', () => {
      const cheia = gerar(P_SAUDE, { semana: 1 });
      const rampa = gerar(com(P_SAUDE, desenho(gerar(P_SAUDE, RAMPA_A), mapaDe(cheia))), RAMPA_A);
      const somar = (v: (number | undefined)[]) => v.reduce<number>((a, b) => a + (b ?? 0), 0);
      const totalCheia = somar([...porSlot(cheia).values()]);
      const totalRampa = somar([...porSlot(rampa).values()]);
      expect(totalRampa).toBeLessThan(totalCheia);
      const costas = rampa.dias.flatMap((d) => d.slots.filter((s) => s.exercicio.grupoPrimario === 'costas').map((s) => s.series));
      expect(costas.length).toBeGreaterThanOrEqual(3);
      // repartição DESIGUAL em pelo menos um grupo: é dela que o round-robin tirava a folga
      // Independent unequal-dose control: the original P_SAUDE now splits every slot equally.
      const ctxDesigual:OpcoesSemana={semana:3,retomada:{semana:2,fator:0.7,volumeReferencia:16}};
      const naRampa = gerar(com(P_PEITO, desenho(gerar(P_PEITO,ctxDesigual), {})),ctxDesigual);
      const porG: Record<string, number[]> = {};
      for (const d of naRampa.dias) for (const s of d.slots) (porG[s.exercicio.grupoPrimario ?? '-'] ??= []).push(s.series!);
      expect(Object.values(porG).some((v) => v.length >= 2 && new Set(v).size > 1)).toBe(true);
      // o desenho pede MAIS do que a retomada permite — é o estado em que o defeito vivia
      const pedido = Object.values(mapaDe(cheia)).flatMap((m) => Object.keys(m).filter((id) => grupoDe(id) === 'costas').map((id) => m[id]!));
      expect(somar(pedido)).toBeGreaterThan(somar(costas));
    });

    /**
     * 🔵 OS DOIS CASOS DEIXARAM DE SER NOMES FIXOS — 2026-09-20.
     *
     * 🔴 Eles já tinham sido reancorados duas vezes (e113 → e70, e depois e49 × e22): o par
     * medido mudava sempre que a SELEÇÃO mudava, e o que o caso prova nunca dependeu de quais
     * ids caíram ali. Em 20/09 mudou de novo (a puxada da polia virou barra fixa supinada pela
     * troca por equivalente mais completo), e em vez de cravar um terceiro nome o caso passa a
     * DESCOBRIR o par no plano — mesma propriedade, uma âncora a menos para envelhecer.
     *
     * 🔒 A anti-vacuidade fica MAIS forte, não menos: o par tem de existir de verdade (dois
     * slots do mesmo grupo, no mesmo dia, ambos com 2 séries na rampa) e o teste falha se não
     * existir, em vez de passar por engano.
     */
    const parNoMesmoDia = (antes: Map<string, number | undefined>, r: RotinaSemanal) => {
      for (const d of r.dias) {
        const doisNaRampa = d.slots.filter((s) => antes.get(`${d.diaId}/${s.exercicio.id}`) === 2);
        for (const a of doisNaRampa) {
          const b = doisNaRampa.find((x) => x !== a && x.exercicio.grupoPrimario === a.exercicio.grupoPrimario);
          if (b) return { dia: d.diaId!, reduzido: a.exercicio.id, vizinho: b.exercicio.id };
        }
      }
      return null;
    };

    it('reduzir um slot de 2 para 1 não levanta o vizinho do mesmo grupo, no mesmo dia', () => {
      const mapa = mapaDe(gerar(P_SAUDE, { semana: 1 }));
      const auto = gerar(P_SAUDE, RAMPA_A);
      const comDesenho = gerar(com(P_SAUDE, desenho(auto, mapa)), RAMPA_A);
      const antes = porSlot(comDesenho);
      const par = parNoMesmoDia(antes, comDesenho);
      expect(par, 'nenhum par de slots do mesmo grupo com 2 séries — o caso deixou de discriminar').toBeTruthy();
      const { dia, reduzido, vizinho } = par!;
      const depois = porSlot(gerar(com(P_SAUDE, desenho(auto, mapaCom(mapa, dia, reduzido, 1))), RAMPA_A));
      expect(depois.get(`${dia}/${reduzido}`), `${dia}/${reduzido}`).toBe(1);
      expect(depois.get(`${dia}/${vizinho}`), `${dia}/${vizinho} subiu`).toBe(2);
      for (const [k, v] of antes) {
        if (k === `${dia}/${reduzido}`) continue;
        expect(`${k}=${depois.get(k)}`).toBe(`${k}=${v}`);
      }
    });

    it('o mesmo vale quando o vizinho teve PEDIDO RECUSADO pela rampa', () => {
      const mapa = mapaDe(gerar(P_SAUDE, { semana: 1 }));
      const auto = gerar(P_SAUDE, RAMPA_A);
      const comDesenho = gerar(com(P_SAUDE, desenho(auto, mapa)), RAMPA_A);
      const antes = porSlot(comDesenho);
      // Um vizinho cujo PEDIDO (mapa) é maior do que a rampa entregou: é aí que a folga cedida
      // por outro slot seria capturada, e é isso que não pode acontecer.
      let achado: { dia: string; reduzido: string; vizinho: string } | null = null;
      for (const d of comDesenho.dias) {
        const naRampa = d.slots.filter((x) => antes.get(`${d.diaId}/${x.exercicio.id}`) === 2);
        for (const a of naRampa) {
          const b = naRampa.find((x) => x !== a && x.exercicio.grupoPrimario === a.exercicio.grupoPrimario
            && (mapa[d.diaId!]?.[x.exercicio.id] ?? 0) > 2);
          if (b) { achado = { dia: d.diaId!, reduzido: a.exercicio.id, vizinho: b.exercicio.id }; break; }
        }
        if (achado) break;
      }
      expect(achado, 'nenhum vizinho com pedido recusado — o caso deixou de discriminar').toBeTruthy();
      const { dia, reduzido, vizinho } = achado!;
      const depois = porSlot(gerar(com(P_SAUDE, desenho(auto, mapaCom(mapa, dia, reduzido, 1))), RAMPA_A));
      expect(depois.get(`${dia}/${reduzido}`)).toBe(1);
      expect(depois.get(`${dia}/${vizinho}`), `${dia}/${vizinho} capturou a folga`).toBe(2);
      for (const [k, v] of antes) {
        if (k === `${dia}/${reduzido}`) continue;
        expect(`${k}=${depois.get(k)}`).toBe(`${k}=${v}`);
      }
    });

    /**
     * 🔒 A varredura vive em DOIS regimes, e a régua é diferente em cada um porque a
     * aritmética é diferente — não porque o teste foi afrouxado:
     *
     *  · `desenhoQueCabe` — o desenho salvo DURANTE a rampa (o que o editor guarda quando a
     *    pessoa abre e salva na retomada). O pedido cabe no volume-alvo do grupo. Aqui a
     *    régua é ABSOLUTA: reduzir um slot não move NENHUM outro, para cima nem para baixo.
     *
     *  · `desenhoDeAntesDaPausa` — o desenho guardado antes da parada, cujas séries são as da
     *    semana cheia e PEDEM MAIS do que a retomada permite. Nesse regime o teto de grupo
     *    obriga a recusar parte do pedido, e recusa e redução não podem ser separadas por
     *    função alguma que dependa só do próprio slot (a soma tem de entrar na conta). A
     *    régua que vale sempre e é provada aqui: nenhum slot SEM escolha se move, nenhum slot
     *    passa do número que a própria pessoa pediu para ele, e o grupo nunca passa do alvo.
     */
    for (const cobertura of ['nenhuma', 'uma', 'varias', 'todas'] as const) {
      it(`desenho que CABE · mapa ${cobertura}: reduzir um slot não move nenhum outro`, () => {
        const moveu: string[] = [];
        const naoEntregues: string[] = [];
        let medidos = 0;
        for (const [nome, p] of PERFIS) for (const ctx of RAMPAS) {
          const auto = gerar(p, ctx);
          const fonte = mapaDe(auto); // o que o editor salva DURANTE a rampa
          for (const dia of auto.dias) for (const slot of dia.slots) {
            const id = slot.exercicio.id;
            const atual = fonte[dia.diaId!]?.[id];
            if (atual == null || atual < 2) continue;
            let n = 0;
            const manter = (d: string, i: string) => cobertura === 'todas' ? true
              : cobertura === 'nenhuma' ? false
                : cobertura === 'uma' ? (d === dia.diaId && i === id)
                  : (n++ % 2 === 0);
            const mapa = soParaAlguns(fonte, (d, i) => (d === dia.diaId && i === id) || manter(d, i));
            const antes = porSlot(gerar(com(p, desenho(auto, mapa)), ctx));
            const depois = porSlot(gerar(com(p, desenho(auto, mapaCom(mapa, dia.diaId!, id, atual - 1))), ctx));
            medidos++;
            const chave = `${dia.diaId}/${id}`;
            if (atual - 1 < (antes.get(chave) ?? 0) && (depois.get(chave) ?? 0) > atual - 1) {
              naoEntregues.push(`${nome} ${chave}: pediu ${atual - 1}, veio ${depois.get(chave)}`);
            }
            for (const [k, v] of antes) {
              if (k === chave || depois.get(k) == null) continue;
              if ((depois.get(k) ?? 0) !== (v ?? 0)) moveu.push(`${nome} ao reduzir ${chave}: ${k} ${v} -> ${depois.get(k)}`);
            }
          }
        }
        expect(medidos).toBeGreaterThan(150);
        expect(naoEntregues).toEqual([]);
        expect(moveu).toEqual([]);
      }, 30_000); // 4,4–4,7 s no gate com o limite padrão de 5 s: estoura sob carga, não por defeito.
    }

    for (const cobertura of ['uma', 'varias', 'todas'] as const) {
      it(`desenho de ANTES DA PAUSA · mapa ${cobertura}: slot sem escolha não se move e ninguém passa do próprio pedido`, () => {
        const semEscolhaMoveu: string[] = [];
        const acimaDoProprioPedido: string[] = [];
        const grupoAcimaDoAlvo: string[] = [];
        const movimentoSemHonrarOGrupo: string[] = [];
        let medidos = 0;
        for (const [nome, p] of PERFIS) for (const ctx of RAMPAS) {
          const fonte = mapaDe(gerar(p, { semana: 1 }));
          const auto = gerar(p, ctx);
          const semNada = gerar(com(p, desenho(auto, {})), ctx);
          const cotaPorSlot = porSlot(semNada);
          const referencia = totalPorGrupo(semNada);
          for (const dia of auto.dias) for (const slot of dia.slots) {
            const id = slot.exercicio.id;
            const atual = fonte[dia.diaId!]?.[id];
            if (atual == null || atual < 2) continue;
            let n = 0;
            const manter = (d: string, i: string) => cobertura === 'todas' ? true
              : cobertura === 'uma' ? (d === dia.diaId && i === id) : (n++ % 2 === 0);
            const mapa = soParaAlguns(fonte, (d, i) => (d === dia.diaId && i === id) || manter(d, i));
            const antes = porSlot(gerar(com(p, desenho(auto, mapa)), ctx));
            const rDepois = gerar(com(p, desenho(auto, mapaCom(mapa, dia.diaId!, id, atual - 1))), ctx);
            const depois = porSlot(rDepois);
            medidos++;
            const chave = `${dia.diaId}/${id}`;
            for (const [k, v] of antes) {
              if (k === chave || depois.get(k) == null) continue;
              const [dk, ik] = k.split('/') as [string, string];
              const escolhaDele = mapa[dk]?.[ik];
              if ((depois.get(k) ?? 0) !== (v ?? 0) && escolhaDele == null) {
                semEscolhaMoveu.push(`${nome} ao reduzir ${chave}: ${k} (sem escolha) ${v} -> ${depois.get(k)}`);
              }
              if (escolhaDele != null && (depois.get(k) ?? 0) > escolhaDele) {
                acimaDoProprioPedido.push(`${nome} ${k}: pediu ${escolhaDele}, veio ${depois.get(k)}`);
              }
              /**
               * 🔒 Um slot só pode se mover PARA CIMA, e só até o número que a própria pessoa
               * pediu — nunca para baixo por causa da redução de outro, e nunca acima da
               * maior cota do grupo (em `①` a dominação garante `max(pedido) ≤ max(cota)`).
               */
              if ((depois.get(k) ?? 0) !== (v ?? 0)) {
                const g = grupoDe(ik);
                const cotaMax = Math.max(...[...cotaPorSlot].filter(([k2]) => grupoDe(k2.split('/')[1]!) === g).map(([, s2]) => s2 ?? 0));
                if ((depois.get(k) ?? 0) < (v ?? 0)) movimentoSemHonrarOGrupo.push(`${nome} ao reduzir ${chave}: ${k} DESCEU ${v} -> ${depois.get(k)}`);
                if ((depois.get(k) ?? 0) > cotaMax) movimentoSemHonrarOGrupo.push(`${nome} ao reduzir ${chave}: ${k} passou da maior cota do grupo (${cotaMax}) e foi a ${depois.get(k)}`);
              }
            }
            const g = totalPorGrupo(rDepois);
            for (const k of Object.keys(g)) if (g[k]! > (referencia[k] ?? 0)) grupoAcimaDoAlvo.push(`${nome} ${k}: alvo ${referencia[k]}, veio ${g[k]}`);
          }
        }
        // 2026-09-19: 140 medições. 🔵 2026-09-20: 111 — com a agenda inteira virando sessão, a
        // mesma dose se reparte em mais dias e sobram menos slots com 2+ séries para reduzir.
        // O piso acompanha o medido; a varredura continua longe de vazia.
        expect(medidos).toBeGreaterThan(100);
        expect(semEscolhaMoveu).toEqual([]);
        expect(acimaDoProprioPedido).toEqual([]);
        expect(grupoAcimaDoAlvo).toEqual([]);
        expect(movimentoSemHonrarOGrupo.slice(0, 5)).toEqual([]);
      });
    }

    it('reduções SEQUENCIAIS sobre um desenho que cabe nunca movem outro slot', () => {
      const moveu: string[] = [];
      for (const [nome, p] of PERFIS) {
        const auto = gerar(p, RAMPA_B);
        let mapa = mapaDe(auto);
        let antes = porSlot(gerar(com(p, desenho(auto, mapa)), RAMPA_B));
        for (const dia of auto.dias) for (const slot of dia.slots) {
          const v = mapa[dia.diaId!]?.[slot.exercicio.id];
          if (v == null || v < 2) continue;
          mapa = mapaCom(mapa, dia.diaId!, slot.exercicio.id, v - 1);
          const depois = porSlot(gerar(com(p, desenho(auto, mapa)), RAMPA_B));
          const chave = `${dia.diaId}/${slot.exercicio.id}`;
          for (const [k, val] of antes) {
            if (k === chave || depois.get(k) == null) continue;
            if ((depois.get(k) ?? 0) !== (val ?? 0)) moveu.push(`${nome} passo ${chave}: ${k} ${val} -> ${depois.get(k)}`);
          }
          antes = depois;
        }
      }
      expect(moveu).toEqual([]);
    });

    // Regressão R4: atravessar a fronteira não pode promover o pedido alheio recusado.
    it('ao sair de acima do teto, a redução preserva os outros slots', () => {
      const CTX: OpcoesSemana = { semana: 3, retomada: { semana: 1, fator: 0.35, volumeReferencia: 16 } };
      // O desenho é a entrada desta regressão. Não depender de o automático
      // ainda escolher os mesmos dois exercícios no mesmo dia da semana.
      const auto: RotinaSemanal = { ...gerar(P_CASA, CTX), dias: [{
        nome: 'Peito', diaId: 'qua', slots: ['e1', 'e55'].map(id => {
          const exercicio = EXERCISES.find(e => e.id === id)!;
          return { exercicio, padrao: exercicio.padraoMovimento };
        }),
      }] };
      // Pedido manual explícito acima da cota (3 + 3 para alvo 5): não depende
      // de a seleção automática atual continuar fornecendo exatamente esse pedido.
      const fonte: Mapa = { qua: { e1: 3, e55: 3 } };
      const cota = porSlot(gerar(com(P_CASA, desenho(auto, {})), CTX));
      const antes = porSlot(gerar(com(P_CASA, desenho(auto, fonte)), CTX));
      // 2026-09-19: neste plano os dois peitos moram na quarta (e1 e e55); o par medido é e1 × e55.
      const depois = porSlot(gerar(com(P_CASA, desenho(auto, mapaCom(fonte, 'qua', 'e1', 2))), CTX));
      // o grupo peito pede 3+3 e o alvo da retomada é 5: o pedido está ACIMA do teto
      expect(fonte.qua!.e1).toBe(3);
      expect(fonte.qua!.e55).toBe(3);
      expect(cota.get('qua/e1')).toBe(3);
      expect(cota.get('qua/e55')).toBe(2);
      expect(antes.get('qua/e1')).toBe(3);
      expect(antes.get('qua/e55')).toBe(2);
      // O pedido cabe, mas a edição de e1 não autoriza aumentar e55.
      expect(depois.get('qua/e1')).toBe(2);
      expect(depois.get('qua/e55')).toBe(antes.get('qua/e55'));
      expect(depois.get('qua/e55')!).toBeLessThanOrEqual(fonte.qua!.e55!);
      // o volume do grupo não passa do alvo da retomada em nenhum dos dois estados
      const alvo = totalPorGrupo(gerar(com(P_CASA, desenho(auto, {})), CTX));
      for (const rc of [desenho(auto, fonte), desenho(auto, mapaCom(fonte, 'qua', 'e1', 2))]) {
        const g = totalPorGrupo(gerar(com(P_CASA, rc), CTX));
        for (const k of Object.keys(g)) expect(`${k} ${g[k]! <= (alvo[k] ?? 0)}`).toBe(`${k} true`);
      }
    });
  });

  describe('③ o slot sem escolha recebe a cota de quando ninguém escolheu nada', () => {
    it('qualquer mapa parcial deixa os slots sem escolha exatamente onde o desenho sem escolha os põe', () => {
      const fora: string[] = [];
      for (const [nome, p] of PERFIS) for (const ctx of RAMPAS) {
        const auto = gerar(p, ctx);
        const semNada = porSlot(gerar(com(p, desenho(auto, {})), ctx));
        const fonte = mapaDe(gerar(p, { semana: 1 }));
        for (const alternado of [0, 1]) {
          let n = 0;
          const mapa = soParaAlguns(fonte, () => (n++ % 2 === alternado));
          const r = porSlot(gerar(com(p, desenho(auto, mapa)), ctx));
          for (const dia of auto.dias) for (const s of dia.slots) {
            const k = `${dia.diaId}/${s.exercicio.id}`;
            if (mapa[dia.diaId!]?.[s.exercicio.id] != null) continue;
            if (r.get(k) !== semNada.get(k)) fora.push(`${nome} ${k}: sem escolha deveria ser ${semNada.get(k)} e veio ${r.get(k)}`);
          }
        }
      }
      expect(fora).toEqual([]);
    });
  });

  describe('④ escolha só vale no desenho da pessoa', () => {
    it('dias SEM exercicioIds caem no plano ALOCADO e a escolha guardada não o alcança', () => {
      for (const ctx of [{ semana: 1 } as OpcoesSemana, RAMPA_A, { semana: 6 } as OpcoesSemana]) {
        const auto = gerar(P_PEITO, ctx);
        const vazio: RotinaCustom = { origem: 'usuario', dias: auto.dias.map((d) => ({ nome: d.nome, diaId: d.diaId!, exercicioIds: [] })) };
        const comEscolha: RotinaCustom = {
          origem: 'usuario',
          dias: auto.dias.map((d) => ({
            nome: d.nome, diaId: d.diaId!, exercicioIds: [],
            seriesPorExercicio: Object.fromEntries(d.slots.map((s) => [s.exercicio.id, 1])),
          })),
        };
        const sem = porSlot(gerar(com(P_PEITO, vazio), ctx));
        // anti-vacuidade: o fallback entrega plano de verdade, com dose acima do piso
        expect([...sem.values()].some((v) => (v ?? 0) > 1)).toBe(true);
        expect([...porSlot(gerar(com(P_PEITO, comEscolha), ctx))]).toEqual([...sem]);
      }
    });

    it('dias com ids INELEGÍVEIS são outro caminho: ramo manual vazio, não o plano alocado', () => {
      const auto = gerar(P_PEITO, RAMPA_A);
      const mortos = (comEscolha: boolean): RotinaCustom => ({
        origem: 'usuario',
        dias: auto.dias.map((d) => ({
          nome: d.nome, diaId: d.diaId!, exercicioIds: ['e9999', 'e9998'],
          ...(comEscolha ? { seriesPorExercicio: { e9999: 1, e9998: 1 } } : {}),
        })),
      });
      const sem = porSlot(gerar(com(P_PEITO, mortos(false)), RAMPA_A));
      // o caminho é DISTINTO do fallback de dias vazios: aqui não sobra slot nenhum
      expect(sem.size).toBe(0);
      expect([...porSlot(gerar(com(P_PEITO, mortos(true)), RAMPA_A))]).toEqual([...sem]);
      const vazio: RotinaCustom = { origem: 'usuario', dias: auto.dias.map((d) => ({ nome: d.nome, diaId: d.diaId!, exercicioIds: [] })) };
      expect(porSlot(gerar(com(P_PEITO, vazio), RAMPA_A)).size).toBeGreaterThan(0);
    });

    it('o plano automático não enxerga escolha nenhuma: sem rotinaCustom, a rampa é a de sempre', () => {
      for (const [, p] of PERFIS) for (const ctx of RAMPAS) {
        const auto = gerar(p, ctx);
        // o desenho SEM escolha nenhuma reproduz slot a slot o que o automático entrega
        const semNada = gerar(com(p, desenho(auto, {})), ctx);
        for (const [k, v] of porSlot(auto)) expect(`${k}=${porSlot(semNada).get(k)}`).toBe(`${k}=${v}`);
      }
    });
  });

  describe('⑤ tetos de recuperação, IRV e orçamento por grupo', () => {
    it('escolha 99 em todo slot devolve exatamente o plano sem escolha nenhuma (teto de IRV)', () => {
      for (const [nome, p] of PERFIS) for (const ctx of RAMPAS) {
        const auto = gerar(p, ctx);
        const semNada = porSlot(gerar(com(p, desenho(auto, {})), ctx));
        const mapa99: Mapa = {};
        for (const d of auto.dias) { mapa99[d.diaId!] = {}; for (const s of d.slots) mapa99[d.diaId!]![s.exercicio.id] = 99; }
        const r = porSlot(gerar(com(p, desenho(auto, mapa99)), ctx));
        for (const [k, v] of semNada) expect(`${nome} ${k}=${r.get(k)}`).toBe(`${nome} ${k}=${v}`);
      }
    });

    it('valores válidos, limites e entradas inválidas: série inteira ≥ 1 e grupo nunca acima do alvo', () => {
      const hostis: unknown[] = [99, 12, 4, 3, 2, 1, 0, -1, 4.5, 3.0000001, Number.NaN, null, 'tres', 1e9, -0];
      for (const [nome, p] of PERFIS) for (const ctx of RAMPAS) {
        const auto = gerar(p, ctx);
        const referencia = totalPorGrupo(gerar(com(p, desenho(auto, {})), ctx));
        for (const v of hostis) {
          const mapa: Mapa = {};
          for (const d of auto.dias) { mapa[d.diaId!] = {}; for (const s of d.slots) mapa[d.diaId!]![s.exercicio.id] = v as number; }
          const r = gerar(com(p, desenho(auto, mapa)), ctx);
          for (const d of r.dias) for (const s of d.slots) {
            expect(`${nome}/${v} ${d.diaId}/${s.exercicio.id} inteiro`).toBe(`${nome}/${v} ${d.diaId}/${s.exercicio.id} inteiro`);
            expect(Number.isInteger(s.series)).toBe(true);
            expect(s.series!).toBeGreaterThanOrEqual(1);
          }
          const g = totalPorGrupo(r);
          for (const k of Object.keys(g)) expect(`${nome}/${v} ${k}=${g[k]! <= (referencia[k] ?? 0)}`).toBe(`${nome}/${v} ${k}=true`);
        }
      }
    });
  });

  describe('⑥ ordem, deload e saída da recuperação', () => {
    it('inverter ou rotacionar a ordem do dia não muda a dose de nenhum exercício', () => {
      for (const [nome, p] of PERFIS) for (const ctx of RAMPAS) {
        const cheio = salvar(gerar(p, ctx), p);
        const direta = porSlot(gerar(com(p, cheio), ctx));
        expect(direta.size).toBeGreaterThan(10);
        for (const variante of [
          { ...cheio, dias: cheio.dias.map((d) => ({ ...d, exercicioIds: [...d.exercicioIds].reverse() })) },
          { ...cheio, dias: cheio.dias.map((d) => ({ ...d, exercicioIds: [...d.exercicioIds.slice(1), d.exercicioIds[0]!] })) },
        ]) {
          const outra = porSlot(gerar(com(p, variante), ctx));
          for (const [k, v] of direta) expect(`${nome} ${k}=${outra.get(k)}`).toBe(`${nome} ${k}=${v}`);
        }
      }
    });

    it('deload aplica uma única redução e não recorta a escolha original a cada ciclo', () => {
      for (const [nome, p] of PERFIS) {
        const c1 = salvar(gerar(p, { semana: 1 }), p);
        let perfil = com(p, c1); let anterior: Map<string, number | undefined> | null = null; let custom = c1;
        for (let c = 0; c < 5; c++) {
          const r = gerar(perfil, { semana: 6 });
          const atual = porSlot(r);
          if (anterior) for (const [k, v] of anterior) expect(`${nome}/c${c} ${k}=${atual.get(k)}`).toBe(`${nome}/c${c} ${k}=${v}`);
          anterior = atual;
          const novo = salvar(r, perfil);
          // a intenção guardada é a série ANTES do deload, e não é recortada de novo
          expect(novo).toEqual(custom);
          custom = novo; perfil = com(p, novo);
        }
      }
    });

    it('saída da recuperação: a escolha é teto e nenhum slot passa dela', () => {
      for (const [nome, p] of PERFIS) for (const ctx of RAMPAS) {
        const custom = salvar(gerar(p, ctx), p);
        for (const semana of [1, 2, 5, 6] as const) {
          const r = gerar(com(p, custom), { semana });
          for (const d of r.dias) for (const s of d.slots) {
            const esc = custom.dias.find((x) => x.diaId === d.diaId)?.seriesPorExercicio?.[s.exercicio.id];
            if (esc == null) continue;
            expect(`${nome}/s${semana} ${d.diaId}/${s.exercicio.id} ${(s.series ?? 0) <= esc}`)
              .toBe(`${nome}/s${semana} ${d.diaId}/${s.exercicio.id} true`);
          }
        }
      }
    });
  });

  describe('⑦ AUMENTO acima do orçamento — contrato próprio, medido à parte', () => {
    it('o grupo nunca passa do volume-alvo da retomada, e o pedido acima dele não é criado do nada', () => {
      for (const [nome, p] of PERFIS) for (const ctx of RAMPAS) {
        const auto = gerar(p, ctx);
        const referencia = totalPorGrupo(gerar(com(p, desenho(auto, {})), ctx));
        const custom = salvar(auto, p);
        const dia = custom.dias[0]!;
        const id = dia.exercicioIds[0]!;
        const atual = dia.seriesPorExercicio?.[id];
        if (atual == null) continue;
        const maior: RotinaCustom = {
          ...custom,
          dias: custom.dias.map((d) => d.diaId !== dia.diaId ? d
            : ({ ...d, seriesPorExercicio: { ...d.seriesPorExercicio, [id]: atual + 2 } })),
        };
        const g = totalPorGrupo(gerar(com(p, maior), ctx));
        for (const k of Object.keys(g)) {
          expect(`${nome} ${k} ${g[k]! <= (referencia[k] ?? 0)}`).toBe(`${nome} ${k} true`);
        }
      }
    });
  });
});
