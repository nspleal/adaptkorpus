/**
 * ERROR-HUNT — corpus de bordas do motor de treino (regressão).
 * Recalcula a spec de forma INDEPENDENTE (números reescritos do cofre, não importados de
 * treino-constants) e testa invariantes em todo o espaço objetivo×nível×equip×dias×tempo.
 * Fonte: parametros-motor-treino-adaptkorpus.
 */
import { describe, expect, it } from 'vitest';
import { gerarTreino } from './index';
import { avaliarGateTreino } from './treino-gate';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude, Objetivo } from './types';
import type { NivelExperiencia, PerfilTreino } from './treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

// Spec REESCRITA do cofre (independente do motor).
const SPEC_FITT: Record<
  Objetivo,
  { repsComp: [number, number]; repsIsol: [number, number]; rir: [number, number]; descComp: [number, number]; descIsol: [number, number] }
> = {
  saude: { repsComp: [8, 15], repsIsol: [10, 15], rir: [2, 4], descComp: [60, 90], descIsol: [60, 90] },
  massa: { repsComp: [6, 12], repsIsol: [8, 15], rir: [1, 3], descComp: [90, 120], descIsol: [60, 90] },
  emagrecimento: { repsComp: [8, 12], repsIsol: [10, 15], rir: [1, 3], descComp: [60, 90], descIsol: [60, 90] },
};
const SPEC_VOL: Record<NivelExperiencia, { sessoes: [number, number]; vol: Record<Objetivo, [number, number]> }> = {
  // 🔵 2026-09-17 — as FAIXAS DESEJADAS de hipertrofia mudaram (10–12/13–16/16–20 →
  // 6–10/10–14/12–18). Os tetos passaram a ser tabela própria (13/19/21, e teto − 3 sem foco)
  // e são verificados em `volume-hipertrofia-2026-09-17.test.ts`. `saude` e `emagrecimento`
  // não foram tocados: a política deles é própria.
  iniciante: { sessoes: [2, 3], vol: { saude: [6, 10], massa: [6, 10], emagrecimento: [8, 10] } },
  intermediario: { sessoes: [3, 4], vol: { saude: [8, 12], massa: [10, 14], emagrecimento: [10, 14] } },
  avancado: { sessoes: [4, 6], vol: { saude: [10, 12], massa: [12, 18], emagrecimento: [12, 16] } },
};

const OBJ: Objetivo[] = ['saude', 'massa', 'emagrecimento'];
const NIV: NivelExperiencia[] = ['iniciante', 'intermediario', 'avancado'];
const EQUIP = ['nenhum', 'casa', 'academia'] as const;
const DIAS = [1, 2, 3, 4, 5, 6];
const TEMPOS = [20, 45, 90];

function base(over: Partial<PerfilTreino> = {}): PerfilTreino {
  return { pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa', nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...over };
}

describe('error-hunt: corpus do motor de treino', () => {
  it('prescrição + rotina: recálculo independente e invariantes em todos os extremos', () => {
    const viol: string[] = [];
    for (const objetivo of OBJ)
      for (const nivel of NIV)
        for (const equipamento of EQUIP)
          for (const dias of DIAS)
            for (const tempo of TEMPOS) {
              const perfil = base({ objetivo, nivelExperiencia: nivel, equipamento, diasDisponiveis: dias, tempoPorSessaoMin: tempo });
              const rot = `${objetivo}/${nivel}/${equipamento}/${dias}d/${tempo}min`;
              const r = gerarTreino(perfil, { exercises: EXERCISES });

              if (r.gate.comportamento !== 'PERMITIR' || !r.prescricao || !r.rotina) {
                viol.push(`gate inesperado ${rot}: ${r.gate.comportamento}`);
                continue;
              }
              const p = r.prescricao;
              const spec = SPEC_FITT[objetivo];
              const vol = SPEC_VOL[nivel];

              // Recálculo independente.
              if (p.repsComposto.min !== Math.max(spec.repsComp[0], 6) || p.repsComposto.max !== spec.repsComp[1])
                viol.push(`repsComposto ${rot}: ${JSON.stringify(p.repsComposto)}`);
              const rirMinEsp = Math.max(spec.rir[0], nivel === 'iniciante' ? 2 : 1);
              if (p.rir.min !== rirMinEsp || p.rir.max !== spec.rir[1]) viol.push(`rir ${rot}: ${JSON.stringify(p.rir)} esp min ${rirMinEsp}`);
              if (p.descansoCompostoSeg.min !== spec.descComp[0] || p.descansoCompostoSeg.max !== spec.descComp[1]) viol.push(`descanso ${rot}`);
              if (p.repsIsolado.min !== spec.repsIsol[0] || p.repsIsolado.max !== spec.repsIsol[1]) viol.push(`repsIsolado ${rot}: ${JSON.stringify(p.repsIsolado)}`);
              if (p.descansoIsoladoSeg.min !== spec.descIsol[0] || p.descansoIsoladoSeg.max !== spec.descIsol[1]) viol.push(`descansoIsolado ${rot}`);
              if (p.volumePorGrupoSemana.min !== vol.vol[objetivo][0] || p.volumePorGrupoSemana.max !== vol.vol[objetivo][1]) viol.push(`volume ${rot}: ${JSON.stringify(p.volumePorGrupoSemana)}`);
              if (p.sessoesForcaSemana.min !== vol.sessoes[0] || p.sessoesForcaSemana.max !== vol.sessoes[1]) viol.push(`sessoes ${rot}`);

              // Invariantes de segurança.
              if (p.repsComposto.min < 6) viol.push(`reps < 6 ${rot}`);
              if (p.rir.min < 1) viol.push(`RIR < 1 ${rot}`);
              if (nivel === 'iniciante' && (p.rir.min < 2 || !p.semFalhaIniciante)) viol.push(`segurança iniciante ${rot}`);

              // Rotina: dias de força = min(dias, teto do nível).
              const diasForcaEsp = Math.min(dias, vol.sessoes[1]);
              /**
               * ✏️ CORREÇÃO FUNDAMENTADA DA EXPECTATIVA (D14, 2026-09-11). O oráculo antigo
               * lia `diasForcaAgendados` como a agenda SOLICITADA. D14 separou as duas contas:
               * o contador passou a ser a entrega EFETIVA, porque um dia sem exercício nenhum
               * era contado como sessão, recebia `duracaoDias = {min 0, max 0}` e sustentava o
               * selo de CERTIFICADO. A agenda solicitada continua verificada — agora pela soma
               * com os dias declarados como não atendidos, que é MAIS do que se checava antes.
               */
              const naoAtendidos = r.rotina.diasNaoAtendidos?.length ?? 0;
              if (r.rotina.diasForcaAgendados + naoAtendidos !== diasForcaEsp) viol.push(`agenda solicitada ${rot}: ${r.rotina.diasForcaAgendados}+${naoAtendidos} esp ${diasForcaEsp}`);
              if (r.rotina.diasForcaAgendados !== r.rotina.dias.length) viol.push(`entrega ${rot}: contador ${r.rotina.diasForcaAgendados}, planos ${r.rotina.dias.length}`);
              if (r.rotina.diasCardioRecuperacao !== dias - diasForcaEsp) viol.push(`diasCardio ${rot}`);

              // Invariantes do montador.
              const conta = (pad: string) => r.rotina!.dias.reduce((n, d) => n + d.slots.filter((s) => s.padrao === pad).length, 0);
              if (conta('puxar') < conta('empurrar')) {
                //14/09:1por grupo pode ser incompatível sem equipamento; nunca certificar.
                if(r.rotina.resultadoGeracao?.tipo!=='ERRO_ALOCADOR')viol.push(`puxar<empurrar sem recusa ${rot}`);
              }
              if (diasForcaEsp >= 2 && conta('dobradica_quadril') < 1) viol.push(`sem dobradiça ${rot}`);
              if (diasForcaEsp >= 2 && (conta('core') < 2 || conta('core') > 3)) viol.push(`core fora 2-3x ${rot}: ${conta('core')}`);

              // Elegibilidade dos exercícios (equipamento/local + dificuldade).
              const liberadas = new Set(nivel === 'iniciante' ? ['iniciante'] : nivel === 'intermediario' ? ['iniciante', 'intermediario'] : ['iniciante', 'intermediario', 'avancado']);
              const locais = equipamento === 'nenhum' ? ['casa_sem'] : equipamento === 'casa' ? ['casa_sem', 'casa_com'] : ['casa_sem', 'casa_com', 'academia'];
              for (const d of r.rotina.dias)
                for (const s of d.slots) {
                  if (!locais.includes(s.exercicio.local)) viol.push(`local inválido ${rot}: ${s.exercicio.id}`);
                  if (!liberadas.has(s.exercicio.nivel)) viol.push(`dificuldade inválida ${rot}: ${s.exercicio.id}`);
                }
            }
    expect(viol,viol.join('\n')).toEqual([]);
  });

  it('gate: RESTRINGIR (baixo peso no corte) prescreve como Saúde', () => {
    const p = base({ pesoKg: 50, alturaCm: 170, objetivo: 'emagrecimento' });
    const r = gerarTreino(p, { exercises: EXERCISES });
    expect(r.gate.comportamento).toBe('RESTRINGIR');
    expect(r.prescricao?.objetivoEfetivo).toBe('saude');
    expect(r.prescricao?.rir).toEqual({ min: 2, max: 4 }); // faixa de saúde
  });

  it('gate: condição clínica → ROTEAR, sem prescrição', () => {
    const r = gerarTreino(base({ flagsSaude: { ...SEM, diabetes: true } }), { exercises: EXERCISES });
    expect(r.gate.comportamento).toBe('ROTEAR');
    expect(r.prescricao).toBeNull();
    expect(r.rotina).toBeNull();
  });

  it('determinístico com a base real', () => {
    const p = base({ diasDisponiveis: 5, nivelExperiencia: 'avancado' });
    const a = gerarTreino(p, { exercises: EXERCISES });
    const b = gerarTreino(p, { exercises: EXERCISES });
    const ids = (r: typeof a) => r.rotina!.dias.map((d) => d.slots.map((s) => s.exercicio.id).join(',')).join('|');
    expect(ids(a)).toBe(ids(b));
  });

  it('todos os comportamentos do gate são alcançáveis', () => {
    const vistos = new Set<string>();
    vistos.add(avaliarGateTreino(base()).comportamento); // PERMITIR
    vistos.add(avaliarGateTreino(base({ pesoKg: 50, alturaCm: 170, objetivo: 'emagrecimento' })).comportamento); // RESTRINGIR
    vistos.add(avaliarGateTreino(base({ flagsSaude: { ...SEM, lesao: true } })).comportamento); // ROTEAR
    expect(vistos).toEqual(new Set(['PERMITIR', 'RESTRINGIR', 'ROTEAR']));
  });
});
