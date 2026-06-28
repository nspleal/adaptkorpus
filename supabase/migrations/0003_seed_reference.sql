-- ============================================================================
-- App Evokorpus — Seed de REFERÊNCIA (subconjunto representativo)
-- ----------------------------------------------------------------------------
-- ⚠️ Este é um seed PEQUENO só para o app rodar de ponta a ponta em dev.
-- A base completa (163 exercícios · 125 alimentos TACO · 56 pratos, validada Δ=0)
-- está nos .xlsx do autor e será importada num passo próprio (ver supabase/README.md).
-- Valores de alimentos: aproximações TACO por 100 g.
-- ============================================================================

-- ---------- Alimentos --------------------------------------------------------
insert into public.foods (id, nome, fonte_taco, grupo, kcal_por_100g, proteina_por_100g, carboidrato_por_100g, gordura_por_100g, alergenos) values
  ('arroz',  'Arroz branco cozido', 1, 'grao_cereal_tuberculo', 128, 2.5, 28.0, 0.2, '{}'),
  ('feijao', 'Feijão carioca cozido', 2, 'leguminosa_proteina_vegetal', 76, 4.8, 13.6, 0.5, '{}'),
  ('frango', 'Frango grelhado (peito)', 3, 'proteina_animal', 159, 32.0, 0.0, 2.5, '{origem_animal}'),
  ('ovo',    'Ovo de galinha cozido', 4, 'proteina_animal', 146, 13.0, 0.6, 9.5, '{origem_animal,ovo}'),
  ('banana', 'Banana prata', 5, 'fruta', 92, 1.4, 23.0, 0.1, '{}'),
  ('aveia',  'Aveia em flocos', 6, 'grao_cereal_tuberculo', 394, 14.0, 67.0, 8.0, '{gluten}'),
  ('tofu',   'Tofu', 7, 'leguminosa_proteina_vegetal', 64, 6.6, 2.0, 4.0, '{soja}'),
  ('batata', 'Batata cozida', 8, 'grao_cereal_tuberculo', 86, 1.7, 20.0, 0.1, '{}')
on conflict (id) do nothing;

-- ---------- Pratos -----------------------------------------------------------
insert into public.recipes (id, nome, refeicao, tipo, contem_alergenos) values
  ('cafe_aveia_banana', 'Aveia com banana', 'cafe', 'vegano', '{gluten}'),
  ('cafe_ovos',         'Ovos cozidos',     'cafe', 'vegetariano', '{origem_animal,ovo}'),
  ('almoco_tofu_arroz', 'Tofu com arroz',   'almoco', 'vegano', '{soja}'),
  ('almoco_frango',     'Frango, arroz e feijão', 'almoco', 'onivoro', '{origem_animal}'),
  ('jantar_feijao_arroz','Feijão com arroz', 'jantar', 'vegano', '{}'),
  ('jantar_frango',     'Frango com batata', 'jantar', 'onivoro', '{origem_animal}'),
  ('lanche_banana',     'Banana',           'lanche', 'vegano', '{}')
on conflict (id) do nothing;

-- ---------- Itens dos pratos (join) -----------------------------------------
insert into public.recipe_items (recipe_id, alimento_id, gramas) values
  ('cafe_aveia_banana', 'aveia', 40),  ('cafe_aveia_banana', 'banana', 100),
  ('cafe_ovos', 'ovo', 100),
  ('almoco_tofu_arroz', 'tofu', 200), ('almoco_tofu_arroz', 'arroz', 150),
  ('almoco_frango', 'frango', 150), ('almoco_frango', 'arroz', 150), ('almoco_frango', 'feijao', 100),
  ('jantar_feijao_arroz', 'feijao', 150), ('jantar_feijao_arroz', 'arroz', 150),
  ('jantar_frango', 'frango', 120), ('jantar_frango', 'batata', 200),
  ('lanche_banana', 'banana', 120)
on conflict (recipe_id, alimento_id) do nothing;

-- ---------- Exercícios (amostra) --------------------------------------------
insert into public.exercises (id, nome_pt, nome_en, grupo_muscular, padrao_movimento, nivel, tipo, equipamento, local, tier, como_fazer) values
  ('flexao', 'Flexão de braço', 'Push-up', 'peito', 'empurrar', 'iniciante', 'forca_hipertrofia', 'nenhum', 'casa_sem', 1,
   'Mãos no chão na largura dos ombros, corpo reto. Desça controlando até o peito perto do chão e empurre. Dica: mantenha o core firme, sem afundar o quadril.'),
  ('agachamento_livre', 'Agachamento livre', 'Bodyweight squat', 'quadriceps', 'agachar', 'iniciante', 'forca_hipertrofia', 'nenhum', 'casa_sem', 1,
   'Pés na largura dos ombros, desça empurrando o quadril para trás até as coxas paralelas ao chão. Dica: joelhos alinhados com os pés, sem desabar para dentro.'),
  ('remada_halter', 'Remada unilateral com halter', 'One-arm dumbbell row', 'costas', 'puxar', 'iniciante', 'forca_hipertrofia', 'casa', 'casa_com', 2,
   'Apoie um joelho e a mão no banco, puxe o halter em direção ao quadril. Dica: não rode o tronco; o movimento vem das costas.'),
  ('supino_barra', 'Supino reto com barra', 'Barbell bench press', 'peito', 'empurrar', 'intermediario', 'forca_hipertrofia', 'academia', 'academia', 1,
   'Deitado no banco, desça a barra até o peito e empurre. Dica: escápulas retraídas e pés firmes no chão; use segurança/spotter.'),
  ('prancha', 'Prancha isométrica', 'Plank', 'core', 'core', 'iniciante', 'forca_hipertrofia', 'nenhum', 'casa_sem', 1,
   'Apoie antebraços e pontas dos pés, corpo reto da cabeça aos calcanhares. Dica: contraia abdômen e glúteos; não eleve o quadril.'),
  ('corrida', 'Corrida / caminhada rápida', 'Running', 'cardio', 'cardio', 'iniciante', 'cardio', 'nenhum', 'casa_sem', 1,
   'Mantenha um ritmo em que consiga respirar com algum esforço. Dica: comece com intervalos de caminhada/corrida se for iniciante.')
on conflict (id) do nothing;
