-- 0010 — Telemetria do v3 · Bloco A: os eventos da PREFERÊNCIA
--
-- 🔒 Por que uma migration e não só código: o `tipo` de `public.eventos` tem CHECK fechado
-- (0009). Tipo novo sem esta migration é rejeitado pelo BANCO — e como a telemetria é
-- fire-and-forget e engole todo erro por decisão, a rejeição seria SILENCIOSA: o app
-- pareceria estar medindo e não estaria. É a classe do "sucesso simulado", num lugar onde
-- ninguém olharia.
--
-- 🔑 A DF travada manda a instrumentação entrar NO MESMO LOTE do bloco que ela mede: sem
-- ela o v3 nasce declarado e fica declarado para sempre (§16 da pesquisa — declarar a
-- incerteza · default conservador · racional explícito · MEDIR · versionar).
--
-- Os dois eventos, e por que ambos:
--   · `preferencia_criada`   — uso da edição manual (pedido nº 5 do beta);
--   · `preferencia_recusada` — o EVENTO ADVERSO. Sem ele mede-se só o caminho feliz, e é a
--     recusa que diz se os trilhos estão no lugar certo ou se estão atrapalhando.
--
-- Payload: só campos fechados e sem dado sensível (a denylist do app continua valendo).
-- `motivo` é o vocabulário fechado de `engine/preferencias.ts` — nunca texto livre.

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
    'preferencia_recusada'
  ));
