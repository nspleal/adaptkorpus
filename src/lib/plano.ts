/**
 * Recomputa dieta + treino a partir do perfil salvo. Determinístico — produz exatamente
 * o mesmo plano que o onboarding gerou. FONTE ÚNICA do mapeamento PerfilResumo → motor,
 * compartilhada pelo client (session.ts) e pelo servidor (snapshot em `plans` no PUT do
 * perfil). Puro: sem 'use client', sem relógio próprio (o retorno de 21 dias dos pratos
 * cansados é resolvido por `pratosCansadosAtivos`, que recebe a data de quem chama).
 */
import { gerarDieta, gerarTreino } from '@/lib/engine';
import type { PerfilTreino, PerfilUsuario, ResultadoMotor, ResultadoTreino } from '@/lib/engine';
import { EXERCISES_SEED, FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import { pratosCansadosAtivos } from '@/lib/rotacao-pratos';
import type { PerfilResumo } from '@/components/painel/Painel';

export function recomputarPlano(perfil: PerfilResumo): { dieta: ResultadoMotor; treino: ResultadoTreino } {
  const perfilU: PerfilUsuario = {
    sexo: perfil.sexo, pesoKg: perfil.pesoKg, alturaCm: perfil.alturaCm, idade: perfil.idade,
    nivelAtividade: perfil.nivelAtividade, objetivo: perfil.objetivo, flagsSaude: perfil.flagsSaude,
  };
  // A agenda (treinoDias) é a fonte de verdade; o motor de treino usa a CONTAGEM de dias.
  const diasDisponiveis = perfil.treinoDias?.length ?? perfil.diasDisponiveis;
  const perfilT: PerfilTreino = {
    pesoKg: perfil.pesoKg, alturaCm: perfil.alturaCm, idade: perfil.idade, flagsSaude: perfil.flagsSaude,
    objetivo: perfil.objetivo, nivelExperiencia: perfil.nivelExperiencia, equipamento: perfil.equipamento,
    equipamentosCasa: perfil.equipamentosCasa, // checklist de casa (modelo 2 níveis)
    diasDisponiveis, tempoPorSessaoMin: perfil.tempoPorSessaoMin,
  };
  // Preferências relaxáveis na geração do cardápio: "não curto" (nível do alimento) +
  // "Cansei deste prato" (nível do prato, só os ainda em descanso — o retorno de 21 dias é
  // resolvido aqui, fora do motor). Ambas cedem antes de deixar o cardápio sem fechar.
  const restricoes = {
    alergenos: perfil.alergenos, preferencia: perfil.preferencia,
    excluirAlimentoIds: perfil.naoCurto ?? [],
    excluirPratoIds: pratosCansadosAtivos(perfil.pratosCansados),
  };
  return {
    dieta: gerarDieta(perfilU, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes }),
    // Favoritos (DF #12): viés determinístico do montador — preferidos no slot, isentos
    // da variedade; filtros duros e invariantes intactos.
    treino: gerarTreino(perfilT, { exercises: EXERCISES_SEED, favoritos: new Set(perfil.favoritos ?? []) }),
  };
}
