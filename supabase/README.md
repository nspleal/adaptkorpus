# Supabase — schema, RLS e dados

## Migrations (aplicar em ordem)

1. `migrations/0001_init.sql` — tabelas (conteúdo curado + usuário + assinatura).
2. `migrations/0002_rls.sql` — **Row Level Security** em todas as tabelas (default-deny).
3. `migrations/0003_seed_reference.sql` — **base completa** (125 alimentos · 56 pratos ·
   216 ingredientes · 163 exercícios), gerada do xlsx do autor e validada **Δ≈0**.
4. `migrations/0004_webhook_idempotency.sql` — `webhook_events` (anti-replay).

### Opção A — SQL Editor (mais simples)
Cole o conteúdo de cada arquivo, em ordem, no SQL Editor do projeto Supabase e rode.

### Opção B — Supabase CLI
```bash
supabase link --project-ref SEU_REF
supabase db push          # aplica as migrations da pasta migrations/
```

## Verificar o RLS

No SQL Editor:
```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public';
```
Todas as tabelas do app devem ter `rowsecurity = true`. Sem política que case, o acesso é
negado — isso é proposital.

## Base completa de conteúdo (já importada)

A base curada e validada **já está no repo** — tanto como seed SQL (`0003`) quanto como
módulos TypeScript (`src/lib/data/{foods,recipes,exercises}.ts`, usados pelo app/motor):

- **125 alimentos** (TACO 4ª ed.) + **56 pratos** + join de **216 linhas**, validados **Δ≈0**.
- **163 exercícios** com os atributos do motor (padrão de movimento, nível, tipo, local).

Foi gerada a partir dos `.xlsx` do autor. A verificação Δ recomputa cada prato a partir dos
ingredientes (paleta × gramas) e compara aos totais declarados — resultado: **0 divergências**
de macros (Δkcal ≤ 1 por arredondamento), **0 referências inválidas**, contagens batem. A
mesma checagem roda nos testes (`src/lib/data/data.test.ts`).

> Para **atualizar** a base (novo xlsx): reprocessar as planilhas e regerar tanto os `.ts`
> quanto o `0003`. Os dois devem sair da mesma fonte para não divergirem.

## Atenção de licença (conteúdo)

A **TACO** exige **atribuição** para uso comercial (não é base "aberta") — confirmar no
jurídico antes do lançamento (ver cofre: `tabela-taco`).
