/** @typedef {import('../types').Recipe} Recipe */

const { getDb } = require('./index');

function parseRecipeRow(row) {
  return {
    ...row,
    tags: JSON.parse(row.tags),
    meta: JSON.parse(row.meta),
    tips: JSON.parse(row.tips),
  };
}

/**
 * @returns {{id:string,title:string,description:string,category:string,tags:string[]}[]}
 */
function listRecipes() {
  const db = getDb();
  return db.prepare(
    `SELECT id, title, description, category, tags FROM recipes ORDER BY title COLLATE NOCASE`
  ).all().map(r => ({ ...r, tags: JSON.parse(r.tags) }));
}

/**
 * @param {string} id
 * @returns {Recipe|null}
 */
function getRecipe(id) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(id);
  if (!row) return null;
  const recipe = parseRecipeRow(row);
  recipe.ingredients = db.prepare(
    `SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY position`
  ).all(id);
  recipe.steps = db.prepare(
    `SELECT * FROM steps WHERE recipe_id = ? ORDER BY position`
  ).all(id).map(s => ({ ...s, content_doc: JSON.parse(s.content_doc) }));
  return recipe;
}

/**
 * Diff-upserts a recipe, ingredients, and steps. Transactional.
 * @param {Recipe} r
 */
function upsertRecipe(r) {
  const db = getDb();
  const now = Date.now();

  db.transaction(() => {
    const existing = db.prepare(`SELECT id FROM recipes WHERE id = ?`).get(r.id);
    const created_at = existing ? db.prepare(`SELECT created_at FROM recipes WHERE id = ?`).get(r.id).created_at : now;

    db.prepare(`
      INSERT INTO recipes (id,title,label,description,category,tags,meta,servings_base,servings_unit,servings_step,servings_min,tips,created_at,updated_at)
      VALUES (@id,@title,@label,@description,@category,@tags,@meta,@servings_base,@servings_unit,@servings_step,@servings_min,@tips,@created_at,@updated_at)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, label=excluded.label, description=excluded.description,
        category=excluded.category, tags=excluded.tags, meta=excluded.meta,
        servings_base=excluded.servings_base, servings_unit=excluded.servings_unit,
        servings_step=excluded.servings_step, servings_min=excluded.servings_min,
        tips=excluded.tips, updated_at=excluded.updated_at
    `).run({
      ...r,
      tags: JSON.stringify(r.tags ?? []),
      meta: JSON.stringify(r.meta ?? []),
      tips: JSON.stringify(r.tips ?? []),
      created_at,
      updated_at: now,
    });

    const incomingIngIds = new Set((r.ingredients || []).map(i => i.id));
    const existingIngIds = new Set(
      db.prepare(`SELECT id FROM ingredients WHERE recipe_id = ?`).all(r.id).map(i => i.id)
    );
    const deleteIng = db.prepare(`DELETE FROM ingredients WHERE recipe_id = ? AND id = ?`);
    for (const id of existingIngIds) {
      if (!incomingIngIds.has(id)) deleteIng.run(r.id, id);
    }
    for (const ing of r.ingredients || []) {
      db.prepare(`
        INSERT INTO ingredients (recipe_id,id,position,name,amount,unit,description)
        VALUES (@recipe_id,@id,@position,@name,@amount,@unit,@description)
        ON CONFLICT(recipe_id,id) DO UPDATE SET
          position=excluded.position, name=excluded.name,
          amount=excluded.amount, unit=excluded.unit, description=excluded.description
      `).run({ ...ing, recipe_id: r.id });
    }

    const incomingStepIds = new Set((r.steps || []).map(s => s.id));
    const existingStepIds = new Set(
      db.prepare(`SELECT id FROM steps WHERE recipe_id = ?`).all(r.id).map(s => s.id)
    );
    for (const id of existingStepIds) {
      if (!incomingStepIds.has(id)) db.prepare(`DELETE FROM steps WHERE id = ?`).run(id);
    }
    for (const step of r.steps || []) {
      db.prepare(`
        INSERT INTO steps (id,recipe_id,position,title,timer_seconds,content_doc)
        VALUES (@id,@recipe_id,@position,@title,@timer_seconds,@content_doc)
        ON CONFLICT(id) DO UPDATE SET
          position=excluded.position, title=excluded.title,
          timer_seconds=excluded.timer_seconds, content_doc=excluded.content_doc
      `).run({
        ...step,
        recipe_id: r.id,
        content_doc: typeof step.content_doc === 'string'
          ? step.content_doc
          : JSON.stringify(step.content_doc),
      });
    }
  })();
}

/**
 * @param {string} id
 */
function deleteRecipe(id) {
  getDb().prepare(`DELETE FROM recipes WHERE id = ?`).run(id);
}

/** @returns {string|null} */
function getTemplateHash() {
  const row = getDb().prepare(`SELECT value FROM meta_kv WHERE key = 'template_hash'`).get();
  return row ? row.value : null;
}

/** @param {string} hash */
function setTemplateHash(hash) {
  getDb().prepare(
    `INSERT INTO meta_kv (key,value) VALUES ('template_hash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  ).run(hash);
}

module.exports = { listRecipes, getRecipe, upsertRecipe, deleteRecipe, getTemplateHash, setTemplateHash };
