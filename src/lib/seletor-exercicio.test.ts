/**
 * 🔎 O SELETOR COMPARTILHADO — DF③ do handoff-editor-guiado-2026-08-13: **uma peça, duas
 * portas** (o editor e o TROCAR). Guards estáticos, no padrão da casa: o que se prova aqui
 * é que a porta EXISTE e não está atrás de condição morta — a lição de 2026-08-08, em que
 * o controle existia no componente e a superfície sumia em silêncio.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const fonte = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

describe('🔎 o seletor tem DUAS portas (DF③)', () => {
  const painel = fonte('src/components/painel/Painel.tsx');

  it('porta 1 — o TROCAR oferece "ver a biblioteca completa"', () => {
    expect(painel, 'o botão da biblioteca sumiu do modal').toMatch(/Ver a biblioteca completa/i);
    expect(painel, 'o modal não recebe o callback da biblioteca').toMatch(/onBiblioteca=\{/);
  });

  it('o botão da biblioteca fica ABAIXO das sugestões — o caminho curto continua o default', () => {
    const iSugestoes = painel.indexOf('gerar mais variedade');
    const iBiblioteca = painel.indexOf('Ver a biblioteca completa');
    expect(iSugestoes).toBeGreaterThan(-1);
    expect(iBiblioteca, 'a biblioteca passou à frente das 3 sugestões').toBeGreaterThan(iSugestoes);
  });

  it('porta 2 — o seletor é montado no Painel e não está atrás de condição morta', () => {
    const i = painel.indexOf('<SeletorExercicio');
    expect(i, 'o seletor não é montado').toBeGreaterThan(-1);
    // A condição de render é o estado `biblioteca` (aberto/fechado), que é o propósito —
    // e não uma flag/feature-gate que apagaria a superfície em silêncio.
    const antes = painel.slice(Math.max(0, i - 160), i);
    expect(antes, 'o seletor não é aberto pelo estado da biblioteca').toMatch(/biblioteca &&/);
    expect(/flag|habilitad|beta &&/i.test(antes), 'o seletor ficou atrás de flag').toBe(false);
  });

  /**
   * 🔒 A ESCOLHA PASSA PELOS TRILHOS. A biblioteca inteira é uma lista maior, NUNCA um
   * atalho para furar preservação/equipamento/nível: a aplicação continua em `aplicarEx`,
   * que consulta `avaliarTroca` e recusa com explicação.
   */
  it('escolher da biblioteca aplica por `aplicarEx` — nunca escreve o slot direto', () => {
    const i = painel.indexOf('<SeletorExercicio');
    const bloco = painel.slice(i, i + 1200);
    // ⚠️ Regex sobre a LINHA do `onEscolher`, não `[^}]*`: o corpo do handler tem `}` de
    // desestruturação, e a âncora por forma falhava sem que nada estivesse errado.
    const linhaEscolher = bloco.split('\n').find((l) => l.includes('onEscolher=')) ?? '';
    expect(linhaEscolher, 'a escolha não passa pelo caminho que consulta os trilhos').toMatch(/aplicarEx\(/);
    expect(/setRotinaDias\(/.test(bloco), 'o seletor escreve a rotina direto, furando os trilhos').toBe(false);
  });
});

describe('🔎 o que o seletor mostra (e o que ele NÃO esconde)', () => {
  const sel = fonte('src/components/painel/SeletorExercicio.tsx');

  it('banidos aparecem MARCADOS, não escondidos, com "trazer de volta"', () => {
    expect(sel, 'o banido deixou de ser marcado').toMatch(/Fora do meu plano/);
    expect(sel, 'sumiu a saída de desfazer o banimento').toMatch(/Trazer de volta/);
    // 🔑 O par discriminante do "esconder": não existe filtro que remova banido da lista.
    expect(/\.filter\([^)]*banidos\.has/.test(sel), 'o seletor voltou a ESCONDER banidos').toBe(false);
  });

  it('favoritos vêm primeiro (DF #12) e o equipamento do usuário é o default', () => {
    expect(sel).toMatch(/favoritos\.has\(a\.id\)/);
    expect(sel).toMatch(/useState\(true\)/); // soMeuEquipamento ligado por default
    expect(sel, 'a saída para a biblioteca inteira sumiu').toMatch(/Biblioteca inteira/);
  });

  it('cada item mostra primário + secundários (o dado que o v4 normalizou)', () => {
    expect(sel).toMatch(/secundariosDe\(/);
    expect(sel).toMatch(/também /);
  });

  it('o seletor NÃO decide série/rep/RIR (DF② — isso é do motor)', () => {
    expect(/series|reps|rirAlvo/i.test(sel), 'o seletor passou a mexer em prescrição').toBe(false);
  });

  it('o nível continua filtro DURO — a biblioteca inteira não libera acima do liberado', () => {
    expect(sel).toMatch(/dificuldadesLiberadas\(/);
    const i = sel.indexOf('soMeuEquipamento ?');
    const filtroNivel = sel.indexOf('liberadas.has');
    expect(filtroNivel, 'o filtro de nível sumiu').toBeGreaterThan(-1);
    // o toggle só afeta equipamento — o nível não tem toggle.
    expect(sel.slice(Math.max(0, i - 200), i)).not.toMatch(/soMeuEquipamento \? liberadas/);
  });
});
