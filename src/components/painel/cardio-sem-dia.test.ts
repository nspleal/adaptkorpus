/**
 * 🔒 C3 — SEM MINUTOS PRESCRITOS, a tela DESCREVE o arranjo (DF do autor, 2026-08-14).
 *
 * 🔴 O defeito que isto fecha é da MESMA CLASSE do de 2026-08-01 ("Faltam 150 minutos para
 * os 150"): sem dia escolhido para a sugestão automática, o plano não prescreve cardio
 * nenhum — e o denominador caía na META, fazendo o cartão dizer "0 de 150 min no seu
 * plano". Copy verdadeira que vira **dívida do app sobre dias que ele não deu**.
 *
 * 🔴 2026-09-24 — a frase antiga ("Seus N dias estão ocupados com treino de força") contava os
 * dias de força e supunha que cardio e força não dividem o dia. O cardio é independente da
 * musculação (DEC-007): o motivo de não haver minutos é não haver dia escolhido.
 *
 * Guard estático (padrão da casa para componentes), ancorado nas TRÊS proibições da DF:
 * sem "Faltam X", sem tom de falha, e o registro continua à mão.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = readFileSync('src/components/painel/Cardio.tsx', 'utf8');
const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const bloco = semComentarios.match(/function SemDiaDeCardio[\s\S]*?\n\}/)?.[0] ?? '';

describe('🔒 C3 — cardio sem dia excedente', () => {
  it('existe um ramo próprio para "não sobrou dia"', () => {
    expect(bloco, 'o componente SemDiaDeCardio sumiu').not.toBe('');
    expect(semComentarios, 'o ramo não está ligado ao cartão').toMatch(/<SemDiaDeCardio/);
  });

  it('a copy DESCREVE o arranjo: nenhum dia escolhido para a sugestão automática, sem culpar a força', () => {
    expect(bloco).toMatch(/Nenhum dia está escolhido para a sugestão automática de cardio/);
    expect(bloco, 'voltou a pôr a musculação como motivo').not.toMatch(/ocupad|treino de força/);
    expect(semComentarios, 'o ramo voltou a depender dos dias de força').not.toMatch(/diasDeForca/);
  });

  /** 🔒 As três proibições da DF, uma asserção cada. */
  it('não conta o que "falta" — sem contagem regressiva', () => {
    expect(bloco, 'voltou a cobrar o que o app não deu').not.toMatch(/Falta[mr]?\b/i);
  });

  it('não tem tom de falha ("ausência não fala")', () => {
    expect(bloco).not.toMatch(/você (não|deveria|precisa)|deixou de|perdeu|pendente|incompleto/i);
  });

  it('mantém o registro à mão (o botão de registrar continua visível)', () => {
    expect(bloco).toMatch(/registre/i);
  });

  /**
   * PAR DISCRIMINANTE: o ramo só vale quando NÃO há minutos prescritos. Se disparasse
   * sempre, esconderia a barra de quem tem dia de cardio de verdade — trocaria um defeito
   * por outro.
   */
  it('o ramo é condicionado a não haver minutos prescritos', () => {
    expect(semComentarios).toMatch(/!prescritoMin \|\| prescritoMin <= 0/);
    expect(semComentarios, 'a barra normal tem de continuar existindo').toMatch(/<BarraMinutos/);
  });
});
