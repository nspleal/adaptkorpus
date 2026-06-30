/**
 * Motor de substituição (F.2) — seletor determinístico de troca.
 * Fonte: conceitos/parametros-motor-substituicao-evokorpus (DFs travadas 2026-06-29).
 *
 * Forma comum aos dois lados: filtros DUROS → preferência ordenada → desempate
 * determinístico → fallback. Segurança (alérgeno) e identidade (vegano/veg) NUNCA
 * relaxam; só o GOSTO cede, por último.
 */
import { macrosDePrato } from '../data/nutrition';
import { ESCALA_PORCAO } from './constants';
import { dificuldadesLiberadas } from './treino';
import { locaisPermitidos } from './treino-montador';
import type { Recipe, RecipeMacros } from '../data/types';
import type {
  PedidoSubExercicio,
  PedidoSubPrato,
  ResultadoSubExercicio,
  ResultadoSubPrato,
} from './substituicao-types';

const EPS = 1e-6;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
function escalarMacros(m: RecipeMacros, s: number): RecipeMacros {
  return { kcal: m.kcal * s, proteinaG: m.proteinaG * s, carboidratoG: m.carboidratoG * s, gorduraG: m.gorduraG * s };
}

function preferenciaAceita(tipo: Recipe['tipo'], pref: PedidoSubPrato['restricoes']['preferencia']): boolean {
  if (!pref) return true;
  if (pref === 'vegano') return tipo === 'vegano';
  if (pref === 'vegetariano') return tipo === 'vegano' || tipo === 'vegetariano';
  return true;
}

function somar(a: RecipeMacros, b: RecipeMacros): RecipeMacros {
  return {
    kcal: a.kcal + b.kcal,
    proteinaG: a.proteinaG + b.proteinaG,
    carboidratoG: a.carboidratoG + b.carboidratoG,
    gorduraG: a.gorduraG + b.gorduraG,
  };
}
function subtrair(a: RecipeMacros, b: RecipeMacros): RecipeMacros {
  return {
    kcal: a.kcal - b.kcal,
    proteinaG: a.proteinaG - b.proteinaG,
    carboidratoG: a.carboidratoG - b.carboidratoG,
    gorduraG: a.gorduraG - b.gorduraG,
  };
}

/**
 * Substitui um prato no mesmo slot. Função PURA e determinística.
 * Filtros DUROS: alérgeno · identidade · slot · janela de kcal do dia · piso de proteína do dia.
 * Ordena por MENOR DESVIO calórico do prato trocado (estrita) → proteína → tipo → carbo/gord → id.
 * Gosto é relaxável (fallback). Nunca relaxa alérgeno/identidade/janela/piso.
 */
export function substituirPrato(p: PedidoSubPrato): ResultadoSubPrato {
  // Contribuição do prato trocado JÁ escalada (a porção que ele ocupa no dia).
  const escalaAtual = p.escalaAtual ?? 1;
  const xm = escalarMacros(macrosDePrato(p.pratoAtual, p.foodsById), escalaAtual);
  const diaSemX = subtrair(p.totaisDiaAtual, xm);
  const pisoProteinaDia = p.plano.macros.proteinaPisoG;
  const { minKcal, maxKcal } = p.plano.janela;

  const excluirPratos = new Set(p.gosto?.excluirPratoIds ?? []);
  const excluirAlimentos = new Set(p.gosto?.excluirAlimentoIds ?? []);

  interface Cand {
    y: Recipe;
    escala: number;
    ym: RecipeMacros; // já escalada
    diaNew: RecipeMacros;
  }

  // Filtros DUROS (segurança/identidade/slot/janela/piso) — nunca relaxados.
  // ESCALA: o prato novo é escalado à EQUIVALÊNCIA CALÓRICA do trocado (spec dieta:
  // "mínimo = equivalência calórica"), dentro da faixa realista (ESCALA_PORCAO), para
  // manter o dia dentro da janela.
  const duros: Cand[] = [];
  for (const y of p.recipes) {
    if (y.id === p.pratoAtual.id) continue;
    if (!y.refeicoes.includes(p.slot)) continue;
    if (y.contemAlergenos.some((a) => p.restricoes.alergenos.includes(a))) continue;
    if (!preferenciaAceita(y.tipo, p.restricoes.preferencia)) continue;
    const ymBase = macrosDePrato(y, p.foodsById);
    if (ymBase.kcal <= 0) continue;
    const escala = clamp(xm.kcal / ymBase.kcal, ESCALA_PORCAO.min, ESCALA_PORCAO.max);
    const ym = escalarMacros(ymBase, escala);
    const diaNew = somar(diaSemX, ym);
    if (diaNew.kcal < minKcal - EPS || diaNew.kcal > maxKcal + EPS) continue;
    if (diaNew.proteinaG < pisoProteinaDia - EPS) continue;
    duros.push({ y, escala, ym, diaNew });
  }

  // Gosto (relaxável).
  const gostoOk = (y: Recipe) =>
    !excluirPratos.has(y.id) &&
    !(excluirAlimentos.size > 0 && y.itens.some((it) => excluirAlimentos.has(it.alimentoId)));

  const ordenar = (cands: Cand[]) =>
    cands.slice().sort((A, B) => {
      const dk = Math.abs(A.ym.kcal - xm.kcal) - Math.abs(B.ym.kcal - xm.kcal);
      if (Math.abs(dk) > EPS) return dk;
      const dp = Math.abs(A.ym.proteinaG - xm.proteinaG) - Math.abs(B.ym.proteinaG - xm.proteinaG);
      if (Math.abs(dp) > EPS) return dp;
      const tA = A.y.tipo === p.pratoAtual.tipo ? 0 : 1;
      const tB = B.y.tipo === p.pratoAtual.tipo ? 0 : 1;
      if (tA !== tB) return tA - tB;
      const cgA = Math.abs(A.ym.carboidratoG - xm.carboidratoG) + Math.abs(A.ym.gorduraG - xm.gorduraG);
      const cgB = Math.abs(B.ym.carboidratoG - xm.carboidratoG) + Math.abs(B.ym.gorduraG - xm.gorduraG);
      if (Math.abs(cgA - cgB) > EPS) return cgA - cgB;
      return A.y.id < B.y.id ? -1 : A.y.id > B.y.id ? 1 : 0; // chave final: id lexicográfico
    });

  const comGosto = ordenar(duros.filter((c) => gostoOk(c.y)));
  if (comGosto.length > 0) {
    const c = comGosto[0]!;
    return { status: 'ok', prato: c.y, escala: c.escala, macrosNovo: c.ym, totaisDiaNovo: c.diaNew, gostoRelaxado: false };
  }
  // Fallback: relaxa o GOSTO (mantém todos os filtros duros).
  const semGosto = ordenar(duros);
  if (semGosto.length > 0) {
    const c = semGosto[0]!;
    return {
      status: 'ok',
      prato: c.y,
      escala: c.escala,
      macrosNovo: c.ym,
      totaisDiaNovo: c.diaNew,
      gostoRelaxado: true,
      nota: 'Relaxamos sua preferência de gosto para manter o dia equilibrado (segurança, identidade e dieta preservadas).',
    };
  }
  return {
    status: 'sinalizado',
    prato: null,
    escala: null,
    macrosNovo: null,
    totaisDiaNovo: null,
    gostoRelaxado: false,
    nota: 'Não achei uma troca que mantenha seu dia equilibrado sem afrouxar segurança/identidade/dieta. Mantivemos o prato atual.',
  };
}

/**
 * Lista até `max` substitutos de prato DISTINTOS para montar o seletor de troca.
 *
 * `substituirPrato` devolve UM melhor candidato e RELAXA o gosto (`excluirPratoIds`) no
 * fallback — então, chamado em laço, pode repetir o mesmo prato quando a janela do dia
 * deixa poucos elegíveis. Aqui deduplicamos: bloqueamos cada id já devolvido e paramos
 * quando o motor repete (sinal de que o pool elegível se esgotou). Garante lista sem
 * duplicatas — quem chama mostra 1, 2 ou 3 opções reais, nunca a mesma três vezes.
 * Função PURA e determinística.
 */
export function listarSubstituicoesPrato(p: PedidoSubPrato, max = 3): ResultadoSubPrato[] {
  const bloqueados = new Set<string>(p.gosto?.excluirPratoIds ?? []);
  const out: ResultadoSubPrato[] = [];
  for (let k = 0; k < max; k++) {
    const rr = substituirPrato({ ...p, gosto: { ...p.gosto, excluirPratoIds: [...bloqueados] } });
    if (rr.status === 'ok' && rr.prato && !bloqueados.has(rr.prato.id)) {
      out.push(rr);
      bloqueados.add(rr.prato.id);
    } else break;
  }
  return out;
}

/**
 * Substitui um exercício. Função PURA e determinística.
 * Filtros DUROS: equipamento/local · tipo compatível · dificuldade ≤ liberada pelo nível.
 * Preservação: grupo muscular → padrão. Desempate: mesma dificuldade → MAIS FAMILIAR
 * (tier T1) → id lexicográfico. Gosto/variedade são relaxáveis (fallback).
 * NÃO substitui por dor/lesão — isso é pausa + aviso no motor de treino (re-check).
 */
export function substituirExercicio(p: PedidoSubExercicio): ResultadoSubExercicio {
  const atual = p.exercicioAtual;
  const locais = locaisPermitidos(p.equipamento);
  const liberadas = new Set(dificuldadesLiberadas(p.nivelExperiencia));
  const evitar = new Set(p.historicoRecenteIds ?? []);
  const gostoExcluir = new Set(p.gostoExcluirIds ?? []);

  // Há algum candidato de mesmo tipo elegível? (decide a degradação do pliométrico)
  const baseElegivel = (y: typeof atual) =>
    y.id !== atual.id && locais.includes(y.local) && liberadas.has(y.nivel);
  const temMesmoTipo = p.exercises.some((y) => baseElegivel(y) && y.tipo === atual.tipo);

  function tipoCompativel(y: typeof atual): boolean {
    if (y.tipo === atual.tipo) return true;
    // Pliométrico sem pliométrico elegível → força do MESMO padrão; se nem isso (ex.: skater,
    // padrão Cardio, sem força nesse padrão) → último recurso = MESMO PADRÃO, qualquer tipo
    // ("cruzar tipo dentro do padrão" — opção travada da spec p/ o caso skater #151).
    if (atual.tipo === 'pliometrico' && !temMesmoTipo) {
      if (y.tipo === 'forca_hipertrofia' && y.padraoMovimento === atual.padraoMovimento) return true;
      const temForcaMesmoPadrao = p.exercises.some(
        (z) => baseElegivel(z) && z.tipo === 'forca_hipertrofia' && z.padraoMovimento === atual.padraoMovimento,
      );
      if (!temForcaMesmoPadrao && y.padraoMovimento === atual.padraoMovimento) return true;
    }
    return false;
  }

  const duros = p.exercises.filter((y) => baseElegivel(y) && tipoCompativel(y));

  const ordenar = (cands: typeof duros) =>
    cands.slice().sort((a, b) => {
      const ga = a.grupoMuscular === atual.grupoMuscular ? 0 : 1;
      const gb = b.grupoMuscular === atual.grupoMuscular ? 0 : 1;
      if (ga !== gb) return ga - gb; // preserva grupo muscular
      const pa = a.padraoMovimento === atual.padraoMovimento ? 0 : 1;
      const pb = b.padraoMovimento === atual.padraoMovimento ? 0 : 1;
      if (pa !== pb) return pa - pb; // preserva padrão
      const da = a.nivel === atual.nivel ? 0 : 1;
      const db = b.nivel === atual.nivel ? 0 : 1;
      if (da !== db) return da - db; // mesma dificuldade
      const ta = a.tier ?? 99;
      const tb = b.tier ?? 99;
      if (ta !== tb) return ta - tb; // mais familiar (T1 = menor)
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // chave final: id lexicográfico
    });

  // Primário: exclui gosto + variedade (relaxáveis).
  const primario = ordenar(duros.filter((y) => !gostoExcluir.has(y.id) && !evitar.has(y.id)));
  if (primario.length > 0) {
    return { status: 'ok', exercicio: primario[0]!, gostoRelaxado: false };
  }
  // Fallback: relaxa gosto/variedade (mantém equipamento/tipo/dificuldade).
  const fallback = ordenar(duros);
  if (fallback.length > 0) {
    return {
      status: 'ok',
      exercicio: fallback[0]!,
      gostoRelaxado: true,
      nota: 'Relaxamos a variedade/gosto por falta de alternativa; equipamento e segurança preservados.',
    };
  }
  return {
    status: 'sinalizado',
    exercicio: null,
    gostoRelaxado: false,
    nota: 'Não há substituto elegível para o equipamento/nível atuais. Mantivemos o exercício.',
  };
}

/**
 * Lista até `max` substitutos de exercício DISTINTOS para o seletor de troca. Mesma lógica
 * de `listarSubstituicoesPrato`: `substituirExercicio` relaxa variedade no fallback, então
 * deduplicamos por id e paramos quando repete. PURA e determinística.
 */
export function listarSubstituicoesExercicio(p: PedidoSubExercicio, max = 3): ResultadoSubExercicio[] {
  const bloqueados = new Set<string>(p.historicoRecenteIds ?? []);
  const out: ResultadoSubExercicio[] = [];
  for (let k = 0; k < max; k++) {
    const rr = substituirExercicio({ ...p, historicoRecenteIds: [...bloqueados] });
    if (rr.status === 'ok' && rr.exercicio && !bloqueados.has(rr.exercicio.id)) {
      out.push(rr);
      bloqueados.add(rr.exercicio.id);
    } else break;
  }
  return out;
}
