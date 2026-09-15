/**
 * 🔬 Instrumento de diagnóstico (não é guard): para cada par de slots do mesmo grupo, no mesmo
 * dia, com a MESMA tarefa mecânica, pergunta se existia alternativa elegível com tarefa
 * diferente — e se ela cabe na classe de intercâmbio atual.
 *
 * Uso: ADAPT_ANALISE=<arquivo> npx vitest run --config scripts/vitest.dump.config.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { EXERCISES } from '../src/lib/data/exercises';
import { ANATOMIA_POR_EXERCICIO } from '../src/lib/data/alvos-anatomicos';
import { assinaturaDeCusto, diretosDoExercicio } from '../src/lib/engine/cobertura-anatomica';
import type { NivelExperiencia } from '../src/lib/engine/treino-types';

const POR_ID = new Map(EXERCISES.map((e) => [e.id, e]));
const indeterminado = (v: string) => v.includes('_ou_') || v.endsWith('_a_confirmar');

function tracos(id: string): Set<string> {
  const a = ANATOMIA_POR_EXERCICIO[id];
  const t = new Set<string>();
  if (a) t.add(`acao:${a.regra}`);
  for (const [k, v] of Object.entries(a?.descritores ?? {})) if (!indeterminado(v)) t.add(`${k}:${v}`);
  return t;
}
const mesmo = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

interface SlotDump { id: string; grupo: string | null; nome: string }
interface DiaDump { nome: string; slots: SlotDump[] }
interface CenarioDump { chave: string; dias: DiaDump[]; poolElegivel: string[] }

describe.runIf(process.env.ADAPT_ANALISE)('análise de complementaridade', () => {
  it('escreve', () => {
    const dados: CenarioDump[] = JSON.parse(readFileSync(process.env.ADAPT_ENTRADA!, 'utf8'));
    const niveis: Record<string, NivelExperiencia> = {};
    const linhas: string[] = [];
    let permitidos = 0; let bloqueados = 0; let inexistentes = 0;
    const porGrupoBloqueado = new Map<string, number>();
    const porGrupoPermitido = new Map<string, number>();

    for (const c of dados) {
      const nivel: NivelExperiencia = niveis[c.chave] ?? 'intermediario';
      const elegiveis = c.poolElegivel.map((id) => POR_ID.get(id)!).filter(Boolean);
      for (const d of c.dias) {
        const porGrupo = new Map<string, SlotDump[]>();
        for (const s of d.slots) if (s.grupo) porGrupo.set(s.grupo, [...(porGrupo.get(s.grupo) ?? []), s]);
        for (const [g, slots] of porGrupo) {
          if (slots.length < 2) continue;
          const idsNoDia = new Set(d.slots.map((s) => s.id));
          for (let a = 0; a < slots.length; a += 1) {
            for (let b = a + 1; b < slots.length; b += 1) {
              const x = slots[a]!; const y = slots[b]!;
              const dx = [...diretosDoExercicio(x.id)].sort().join(',');
              const dy = [...diretosDoExercicio(y.id)].sort().join(',');
              if (dx !== dy || !mesmo(tracos(x.id), tracos(y.id))) continue;
              // Há alternativa elegível, do mesmo grupo, com tarefa mecânica diferente?
              const alternativas = elegiveis.filter((e) => e.grupoPrimario === g
                && e.padraoMovimento !== 'cardio' && !idsNoDia.has(e.id) && !mesmo(tracos(e.id), tracos(y.id)));
              if (alternativas.length === 0) { inexistentes += 1; continue; }
              const naClasse = alternativas.filter((e) =>
                assinaturaDeCusto(e) === assinaturaDeCusto(POR_ID.get(y.id)!));
              if (naClasse.length > 0) {
                permitidos += 1;
                porGrupoPermitido.set(g, (porGrupoPermitido.get(g) ?? 0) + 1);
                linhas.push(`PERMITE  ${c.chave}|${d.nome}|${g}| ${y.id} ${y.nome} → ${naClasse.slice(0, 4).map((e) => `${e.id} ${e.nomePt}`).join(' / ')}`);
              } else {
                bloqueados += 1;
                porGrupoBloqueado.set(g, (porGrupoBloqueado.get(g) ?? 0) + 1);
                const porQue = alternativas.slice(0, 3).map((e) => `${e.id} ${e.nomePt}`);
                linhas.push(`BLOQUEIA ${c.chave}|${d.nome}|${g}| ${y.id} ${y.nome} ✗ ${porQue.join(' · ')}`);
              }
            }
          }
        }
      }
    }
    linhas.unshift(
      `PERMITE=${permitidos}  BLOQUEIA=${bloqueados}  SEM ALTERNATIVA=${inexistentes}`,
      `permitidos por grupo: ${[...porGrupoPermitido].sort((p, q) => q[1] - p[1]).map(([g, n]) => `${g}=${n}`).join(' ')}`,
      `bloqueados por grupo: ${[...porGrupoBloqueado].sort((p, q) => q[1] - p[1]).map(([g, n]) => `${g}=${n}`).join(' ')}`,
      '',
    );
    writeFileSync(process.env.ADAPT_ANALISE!, linhas.join('\n'), 'utf8');
  });
});
