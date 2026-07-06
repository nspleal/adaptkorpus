import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard-rail ESTÁTICO das migrations de RLS (cultura do repo, como o admin-guardrail).
 * Não há teste de RLS ao vivo aqui (egress bloqueado; o §6 roda na Vercel) — o que este
 * teste trava é o DRIFT do repo: o gate do acervo (0008, red-team 2026-07-06) existe,
 * cobre as 4 tabelas, e nenhuma migration posterior o reabre.
 */
const DIR = join(process.cwd(), 'supabase', 'migrations');
const ACERVO = ['foods', 'recipes', 'recipe_items', 'exercises'] as const;
const USUARIO = ['profile', 'plans', 'logs', 'feedback', 'subscription'] as const;

const arquivos = () => readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const ler = (f: string) => readFileSync(join(DIR, f), 'utf8');

describe('0008 — acervo gateado pela allowlist (reconciliação do banco vivo)', () => {
  const m0008 = ler('0008_gate_conteudo_allowlist.sql');

  it('altera a policy de leitura das 4 tabelas do acervo para beta_liberado()', () => {
    for (const t of ACERVO) {
      const re = new RegExp(
        `alter policy "${t}_read_authenticated"\\s+on public\\.${t}\\s+using \\(\\(select public\\.beta_liberado\\(\\)\\)\\)`,
      );
      expect(m0008, `gate ausente p/ ${t}`).toMatch(re);
    }
  });

  it('NÃO toca as tabelas de usuário', () => {
    for (const t of USUARIO) {
      expect(m0008.includes(`public.${t}`), `0008 não devia mencionar public.${t}`).toBe(false);
    }
  });

  it('nenhuma migration POSTERIOR à 0008 reabre o acervo com using (true)', () => {
    const posteriores = arquivos().filter((f) => f > '0008');
    for (const f of posteriores) {
      const sql = ler(f).toLowerCase();
      for (const t of ACERVO) {
        const reabre = new RegExp(`policy "${t}_read_authenticated"[\\s\\S]{0,200}using \\(true\\)`);
        expect(reabre.test(sql), `${f} reabre ${t} com using (true)`).toBe(false);
      }
    }
  });
});
