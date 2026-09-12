import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { aplicarNomeCurado } from './nomes-exercicios';
import { LATERALIDADE, LATERALIDADE_ESCOLHA } from './lateralidade';
import { EXERCISES } from './exercises';

describe('D20 — curadoria sobrevive à regeneração dos dados crus', () => {
  it('monta o módulo real com os três nomes anteriores e recupera o catálogo atual', () => {
    const fonte = readFileSync('src/lib/data/exercises.ts', 'utf8')
      .replace('"nomePt": "Puxada alta na polia (lat pulldown)"', '"nomePt": "Puxada alta (pulldown)"')
      .replace('"nomePt": "Pullover na polia (pulldown de braços estendidos)"', '"nomePt": "Pullover na polia"')
      .replace('"nomeEn": "Cable Pullover (Straight-Arm Pulldown)"', '"nomeEn": "Cable Pullover"');
    expect(fonte).toContain('"nomePt": "Puxada alta (pulldown)"');
    expect(fonte).toContain('"nomePt": "Pullover na polia"');
    const js = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: { EXERCISES?: typeof EXERCISES } = {};
    // Apenas código do repositório e dependências locais explícitas; sem arquivo externo.
    const carregar = (nome: string) => {
      if (nome === './lateralidade') return { LATERALIDADE, LATERALIDADE_ESCOLHA };
      if (nome === './nomes-exercicios') return { aplicarNomeCurado };
      throw new Error(`Dependência inesperada: ${nome}`);
    };
    new Function('require', 'exports', js)(carregar, exports);
    expect(exports.EXERCISES).toEqual(EXERCISES);
    expect(exports.EXERCISES?.find(e => e.id === 'e126')?.nomePt).toContain('braços estendidos');
  });

  it('não modifica a fonte nem propriedades que não são nomes', () => {
    const original = Object.freeze({ id: 'e49', nomePt: 'anterior', nomeEn: 'anterior', series: 7 });
    expect(aplicarNomeCurado(original)).toEqual({ ...original, nomePt: 'Puxada alta na polia (lat pulldown)', nomeEn: 'Lat Pulldown' });
    expect(original.nomePt).toBe('anterior');
  });

  it('preserva outros exercícios e variantes', () => {
    for (const ex of EXERCISES.filter(e => !['e49', 'e126'].includes(e.id))) {
      expect(aplicarNomeCurado(ex)).toBe(ex);
    }
  });
});
