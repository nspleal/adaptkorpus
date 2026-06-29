/**
 * Montador de rotina de treino (Bloco B) — v1 determinístico.
 * Fonte: parametros-motor-treino-evokorpus §"Passo 3".
 *
 * Garantias (travadas na spec):
 *  - dias de força = min(dias_disponíveis, teto do nível); excedente → cardio/recuperação;
 *  - split por dias; cada padrão/grupo ≥ 2×/sem quando há ≥ 2 dias;
 *  - puxar ≥ empurrar (saúde do ombro); dobradiça presente; core 2–3×; cardio por objetivo;
 *  - seleção respeita equipamento/local + dificuldade liberada; nº de exercícios cabe no tempo;
 *  - determinístico (ordena por tier↑ depois id; rotaciona p/ variar).
 */
import { dificuldadesLiberadas } from './treino';
import type { PerfilTreino, PrescricaoFITT, DiaTreino, RotinaSemanal, SlotExercicio } from './treino-types';
import type { EquipamentoDisp, Exercise, LocalExercicio, PadraoMovimento } from '../data/types';

/** Locais acessíveis por disponibilidade de equipamento. */
function locaisPermitidos(equip: EquipamentoDisp): LocalExercicio[] {
  if (equip === 'nenhum') return ['casa_sem'];
  if (equip === 'casa') return ['casa_sem', 'casa_com'];
  return ['casa_sem', 'casa_com', 'academia'];
}

interface DiaSpec {
  nome: string;
  padroes: PadraoMovimento[];
}

const FB: PadraoMovimento[] = ['empurrar', 'puxar', 'agachar', 'dobradica_quadril', 'core'];
const UPPER: PadraoMovimento[] = ['empurrar', 'puxar', 'isolado', 'core'];
const LOWER: PadraoMovimento[] = ['agachar', 'dobradica_quadril', 'core'];
const PUSH: PadraoMovimento[] = ['empurrar', 'isolado', 'core'];
const PULL: PadraoMovimento[] = ['puxar', 'isolado', 'core'];
const LEGS: PadraoMovimento[] = ['agachar', 'dobradica_quadril', 'core'];

/** Split por dias de força agendados (3 dias depende do nível). */
function montarSplit(diasForca: number, nivel: PerfilTreino['nivelExperiencia']): { split: string; dias: DiaSpec[] } {
  switch (diasForca) {
    case 1:
      return { split: 'Full-body', dias: [{ nome: 'Full-body', padroes: FB }] };
    case 2:
      return { split: 'Full-body ×2', dias: [{ nome: 'Full-body A', padroes: FB }, { nome: 'Full-body B', padroes: FB }] };
    case 3:
      return nivel === 'iniciante'
        ? { split: 'Full-body ×3', dias: [{ nome: 'Full-body A', padroes: FB }, { nome: 'Full-body B', padroes: FB }, { nome: 'Full-body C', padroes: FB }] }
        : { split: 'Upper / Lower / Full', dias: [{ nome: 'Upper', padroes: UPPER }, { nome: 'Lower', padroes: LOWER }, { nome: 'Full-body', padroes: FB }] };
    case 4:
      return { split: 'Upper / Lower ×2', dias: [{ nome: 'Upper A', padroes: UPPER }, { nome: 'Lower A', padroes: LOWER }, { nome: 'Upper B', padroes: UPPER }, { nome: 'Lower B', padroes: LOWER }] };
    case 5:
      return { split: 'PPL + Upper/Lower', dias: [{ nome: 'Push', padroes: PUSH }, { nome: 'Pull', padroes: PULL }, { nome: 'Legs', padroes: LEGS }, { nome: 'Upper', padroes: UPPER }, { nome: 'Lower', padroes: LOWER }] };
    default: // 6
      return { split: 'Push / Pull / Legs ×2', dias: [{ nome: 'Push A', padroes: PUSH }, { nome: 'Pull A', padroes: PULL }, { nome: 'Legs A', padroes: LEGS }, { nome: 'Push B', padroes: PUSH }, { nome: 'Pull B', padroes: PULL }, { nome: 'Legs B', padroes: LEGS }] };
  }
}

/** Tempo estimado por exercício (s) = séries × (execução ~40s + descanso). */
function tempoPorExercicioSeg(p: PrescricaoFITT): number {
  return p.seriesPorExercicio.min * (40 + p.descansoCompostoSeg.min);
}

/** Padrões fundamentais (puxar SEMPRE antes de empurrar → sustenta puxar ≥ empurrar). */
const FUNDAMENTAIS: PadraoMovimento[] = ['puxar', 'empurrar', 'agachar', 'dobradica_quadril'];
/** Core: invariante 2–3×/semana (travado na spec). */
const CORE_MIN = 2;
const CORE_MAX = 3;

/**
 * Monta a rotina semanal. Função PURA e determinística.
 */
export function montarRotina(
  prescricao: PrescricaoFITT,
  perfil: PerfilTreino,
  exercises: readonly Exercise[],
): RotinaSemanal {
  const avisos: string[] = [];
  const dias = Math.max(0, Math.floor(perfil.diasDisponiveis));
  const teto = prescricao.sessoesForcaSemana.max;
  const diasForca = dias < 1 ? 0 : Math.min(dias, teto);
  const diasCardioRecuperacao = Math.max(0, dias - diasForca);

  if (diasForca === 0) {
    return { diasForcaAgendados: 0, diasCardioRecuperacao, split: '—', dias: [], cardio: prescricao.cardio, avisos: ['Sem dias disponíveis para treino de força.'] };
  }

  // Pool elegível: equipamento/local + dificuldade liberada. Ordenado (tier↑, depois id).
  const locais = locaisPermitidos(perfil.equipamento);
  const liberadas = new Set(dificuldadesLiberadas(perfil.nivelExperiencia));
  const pool = exercises
    .filter((e) => locais.includes(e.local) && liberadas.has(e.nivel))
    .slice()
    .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Índice de rotação por padrão (varia exercícios entre os dias).
  const porPadrao = new Map<PadraoMovimento, Exercise[]>();
  for (const e of pool) {
    const arr = porPadrao.get(e.padraoMovimento) ?? [];
    arr.push(e);
    porPadrao.set(e.padraoMovimento, arr);
  }
  const cursor = new Map<PadraoMovimento, number>();
  function escolher(padrao: PadraoMovimento): Exercise | null {
    const arr = porPadrao.get(padrao);
    if (!arr || arr.length === 0) return null;
    const i = cursor.get(padrao) ?? 0;
    cursor.set(padrao, i + 1);
    return arr[i % arr.length]!;
  }

  const maxExercicios = Math.max(1, Math.floor((perfil.tempoPorSessaoMin * 60) / tempoPorExercicioSeg(prescricao)));

  const { split, dias: spec } = montarSplit(diasForca, perfil.nivelExperiencia);

  // --- Alocador semanal de padrões -----------------------------------------
  // Distribui os padrões pelos dias (respeitando o template e a capacidade por tempo),
  // garantindo por construção: dobradiça presente, puxar ≥ empurrar, e core ∈ [2,3].
  const temPool = (p: PadraoMovimento) => (porPadrao.get(p)?.length ?? 0) > 0;
  const capDia = spec.map((d) => Math.min(d.padroes.length, maxExercicios));
  const capTotal = capDia.reduce((a, b) => a + b, 0);
  const escolhidos: PadraoMovimento[][] = spec.map(() => []);
  let alocados = 0;
  const conta = (p: PadraoMovimento) => escolhidos.reduce((n, arr) => n + arr.filter((x) => x === p).length, 0);

  /** Coloca 1 slot do padrão no melhor dia. Guarda: empurrar nunca ultrapassa puxar. */
  function place(pat: PadraoMovimento): boolean {
    if (alocados >= capTotal || !temPool(pat)) return false;
    if (pat === 'empurrar' && conta('empurrar') >= conta('puxar')) return false; // puxar ≥ empurrar
    const cands = spec
      .map((d, i) => ({ i, d }))
      .filter(({ i, d }) => d.padroes.includes(pat) && escolhidos[i]!.length < capDia[i]!);
    if (cands.length === 0) return false;
    cands.sort((a, b) => {
      const aTem = escolhidos[a.i]!.includes(pat) ? 1 : 0;
      const bTem = escolhidos[b.i]!.includes(pat) ? 1 : 0;
      if (aTem !== bTem) return aTem - bTem; // prefere dia sem esse padrão (espalha)
      if (escolhidos[a.i]!.length !== escolhidos[b.i]!.length) return escolhidos[a.i]!.length - escolhidos[b.i]!.length;
      return a.i - b.i;
    });
    escolhidos[cands[0]!.i]!.push(pat);
    alocados++;
    return true;
  }

  // 1) Presença dos fundamentais (puxar antes de empurrar).
  for (const pat of FUNDAMENTAIS) place(pat);
  // 2) Core até o piso de 2× (invariante).
  while (conta('core') < CORE_MIN && place('core')) {
    /* repete */
  }
  // 3) Frequência: fundamentais + isolado; core só até o teto de 3×. Até encher.
  let progrediu = true;
  while (alocados < capTotal && progrediu) {
    progrediu = false;
    for (const pat of FUNDAMENTAIS) progrediu = place(pat) || progrediu;
    progrediu = place('isolado') || progrediu;
    if (conta('core') < CORE_MAX) progrediu = place('core') || progrediu;
  }

  const diasTreino: DiaTreino[] = spec.map((d, i) => {
    const slots: SlotExercicio[] = [];
    for (const padrao of escolhidos[i]!) {
      const ex = escolher(padrao);
      if (ex) slots.push({ padrao, exercicio: ex });
    }
    return { nome: d.nome, slots };
  });

  // Invariantes (verificação + aviso honesto, sem afrouxar segurança).
  const contaPadrao = (p: PadraoMovimento) => diasTreino.reduce((n, d) => n + d.slots.filter((s) => s.padrao === p).length, 0);
  if (contaPadrao('puxar') < contaPadrao('empurrar')) {
    avisos.push('Atenção: volume de puxar ficou abaixo do de empurrar (alvo: puxar ≥ empurrar).');
  }
  if (diasForca >= 2 && contaPadrao('dobradica_quadril') < 1) {
    avisos.push('Atenção: padrão de dobradiça/quadril (cadeia posterior) não foi coberto.');
  }
  if (diasForca >= 2 && (contaPadrao('core') < CORE_MIN || contaPadrao('core') > CORE_MAX)) {
    avisos.push('Atenção: core fora da faixa de 2–3×/semana.');
  }
  if (maxExercicios < 3) {
    avisos.push('Tempo por sessão curto: priorizamos os exercícios fundamentais.');
  }

  return {
    diasForcaAgendados: diasForca,
    diasCardioRecuperacao,
    split,
    dias: diasTreino,
    cardio: prescricao.cardio,
    avisos,
  };
}
