const fs = require('fs');
const path = require('path');
const { getDb } = require('./index');

function migrate() {
  const db = getDb();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
  migrateIngredientsCompositePk(db);
}

// Migrate ingredients from global id PK to composite (recipe_id, id) PK.
// SQLite doesn't support ALTER PRIMARY KEY, so we do rename/copy/drop.
function migrateIngredientsCompositePk(db) {
  const row = db.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='ingredients'`
  ).get();
  if (!row || !row.sql.includes('id TEXT PRIMARY KEY')) return;

  db.transaction(() => {
    db.exec(`
      CREATE TABLE ingredients_v2 (
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        id        TEXT NOT NULL,
        position  INTEGER NOT NULL,
        name      TEXT NOT NULL, amount REAL, unit TEXT,
        PRIMARY KEY (recipe_id, id)
      );
      INSERT INTO ingredients_v2 SELECT recipe_id, id, position, name, amount, unit FROM ingredients;
      DROP TABLE ingredients;
      ALTER TABLE ingredients_v2 RENAME TO ingredients;
      CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON ingredients(recipe_id, position);
    `);
  })();
  console.log('Migrated ingredients table to composite primary key (recipe_id, id)');
}

module.exports = { migrate };
