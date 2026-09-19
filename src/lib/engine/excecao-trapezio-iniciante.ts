import type { Exercise } from '../data/types';
import type { DiaTreino, PerfilTreino, SlotExercicio } from './treino-types';
import { creditoPonderadoDaSemana } from './alocador';
import { diretosDoExercicio } from './cobertura-anatomica';
import { papelReferencia } from './selecao-referencia';
import { avaliarDuracaoResistida } from './duracao-plano';

/** Nicolas, 19/09/2026: exceção localizada ao perfil iniciante/academia/4d/30min.
 * Remada redundante -> encolhimento; tríceps de empurrar -> isolado para preservar
 * puxar >= empurrar. Só bíceps/ombros podem ceder até 1,5, com pisos 6/3 (base).
 * Nenhum outro crédito, alvo, grupo, favorito ou dose muda. Chamador só automático
 * normal; nunca manual, deload ou retomada. Não constitui permissão geral de poda.
 */
export function aplicarExcecaoTrapezio(args: {
  perfil: PerfilTreino; dias: DiaTreino[]; pool: readonly Exercise[];
  materializar: (e: Exercise, slot: SlotExercicio) => SlotExercicio;
}): boolean {
  const { perfil: p, dias } = args;
  if (p.nivelExperiencia !== 'iniciante' || p.equipamento !== 'academia'
    || p.objetivo !== 'massa' || p.diasDisponiveis !== 4 || dias.length !== 4
    || p.tempoPorSessaoMin !== 30 || p.limiteTempoTreino === 'sem_limite') return false;
  const slots = dias.flatMap(d => d.slots);
  const alvos = (ss: readonly SlotExercicio[]) => new Set(ss.flatMap(s => [...diretosDoExercicio(s.exercicio.id)]));
  const antesAlvos = alvos(slots);
  if (antesAlvos.has('ts')) return false;
  const antes = creditoPonderadoDaSemana(slots);
  for (const d of dias) {
    // e168 é a remada do caso autorizado; ainda não integra a família usada por papelReferencia.
    const remadas = d.slots.filter(s => papelReferencia(s.exercicio) === 'remada' || s.exercicio.id === 'e168');
    if (remadas.length < 2 || !d.slots.some(s => papelReferencia(s.exercicio) === 'puxada')) continue;
    for (const remada of [...remadas].reverse()) {
      if (remada.incluidoPorPreferencia) continue;
      for (const encolhimento of args.pool.filter(e => e.grupoPrimario === 'costas'
        && e.nomePt.toLocaleLowerCase('pt-BR').includes('encolhimento')
        && diretosDoExercicio(e.id).has('ts') && !d.slots.some(s => s.exercicio.id === e.id))) {
        for (const triceps of slots.filter(s => s.exercicio.grupoPrimario === 'triceps'
          && s.padrao === 'empurrar' && !s.incluidoPorPreferencia)) {
          const diaTriceps = dias.find(x => x.slots.includes(triceps))!;
          for (const isolado of args.pool.filter(e => e.grupoPrimario === 'triceps'
            && e.padraoMovimento === 'isolado' && !diaTriceps.slots.some(s => s.exercicio.id === e.id))) {
            const novo = dias.map(x => ({ ...x, slots: x.slots.map(s =>
              s === remada ? args.materializar(encolhimento, s)
                : s === triceps ? args.materializar(isolado, s) : s) }));
            const ss = novo.flatMap(x => x.slots), aa = alvos(ss);
            if ([...antesAlvos].some(a => !aa.has(a))) continue;
            if (ss.filter(s => s.padrao === 'puxar').length < ss.filter(s => s.padrao === 'empurrar').length) continue;
            const credito = creditoPonderadoDaSemana(ss);
            if ([...antes].some(([g, n]) => {
              const valor = credito.get(g) ?? 0;
              return g === 'biceps' || g === 'ombros'
                ? valor < Math.max(n - 1.5, g === 'biceps' ? 6 : 3) || valor > n
                : valor !== n;
            }) || [...credito].some(([g, n]) => !antes.has(g) && n !== 0)) continue;
            if (novo.some((x, i) => {
              const a = creditoPonderadoDaSemana(dias[i]!.slots);
              return [...creditoPonderadoDaSemana(x.slots)].some(([g, n]) =>
                g === 'biceps' || g === 'ombros' ? n > (a.get(g) ?? 0) : n !== (a.get(g) ?? 0));
            })) continue;
            if (novo.some(x => {
              const dur = avaliarDuracaoResistida(x.slots, p.nivelExperiencia);
              return dur.estadoCalculo !== 'CALCULADO' || dur.duracaoMaximaEstimadaSegundos! > 1800;
            })) continue;
            for (let i = 0; i < dias.length; i++) dias[i]!.slots = novo[i]!.slots;
            return true;
          }
        }
      }
    }
  }
  return false;
}
