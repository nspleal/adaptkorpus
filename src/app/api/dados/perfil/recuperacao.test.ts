import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
vi.mock('server-only', () => ({}));

const estado = vi.hoisted(() => ({ cas: null as unknown, legado: null as unknown, erro: null as unknown, chamadas: [] as string[] }));
vi.mock('@/lib/persistencia/servidor', () => ({
  contextoUsuario: vi.fn(async () => ({ user: { id: 'conta-teste' }, supabase: {
    from: (tabela: string) => {
      estado.chamadas.push(tabela);
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({
        data: tabela === 'plano_cas' ? estado.cas : estado.legado, error: estado.erro,
      }) };
      return query;
    },
  } })),
}));
import { contextoUsuario } from '@/lib/persistencia/servidor';
import { GET } from './route';

describe('GET oferece correção sem misturar revisões ou confundir erro com ausência', () => {
  beforeEach(() => { estado.cas = null; estado.legado = null; estado.erro = null; estado.chamadas = []; });
  it('perfil CAS corrompido mantém a revisão e não lê a linha legada', async () => {
    const opcoes = { pesoEfetivoKg: 80, diasOferecidosCardio: [], semanaCiclo: { semana: 6, feedbackGrupos: [] }, escolhasExecucao: [] };
    estado.cas = { revision: 12, payload: { entrada: { perfil: { nivelExperiencia: 'invalido' }, opcoes } } };
    const r = await GET(new NextRequest('http://localhost/api/dados/perfil'));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.revision).toBe(12);
    expect(j.perfil.camposInvalidos).toContain('nivelExperiencia');
    expect(j.entradaPlano).toEqual(opcoes);
    expect(estado.chamadas).toEqual(['plano_cas']);
  });
  it('linha legada com sexo presente e preferências nulas não vira 404 nem TypeError', async () => {
    estado.legado = { sexo: 'masculino', preferencias: null };
    const r = await GET(new NextRequest('http://localhost/api/dados/perfil'));
    expect(r.status).toBe(200);
    expect((await r.json()).perfil.camposInvalidos).toContain('nivelExperiencia');
  });
  it('falha de consulta e snapshot sem opções não liberam criação de perfil novo', async () => {
    estado.erro = { message: 'indisponivel' };
    expect((await GET(new NextRequest('http://localhost/api/dados/perfil'))).status).toBe(500);
    estado.erro = null;
    estado.cas = { revision: 12, payload: { entrada: { perfil: {} } } };
    expect((await GET(new NextRequest('http://localhost/api/dados/perfil'))).status).toBe(500);
  });
  it('a barreira de autenticação continua anterior a qualquer consulta', async () => {
    vi.mocked(contextoUsuario).mockResolvedValueOnce(NextResponse.json({ error: 'sem_sessao' }, { status: 401 }));
    expect((await GET(new NextRequest('http://localhost/api/dados/perfil'))).status).toBe(401);
    expect(estado.chamadas).toEqual([]);
  });
});
