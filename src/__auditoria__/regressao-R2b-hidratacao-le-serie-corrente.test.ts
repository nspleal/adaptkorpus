/**
 * 🔴 R2, 2ª volta (conferência focal de `6847571`) — REGRESSÃO DO COMPORTAMENTO CORRETO,
 * **no encadeamento real do componente**.
 *
 * O defeito que a conferência reproduziu: em `Painel.tsx`, `lerPesos()` acontecia ANTES de
 * `carregarPesosServidor()`. Quem se pesava enquanto o GET estava pendente tinha o ponto novo
 * apagado por `substituirPesos(serie)` — a reconciliação recebia a fotografia do mount —, e o
 * ponto nem entrava em `pendentes`: se o POST dele falhasse, a cópia de recuperação ia junto.
 *
 * 🔴 POR QUE ESTE ARQUIVO EXISTE SEPARADO DOS PUROS. Os 18 casos de
 * `regressao-R2-convergencia-historico-e-perfil.test.ts` exercitam `reconciliarSeriePesos`
 * com as listas certas e passam — e passavam com o defeito vivo. A propriedade que faltava não
 * é da função: é de **quem a chama**, e de QUANDO ele lê o storage. Por isso aqui o corpo REAL
 * do efeito é extraído do arquivo-fonte, transpilado e executado com dependências injetadas e
 * rede controlada. Um teste que não tocasse este call site não teria achado nada.
 *
 * ⚠️ O instrumento é frágil de propósito: se o efeito for renomeado/movido, a extração falha e
 * o teste quebra ALTO (`expect(inicio).toBeGreaterThan(0)`) em vez de virar vacuidade. E
 * **falha de extração não é aprovação do app** — a conferência já tropeçou nisso ao procurar
 * `\n` num arquivo CRLF; daí o `normalizar()` abaixo.
 */
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { beforeEach, describe, expect, it } from 'vitest';
import { reconciliarSeriePesos } from '../lib/peso-reconciliacao';
import type { RegistroPeso } from '../lib/treino-historico';
import type { ResultadoPesoServidor } from '../lib/persistencia/sync';
import { continuacaoDaConta } from '../lib/persistencia/continuidade-conta';

const HOJE = '2026-09-11';
const ONTEM = '2026-09-10';
const p = (dataISO: string | null, kg: number): RegistroPeso => ({ dataISO, kg });
/** CRLF/LF não é característica do produto — normalizar antes de procurar âncora. */
const normalizar = (s: string) => s.replace(/\r\n/g, '\n');

/** Corpo real do efeito de hidratação de pesos, pronto para rodar. */
function corpoDoEfeito(): string {
  const fonte = normalizar(readFileSync('src/components/painel/Painel.tsx', 'utf8'));
  const inicio = fonte.indexOf('  useEffect(() => {\n    const semente:');
  expect(inicio, 'efeito de hidratação de pesos não encontrado — extração falhou, NÃO é aprovação').toBeGreaterThan(0);
  const fim = fonte.indexOf('  }, []);', inicio) + '  }, []);'.length;
  expect(fim).toBeGreaterThan(inicio);
  return ts.transpileModule(fonte.slice(inicio, fim), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

type Gravacao = { serie: RegistroPeso[] };

/**
 * Monta o cenário: storage vivo, GET sob controle, POST sob controle, e o registro do perfil
 * observado. Devolve as alavancas para o teste dirigir o tempo.
 */
function cenario(opts: {
  storageInicial: RegistroPeso[];
  /** Conta dona da gaveta AGORA (muda para simular troca de conta). */
  contaAgora?: string;
  respostaDoPost?: ResultadoPesoServidor;
}) {
  let storage = [...opts.storageInicial];
  const gravacoes: Gravacao[] = [];
  const postsEnviados: { kg: number; dataISO: string | null }[] = [];
  const perfilAplicado: { pesoKg: unknown; respostaDe: string | null; governa: string }[] = [];
  const alinhamentos: { dia: string; aceito: number }[] = [];
  const exibido: RegistroPeso[][] = [];
  let responderGet!: (r: RegistroPeso[] | null) => void;
  const get = new Promise<RegistroPeso[] | null>((r) => { responderGet = r; });
  let limpeza: (() => void) | undefined;
  const contaLocalRef = { current: opts.contaAgora ?? 'conta-A' };
  const painelVivoRef = { current: true };

  const deps = {
    // O efeito real passou a usar o helper de epoch; injeta a implementação real.
    continuacaoDaConta,
    useEffect: (f: () => void | (() => void)) => { limpeza = f() as (() => void) | undefined; },
    perfil: { pesoKg: 63 },
    // 🔒 `lerPesos` devolve o storage VIVO: é exatamente isto que distingue ler no mount de
    // ler na resposta. Se o efeito voltar a fotografar no mount, o teste enxerga.
    lerPesos: () => [...storage],
    setPesos: (v: RegistroPeso[] | ((p: RegistroPeso[]) => RegistroPeso[])) => {
      exibido.push(typeof v === 'function' ? v(exibido[exibido.length - 1] ?? []) : v);
    },
    hojeISO: () => HOJE,
    escopoLocal: () => 'conta-A',
    painelVivoRef,
    contaLocalRef,
    carregarPesosServidor: () => get,
    reconciliarSeriePesos,
    substituirPesos: (s: readonly RegistroPeso[]) => {
      storage = [...s];
      gravacoes.push({ serie: [...s] });
      return storage;
    },
    aplicarPesoNoPerfil: (pesoKg: unknown, ctx?: { respostaDe: string | null; governa: string }) => {
      perfilAplicado.push({ pesoKg, respostaDe: ctx?.respostaDe ?? null, governa: ctx?.governa ?? '' });
      return true;
    },
    registrarPesoServidor: (kg: number, dataISO: string | null) => {
      postsEnviados.push({ kg, dataISO });
      return Promise.resolve(opts.respostaDoPost ?? ({ tipo: 'REGISTRADO' } as ResultadoPesoServidor));
    },
    alinharSerieAoPesoAceito: (dia: string, aceito: number) => {
      alinhamentos.push({ dia, aceito });
      storage = storage.map((x) => (x.dataISO === dia ? { ...x, kg: aceito } : x));
    },
  };

  new Function(...Object.keys(deps), corpoDoEfeito())(...Object.values(deps));

  return {
    /** A pessoa se pesa enquanto o GET está pendente (é o `registrarPesoLocal` real em miniatura). */
    registrarDuranteEspera: (r: RegistroPeso) => { storage = [...storage, r]; },
    responderGet,
    desmontar: () => { limpeza?.(); painelVivoRef.current = false; },
    trocarConta: (c: string) => { contaLocalRef.current = c; },
    get storage() { return storage; },
    gravacoes, postsEnviados, perfilAplicado, alinhamentos, exibido,
  };
}

/** Deixa a microfila drenar: GET → reconciliação → POSTs → callbacks dos POSTs. */
const drenar = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };

describe('🔴 R2b ① — GET atrasado NÃO apaga a pesagem feita durante a espera', () => {
  it('o ponto novo sobrevive e entra na fila de reenvio (a reprodução, invertida)', async () => {
    const c = cenario({ storageInicial: [p(ONTEM, 63)] });
    c.registrarDuranteEspera(p(HOJE, 68));
    c.responderGet([p(ONTEM, 63)]); // resposta VÁLIDA: a consulta começou antes do registro
    await drenar();

    expect(c.storage, 'a pesagem de hoje foi apagada pela fotografia do mount')
      .toEqual([p(ONTEM, 63), p(HOJE, 68)]);
    expect(c.postsEnviados, 'o ponto novo não entrou no reenvio')
      .toEqual([{ kg: 68, dataISO: HOJE }]);
  });

  it('a série EXIBIDA também fica com o ponto novo (a tela não divergir do storage)', async () => {
    const c = cenario({ storageInicial: [p(ONTEM, 63)] });
    c.registrarDuranteEspera(p(HOJE, 68));
    c.responderGet([p(ONTEM, 63)]);
    await drenar();
    const ultima = c.exibido[c.exibido.length - 1]!;
    expect(ultima.filter((x) => x.dataISO !== null)).toEqual([p(ONTEM, 63), p(HOJE, 68)]);
    expect(ultima[0], 'a semente do perfil continua abrindo a série').toEqual(p(null, 63));
  });

  it('o perfil converge para a pesagem de hoje que sobreviveu', async () => {
    const c = cenario({ storageInicial: [p(ONTEM, 63)] });
    c.registrarDuranteEspera(p(HOJE, 68));
    c.responderGet([p(ONTEM, 63)]);
    await drenar();
    expect(c.perfilAplicado).toEqual([{ pesoKg: 68, respostaDe: HOJE, governa: HOJE }]);
  });

  it('POST FALHO: a cópia de recuperação permanece no storage', async () => {
    const c = cenario({ storageInicial: [p(ONTEM, 63)], respostaDoPost: { tipo: 'FALHA' } });
    c.registrarDuranteEspera(p(HOJE, 68));
    c.responderGet([p(ONTEM, 63)]);
    await drenar();
    expect(c.storage, 'POST falhou E o ponto sumiu — perda dupla').toEqual([p(ONTEM, 63), p(HOJE, 68)]);
    expect(c.alinhamentos, 'FALHA não alinha nada').toEqual([]);
  });

  it('POST ACEITO: o ponto permanece e nada é realinhado', async () => {
    const c = cenario({ storageInicial: [p(ONTEM, 63)], respostaDoPost: { tipo: 'REGISTRADO' } });
    c.registrarDuranteEspera(p(HOJE, 68));
    c.responderGet([p(ONTEM, 63)]);
    await drenar();
    expect(c.storage).toEqual([p(ONTEM, 63), p(HOJE, 68)]);
    expect(c.alinhamentos).toEqual([]);
  });

  it('POST RECUSADO no dia de hoje: série e perfil se alinham ao peso ACEITO', async () => {
    const c = cenario({
      storageInicial: [p(ONTEM, 63)],
      respostaDoPost: { tipo: 'RECUSADO_DIA', pesoKg: 67 },
    });
    c.registrarDuranteEspera(p(HOJE, 68));
    c.responderGet([p(ONTEM, 63)]);
    await drenar();
    expect(c.alinhamentos).toEqual([{ dia: HOJE, aceito: 67 }]);
    expect(c.storage).toEqual([p(ONTEM, 63), p(HOJE, 67)]);
    expect(c.perfilAplicado.map((x) => x.pesoKg)).toEqual([68, 67]);
  });

  it('POST RECUSADO sem peso legível (R4) não alinha nem apaga', async () => {
    const c = cenario({
      storageInicial: [p(ONTEM, 63)],
      respostaDoPost: { tipo: 'RECUSADO_DIA', pesoKg: null },
    });
    c.registrarDuranteEspera(p(HOJE, 68));
    c.responderGet([p(ONTEM, 63)]);
    await drenar();
    expect(c.alinhamentos).toEqual([]);
    expect(c.storage).toEqual([p(ONTEM, 63), p(HOJE, 68)]);
  });
});

describe('🔴 R2b ② — o que o servidor tem continua vencendo', () => {
  it('conflito no mesmo dia: o valor do servidor fica, e aquele dia não reenvia', async () => {
    const c = cenario({ storageInicial: [p(HOJE, 68)] });
    c.responderGet([p(HOJE, 65)]);
    await drenar();
    expect(c.storage).toEqual([p(HOJE, 65)]);
    expect(c.postsEnviados).toEqual([]);
    expect(c.perfilAplicado).toEqual([{ pesoKg: 65, respostaDe: HOJE, governa: HOJE }]);
  });

  it('dia antigo só-local é reenviado, e a recusa dele NÃO governa o perfil', async () => {
    const c = cenario({
      storageInicial: [p(ONTEM, 63)],
      respostaDoPost: { tipo: 'RECUSADO_DIA', pesoKg: 62 },
    });
    c.responderGet([p('2026-09-01', 60)]);
    await drenar();
    expect(c.postsEnviados).toEqual([{ kg: 63, dataISO: ONTEM }]);
    expect(c.alinhamentos).toEqual([{ dia: ONTEM, aceito: 62 }]);
    // `governa: hoje` com `respostaDe: ontem` — a decisão pura descarta; o componente só repassa.
    expect(c.perfilAplicado).toEqual([{ pesoKg: 62, respostaDe: ONTEM, governa: HOJE }]);
  });

  it('GET falho (`null`) não grava, não reenvia e não toca o perfil', async () => {
    const c = cenario({ storageInicial: [p(HOJE, 68)] });
    c.responderGet(null);
    await drenar();
    expect(c.gravacoes, 'GET falho reescreveu o storage').toEqual([]);
    expect(c.postsEnviados).toEqual([]);
    expect(c.perfilAplicado).toEqual([]);
    expect(c.storage).toEqual([p(HOJE, 68)]);
  });
});

describe('🔴 R2b ③ — resposta obsoleta, unmount e troca de conta não escrevem', () => {
  it('desmontado antes da resposta: nada é gravado, nada é enviado', async () => {
    const c = cenario({ storageInicial: [p(ONTEM, 63)] });
    c.registrarDuranteEspera(p(HOJE, 68));
    c.desmontar();
    c.responderGet([p(ONTEM, 63)]);
    await drenar();
    expect(c.gravacoes, 'gravou storage após unmount').toEqual([]);
    expect(c.postsEnviados).toEqual([]);
    expect(c.perfilAplicado).toEqual([]);
    expect(c.storage, 'o storage ficou como estava').toEqual([p(ONTEM, 63), p(HOJE, 68)]);
  });

  it('conta trocada durante a espera: não grava — e nem LÊ a gaveta da conta nova', async () => {
    const c = cenario({ storageInicial: [p(ONTEM, 63)] });
    c.trocarConta('conta-B');
    c.responderGet([p('2026-01-01', 99)]);
    await drenar();
    expect(c.gravacoes, 'escreveu na gaveta de outra conta').toEqual([]);
    expect(c.postsEnviados).toEqual([]);
    expect(c.perfilAplicado).toEqual([]);
    expect(c.storage).toEqual([p(ONTEM, 63)]);
  });

  it('logout durante a espera (escopo virou null) também descarta', async () => {
    const c = cenario({ storageInicial: [p(ONTEM, 63)] });
    c.trocarConta(null as unknown as string);
    c.responderGet([p(ONTEM, 63)]);
    await drenar();
    expect(c.gravacoes).toEqual([]);
  });

  it('a guarda de conta vem ANTES da leitura do storage, na fonte', () => {
    const corpo = normalizar(readFileSync('src/components/painel/Painel.tsx', 'utf8'))
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const i = corpo.indexOf('carregarPesosServidor().then(');
    expect(i).toBeGreaterThan(0);
    const trecho = corpo.slice(i, corpo.indexOf('for (const v of pendentes)', i));
    const posGuarda = trecho.indexOf('if (!mesmaGaveta()');
    const posLeitura = trecho.indexOf('lerPesos()');
    expect(posGuarda, 'a guarda desapareceu do callback').toBeGreaterThan(-1);
    expect(posLeitura, 'a releitura da série desapareceu do callback').toBeGreaterThan(-1);
    expect(posGuarda, 'leu o storage antes de conferir a conta').toBeLessThan(posLeitura);
  });
});

describe('🔴 R2b ④ — a fotografia do mount não decide mais nada', () => {
  let corpo = '';
  beforeEach(() => {
    corpo = normalizar(readFileSync('src/components/painel/Painel.tsx', 'utf8'));
  });

  it('a lista lida no mount é usada só no primeiro `setPesos`, e tem nome próprio', () => {
    const i = corpo.indexOf('  useEffect(() => {\n    const semente:');
    const efeito = corpo.slice(i, corpo.indexOf('  }, []);', i));
    const semComentarios = efeito.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const callback = semComentarios.slice(semComentarios.indexOf('carregarPesosServidor().then('));
    expect(callback.includes('noMount'), 'o callback voltou a usar a fotografia do mount').toBe(false);
    expect(semComentarios).toContain('const noMount = lerPesos();');
  });

  it('a âncora e o plano continuam fora deste efeito (anti-regressão de R2, 1ª volta)', () => {
    const i = corpo.indexOf('  useEffect(() => {\n    const semente:');
    const efeito = corpo.slice(i, corpo.indexOf('  }, []);', i));
    expect(/reancorar/.test(efeito), 'a hidratação passou a reancorar').toBe(false);
    expect(/recomputarPlano/.test(efeito), 'a hidratação passou a regerar o plano').toBe(false);
    expect(corpo, 'anti-vacuidade: a reancoragem existe fora daqui').toContain('reancorarPesoDoPlanoLocal');
  });
});
