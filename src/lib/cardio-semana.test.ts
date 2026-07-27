import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  diaDaSemanaPt, formatarAcumulado, minutosAcumulados, registrosCardio, registrosDaSemana,
  rotuloSemana, semanaDe, type SessaoComCardio,
} from './cardio-semana';
import { gerarDieta } from './engine';
import type { PerfilUsuario } from './engine';

const cardio = (dataISO: string, minutos: number, met = 4.3, hora?: string): SessaoComCardio => ({
  dataISO, tipo: 'cardio', ...(hora ? { hora } : {}),
  cardio: { modalidade: 'caminhada', intensidade: 'moderado', minutos, met, kcal: 100 },
});
const treino = (dataISO: string): SessaoComCardio => ({ dataISO });

describe('a semana começa na SEGUNDA', () => {
  it('quarta-feira 2026-07-29 → 27/07 a 02/08', () => {
    expect(semanaDe('2026-07-29')).toEqual({ inicioISO: '2026-07-27', fimISO: '2026-08-02' });
    expect(rotuloSemana('2026-07-29')).toBe('27/07 a 02/08');
  });

  it('a própria segunda abre a semana; o domingo a fecha', () => {
    expect(semanaDe('2026-07-27').inicioISO).toBe('2026-07-27');
    expect(semanaDe('2026-08-02')).toEqual({ inicioISO: '2026-07-27', fimISO: '2026-08-02' });
    // 03/08 é segunda: já é a semana seguinte.
    expect(semanaDe('2026-08-03').inicioISO).toBe('2026-08-03');
  });

  it('a virada zera o progresso — o registro de sábado não vaza para a semana nova', () => {
    const hist = [cardio('2026-08-01', 40)];
    expect(registrosDaSemana(hist, '2026-08-02')).toHaveLength(1);
    expect(registrosDaSemana(hist, '2026-08-03')).toHaveLength(0);
  });
});

describe('leitura do histórico', () => {
  it('só entradas tipo cardio entram; treino resistido e eventos ficam de fora', () => {
    const hist = [cardio('2026-07-29', 30), treino('2026-07-28'), { dataISO: '2026-07-27', tipo: 'calibracao' }];
    expect(registrosCardio(hist)).toHaveLength(1);
  });

  it('ordena do mais novo para o mais antigo (empate: pela hora)', () => {
    const hist = [cardio('2026-07-27', 10, 4.3, '07:00'), cardio('2026-07-29', 20), cardio('2026-07-27', 15, 4.3, '19:00')];
    expect(registrosCardio(hist).map((r) => r.minutos)).toEqual([20, 15, 10]);
  });

  it('o total acumulado só cresce e inclui o movimento leve (é tempo de movimento)', () => {
    const hist = [cardio('2026-07-29', 30), cardio('2026-06-01', 25, 2.3), treino('2026-07-28')];
    expect(minutosAcumulados(hist)).toBe(55);
  });

  it('formata o acumulado como a tela escreve', () => {
    expect(formatarAcumulado(45)).toBe('45 min');
    expect(formatarAcumulado(60)).toBe('1 h');
    expect(formatarAcumulado(840)).toBe('14 h');
  });

  it('dia da semana por extenso (a lista mostra "Moderado · sábado")', () => {
    expect(diaDaSemanaPt('2026-08-01')).toBe('sábado');
    expect(diaDaSemanaPt('2026-07-27')).toBe('segunda');
  });
});

/**
 * 🟢 Critério de aceite explícito do handoff: "teste que FALHA se a kcal entrar no alvo da
 * dieta". A kcal gasta é informação, não orçamento — alvo de 2000 continua 2000. É esta
 * condição que sustenta a trava do "fitness honesto" (sem mentalidade de compensação).
 */
const CARDIO_TSX_SEM_COMENTARIOS = readFileSync(join(process.cwd(), 'src', 'components', 'painel', 'Cardio.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('🟢 a kcal do cardio NUNCA volta para a dieta', () => {
  const perfil: PerfilUsuario = {
    sexo: 'masculino', idade: 30, alturaCm: 180, pesoKg: 80,
    objetivo: 'emagrecimento', nivelAtividade: 'moderado',
    flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  };

  it('o pipeline de dieta não tem sequer por onde receber cardio', () => {
    const antes = gerarDieta(perfil).plano!.kcalAlvo;
    // Rodar de novo com o MESMO perfil devolve o mesmo alvo — o histórico (onde o cardio
    // vive) não é entrada do motor de dieta. Determinismo: mesma entrada → mesma saída.
    expect(gerarDieta(perfil).plano!.kcalAlvo).toBe(antes);
  });

  it('nenhum módulo do motor de DIETA importa ou menciona cardio', () => {
    const raiz = join(process.cwd(), 'src', 'lib', 'engine');
    for (const f of ['diet.ts', 'assembler.ts', 'formulas.ts']) {
      const fonte = readFileSync(join(raiz, f), 'utf8');
      expect(fonte, `${f} não pode conhecer cardio — a kcal gasta não é orçamento`).not.toMatch(/cardio/i);
      expect(fonte).not.toMatch(/kcalLiquida|kcalGasta|saldo/);
    }
  });

  it('a tela de cardio não fala em liberar, saldo ou comer mais', () => {
    // Só o CÓDIGO: os comentários da peça citam as palavras proibidas justamente para
    // registrar que estão proibidas (mesma separação do guard do "Fiquei doente").
    expect(CARDIO_TSX_SEM_COMENTARIOS).not.toMatch(/liberou|liberad|saldo do dia|pode comer|crédito na dieta/i);
    expect(CARDIO_TSX_SEM_COMENTARIOS).toContain('não mudam o seu cardápio');
  });

  it('🔴 o MET nunca aparece na interface (constante interna)', () => {
    const semComentarios = CARDIO_TSX_SEM_COMENTARIOS;
    // Nenhum JSX renderiza `met` como texto (nem `{met}`, nem `{r.met}`, nem "MET").
    expect(semComentarios).not.toMatch(/>\s*\{[^}]*\bmet\b[^}]*\}/);
    expect(semComentarios).not.toMatch(/\bMET\b/);
  });
});
