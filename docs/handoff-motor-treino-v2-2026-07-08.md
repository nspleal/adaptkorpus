# Ficha de handoff — Motor de treino v2 (mesociclo + autorregulação)

**Data:** 2026-07-08 · **Branch:** `claude/evokorpus-app-dev-9in0hs` · **Gate:** verde
(typecheck · lint · **366 testes** · build). Fonte: cofre
`wiki/outputs/handoff-motor-treino-v2-2026-07-08.md` + `parametros-motor-treino-evokorpus`
§"v2 — decisões travadas". **Esta ficha volta p/ a sessão local arquivar no cofre**
(regra de escritor único — nada foi escrito no cofre por aqui).

## O que foi implementado (blocos 1–7 do handoff)

### §1 Mesociclo + rampa de volume
- **Novo módulo puro** `src/lib/engine/treino-mesociclo.ts`: `semanaDoCiclo` (derivação
  `((⌊dias/7⌋) % 6) + 1`, wrap automático no dia 42 → semana 1, guard p/ âncora
  futura/ISO inválida), `alvoDaSemana` (piso + (semana−1)·passo, clamp no topo; passo 2
  só se banda > 4 — com a tabela 1.2 atual é sempre 1), `rirAlvoDaSemana`, `estadoDoCiclo`,
  `isoMaisDias`. Constantes em `treino-constants.ts` (`MESOCICLO_SEMANAS=6`,
  `RIR_ALVO_POR_SEMANA=[3,3,2,2,1]`, `DESCANSO_COMPOSTO_TETO_SEG=180`, `MODO_FORCA_REPS=6`).
- **Montador** (`treino-montador.ts`): novo parâmetro OPCIONAL
  `semanaCiclo?: { semana, feedbackGrupos? }` — ausente ⇒ saída **byte-idêntica à v1**
  (teste trava isso). Com semana: distribui o volume-alvo por `grupoPrimario` entre os
  slots (round-robin determinístico na ordem dia→slot), emite `SlotExercicio.series`
  clampado a `seriesPorExercicio {min..max}`; aviso honesto quando o grupo poderia cumprir
  o piso da banda mas não o alvo; grupos estruturalmente sub-banda ficam silenciosos (como
  na v1). Orçamento de tempo **estável no ciclo** (custo dimensionado p/ o pior caso da
  rampa — a rotina não encolhe no meio do ciclo). Estrutura de exercícios idêntica nas
  semanas 1–5 (só as séries mudam).
- **Estado persistido** (spec §7): `mesocicloInicio` (âncora ISO, fonte de verdade) +
  `mesocicloSemana` (espelho derivado) em `PerfilResumo` → jsonb `preferencias`
  (**sem migração SQL** — o 0005 absorve) + `perfilResumoSchema`. Round-trip testado.

### §2 Deload (dois gatilhos + loop)
- **Agendado:** semana 6 do ciclo, **universal** (decisão do autor 2026-07-08 — ver
  "Decisões" abaixo). `precisaDeload` perdeu a exceção do iniciante.
- **Reativo:** `sinaisFadigaDoHistorico` = ≥3 "difícil"/14 d (regra v1) **OU** evento
  `sinal_fadiga` ≤7 d → `estadoDoCiclo` antecipa a semana 6 **e reancora**
  (`mesocicloInicio = hoje − 35 d` ⇒ deload estável por 7 dias e semana 1 exatamente
  depois — o ciclo novo reseta o volume ao piso sem escrita adicional).
- **Corte:** mecanismo v1 intacto (−45% volume via `aplicarDeload` + metade das séries na
  sessão). A semana 6 **não** emite `series` por slot (evita corte duplo — testado).
- **Não soma:** o −10% do "difícil 2×" continua vindo só de `progredirExercicio` (um só
  caminho de redução de carga); o gatilho reativo não aplica −10% extra.

### §3 RIR descendente + autorregulação numérica
- RIR-alvo por semana: 3,3,2,2,1 (linear 3→1); semana 6 volta a 3. Pisos por cima:
  **iniciante nunca <2**, saúde nunca <2, **nunca 0** (por construção; testado).
- **Registro numérico por série**: `sets[].rir` opcional no guiado (coluna nova na tabela,
  placeholder = alvo da semana) e no manual (campo por série; o RIR por-exercício antigo
  saiu da UI mas segue **lido** p/ compat). A sessão grava `rirAlvo` (âncora da época) —
  sessões antigas caem no piso da prescrição (conservador).
- **`feedbackRefinado`** (puro, `treino.ts`): reps>topo ∧ RIR>alvo → 'facil' (+carga);
  reps<piso ∨ RIR<alvo → 'dificil'; senão mantém o qualitativo (que segue como atalho).
  Aplicado ANTES do fold em `progressoDosExercicios` — **`progredirExercicio` intocado**
  (trilhos preservados). Isométricos ficam fora (segundos, sem RIR).

### §4 Modo força (preset opt-in)
- `PerfilTreino.modoForca` → `prescreverTreino`: **só compostos** travam em 6–6 (decisão
  do autor); isolados mantêm a faixa v1; **iniciante ignora o flag** (RIR ≥2 intacto).
  Com a faixa 6–6 a maquinaria existente entrega a semântica: fácil → +carga (reset a 6),
  difícil 2× → −10% — progride só por carga, nunca <6 nem >6 (testado, incl. via
  `feedbackRefinado`: as 6 NO RIR-alvo (≥) → +carga).
- Toggle no **Editar perfil** (visível só interm./avançado; padrão visual do switch %1RM)
  + chip informativo na aba Perfil. Persistido em `preferencias.modoForca`.

### §5 Descanso do composto até ~180 s
- Regra determinística no montador: elegível quando `descansoCompostoSeg.max ≥ 120`
  (na prática: massa) **ou** modo força; adota `{min, 180}` **só se não reduz** o nº de
  exercícios que o descanso base comportaria (tempo é o limitante; cobertura > descanso).
  Sai em `rotina.semana.descansoCompostoSeg`; o Painel injeta na prescrição efetiva da
  sessão (timer usa o ponto médio — ex.: massa/90 min → 135 s). Isolado 60–90 inalterado.

### §6 UX (5 elementos novos) — smoke visual feito (Playwright, modo mock)
1. **RIR numérico por série** no guiado e no manual (não aparece p/ isométricos).
2. **Contador** "Semana X/6 do ciclo" (pill no card "Treino de hoje").
3. **Banner de deload** = `AvisoAlivio` reusado (verde/neon, sem vermelho); copy agora
   fecha com "na próxima semana começa um ciclo novo".
4. **Botão de fadiga** "Estou exausto / muito dolorido" no card Hoje (some quando o alívio
   já está ativo) → modal de confirmação acolhedor (sem vermelho; aponta o fluxo "Senti
   dor" p/ dor localizada) → `registrarSinalFadiga()` → alívio imediato + reancora.
5. **Toggle modo força** no Editar perfil + chip na aba Perfil.
- **Feedback agregado por grupo**: `feedbackAgregadoPorGrupo` (adaptador) — grupo com
  ≥2 "difícil" ≤7 d → `'segura'` → o montador usa o alvo da semana ANTERIOR p/ esse grupo.

### §7 Schema / dados
- `logs`/rotas/API: **zero mudança** — `sets[].rir`, `rirAlvo` e o evento `sinal_fadiga`
  (SessaoHistorico `tipo:'sinal_fadiga'`, padrão da calibração) viajam no payload jsonb
  opaco pelo funil existente (`aplicarNovoHistorico` → `enviarSessaoTreino`). O sinal de
  fadiga **não conta** como dia de treino (`sessoesTreino` filtra qualquer `tipo`).
- Perfil: 3 chaves novas no jsonb `preferencias` (0005) + `perfilResumoSchema`. Sem SQL.

## Decisões tomadas nesta sessão (p/ o autor validar/arquivar como DF)

1. **Mesociclo universal (confirmada com o autor 2026-07-08):** iniciante também faz ramp
   e deloada na semana 6 — substitui o "iniciante só reativo" do v1 (os 2 testes v1 desse
   comportamento foram atualizados p/ a regra v2; os guarda-rails de segurança — piso 6,
   RIR, falha, gate — seguem todos verdes e intocados).
2. **Modo força só compostos (confirmada com o autor):** isolados mantêm a faixa v1
   (6RM em isolado destoa da postura conservadora). Peso corporal fora (sem carga).
3. **Toggle no Editar perfil (confirmada com o autor)** + chip na aba Perfil.
4. **Interpretações minhas (não estavam na DF — validar):**
   - **Elegibilidade do 180 s:** base ≥120 s (massa) OU modo força; saúde/emagrec. 60–90
     não sobem (destoaria do objetivo). Regra "cabe no tempo" = não reduzir o nº de
     exercícios do plano base.
   - **Agregação por grupo:** ≥2 "difícil" no grupo em **7 dias** → 'segura' (alvo da
     semana anterior). **Sem memória**: segurar 2 semanas seguidas ainda rasteja +1/sem
     (extensão futura anotada no código).
   - **Sinal de fadiga expira em 7 dias** (= duração da semana de alívio).
   - **Âncora inicial = hoje** (todo mundo entra no v2 na semana 1), não a 1ª sessão do
     histórico como o deload v1 — contas existentes começam ciclo novo no 1º boot.
   - **RIR-alvo discreto** [3,3,2,2,1] p/ o "linear 3→1" da DF.
   - **Precedência do merge de séries** na sessão: `max(rampa, progressão, mínimo)` — a
     progressão +1 série do peso corporal pode passar à frente da rampa.

## Limites honestos (anotar no cofre)

- **Topo da banda nem sempre é atingível**: o teto estrutural = slots/grupo/semana ×
  séries máx. Avançado/massa (topo 20) precisaria de ≥5 slots/grupo/semana — os splits
  atuais dão no máx. 4 → o grupo pina em 16 (sem aviso quando já cumpre o piso da banda;
  aviso honesto quando nem o alvo intermediário cabe). Interm./massa atinge o topo (16).
  Se o beta reclamar, é o gatilho da tabela MEV/MAV/MRV condicional.
- O recompute da rampa roda no mount / mudança de semana / edição de perfil — o feedback
  agregado usa o histórico LOCAL do momento (sessões só-servidor entram no próximo boot).
- Deload continua **um por vez**: reativo durante a semana 6 não estende o alívio.

## Testes (§9 do handoff — cobertura)

- `treino-mesociclo.test.ts` (16): semanaDoCiclo (0/6/7/35/41/42 d, wrap, futuro,
  inválida) · rampa 16→20 e clamp · banda larga passo 2 · 'segura' · RIR 3→1 c/ pisos ·
  estadoDoCiclo (reancora hoje−35, +7 d → semana 1, universal, wrap).
- `treino-montador.test.ts` (+10): aceitação piso→topo (total = min(alvo, teto) exato,
  monotônico, nunca > topo) · topo atingido (interm./massa peito=16) · séries ∈ [min,max]
  · sem. 6 sem `series` · compat byte-idêntica sem semana · invariantes v1 em sem. 1–6 ·
  estrutura estável · 180 s (90 min sim / 30 min não / saúde nunca) · smoke 3×3×6.
- `treino.test.ts` (+7): deload universal · modo força (6–6, isolados intactos, iniciante
  ignora, progride só por carga, −10% mantém 6) · feedbackRefinado (regras, fallback,
  modo força ≥).
- `treino-progressao.test.ts` (+9): refinamento no fold (+carga por 13 reps/RIR 3;
  'dificil' por RIR<alvo; retrocompat sem RIR) · sinal_fadiga (7 d, fora de
  sessoesTreino) · ≥3 difícil · agregação por grupo (2×/7 d, janela, eventos fora).
- `perfil-profile.test.ts` (+1): round-trip dos 3 campos v2 no jsonb.
- **Guarda-rails v1 todos verdes** (piso 6/5, RIR mín, semFalhaIniciante, gate,
  edge-corpus, invariantes do montador, favoritos byte-idêntico).

## Verificação ao vivo (Playwright, dev em modo mock)

✅ contador "Semana 1/6" · ✅ coluna RIR no guiado (placeholder = alvo) e no manual ·
✅ chip "RIR alvo: 3" + copy "Alvo desta semana do ciclo" · ✅ descanso 135 s (teto 180
ativo) · ✅ botão de fadiga → modal acolhedor → alívio IMEDIATO (semana 6/6 + badge) +
`mesocicloInicio = hoje−35 d` persistido + evento `sinal_fadiga` no histórico ·
✅ toggle só interm./avançado, persiste, chip no Perfil, compostos travam "N × 6 reps".

## Checklist de teste manual (autor, na Vercel)

1. Conta existente: 1º boot pós-deploy → "Semana 1/6" aparece e persiste entre devices.
2. Guiado: registrar RIR por série; reps acima do topo + RIR alto → próxima sessão sugere
   +carga; RIR abaixo do alvo → segura.
3. Botão de fadiga → banner de alívio na hora; 7 dias depois → "Semana 1/6" e volume no piso.
4. Modo força (interm./avançado): compostos a 6 reps; iniciante não vê o toggle.
5. Sessão com 90 min/massa → timer de descanso ~135 s no composto.
