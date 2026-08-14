# Handoff — Schema de persistência do perfil (migration 0005 + mapeador), sem externo

> ⚠️ **ARQUIVO HISTÓRICO.** A fonte de verdade de produto, decisões, números e marca é o
> **cofre** (repo `obsidian`) — ver `CLAUDE.md`. Este documento registra o estado de um
> momento do projeto e **não é atualizado**: onde ele divergir do cofre, o cofre vence.

Data: 2026-07-05 · Branch: `claude/evokorpus-app-dev-9in0hs` · **Nada no cofre.**

Realiza as 2 decisões de engenharia que o autor travou (as lacunas de schema achadas ao mapear a
persistência). Só a parte **local** — a aplicação da migration e a persistência real ficam para a leva
com o Supabase provisionado.

## O que entrou
1. **Migration `supabase/migrations/0005_profile_email_preferencias.sql`** (aditiva, idempotente):
   - `profile.email text` + índice único **parcial** e case-insensitive
     (`profile_email_unique on (lower(email)) where email is not null`) — o espelho e-mail→user_id do
     webhook Kiwify e da allowlist do beta.
   - `profile.preferencias jsonb not null default '{}'` — os **9 campos do perfil sem coluna própria**
     (`nivelExperiencia, equipamento, equipamentosCasa, treinoDias, diasDisponiveis, tempoPorSessaoMin,
     naoCurto, favoritos, pratosCansados`), no padrão de `plans.payload` (evita migration por campo).
   - RLS: **sem policy nova** — as colunas herdam as policies row-level de `profile` (`auth.uid()=id`);
     o webhook lê por e-mail via **admin client** (bypassa RLS).
2. **Mapeador puro `src/lib/persistencia/perfil-profile.ts`** — o seam determinístico que a persistência
   real (server client + RLS) vai chamar: `perfilParaLinha(perfil): ProfileRow` e `linhaParaPerfil(row)`,
   empacotando/desempacotando o jsonb + colunas planas. Sem I/O, só `import type` (não acopla
   componente/motor). Um **bug foi pego pelo round-trip test** durante a implementação: o inverso não
   reconstruía `flagsSaude` das 5 colunas planas — corrigido.

## Verificação (sem Supabase)
- `typecheck` ✔ · `lint` ✔ · `test` **303 verdes** (+4) · `build` ✔. Os 299 anteriores seguem verdes.
- `perfil-profile.test.ts`: round-trip fiel (`linhaParaPerfil(perfilParaLinha(p)) === p`); os 9 campos
  vivem **dentro** de `preferencias` (não vazam como coluna de topo); colunas planas certas
  (`pesoKg↔peso_kg`, 5 flags, `preferencia` null); opcionais ausentes sobrevivem.
- **A migration NÃO foi aplicada** (não há Supabase aqui) — revisão de SQL apenas; a aplicação (em ordem,
  após 0001–0004, ver `supabase/README.md`) fica com o autor no projeto vivo.

## Contrato p/ a próxima leva (persistência real)
- `perfilParaLinha` cobre só o subconjunto do `PerfilResumo`. O chamador **mescla à parte**:
  `id` (= `auth.users.id`), `email`, `aceite_18/termos/lgpd/aceite_em` (vêm do signup/onboarding, não do
  PerfilResumo), e deixa `created_at/updated_at` para o DB.
- Persistir com o **server client (RLS)**, nunca o admin. Ler de volta com `linhaParaPerfil`.

## Notas / ainda bloqueado no provisionamento
- **Ordem de eventos do webhook:** `profile.email` é gravado no onboarding; se um pagamento chegar ANTES
  do onboarding, o lookup por `profile.email` falha → `resolverUserId` (`kiwify/route.ts:137`) deve ter
  **fallback para `auth.users`** (via admin) na leva do webhook. Não bloqueia o beta (grátis/sem Kiwify).
- Segue bloqueado no Supabase/Resend: aplicar a migration, auth real, persistência, allowlist, LGPD
  delete real, timeouts (ver `docs/handoff-hardening-pre-auth-2026-07-05.md` para o mapa de fiação).
