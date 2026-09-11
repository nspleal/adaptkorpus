import type { PerfilResumo } from '@/components/painel/Painel';
import { sanearPerfilHidratado } from '@/lib/validation/perfil-resumo';

/**
 * Mapeador PURO `PerfilResumo` ↔ linha da tabela `public.profile` (DF 2026-07-05).
 *
 * Seam determinístico da persistência (a próxima leva chama isto do server client com RLS).
 * Sem I/O e sem client de DB — só `import type` (não acopla o componente/motor). Os campos do
 * perfil sem coluna própria vão no jsonb `preferencias` (mesmo padrão de `plans.payload`);
 * o resto são colunas planas (snake_case do DB).
 *
 * FORA daqui (setados no signup/onboarding, não no PerfilResumo): `id` (= auth.users.id),
 * `email`, `aceite_18/termos/lgpd/em`, `created_at/updated_at`. O chamador os mescla.
 */

/** Bloco `preferencias` (jsonb) — os campos do perfil que não têm coluna própria
 *  (9 do v1 + 3 do mesociclo/modo força — v2 §7, DF 2026-07-08; + o carimbo do "fiquei
 *  doente" — Leva 2 · Bloco 4, DF 2026-07-27; o jsonb do 0005 absorve as chaves novas sem
 *  migração SQL). */
export interface PreferenciasPerfil {
  nivelExperiencia: PerfilResumo['nivelExperiencia'];
  equipamento: PerfilResumo['equipamento'];
  equipamentosCasa: PerfilResumo['equipamentosCasa'];
  treinoDias: PerfilResumo['treinoDias'];
  diasDisponiveis: PerfilResumo['diasDisponiveis'];
  tempoPorSessaoMin: PerfilResumo['tempoPorSessaoMin'];
  naoCurto: PerfilResumo['naoCurto'];
  favoritos: PerfilResumo['favoritos'];
  pratosCansados: PerfilResumo['pratosCansados'];
  mesocicloInicio?: PerfilResumo['mesocicloInicio'];
  /**
   * 🔻 LEGADO — só existe para ser PODADO na leitura (correção 3.5, 2026-08-01).
   *
   * `mesocicloSemana` era cache sem consumidor: a semana do ciclo sempre foi derivada de
   * `mesocicloInicio` + as datas das sessões (`semanaDoCiclo`), e o único read do campo
   * comparava o valor contra ele mesmo para decidir se se reescrevia. Saiu do
   * `PerfilResumo` inteiro.
   *
   * ⚠️ Continua declarado AQUI porque o valor está gravado no `preferencias` das contas que
   * já existem. Sem a poda, o `2` fóssil seguiria sendo lido por telemetria, suporte e
   * export LGPD — e é esse o motivo pelo qual o item existe. Poda na leitura + ausência na
   * escrita = o campo some do banco no próximo save, sem migration.
   */
  mesocicloSemana?: number;
  deloadAte?: PerfilResumo['deloadAte'];
  modoForca?: PerfilResumo['modoForca'];
  reconhecidoEm?: PerfilResumo['reconhecidoEm'];
  /**
   * 🔴 O FIO DO v3 — leva A do v4 (handoff-motor-volume-v4-2026-08-12). Os campos abaixo
   * existiam no `PerfilResumo` e NÃO eram mapeados — o save os apagava do servidor, e o
   * boot server-first apagava o cache local em seguida. O jsonb do 0005 absorve as chaves
   * novas sem migration (P0.1 verificado: `preferencias jsonb`, não colunas).
   *
   * ⚠️ Nome `preferenciasTreino` de propósito: o bloco jsonb inteiro já se chama
   * `preferencias` no banco; repetir o nome DENTRO dele criaria `preferencias.preferencias`,
   * ilegível em telemetria, suporte e export LGPD.
   */
  preferenciasTreino?: PerfilResumo['preferencias'];
  foco?: PerfilResumo['foco'];
  cardioFavorito?: PerfilResumo['cardioFavorito'];
  tecnicasAvancadas?: PerfilResumo['tecnicasAvancadas'];
  orcamento?: PerfilResumo['orcamento'];
  divisaoPreferida?: PerfilResumo['divisaoPreferida'];
  /** 🧭 Editor guiado: só o DESENHO (ids por dia) — ~380 bytes, 171× abaixo do teto de 64 KB. */
  rotinaCustom?: PerfilResumo['rotinaCustom'];
}

/** Subconjunto de colunas de `public.profile` derivado do `PerfilResumo`. */
export interface ProfileRow {
  sexo: PerfilResumo['sexo'];
  peso_kg: number;
  altura_cm: number;
  idade: number;
  nivel_atividade: PerfilResumo['nivelAtividade'];
  objetivo: PerfilResumo['objetivo'];
  gestacao_amamentacao: boolean;
  renal: boolean;
  cardiaca: boolean;
  lesao: boolean;
  diabetes: boolean;
  preferencia_alimentar: PerfilResumo['preferencia'];
  alergenos: PerfilResumo['alergenos'];
  preferencias: PreferenciasPerfil;
}

/** `PerfilResumo` → linha de `profile` (colunas planas + jsonb de preferências). */
export function perfilParaLinha(p: PerfilResumo): ProfileRow {
  return {
    sexo: p.sexo,
    peso_kg: p.pesoKg,
    altura_cm: p.alturaCm,
    idade: p.idade,
    nivel_atividade: p.nivelAtividade,
    objetivo: p.objetivo,
    gestacao_amamentacao: p.flagsSaude.gestacaoAmamentacao,
    renal: p.flagsSaude.renal,
    cardiaca: p.flagsSaude.cardiaca,
    lesao: p.flagsSaude.lesao,
    diabetes: p.flagsSaude.diabetes,
    preferencia_alimentar: p.preferencia,
    alergenos: p.alergenos,
    preferencias: {
      nivelExperiencia: p.nivelExperiencia,
      equipamento: p.equipamento,
      equipamentosCasa: p.equipamentosCasa,
      treinoDias: p.treinoDias,
      diasDisponiveis: p.diasDisponiveis,
      tempoPorSessaoMin: p.tempoPorSessaoMin,
      naoCurto: p.naoCurto,
      favoritos: p.favoritos,
      pratosCansados: p.pratosCansados,
      ...(p.mesocicloInicio != null ? { mesocicloInicio: p.mesocicloInicio } : {}),
      // 🔒 `mesocicloSemana` NÃO é escrito (3.5): junto com a poda da leitura, o campo some
      // do `preferencias` no próximo save de cada conta — sem migration e sem varredura.

      ...(p.deloadAte != null ? { deloadAte: p.deloadAte } : {}),
      ...(p.modoForca != null ? { modoForca: p.modoForca } : {}),
      ...(p.reconhecidoEm != null ? { reconhecidoEm: p.reconhecidoEm } : {}),
      // 🔴 O fio do v3 (leva A do v4): gravar o que a leitura devolve, campo a campo.
      ...(p.preferencias != null ? { preferenciasTreino: p.preferencias } : {}),
      ...(p.foco != null ? { foco: p.foco } : {}),
      ...(p.tecnicasAvancadas != null ? { tecnicasAvancadas: p.tecnicasAvancadas } : {}),
      ...(p.cardioFavorito != null ? { cardioFavorito: p.cardioFavorito } : {}),
      ...(p.orcamento != null ? { orcamento: p.orcamento } : {}),
      ...(p.divisaoPreferida != null ? { divisaoPreferida: p.divisaoPreferida } : {}),
      ...(p.rotinaCustom != null ? { rotinaCustom: p.rotinaCustom } : {}),
    },
  };
}

/** Consentimentos do onboarding (LGPD/18+): a base legal exige o REGISTRO, não só o
 *  checkbox. Chaves camelCase = validação da borda (`consentimentoSchema`). */
export interface Consentimentos {
  aceite18: boolean;
  aceiteTermos: boolean;
  aceiteLgpd: boolean;
}

/** Mescla os consentimentos + carimbo na linha de `profile` (colunas do 0001). PURO —
 *  `agoraISO` entra por parâmetro (sem relógio embutido). */
export function linhaComConsentimentos<T extends object>(
  linha: T,
  consent: Consentimentos,
  agoraISO: string,
): T & { aceite_18: boolean; aceite_termos: boolean; aceite_lgpd: boolean; aceite_em: string } {
  return {
    ...linha,
    aceite_18: consent.aceite18,
    aceite_termos: consent.aceiteTermos,
    aceite_lgpd: consent.aceiteLgpd,
    aceite_em: agoraISO,
  };
}

/** Linha de `profile` → `PerfilResumo` (inverso fiel de `perfilParaLinha`). */
export function linhaParaPerfil(row: ProfileRow): PerfilResumo {
  const pref = row.preferencias && typeof row.preferencias === 'object' && !Array.isArray(row.preferencias)
    ? row.preferencias : {} as PreferenciasPerfil;
  /**
   * 🔴 D6 (2026-09-10) — o jsonb `preferencias` de uma linha LEGADA guarda qualquer forma, e
   * este é o inverso do PUT: o que sai daqui vai direto ao motor. `sanearPerfilHidratado`
   * aplica a mesma régua do schema de escrita — bloco inválido some, o perfil segue.
   *
   * 🔴 D11 (2026-09-11): a régua passou a alcançar também os ESCALARES. O GET de perfil só
   * exige `preferencias?.nivelExperiencia` TRUTHY e o cliente não valida o corpo recebido —
   * a barreira que existe na API pública não existia no caminho que o app de fato usa.
   */
  return sanearPerfilHidratado({
    sexo: row.sexo,
    idade: row.idade,
    alturaCm: row.altura_cm,
    pesoKg: row.peso_kg,
    objetivo: row.objetivo,
    nivelAtividade: row.nivel_atividade,
    nivelExperiencia: pref.nivelExperiencia,
    equipamento: pref.equipamento,
    preferencia: row.preferencia_alimentar,
    alergenos: row.alergenos,
    diasDisponiveis: pref.diasDisponiveis,
    tempoPorSessaoMin: pref.tempoPorSessaoMin,
    treinoDias: pref.treinoDias,
    naoCurto: pref.naoCurto,
    favoritos: pref.favoritos,
    equipamentosCasa: pref.equipamentosCasa,
    pratosCansados: pref.pratosCansados,
    ...(pref.mesocicloInicio != null ? { mesocicloInicio: pref.mesocicloInicio } : {}),
    // 🔻 PODA (3.5): o fóssil não entra no perfil. Ignorar não bastaria — ele voltaria ao
    // banco no save seguinte e continuaria visível para telemetria, suporte e export LGPD.

    ...(pref.deloadAte != null ? { deloadAte: pref.deloadAte } : {}),
    ...(pref.modoForca != null ? { modoForca: pref.modoForca } : {}),
    ...(pref.reconhecidoEm != null ? { reconhecidoEm: pref.reconhecidoEm } : {}),
    // 🔴 O fio do v3 (leva A do v4): inverso fiel do bloco de escrita acima.
    ...(pref.preferenciasTreino != null ? { preferencias: pref.preferenciasTreino } : {}),
    ...(pref.foco != null ? { foco: pref.foco } : {}),
    ...(pref.tecnicasAvancadas != null ? { tecnicasAvancadas: pref.tecnicasAvancadas } : {}),
    ...(pref.cardioFavorito != null ? { cardioFavorito: pref.cardioFavorito } : {}),
    ...(pref.orcamento != null ? { orcamento: pref.orcamento } : {}),
    ...(pref.divisaoPreferida != null ? { divisaoPreferida: pref.divisaoPreferida } : {}),
    ...(pref.rotinaCustom != null ? { rotinaCustom: pref.rotinaCustom } : {}),
    flagsSaude: {
      gestacaoAmamentacao: row.gestacao_amamentacao,
      renal: row.renal,
      cardiaca: row.cardiaca,
      lesao: row.lesao,
      diabetes: row.diabetes,
    },
  });
}
