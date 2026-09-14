/**
 * 🧭 C2 · guarda-corpo F da regra FIT — a FREQUÊNCIA é contada em SESSÕES, não em slots.
 *
 * Regra do cofre (DF 2026-07-27, mesmo dia nos dois lados da conta):
 *  · `motor-treino-rampa-regra-fit-e-rir--002` — "Frequência por grupo/padrão | máx. 3/semana
 *    | máx. 4/semana" (`RETOMADA_FREQ_MAX_POR_GRUPO`);
 *  · `motor-treino-frequencia-regua-e-contagem--013` — "Regra: 1× por SESSÃO em que o grupo
 *    apareceu (não por exercício)". O próprio motor já diz o mesmo em `geracao-temporal.ts`:
 *    "Frequência é presença em dias distintos, nunca nº de slots".
 *
 * 🔑 A consequência aritmética que este arquivo usa como oráculo: a frequência de um grupo
 * nunca passa do número de dias de força da semana. Logo, quando a semana tem `diasForça ≤
 * fMax`, o teto F **não pode** ligar — nenhum slot pode sair por frequência, e o aviso que
 * atribui o corte a ela não pode existir. Não é hipótese sobre a implementação: é o que a
 * unidade da regra obriga.
 */
import { describe, expect, it } from 'vitest';
import { avaliarGateTreino } from './treino-gate';
import { prescreverTreino } from './treino';
import { montarRotina } from './treino-montador';
import { freqMaxPorGrupo } from './treino-retomada';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude } from './types';
import type { PerfilTreino, RotinaCustom, RotinaSemanal, SemanaCiclo } from './treino-types';
import type { GrupoPrimario } from '../data/types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };
const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const;
const OBJETIVOS = ['massa', 'emagrecimento', 'saude'] as const;
const EQUIPS = ['nenhum', 'casa', 'academia'] as const;
const AVISO_FREQ = 'frequência por grupo limitada';

const planoDaRetomada = (perfil: PerfilTreino, semanaRetomada: number): RotinaSemanal => montarRotina(
  prescreverTreino(perfil, avaliarGateTreino(perfil)),
  perfil,
  EXERCISES,
  new Set(),
  { semana: 3 as SemanaCiclo, retomada: { semana: semanaRetomada, fator: semanaRetomada === 1 ? 0.5 : 0.7, volumeReferencia: 14 } },
);

/** Frequência ENTREGUE por grupo: dias distintos em que o grupo apareceu (1× por sessão). */
function diasPorGrupo(rotina: RotinaSemanal): Map<GrupoPrimario, number> {
  const m = new Map<GrupoPrimario, Set<number>>();
  rotina.dias.forEach((d, i) => {
    for (const s of d.slots) {
      const g = s.exercicio.grupoPrimario;
      if (g == null) continue;
      if (!m.has(g)) m.set(g, new Set());
      m.get(g)!.add(i);
    }
  });
  return new Map([...m].map(([g, dias]) => [g, dias.size]));
}

function* grade() {
  for (const nivelExperiencia of NIVEIS)
    for (const objetivo of OBJETIVOS)
      for (const equipamento of EQUIPS)
        for (const diasDisponiveis of [2, 3, 4, 5, 6])
          for (const tempoPorSessaoMin of [30, 45, 60, 90])
            for (const semanaRetomada of [1, 2])
              yield {
                semanaRetomada,
                rotulo: `${nivelExperiencia}/${objetivo}/${equipamento}/${diasDisponiveis}d/${tempoPorSessaoMin}min · retomada S${semanaRetomada}`,
                perfil: { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo, nivelExperiencia, equipamento, diasDisponiveis, tempoPorSessaoMin } as PerfilTreino,
              };
}

describe('C2 · teto F de frequência na rampa de retomada', () => {
  it('🔴 com diasForça ≤ fMax o teto F não pode ligar — nem corte, nem aviso', () => {
    const violacoes: string[] = [];
    for (const caso of grade()) {
      const rot = planoDaRetomada(caso.perfil, caso.semanaRetomada);
      const fMax = freqMaxPorGrupo(caso.semanaRetomada);
      if (rot.dias.length > fMax) continue;
      if (rot.avisos.some((a) => a.includes(AVISO_FREQ))) {
        const maiorFreq = Math.max(0, ...diasPorGrupo(rot).values());
        violacoes.push(`${caso.rotulo}: ${rot.dias.length} dias de força, fMax ${fMax}, maior frequência entregue ${maiorFreq}× — aviso de limite de frequência mesmo assim`);
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('nenhum grupo passa do teto F em SESSÕES (o guarda-corpo continua valendo)', () => {
    const violacoes: string[] = [];
    for (const caso of grade()) {
      const rot = planoDaRetomada(caso.perfil, caso.semanaRetomada);
      const fMax = freqMaxPorGrupo(caso.semanaRetomada);
      for (const [g, n] of diasPorGrupo(rot)) {
        if (n > fMax) violacoes.push(`${caso.rotulo}: ${g} em ${n} sessões (fMax ${fMax})`);
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('controle positivo — desenho do usuário com peito em 5 sessões cai para 3 na semana 1, e o motor diz', () => {
    const desenho: RotinaCustom = {
      origem: 'usuario',
      dias: [
        { nome: 'A', exercicioIds: ['e9', 'e40'] },
        { nome: 'B', exercicioIds: ['e10', 'e40'] },
        { nome: 'C', exercicioIds: ['e13', 'e40'] },
        { nome: 'D', exercicioIds: ['e15', 'e40'] },
        { nome: 'E', exercicioIds: ['e130', 'e40'] },
      ],
    };
    const perfil: PerfilTreino = {
      pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
      nivelExperiencia: 'avancado', equipamento: 'academia', diasDisponiveis: 5,
      tempoPorSessaoMin: 60, rotinaCustom: desenho,
    };
    const rot = planoDaRetomada(perfil, 1);
    expect(diasPorGrupo(rot).get('peito')).toBe(3);
    expect(rot.avisos.some((a) => a.includes(AVISO_FREQ))).toBe(true);
  });
});
