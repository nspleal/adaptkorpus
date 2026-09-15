/**
 * 📸 Despeja os planos dos CENÁRIOS de comparação em JSON, usando só APIs que existem na base
 * (origin/main), no candidato 4576201 e na correção. Rodar nos três dá a comparação de 3 vias.
 *
 * Instrumento de verificação; não é teste e não vai para o bundle.
 * Uso: ADAPT_DUMP=<arquivo> npx vitest run --config scripts/vitest.dump.config.ts
 */
import { avaliarGateTreino } from '../src/lib/engine/treino-gate';
import { prescreverTreino } from '../src/lib/engine/treino';
import { montarRotina, type OpcoesSemana } from '../src/lib/engine/treino-montador';
import { EXERCISES } from '../src/lib/data/exercises';
import { exercicioDisponivel } from '../src/lib/engine/equipamento';
import { dificuldadesLiberadas } from '../src/lib/engine/treino';
import { secundariosDe } from '../src/lib/engine/secundarios';
import type { FlagsSaude } from '../src/lib/engine/types';
import type { PerfilTreino, RotinaCustom, SemanaCiclo } from '../src/lib/engine/treino-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

export const perfilBase = (o: Partial<PerfilTreino> = {}): PerfilTreino => ({
  pesoKg: 80, alturaCm: 180, idade: 30, flagsSaude: SEM, objetivo: 'massa',
  nivelExperiencia: 'intermediario', equipamento: 'academia', diasDisponiveis: 4, tempoPorSessaoMin: 60, ...o,
} as PerfilTreino);

export interface Cenario {
  chave: string;
  titulo: string;
  perfil: Partial<PerfilTreino>;
  semana?: Partial<OpcoesSemana>;
}

const DESENHO_MANUAL: RotinaCustom = {
  origem: 'usuario',
  dias: [
    { nome: 'Meu dia A', exercicioIds: ['e9', 'e10', 'e11', 'e15', 'e22'] },
    { nome: 'Meu dia B', exercicioIds: ['e16', 'e17', 'e57'] },
  ],
};

/**
 * Matriz ampliada para cobrir os descritores e as classes: peito com 2 e com 1 slot, braços
 * com alternativas mecanicamente distintas, posteriores com e sem possibilidade de combinar
 * padrões, catálogo/equipamento limitado, tempo curto/75+/legado, foco, retomada, deload e
 * rotina manual.
 */
export const CENARIOS: readonly Cenario[] = [
  { chave: 'prioridades-4d', titulo: 'Prioridades 4d/60 (peito+ombros · costas+bíceps · pernas · braços+core)', perfil: { divisaoPreferida: 'prioridades', diasDisponiveis: 4, tempoPorSessaoMin: 60 } },
  { chave: 'prioridades-4d-90', titulo: 'Prioridades 4d/90 — peito com mais de um slot', perfil: { divisaoPreferida: 'prioridades', diasDisponiveis: 4, tempoPorSessaoMin: 90, nivelExperiencia: 'avancado' } },
  { chave: 'supinf-4d-60', titulo: 'Superior/Inferior 4d/60', perfil: { divisaoPreferida: 'superior-inferior', diasDisponiveis: 4, tempoPorSessaoMin: 60 } },
  { chave: 'supinf-4d-90', titulo: 'Superior/Inferior 4d/90, avançado', perfil: { divisaoPreferida: 'superior-inferior', diasDisponiveis: 4, tempoPorSessaoMin: 90, nivelExperiencia: 'avancado' } },
  { chave: 'auto-6d-75', titulo: 'Automático 6d/75, avançado', perfil: { diasDisponiveis: 6, tempoPorSessaoMin: 75, nivelExperiencia: 'avancado' } },
  { chave: 'auto-5d-90', titulo: 'Automático 5d/90, avançado', perfil: { diasDisponiveis: 5, tempoPorSessaoMin: 90, nivelExperiencia: 'avancado' } },
  { chave: 'auto-4d-60', titulo: 'Automático 4d/60, intermediário', perfil: { diasDisponiveis: 4, tempoPorSessaoMin: 60 } },
  { chave: 'curto-3d-30', titulo: 'Sessão curta 3d/30', perfil: { diasDisponiveis: 3, tempoPorSessaoMin: 30 } },
  { chave: 'curto-2d-20', titulo: 'Sessão muito curta 2d/20, iniciante', perfil: { diasDisponiveis: 2, tempoPorSessaoMin: 20, nivelExperiencia: 'iniciante' } },
  { chave: 'legado-12min', titulo: 'Tempo legado limitado 3d/12, iniciante', perfil: { diasDisponiveis: 3, tempoPorSessaoMin: 12, nivelExperiencia: 'iniciante' } },
  { chave: 'foco-ombros', titulo: 'Foco em ombros (compensa peito) 4d/60', perfil: { diasDisponiveis: 4, tempoPorSessaoMin: 60, foco: { grupo: 'ombros', compensa: 'peito', semana: 1 } } },
  { chave: 'foco-biceps', titulo: 'Foco em bíceps (compensa costas) 4d/60', perfil: { diasDisponiveis: 4, tempoPorSessaoMin: 60, foco: { grupo: 'biceps', compensa: 'costas', semana: 1 } } },
  { chave: 'foco-posterior', titulo: 'Foco em posterior (compensa peito) 4d/75, avançado', perfil: { diasDisponiveis: 4, tempoPorSessaoMin: 75, nivelExperiencia: 'avancado', foco: { grupo: 'posterior', compensa: 'peito', semana: 1 } } },
  { chave: 'casa-halteres', titulo: 'Casa com halteres+elástico 3d/45', perfil: { equipamento: 'casa', equipamentosCasa: ['halteres', 'elastico'], diasDisponiveis: 3, tempoPorSessaoMin: 45 } },
  { chave: 'casa-vazia', titulo: 'Casa sem equipamento 3d/40, iniciante', perfil: { equipamento: 'casa', equipamentosCasa: [], diasDisponiveis: 3, tempoPorSessaoMin: 40, nivelExperiencia: 'iniciante' } },
  { chave: 'casa-vazia-avancado', titulo: 'Casa sem equipamento 4d/60, avançado (posterior sem máquina)', perfil: { equipamento: 'casa', equipamentosCasa: [], diasDisponiveis: 4, tempoPorSessaoMin: 60, nivelExperiencia: 'avancado' } },
  { chave: 'iniciante-3d-60', titulo: 'Iniciante 3d/60 (nível limita o catálogo)', perfil: { diasDisponiveis: 3, tempoPorSessaoMin: 60, nivelExperiencia: 'iniciante' } },
  { chave: 'semana1', titulo: 'Semana 1 do mesociclo, 4d/60', perfil: { diasDisponiveis: 4, tempoPorSessaoMin: 60 }, semana: { semana: 1 as SemanaCiclo } },
  { chave: 'deload-semana6', titulo: 'Deload (semana 6), 4d/60', perfil: { diasDisponiveis: 4, tempoPorSessaoMin: 60 }, semana: { semana: 6 as SemanaCiclo } },
  { chave: 'retomada', titulo: 'Retomada (rampa 1, fator 0,6), 4d/60', perfil: { diasDisponiveis: 4, tempoPorSessaoMin: 60 }, semana: { retomada: { semana: 1, fator: 0.6, volumeReferencia: 12 } } },
  { chave: 'manual', titulo: 'Rotina manual do usuário', perfil: { rotinaCustom: DESENHO_MANUAL } },
  { chave: 'emagrecimento-3d', titulo: 'Emagrecimento 3d/45, intermediário', perfil: { objetivo: 'emagrecimento', diasDisponiveis: 3, tempoPorSessaoMin: 45 } },
  { chave: 'forca-pesada', titulo: 'Modo força pesada 2d/75, avançado', perfil: { modoForca: true, nivelExperiencia: 'avancado', objetivo: 'emagrecimento', diasDisponiveis: 2, tempoPorSessaoMin: 75 } },
];

export interface SlotDump {
  id: string; nome: string; grupo: string | null; padrao: string; nivel: string;
  series: number | null; descansoSeg: number | null; holdSeg: number | null;
  secundarios: string[]; execucao: string; tipo: string; equipamentoDetalhe: string;
}
export interface DiaDump {
  nome: string; slots: SlotDump[];
  duracaoMinSeg: number | null; duracaoMaxSeg: number | null;
  estadoCalculo: string | null; estadoLimite: string | null;
}
export interface CenarioDump {
  chave: string; titulo: string; split: string; avisos: string[];
  dias: DiaDump[]; poolElegivel: string[];
}

export function dumpCenario(c: Cenario): CenarioDump {
  const p = perfilBase(c.perfil);
  const gate = avaliarGateTreino(p);
  const r = montarRotina(prescreverTreino(p, gate), p, EXERCISES, new Set(), { semana: 3, feedbackGrupos: new Map(), ...c.semana });
  const niveis = new Set(dificuldadesLiberadas(p.nivelExperiencia));
  const poolElegivel = EXERCISES
    .filter((e) => exercicioDisponivel(e, p.equipamento, p.equipamentosCasa) && niveis.has(e.nivel))
    .map((e) => e.id);
  return {
    chave: c.chave,
    titulo: c.titulo,
    split: r.split,
    avisos: [...r.avisos].sort(),
    poolElegivel,
    dias: r.dias.map((d, i) => {
      const dur = r.duracaoDias?.[i];
      return {
        nome: d.nome,
        slots: d.slots.map((s) => ({
          id: s.exercicio.id,
          nome: s.exercicio.nomePt,
          grupo: s.exercicio.grupoPrimario,
          padrao: s.exercicio.padraoMovimento,
          nivel: s.exercicio.nivel,
          tipo: s.exercicio.tipo,
          equipamentoDetalhe: s.exercicio.equipamentoDetalhe ?? '',
          execucao: s.exercicio.execucao,
          secundarios: secundariosDe(s.exercicio),
          series: s.series ?? null,
          descansoSeg: s.descansoSeg ?? null,
          holdSeg: (s as { holdSeg?: number }).holdSeg ?? null,
        })),
        duracaoMinSeg: dur?.duracaoMinimaEstimadaSegundos ?? null,
        duracaoMaxSeg: dur?.duracaoMaximaEstimadaSegundos ?? null,
        estadoCalculo: dur?.estadoCalculo ?? null,
        estadoLimite: dur?.estadoLimite ?? null,
      };
    }),
  };
}

export function dumpTodos(): CenarioDump[] {
  return CENARIOS.map(dumpCenario);
}
