/**
 * 🔴 F3 (fechamento dirigido de `7a8f2c2`, QA autenticada 2026-09-11) — REGRESSÃO DO
 * COMPORTAMENTO CORRETO no gráfico de peso.
 *
 * O defeito medido na prévia autenticada: a UI dizia **"2 registros"** com **uma** pesagem
 * no banco (64 kg em 11/09), e a variação exibida mudou de **−1 para 0** ao recarregar.
 *
 * Causa: o Painel abre a série com uma SEMENTE sem data (`{ dataISO: null, kg: perfil.pesoKg }`)
 * e a tela fazia `pesos.length` e `atual - pesos[0]`. Três erros num:
 *  · conta o peso do perfil como pesagem;
 *  · transforma o peso ATUAL do perfil num passado inventado (o "primeiro ponto");
 *  · variação instável — antes do reload a semente é o peso antigo do perfil (−1), depois é
 *    o novo (0): o mesmo histórico contando duas histórias.
 *
 * Guard em cinco pernas:
 *  ① o caso exato da prévia: 1 pesagem de 64 kg ⇒ "1 registro" e SEM comparação;
 *  ② estabilidade no reload — a semente muda, o resumo não;
 *  ③ zero, uma e várias pesagens;
 *  ④ referência da variação é a PRIMEIRA pesagem datada, declarada e estável;
 *  ⑤ a fonte não voltou a contar `pesos.length` nem a usar a semente na tela, e âncora,
 *    dieta/cardio e a regra de uma pesagem por dia seguem intactas.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fraseSemComparacao, resumoPesoExibido, rotuloVariacao } from '../lib/peso-progresso';
import type { RegistroPeso } from '../lib/treino-historico';

const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const painel = () => semComentarios(readFileSync('src/components/painel/Painel.tsx', 'utf8'));
const p = (dataISO: string | null, kg: number): RegistroPeso => ({ dataISO, kg });
/** Série como o Painel monta: semente do perfil na frente, pesagens depois. */
const comSemente = (pesoDoPerfil: number, ...pesagens: RegistroPeso[]) => [p(null, pesoDoPerfil), ...pesagens];

describe('🔴 F3 ① — o caso exato da prévia autenticada', () => {
  it('uma pesagem de 64 kg com perfil em 64: "1 registro", não 2', () => {
    const r = resumoPesoExibido(comSemente(64, p('2026-09-11', 64)), 64);
    expect(r.registros, 'a semente do perfil voltou a ser contada como pesagem').toBe(1);
    expect(r.atualKg).toBe(64);
    expect(r.atualEhPesagem).toBe(true);
    expect(r.serieKg, 'a semente entrou no gráfico').toEqual([64]);
  });

  it('com uma pesagem só, NÃO há variação a exibir', () => {
    const r = resumoPesoExibido(comSemente(64, p('2026-09-11', 64)), 64);
    expect(r.variacao).toEqual({ tipo: 'SEM_COMPARACAO', motivo: 'UMA_PESAGEM' });
    expect(rotuloVariacao(r.variacao), 'exibiu número onde não há comparação').toBeNull();
    expect(fraseSemComparacao('UMA_PESAGEM')).toContain('a partir da segunda');
  });

  it('o 64 kg aprovado é preservado: a tela mostra a PESAGEM, não o perfil', () => {
    const r = resumoPesoExibido(comSemente(64, p('2026-09-11', 64)), 64);
    expect(r.atualKg).toBe(64);
  });

  /**
   * 🔒 CONTRASTE EXPLÍCITO com a conta antiga. `resumoPesoExibido` é módulo novo, então os
   * casos de comportamento acima não teriam como "falhar antes" — o que falha contra
   * `7a8f2c2` são os guards de fonte de ⑤. Para o defeito ficar medido e não só descrito, a
   * aritmética ANTIGA é reproduzida aqui e comparada com a nova.
   */
  const contaAntiga = (serieComSemente: readonly RegistroPeso[]) => {
    const kg = serieComSemente.map((x) => x.kg);
    return { registros: kg.length, variacao: kg[kg.length - 1]! - kg[0]! };
  };

  it('a conta antiga dizia 2 registros; a nova diz 1', () => {
    const serie = comSemente(64, p('2026-09-11', 64));
    expect(contaAntiga(serie).registros).toBe(2);
    expect(resumoPesoExibido(serie, 64).registros).toBe(1);
  });

  it('a conta antiga dava −1 antes do reload e 0 depois; a nova não dá número nenhum', () => {
    const pesagem = p('2026-09-11', 64);
    expect(contaAntiga(comSemente(65, pesagem)).variacao).toBe(-1); // semente = perfil ANTIGO
    expect(contaAntiga(comSemente(64, pesagem)).variacao).toBe(0);  // semente = perfil NOVO
    expect(rotuloVariacao(resumoPesoExibido(comSemente(65, pesagem), 65).variacao)).toBeNull();
    expect(rotuloVariacao(resumoPesoExibido(comSemente(64, pesagem), 64).variacao)).toBeNull();
  });
});

describe('🔴 F3 ② — estabilidade no reload (a variação não muda de valor)', () => {
  /**
   * A sequência real: perfil 65 → pesagem de 64 aceita → o perfil segue o registro (R1).
   * ANTES do reload a semente ainda é 65 (variação −1); DEPOIS é 64 (variação 0). O resumo
   * tem de dar o MESMO resultado nas duas, porque o histórico é o mesmo.
   */
  const pesagem = p('2026-09-11', 64);

  it('semente 65 (antes) e semente 64 (depois) dão o mesmo resumo', () => {
    const antes = resumoPesoExibido(comSemente(65, pesagem), 65);
    const depois = resumoPesoExibido(comSemente(64, pesagem), 64);
    expect(antes).toEqual(depois);
    expect(antes.variacao.tipo).toBe('SEM_COMPARACAO');
    expect(rotuloVariacao(antes.variacao)).toBeNull();
  });

  it('nenhuma semente produz variação, qualquer que seja o peso do perfil', () => {
    for (const perfilKg of [30, 63, 64, 65, 120, 300]) {
      const r = resumoPesoExibido(comSemente(perfilKg, pesagem), perfilKg);
      expect(r.registros, `perfil ${perfilKg} mudou a contagem`).toBe(1);
      expect(rotuloVariacao(r.variacao), `perfil ${perfilKg} inventou variação`).toBeNull();
    }
  });
});

describe('🔴 F3 ③ — zero, uma e várias pesagens', () => {
  it('zero pesagens: exibe o peso do PERFIL, rotulado como tal, e ausência de comparação', () => {
    const r = resumoPesoExibido(comSemente(64), 64);
    expect(r.registros).toBe(0);
    expect(r.atualKg).toBe(64);
    expect(r.atualEhPesagem, 'peso do perfil apresentado como se fosse pesagem').toBe(false);
    expect(r.variacao).toEqual({ tipo: 'SEM_COMPARACAO', motivo: 'NENHUMA_PESAGEM' });
    expect(r.serieKg, 'gráfico com ponto inventado').toEqual([]);
    expect(fraseSemComparacao('NENHUMA_PESAGEM')).toContain('do seu perfil');
  });

  it('série totalmente vazia (nem semente) não quebra', () => {
    const r = resumoPesoExibido([], 70);
    expect(r).toMatchObject({ registros: 0, atualKg: 70, atualEhPesagem: false, serieKg: [] });
  });

  it('várias pesagens: conta todas as datadas e compara a primeira com a última', () => {
    const r = resumoPesoExibido(
      comSemente(65, p('2026-09-09', 66), p('2026-09-10', 65), p('2026-09-11', 64)),
      64,
    );
    expect(r.registros).toBe(3);
    expect(r.atualKg).toBe(64);
    expect(r.variacao).toEqual({
      tipo: 'COMPARADA', kg: -2, deISO: '2026-09-09', deKg: 66, ateISO: '2026-09-11',
    });
    expect(rotuloVariacao(r.variacao)).toBe('-2.0');
    expect(r.serieKg).toEqual([66, 65, 64]);
  });

  it('ganho de peso sai com sinal `+`', () => {
    const r = resumoPesoExibido(comSemente(70, p('2026-09-01', 70), p('2026-09-11', 72.5)), 72.5);
    expect(rotuloVariacao(r.variacao)).toBe('+2.5');
  });

  it('registro LEGADO sem data (de antes da Leva D) também não conta nem compara', () => {
    const r = resumoPesoExibido([p(null, 80), p(null, 79), p('2026-09-11', 64)], 64);
    expect(r.registros).toBe(1);
    expect(r.serieKg).toEqual([64]);
    expect(r.variacao.tipo).toBe('SEM_COMPARACAO');
  });
});

describe('🔴 F3 ④ — a referência é a primeira pesagem datada, e é estável', () => {
  it('ordena por dia: pesagem sincronizada depois não vira referência por chegar depois', () => {
    // Chega fora de ordem (reconciliação/offline), mas a referência é a mais ANTIGA.
    const r = resumoPesoExibido(
      comSemente(64, p('2026-09-11', 64), p('2026-09-09', 66), p('2026-09-10', 65)),
      64,
    );
    expect(r.variacao).toMatchObject({ deISO: '2026-09-09', deKg: 66, ateISO: '2026-09-11' });
    expect(r.serieKg).toEqual([66, 65, 64]);
  });

  it('a reconciliação (servidor vence no dia) não move a referência de lugar', () => {
    const local = comSemente(64, p('2026-09-09', 66), p('2026-09-11', 64));
    const reconciliado = comSemente(64, p('2026-09-09', 66), p('2026-09-11', 63.5));
    expect(resumoPesoExibido(local, 64).variacao).toMatchObject({ deISO: '2026-09-09', deKg: 66 });
    expect(resumoPesoExibido(reconciliado, 63.5).variacao).toMatchObject({ deISO: '2026-09-09', deKg: 66 });
  });

  it('a entrada não é mutada (a série do Painel alimenta a âncora)', () => {
    const serie = comSemente(64, p('2026-09-11', 64), p('2026-09-09', 66));
    const copia = JSON.parse(JSON.stringify(serie));
    resumoPesoExibido(serie, 64);
    expect(serie, 'resumoPesoExibido reordenou a série do Painel').toEqual(copia);
  });
});

describe('🔴 F3 ⑤ — a tela não pode voltar a contar a semente', () => {
  const fonte = painel();

  it('nenhuma tela conta `pesos.length` como registros', () => {
    expect(/\{pesos\.length\} registro/.test(fonte), 'voltou a contar a série com semente').toBe(false);
    expect(fonte).toContain('{resumo.registros} registro');
    expect(fonte).toContain('{resumoPeso.registros} registro');
  });

  it('`pesosKg` (série com semente) não alimenta mais Progresso nem Histórico', () => {
    expect(/pesos=\{pesosKg\}/.test(fonte), 'um call site voltou a receber a série com semente').toBe(false);
    expect(fonte).toContain('resumo={resumoPeso}');
    expect(fonte).toContain('resumoPeso={resumoPeso}');
  });

  it('a variação não é mais calculada a partir de `pesos[0]`', () => {
    expect(/atual\s*-\s*pesos\[0\]/.test(fonte), 'a subtração pela semente voltou').toBe(false);
    expect(fonte).toContain('rotuloVariacao(resumo.variacao)');
  });

  it('a SEMENTE continua existindo para a âncora — o guard não é vacuidade', () => {
    expect(fonte).toContain('const semente: RegistroPeso = { dataISO: null, kg: perfil.pesoKg };');
    expect(fonte).toContain('resolverPesoDoPlanoLocal({ perfil, pesos, hojeISO: hojeISO() })');
  });

  it('âncora, dieta/cardio e a regra de uma pesagem por dia seguem intactas', () => {
    // A âncora do motor lê a série COM semente (e ignora registro sem data na janela de 7
    // dias); o cardio lê `perfil.pesoKg`; a trava do dia é do banco + `registrarPesoLocal`.
    expect(fonte).toContain('reancorarPesoDoPlanoLocal');
    expect(fonte).toContain('pesoKg={perfil.pesoKg}');
    expect(fonte).toContain("local.tipo === 'RECUSADO_DIA'");
  });
});
