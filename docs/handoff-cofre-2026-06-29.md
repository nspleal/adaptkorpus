---
title: "App Evokorpus — estado de desenvolvimento e correções (2026-06-29)"
type: concept
lang: pt
tags: [fitness, produto, app, motor]
created: 2026-06-29
updated: 2026-06-29
sources: [parametros-motor-dieta-evokorpus, parametros-motor-treino-evokorpus, parametros-motor-substituicao-evokorpus, gate-de-saude-evokorpus, banco-alimentos-evokorpus, ranking-exercicios-evokorpus]
status: active
---

# App Evokorpus — estado de desenvolvimento e correções

> **Origem:** gerado pela sessão de desenvolvimento do **código** (repo `evokorpus`, branch
> `claude/evokorpus-app-dev-9in0hs`) para você integrar ao cofre. Esta sessão **lê** o cofre
> mas **não escreve** nele (regra de escritor único). Todos os números travados aqui vêm das
> specs do cofre citadas no frontmatter; o que for **default de implementação** (não decisão da
> spec) está marcado como tal.

## 1. Resumo executivo

O app Evokorpus tem hoje um **motor determinístico completo e testado** (gate de saúde → dieta →
montagem de cardápio com escala de porções; treino FITT → montagem de rotina; substituição F.2
de prato e exercício), uma **camada de API** rudimentar sobre esse motor, uma **demo web** para
testar tudo, e a **base de segurança/LGPD** (RLS, validação na borda, segredos server-only, CSP
com nonce). Os dados reais já estão embutidos: **125 alimentos, 56 pratos, 163 exercícios**.
Cobertura de testes: **90 testes, 10 arquivos, 100% verdes** (inclui corpus de bordas com 2700
casos). Nada de IA em runtime; tudo é fórmula + dado curado, auditável.

A correção mais recente (e a que destrava o uso real) foi a **escala de porções no montador** +
**equivalência calórica na troca de prato** — sem ela, o cardápio de exemplo não alcançava a
janela calórica e nenhuma troca de prato "fechava".

---

## 2. Stack e princípios

**Stack:** Next.js 15 (App Router, TypeScript), Tailwind, Vitest, zod, Supabase
(Postgres + Auth + RLS), Kiwify (webhook de compra), PWA, build `standalone`.

**Princípios inegociáveis honrados** (derivam do enquadramento legal):
1. **Nada de IA em runtime** — motor é fórmula pura + dado curado; a copy nunca diz "IA".
2. **18+** — validado na borda (`idade ≥ 18` → 400) e no perfil.
3. **Sem promessa de resultado** — linguagem de processo/jornada.
4. **Fora do território clínico** — flag de saúde → `ROTEAR` (não gera plano; orienta profissional).
5. **LGPD desde o início** — RLS em toda tabela, minimização, consentimento, segredos fora do repo.
6. **Determinismo auditável** — mesma entrada → mesma saída (testado com corpus de bordas).

---

## 3. Dados curados (embutidos no app)

| Conjunto | Qtde | Fonte | Observações |
|---|---|---|---|
| Alimentos | **125** | TACO ([[banco-alimentos-evokorpus]]) | kcal/macros por 100 g; alérgenos por item |
| Pratos (receitas) | **56** | banco de pratos | itens = `{alimentoId, gramas}`; kcal/macros = Σ TACO×gramas (Δ=0) |
| Exercícios | **163** | [[ranking-exercicios-evokorpus]] | atributos abaixo |

**Atributos dos exercícios (A1):** padrão de movimento (Empurrar 21 / Puxar 17 / Agachar 21 /
Dobradiça 16 / Core 18 / Cardio 14 / Isolado 56) · dificuldade (Iniciante 109 / Intermediário 41
/ Avançado 13) · tipo (Força-Hipertrofia 147 / Cardio 13 / Pliométrico 3) · local (casa-sem 49 /
casa-com 53 / academia 61) · tier de familiaridade (T1 30 / T2 40 / T3 45 / T4 48).

> **Pendência conhecida (do cofre):** grupo leguminosa/proteína vegetal tem só 8 itens → menus
> veganos saem **colados no piso de proteína**. Não bloqueia a dieta onívora normal.

---

## 4. O motor determinístico (`src/lib/engine`)

Pipeline: **gate de saúde → (se libera) dieta → montagem de cardápio**; e **gate → treino FITT →
montagem de rotina**. Substituição F.2 roda sobre planos já gerados.

### 4.1 Gate de saúde ([[gate-de-saude-evokorpus]])
Precedência **ROTEAR > RESTRINGIR > PISAR > PERMITIR**.
- Qualquer flag de PAR-Q verdadeira (gestação/amamentação, renal, cardíaca, lesão, diabetes) → **ROTEAR** (não gera plano).
- IMC < 16 → **ROTEAR**; IMC < 18,5 → aviso universal; baixo peso fora do corte → **RESTRINGIR** (objetivo efetivo vira `saude`).
- **PISAR** quando o alvo cairia abaixo do piso calórico de segurança.
- O treino herda o mesmo gate (sem `PISAR` — esse é só da dieta).

### 4.2 Dieta — alvo e macros ([[parametros-motor-dieta-evokorpus]])
- **TMB** Mifflin-St Jeor → **GET** = TMB × **PAL** (sedentário 1,2 · leve 1,375 · moderado 1,55 · intenso 1,725 · muito intenso 1,9).
- **Ponto** = GET × **fator do objetivo**: emagrecimento **0,825** (déficit 17,5%) · massa **1,125** (superávit 12,5%) · saúde **1,0**.
- **Piso de segurança:** feminino **1250** / masculino **1550** kcal (chão duro).
- **Proteína (g/kg):** corte/ganho ponto **1,8** / piso **1,6**; manutenção ponto **1,4** / piso **1,2**.
- **Gordura:** 0,8 g/kg, **clampada a 20–30%** das kcal-alvo.
- **4/4/9** só para alocar a meta — **nunca** para medir alimento (a TACO mede).

### 4.3 Montador de cardápio — **com escala de porções** (Bloco B)
Monta 1 prato por refeição (café/almoço/jantar obrigatórios; lanche opcional), pratos distintos.
- **Filtros:** alérgeno = **absoluto** (nunca relaxa, nem que isso impeça fechar a janela); identidade vegano/veg = absoluta por default; gosto = relaxável por último.
- **Janela do objetivo:** déficit `[0,80–0,85]×GET` · superávit `[1,10–1,15]×GET` · manutenção `±5%` · PISAR `[piso, min(GET, piso×1,05)]`.
- **ESCALA (Passo 3 — "combinar/escalar pratos"):** uma **escala única do dia** multiplica as gramas dos pratos para **mira a kcal-alvo** (kcal = alvo mais protegido); proteína do ponto→piso é secundária. Cada item do cardápio carrega `escala` e `macros` (= base × escala).
- **Limite de escala:** `ESCALA_PORCAO = 0,5×–3,0×` — **default de implementação, NÃO número travado da spec** (o cofre manda escalar mas não fixa o limite). Revisável; tende a encolher conforme o banco cresce. **→ candidato a decisão no cofre.**
- **Desempate determinístico:** menor desvio calórico → proteína → chave final lexicográfica sobre o conjunto de ids.
- **Status:** `ok` / `fora_da_janela` (banco não fecha mesmo escalando) / `sem_candidatos`.

### 4.4 Treino — FITT ([[parametros-motor-treino-evokorpus]])
Prescrição por objetivo × nível, com trilhos de segurança:
- **Reps/RIR/descanso por objetivo** (saúde, massa, emagrecimento) — tabela FITT_OBJETIVO.
- **Volume e frequência por nível** (iniciante 2–3 sessões; intermediário 3–4; avançado 4–6); volume/grupo modulado pelo objetivo.
- **Trilhos:** faixas com carga começam em **6 reps** (nunca cruzam 5); **RIR mínimo global 1**, **iniciante nunca < 2** (não treina até a falha); **≥ 2×/grupo/semana** (1× só com 1 dia disponível).
- **Progressão:** dupla progressão guiada por feedback (fácil → +2,5% isolado / +2,5–5% composto inferior; 2× "difícil" → −~10%).
- **Deload:** a cada **6 semanas** (interm./avançado; iniciante reativo), −~45% de volume.
- **Dificuldade liberada por nível** (escada da biblioteca).

### 4.5 Montador de rotina
Alocador semanal que garante: fundamentos presentes, **core 2–3×/semana**, **puxar ≥ empurrar**, dobradiça incluída; split conforme dias disponíveis e tempo por sessão.

### 4.6 Substituição F.2 ([[parametros-motor-substituicao-evokorpus]])
**Prato (mesmo slot):**
- Filtros DUROS: alérgeno · identidade · slot · **janela de kcal do dia** · **piso de proteína do dia** (nunca relaxados).
- **Equivalência calórica (NOVO):** o prato novo é **escalado** para igualar as kcal do prato trocado (spec: "mínimo = equivalência calórica"), dentro de `ESCALA_PORCAO` → o dia inteiro permanece na janela. Retorna `escala` + `macrosNovo`.
- Ordenação: menor desvio kcal → proteína → tipo → carbo/gordura → id. Gosto cede por último; senão **sinaliza** (mantém o prato).

**Exercício:**
- Filtros DUROS: equipamento/local · tipo compatível (pliométrico→força do mesmo padrão se não houver pliométrico elegível) · dificuldade ≤ liberada pelo nível.
- Preserva grupo muscular → padrão. Desempate: mesma dificuldade → **mais familiar (tier T1)** → id.
- **Não** auto-substitui por dor/lesão (isso é pausa + aviso no fluxo de treino). Caso "skater #151" tratado (cruza tipo dentro do padrão Cardio).

---

## 5. Superfícies de backend (API rudimentar)

Rotas finas: validam entrada com **zod** na borda → chamam o motor puro com a base curada →
devolvem JSON. `runtime = 'nodejs'`. Contrato documentado em `docs/api.md`.

| Método | Rota | Função |
|---|---|---|
| POST | `/api/dieta` | gate → alvo → macros → cardápio (`{gate, plano, cardapio}`) |
| POST | `/api/treino` | gate → prescrição FITT → rotina (`{gate, prescricao, rotina}`) |
| POST | `/api/substituir/prato` | troca prato (recomputa o plano do perfil; escala à equivalência calórica) |
| POST | `/api/substituir/exercicio` | troca exercício |
| GET | `/api/catalogo/alimentos` | 125 alimentos |
| GET | `/api/catalogo/exercicios` | 163 exercícios |
| GET | `/api/catalogo/pratos` | 56 pratos com macros computadas |
| POST | `/api/webhooks/kiwify` | webhook de compra (idempotente) |

Postura fail-safe preservada: gate `ROTEAR` → plano/prescrição `null`; substituição sem
candidato → `sinalizado`; 18+ barrado na borda (400). **Sem auth ainda** (Fase 1).

---

## 6. Frontend de demonstração (`/onboarding`)

Demo local (cálculo no dispositivo, motor determinístico) para **testar tudo**:
- Coleta perfil + triagem PAR-Q + dados de treino (nível, equipamento, dias, tempo).
- **Abas Dieta / Treino.**
- Dieta: cardápio com kcal/proteína e **fator de porção** por item; botão **Trocar** por prato.
- Treino: prescrição + rotina; botão **Trocar** por exercício.
- Trata `ROTEAR` (procure profissional) e `sinalizado`.
- `/plano` e `/conta` são placeholders (exigirão login/assinatura na Fase 1).

---

## 7. Segurança & LGPD (concreto) — `docs/security-lgpd.md`

- **RLS** em toda tabela (default-deny); migrações `supabase/migrations/0001–0004`.
- **`service_role`** do Supabase é **server-only** (`import 'server-only'`), nunca vai ao browser.
- **Validação na borda** (zod) antes de tocar motor/banco; **18+** e consentimentos obrigatórios.
- **CSP com nonce por requisição** via middleware + `force-dynamic` (resolve a tela em branco).
- Segredos **nunca** no repo (`.env*` ignorado; `.env.example` documenta as chaves).
- Webhook Kiwify **idempotente** (migração 0004).

---

## 8. Infraestrutura / distribuição

- **Build `standalone`** (Next) — roda sem instalar dependências no destino.
- **Pacote portátil Windows** via GitHub Actions (`.github/workflows/portable-windows.yml`) +
  `packaging/portable-launcher.bat`: embute Node + build → Release (padrão PIRAXIS, zero-install
  para o usuário final).
- Lançadores de desenvolvimento (`[DEV] iniciar …`) separados do pacote portátil.

---

## 9. Histórico de correções (tudo o que foi consertado)

**Segurança / build**
- vitest com vulnerabilidades → atualizado para `^3.2.6`.
- `server-only` instalado (protege a `service_role`).
- Estreitamento de tipos no onboarding (zod `safeParse`) corrigido.
- `setAll` do Supabase tipado (sem `any` implícito).
- Lançador do pacote saía em `build/` (ignorado pelo git) → movido para `packaging/`.

**Tela em branco (verde)**
- CSP estrita `script-src 'self'` bloqueava os scripts do Next → **nonce por requisição** no
  middleware + `force-dynamic` no layout. Reproduzido e confirmado com Playwright (hidratou,
  "1856 kcal/dia", zero erros de console).

**Motor de treino (achados da error-hunt cold-pass)**
- Corte de dobradiça e `puxar < empurrar` em sessões curtas → **alocador semanal** principiado.
- **Core 2–3×/semana** não garantido → core adicionado aos templates PUSH/PULL + reestruturação.
- Degradação do pliométrico "skater #151" → último recurso cruza tipo dentro do padrão.

**A falha que você relatou ("só vem a dieta; a aba de modificações não faz nada")**
- **Causa 1 — fiação da UI:** a tela `/onboarding` só chamava `gerarDieta`. Treino e substituição
  existiam no motor/API mas **nenhuma tela os usava**. → Liguei treino + substituição com abas e
  botões "Trocar" (commit `dc3207d`). Troca de exercício verificada de ponta a ponta.
- **Causa 2 — dados/porção (com prova):** com **porções fixas**, o cardápio somava no máximo
  **1680 kcal**, abaixo do piso da janela (**1800**) de uma mulher moderada → **0 combinações**
  na janela → toda troca de prato caía em `sinalizado` (corretamente, por spec). **Não era falta
  de pratos** — era porção pequena e não escalável.
  → Implementei a **escala de porções** (montador) + **equivalência calórica** (troca), ambas já
  previstas no cofre (commit `82b17b1`).

---

## 10. Verificação (metodologia error-hunt + números)

Cada motor seguiu: **build → corpus determinístico → cold-pass adversarial → correção**, com
postura de falsificação e "achado só com prova".

- **90 testes / 10 arquivos / 100% verdes**, incluindo corpus de bordas da dieta (**2700 casos**)
  e do treino. Invariantes do corpus intactos após a escala.
- **Sweep da escala:** **54/54** perfis normais e **18/18** veganos agora fecham `ok` (antes,
  **todos** `fora_da_janela`).
- **E2E no navegador (Playwright):** as 4 refeições trocam de prato; dia = **1856 kcal** (dentro
  da janela); troca de exercício funciona; **zero erros** de console.
- `typecheck` + `lint` + `build` verdes.

---

## 11. Decisões que voltam para você arquivar no cofre

1. **Limite de escala de porção `ESCALA_PORCAO = 0,5×–3,0×`** — default de implementação (o cofre
   manda escalar, não fixa o limite). Decidir se é o intervalo desejado ou se quer porções mais
   conservadoras. Vale virar parâmetro travado em [[parametros-motor-dieta-evokorpus]].
2. **Escala de dia única vs. por prato** — hoje a escala é **uma só para o dia** (simples,
   determinística). Refinamento futuro: escala por prato (afina a proteína ao ponto). Decisão de
   produto/algoritmo.
3. **Banco vegano/vegetariano** — você já sinalizou que vai expandir alimentos; o cofre já anota a
   pendência da proteína vegetal (8 itens). Prioridade para destravar otimização vegana.
4. **Equivalência calórica na troca** — implementada conforme "mínimo = equivalência calórica";
   confirmar que é o comportamento desejado (vs. exigir também proximidade de macros).

---

## 12. Estado atual — o que funciona / o que falta

**Funciona hoje (testado):**
- Gate de saúde, dieta (alvo + macros), cardápio **dentro da janela** (com escala).
- Treino FITT + rotina semanal.
- Substituição de prato (fecha) e de exercício.
- API rudimentar de tudo isso; demo web com abas e trocas.
- Base de segurança/LGPD e distribuição portátil.

**Falta (próximas fases):**
- **Fase 1:** Supabase Auth + provisionamento + gating de rotas + persistência (perfil/planos com
  RLS) + exportação/exclusão de dados (LGPD); resolver `user_id` no webhook Kiwify.
- Refino do montador (escala por prato; relaxamento de proteína até o piso com largura total).
- Expansão do banco de alimentos (variedade + proteína vegana).
- **Revisão jurídica** (gate de lançamento), marca (INPI), domínios.
- Atribuição de licença da **TACO**.

---

## 13. Mapa de arquivos (orientação)

```
src/lib/engine/      gate, dieta, montador (escala), treino (FITT), montador de rotina, substituição F.2
src/lib/data/        foods (125), recipes (56), exercises (163), seed, nutrition (Σ TACO)
src/lib/validation/  schemas zod (perfil, treino, substituição) — defesa na borda
src/app/api/         dieta, treino, substituir/{prato,exercicio}, catalogo/*, webhooks/kiwify
src/app/onboarding/  demo (abas Dieta/Treino + trocas)
src/middleware.ts    CSP nonce + sessão Supabase
supabase/migrations/ 0001 init · 0002 RLS · 0003 seed · 0004 idempotência webhook
docs/                api.md, architecture.md, security-lgpd.md, roadmap.md, access.md, este handoff
```

## 14. Commits desta rodada (branch `claude/evokorpus-app-dev-9in0hs`)

- `82b17b1` — escala de porções no montador + equivalência calórica na troca (Bloco B).
- `dc3207d` — liga treino + substituição na demo (abas Dieta/Treino, botões Trocar).
- `c57ad70` — superfícies HTTP rudimentares sobre o motor (dieta, treino, F.2, catálogos).
- `8f3728a` — substituição: degradação do pliométrico (caso skater).
- (anteriores) — motor de treino, montador de treino (core 2–3×), motor de substituição F.2.

---
*Documento de handoff código→cofre. A fonte de verdade dos números é o cofre; este arquivo
espelha o que o código implementa em 2026-06-29 e marca os pontos que pedem decisão sua.*
