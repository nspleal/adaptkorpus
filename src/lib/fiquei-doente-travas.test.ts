import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard-rail ESTÁTICO do "Fiquei doente" (Leva 2 · Bloco 4, DF 2026-07-27) — molde do
 * `rls-migrations.test.ts` (leitura do fonte + regex; o vitest roda em `environment: 'node'`,
 * sem jsdom). Trava as regras invioláveis do handoff que um refactor bem-intencionado
 * apagaria sem quebrar nada visível:
 *
 *  1. o MOTOR nunca lê `reconhecidoEm` (o critério de aceite pede este teste explicitamente);
 *  2. a folha não tem campo nenhum (o app NÃO pergunta o motivo — dado de saúde é sensível);
 *  3. `#E5484D` (Alerta) não aparece na peça — ausência não é culpa;
 *  4. nenhum contador de dias parados;
 *  5. o ícone é o glifo de PAUSA (nunca termômetro/cruz/coração/alerta/escudo);
 *  6. nada de "melhoras"/"cuide-se"/conselho clínico;
 *  7. a copy diz o PESO em cada série (nunca "o esforço" — com o RIR-alvo em 3 o esforço CAI).
 */

const RAIZ = process.cwd();
const PECA = readFileSync(join(RAIZ, 'src', 'components', 'painel', 'FiqueiDoente.tsx'), 'utf8');
/** Só o corpo da folha (`role="dialog"` até o fim do componente da entrada). */
const FOLHA = PECA.slice(PECA.indexOf('role="dialog"'), PECA.indexOf('export function AvisoPausaReconhecida'));
/**
 * O CÓDIGO sem comentários. As travas de tom valem para o que chega ao usuário — e os
 * próprios comentários da peça citam as palavras proibidas para explicar por que estão
 * proibidas. Sem esta separação, documentar a regra quebraria a regra.
 */
const CODIGO = PECA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function arquivosTs(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosTs(caminho);
    return nome.endsWith('.ts') || nome.endsWith('.tsx') ? [caminho] : [];
  });
}

describe('🔴 o motor NUNCA lê `reconhecidoEm`', () => {
  it('nenhum arquivo de src/lib/engine sequer menciona o campo', () => {
    const engine = arquivosTs(join(RAIZ, 'src', 'lib', 'engine'));
    expect(engine.length).toBeGreaterThan(10); // sanidade: o diretório foi mesmo varrido
    const culpados = engine.filter((f) => readFileSync(f, 'utf8').includes('reconhecidoEm'));
    expect(culpados, 'o reconhecimento é um ato social, não uma entrada do motor').toEqual([]);
  });

  it('o carimbo entra só na camada de UI/persistência', () => {
    // Se um dia o motor precisar do dado, este teste é a conversa — não o commit silencioso.
    expect(readFileSync(join(RAIZ, 'src', 'lib', 'pausa-reconhecida.ts'), 'utf8')).toContain('reconhecidoEm');
  });
});

describe('🔴 a folha não pergunta nada', () => {
  it('nenhum input/textarea/select dentro da folha', () => {
    expect(FOLHA).not.toMatch(/<(input|textarea|select)\b/);
  });

  it('nem no resto da peça', () => {
    expect(PECA).not.toMatch(/<(input|textarea|select)\b/);
  });

  it('não fala em motivo, sintoma nem data de volta', () => {
    expect(PECA).not.toMatch(/sintoma|qual o motivo|data de volta|previs(ão|ao) de volta/i);
  });
});

describe('🔴 tom: sem culpa, sem clínica, sem contador', () => {
  it('`#E5484D` não aparece em pixel nenhum', () => {
    expect(CODIGO.toUpperCase()).not.toContain('E5484D');
  });

  it('nenhum contador de dias parados / treinos perdidos', () => {
    expect(CODIGO).not.toMatch(/dias? (sem treinar|parad|fora)|treinos? perdidos?|voc(ê|e) faltou|sumiu/i);
  });

  it('nada de "melhoras", "cuide-se" ou encaminhamento clínico', () => {
    expect(CODIGO).not.toMatch(/melhoras|cuide-se|esperamos voc|procure? um m(é|e)dico|gravidade/i);
  });

  it('não promete resultado e não diz "IA"', () => {
    expect(CODIGO).not.toMatch(/\bIA\b|garant(e|ido)|resultado garantido/);
  });
});

describe('a peça mantém a forma que o handoff especificou', () => {
  it('o ícone é o glifo de pausa — nunca termômetro, cruz, coração, alerta ou escudo', () => {
    expect(CODIGO).toContain('IconePausa');
    // o escudo é da RETOMADA; este `d` é o path do escudo no cartão da rampa.
    expect(CODIGO).not.toContain('M12 3l7.5 4v5');
    expect(CODIGO).not.toMatch(/termometro|term(ô|o)metro|cruz|cora(ç|c)(ã|a)o/i);
  });

  it('a entrada é um <button> real com aria-haspopup/aria-expanded e apoio descrito', () => {
    expect(PECA).toMatch(/aria-haspopup="dialog"/);
    expect(PECA).toMatch(/aria-expanded=\{aberta\}/);
    expect(PECA).toMatch(/aria-describedby=\{apoioId\}/);
    expect(PECA).toContain('ou preciso parar um tempo');
  });

  it('a folha é diálogo de verdade (role/aria-modal/labelledby/describedby)', () => {
    expect(FOLHA).toContain('aria-modal="true"');
    expect(FOLHA).toMatch(/aria-labelledby=\{tituloId\}/);
    expect(FOLHA).toMatch(/aria-describedby=\{corpoId\}/);
  });

  it('o aviso é `aria-live="polite"` e NUNCA role="alert"/status', () => {
    expect(CODIGO).toContain('aria-live="polite"');
    expect(CODIGO).not.toMatch(/role="(alert|status)"/);
  });

  it('🔒 a copy diz o PESO em cada série (a correção que vale para os 3 pacotes)', () => {
    expect(PECA).toContain('o peso em cada série continua o mesmo');
    expect(PECA).not.toContain('o esforço em cada série');
  });

  it('a copy da folha é a literal do handoff', () => {
    expect(PECA).toContain('Tudo bem parar.');
    expect(PECA).toContain('o motivo não importa aqui, e o app não pergunta');
    expect(PECA).toContain('Ele conta semanas treinadas, não dias no calendário');
    expect(PECA).toContain('A sua Chama não zera');
    expect(PECA).toContain('Pausa reconhecida — o seu plano espera.');
  });
});

describe('precedência ligada na aba Treino (o Painel não empilha mensagens)', () => {
  const PAINEL = readFileSync(join(RAIZ, 'src', 'components', 'painel', 'Painel.tsx'), 'utf8');

  it('o aviso passa pela regra de precedência, não pelo campo cru', () => {
    expect(PAINEL).toMatch(/avisoPausaVisivel\(\{[^}]*rampaAtiva: retomada != null/s);
    expect(PAINEL).toContain('{avisoPausa && <AvisoPausaReconhecida />}');
  });

  it('"Entendi" não toca ciclo, volume, chama nem agenda — só o carimbo', () => {
    const corpo = PAINEL.slice(PAINEL.indexOf('function reconhecerPausa()'), PAINEL.indexOf('function limparReconhecimento()'));
    expect(corpo).toContain('reconhecidoEm: new Date().toISOString()');
    expect(corpo).not.toMatch(/mesociclo|deloadAte|setTreino|setRotinaDias|recomputarPlano|celebrar/);
  });
});
