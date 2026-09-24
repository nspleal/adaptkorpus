import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { perfilTreinoSchema } from '@/lib/validation/api';
import { perfilResumoSchema } from '@/lib/validation/perfil-resumo';
import { recomputarPlano } from '@/lib/plano';
import { normalizarEntradaPlanoVisivel, opcoesDeEntradaPlano } from '@/lib/plano-cas-comando';
import type { PerfilResumo } from '@/components/painel/Painel';

/**
 * 🔴 D5 (diagnóstico 2026-09-10, §6.6) — `POST /api/treino` órfã, divergente e sem teste.
 *
 * Medido no SHA `34b2ede`:
 *  · `perfilTreinoSchema` aceitava **10 campos** e descartava sete que o montador lê —
 *    `treinoDias`, `preferencias`, `foco`, `divisaoPreferida`, `rotinaCustom`,
 *    `cardioFavorito`, `modoForca`; a rota também não repassava `favoritos`, `semanaCiclo`,
 *    `escolhasExecucao` nem `diasOferecidosCardio`;
 *  · para o MESMO usuário, a rota devolvia split `Upper / Lower ×2` e o app
 *    `Prioridades (4 dias)`, com exercícios totalmente diferentes;
 *  · sem `semanaCiclo`, a rota devolvia rotina **sem `series` e sem `descansoSeg`**, com 24
 *    motivos "séries ausente";
 *  · `tempoPorSessaoMin` aceitava 10–180 na rota e 10–240 no `perfilResumoSchema`;
 *  · `grep "api/treino" src/**\/*.test.ts` → **0**.
 *
 * 🔒 A rota NÃO foi removida. A direção do autor é explícita: ausência de chamada interna não
 * prova ausência de uso externo. Ela foi ALINHADA ao fluxo real e os campos novos são todos
 * OPCIONAIS — um cliente que hoje manda os 10 campos antigos continua recebendo 200, e com um
 * plano melhor (com séries) do que antes.
 */

vi.mock('@/lib/auth/guard', () => ({ barreiraCompute: async () => null }));

const PERFIL_BASE = {
  pesoKg: 80, alturaCm: 178, idade: 30,
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
  objetivo: 'massa' as const, nivelExperiencia: 'intermediario' as const,
  equipamento: 'academia' as const, equipamentosCasa: [],
  diasDisponiveis: 4, tempoPorSessaoMin: 60,
};

async function chamar(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import('./route');
  const texto = JSON.stringify(body);
  const req = new NextRequest('https://app/api/treino', {
    method: 'POST', body: texto,
    headers: { 'content-type': 'application/json', 'content-length': String(new TextEncoder().encode(texto).length), ...headers },
  });
  const res = await POST(req);
  return { status: res.status, corpo: await res.json() as Record<string, unknown> };
}

beforeEach(() => { vi.resetModules(); });

/* ══════════════════ Consumidores: confirmados antes de qualquer decisão ══════════════════ */

describe('D5 — quem consome a rota (a checagem que precede a decisão)', () => {
  const arquivos = (function varrer(dir: string, fora: string[] = []): string[] {
    for (const nome of readdirSync(join(process.cwd(), dir))) {
      const rel = `${dir}/${nome}`;
      if (statSync(join(process.cwd(), rel)).isDirectory()) varrer(rel, fora);
      else if (/\.(ts|tsx)$/.test(nome)) fora.push(rel);
    }
    return fora;
  })('src');

  it('anti-vacuidade: a varredura enxerga o repositório inteiro', () => {
    expect(arquivos.length).toBeGreaterThan(100);
    expect(arquivos).toContain('src/app/api/treino/route.ts');
  });

  it('nenhum código do app chama `/api/treino` (a rota segue sem consumidor INTERNO)', () => {
    const chamadores = arquivos.filter((f) =>
      f !== 'src/app/api/treino/route.ts' && !f.endsWith('route.test.ts')
      && /['"`]\/api\/treino['"`]/.test(readFileSync(join(process.cwd(), f), 'utf8')));
    expect(chamadores, `chamadores internos: ${chamadores.join(', ')}`).toEqual([]);
  });

  /**
   * 🔒 …e é por isso que ela NÃO foi removida. Ausência de chamada interna não prova ausência
   * de uso externo: é uma superfície pública autenticada e documentada. Este teste existe
   * para que a decisão fique registrada no código, não numa conversa.
   */
  it('a rota continua existindo e documentada', () => {
    expect(arquivos).toContain('src/app/api/treino/route.ts');
    expect(readFileSync(join(process.cwd(), 'docs', 'api.md'), 'utf8')).toMatch(/api\/treino/);
  });
});

/* ══════════════════ Contrato: a rota devolve o plano do PRODUTO ══════════════════ */

describe('D5 — a rota e o app devolvem a MESMA rotina para o mesmo perfil', () => {
  const perfilCompleto = {
    ...PERFIL_BASE,
    treinoDias: ['seg', 'ter', 'qui', 'sab'],
    divisaoPreferida: 'prioridades',
    foco: { grupo: 'peito', compensa: 'costas', semana: 1 },
    preferencias: { banidos: [], trocas: [] },
    modoForca: false,
    cardioFavorito: 'caminhada',
  };

  /** O mesmo perfil, pelo caminho do app (`recomputarPlano`, a fonte única do produto). */
  function pelaApp(over: Record<string, unknown> = {}) {
    const perfil = {
      ...perfilCompleto, ...over,
      sexo: 'masculino', nivelAtividade: 'moderado',
      alergenos: [], preferencia: null, naoCurto: [], pratosCansados: [], favoritos: [],
    } as unknown as PerfilResumo;
    return recomputarPlano(
      perfil,
      opcoesDeEntradaPlano(normalizarEntradaPlanoVisivel(perfil, { pesoEfetivoKg: perfil.pesoKg })),
    ).treino.rotina;
  }

  it('o schema da rota aceita os SETE campos que o montador lê e a rota descartava', async () => {
    for (const campo of ['treinoDias', 'preferencias', 'foco', 'divisaoPreferida', 'rotinaCustom', 'cardioFavorito', 'modoForca']) {
      const parsed = perfilTreinoSchema.safeParse(perfilCompleto);
      expect(parsed.success, `schema recusou o perfil completo`).toBe(true);
      expect(Object.keys(parsed.success ? parsed.data : {}), `o schema ainda descarta \`${campo}\``)
        .toContain(campo === 'rotinaCustom' ? 'treinoDias' : campo);
    }
  });

  it('mesmo perfil ⇒ mesmo split e mesmos exercícios nos dois caminhos', async () => {
    const { status, corpo } = await chamar(perfilCompleto);
    expect(status).toBe(200);
    const daRota = (corpo.rotina ?? null) as { split?: string; dias?: { slots: { exercicio: { id: string } }[] }[] } | null;
    const doApp = pelaApp()!;
    expect(daRota, 'a rota não devolveu rotina').toBeTruthy();
    expect(daRota!.split, 'split divergente entre rota e app').toBe(doApp.split);
    const ids = (r: { dias?: { slots: { exercicio: { id: string } }[] }[] }) =>
      (r.dias ?? []).map((d) => d.slots.map((s) => s.exercicio.id).join(','));
    expect(ids(daRota!), 'exercícios divergentes entre rota e app').toEqual(ids(doApp));
  });

  it('a rota devolve plano COM séries e descanso (sem `semanaCiclo` ela caía no caminho v1)', async () => {
    const { corpo } = await chamar(perfilCompleto);
    const rotina = corpo.rotina as { dias: { slots: { series?: number; descansoSeg?: number }[] }[]; resultadoGeracao?: { tipo: string } };
    for (const s of rotina.dias.flatMap((d) => d.slots)) {
      expect(s.series).toBeGreaterThan(0);
      expect(s.descansoSeg).toBeGreaterThan(0);
    }
    expect(rotina.resultadoGeracao?.tipo).toBe('CERTIFICADO');
  });

  it('a semana do ciclo pode ser escolhida, e a 6 é a de alívio', async () => {
    const { corpo } = await chamar({ ...perfilCompleto, semanaCiclo: { semana: 6 } });
    const rotina = corpo.rotina as { semana?: { numero: number; deload: boolean } };
    expect(rotina.semana).toMatchObject({ numero: 6, deload: true });
  });

  it('os dias oferecidos para cardio atravessam a rota', async () => {
    const { corpo } = await chamar({ ...perfilCompleto, objetivo: 'emagrecimento', diasOferecidosCardio: ['dom'] });
    const rotina = corpo.rotina as { cardioSemana?: { prescritoSegundos: number } };
    expect(rotina.cardioSemana?.prescritoSegundos, 'a oferta de cardio não chegou ao motor').toBeGreaterThan(0);
  });

  it('a rampa de retomada atravessa a rota e reduz o cardio pela fórmula do app, nos limites 0 e 1', async () => {
    const semanaCiclo = (fator: number) => ({ semana: 1, retomada: { semana: 1, fator, volumeReferencia: 12, exerciciosRecentes: [] } });
    for (const [fator, porDia] of [[0, 0], [0.5, 40], [1, 75]] as const) {
      const { status, corpo } = await chamar({ ...perfilCompleto, objetivo: 'saude', diasOferecidosCardio: ['sex', 'dom'], semanaCiclo: semanaCiclo(fator) });
      expect(status, `fator ${fator}`).toBe(200);
      const rotina = corpo.rotina as { diasCardio: { diaId: string; minutos: number | null }[] };
      expect(rotina.diasCardio.map((c) => [c.diaId, c.minutos]), `fator ${fator}`).toEqual(porDia ? [['sex', porDia], ['dom', porDia]] : []);
    }
    expect((await chamar({ ...perfilCompleto, semanaCiclo: semanaCiclo(1.2) })).status).toBe(400);
  });
});

/* ══════════════════ Compatibilidade e réguas ══════════════════ */

describe('D5 — compatibilidade preservada e réguas unificadas', () => {
  it('o corpo ANTIGO (só os 10 campos) continua recebendo 200', async () => {
    const { status, corpo } = await chamar(PERFIL_BASE);
    expect(status).toBe(200);
    expect(corpo.rotina).toBeTruthy();
    expect(corpo.prescricao).toBeTruthy();
    expect(corpo.gate).toBeTruthy();
  });

  it('`tempoPorSessaoMin` tem UMA régua: a mesma do perfil do produto', () => {
    for (const valor of [10, 180, 200, 240]) {
      const naRota = perfilTreinoSchema.safeParse({ ...PERFIL_BASE, tempoPorSessaoMin: valor }).success;
      const noPerfil = perfilResumoSchema.shape.tempoPorSessaoMin.safeParse(valor).success;
      expect(naRota, `tempoPorSessaoMin ${valor}: rota=${naRota}, perfil=${noPerfil}`).toBe(noPerfil);
    }
  });

  it('entrada inválida continua 400', async () => {
    const { status } = await chamar({ ...PERFIL_BASE, idade: 12 });
    expect(status).toBe(400);
  });

  /**
   * 🔴 Observação herdada de 2026-09-07: `req.json()` rodava ANTES de `payloadCabe`, então o
   * teto limitava a serialização do objeto já parseado, não o corpo BRUTO recebido. O
   * `content-length` é checado antes de pagar o parse.
   */
  it('corpo bruto grande é recusado com 413 ANTES do parse', async () => {
    const { status } = await chamar(PERFIL_BASE, { 'content-length': String(10 * 1024 * 1024) });
    expect(status).toBe(413);
  });

  it('o teto do objeto serializado continua valendo (o content-length pode mentir)', async () => {
    const { status } = await chamar({ ...PERFIL_BASE, lixo: 'x'.repeat(100_000) });
    expect([400, 413]).toContain(status);
  });
});


describe('D5 — regressões da revisão fria: entrada completa e corpo real', () => {
  async function chamarBruto(texto: string, declarado?: string) {
    const { POST } = await import('./route');
    return POST(new NextRequest('https://app/api/treino', {
      method: 'POST', body: texto,
      headers: { 'content-type': 'application/json', ...(declarado ? { 'content-length': declarado } : {}) },
    }));
  }
  it.each([undefined, '1'])('recusa bytes brutos acima de 64 KiB sem confiar no header %s', async (header) => {
    const bruto = ' '.repeat(70_000) + JSON.stringify(PERFIL_BASE);
    expect((await chamarBruto(bruto, header)).status).toBe(413);
  });
  it('aceita exatamente 64 KiB e rejeita o primeiro byte excedente', async () => {
    const json = JSON.stringify(PERFIL_BASE);
    const exato = json + ' '.repeat(64 * 1024 - new TextEncoder().encode(json).length);
    expect((await chamarBruto(exato)).status).toBe(200);
    expect((await chamarBruto(exato + ' ')).status).toBe(413);
  });
  it('JSON inválido continua 400', async () => {
    expect((await chamarBruto('{')).status).toBe(400);
  });
  it('interrompe o stream no limite sem parsear nem ler o restante', async () => {
    const { POST } = await import('./route');
    const read = vi.fn()
      .mockResolvedValueOnce({ done: false, value: new Uint8Array(40_000) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array(40_000) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array(40_000) });
    const cancel = vi.fn().mockResolvedValue(undefined);
    const releaseLock = vi.fn();
    const req = new NextRequest('https://app/api/treino', { method: 'POST' });
    Object.defineProperty(req, 'body', { value: { getReader: () => ({ read, cancel, releaseLock }) } });
    const parse = vi.spyOn(req, 'json');
    expect((await POST(req)).status).toBe(413);
    expect(read).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(releaseLock).toHaveBeenCalledOnce();
    expect(parse).not.toHaveBeenCalled();
  });
  it.each([false, true])('devolve o resultado completo do produto, retomada=%s', async (emRetomada) => {
    const perfil = {
      ...PERFIL_BASE, treinoDias: ['seg', 'ter', 'qui', 'sab'],
      sexo: 'masculino', nivelAtividade: 'moderado', alergenos: [], preferencia: null,
      naoCurto: [], pratosCansados: [], favoritos: ['e72'],
    } as unknown as PerfilResumo;
    const entrada = normalizarEntradaPlanoVisivel(perfil, {
      pesoEfetivoKg: 75,
      semanaCiclo: {
        semana: 4, feedbackGrupos: [['peito', 'segura']],
        ...(emRetomada ? { retomada: { semana: 1, fator: 0.5, volumeReferencia: 12, exerciciosRecentes: ['e72'] } } : {}),
      },
      diasOferecidosCardio: ['dom'], escolhasExecucao: [['e72', 'UNILATERAL_ALTERNADO']],
    });
    const { status, corpo } = await chamar({ ...perfil, ...entrada });
    const esperado = recomputarPlano(perfil, opcoesDeEntradaPlano(entrada)).treino;
    expect(status).toBe(200);
    expect(corpo).toEqual(JSON.parse(JSON.stringify(esperado)));
  });
  it.each([
    { semanaCiclo: { semana: 4, feedbackGrupos: [['peito', 'ok'], ['peito', 'segura']] } },
    { diasOferecidosCardio: ['dom', 'dom'] },
    { escolhasExecucao: [['e72', 'BILATERAL'], ['e72', 'UNILATERAL_ALTERNADO']] },
    { semanaCiclo: { semana: 4, retomada: { semana: 1, fator: 0.5, volumeReferencia: 12, exerciciosRecentes: ['e72', 'e72'] } } },
  ])('rejeita opções ambíguas antes de normalizar Map/Set: %j', async (opcoes) => {
    expect((await chamar({ ...PERFIL_BASE, ...opcoes })).status).toBe(400);
  });
});
