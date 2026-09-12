import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 🔴 /cadastro — A TELA EXPLICA A SENHA ANTES DE O SERVIDOR RECUSAR (defeito do beta,
 * 11/09/2026 18:07:36 BRT).
 *
 * O que aconteceu: a pessoa criou uma senha, a tela disse **"Razoável"**, ela mandou, e voltou
 * *"Não foi possível criar a conta. Confira os dados e tente de novo."* — sem dizer o que
 * conferir. O Supabase tinha respondido `POST /signup` → **422 `weak_password`**: faltava um
 * número. Nenhuma conta foi criada; a allowlist não tinha nada a ver com isso.
 *
 * 🔑 As quatro travas que este guard segura, porque são quatro erros DIFERENTES e cada um
 * sozinho já reabre o defeito:
 *   1. o gate do botão é a POLÍTICA, não o tamanho;
 *   2. os requisitos ficam VISÍVEIS junto ao campo, ligados a ele por `aria-describedby`;
 *   3. a estimativa de força não aparece enquanto faltar requisito (ela sugeria aceitação);
 *   4. a recusa é lida por CÓDIGO do SDK, e os campos digitados sobrevivem a ela.
 *
 * Estático, como o resto da casa (`consentimento-a11y`, `honestidade-tela`): o vitest roda em
 * `environment: 'node'`, sem DOM. O que se trava aqui é o DRIFT.
 */

const ARQ = join(process.cwd(), 'src', 'app', 'cadastro', 'page.tsx');
const fonte = readFileSync(ARQ, 'utf8');
/** Sem comentários: este arquivo CITA o defeito (`senha.length >= 8`, "Razoável") ao explicá-lo. */
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/** Corpo de uma função nomeada, por contagem de chaves (mesmo extrator do `honestidade-tela`). */
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

describe('anti-vacuidade — o guard lê a tela de verdade', () => {
  it('achou o arquivo, o handler e o JSX', () => {
    expect(codigo.length).toBeGreaterThan(3000);
    expect(corpoDe('submit').length, 'o handler submit sumiu ou mudou de nome').toBeGreaterThan(400);
    expect(codigo).toMatch(/auth\.signUp\(/);
  });
});

describe('🔑 1. o gate do botão é a política do servidor, não o tamanho', () => {
  it('usa `senhaCumprePolitica`, importado do módulo da política', () => {
    expect(codigo).toMatch(/import \{[^}]*senhaCumprePolitica[^}]*\} from '@\/lib\/auth\/politica-senha'/);
    expect(codigo).toMatch(/const valido =[^;]*senhaOk/);
  });

  it('🔴 `senha.length >= 8` não é mais critério de nada', () => {
    // Era literalmente esta comparação que aprovava a senha que o servidor recusou.
    expect(/senha\.length\s*>=\s*8/.test(codigo), 'o gate por tamanho voltou').toBe(false);
  });

  it('o gate e a explicação saem do MESMO módulo (não há segunda lista redigitada)', () => {
    expect(codigo).toMatch(/requisitosFaltantes\(senha\)/);
    expect(codigo).toMatch(/fraseDosFaltantes\(faltamNaSenha\)/);
  });
});

describe('🔑 2. os requisitos ficam visíveis junto ao campo', () => {
  it('renderiza `RequisitosSenha` com a senha atual', () => {
    expect(codigo).toMatch(/<RequisitosSenha senha=\{senha\} id=\{ID_REQUISITOS\} \/>/);
  });

  it('o campo de senha aponta para a lista por `aria-describedby`', () => {
    const inputSenha = codigo.match(/<input[^>]*autoComplete="new-password"[^>]*>/)?.[0] ?? '';
    expect(inputSenha, 'campo de senha não encontrado').not.toBe('');
    expect(inputSenha, 'sem aria-describedby o leitor de tela não lê os requisitos ao focar').toMatch(/aria-describedby=\{ID_REQUISITOS\}/);
  });

  it('🔒 o placeholder não anuncia uma política pela metade', () => {
    // "Mínimo 8 caracteres" era verdade parcial: dizia o tamanho e calava minúscula,
    // maiúscula e número. Meia política escrita no lugar mais visível é o que enganou.
    expect(/Mínimo 8 caracteres/.test(codigo), 'o placeholder voltou a anunciar só o tamanho').toBe(false);
  });
});

describe('🔑 3. a força estimada não pode sugerir aceitação', () => {
  it('o medidor só renderiza quando a senha cumpre a política', () => {
    expect(codigo).toMatch(/\{senhaOk && \(/);
    const i = codigo.indexOf('{senhaOk && (');
    const bloco = codigo.slice(i, codigo.indexOf(')}', i));
    expect(bloco, 'o medidor saiu de dentro da guarda').toMatch(/f\.rotulo/);
  });

  it('quando aparece, vem rotulado como ESTIMATIVA — não como aprovação', () => {
    expect(codigo).toMatch(/Força estimada/);
  });

  it('🔴 não existe render do medidor preso só a "tem senha digitada"', () => {
    expect(/\{senha\.length > 0 && \([\s\S]{0,200}f\.rotulo/.test(codigo), 'o medidor voltou a aparecer antes de os requisitos serem cumpridos').toBe(false);
  });
});

describe('🔑 4. a recusa do servidor é lida por código, e nada se perde', () => {
  it('traduz por `traduzirErroCadastro` (códigos e motivos do SDK)', () => {
    const c = corpoDe('submit');
    expect(c).toMatch(/traduzirErroCadastro\(error, senha\)/);
    expect(c, 'o catch precisa traduzir também').toMatch(/catch \(e\)[\s\S]*traduzirErroCadastro\(e, senha\)/);
  });

  it('🔴 nenhuma regex sobre `error.message` decide mais nada', () => {
    expect(/error\.message/.test(codigo), 'voltou a classificar a falha pelo texto do servidor').toBe(false);
    expect(/already\|registered\|exist/.test(codigo), 'a regex antiga voltou').toBe(false);
  });

  it('🔒 nome, e-mail e senha sobrevivem à recusa', () => {
    const c = corpoDe('submit');
    for (const limpeza of ["setSenha('')", "setEmail('')", "setNome('')", 'setSenha("")']) {
      expect(c.includes(limpeza), `${limpeza} apaga o que a pessoa digitou depois de uma recusa`).toBe(false);
    }
  });

  it('o erro chega à tela como alerta (o leitor de tela anuncia sem precisar de foco)', () => {
    expect(codigo).toMatch(/\{erro && <p role="alert"/);
  });

  it('🔒 nada de mensagem crua, senha ou dado sensível em log/telemetria', () => {
    expect(/console\.(log|error|warn|info)/.test(codigo), 'log na tela de cadastro vaza dado de conta').toBe(false);
    expect(/\{erro\.message\}|\$\{error\.message\}|\+ error\.message/.test(codigo)).toBe(false);
    expect(/track\(|analytics|captureException/.test(codigo), 'telemetria com payload de cadastro').toBe(false);
  });
});

describe('🔒 o botão indisponível diz POR QUE', () => {
  it('o clique não morre no vazio — `pointerEvents: none` saiu', () => {
    expect(/pointerEvents:\s*'none'|pointerEvents: valido/.test(codigo), 'o botão voltou a engolir o clique em silêncio').toBe(false);
  });

  it('há um texto de pendências, ligado ao botão por `aria-describedby`', () => {
    expect(codigo).toMatch(/\{mostrarPendencias && \(/);
    expect(codigo).toMatch(/aria-describedby=\{mostrarPendencias \? ID_PENDENCIAS : undefined\}/);
    expect(codigo).toMatch(/aria-disabled=\{!valido \|\| carregando\}/);
  });

  it('tentar enviar com pendência leva o foco ao primeiro campo que falta', () => {
    const c = corpoDe('submit');
    expect(c).toMatch(/if \(!valido\)/);
    expect(c).toMatch(/foco\?\.focus\(\)/);
    expect(c, 'sem marcar a tentativa, quem não tocou em nada não vê o motivo').toMatch(/setTentouEnviar\(true\)/);
  });
});

describe('🔒 o que NÃO podia mudar continua de pé', () => {
  it('o fluxo de sucesso é o mesmo (sessão → onboarding, senão → confirmar)', () => {
    expect(corpoDe('submit')).toMatch(/router\.replace\(data\.session \? '\/onboarding' : '\/confirmar'\)/);
  });

  it('o modo sem backend continua seguindo para /confirmar', () => {
    expect(corpoDe('submit')).toMatch(/if \(!supabaseConfigurado\(\)\) \{ router\.push\('\/confirmar'\); return; \}/);
  });

  it('os três aceites e os links legais seguem exigidos', () => {
    expect(codigo).toMatch(/t\.every\(Boolean\)/);
    expect(codigo).toMatch(/<LinkLegal href="\/termos">/);
    expect(codigo).toMatch(/<LinkLegal href="\/privacidade">/);
    expect(codigo).toMatch(/<LinkLegal href="\/aviso">/);
  });

  it('🔒 nenhuma exigência inventada de símbolo entrou na copy', () => {
    expect(/s[íi]mbolo|caractere especial/i.test(fonte), 'o servidor não exige símbolo — anunciar um é mentir').toBe(false);
  });
});
