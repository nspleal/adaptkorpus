/**
 * Recomputa dieta + treino a partir do perfil salvo. Determinístico — produz exatamente
 * o mesmo plano que o onboarding gerou. FONTE ÚNICA do mapeamento PerfilResumo → motor,
 * compartilhada pelo client (session.ts) e pelo servidor (snapshot em `plans` no PUT do
 * perfil). Puro: sem 'use client', sem relógio próprio (o retorno de 21 dias dos pratos
 * cansados é resolvido por `pratosCansadosAtivos`, que recebe a data de quem chama).
 */
import { avaliarGateSaude, avaliarGateTreino, gerarDieta, gerarTreino } from '@/lib/engine';
import type { OpcoesSemana, PerfilTreino, PerfilUsuario, ResultadoMotor, ResultadoTreino } from '@/lib/engine';
import type { ExecucaoLateralidade } from '@/lib/data/types';
import { EXERCISES_SEED, FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import { pratosCansadosAtivos } from '@/lib/rotacao-pratos';
import type { PerfilResumo } from '@/components/painel/Painel';
import type { Weekday } from '@/lib/semana';
import { AVISO_PERFIL_SUSPENSO, ROTULOS_CAMPOS_PERFIL } from '@/lib/validation/perfil-resumo';

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
    /**
     * 🔒 C1.1-B — DIAS OFERECIDOS PELO USUÁRIO PARA CARDIO: dias reais da semana que a pessoa
     * marcou como disponíveis. Entra por
     * AQUI, o mesmo trilho de `semanaCiclo`/`pesoEfetivoKg`: um knob TRANSIENTE por geração, não
     * uma preferência permanente do perfil (o fluxo atual não exige persistência — decisão do
     * autor, item 10). Distinto de `diasDisponiveis`, que é só uma CONTAGEM.
     *
     * Um dia só recebe cardio se foi OFERECIDO aqui **e** não contém musculação; cardio nunca
     * remove/substitui/desloca um dia de treino. Ausente = nenhum dia oferecido ⇒ nenhum bloco.
     */
    diasOferecidosCardio?: readonly (Weekday | number)[];
    /**
     * 🔒 C1 — ESCOLHA DE EXECUÇÃO por exercício (e72 rosca martelo: alternado × simultâneo).
     * Também transiente: materializa `slot.execucaoSelecionada` e é honrada pelo avaliador.
     */
    escolhasExecucao?: ReadonlyMap<string, ExecucaoLateralidade>;
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
  // A agenda (treinoDias) é a fonte de verdade; sua contagem segue disponível ao montador.
  const diasDisponiveis = perfil.treinoDias?.length ?? perfil.diasDisponiveis;
  const perfilT: PerfilTreino = {
    pesoKg, alturaCm: perfil.alturaCm, idade: perfil.idade, flagsSaude: perfil.flagsSaude,
    objetivo: perfil.objetivo, nivelExperiencia: perfil.nivelExperiencia, equipamento: perfil.equipamento,
    equipamentosCasa: perfil.equipamentosCasa, // checklist de casa (modelo 2 níveis)
    diasDisponiveis, treinoDias: perfil.treinoDias, tempoPorSessaoMin: perfil.tempoPorSessaoMin,
    // Modo força (v2 §4): preset opt-in — o motor ignora p/ iniciante.
    ...(perfil.modoForca ? { modoForca: true } : {}),
    /**
     * 🔴 O FIO DO v3 (leva A do v4 — handoff-motor-volume-v4-2026-08-12).
     *
     * O defeito medido em 2026-08-12: este era o ÚNICO ponto do app que constrói um
     * `PerfilTreino`, e ele não repassava `preferencias` nem `foco` — o montador lê os dois
     * (`treino-montador.ts`), então banir/trocar/focar gravava no perfil, emitia telemetria
     * e NÃO MUDAVA O PLANO. Os controles do v3 ficaram 8 dias no ar, inertes.
     * (`tecnicasAvancadas` não entra aqui de propósito: o motor não o lê — o portão de
     * elegibilidade é recalculado na UI; o campo é só persistido.)
     */
    ...(perfil.preferencias ? { preferencias: perfil.preferencias } : {}),
    ...(perfil.foco ? { foco: perfil.foco } : {}),
    ...(perfil.divisaoPreferida ? { divisaoPreferida: perfil.divisaoPreferida } : {}),
    // 🧭 O desenho do editor guiado entra como ENTRADA do montador — mesmo trilho dos
    // demais campos do perfil. Ausente = o gerador monta (comportamento de sempre).
    ...(perfil.rotinaCustom ? { rotinaCustom: perfil.rotinaCustom } : {}),
    // 🏃 C2: a modalidade escolhida alimenta o slot do dia excedente de cardio.
    ...(perfil.cardioFavorito ? { cardioFavorito: perfil.cardioFavorito } : {}),
  };
  /**
   * 🔴 D11 (auditoria 2026-09-11) — A GERAÇÃO É SUSPENSA, NÃO ADIVINHADA.
   *
   * `camposInvalidos` vem da hidratação (`sanearPerfilHidratado`) e lista os campos
   * ESSENCIAIS que não puderam ser lidos. Aqui não se escolhe um valor por conta própria:
   * "iniciante", "saudável" ou 240 min/sessão devolveriam um plano plausível construído sobre
   * dado que ninguém configurou — com selo verde de certificação, como foi medido.
   *
   * 🔒 A suspensão reusa o terminal que o motor já tem para "não gera plano" (`ROTEAR`), com
   * o motivo nomeando os campos. Os `derivados` vêm do gate REAL — nada é inventado; o que se
   * substitui é só o terminal. O perfil não é apagado, e quem oferece a correção é a tela.
   *
   * ⚠️ Fica AQUI, na borda do app, e não no gate do motor: `gerarTreino` com
   * `tempoPorSessaoMin: 1` é um contrato legítimo do motor (testado em
   * `c1-caminho-publico`), e roteá-lo dentro do engine trocaria um defeito por uma regressão.
   */
  const camposInvalidos = (perfil as { camposInvalidos?: string[] }).camposInvalidos ?? [];
  if (camposInvalidos.length > 0) {
    const nomeados = camposInvalidos.map((c) => ROTULOS_CAMPOS_PERFIL[c] ?? c).join(', ');
    const motivos = [`dados do perfil ilegíveis: ${nomeados}`];
    const avisos = [AVISO_PERFIL_SUSPENSO];
    return {
      dieta: {
        gate: { ...avaliarGateSaude(perfilU), comportamento: 'ROTEAR', motivos, avisos },
        plano: null,
        cardapio: null,
      },
      treino: {
        gate: { ...avaliarGateTreino(perfilT), comportamento: 'ROTEAR', motivos, avisos },
        prescricao: null,
        rotina: null,
      },
    };
  }
  // Preferências relaxáveis na geração do cardápio: "não curto" (nível do alimento) +
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
      // 🔒 C1: a escolha do usuário chega ao motor por aqui (transiente, sem persistência nova).
      ...(opcoes?.diasOferecidosCardio ? { diasOferecidosCardio: opcoes.diasOferecidosCardio } : {}),
      ...(opcoes?.escolhasExecucao ? { escolhasExecucao: opcoes.escolhasExecucao } : {}),
    }),
  };
}
