import type { PerfilResumo } from '@/components/painel/Painel';

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

/** Bloco `preferencias` (jsonb) — os 9 campos do perfil que não têm coluna própria. */
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
  const pref = row.preferencias;
  return {
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
    flagsSaude: {
      gestacaoAmamentacao: row.gestacao_amamentacao,
      renal: row.renal,
      cardiaca: row.cardiaca,
      lesao: row.lesao,
      diabetes: row.diabetes,
    },
  };
}
