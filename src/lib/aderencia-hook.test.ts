import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as persistencia from './aderencia-persistencia';
const DIA = '2026-09-12';
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function montar() {
  const efeitos: (() => unknown)[] = [];
  let conta = 'A';
  let texto = JSON.stringify({ [DIA]: { logs: { cafe: 'seguiu' }, notes: {} } });
  const gravar = vi.fn((_k: string, valor: string) => { texto = valor; });
  const enviar = vi.fn().mockResolvedValue(false);
  let resolver!: (dados: unknown) => void;
  const resposta = new Promise(r => { resolver = r; });
  const deps: Record<string, unknown> = {
    react: { useRef: (v: unknown) => ({ current: v }), useState: (v: unknown) => [v, vi.fn()], useEffect: (f: () => unknown) => efeitos.push(f) },
    '@/lib/aderencia': {},
    '@/lib/dia-local': { diaLocalISO: () => DIA },
    '@/lib/persistencia/sync': { carregarAderenciaServidor: () => resposta, salvarAderenciaDia: enviar },
    '@/lib/metricas/registrar': { registrarEvento: vi.fn() },
    '@/lib/escopo-local': { chaveLocal: () => `aderencia:${conta}`, escopoLocal: () => conta },
    '@/lib/supabase/env': { supabaseConfigurado: () => true },
    '@/lib/aderencia-persistencia': persistencia,
    '@/lib/persistencia/sync-contrato': { EVENTO_FATOS: 'evk:fatos-v2' },
  };
  const fonte = readFileSync('src/components/painel/RegistroRefeicao.tsx', 'utf8');
  const fim = fonte.indexOf('const EASE'); expect(fim).toBeGreaterThan(0);
  const js = ts.transpileModule(fonte.slice(0, fim), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { useRegistro?: () => { setStatus: (id: string, s: string) => void } } = {};
  new Function('require', 'exports', 'window', 'localStorage', js)(
    (nome: string) => { if (!(nome in deps)) throw new Error(nome); return deps[nome]; }, exports, { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    { getItem: () => texto, setItem: gravar },
  );
  const hook = exports.useRegistro!();
  const limpezas = efeitos.map(e => e());
  return { hook, enviar, gravar, resolver, ler: () => JSON.parse(texto), trocar: () => { conta = 'B'; },
    fechar: () => limpezas.forEach(f => { if (typeof f === 'function') f(); }) };
}
describe('useRegistro real: efeitos e ações com GET controlado', () => {
  it('mount não grava vazio antes da hidratação', () => {
    const c = montar(); expect(c.gravar).not.toHaveBeenCalled(); expect(c.enviar).not.toHaveBeenCalled();
    expect(c.ler()[DIA].logs.cafe).toBe('seguiu'); c.fechar();
  });
  it('editar enquanto GET espera, falhar PUT e receber servidor antigo conserva edição', async () => {
    const c = montar(); c.hook.setStatus('cafe', 'fora'); await tick();
    c.resolver({ [DIA]: { logs: { cafe: 'seguiu' }, notes: {} } }); await tick();
    expect(c.ler()[DIA].logs.cafe).toBe('fora'); expect(c.ler()[DIA].pendenteSync).toBe(true); c.fechar();
  });
  it('troca de conta bloqueia callback e ações do hook anterior', async () => {
    const c = montar(); c.trocar(); c.resolver({ [DIA]: { logs: { cafe: 'fora' }, notes: {} } }); await tick();
    c.hook.setStatus('cafe', 'fora'); expect(c.gravar).not.toHaveBeenCalled(); expect(c.enviar).not.toHaveBeenCalled(); c.fechar();
  });
  it('unmount impede callback tardio', async () => {
    const c = montar(); c.fechar(); c.resolver({ [DIA]: { logs: {}, notes: {} } }); await tick();
    expect(c.gravar).not.toHaveBeenCalled(); expect(c.enviar).not.toHaveBeenCalled();
  });
});
