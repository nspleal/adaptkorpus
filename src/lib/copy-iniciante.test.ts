import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prescreverTreino } from './engine/treino';
import { avaliarGateTreino } from './engine/treino-gate';
import type { PerfilTreino } from './engine';
import { diasPadrao, type Weekday } from './semana';

/**
 * 🔴 D15 (auditoria 2026-09-11 sobre `a40f8af`) — A REGRA DE INICIANTE TEM DONO.
 *
 * Medido: a frase *"Seu retorno ajusta o próximo treino. **Iniciante não treina até a falha**
 * — a carga sobe por dupla progressão guiada pelo seu feedback."* era renderizada
 * INCONDICIONALMENTE na aba Treino (verificado na tela com perfil intermediário), enquanto
 * `prescricao.semFalhaIniciante` — o campo que existe exatamente para carregar essa regra —
 * tinha ZERO consumidores em `src/components` + `src/app`. Mesmo padrão de D1, num campo que
 * D1 não varreu.
 *
 * 🔒 O conserto é de COPY e tem dois limites explícitos na decisão:
 *   · preservar a orientação GERAL, que vale para todo mundo (o retorno ajusta o próximo
 *     treino; a carga sobe por dupla progressão guiada pelo feedback);
 *   · NÃO inventar recomendação de falha para os outros níveis. O motor não prescreve treinar
 *     até a falha para ninguém; escrever isso seria trocar um texto errado por outro.
 */

const perfil = (nivelExperiencia: PerfilTreino['nivelExperiencia']): PerfilTreino => ({
  pesoKg: 75, alturaCm: 175, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'saude', nivelExperiencia, equipamento: 'academia',
  diasDisponiveis: 3, treinoDias: diasPadrao(3) as Weekday[], tempoPorSessaoMin: 60,
});

const prescricao = (nivel: PerfilTreino['nivelExperiencia']) => {
  const p = perfil(nivel);
  return prescreverTreino(p, avaliarGateTreino(p));
};

const painel = readFileSync('src/components/painel/Painel.tsx', 'utf8');
const FRASE_INICIANTE = 'Iniciante não treina até a falha';

describe('D15 · o campo da prescrição é a fonte da regra', () => {
  it('`semFalhaIniciante` é verdadeiro só para iniciante (pré-condição da condição na tela)', () => {
    expect(prescricao('iniciante').semFalhaIniciante).toBe(true);
    expect(prescricao('intermediario').semFalhaIniciante).toBe(false);
    expect(prescricao('avancado').semFalhaIniciante).toBe(false);
  });

  it('a tela LÊ o campo — ele deixou de ser saída do motor sem dono', () => {
    expect(painel, 'o campo continua sem consumidor na tela').toContain('prescricao.semFalhaIniciante');
  });
});

describe('D15 · a frase do iniciante só aparece sob a condição', () => {
  it('a frase existe uma vez só, e dentro do ramo condicional', () => {
    const ocorrencias = painel.split(FRASE_INICIANTE).length - 1;
    expect(ocorrencias, 'a frase aparece em mais de um lugar — um deles não está condicionado').toBe(1);
    const i = painel.indexOf(FRASE_INICIANTE);
    const antes = painel.slice(Math.max(0, i - 260), i);
    expect(antes, 'a frase não está sob `prescricao.semFalhaIniciante`').toMatch(/prescricao\.semFalhaIniciante\s*\n?\s*\?/);
  });

  it('o ramo dos outros níveis não promete nem proíbe falha — ele simplesmente não fala disso', () => {
    const i = painel.indexOf(FRASE_INICIANTE);
    const ramoElse = painel.slice(i, i + 400);
    const outroTexto = ramoElse.slice(ramoElse.indexOf(': '));
    expect(outroTexto).not.toMatch(/falha/i);
  });
});

describe('D15 · a orientação geral, que vale para todo mundo, foi preservada', () => {
  it('os dois ramos mantêm o retorno que ajusta o treino e a dupla progressão', () => {
    const i = painel.indexOf(FRASE_INICIANTE);
    const bloco = painel.slice(Math.max(0, i - 260), i + 400);
    const ramos = bloco.match(/'[^']*Seu retorno ajusta o próximo treino[^']*'/g) ?? [];
    expect(ramos.length, 'um dos ramos perdeu a orientação geral').toBe(2);
    for (const r of ramos) expect(r).toMatch(/dupla progressão guiada pelo seu feedback/);
  });
});
