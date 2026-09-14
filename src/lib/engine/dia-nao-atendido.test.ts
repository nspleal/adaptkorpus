import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { gerarTreino } from '@/lib/engine';
import type { PerfilTreino } from '@/lib/engine';
import { EXERCISES_SEED } from '@/lib/data/seed';
import { diasPadrao, type Weekday } from '@/lib/semana';
import { locaisPermitidos } from './treino-montador';

/**
 * 🔴 D14 (auditoria 2026-09-11 sobre `a40f8af`) — DIA VAZIO NÃO É SESSÃO ENTREGUE.
 *
 * Medido: `dias[0] = { nome: "Push", slots: [], slotsNaoPreenchidos: 3 }` contado em
 * `diasForcaAgendados: 5`, com `duracaoDias[0] = {CALCULADO, DENTRO_DO_LIMITE, min 0, max 0}`
 * e o plano inteiro `CERTIFICADO` 🟢. 28 combinações de perfil produziam o caso. Havia aviso
 * nomeando o dia — não era perda silenciosa —, mas a sessão vazia era entregue como sessão e
 * um dia de 0 s sustentava o selo de que "cabe nos limites".
 *
 * 🔒 O que este arquivo trava:
 *   · o dia PEDIDO continua no plano (em `diasNaoAtendidos`, com motivo) — não some;
 *   · ele não entra em `dias`, não conta em `diasForcaAgendados` e não entra na certificação;
 *   · a agenda SOLICITADA continua fechando: entregues + não atendidos + recuperação;
 *   · nada é redistribuído nem preenchido com exercício fora do equipamento declarado.
 */

const base = (o: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 75, alturaCm: 175, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'emagrecimento', nivelExperiencia: 'avancado', equipamento: 'casa', equipamentosCasa: [],
  diasDisponiveis: 5, treinoDias: diasPadrao(5) as Weekday[], tempoPorSessaoMin: 20, ...o,
});

const gerar = (p: PerfilTreino, semana: 1 | 6 = 1) =>
  gerarTreino(p, { exercises: EXERCISES_SEED, semanaCiclo: { semana } }).rotina!;

describe('D14 · o caso medido pela auditoria', () => {
  const r = gerar(base());

  it('anti-vacuidade: o perfil REALMENTE deixa um dia sem exercício', () => {
    expect(r.diasNaoAtendidos, 'o caso sumiu — a fixture precisa de outro perfil').toBeDefined();
    expect(r.diasNaoAtendidos!.length).toBeGreaterThan(0);
  });

  it('o dia não atendido é nomeado, com motivo — e fica FORA das sessões entregues', () => {
    const naoAtendido = r.diasNaoAtendidos![0]!;
    expect(naoAtendido.nome).toBe('Push');
    expect(naoAtendido.motivo).toBe('EQUIPAMENTO');
    expect(naoAtendido.slotsPedidos).toBeGreaterThan(0);
    expect(r.dias.map((d) => d.nome)).not.toContain('Push');
    expect(r.dias.every((d) => d.slots.length > 0), 'sessão vazia ainda entregue').toBe(true);
  });

  it('o contador de sessões é a ENTREGA, não a agenda', () => {
    expect(r.diasForcaAgendados).toBe(r.dias.length);
    expect(r.diasForcaAgendados).toBe(4);
  });

  it('a certificação não se apoia mais num dia de 0 s', () => {
    const zerados = (r.duracaoDias ?? []).filter((d) => d.duracaoMaximaEstimadaSegundos === 0);
    expect(zerados).toEqual([]);
  });

  it('o motivo continua DITO em prosa pelo motor (o aviso de sempre, intacto)', () => {
    expect(r.avisos.join(' ')).toMatch(/Seu equipamento disponível limita este dia: Push/);
  });
});

describe('D14 · agenda solicitada × entrega efetiva', () => {
  /** As combinações de nível avançado que a auditoria contou (28 casos na varredura dela). */
  const GRADE: PerfilTreino[] = [];
  for (const obj of ['emagrecimento', 'massa', 'saude'] as const)
    for (const eq of ['casa', 'nenhum', 'academia'] as const)
      for (const t of [10, 15, 20, 30, 45, 60])
        for (const d of [3, 4, 5, 6])
          GRADE.push(base({
            objetivo: obj, equipamento: eq, ...(eq === 'casa' ? { equipamentosCasa: [] } : {}),
            tempoPorSessaoMin: t, diasDisponiveis: d, treinoDias: diasPadrao(d) as Weekday[],
          }));

  it('a conta da agenda fecha em TODA a grade: entregues + não atendidos + recuperação', () => {
    const quebras: string[] = [];
    for (const p of GRADE) {
      const r = gerar(p);
      const soma = r.dias.length + (r.diasNaoAtendidos?.length ?? 0) + r.diasCardioRecuperacao;
      if (soma !== p.treinoDias!.length) {
        quebras.push(`${p.objetivo}/${p.equipamento}/${p.tempoPorSessaoMin}min/${p.diasDisponiveis}d: ${soma} ≠ ${p.treinoDias!.length}`);
      }
    }
    expect(quebras).toEqual([]);
  });

  it('nenhuma sessão vazia é entregue, e nenhum CERTIFICADO se apoia em dia de 0 s', () => {
    const quebras: string[] = [];
    for (const p of GRADE) for (const semana of [1, 6] as const) {
      const r = gerar(p, semana);
      const rotulo = `${p.objetivo}/${p.equipamento}/${p.tempoPorSessaoMin}min/${p.diasDisponiveis}d/S${semana}`;
      if (r.dias.some((d) => d.slots.length === 0)) quebras.push(`${rotulo}: sessão vazia entregue`);
      if (r.diasForcaAgendados !== r.dias.length) quebras.push(`${rotulo}: contador ${r.diasForcaAgendados} ≠ ${r.dias.length}`);
      if (r.resultadoGeracao?.tipo === 'CERTIFICADO' && (r.duracaoDias ?? []).some((d) => d.duracaoMaximaEstimadaSegundos === 0)) {
        quebras.push(`${rotulo}: CERTIFICADO com dia de 0 s`);
      }
    }
    expect(quebras).toEqual([]);
  });

  it('anti-vacuidade da grade: ela contém casos de dia não atendido', () => {
    const comBuraco = GRADE.filter((p) => (gerar(p).diasNaoAtendidos?.length ?? 0) > 0);
    expect(comBuraco.length, 'a grade não exercita o caso — as travas acima seriam vazias').toBeGreaterThan(0);
  });
});

describe('D14 · sem redistribuição silenciosa e sem exercício incompatível', () => {
  const p = base();
  const r = gerar(p);

  it('o dia não atendido não vira dia de cardio', () => {
    expect(r.diasCardio.length).toBe(r.diasCardioRecuperacao);
    // A agenda pedida tinha 5 dias de força; o dia sem exercício não foi convertido em nada.
    expect(r.diasCardioRecuperacao).toBe(0);
    expect(r.diasNaoAtendidos!.length).toBe(1);
  });

  it('os dias entregues continuam dentro do equipamento declarado', () => {
    const locais = new Set(locaisPermitidos(p.equipamento));
    for (const d of r.dias) for (const s of d.slots) {
      expect(locais.has(s.exercicio.local), `${s.exercicio.id} fora de ${p.equipamento}`).toBe(true);
    }
  });

  it('os dias pedidos não foram remanejados: os entregues seguem a ordem da agenda', () => {
    const pedidos = p.treinoDias!;
    const entregues = r.dias.map((d) => d.diaId).filter(Boolean) as Weekday[];
    const naoAtendidos = (r.diasNaoAtendidos ?? []).map((d) => d.diaId).filter(Boolean) as Weekday[];
    for (const dia of [...entregues, ...naoAtendidos]) expect(pedidos).toContain(dia);
    expect(entregues).toEqual(pedidos.filter((d) => !naoAtendidos.includes(d)).slice(0, entregues.length));
  });
});

describe('D14 · o desenho manual segue a mesma régua', () => {
  it('dia manual que ficou sem exercício elegível não é entregue como sessão', () => {
    const p = base({
      equipamento: 'nenhum', equipamentosCasa: [], diasDisponiveis: 2, treinoDias: ['seg', 'qua'] as Weekday[],
      tempoPorSessaoMin: 60,
      rotinaCustom: {
        origem: 'usuario',
        dias: [
          { nome: 'Dia A', diaId: 'seg', exercicioIds: ['e1'] },
          // Só exercícios de academia: com "nenhum equipamento" o dia fica sem nada elegível.
          { nome: 'Dia B', diaId: 'qua', exercicioIds: ['naoexiste-1', 'naoexiste-2'] },
        ],
      },
    });
    const r = gerar(p);
    expect(r.dias.every((d) => d.slots.length > 0)).toBe(true);
    expect(r.dias.map((d) => d.nome)).not.toContain('Dia B');
    expect((r.diasNaoAtendidos ?? []).map((d) => d.nome)).toContain('Dia B');
    expect(r.diasForcaAgendados).toBe(r.dias.length);
  });
});

describe('D14 · a tela mostra o dia não atendido e não oferece sessão vazia', () => {
  const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');

  it('o componente existe, é renderizado e nomeia o motivo', () => {
    expect(painel).toMatch(/<DiasNaoAtendidos dias=\{rotina\?\.diasNaoAtendidos\} \/>/);
    expect(painel).toMatch(/function DiasNaoAtendidos/);
    for (const motivo of ['EQUIPAMENTO', 'TETO_SEMANAL']) expect(painel).toContain(`'${motivo}'`);
  });

  it('o bloco do dia não atendido não oferece iniciar nem registrar', () => {
    const inicio = painel.indexOf('function DiasNaoAtendidos');
    const bloco = painel.slice(inicio, painel.indexOf('function TreinoTab'));
    expect(bloco).not.toMatch(/onIniciar|iniciarSessaoGuiada|onRegistrarTreino|<button/);
  });

  it('a lista de dias selecionáveis é a das sessões entregues (o vazio não é selecionável)', () => {
    // `dias` do TreinoTab vem de `rotinaDias`, que é `treino.rotina.dias` — já sem o dia vazio.
    expect(painel).toMatch(/useState<DiaTreino\[\]>\(treino\.rotina\?\.dias \?\? \[\]\)/);
  });
});

// Fotografia/autoridade histórica: o seletor é congelado na etapa 1.
// As novas divisões reais são cobradas em distribuicao-etapa2.test.ts e na matriz externa.
vi.mock('./selecao-divisao', () => import('./__fixtures__/selecao-etapa1'));
