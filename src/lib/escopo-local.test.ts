import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CHAVES_APOSENTADAS, CHAVES_LOCAIS, CHAVES_SESSAO, chaveLocal, definirEscopoLocal, escopoLocal,
  limparDadoPessoalLocal,
} from './escopo-local';

/**
 * ISOLAMENTO DOS DADOS LOCAIS POR USUÁRIO (auditoria 2026-07-29).
 *
 * O defeito: `sairDaConta()` limpava só `evk_sessao`; treinos/pesos/aderência sobreviviam,
 * e a reconciliação do Painel os RE-SUBIA para a próxima conta a entrar no mesmo navegador.
 * ✅ Verificado no banco: não chegou a acontecer. Estes testes são a prevenção.
 */

// `localStorage`/`sessionStorage` mínimos — o vitest roda em `environment: 'node'`.
class StorageFake {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  chaves() { return [...this.m.keys()]; }
}

const A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

let ls: StorageFake;
let ss: StorageFake;

beforeEach(() => {
  ls = new StorageFake();
  ss = new StorageFake();
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = g.window ?? {};
  g.localStorage = ls;
  g.sessionStorage = ss;
  definirEscopoLocal(null);
});
afterEach(() => { definirEscopoLocal(null); });

describe('a chave carrega o dono', () => {
  it('sem escopo (modo mock) usa a chave sem sufixo', () => {
    expect(escopoLocal()).toBeNull();
    expect(chaveLocal('evk_treinos')).toBe('evk_treinos');
  });

  it('com escopo, cada usuário tem a sua gaveta', () => {
    definirEscopoLocal(A);
    expect(chaveLocal('evk_treinos')).toBe(`evk_treinos:${A}`);
    definirEscopoLocal(B);
    expect(chaveLocal('evk_treinos')).toBe(`evk_treinos:${B}`);
    expect(chaveLocal('evk_treinos')).not.toBe(`evk_treinos:${A}`);
  });

  it('o aviso de privacidade NÃO recebe escopo — é do dispositivo, não da pessoa', () => {
    definirEscopoLocal(A);
    expect(chaveLocal('evk_privacy_ack_v1')).toBe('evk_privacy_ack_v1');
  });

  it('userId vazio conta como sem escopo (nunca gera `evk_treinos:`)', () => {
    definirEscopoLocal('');
    expect(escopoLocal()).toBeNull();
    expect(chaveLocal('evk_treinos')).toBe('evk_treinos');
  });
});

describe('🔴 ACEITE 1 — A → logout → B: nada de A é lido nem re-subido sob o JWT de B', () => {
  it('B não enxerga NENHUMA chave de A', () => {
    // A usa o app e registra.
    definirEscopoLocal(A);
    ls.setItem(chaveLocal('evk_treinos'), JSON.stringify([{ n: 1, dataISO: '2026-07-20' }]));
    ls.setItem(chaveLocal('evk_pesos'), JSON.stringify([61.4]));
    ls.setItem(chaveLocal('evk_aderencia'), JSON.stringify({ '2026-07-20': { logs: { cafe: 'comi' }, notes: {} } }));
    ls.setItem(chaveLocal('evk_sessao'), JSON.stringify({ v: 1, perfil: { pesoKg: 61.4 } }));

    // B entra (o logout de A é testado à parte; aqui provamos o isolamento SOZINHO —
    // é a camada que segura mesmo se o logout não acontecer: aba fechada, sessão expirada).
    definirEscopoLocal(B);
    for (const k of ['evk_treinos', 'evk_pesos', 'evk_aderencia', 'evk_sessao'] as const) {
      expect(ls.getItem(chaveLocal(k)), `B leu a gaveta de A em ${k}`).toBeNull();
    }
  });

  it('o que B escreve não contamina A', () => {
    definirEscopoLocal(A);
    ls.setItem(chaveLocal('evk_treinos'), '["de A"]');
    definirEscopoLocal(B);
    ls.setItem(chaveLocal('evk_treinos'), '["de B"]');
    definirEscopoLocal(A);
    expect(ls.getItem(chaveLocal('evk_treinos'))).toBe('["de A"]');
  });

  it('⚠️ as chaves LEGADAS são apagadas SEM leitura ao entrar num escopo', () => {
    // Dado de dono desconhecido, gravado antes de o escopo existir. Reconciliá-lo É o
    // vazamento — então o único uso seguro é o descarte.
    ls.setItem('evk_treinos', '["de dono desconhecido"]');
    ls.setItem('evk_pesos', '[61.4]');
    ls.setItem('evk_aderencia', '{}');
    ls.setItem('evk_privacy_ack_v1', '1'); // esta NÃO tem dado pessoal — sobrevive

    const apagadas = definirEscopoLocal(B);
    expect(apagadas).toBe(3);
    expect(ls.getItem('evk_treinos')).toBeNull();
    expect(ls.getItem('evk_pesos')).toBeNull();
    expect(ls.getItem('evk_aderencia')).toBeNull();
    expect(ls.getItem('evk_privacy_ack_v1')).toBe('1');
    // E B continua com a gaveta vazia — nada foi "migrado" para ela.
    expect(ls.getItem(chaveLocal('evk_treinos'))).toBeNull();
  });

  it('o logout apaga o dado pessoal de TODOS os escopos, não só do atual', () => {
    definirEscopoLocal(A);
    ls.setItem(chaveLocal('evk_treinos'), '["A"]');
    // Chave APOSENTADA, com escopo, gravada por uma versão antiga do app.
    ls.setItem(`evk_notif:${A}`, '{"optIn":true}');
    definirEscopoLocal(B);
    ls.setItem(chaveLocal('evk_treinos'), '["B"]');
    ls.setItem('evk_privacy_ack_v1', '1');
    ss.setItem('evk_email', 'alguem@exemplo.com');

    limparDadoPessoalLocal();

    const restantes = ls.chaves();
    expect(restantes.filter((k) => k.startsWith('evk_treinos'))).toEqual([]);
    expect(restantes.filter((k) => k.startsWith('evk_notif'))).toEqual([]);
    // o ack do dispositivo fica (não é dado pessoal); o e-mail da sessionStorage sai
    expect(restantes).toContain('evk_privacy_ack_v1');
    expect(ss.getItem('evk_email')).toBeNull();
  });
});

describe('🔴 ACEITE 2 — a lista de chaves é fonte única', () => {
  /** Varre `src/` atrás de literais `evk_…` usados como chave de storage. */
  function chavesNoCodigo(): Set<string> {
    const achadas = new Set<string>();
    const anda = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) { anda(p); continue; }
        if (!/\.tsx?$/.test(p) || /\.test\.tsx?$/.test(p)) continue;
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/['"`](evk_[a-z0-9_]+)['"`]/gi)) achadas.add(m[1]!);
      }
    };
    anda('src');
    return achadas;
  }

  it('nenhuma chave `evk_*` existe no código fora da lista', () => {
    // 🔴 Foi assim que a 9ª chave apareceu: `limparDadosLocais` listava 6 à mão, o app
    // usava 9. A função da EXCLUSÃO DE CONTA é a que menos pode mentir.
    const conhecidas = new Set<string>([...CHAVES_LOCAIS, ...CHAVES_SESSAO, ...CHAVES_APOSENTADAS]);
    const fora = [...chavesNoCodigo()].filter((k) => !conhecidas.has(k)).sort();
    expect(fora, `chave(s) fora da fonte única: ${fora.join(', ')}`).toEqual([]);
  });

  it('e nenhuma chave da lista é órfã (declarada mas não usada)', () => {
    const noCodigo = chavesNoCodigo();
    const orfas = [...CHAVES_LOCAIS, ...CHAVES_SESSAO].filter((k) => !noCodigo.has(k));
    expect(orfas, `declarada(s) e não usada(s): ${orfas.join(', ')}`).toEqual([]);
  });

  it('`limparDadosLocais` DERIVA da lista — não redigita', () => {
    const src = readFileSync('src/lib/session.ts', 'utf8');
    expect(src).toMatch(/limparDadoPessoalLocal\(\)/);
    // A regressão que este teste pega: voltar a escrever o array à mão.
    expect(src).not.toMatch(/\[KEY, 'evk_treinos'/);
  });

  it('o logout limpa TUDO, não só a sessão', () => {
    const src = readFileSync('src/lib/auth/sair.ts', 'utf8');
    expect(src).toMatch(/limparDadosLocais\(\)/);
    expect(src).toMatch(/definirEscopoLocal\(null\)/);
    expect(src).not.toMatch(/^\s*limparSessao\(\);/m);
  });
});

describe('os pontos de entrada resolvem o escopo ANTES de ler o local', () => {
  it('/app resolve o escopo antes de qualquer leitura', () => {
    const src = readFileSync('src/app/app/page.tsx', 'utf8');
    const iEscopo = src.indexOf('await resolverEscopoLocal()');
    const iLer = src.indexOf('const local = lerSessao()');
    expect(iEscopo).toBeGreaterThan(-1);
    expect(iLer).toBeGreaterThan(iEscopo);
  });

  it('/onboarding resolve o escopo antes do `lerSessao` do boot', () => {
    const src = readFileSync('src/app/onboarding/page.tsx', 'utf8');
    expect(src).toMatch(/resolverEscopoLocal\(\)\.then\(\(\) => \{\s*\n\s*if \(lerSessao\(\)\)/);
  });
});

describe('🔒 CHAVES APOSENTADAS — a feature sai, o dado dela não fica em repouso', () => {
  /**
   * A regressão que isto pega: remover uma tela e, com ela, a chave de `CHAVES_LOCAIS` —
   * fazendo `limparDadoPessoalLocal` parar de varrer um dado que continua no navegador de
   * quem usou a versão anterior. Aconteceu com `evk_notif` (cartão de notificações removido
   * em 2026-07-29). Sai da lista viva, entra na lista de apagar.
   */
  it('nenhuma aposentada continua em CHAVES_LOCAIS (as duas listas são disjuntas)', () => {
    const viva = new Set<string>(CHAVES_LOCAIS);
    for (const k of CHAVES_APOSENTADAS) {
      expect(viva.has(k), `${k} está aposentada E viva ao mesmo tempo`).toBe(false);
    }
  });

  it('`evk_notif` está aposentada (a feature saiu)', () => {
    expect(CHAVES_APOSENTADAS).toContain('evk_notif');
    expect([...CHAVES_LOCAIS] as string[]).not.toContain('evk_notif');
  });

  it('o logout varre as aposentadas, em qualquer escopo e sem escopo', () => {
    for (const k of CHAVES_APOSENTADAS) {
      definirEscopoLocal(A);
      ls.setItem(`${k}:${A}`, 'x');
      ls.setItem(`${k}:${B}`, 'x');
      ls.setItem(k, 'x'); // legado, sem sufixo
      limparDadoPessoalLocal();
      expect(ls.chaves().filter((c) => c.startsWith(k)), `${k} sobreviveu ao logout`).toEqual([]);
    }
  });

  it('entrar num escopo descarta a aposentada legada (sem ler)', () => {
    for (const k of CHAVES_APOSENTADAS) {
      definirEscopoLocal(null);
      ls.setItem(k, 'x');
      definirEscopoLocal(B);
      expect(ls.getItem(k), `${k} legada sobreviveu ao definirEscopoLocal`).toBeNull();
    }
  });

  /**
   * O outro lado do aceite: aposentada é chave que **ninguém consome**. Se voltar um
   * `getItem`/`setItem` dela, ou um módulo que a leia, ela não está aposentada — está viva e
   * fora da fonte única. `escopo-local.ts` é o único lugar onde o literal pode aparecer.
   */
  it('nenhuma aposentada é lida ou escrita em src/ (só a lista a menciona)', () => {
    const menciona: string[] = [];
    const anda = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) { anda(p); continue; }
        if (!/\.tsx?$/.test(p) || /\.test\.tsx?$/.test(p)) continue;
        if (p.endsWith(join('lib', 'escopo-local.ts'))) continue; // a própria lista
        const src = readFileSync(p, 'utf8');
        for (const k of CHAVES_APOSENTADAS) if (src.includes(k)) menciona.push(`${p} → ${k}`);
      }
    };
    anda('src');
    expect(menciona, `aposentada com consumidor: ${menciona.join(', ')}`).toEqual([]);
  });

  /** E o módulo que servia a chave não pode voltar sem passar por aqui. */
  it('os módulos da fachada de notificações não existem mais', () => {
    for (const f of ['src/lib/notificacoes.ts', 'src/components/painel/Notificacoes.tsx']) {
      expect(existsSync(f), `${f} voltou — web push tem de ser construído, não simulado`).toBe(false);
    }
  });

  /**
   * 🔴 O defeito que a remoção fecha, escrito para não voltar: `ativarNotif()` descartava o
   * retorno de `requestPermission()` (`void` + `catch {}`) e gravava `optIn: true`
   * incondicionalmente — o badge "ATIVADAS" acendia mesmo com a permissão NEGADA. E nada
   * entregava aviso nenhum: `public/sw.js` não tem handler `push`.
   */
  it('ninguém pede permissão de notificação sem consumir a resposta', () => {
    const src = readFileSync('src/components/painel/Painel.tsx', 'utf8');
    expect(src).not.toMatch(/Notification\.requestPermission/);
    expect(src).not.toMatch(/NotificacoesCard|ModalNotificacoes|ativarNotif/);
  });
});
