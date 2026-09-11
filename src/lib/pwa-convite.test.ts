import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PWA — convite de instalação (Leva C1).
 *
 * **A fala do testador:** *"abrir navegador pelo celular é ruim, um app móvel seria ideal"*.
 * O Passo 0 mostrou que o PWA já existia inteiro (manifest + service worker registrado) e
 * que faltava **convidar** — mais três defeitos que fariam o convite chegar em cima de um
 * ícone quebrado.
 */

const fonte = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

const MANIFEST = JSON.parse(readFileSync(join('public', 'manifest.webmanifest'), 'utf8')) as {
  name: string; short_name: string; start_url: string; display: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
};

describe('manifest — instalável de verdade', () => {
  it('tem os campos que a instalação exige', () => {
    expect(MANIFEST.name).toBe('Adaptkorpus');
    expect(MANIFEST.short_name).toBeTruthy();
    expect(MANIFEST.display).toBe('standalone');
  });

  /**
   * 🔻 Achado do Passo 0: `start_url` era `"/"` — o app INSTALADO abria a página de vendas.
   * Para quem instalou, o destino é a área logada.
   */
  it('`start_url` aponta para o app, não para a landing', () => {
    expect(MANIFEST.start_url).toBe('/app');
  });

  /**
   * 🔻 Achado do Passo 0: havia UM ícone, SVG, com `purpose: "any maskable"`. Máscara
   * adaptativa em SVG não é honrada na prática — o atalho cairia no ícone genérico.
   */
  it('tem PNG 192 e 512, e um maskable', () => {
    const png = MANIFEST.icons.filter((i) => i.type === 'image/png');
    expect(png.map((i) => i.sizes).sort()).toEqual(['192x192', '512x512', '512x512']);
    expect(MANIFEST.icons.some((i) => i.purpose === 'maskable' && i.type === 'image/png')).toBe(true);
  });

  it.each(['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon.svg'])(
    'o arquivo %s existe e não está vazio', (nome) => {
      const p = join('public', 'icons', nome);
      expect(existsSync(p), `${p} ausente`).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(500);
    });

  /**
   * 🔒 FIDELIDADE VISUAL (regra travada do cofre): os PNG são RASTERIZADOS do `icon.svg`
   * canônico, nunca redesenhados. O que se pode provar por arquivo é que o SVG-fonte segue
   * com a construção canônica — mesma geometria e as cores certas para FUNDO CLARO
   * (K em Floresta, trajetória em Folha; o neon `#BDFF00` NUNCA entra em fundo claro).
   */
  it('o SVG-fonte mantém a construção canônica e a regra de cor do fundo claro', () => {
    const svg = readFileSync(join('public', 'icons', 'icon.svg'), 'utf8');
    expect(svg).toMatch(/viewBox="0 0 100 100"/);
    expect(svg).toMatch(/x1="28" y1="16" x2="28" y2="84"/);   // haste
    expect(svg).toMatch(/x1="29" y1="50" x2="68" y2="84"/);   // perna
    expect(svg).toMatch(/#0D2818/);                            // K em Floresta (fundo claro)
    expect(svg).toMatch(/#16A34A/);                            // trajetória em Folha
    expect(/#BDFF00/i.test(svg), 'neon em fundo claro — proibido pelo cofre').toBe(false);
    // Os 3 pontos que crescem subindo.
    expect([...svg.matchAll(/<circle/g)]).toHaveLength(3);
  });

  it('o `apple-touch-icon` está declarado (iOS ignora os ícones do manifest)', () => {
    expect(fonte(join('src', 'app', 'layout.tsx'))).toMatch(/icons:\s*\{\s*apple:\s*'\/icons\/apple-touch-icon\.png'/);
  });
});

describe('convite — onde aparece e o que promete', () => {
  const comp = fonte(join('src', 'components', 'pwa', 'ConviteInstalar.tsx'));

  it('escuta `beforeinstallprompt` e impede a barra do browser por cima', () => {
    expect(comp).toMatch(/addEventListener\('beforeinstallprompt'/);
    expect(comp).toMatch(/e\.preventDefault\(\)/);
  });

  /** 🔒 Dentro do app, nunca na landing — o beta é fechado por allowlist. */
  it('é montado em /app e NÃO na landing', () => {
    expect(fonte(join('src', 'app', 'app', 'page.tsx'))).toMatch(/<ConviteInstalar \/>/);
    expect(/ConviteInstalar/.test(fonte(join('src', 'app', 'page.tsx'))), 'convite na landing').toBe(false);
    expect(/ConviteInstalar/.test(fonte(join('src', 'app', 'layout.tsx'))), 'convite no layout global').toBe(false);
  });

  /**
   * 🔒 TRAVA DE COPY — o convite NÃO promete notificações. Elas foram REMOVIDAS em
   * `e5e77fc` por não existirem: `ativarNotif` descartava o retorno de
   * `requestPermission()` e o badge "ATIVADAS" acendia com a permissão negada. Usá-las como
   * argumento aqui ressuscitaria a mesma mentira por outra porta. O argumento é abrir sem a
   * barra do navegador — literalmente o que o testador pediu.
   */
  it('não menciona notificações, avisos nem lembretes', () => {
    for (const palavra of [/notifica/i, /lembrete/i, /\bavisos?\b/i, /alerta/i, /push/i]) {
      expect(palavra.test(comp), `convite promete ${palavra}`).toBe(false);
    }
  });

  it('o argumento é a barra do navegador', () => {
    expect(comp).toMatch(/barra do navegador/);
  });

  /**
   * 🔒 Uma vez, dispensável, sem re-insistir.
   *
   * ⚠️ A 1ª versão contava ocorrências de `marcarRespondido()` no ARQUIVO e exigia ≥ 3.
   * Tirar a chamada de dentro de `dispensar` deixava 3 (definição + `instalar` +
   * `appinstalled`) e a mutação SOBREVIVIA — quem dispensasse veria o convite de novo a cada
   * abertura. Contagem prova existência, nunca LOCAL. Agora a asserção é por corpo.
   */
  const corpoDe = (nome: string) => {
    const i = comp.indexOf(`function ${nome}(`);
    if (i < 0) return '';
    const abre = comp.indexOf('{', comp.indexOf(')', i));
    let n = 0;
    for (let j = abre; j < comp.length; j += 1) {
      if (comp[j] === '{') n += 1;
      else if (comp[j] === '}') { n -= 1; if (n === 0) return comp.slice(abre, j + 1); }
    }
    return '';
  };

  it.each(['dispensar', 'instalar'])('`%s` marca a resposta (some para sempre)', (fn) => {
    const c = corpoDe(fn);
    expect(c, `${fn} sumiu — reveja este guard`).not.toBe('');
    expect(c, `${fn} não marca a resposta — o convite volta a insistir`).toMatch(/marcarRespondido\(\)/);
  });

  it('e o extrator de corpo funciona (não passa por vacuidade)', () => {
    expect(corpoDe('dispensar')).toContain('setVisivel(false)');
    expect(corpoDe('funcao_que_nao_existe')).toBe('');
  });

  it('a resposta é lida no mount e persistida na chave da fonte única', () => {
    expect(comp).toMatch(/localStorage\.getItem\(chaveLocal\('evk_instalar_ack_v1'\)\)/);
    expect(corpoDe('marcarRespondido')).toMatch(/setItem\(chaveLocal\('evk_instalar_ack_v1'\)/);
  });

  it('não comenta a dispensa nem conta quantas vezes apareceu', () => {
    for (const p of [/você (já )?dispensou/i, /de novo/i, /outra vez/i, /\d+ vezes/i]) {
      expect(p.test(comp), `convite comenta a dispensa: ${p}`).toBe(false);
    }
  });

  /**
   * ⚠️ A 1ª versão só provava que o HELPER existia (`display-mode: standalone` no arquivo) e
   * a mutação "apagar `if (jaInstalado()) return;`" SOBREVIVIA — o convite voltaria a
   * aparecer para quem já instalou, dentro do próprio app instalado. Peça provada, uso não
   * provado: é a 7ª vez nesta série.
   */
  it('não aparece para quem já está com o app instalado — e o efeito CHAMA a checagem', () => {
    expect(comp).toMatch(/display-mode: standalone/);
    expect(comp).toMatch(/navigator as \{ standalone\?: boolean \}/);
    expect(comp, 'o efeito não checa se já está instalado').toMatch(/if \(jaInstalado\(\)\) return;/);
  });

  /** iOS não tem o evento: lá a instrução é estática e só no Safari. */
  it('iOS ganha instrução manual, e só no Safari', () => {
    expect(comp).toMatch(/Adicionar à Tela de Início/);
    expect(comp).toMatch(/CriOS\|FxiOS\|EdgiOS\|OPiOS/); // Chrome/Firefox no iOS não instalam
    expect(comp).toMatch(/iPad\|iPhone\|iPod/);
  });

  it('no iOS não há botão "Instalar" (não existe evento para disparar)', () => {
    expect(comp).toMatch(/\{!ios && \(/);
  });
});
