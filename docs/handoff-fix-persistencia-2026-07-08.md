# Ficha de handoff — Fix BLOQUEADOR: persistência resetava a cada visita + avatar

**Data:** 2026-07-08 · **Branch:** `claude/evokorpus-app-dev-9in0hs` (junto do motor v2 —
promover à `main` juntos) · **Gate:** verde (typecheck · lint · **376 testes** · build) +
smoke Playwright (registrar treino/peso → reload → persiste). Relatório de origem no cofre:
`wiki/outputs/bug-persistencia-e-avatar-2026-07-08.md`. **Esta ficha volta p/ a sessão
local arquivar** (nada foi escrito no cofre por aqui).

## Diagnóstico (análise estática — respostas ao checklist do relatório)

O bug era a **combinação de 4 furos**; qualquer 401/erro intermitente no write-through
virava perda PERMANENTE e a hidratação seguinte APAGAVA a cópia local:

1. **(check #3 — SIM)** Hidratação destrutiva do histórico: `Painel.tsx` fazia
   `if (doServidor) substituirHistorico(doServidor)` — um **200 com `{sessoes: []}` é
   truthy** e gravava `'[]'` em `evk_treinos`, **destruindo o histórico local**. Só falha
   de rede (null) era segura.
2. Write-through **fire-and-forget sem retry**: `enviarSessaoTreino`/`registrarPesoServidor`/
   `salvarAderenciaDia` descartavam o `false`. Fonte provável do 401 intermitente: corrida
   de rotação do refresh-token (o middleware chama `getUser()` em TODA request, incluindo
   `/api/dados/*`, e o boot dispara várias em paralelo — a 1ª rotaciona o cookie, as demais
   chegam com token consumido).
3. **Pesos eram SÓ memória** (`useState([perfil.pesoKg])`) — sem localStorage; qualquer
   falha de write = reset no reload.
4. **Só o profile se auto-curava** (boot re-subia o local quando o servidor devolvia
   vazio/falha) — por isso a ficha persistia e mascarava o resto. E esse trecho tinha bug
   próprio: re-subia o perfil local **também em falha de chamada** (podia regredir o
   perfil do servidor com cache velho de outro device).

**(check #2)** O boot do `/app` espera acesso+perfil antes de montar o Painel (ok); o que
NÃO esperava era o **avatar**: `auth.getUser()` é chamada de **REDE** ao servidor Auth e
corria com a rotação do token → inicial vazia intermitente. **(check #4 — confirmado)** o
fix `97a6746` não fechava por essa mesma corrida; e o avatar do **/conta era um literal
`'L'` hardcoded** (nunca ligado ao nome — o "L" que o autor viu).

**Descartados com evidência:** service worker (`sw.js` só intercepta GET estático/navegação
— nunca `/api`/POST/Supabase); RLS (políticas select/insert de `logs`/`plans` simétricas
`auth.uid() = user_id`; `beta_liberado()` só nas tabelas de CONTEÚDO — 0008); redirect do
middleware p/ APIs (devolve 401 JSON, não 3xx→HTML); VigiaSessao (refs em memória, não
expira no mount, e não limpa `evk_treinos`); rate-limit (não cobre `/api/dados`); mismatch
write/read (mesma tabela/filtro).

**(check #1 — p/ o autor conferir no Supabase, SQL Editor):**
```sql
-- como o usuário afetado (ou trocando auth.uid() pelo id da conta):
select tipo, count(*) from public.logs group by tipo;          -- treino/peso/refeicao subiram?
select count(*) from public.plans;                              -- snapshots de plano
select id, email, preferencias->>'mesocicloSemana' from public.profile;
```
Daqui não há acesso ao banco (egress bloqueado). O fix é **robusto aos dois cenários**
(writes que nunca subiram OU leitura vazia): a reconciliação re-sobe o que só existe local.

## O que mudou (tudo camada client/persistência — zero SQL)

1. **Reconciliação do histórico** — `reconciliarHistorico(locais, doServidor)` (pura,
   `treino-historico.ts`): chave `dataISO|n|tipo`; servidor vence nas chaves compartilhadas;
   sessões só-locais sobrevivem na união e **re-sobem** (`enviarSessaoTreino` de cada — a
   re-migração É o retry, paridade com o self-heal do profile). Servidor `[]` **nunca mais
   apaga** o local. (`Painel.tsx` usa na hidratação.)
2. **Pesos com cópia local** — chave nova **`evk_pesos`** (`lerPesos`/`registrarPesoLocal`/
   `substituirPesos`); registrar grava local primeiro; hidratação: servidor não-vazio vence
   e renova o cache; servidor vazio + local não-vazio → re-sobe cada peso; falha → local
   fica. `limparDadosLocais` inclui a chave (LGPD).
3. **Aderência: re-migração** — o merge já era não-destrutivo; agora dias que só existem no
   local (últimos 30 dias) re-sobem via `salvarAderenciaDia`.
4. **`sync.ts`: retry único em 401** (~600 ms) em TODAS as leituras/escritas — fecha a
   janela da rotação do refresh-token; 401 persistente segue seguro (null/false).
5. **Boot do perfil tri-estado** — `carregarPerfilServidor()` devolve
   `perfil | 'sem_perfil' | null`; **só `'sem_perfil'` (404) migra o local p/ cima**; falha
   de chamada monta do local SEM subir (não regride mais o perfil do servidor).
6. **Avatar sem corrida** — Painel e /conta leem **`getSession()` primeiro** (sessão local,
   sem rede; uso só de EXIBIÇÃO da inicial — nenhuma decisão de segurança), `getUser()` só
   como fallback; o literal `'L'` do /conta virou `inicialDe(nome, email)` (no mock a
   inicial continua 'L' via placeholder "Lucas Almeida").

## Testes (376 verdes; 10 novos)

- `treino-historico.test.ts`: reconciliação — **cenário exato do bug** (servidor `[]` +
  3 locais → nada apagado, 3 re-uploads); servidor vence em chave compartilhada; tipos de
  evento na chave; determinismo; helpers `evk_pesos` (round-trip, corrompido → []).
- `sync.test.ts` (novo, fetch stubado + fake timers): 401→retry→200 sucede (leitura E
  escrita); 401 persistente → null/false com exatamente 1 retry; perfil tri-estado
  (200/404-sem_perfil/500/rede); modo mock é no-op sem tocar o fetch.
- Smoke Playwright (mock): registrar treino + peso → **reload → tudo persiste** ✅.

## Limites honestos

- Se o dado local JÁ foi apagado por visitas anteriores ao fix, não há o que recuperar do
  device; o que estiver no banco volta a aparecer (a leitura agora nunca destrói).
- Duplicata teórica de PESO: se um GET devolver `[]` com linhas existentes no banco (não
  deveria — falha vira `null`), o re-upload duplicaria valores; aceito e documentado
  (pesos não têm chave natural no payload).
- A causa raiz dos 401 (rotação concorrente do refresh-token) foi MITIGADA (retry +
  getSession no avatar + reconciliação como retry de escrita), não eliminada — eliminar
  exigiria repensar o refresh no middleware (ex.: pular `/api/*`), o que mexe no padrão
  @supabase/ssr auditado da leva 3; fica anotado como melhoria futura se o beta ainda
  mostrar 401 residual (os fixes tornam qualquer 401 inofensivo).

## Checklist de teste ao vivo (autor, Vercel)

1. Logar → gerar plano → registrar treino + peso + refeição → **fechar e reabrir**: tudo
   permanece (era o repro do bug).
2. Mesma conta em OUTRO device: histórico/pesos/aderência aparecem (agora que os writes
   sobem e/ou re-migram).
3. Supabase Table Editor: linhas em `logs` (tipos treino/peso/refeicao) crescem a cada
   registro; refresh da página NÃO zera nada.
4. Avatar: inicial correta estável no /app e no /conta (adeus "L"/círculo vazio).
5. Promover `main` = v2 (mesociclo) + este fix, juntos.
