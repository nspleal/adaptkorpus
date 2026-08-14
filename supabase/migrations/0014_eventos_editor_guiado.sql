-- 0014 — Telemetria do EDITOR GUIADO (handoff-editor-guiado-2026-08-13)
--
-- 🔒 Migration em par com os eventos (mesma razão da 0010–0013): o CHECK do `tipo` é
-- fechado e `registrarEvento` engole erro por decisão — tipo fora dele é rejeitado pelo
-- BANCO em silêncio, e o app pareceria medir sem medir.
--
-- ⚠️ ESCRITA, NÃO APLICADA. O rito é do autor: aplicar → conferir → promover.
--
-- Os três, e o que cada um responde:
--
--  · `editor_aberto` — quantos CHEGAM ao editor (o denominador honesto de qualquer adoção
--    da feature). Payload: `origem` ('plano' | 'vazio') — de onde a pessoa começou a montar.
--
--  · `treino_custom_salvo` — quantos SALVAM, e o tamanho do que montaram. Payload:
--    `dias` (nº de dias com exercício) · `exercicios` (total de slots) · `avisos_ativos`
--    (quantos avisos vermelhos estavam na tela no momento de salvar). 🔑 O último é o campo
--    que dá sentido aos outros dois: sem ele não dá para distinguir "montou bem" de "montou
--    contra todos os avisos", e a DF① (avisos não travam) fica sem evidência de efeito.
--
--  · `aviso_risco_mostrado` — quais riscos aparecem na população real. Payload: `codigo`
--    (vocabulário FECHADO de `engine/critico.ts`: dias_consecutivos · acima_do_maximo ·
--    sessao_longa · puxar_menor_que_empurrar) · `contexto` ('editor' | 'plano').
--
-- 🔒 Nada de saúde, nada de texto livre, nada de nome de exercício — só contagens e o
-- vocabulário fechado do crítico. Passa na DENYLIST varrida pelo guard que falha o build.

alter table public.eventos
  drop constraint if exists eventos_tipo_check;

alter table public.eventos
  add constraint eventos_tipo_check check (tipo in (
    'app_aberto',
    'plano_gerado',
    'sessao_iniciada',
    'sessao_concluida',
    'exercicio_substituido',
    'refeicao_marcada',
    'cardio_registrado',
    -- v3 · Bloco A (2026-08-04)
    'preferencia_criada',
    'preferencia_recusada',
    -- v3 · Bloco B (2026-08-05)
    'foco_ativado',
    'foco_encerrado',
    -- v3 · Bloco C (2026-08-05)
    'tecnica_elegivel',
    'tecnica_ativada',
    'tecnica_feedback',
    -- Leva H · orçamento (2026-08-06)
    'orcamento_escolhido',
    -- Editor guiado (2026-08-13)
    'editor_aberto',
    'treino_custom_salvo',
    'aviso_risco_mostrado'
  ));
