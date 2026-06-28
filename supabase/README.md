# Supabase — schema, RLS e dados

## Migrations (aplicar em ordem)

1. `migrations/0001_init.sql` — tabelas (conteúdo curado + usuário + assinatura).
2. `migrations/0002_rls.sql` — **Row Level Security** em todas as tabelas (default-deny).
3. `migrations/0003_seed_reference.sql` — **seed de referência** (subconjunto p/ demo).

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

## Importar a base completa de conteúdo

O seed `0003` é um **subconjunto** (8 alimentos, 7 pratos, 6 exercícios) só para o app
rodar de ponta a ponta. A base curada e validada (no cofre) é maior:

- **125 alimentos** (TACO 4ª ed.) + **56 pratos** + join de **216 linhas**, validados Δ=0 —
  `fontes/banco-alimentos-evokorpus`.
- **163 exercícios** com os atributos do motor — `fontes/ranking-exercicios-evokorpus`.

Os arquivos-fonte são `.xlsx` (no Desktop do autor). Passo de import (a fazer):

1. Exportar cada aba para **CSV** com colunas no formato das tabelas (`foods`, `recipes`,
   `recipe_items`, `exercises`).
2. Importar no Supabase (Table editor → Import CSV, ou `\copy` via psql), respeitando a
   ordem: `foods` e `exercises` primeiro, depois `recipes`, por fim `recipe_items`.
3. Conferir contagens e rodar uma checagem de integridade (todo `recipe_items.alimento_id`
   existe em `foods`; soma de kcal do prato = soma dos itens — a regra Δ=0 do cofre).

> Quando o formato dos CSVs estiver definido, dá para gerar um script de import determinístico
> + uma verificação automática (mesma filosofia da validação Δ=0).

## Atenção de licença (conteúdo)

A **TACO** exige **atribuição** para uso comercial (não é base "aberta") — confirmar no
jurídico antes do lançamento (ver cofre: `tabela-taco`).
