/**
 * ⚙️ CALORIAS DO CARDIO — VERIFICAÇÃO DA FÓRMULA VIGENTE (revisão conjunta, 2026-09-11).
 *
 * Não é correção: nenhum MET muda aqui, nem a política de kcal (a estimativa NUNCA volta
 * para a dieta — alvo de 2000 continua 2000). O que este arquivo trava é que a estimativa
 * DEPENDE do peso, e que o peso que ela usa é o do perfil — que agora segue a pesagem.
 *
 * Fórmula vigente (`engine/cardio · kcalLiquida`): gasto LÍQUIDO
 * `(MET − 1) × 3,5 × peso × min / 200`. Linear no peso ⇒ mesma atividade, mesma intensidade
 * e mesma duração dão estimativas BRUTAS diferentes para pesos diferentes, maior para o
 * maior peso.
 *
 * ⚠️ O ARREDONDAMENTO É CONFERIDO À PARTE: `kcalExibida` arredonda para a dezena, e duas
 * pessoas com pesos próximos podem ver o MESMO número. Isso é da exibição, não da conta —
 * e é por isso que o bruto é testado separado do exibido.
 */
import { describe, expect, it } from 'vitest';
import { KCAL_PISO_EXIBICAO, kcalExibida, kcalLiquida, metDe } from '../lib/engine/cardio';
import { PESO_MAX_KG, PESO_MIN_KG, noDominioDoPeso } from '../lib/peso-dominio';
import { reconciliarPerfilComPesoAceito, reconciliarSeriePesos } from '../lib/peso-reconciliacao';

const HOJE = '2026-09-11';
const ONTEM = '2026-09-10';
const CONTA = 'user-a';
/** Mesma atividade / intensidade / duração nos dois lados da comparação. */
const MET = metDe('caminhada', 'moderado')!;
const MINUTOS = 30;
const bruto = (pesoKg: number) => kcalLiquida(MET, pesoKg, MINUTOS);

describe('⚙️ a estimativa BRUTA cresce com o peso', () => {
  it('63 kg e 68 kg produzem estimativas diferentes, maior para 68 kg', () => {
    const a = bruto(63);
    const b = bruto(68);
    expect(a).not.toBe(b);
    expect(b).toBeGreaterThan(a);
    expect(a).toBeCloseTo(109.1475, 6);
    expect(b).toBeCloseTo(117.81, 6);
  });

  it('a razão entre as estimativas é a razão entre os pesos (linear, sem degrau)', () => {
    expect(bruto(68) / bruto(63)).toBeCloseTo(68 / 63, 10);
  });

  it('vale para qualquer par crescente de pesos válidos e para outras modalidades', () => {
    const pesos = [30, 45, 63, 63.4, 68, 80.25, 120, 300];
    for (const par of [['caminhada', 'moderado'], ['corrida', 'vigoroso'], ['bike', 'leve']] as const) {
      const met = metDe(par[0], par[1])!;
      for (let i = 1; i < pesos.length; i += 1) {
        expect(kcalLiquida(met, pesos[i]!, 45)).toBeGreaterThan(kcalLiquida(met, pesos[i - 1]!, 45));
      }
    }
  });

  it('pesos DECIMAIS entram na conta sem truncar', () => {
    expect(bruto(63.4)).toBeGreaterThan(bruto(63));
    expect(bruto(63.4)).toBeLessThan(bruto(68));
    expect(bruto(63.4)).toBeCloseTo(109.8405, 6);
  });

  it('os limites válidos do schema são aceitos e produzem estimativas distintas', () => {
    expect(noDominioDoPeso(PESO_MIN_KG) && noDominioDoPeso(PESO_MAX_KG)).toBe(true);
    expect(bruto(PESO_MAX_KG)).toBeGreaterThan(bruto(PESO_MIN_KG));
  });

  it('valores INVÁLIDOS são rejeitados antes de virarem estimativa', () => {
    for (const invalido of [0, -70, PESO_MIN_KG - 0.1, PESO_MAX_KG + 0.1, Number.NaN]) {
      expect(noDominioDoPeso(invalido), `${invalido} passou pelo domínio`).toBe(false);
    }
    // E a própria fórmula não devolve número negativo nem lixo para entrada degenerada.
    expect(kcalLiquida(MET, 0, MINUTOS)).toBe(0);
    expect(kcalLiquida(MET, Number.NaN, MINUTOS)).toBe(0);
    expect(kcalLiquida(MET, 70, 0)).toBe(0);
    expect(kcalLiquida(MET, 70, -10)).toBe(0);
  });
});

describe('⚙️ o ARREDONDAMENTO, conferido à parte', () => {
  it('exibe a dezena mais próxima do bruto', () => {
    expect(kcalExibida(bruto(63))).toEqual({ piso: false, kcal: 110 });
    expect(kcalExibida(bruto(68))).toEqual({ piso: false, kcal: 120 });
  });

  it('brutos DIFERENTES podem exibir o MESMO número — é da exibição, não da conta', () => {
    expect(bruto(63)).not.toBe(bruto(63.4));
    expect(kcalExibida(bruto(63))).toEqual(kcalExibida(bruto(63.4)));
  });

  it('abaixo do piso a tela diz "menos de 10 kcal", nunca 0', () => {
    expect(kcalExibida(KCAL_PISO_EXIBICAO - 0.01)).toEqual({ piso: true });
    expect(kcalExibida(0)).toEqual({ piso: true });
    expect(kcalExibida(Number.NaN)).toEqual({ piso: true });
  });
});

describe('⚙️ o fluxo: pesagem aceita → perfil → estimativa', () => {
  const perfil = (pesoKg: number) => ({ pesoKg, nome: 'n' });
  const resposta = (pesoAceito: unknown, dia: string | null = HOJE) => ({
    pesoAceito,
    diaDaResposta: dia,
    diaGovernante: HOJE,
    montado: true,
    contaDaChamada: CONTA,
    contaAgora: CONTA,
  });

  it('pesagem aceita de 68 kg com perfil em 63: a estimativa passa a usar 68', () => {
    const antes = bruto(perfil(63).pesoKg);
    const depois = reconciliarPerfilComPesoAceito(perfil(63), resposta(68));
    expect(depois.perfil?.pesoKg).toBe(68);
    expect(bruto(depois.perfil!.pesoKg)).toBeGreaterThan(antes);
    expect(bruto(depois.perfil!.pesoKg)).toBeCloseTo(117.81, 6);
  });

  it('APÓS RELOAD a estimativa continua usando o peso novo (convergência da hidratação)', () => {
    // Reload: o POST do peso funcionou (servidor tem 68 hoje), o PUT do perfil falhou —
    // o boot é server-first, então o perfil volta 63. A hidratação é quem converge.
    const r = reconciliarSeriePesos([], [{ dataISO: ONTEM, kg: 63 }, { dataISO: HOJE, kg: 68 }], HOJE);
    expect(r.pesoDeHoje).toBe(68);
    const convergido = reconciliarPerfilComPesoAceito(perfil(63), resposta(r.pesoDeHoje));
    expect(convergido.perfil?.pesoKg).toBe(68);
    expect(bruto(convergido.perfil!.pesoKg)).toBeCloseTo(117.81, 6);
  });

  it('pesagem RECUSADA não altera o cálculo', () => {
    // Segunda pesagem do dia: o servidor manteve o primeiro registro (63) e devolveu 63.
    const semMudanca = reconciliarPerfilComPesoAceito(perfil(63), resposta(63));
    expect(semMudanca).toEqual({ perfil: null, motivo: 'JA_CONVERGIDO' });
    expect(bruto(63)).toBeCloseTo(109.1475, 6);
  });

  it('recusa SEM peso legível (R4) não move a estimativa', () => {
    const r = reconciliarPerfilComPesoAceito(perfil(63), resposta(null));
    expect(r.perfil).toBeNull();
    expect(bruto(63)).toBeCloseTo(109.1475, 6);
  });

  it('pesagem de OUTRO dia não vira o peso da estimativa de hoje', () => {
    const r = reconciliarPerfilComPesoAceito(perfil(63), resposta(90, ONTEM));
    expect(r).toEqual({ perfil: null, motivo: 'DIA_NAO_GOVERNANTE' });
  });

  it('a tela de cardio lê o peso DO PERFIL (o elo que sustenta o fluxo)', async () => {
    const { readFileSync } = await import('node:fs');
    const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');
    expect(painel).toContain('<RegistrarCardio');
    expect(painel).toContain('pesoKg={perfil.pesoKg}');
    const cardio = readFileSync('src/components/painel/Cardio.tsx', 'utf8');
    expect(cardio).toContain('kcalLiquida(met, pesoKg, minutos)');
  });

  it('nem MET nem política de kcal foram tocados nesta revisão', () => {
    // Valores do Compendium travados no cofre — anti-vacuidade do "não alterei METs".
    expect(metDe('caminhada', 'moderado')).toBe(4.3);
    expect(metDe('corrida', 'vigoroso')).toBe(9.3);
    expect(metDe('pular_corda', 'leve')).toBeNull();
    expect(KCAL_PISO_EXIBICAO).toBe(10);
  });
});
