-- 0011 — Telemetria do v3 · Bloco B: o FOCO por grupo
--
-- 🔒 Migration em par com o evento, pela mesma razão da 0010: o `tipo` de `public.eventos`
-- tem CHECK fechado, e `registrarEvento` engole todo erro por decisão — tipo fora do CHECK
-- seria rejeitado pelo BANCO em SILÊNCIO, e o app pareceria medir sem medir.
--
-- Os dois eventos do bloco, e por que ambos:
--   · `foco_ativado`   — uso do pedido nº 4 do beta, com o que o foco de fato entregou
--     (`entrega`: 'volume' quando havia folga até o MRV · 'ordem' quando não havia). É esse
--     campo que diz se o teto duro está mordendo na população real ou só na teoria;
--   · `foco_encerrado` — o fim da janela de 4–6 semanas. Sem ele não se mede DURAÇÃO, e a
--     janela declarada nunca vira evidência.

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
    'foco_encerrado'
  ));
