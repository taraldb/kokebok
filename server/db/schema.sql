CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  label TEXT, description TEXT, category TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  meta TEXT NOT NULL DEFAULT '[]',
  servings_base INTEGER, servings_unit TEXT,
  servings_step INTEGER NOT NULL DEFAULT 1,
  servings_min  INTEGER NOT NULL DEFAULT 1,
  tips TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ingredients (
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  id        TEXT NOT NULL,
  position  INTEGER NOT NULL,
  name      TEXT NOT NULL, amount REAL, unit TEXT, description TEXT,
  PRIMARY KEY (recipe_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON ingredients(recipe_id, position);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  timer_seconds INTEGER NOT NULL DEFAULT 0,
  content_doc TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_steps_recipe ON steps(recipe_id, position);

CREATE TABLE IF NOT EXISTS meta_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
