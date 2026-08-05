-- 0012 — Telemetria do v3 · Bloco C: as TÉCNICAS AVANÇADAS
--
-- 🔒 Migration em par com o evento (mesma razão da 0010/0011): o CHECK do `tipo` é fechado e
-- `registrarEvento` engole erro por decisão — tipo fora dele é rejeitado pelo BANCO em
-- silêncio, e o app pareceria medir sem medir.
--
-- Os três, e por que estes três:
--   · `tecnica_elegivel` — o portão ABRIU para a pessoa (≥ 6 sessões + nível). Mede quantos
--     chegam lá, que é o denominador honesto de qualquer taxa de adoção;
--   · `tecnica_ativada`  — a escolha na sessão. Sem ela não se sabe se quem PODE, usa;
--   · `tecnica_feedback` — o esforço relatado na série com técnica. 🔑 É o EVENTO ADVERSO
--     desta feature: as técnicas foram reabertas por RECONHECIMENTO, não por eficácia, e o
--     que precisa ser vigiado é se elas estão custando caro demais em esforço percebido.

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
    'tecnica_feedback'
  ));
