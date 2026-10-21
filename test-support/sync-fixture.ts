import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import type { PerfilResumo } from '../src/components/painel/Painel';

export const CONTA_A = '11111111-1111-4111-8111-111111111111';
export const CONTA_B = '22222222-2222-4222-8222-222222222222';
export const PERFIL_FIXTURE: PerfilResumo = {
  sexo: 'masculino', idade: 30, alturaCm: 180, pesoKg: 80, objetivo: 'massa',
  nivelAtividade: 'moderado', nivelExperiencia: 'intermediario', equipamento: 'academia',
  preferencia: null, alergenos: [], diasDisponiveis: 3, tempoPorSessaoMin: 60,
  treinoDias: ['seg','qua','sex'], naoCurto: [], favoritos: [], pratosCansados: [],
  flagsSaude: { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false },
};
export async function abrirBancoSync() {
  const db = new PGlite();
  await db.exec(readFileSync('supabase/tests/_prelude_auth_stub.sql','utf8'));
  // Defaults do Supabase, apenas no banco sintético; as migrations reais fazem seus REVOKEs.
  await db.exec(`alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated,service_role;
    grant usage on schema public to authenticated,anon,service_role;
    insert into auth.users(id) values ('${CONTA_A}'),('${CONTA_B}');`);
  for (const f of readdirSync('supabase/migrations').sort()) {
    if (!f.endsWith('.sql') || f.startsWith('0003_')) continue;
    await db.exec(readFileSync(`supabase/migrations/${f}`,'utf8').replace('create extension if not exists "pgcrypto";', '-- gen_random_uuid nativo no Postgres local'));
  }
  await db.exec(`insert into public.allowlist(email) values ('${CONTA_A}@example.invalid'),('${CONTA_B}@example.invalid');
    alter table public.realtime_test_outbox add column seq bigserial;`);
  return db;
}

type Linha = Record<string, unknown>;
/** Adaptador PostgREST exclusivo dos testes: executa SQL parametrizado e RLS reais.
 * Não substitui a verificação do serviço gerenciado Supabase nem de JWTs reais. */
export class ClienteFixture {
  constructor(readonly db: PGlite, readonly subject: string, readonly admin = false) {}
  auth = {
    getUser: async () => {
      const r = await this.db.query('select id from auth.users where id=$1',[this.subject]);
      return r.rows.length ? { data: { user: { id: this.subject, email: `${this.subject}@example.invalid` } }, error: null }
        : { data: { user: null }, error: { status: 401 } };
    },
  };
  async executar(sql: string, valores: unknown[] = []) {
    return this.db.transaction(async (tx) => {
      if (!this.admin) {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.email',$2,true)",[this.subject,`${this.subject}@example.invalid`]);
        await tx.exec('set local role authenticated');
      } else await tx.exec('set local role service_role');
      return tx.query<Linha>(sql,valores);
    });
  }
  from(tabela: string) { return new ConsultaFixture(this,tabela); }
  async rpc(nome: string, args: Record<string, unknown>) {
    try {
      if (!/^[a-z0-9_]+$/.test(nome)) throw new Error('funcao_invalida');
      const valores = Object.values(args).map((v) => v && typeof v === 'object' ? JSON.stringify(v) : v);
      const params = Object.keys(args).map((k,i) => `${identificador(k)} => $${i+1}`).join(',');
      const r = await this.executar(`select public.${identificador(nome)}(${params}) r`,valores);
      return { data: r.rows[0]?.r ?? null, error: null, status: 200 };
    } catch { return { data: null, error: { message: 'falha_fixture' }, status: 500 }; }
  }
}
function identificador(s: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('identificador_invalido');
  return `"${s}"`;
}
let maxLinhasFixture = 1000;
export function limitarLinhasFixture(n: number) { maxLinhasFixture = n; }
class ConsultaFixture implements PromiseLike<{ data: Linha[] | null; error: null | { message: string } }> {
  private colunas = '*'; private filtros: string[] = []; private valores: unknown[] = [];
  private ordem: string[] = []; private teto = 1000;
  constructor(private cliente: ClienteFixture, private tabela: string) {}
  select(colunas: string) { this.colunas = colunas === '*' ? '*' : colunas.split(',').map((c) => identificador(c.trim())).join(','); return this; }
  eq(c: string, v: unknown) { this.valores.push(v); this.filtros.push(`${identificador(c)}=$${this.valores.length}`); return this; }
  lte(c: string, v: unknown) { this.valores.push(v); this.filtros.push(`${identificador(c)}<=$${this.valores.length}`); return this; }
  order(c: string, op: { ascending: boolean }) { this.ordem.push(`${identificador(c)} ${op.ascending ? 'asc' : 'desc'}`); return this; }
  limit(n: number) { this.teto = n; return this; }
  or(filtro: string) {
    const m = /^created_at.gt.([^,]+),and\(created_at.eq.([^,]+),id.gt.([0-9a-f-]+)\)$/.exec(filtro);
    if (!m) throw new Error('cursor_fixture_invalido');
    const n = this.valores.length; this.valores.push(m[1],m[2],m[3]);
    this.filtros.push(`(created_at>$${n+1} or (created_at=$${n+2} and id>$${n+3}))`); return this;
  }
  async insert(valor: Linha) {
    const keys = Object.keys(valor), values = Object.values(valor).map((v) => v && typeof v === 'object' ? JSON.stringify(v) : v);
    try { await this.cliente.executar(`insert into public.${identificador(this.tabela)}(${keys.map(identificador).join(',')}) values(${keys.map((_,i)=>`$${i+1}`).join(',')})`,values); return { data: null, error: null }; }
    catch { return { data: null, error: { message: 'falha_fixture' } }; }
  }
  async executar() {
    try {
      const temCriado = ['profile','plans','logs','feedback','eventos'].includes(this.tabela);
      const colunas = this.colunas === '*' ? `*${temCriado ? ',created_at::text as created_at' : ''}` : this.colunas.replace('"created_at"','created_at::text as created_at');
      const sql = `select ${colunas} from public.${identificador(this.tabela)} t${this.filtros.length ? ` where ${this.filtros.join(' and ')}` : ''}${this.ordem.length ? ` order by ${this.ordem.map((o)=>`t.${o}`).join(',')}` : ''} limit ${Math.max(1,Math.min(this.teto,maxLinhasFixture))}`;
      const r = await this.cliente.executar(sql,this.valores);
      for (const linha of r.rows) if (typeof linha.created_at === 'string') linha.created_at = linha.created_at.replace(' ','T').replace(/\+00$/,'Z');
      return { data: r.rows, error: null };
    } catch { return { data: null, error: { message: 'falha_fixture' } }; }
  }
  async maybeSingle() { const r = await this.executar(); return { data: r.data?.[0] ?? null, error: r.error }; }
  then<A = { data: Linha[] | null; error: null | { message: string } }, B = never>(resolve?: ((v: { data: Linha[] | null; error: null | { message: string } }) => A | PromiseLike<A>) | null, reject?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> { return this.executar().then(resolve,reject); }
}
