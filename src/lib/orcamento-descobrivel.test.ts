/**
 * 🔴 GUARD DE DESCOBRIBILIDADE do orçamento (mini-leva de 2026-08-06).
 *
 * 🔑 POR QUE ESTE ARQUIVO EXISTE. A leva H entregou o controle e o aceite 9 disse "tela →
 * motor, provado no browser" — e era verdade: o smoke clicou de verdade até o controle. Só
 * que ele navegou até a porta que eu mesma acabara de construir, e por isso **não podia
 * falhar em achá-la**. O autor foi procurar nas duas superfícies onde a spec mandava — a aba
 * Dieta e o resumo do Perfil — e não havia nada nas duas.
 *
 * A regra que nasceu disso: "funciona" tem degraus — função provada → função ligada → porta
 * alcançável → porta ENCONTRÁVEL. Quem escreveu o caminho só mede os três primeiros. Um teste
 * de descobribilidade parte das superfícies que a SPEC nomeia e falha quando o controle não
 * está nelas.
 *
 * 🔒 O guard prova RENDERIZAÇÃO (o call site existe e NÃO está atrás de condicional), nunca
 * presença de símbolo: `{cond && <Orcamento/>}` mantém o símbolo no arquivo e apaga a
 * superfície — foi exatamente assim que o controle sumiu do onboarding.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const fonte = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

/** As superfícies que a spec nomeia, e o componente que cada uma precisa renderizar. */
const SUPERFICIES: { nome: string; arquivo: string; tag: RegExp }[] = [
  { nome: 'aba Dieta', arquivo: 'src/components/painel/Painel.tsx', tag: /<SeletorOrcamento\b/ },
  { nome: 'Editar perfil', arquivo: 'src/components/painel/EditarPerfil.tsx', tag: /<PreferenciasAlimentares\b[^>]*onOrcamento=/ },
  { nome: 'onboarding', arquivo: 'src/app/onboarding/page.tsx', tag: /<PreferenciasAlimentares\b[^>]*onOrcamento=/ },
];

describe('🔴 o orçamento é ENCONTRÁVEL nas superfícies que a spec nomeia', () => {
  it('todas as superfícies renderizam o controle', () => {
    const faltando = SUPERFICIES.filter((s) => !s.tag.test(fonte(s.arquivo))).map((s) => s.nome);
    expect(faltando, `superfície(s) sem o controle de orçamento: ${faltando.join(', ')}`).toEqual([]);
  });

  /**
   * 🔑 O DEFEITO ORIGINAL, virado guard. O controle existia no componente e o call site do
   * onboarding não passava `onOrcamento`; como o render era `{onOrcamento && <Orcamento/>}`,
   * a superfície sumiu sem erro, sem aviso e sem teste vermelho.
   */
  it('nenhum call site fica atrás de condicional (nem `&&`, nem ternário)', () => {
    const problemas: string[] = [];
    for (const s of SUPERFICIES) {
      const src = fonte(s.arquivo);
      const m = s.tag.exec(src);
      if (!m) continue; // já cobre o teste acima
      // Olha o que vem imediatamente ANTES da tag, na mesma expressão JSX.
      const antes = src.slice(Math.max(0, m.index - 90), m.index);
      if (/&&\s*$/.test(antes)) problemas.push(`${s.nome}: render atrás de \`&&\``);
      if (/\?\s*$/.test(antes)) problemas.push(`${s.nome}: render atrás de ternário`);
    }
    expect(problemas, problemas.join('\n')).toEqual([]);
  });

  it('o componente do seletor não se auto-apaga por prop ausente', () => {
    const src = fonte('src/components/perfil/DiasEPreferencias.tsx');
    const i = src.indexOf('<Orcamento ');
    expect(i, 'o seletor não é montado em PreferenciasAlimentares').toBeGreaterThan(-1);
    const antes = src.slice(Math.max(0, i - 60), i);
    expect(/&&\s*$/.test(antes), 'o seletor voltou a sumir quando a prop não é passada').toBe(false);
  });
});

/**
 * 🔴 DUAS PORTAS, UM ESTADO. Exibições divergentes entre as portas seriam "duas verdades para
 * o mesmo número" — a classe que o cofre já nomeou no piso de proteína.
 */
describe('🔒 as portas do orçamento escrevem e leem o MESMO estado', () => {
  it('todas leem `perfil.orcamento` — nenhuma tem estado próprio de verdade', () => {
    const painel = fonte('src/components/painel/Painel.tsx');
    expect(painel, 'a aba Dieta não lê o valor vigente do perfil').toMatch(/orcamento=\{perfil\.orcamento \?\? null\}/);
    const editar = fonte('src/components/painel/EditarPerfil.tsx');
    expect(editar, 'Editar perfil não semeia o estado a partir do perfil').toMatch(/useState<[^>]*>\(inicial\.orcamento \?\? null\)/);
    expect(editar, 'Editar perfil não grava o orçamento ao salvar').toMatch(/orcamento,/);
  });

  it('as duas portas gravam pelo mesmo campo do perfil', () => {
    const painel = fonte('src/components/painel/Painel.tsx');
    expect(painel).toMatch(/aplicarRotacao\(\{ \.\.\.perfil, orcamento: v \}\)/);
    // e a mudança pela aba Dieta emite o evento, como a de Editar perfil
    expect(painel).toMatch(/registrarEvento\('orcamento_escolhido'/);
  });

  /** 🔒 Rótulo em fonte única: a mesma escolha não pode ter nomes diferentes em telas diferentes. */
  it('o resumo do Perfil e o seletor usam os MESMOS rótulos', () => {
    const painel = fonte('src/components/painel/Painel.tsx');
    expect(painel, 'o resumo não usa a fonte única de rótulos').toMatch(/ROTULO_ORCAMENTO\[/);
    const dias = fonte('src/components/perfil/DiasEPreferencias.tsx');
    expect(dias, 'o seletor deixou de usar a fonte única').toMatch(/t: ROTULO_ORCAMENTO\./);
    // e nenhum dos dois redigita um rótulo à mão
    for (const [nome, src] of [['Painel', painel], ['DiasEPreferencias', dias]] as const) {
      const literais = (src.match(/'(Mais em conta|Intermediário|Sem limite|Sem preferência)'/g) ?? []).length;
      const permitido = nome === 'DiasEPreferencias' ? 4 : 0; // só a definição da constante
      expect(literais, `${nome}: ${literais} rótulo(s) redigitado(s) fora da fonte única`).toBeLessThanOrEqual(permitido);
    }
  });
});

/**
 * 🔴 O RÓTULO NÃO VAZA PARA A TELEMETRIA (DF 2026-08-10).
 *
 * O payload de `orcamento_escolhido` guarda o VALOR INTERNO ('baixo'|'medio'|'alto'|'nenhum'),
 * nunca o texto do botão. Se o rótulo vazasse, um rename de copy — como o de "Tanto faz" para
 * "Sem limite" — partiria a série histórica em duas sem ninguém perceber, e ainda exigiria
 * migration para um ajuste que é só de tela. Este guard é o que torna renomear rótulo uma
 * mudança barata e reversível.
 */
describe('🔒 o rótulo não vaza para o payload do evento', () => {
  const painel = fonte('src/components/painel/Painel.tsx');

  it('os call sites do evento passam o valor interno, não o rótulo', () => {
    const chamadas = [...painel.matchAll(/registrarEvento\('orcamento_escolhido',([^)]*)\)/g)].map((m) => m[1]!);
    expect(chamadas.length, 'nenhum call site do evento encontrado').toBeGreaterThan(0);
    for (const args of chamadas) {
      expect(args, `payload sem o valor interno: ${args}`).toMatch(/orcamento|\bv\b/);
      expect(args, `o RÓTULO vazou para o payload: ${args}`).not.toMatch(/ROTULO_ORCAMENTO/);
      for (const rotulo of ['Mais em conta', 'Intermediário', 'Sem limite', 'Sem preferência'])
        expect(args.includes(rotulo), `rótulo "${rotulo}" literal no payload`).toBe(false);
    }
  });

  it('o vocabulário do payload é fechado e independe da copy', () => {
    // 'nenhum' distingue "não quis escolher" de `alto` ("considerou e declinou o teto").
    expect(painel).toMatch(/valor: (novo\.orcamento|v) \?\? 'nenhum'/);
  });
});

/**
 * 🔴 O resumo do Perfil exibe o valor VIGENTE, e o vazio é explícito.
 * Linha omitida foi o que fez o controle parecer inexistente: os irmãos (padrão alimentar,
 * alergias) estavam lá, com "nenhuma" escrito, e o orçamento simplesmente não aparecia.
 */
describe('🔴 o resumo do Perfil tem a linha do orçamento, ao lado dos irmãos', () => {
  const painel = fonte('src/components/painel/Painel.tsx');

  it('a linha existe e não é condicional', () => {
    const i = painel.indexOf("linha('Orçamento'");
    expect(i, 'o resumo do Perfil não tem linha de Orçamento').toBeGreaterThan(-1);
    const antes = painel.slice(Math.max(0, i - 80), i);
    expect(/&&\s*\{?\s*$/.test(antes), 'a linha do orçamento é condicional — some sem avisar').toBe(false);
  });

  it('fica junto dos irmãos (padrão alimentar e alergias)', () => {
    const pos = (s: string) => { const i = painel.indexOf(s); expect(i, `ausente: ${s}`).toBeGreaterThan(-1); return i; };
    const padrao = pos("linha('Padrão alimentar'");
    const alergias = pos("linha('Alergias'");
    const orcamento = pos("linha('Orçamento'");
    expect(orcamento).toBeGreaterThan(padrao);
    expect(orcamento - alergias).toBeLessThan(400); // vizinhança imediata, não outro bloco
  });

  it('o vazio é EXPLÍCITO, no padrão de "Alergias: nenhuma"', () => {
    expect(painel).toMatch(/ROTULO_ORCAMENTO\[perfil\.orcamento \?\? 'nenhum'\]/);
    const dias = fonte('src/components/perfil/DiasEPreferencias.tsx');
    expect(dias).toMatch(/nenhum: 'Sem preferência'/);
  });
});
