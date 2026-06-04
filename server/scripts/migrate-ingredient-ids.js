/**
 * Migrate ingredient IDs from nanoid random strings to name-based slugs.
 * Also updates all ingredientRef nodes in step content_doc JSON.
 */
const Database = require('better-sqlite3')
const path = require('path')
const { uniqueSlug } = require('../lib/slugify')

const DB_PATH = path.join(__dirname, '../../data/kokebok.db')
const db = new Database(DB_PATH)

function walkDoc(node, visitor) {
  visitor(node)
  if (node.content) node.content.forEach(child => walkDoc(child, visitor))
}

const recipes = db.prepare('SELECT id FROM recipes').all()
let totalRenamed = 0

db.transaction(() => {
  for (const { id: recipeId } of recipes) {
    const ings = db.prepare(
      'SELECT id, name FROM ingredients WHERE recipe_id = ? ORDER BY position'
    ).all(recipeId)

    // Build remap: old nanoid id → new slug
    const taken = new Set()
    const remap = new Map()

    for (const ing of ings) {
      // Already a slug? (no uppercase, no underscore, reasonable length)
      const alreadySlug = /^[a-z0-9-]+$/.test(ing.id)
      if (alreadySlug) {
        taken.add(ing.id)
        continue
      }
      const slug = uniqueSlug(ing.name, taken)
      taken.add(slug)
      remap.set(ing.id, slug)
    }

    if (remap.size === 0) continue

    console.log(`Recipe "${recipeId}": renaming ${remap.size} ingredient IDs`)
    remap.forEach((slug, oldId) => console.log(`  ${oldId} → ${slug}`))

    // Update ingredients table
    const updateIng = db.prepare(
      'UPDATE ingredients SET id = ? WHERE recipe_id = ? AND id = ?'
    )
    remap.forEach((slug, oldId) => updateIng.run(slug, recipeId, oldId))

    // Update ingredientRef nodes in all steps of this recipe
    const steps = db.prepare(
      'SELECT id, content_doc FROM steps WHERE recipe_id = ?'
    ).all(recipeId)

    const updateStep = db.prepare('UPDATE steps SET content_doc = ? WHERE id = ?')

    for (const step of steps) {
      let doc
      try { doc = JSON.parse(step.content_doc) } catch { continue }

      let changed = false
      walkDoc(doc, node => {
        if (node.type === 'ingredientRef' && node.attrs?.ingredientId) {
          const newId = remap.get(node.attrs.ingredientId)
          if (newId) { node.attrs.ingredientId = newId; changed = true }
        }
      })

      if (changed) updateStep.run(JSON.stringify(doc), step.id)
    }

    totalRenamed += remap.size
  }
})()

console.log(`\nDone. ${totalRenamed} ingredient IDs migrated.`)
db.close()
