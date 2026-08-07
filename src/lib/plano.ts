/**
 * Recomputa dieta + treino a partir do perfil salvo. Determinístico — produz exatamente
 * o mesmo plano que o onboarding gerou. FONTE ÚNICA do mapeamento PerfilResumo → motor,
 * compartilhada pelo client (session.ts) e pelo servidor (snapshot em `plans` no PUT do
 * perfil). Puro: sem 'use client', sem relógio próprio (o retorno de 21 dias dos pratos
 * cansados é resolvido por `pratosCansadosAtivos`, que recebe a data de quem chama).
 */
import { gerarDieta, gerarTreino } from '@/lib/engine';
import type { OpcoesSemana, PerfilTreino, PerfilUsuario, ResultadoMotor, ResultadoTreino } from '@/lib/engine';
import { EXERCISES_SEED, FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import { pratosCansadosAtivos } from '@/lib/rotacao-pratos';
import type { PerfilResumo } from '@/components/painel/Painel';

export function recomputarPlano(
  perfil: PerfilResumo,
  /** Semana do mesociclo (v2): quem tem relógio (Painel) deriva e injeta; ausente = v1. */
  opcoes?: {
    semanaCiclo?: OpcoesSemana;
    /**
     * 🔒 A CONEXÃO (Leva D, DF 2026-07-31). O peso já RESOLVIDO — suavizado, com histerese de
     * recomputação e carência da faixa protetiva aplicadas. Quem resolve é `lib/peso-plano`
     * (tem storage e relógio); aqui só se recebe, como já se recebe a semana do mesociclo.
     *
     * 🔴 O defeito que isto fecha: `registrarPeso` grava em três destinos e NENHUM é
     * `perfil.pesoKg` — só o *Editar perfil* movia o perfil. A dieta era adaptativa no
     * mecanismo e estática no efeito: com perfil 70 kg e peso real 61,4 o alvo ficava
     * ~110 kcal/dia alto demais. Nenhuma pesagem mudava TMB, macro nem gate.
     *
     * ⚠️ Um knob só, de propósito: se aqui entrassem a série E o peso resolvido, existiriam
     * duas respostas para "com que peso o plano foi gerado" — e a auditoria do determinismo
     * depende de existir uma. Ausente = comportamento ANTERIOR, byte a byte (o servidor e a
     * chamada v1 seguem no `perfil.pesoKg`).
     */
    pesoEfetivoKg?: number;
  },
): { dieta: ResultadoMotor; treino: ResultadoTreino } {
  /**
   * 🔒 Um único ponto de decisão para os SEIS consumidores — TMB, proteína, gordura,
   * gatilhos de clamp, IMC do gate e a checagem de plausibilidade —, porque todos leem daqui
   * para baixo. Fonte única, não seis chamadas espalhadas.
   */
  const pesoKg = Number.isFinite(opcoes?.pesoEfetivoKg) ? (opcoes!.pesoEfetivoKg as number) : perfil.pesoKg;

  const perfilU: PerfilUsuario = {
    sexo: perfil.sexo, pesoKg, alturaCm: perfil.alturaCm, idade: perfil.idade,
    nivelAtividade: perfil.nivelAtividade, objetivo: perfil.objetivo, flagsSaude: perfil.flagsSaude,
  };
  // A agenda (treinoDias) é a fonte de verdade; o motor de treino usa a CONTAGEM de dias.
  const diasDisponiveis = perfil.treinoDias?.length ?? perfil.diasDisponiveis;
  const perfilT: PerfilTreino = {
    pesoKg, alturaCm: perfil.alturaCm, idade: perfil.idade, flagsSaude: perfil.flagsSaude,
    objetivo: perfil.objetivo, nivelExperiencia: perfil.nivelExperiencia, equipamento: perfil.equipamento,
    equipamentosCasa: perfil.equipamentosCasa, // checklist de casa (modelo 2 níveis)
    diasDisponiveis, tempoPorSessaoMin: perfil.tempoPorSessaoMin,
    // Modo força (v2 §4): preset opt-in — o motor ignora p/ iniciante.
    ...(perfil.modoForca ? { modoForca: true } : {}),
  };
  // Preferências relaxáveis na geração do cardápio: "não curto" (nível do alimento) +
  // "Cansei deste prato" (nível do prato, só os ainda em descanso — o retorno de 21 dias é
  // resolvido aqui, fora do motor). Ambas cedem antes de deixar o cardápio sem fechar.
  const restricoes = {
    alergenos: perfil.alergenos, preferencia: perfil.preferencia,
    excluirAlimentoIds: perfil.naoCurto ?? [],
    excluirPratoIds: pratosCansadosAtivos(perfil.pratosCansados),
    // 💰 Leva H: a escolha da tela chega ao montador por aqui — mesmo caminho das demais
    // preferências de montagem. Ausente = `alto` (resolvido no motor).
    orcamento: perfil.orcamento ?? null,
  };
  return {
    dieta: gerarDieta(perfilU, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes }),
    // Favoritos (DF #12): viés determinístico do montador — preferidos no slot, isentos
    // da variedade; filtros duros e invariantes intactos.
    treino: gerarTreino(perfilT, {
      exercises: EXERCISES_SEED,
      favoritos: new Set(perfil.favoritos ?? []),
      // Rampa do mesociclo (v2 §1): séries por slot da semana corrente.
      ...(opcoes?.semanaCiclo ? { semanaCiclo: opcoes.semanaCiclo } : {}),
    }),
  };
}
