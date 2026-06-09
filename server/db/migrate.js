const fs = require('fs');
const path = require('path');
const { getDb } = require('./index');

function migrate() {
  const db = getDb();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
  migrateIngredientsCompositePk(db);
  migrateIngredientsAddDescription(db);
  migrateActiveTime(db);
  migrateIngredientsAddType(db);
}

function migrateIngredientsAddDescription(db) {
  const cols = db.prepare(`PRAGMA table_info(ingredients)`).all();
  if (cols.some(c => c.name === 'description')) return;
  db.exec(`ALTER TABLE ingredients ADD COLUMN description TEXT`);
  console.log('Added description column to ingredients');
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

function migrateActiveTime(db) {
  const cols = db.prepare(`PRAGMA table_info(recipes)`).all();
  if (!cols.some(c => c.name === 'active_time')) {
    db.exec(`ALTER TABLE recipes ADD COLUMN active_time INTEGER`);
    console.log('Added active_time column to recipes');
  }
  // Move "Aktiv tid" meta entries into the dedicated column for existing rows
  const rows = db.prepare(`SELECT id, meta, active_time FROM recipes`).all();
  const updateStmt = db.prepare(`UPDATE recipes SET active_time = ?, meta = ? WHERE id = ?`);
  let migrated = 0;
  for (const row of rows) {
    if (row.active_time != null) continue;
    const meta = JSON.parse(row.meta || '[]');
    const idx = meta.findIndex(m => m.label?.toLowerCase() === 'aktiv tid');
    if (idx === -1) continue;
    const numMatch = String(meta[idx].value ?? '').match(/\d+/);
    const activeTime = numMatch ? parseInt(numMatch[0], 10) : null;
    if (!activeTime) continue;
    meta.splice(idx, 1);
    updateStmt.run(activeTime, JSON.stringify(meta), row.id);
    migrated++;
  }
  if (migrated > 0) console.log(`Migrated active_time for ${migrated} recipes`);
}

function migrateIngredientsAddType(db) {
  const cols = db.prepare(`PRAGMA table_info(ingredients)`).all();
  if (cols.some(c => c.name === 'type')) return;
  db.exec(`ALTER TABLE ingredients ADD COLUMN type TEXT NOT NULL DEFAULT 'ingredient'`);
  console.log('Added type column to ingredients');
}

module.exports = { migrate };
