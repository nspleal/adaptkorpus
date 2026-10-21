/**
 * 🔴 TODA ROTA DE ESCRITA TEM OS DOIS GUARDS (auditoria de segurança 2026-08-14).
 *
 * O defeito que isto fecha: a auditoria de 2026-07-29 pôs `barreiraDados` em `dados/*` e
 * `lgpd/*` **rota a rota**, e o `PUT /api/dados/perfil` escapou — a escrita mais cara do app
 * (upsert de `profile` + desativa `plans` + 2 inserts por save) ficou um ano sem teto porque
 * ninguém tinha uma lista para conferir. Lista manual esquece; regra global não.
 *
 * 🔒 O critério, e não os nomes: **toda rota de API que ESCREVE (POST/PUT/DELETE) declara um
 * rate limit e um teto de bytes.** As isenções são nomeadas aqui, cada uma com o motivo —
 * uma rota nova nasce coberta ou derruba o teste, e isentá-la exige escrever o porquê.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join('src', 'app', 'api');

function rotas(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...rotas(p));
    else if (nome === 'route.ts') out.push(p);
  }
  return out;
}

/** Métodos que ESCREVEM — os que justificam teto. GET fica de fora (leitura tem outro custo). */
const ESCREVE = /export\s+(?:async\s+)?function\s+(POST|PUT|DELETE|PATCH)\b/;

/**
 * Isenções NOMEADAS. Cada uma existe por um motivo estrutural, não por conveniência:
 *  · o webhook da Kiwify não tem usuário para limitar por chave, e sua barreira é a
 *    ASSINATURA HMAC + a idempotência por `event_id` — um teto por IP puniria o provedor;
 *  · `/api/suporte` é público (pré-login): limita por IP com limitador próprio, e valida
 *    tamanho pelo zod do `suporteSchema` (campos com `.max()`), não pelo teto genérico.
 */
const ISENTAS_RATE: Record<string, string> = {
  [join(RAIZ, 'webhooks', 'kiwify', 'route.ts')]: 'HMAC + idempotência; sem usuário para chavear',
};
const ISENTAS_BYTES: Record<string, string> = {
  [join(RAIZ, 'webhooks', 'kiwify', 'route.ts')]: 'corpo cru é o que a assinatura HMAC cobre',
  [join(RAIZ, 'suporte', 'route.ts')]: 'tamanho vem do zod (suporteSchema com .max por campo)',
  [join(RAIZ, 'lgpd', 'excluir', 'route.ts')]: 'corpo é só { senha }; revalidado no Auth',
  [join(RAIZ, 'dados', 'peso', 'route.ts')]: 'corpo é { pesoKg, dataISO } — ambos validados por faixa',
};

const BLOQUEADAS = ['perfil','historico','peso','aderencia'].map(p=>join(RAIZ,'dados',p,'route.ts'));
for(const f of BLOQUEADAS){
  ISENTAS_RATE[f]='writer legado desativado: apenas 426, sem DML/RPC';
  ISENTAS_BYTES[f]='não consome corpo nem executa mutação';
}
const arquivos = rotas(RAIZ);
const fonte = new Map(arquivos.map((f) => [f, readFileSync(f, 'utf8')]));
const escritoras = arquivos.filter((f) => ESCREVE.test(fonte.get(f)!));

describe('🔴 rotas de escrita: rate limit e teto de bytes', () => {
  it('há rotas de escrita para vigiar (o teste não pode passar por não achar nada)', () => {
    expect(escritoras.length).toBeGreaterThanOrEqual(8);
  });

  it('as exceções legadas não escrevem e nunca consomem o corpo',()=>{
    for(const f of BLOQUEADAS){
      const s=fonte.get(f)!;const m=s.match(/export async function (PUT|POST)/)!;
      expect(m).toBeTruthy();const writer=s.slice(m.index);
      expect(writer).toContain('status: 426');expect(writer).not.toMatch(/\.rpc\(|\.(insert|upsert|update|delete)\(|req\.json\(/);
    }
  });
  it('toda rota que escreve declara um rate limit', () => {
    const sem = escritoras
      .filter((f) => !ISENTAS_RATE[f])
      .filter((f) => !/barreiraDados\(|barreiraCompute\(|limitador\.permitir\(/.test(fonte.get(f)!));
    expect(sem, `rota de escrita sem rate limit:\n${sem.join('\n')}`).toEqual([]);
  });

  it('toda rota que escreve declara um teto de bytes', () => {
    const sem = escritoras
      .filter((f) => !ISENTAS_BYTES[f])
      .filter((f) => !/payloadCabe\(/.test(fonte.get(f)!));
    expect(sem, `rota de escrita sem teto de payload:\n${sem.join('\n')}`).toEqual([]);
  });

  /**
   * PAR DISCRIMINANTE das isenções: elas têm de continuar EXISTINDO e escrevendo. Uma
   * isenção para uma rota que sumiu é lixo que afrouxa o teste em silêncio no dia em que o
   * caminho for reaproveitado por outra coisa.
   */
  it('nenhuma isenção aponta para rota inexistente ou que não escreve', () => {
    const orfas = [...new Set([...Object.keys(ISENTAS_RATE), ...Object.keys(ISENTAS_BYTES)])]
      .filter((f) => !escritoras.includes(f));
    expect(orfas, `isenção sem rota de escrita correspondente: ${orfas.join(', ')}`).toEqual([]);
  });

  /**
   * 🔒 O par que prova que o teto é o MESMO em todo lugar: uma rota que inventasse o próprio
   * número (ex.: `body.length < 500000`) passaria no teste acima e furaria a régua comum.
   */
  it('o teto vem da régua única de validation/api (nenhuma rota inventa a sua)', () => {
    for (const f of escritoras) {
      const s = fonte.get(f)!;
      if (!/payloadCabe\(/.test(s)) continue;
      expect(s, `${f} usa payloadCabe sem importar a régua`).toMatch(/from '@\/lib\/validation\/api'/);
    }
  });
});
