/**
 * 🔴 R2 (revisão conjunta peso × registro, 2026-09-11) — REGRESSÃO DO COMPORTAMENTO CORRETO.
 *
 * O defeito era um `if/else` que perdia dado nos dois ramos:
 *  · servidor NÃO-vazio substituía a série local INTEIRA — a pesagem feita offline, ainda
 *    não enviada, desaparecia no reload;
 *  · o reenvio existia SÓ no ramo de servidor vazio — logo um POST de peso que funcionou
 *    com um PUT de perfil que falhou nunca era reparado, e como o boot do perfil é
 *    server-first, o reload trazia o perfil ANTIGO ao lado do histórico novo.
 *
 * Guard em seis pernas:
 *  ① pesagem offline pendente sobrevive à hidratação com servidor não-vazio;
 *  ② o servidor vence NO DIA que ele tem (conflito por dia, duas abas, dois dispositivos);
 *  ③ o reenvio alcança os dias só-locais mesmo com servidor não-vazio;
 *  ④ convergência perfil ↔ histórico nas duas falhas independentes (POST ok/PUT falho e
 *     POST falho/PUT ok);
 *  ⑤ pesagem ANTIGA nunca vira peso atual — nem na hidratação, nem no reenviado;
 *  ⑥ âncora e ciclo não são tocados, e resposta fora de ordem não regride a série.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reconciliarPerfilComPesoAceito, reconciliarSeriePesos } from '../lib/peso-reconciliacao';
import type { RegistroPeso } from '../lib/treino-historico';

const HOJE = '2026-09-11';
const ONTEM = '2026-09-10';
const ANTEONTEM = '2026-09-09';
const CONTA = 'user-a';
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const p = (dataISO: string | null, kg: number): RegistroPeso => ({ dataISO, kg });

/** Reconciliação de perfil na hidratação: o dia GOVERNANTE é sempre o dia corrente. */
const perfilAposHidratacao = (pesoAtualDoPerfil: number, pesoDeHoje: number | null) =>
  reconciliarPerfilComPesoAceito({ pesoKg: pesoAtualDoPerfil, nome: 'n' }, {
    pesoAceito: pesoDeHoje,
    diaDaResposta: pesoDeHoje == null ? null : HOJE,
    diaGovernante: HOJE,
    montado: true,
    contaDaChamada: CONTA,
    contaAgora: CONTA,
  });

describe('🔴 R2 ① — pesagem offline pendente sobrevive ao servidor não-vazio', () => {
  it('o dia que só existe no local FICA na série e entra na fila de reenvio', () => {
    const locais = [p(ANTEONTEM, 79), p(HOJE, 81)]; // 81 de hoje ainda não subiu
    const doServidor = [p(ANTEONTEM, 79)];
    const r = reconciliarSeriePesos(locais, doServidor, HOJE);
    expect(r.serie.map((x) => [x.dataISO, x.kg])).toEqual([[ANTEONTEM, 79], [HOJE, 81]]);
    expect(r.pendentes).toEqual([p(HOJE, 81)]);
    expect(r.pesoDeHoje).toBe(81);
  });

  it('série do servidor NÃO apaga mais o local inteiro: o defeito original', () => {
    const r = reconciliarSeriePesos([p(HOJE, 81)], [p(ONTEM, 80)], HOJE);
    expect(r.serie.length, 'a pesagem local de hoje foi descartada').toBe(2);
    expect(r.pesoDeHoje).toBe(81);
  });

  it('servidor vazio mantém o local inteiro e reenvia tudo (comportamento preservado)', () => {
    const locais = [p(null, 78), p(ONTEM, 80)];
    const r = reconciliarSeriePesos(locais, [], HOJE);
    expect(r.serie).toEqual(locais);
    expect(r.pendentes).toEqual(locais);
    expect(r.legadosDescartados).toBe(0);
    expect(r.pesoDeHoje).toBeNull();
  });
});

describe('🔴 R2 ② — o servidor vence no dia que ele tem', () => {
  it('conflito no MESMO dia: o valor do servidor é o que fica', () => {
    const r = reconciliarSeriePesos([p(HOJE, 81)], [p(HOJE, 80)], HOJE);
    expect(r.serie).toEqual([p(HOJE, 80)]);
    expect(r.pendentes, 'um dia que o servidor já tem não se reenvia').toEqual([]);
    expect(r.pesoDeHoje).toBe(80);
  });

  it('dois dispositivos: o que B registrou aparece em A sem A ter nada local', () => {
    const r = reconciliarSeriePesos([], [p(HOJE, 82)], HOJE);
    expect(r.pesoDeHoje).toBe(82);
    expect(perfilAposHidratacao(80, r.pesoDeHoje).perfil?.pesoKg).toBe(82);
  });

  it('legado sem data é descartado quando o servidor tem série — e fica CONTADO', () => {
    const r = reconciliarSeriePesos([p(null, 77), p(HOJE, 81)], [p(ONTEM, 80)], HOJE);
    expect(r.legadosDescartados).toBe(1);
    expect(r.serie.some((x) => x.dataISO === null), 'legado sem dia não reconcilia').toBe(false);
    expect(r.pendentes, 'legado sem dia não sobe carimbado com hoje').toEqual([p(HOJE, 81)]);
  });

  it('a série sai ordenada por dia: pesagem sincronizada depois não entra fora de lugar', () => {
    const r = reconciliarSeriePesos([p(HOJE, 81), p(ANTEONTEM, 79)], [p(ONTEM, 80)], HOJE);
    expect(r.serie.map((x) => x.dataISO)).toEqual([ANTEONTEM, ONTEM, HOJE]);
  });
});

describe('🔴 R2 ③④ — reenvio e convergência nas falhas independentes', () => {
  it('POST de peso OK + PUT de perfil FALHO: o reload converge o perfil ao histórico', () => {
    // O servidor gravou 81 hoje; o perfil no servidor (server-first no boot) ficou 80.
    const r = reconciliarSeriePesos([], [p(ONTEM, 80), p(HOJE, 81)], HOJE);
    const perfil = perfilAposHidratacao(80, r.pesoDeHoje);
    expect(perfil.perfil?.pesoKg, 'perfil seguiu atrás do histórico').toBe(81);
  });

  it('POST de peso FALHO + PUT de perfil OK: o ponto fica pendente e é reenviado', () => {
    // O perfil já é 81 (o PUT funcionou); o servidor não tem o ponto de hoje.
    const r = reconciliarSeriePesos([p(HOJE, 81)], [p(ONTEM, 80)], HOJE);
    expect(r.pendentes, 'o ponto perdido não entrou na fila de reenvio').toEqual([p(HOJE, 81)]);
    // Já convergidos: a hidratação não precisa reescrever o perfil.
    expect(perfilAposHidratacao(81, r.pesoDeHoje).motivo).toBe('JA_CONVERGIDO');
  });

  it('sem pesagem hoje, a hidratação não encosta no perfil', () => {
    const r = reconciliarSeriePesos([], [p(ONTEM, 80)], HOJE);
    expect(r.pesoDeHoje).toBeNull();
    expect(perfilAposHidratacao(85, r.pesoDeHoje).motivo).toBe('FORA_DO_DOMINIO');
  });

  it('recusa no reenvio de um dia antigo alinha AQUELE dia e não o perfil', () => {
    const aceitoNoDiaAntigo = 79.5;
    const decisao = reconciliarPerfilComPesoAceito({ pesoKg: 81, nome: 'n' }, {
      pesoAceito: aceitoNoDiaAntigo,
      diaDaResposta: ANTEONTEM,
      diaGovernante: HOJE,
      montado: true,
      contaDaChamada: CONTA,
      contaAgora: CONTA,
    });
    expect(decisao).toEqual({ perfil: null, motivo: 'DIA_NAO_GOVERNANTE' });
  });
});

describe('🔴 R2 ⑤ — pesagem antiga nunca vira peso atual', () => {
  it('histórico remoto antigo com perfil novo: o perfil NÃO regride', () => {
    const r = reconciliarSeriePesos([], [p('2026-01-02', 95), p(ANTEONTEM, 90)], HOJE);
    expect(r.pesoDeHoje).toBeNull();
    const perfil = perfilAposHidratacao(81, r.pesoDeHoje);
    expect(perfil.perfil, 'um ponto de janeiro virou o peso de hoje').toBeNull();
  });

  it('resposta fora de ordem: o GET antigo não apaga a pesagem de hoje', () => {
    // A pessoa se pesou (81, hoje) enquanto o GET — tirado antes — ainda voltava.
    const getAntigo = [p(ONTEM, 80)];
    const r = reconciliarSeriePesos([p(ONTEM, 80), p(HOJE, 81)], getAntigo, HOJE);
    expect(r.pesoDeHoje).toBe(81);
    expect(r.pendentes).toEqual([p(HOJE, 81)]);
  });

  it('o valor do dia no servidor é imutável, então respostas repetidas são idempotentes', () => {
    const locais = [p(HOJE, 81)];
    const servidor = [p(HOJE, 80)];
    const a = reconciliarSeriePesos(locais, servidor, HOJE);
    const b = reconciliarSeriePesos(a.serie, servidor, HOJE);
    expect(b.serie).toEqual(a.serie);
    expect(b.pendentes).toEqual([]);
  });
});

describe('🔴 R2 ⑥ — a hidratação não reancora nem recomputa plano', () => {
  const painel = semComentarios(readFileSync('src/components/painel/Painel.tsx', 'utf8'));
  const efeito = (() => {
    const i = painel.indexOf('const semente: RegistroPeso');
    expect(i, 'o efeito de hidratação de pesos desapareceu').toBeGreaterThan(-1);
    return painel.slice(i, painel.indexOf('}, []);', i));
  })();

  it('nada de `reancorarPesoDoPlanoLocal` nem `recomputarPlano` no efeito', () => {
    expect(efeito.includes('reancorar'), 'a hidratação passou a reancorar').toBe(false);
    expect(efeito.includes('recomputarPlano'), 'a hidratação passou a regerar o plano').toBe(false);
  });

  it('usa a reconciliação única e não o `if (doServidor.length > 0)` antigo', () => {
    expect(efeito).toContain('reconciliarSeriePesos');
    expect(/doServidor\.length\s*>\s*0/.test(efeito), 'o ramo que substituía a série voltou').toBe(false);
  });

  it('o reenvio percorre os PENDENTES, não mais só o ramo de servidor vazio', () => {
    expect(efeito).toContain('for (const v of pendentes)');
  });

  it('a reancoragem segue existindo fora daqui (o guard não é vacuidade)', () => {
    expect(painel).toContain('reancorarPesoDoPlanoLocal');
  });
});
