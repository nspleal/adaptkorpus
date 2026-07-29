import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * HONESTIDADE DE TELA — guard estático de `/conta` (DF 2026-07-29).
 *
 * O defeito que isto fecha: a tela tinha três controles que **confirmavam sucesso sem
 * nenhuma chamada**. "Confirmar cancelamento" fazia `setSub('cancelled')`, a tela dizia
 * "Cancelada", e um F5 devolvia "trial". O form de cartão não enviava nada. E "Salvar" no
 * modal de nome fazia só `setNome(v)` — nome novo na tela, nome antigo no banco.
 *
 * 🔒 A REGRA, em uma linha: **um controle que produz efeito visível ou irreversível tem de
 * `await` uma chamada que possa falhar, e tem de ter um caminho de falha que apareça na
 * tela.** Sem o `await` a confirmação é teatro; sem o caminho de falha visível o erro é
 * engolido — e engolir o erro é a mesma mentira, só mais silenciosa.
 *
 * Estático (padrão da casa, como `rls-migrations.test.ts` e `modo-diario.test.ts`): não há
 * DOM aqui. O que se trava é o DRIFT — que alguém reintroduza um botão de estado enquanto
 * não houver cobrança de verdade.
 */

const ARQ = join(process.cwd(), 'src', 'app', 'conta', 'page.tsx');
const fonte = readFileSync(ARQ, 'utf8');

/**
 * Fonte sem comentários. Obrigatório: este arquivo é DENSO em comentários que citam
 * literalmente a copy removida ("•••• 4242", `setSub('cancelled')`) para explicar por que
 * ela saiu. Sem a limpeza, o guard dos literais fabricados falharia lendo a própria
 * lápide — e passaria a proibir a documentação em vez do defeito.
 */
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/** Corpo de uma função nomeada, por contagem de chaves (o `{` do cabeçalho até o par dele). */
function corpoDe(nome: string): string {
  const i = codigo.search(new RegExp(`(async\\s+)?function\\s+${nome}\\s*\\(`));
  if (i < 0) return '';
  const abre = codigo.indexOf('{', i);
  if (abre < 0) return '';
  let n = 0;
  for (let j = abre; j < codigo.length; j += 1) {
    if (codigo[j] === '{') n += 1;
    else if (codigo[j] === '}') { n -= 1; if (n === 0) return codigo.slice(abre, j + 1); }
  }
  return codigo.slice(abre);
}

/**
 * Handlers NOMEADOS ligados a um `onClick` — `onClick={h}` e `onClick={() => void h()}`.
 * Derivado da fonte, não redigitado: um botão novo entra na varredura sozinho. (Foi por
 * lista redigitada que `limparDadosLocais` esqueceu duas chaves e a 9ª só apareceu na
 * auditoria — a lição vale aqui.)
 */
function handlersNomeados(): string[] {
  const achados = new Set<string>();
  for (const m of codigo.matchAll(/onClick=\{\s*(?:\(\)\s*=>\s*(?:void\s+)?)?([A-Za-z_$][\w$]*)\s*(?:\(\s*\))?\s*\}/g)) {
    const nome = m[1]!;
    if (corpoDe(nome) !== '') achados.add(nome);
  }
  return [...achados];
}

/**
 * Efeitos que o usuário LÊ COMO "PRONTO": o dado da tela mudou, um arquivo baixou, o local
 * foi apagado, ou ele foi levado embora da conta. Um handler que faz qualquer um deles está
 * afirmando que algo aconteceu — e é aí que a chamada é obrigatória.
 */
const EFEITOS_DE_SUCESSO = ['setNome(', 'baixarArquivo(', 'limparDadosLocais(', 'limparSessao(', "router.replace('/')"] as const;

/** Sinais de que a chamada pode falhar de verdade (rede/backend), não estado local. */
const CHAMADA_FALIVEL = ['await fetch(', '.auth.updateUser(', '.auth.signOut(', 'await sairDaConta('] as const;

describe('/conta — nenhum controle confirma sucesso sem uma chamada que possa falhar', () => {
  const comEfeito = handlersNomeados().filter((h) => {
    const c = corpoDe(h);
    return EFEITOS_DE_SUCESSO.some((e) => c.includes(e));
  });

  it('a varredura encontra os handlers de efeito (senão ela está passando por vacuidade)', () => {
    // Se um refactor renomear os handlers, este teste cai antes dos de baixo virarem no-op.
    expect(comEfeito.length, `handlers com efeito visível: ${comEfeito.join(', ') || 'NENHUM'}`).toBeGreaterThanOrEqual(3);
    for (const esperado of ['salvarEdicao', 'excluirConta', 'baixarMeusDados']) {
      expect(comEfeito, `handler ${esperado} saiu da varredura`).toContain(esperado);
    }
  });

  it.each(['salvarEdicao', 'excluirConta', 'baixarMeusDados'])('%s: aguarda uma chamada que pode falhar', (nome) => {
    const c = corpoDe(nome);
    expect(c, `${nome} não existe`).not.toBe('');
    expect(
      CHAMADA_FALIVEL.some((k) => c.includes(k)),
      `${nome} produz efeito visível sem await de chamada falível — sucesso simulado`,
    ).toBe(true);
  });

  it.each(['salvarEdicao', 'excluirConta'])('%s: tem caminho de falha (catch + checagem do retorno)', (nome) => {
    const c = corpoDe(nome);
    expect(c.includes('catch'), `${nome} sem catch — falha de rede passaria como sucesso`).toBe(true);
    // `if (error)` p/ o supabase-js, `r.ok` p/ o fetch: sem isso um 500 seguiria adiante.
    expect(/if\s*\(\s*error\s*\)|r\.ok/.test(c), `${nome} não checa o retorno da chamada`).toBe(true);
  });

  /**
   * O par indispensável do caminho de falha: o erro tem de CHEGAR À TELA. Um `catch {}` que
   * só desliga o spinner devolve o usuário ao estado inicial sem dizer nada — ele conclui
   * que salvou. Cada `setErro*` do handler precisa ter um render em JSX.
   */
  it('todo erro capturado é renderizado (nenhum catch silencioso)', () => {
    const setters = new Set<string>();
    for (const nome of ['salvarEdicao', 'excluirConta']) {
      for (const m of corpoDe(nome).matchAll(/set(Erro[A-Za-z]*)\s*\(/g)) setters.add(m[1]!);
    }
    expect(setters.size, 'nenhum estado de erro nos handlers').toBeGreaterThanOrEqual(2);
    for (const s of setters) {
      const estado = s.charAt(0).toLowerCase() + s.slice(1); // ErroNome → erroNome
      const re = new RegExp(`\\{\\s*${estado}\\s*&&`);
      expect(re.test(codigo), `${estado} é setado mas nunca renderizado — falha invisível`).toBe(true);
    }
  });

  /**
   * O botão fica DESABILITADO durante a chamada. Sem isso, dois cliques em "Excluir
   * definitivamente" disparam duas exclusões — e a segunda falha, mostrando erro depois de
   * a conta já ter sido apagada.
   */
  it('os botões de ação desabilitam enquanto a chamada corre', () => {
    for (const flag of ['excluindo', 'salvandoNome']) {
      expect(codigo, `botão sem disabled={${flag}}`).toMatch(new RegExp(`disabled=\\{[^}]*\\b${flag}\\b`));
    }
  });
});

describe('/conta — nada de assinatura fabricada enquanto não houver cobrança', () => {
  /**
   * Literais que só podiam vir de invenção: não havia cartão, não houve fatura, `subscription`
   * tem 0 linhas e nunca era lida. Se um deles voltar, voltou o sucesso simulado.
   */
  const FABRICADO: readonly [RegExp, string][] = [
    [/4242/, 'número de cartão fabricado'],
    [/R\$\s*29/, 'preço na tela de conta (o beta é gratuito; cobrança é decisão aberta)'],
    [/Expira\s*\d/, 'validade de cartão fabricada'],
    [/·\s*Pago|\bPago\b/, 'fatura "Pago" fabricada'],
    [/TRIAL_END|PROX_COBRANCA/, 'data de cobrança em constante hardcoded'],
    [/'(trial|active|cancelled)'/, 'status de assinatura em estado local'],
  ];

  it.each(FABRICADO)('não contém %s (%s)', (re, _porque) => {
    expect(re.test(codigo)).toBe(false);
  });

  it('não há controle de assinatura (cancelar / reativar / atualizar cartão)', () => {
    expect(/Confirmar cancelamento|Reativar assinatura|Atualizar cart/i.test(codigo)).toBe(false);
  });

  /** A verdade que ficou no lugar: sem preço, sem data, sem controle. */
  it('diz que não existe cobrança', () => {
    expect(codigo).toMatch(/Beta gratuito/);
    expect(codigo).toMatch(/Não existe assinatura ativa nem cobrança/);
  });
});

describe('/conta — o e-mail não se edita por autoatendimento', () => {
  /**
   * 🔒 `beta_liberado()` casa por e-mail (`lower(a.email) = lower(auth.email())`, migration
   * 0006). Trocar o e-mail derrubaria o usuário da allowlist EM SILÊNCIO: fim do acervo
   * curado, fim da geração de plano, nenhuma mensagem. Enquanto o gate for por e-mail, isto
   * é operação de suporte.
   */
  it('a linha do e-mail não tem botão de alterar', () => {
    const linha = codigo.match(/<LinhaDado rotulo="E-mail"[^/]*\/>/)?.[0] ?? '';
    expect(linha, 'linha do e-mail não encontrada').not.toBe('');
    expect(linha.includes('botao'), 'e-mail com botão "Alterar" — derrubaria a allowlist em silêncio').toBe(false);
  });

  it('o modal de edição só aceita o campo nome (fechado pelo TIPO)', () => {
    expect(codigo).toMatch(/campo:\s*'nome'\s*;\s*valor:\s*string/);
    // `salvarEdicao` grava em `data: { nome }` — um `campo: 'email'` gravaria o e-mail
    // digitado no campo NOME, sem erro nenhum.
    expect(/campo:\s*'nome'\s*\|\s*'email'/.test(codigo), "o tipo voltou a aceitar 'email'").toBe(false);
  });

  it('o motivo está escrito no código (senão alguém "conserta" de volta)', () => {
    expect(fonte).toMatch(/beta_liberado\(\)/);
    expect(fonte).toMatch(/allowlist/i);
  });
});
