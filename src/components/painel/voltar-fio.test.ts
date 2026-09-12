/**
 * 🔴 O FIO do Voltar: a máquina (`historico-app.test.ts`) provada não basta — ela precisa
 * estar LIGADA no painel. Este guard vigia a ligação, que é por onde o defeito volta.
 *
 * Degraus de "funciona" (regra destilada da rodada do motor v4): função provada → LIGADA →
 * porta alcançável. `historico-app.test.ts` cobre o primeiro; este cobre o segundo.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ARQ = 'src/components/painel/Painel.tsx';
const fonte = readFileSync(ARQ, 'utf8');
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('🔴 o Voltar está ligado no painel', () => {
  it('o painel escuta o popstate (sem isto, nada do resto acontece)', () => {
    expect(codigo).toMatch(/useVoltarDoNavegador\(\)/);
  });

  /**
   * 🔑 O BURACO POR ONDE O DEFEITO VOLTA: um `setAba('x')` solto num handler novo troca a aba
   * sem empilhar nada, e aquele caminho volta a expulsar a pessoa do app. A regra é global —
   * `setAba` só pode aparecer como o SETTER do `useState` e dentro do `useAbaVoltavel`.
   */
  it('nenhuma troca de aba escapa do histórico (zero setAba solto)', () => {
    const soltos = codigo.split('\n')
      .map((l, i) => ({ n: i + 1, l }))
      .filter(({ l }) => /\bsetAba\(/.test(l))
      .filter(({ l }) => !/useState<Aba>|const \[aba, setAba\]|useAbaVoltavel/.test(l));
    expect(soltos.map((x) => `${ARQ}:${x.n}: ${x.l.trim()}`), 'troca de aba fora do histórico').toEqual([]);
  });

  /**
   * Toda sobreposição do painel é camada (aceite 2a). A lista é derivada do CRITÉRIO —
   * os estados que controlam algo que se sobrepõe ao painel — e cada um precisa aparecer
   * num `useCamadaVoltavel`. Uma sobreposição nova sem registro derruba este teste.
   */
  it('toda sobreposição do painel está registrada como camada', () => {
    const camadas = ['menu', 'vista', 'editando', 'registrando', 'registrandoCardio',
      'sessaoDia', 'editorDias', 'biblioteca', 'modal', 'detalhe', 'detalheSessao', 'encaminhamento'];
    const registros = [...codigo.matchAll(/useCamadaVoltavel\(([^,]+),/g)].map((m) => m[1]!.trim());
    const faltando = camadas.filter((c) => !registros.some((r) => new RegExp(`\\b${c}\\b`).test(r)));
    expect(faltando, `sobreposição sem Voltar: ${faltando.join(', ')}`).toEqual([]);
    expect(registros).toContain('menu || editando'); // Uma entrada contínua evita fechar o editor ao recolher o menu.
    expect(registros.length).toBeGreaterThanOrEqual(camadas.length - 1);
  });

  it('cada camada registrada tem um nome distinto (a pilha é diagnosticável)', () => {
    // O nome é o ÚLTIMO literal da chamada — greedy de propósito: alguns registros têm
    // string antes (ex.: `vista === 'compras'`), e o lazy pegava a errada.
    const nomes = codigo.split('\n')
      .map((l) => l.match(/useCamadaVoltavel\(.*'([^']+)'\s*\);/)?.[1])
      .filter((x): x is string => Boolean(x));
    expect(nomes.length).toBeGreaterThanOrEqual(11);
    expect(new Set(nomes).size, `nomes repetidos em ${nomes.join(', ')}`).toBe(nomes.length);
  });
});

describe('🔴 aceite 2d — logado não reencontra o login', () => {
  const login = readFileSync('src/app/login/page.tsx', 'utf8');

  it('a tela de login manda o logado para /app com REPLACE (nunca push)', () => {
    expect(login).toMatch(/router\.replace\('\/app'\)/);
    const efeito = login.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[router\]\);/)?.[0] ?? '';
    expect(efeito, 'o redirect de logado não está num efeito de montagem').not.toBe('');
    expect(efeito, 'push criaria entrada nova e o Voltar traria a pessoa de volta ao login').not.toMatch(/router\.push/);
  });

  /**
   * PAR DISCRIMINANTE do 2d: a pergunta tem que ir à sessão de AUTH (`getSession`), a mesma
   * fonte do middleware. Com o cache de perfil (`temSessao`) um perfil velho de conta
   * deslogada mandaria para /app, o middleware devolveria para /login, e daria ping-pong.
   */
  it('a pergunta é à sessão de auth, não ao cache de perfil', () => {
    const efeito = login.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[router\]\);/)?.[0] ?? '';
    expect(efeito).toMatch(/auth\.getSession\(\)/);
    expect(efeito, 'temSessao() é o cache de PERFIL — daria falso positivo e looping').not.toMatch(/temSessao\(\)/);
  });
});
