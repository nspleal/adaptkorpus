/**
 * 🔒 COBERTURA NO TETO — catálogo-limitado vs orçamento-limitado (DF do autor 2026-08-15).
 *
 * 🔑 Por que existe: o guard de cobertura avisa "volume de {grupo} abaixo do mínimo". Em
 * casa sem equipamento esse aviso podia ser INACIONÁVEL — a pessoa não tem como acrescentar
 * volume de ombro, porque só há 1 exercício direto de ombro no catálogo. Mesmo defeito do
 * "Faltam 150 min" que já saiu: acusar o que a pessoa não pode consertar.
 *
 * A distinção, medida no TETO (nunca no plano do dia que a pessoa escolheu):
 *   · catálogo-limitado ⇔ o grupo NÃO alcança o MEV nem no orçamento MÁXIMO do nível
 *     (máx. sessões × máx. séries), com o equipamento atual — E existe um item do checklist
 *     que o fecharia. É propriedade de (catálogo × equipamento × nível × objetivo), não do
 *     plano atual: `posterior` a 2 dias fica abaixo mas SOBE com mais dias — é orçamento,
 *     não catálogo, e não recebe esta mensagem.
 *   · caso contrário → o guard segue como está ("abaixo do mínimo"): ou alcança no teto
 *     (orçamento) ou nem o equipamento fecha (estrutural do nível). Não se inventa aviso.
 *
 * 🔒 REUSA o alocador — NUNCA reimplementa a conta: `alocarSemana` monta o pico e
 * `creditoPonderadoDaSemana` conta. Chama `alocarSemana` direto (não `montarRotina`) para o
 * guard não recorrer em si mesmo. Memoizado por (nível × objetivo × equipamento): é
 * classificação, não conta por usuário — o espaço é finito e pequeno.
 */
import {
  alocarSemana, creditoPonderadoDaSemana, GRUPOS_GRANDES, GRUPOS_PEQUENOS_PISO,
  orcamentoSlotsDoDia, PEQUENOS_TETO_DIRETO, templatesDaSemana,
} from './alocador';
import { dificuldadesLiberadas, prescreverTreino } from './treino';
import { avaliarGateTreino } from './treino-gate';
import { mev } from './trilhos';
import { exercicioDisponivel, EQUIPAMENTOS_CASA, ROTULO_EQUIPAMENTO_CASA } from './equipamento';
import { ROTULO_GRUPO } from '../frequencia-grupos';
import type { EquipamentoCasa, EquipamentoDisp, Exercise, GrupoPrimario } from '../data/types';
import type { NivelExperiencia, PerfilTreino } from './treino-types';
import type { Objetivo } from './types';

/** Invariante do core (idêntica à do montador — cofre §core, DF 2026-08-05). */
const CORE_MIN = 2;
const CORE_MAX = 3;

/**
 * Ordem de MINIMALIDADE do checklist (DF do autor: "o mínimo é um elástico"). Acessibilidade
 * crescente — o primeiro item desta ordem que FECHA o grupo é o recomendado. Não é hardcode
 * do resultado: qual fecha cada (grupo × nível) é medido no teto; isto só desempata "menor".
 */
const ORDEM_MINIMALIDADE: readonly EquipamentoCasa[] = [
  'elastico', 'halteres', 'kettlebell', 'barra_fixa', 'banco', 'corda_pular', 'roda_abdominal',
];

const SEM_FLAGS = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

const cacheTeto = new WeakMap<readonly Exercise[], Map<string, Map<GrupoPrimario, number>>>();

/**
 * Crédito ponderado de PICO por grupo = orçamento máximo do nível (máx. sessões × 180 min)
 * com séries máximas. Memoizado por (nível × objetivo × equipamento × checklist).
 */
export function tetoPonderado(
  exercises: readonly Exercise[],
  nivel: NivelExperiencia,
  objetivo: Objetivo,
  equipamento: EquipamentoDisp,
  equipamentosCasa: readonly EquipamentoCasa[] | undefined,
): ReadonlyMap<GrupoPrimario, number> {
  let porArray = cacheTeto.get(exercises);
  if (!porArray) { porArray = new Map(); cacheTeto.set(exercises, porArray); }
  const chave = `${nivel}|${objetivo}|${equipamento}|${[...(equipamentosCasa ?? [])].sort().join(',')}`;
  const hit = porArray.get(chave);
  if (hit) return hit;
  const res = computarTeto(exercises, nivel, objetivo, equipamento, equipamentosCasa);
  porArray.set(chave, res);
  return res;
}

function computarTeto(
  exercises: readonly Exercise[],
  nivel: NivelExperiencia,
  objetivo: Objetivo,
  equipamento: EquipamentoDisp,
  equipamentosCasa: readonly EquipamentoCasa[] | undefined,
): Map<GrupoPrimario, number> {
  const perfil = {
    pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM_FLAGS, objetivo,
    nivelExperiencia: nivel, equipamento,
    ...(equipamentosCasa ? { equipamentosCasa } : {}),
    diasDisponiveis: 6, tempoPorSessaoMin: 180,
  } as PerfilTreino;
  const gate = avaliarGateTreino(perfil);
  if (gate.comportamento === 'ROTEAR') return new Map(); // sem treino → sem teto
  const presc = prescreverTreino(perfil, gate);
  const diasForca = presc.sessoesForcaSemana.max; // teto de sessões do nível
  const { dias: templates } = templatesDaSemana(diasForca, nivel, 'auto');
  const budgetPorDia = orcamentoSlotsDoDia(180);
  const liberadas = new Set(dificuldadesLiberadas(nivel));
  const pool = exercises
    .filter((e) => exercicioDisponivel(e, equipamento, equipamentosCasa) && liberadas.has(e.nivel))
    .slice()
    .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const alvoPonderado = new Map<GrupoPrimario, number>();
  for (const g of [...GRUPOS_GRANDES, ...GRUPOS_PEQUENOS_PISO, 'core' as GrupoPrimario]) alvoPonderado.set(g, presc.volumePorGrupoSemana.max);
  const sPlan = presc.seriesPorExercicio.max;
  const dias = alocarSemana({
    templates, budgetPorDia, pool, favoritos: new Set(), alvoPonderado,
    seriesPlanejamento: sPlan,
    tetoSlotsSemana: (g) => ((GRUPOS_PEQUENOS_PISO as readonly string[]).includes(g) ? PEQUENOS_TETO_DIRETO : Number.POSITIVE_INFINITY),
    coreMin: CORE_MIN, coreMax: CORE_MAX, preencherAteOrcamento: false,
  });
  // O alocador planeja todo slot em `sPlan`; o crédito de pico usa essa série.
  return creditoPonderadoDaSemana(dias.flatMap((d) => d.slots.map((s) => ({ exercicio: s.exercicio, series: sPlan }))));
}

/** Um grupo catálogo-limitado + o equipamento MÍNIMO que o fecha + os exercícios que entram. */
export interface CoberturaCatalogo {
  grupo: GrupoPrimario;
  equipamento: EquipamentoCasa;
  /** nomePt dos exercícios diretos que o equipamento desbloqueia (top 1–2 por tier). */
  exercicios: string[];
}

/**
 * Classifica um GRANDE que ficou abaixo do MEV nesta semana. Devolve a classificação de
 * catálogo (grupo × equipamento mínimo × exercícios) SE — e só se — o grupo não alcança o
 * MEV nem no teto E um item do checklist o fecharia. Caso contrário devolve `null` (o guard
 * mantém "abaixo do mínimo": orçamento-limitado ou estrutural do nível).
 */
export function classificarCoberturaCatalogo(
  exercises: readonly Exercise[],
  grupo: GrupoPrimario,
  nivel: NivelExperiencia,
  objetivo: Objetivo,
  equipamento: EquipamentoDisp,
  equipamentosCasa: readonly EquipamentoCasa[] | undefined,
): CoberturaCatalogo | null {
  // Academia já tem tudo — não há checklist para marcar; abaixo lá é estrutural do nível.
  if (equipamento === 'academia') return null;
  const piso = mev(nivel, objetivo);
  const base = tetoPonderado(exercises, nivel, objetivo, equipamento, equipamentosCasa);
  if ((base.get(grupo) ?? 0) >= piso) return null; // alcança no teto → orçamento, não catálogo
  const jaMarcados = new Set(equipamentosCasa ?? []);
  for (const eqp of ORDEM_MINIMALIDADE) {
    if (jaMarcados.has(eqp)) continue;
    const casaComEqp: readonly EquipamentoCasa[] = [...(equipamentosCasa ?? []), eqp];
    const comEqp = tetoPonderado(exercises, nivel, objetivo, 'casa', casaComEqp);
    if ((comEqp.get(grupo) ?? 0) < piso) continue; // este não fecha — tenta o próximo
    const exercicios = exercises
      .filter((e) => e.grupoPrimario === grupo
        && !exercicioDisponivel(e, equipamento, equipamentosCasa)
        && exercicioDisponivel(e, 'casa', casaComEqp))
      .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, 2)
      .map((e) => e.nomePt);
    return { grupo, equipamento: eqp, exercicios };
  }
  return null; // abaixo no teto mas NENHUM equipamento fecha → estrutural; não se inventa aviso
}

/** Frase honesta do limite de catálogo (molde do autor). Descreve o limite; não acusa, não vende. */
export function mensagemCoberturaCatalogo(c: CoberturaCatalogo): string {
  const grupo = (ROTULO_GRUPO[c.grupo] ?? c.grupo).toLowerCase();
  const eqp = ROTULO_EQUIPAMENTO_CASA[c.equipamento];
  const exs = c.exercicios.length <= 1
    ? (c.exercicios[0] ?? 'novos exercícios')
    : `${c.exercicios.slice(0, -1).join(', ')} e ${c.exercicios[c.exercicios.length - 1]}`;
  return `Chegamos ao limite de ${grupo} sem equipamento. Marque ${eqp} no seu perfil e entram ${exs} — aí ${grupo} alcança o volume ideal.`;
}
