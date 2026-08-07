-- 0013 — Telemetria da leva H: a escolha de ORÇAMENTO na dieta
--
-- 🔒 Migration em par com o evento (mesma razão da 0010–0012): o CHECK do `tipo` é fechado e
-- `registrarEvento` engole erro por decisão — tipo fora dele é rejeitado pelo BANCO em
-- silêncio, e o app pareceria medir sem medir.
--
-- `orcamento_escolhido` — a escolha/mudança do teto de custo. Payload = o valor escolhido
-- ('baixo' | 'medio' | 'alto' | 'nenhum'). NÃO é dado sensível de saúde: é preferência de
-- montagem, como padrão alimentar. Sem ele a adoção da feature é impossível de ler — mesma
-- lição do §14.3 (declarar a incerteza · default conservador · MEDIR · versionar).

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
    'orcamento_escolhido'
  ));
