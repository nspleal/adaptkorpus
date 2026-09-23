import type { GrupoPrimario } from '../data/types';
import type { DiaTreino, NivelExperiencia } from './treino-types';
import { creditoPonderadoDaSemana } from './alocador';
import { GRUPOS_COM_FAIXA_SEMANAL } from './grupos-volume';
import { avaliarDuracaoResistida } from './duracao-plano';
import { diretosDoExercicio } from './cobertura-anatomica';
import { funcaoDe, papelReferencia } from './selecao-referencia';

/** Decisão do autor: só automático; séries do próprio grupo até 1 antes de retirar
 * redundâncias. No deload preserva a composição e, esgotada a dose direta, pode
 * reduzir dose contribuinte indireta pela exceção do autor. Nunca altera descanso. */
export function adequarTetoSemanal(args: {
  dias: readonly DiaTreino[]; nivel: NivelExperiencia; limiteSeg?: number;
  teto: (g: GrupoPrimario) => number;
  minimos: readonly Partial<Record<GrupoPrimario, number>>[];
  /** Exceção autorizada exclusivamente no deload, após esgotar dose direta. */
  deloadPreservandoComposicao?: boolean;
}) {
  const dias = args.dias.map(d => ({ ...d, slots: d.slots.map(s => ({ ...s })) }));
  const slots = () => dias.flatMap(d => d.slots);
  const credito = () => creditoPonderadoDaSemana(slots());
  const medir = () => ({ credito: Object.fromEntries(credito()),
    dias: dias.map((d, i) => ({ duracao: avaliarDuracaoResistida(d.slots, args.nivel, args.limiteSeg),
      faltas: Object.entries(args.minimos[i] ?? {}).filter(([g, min]) => d.slots.filter(s => s.exercicio.grupoPrimario === g).length < min!) })) });
  const ajustes: { dia: number; id: string; grupo: GrupoPrimario; tipo: 'serie' | 'exercicio'; de: number; para: number; causa?: 'indireto_deload'; grupoExcedido?: GrupoPrimario; creditosAntes?: Record<string, number>; creditosDepois?: Record<string, number> }[] = [];
  const passos: ReturnType<typeof medir>[] = [];
  for (const grupo of GRUPOS_COM_FAIXA_SEMANAL) {
    while ((credito().get(grupo) ?? 0) > args.teto(grupo)) {
      const candidatos = dias.flatMap((d, i) => d.slots.map((s, j) => ({ s, i, j })))
        .filter(({ s }) => s.exercicio.grupoPrimario === grupo);
      const dose = candidatos.filter(({ s }) => (s.series ?? 0) > 1)
        .sort((a, b) => b.s.series! - a.s.series! || a.i - b.i || a.j - b.j)[0];
      if (dose) {
        const de = dose.s.series!; dose.s.series = de - 1;
        ajustes.push({ dia: dose.i, id: dose.s.exercicio.id, grupo, tipo: 'serie', de, para: de - 1 });
        passos.push(medir()); continue;
      }
      if (args.deloadPreservandoComposicao) {
        const antes=credito();
        const contribuintes=dias.flatMap((d,i)=>d.slots.map((s,j)=>({s,i,j})))
          .filter(({s})=>s.exercicio.grupoPrimario!==grupo && (s.series??0)>1
            && (creditoPonderadoDaSemana([{...s,series:1}]).get(grupo)??0)>0)
          .map(c=>{
            const perda=creditoPonderadoDaSemana([{...c.s,series:1}]);
            // Menor perda ponderada nos demais grupos; empate por sessão e ordem.
            const impacto=[...perda].reduce((n,[g,v])=>n+(g===grupo?0:v),0);
            return {...c,impacto};
          }).sort((a,b)=>a.impacto-b.impacto||a.i-b.i||a.j-b.j);
        const c=contribuintes[0];
        if(!c)break;
        const de=c.s.series!;c.s.series=de-1;
        ajustes.push({dia:c.i,id:c.s.exercicio.id,grupo:c.s.exercicio.grupoPrimario!,tipo:'serie',de,para:de-1,
          causa:'indireto_deload',grupoExcedido:grupo,creditosAntes:Object.fromEntries(antes),creditosDepois:Object.fromEntries(credito())});
        passos.push(medir());continue;
      }
      // Complementar não compra permanência à custa de um principal.
      const complemento = dias.flatMap((d, i) => d.slots.map((s, j) => ({ s, i, j })))
        .find(({ s }) => ['core', 'panturrilha', 'antebraco'].includes(s.exercicio.grupoPrimario ?? '')
          && (creditoPonderadoDaSemana([s]).get(grupo) ?? 0) > 0);
      if (complemento) {
        dias[complemento.i]!.slots.splice(complemento.j, 1);
        ajustes.push({ dia: complemento.i, id: complemento.s.exercicio.id, grupo, tipo: 'exercicio', de: complemento.s.series ?? 1, para: 0 });
        passos.push(medir()); continue;
      }
      const redundantes = candidatos.filter(({ s, i, j }) => {
        const dia = dias[i]!;
        if (dia.slots.filter(x => x.exercicio.grupoPrimario === grupo).length <= (args.minimos[i]?.[grupo] ?? 1)) return false;
        const outros = slots().filter(x => x !== s);
        const funcao = funcaoDe(s.exercicio), papel = papelReferencia(s.exercicio);
        if (!outros.some(x => funcaoDe(x.exercicio) === funcao)) return false;
        if (papel && !outros.some(x => papelReferencia(x.exercicio) === papel)) return false;
        const alvos = new Set(outros.flatMap(x => [...diretosDoExercicio(x.exercicio.id)]));
        if ([...diretosDoExercicio(s.exercicio.id)].some(a => !alvos.has(a))) return false;
        if (s.padrao === 'puxar' && outros.filter(x => x.padrao === 'puxar').length < outros.filter(x => x.padrao === 'empurrar').length) return false;
        // Nenhuma função única daquele recorte sai só porque existe em outro dia.
        return dia.slots.some((x, k) => k !== j && funcaoDe(x.exercicio) === funcao);
      }).sort((a, b) => diretosDoExercicio(a.s.exercicio.id).size - diretosDoExercicio(b.s.exercicio.id).size || b.i - a.i || b.j - a.j);
      const retirar = redundantes[0];
      if (!retirar) break;
      dias[retirar.i]!.slots.splice(retirar.j, 1);
      ajustes.push({ dia: retirar.i, id: retirar.s.exercicio.id, grupo, tipo: 'exercicio', de: retirar.s.series ?? 1, para: 0 });
      passos.push(medir());
    }
  }
  const final = credito();
  const conflitos = GRUPOS_COM_FAIXA_SEMANAL.filter(g => (final.get(g) ?? 0) > args.teto(g))
    .map(grupo => ({ grupo, credito: final.get(grupo)!, teto: args.teto(grupo) }));
  return { dias, ajustes, conflitos, passos };
}
