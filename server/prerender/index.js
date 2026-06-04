const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getRecipe, listRecipes } = require('../db/recipes');
const { renderRecipePage } = require('./template');
const { renderIndexPage } = require('./index-template');
const { PUBLIC_DIR } = require('../config');

const R_DIR = path.join(PUBLIC_DIR, 'r');

function ensureRDir() {
  if (!fs.existsSync(R_DIR)) fs.mkdirSync(R_DIR, { recursive: true });
}

function atomicWrite(filePath, content) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

/**
 * Prerender a single recipe to public/r/<id>.html
 * @param {string} id
 */
function prerenderRecipe(id) {
  const r = getRecipe(id);
  if (!r) throw new Error(`Recipe not found: ${id}`);
  ensureRDir();
  const html = renderRecipePage(r);
  atomicWrite(path.join(R_DIR, `${id}.html`), html);
}

/**
 * Prerender all recipes + index page + recipe-index.json.
 * @returns {{ count: number, ms: number }}
 */
function prerenderAll() {
  const t0 = Date.now();
  ensureRDir();
  const recipes = listRecipes();
  for (const { id } of recipes) {
    prerenderRecipe(id);
  }
  prerenderIndex(recipes);
  return { count: recipes.length, ms: Date.now() - t0 };
}

/**
 * Prerender public/index.html (SSR grid) and public/recipes/recipe-index.json.
 * @param {Array} recipes
 */
function prerenderIndex(recipes) {
  const html = renderIndexPage(recipes);
  atomicWrite(path.join(PUBLIC_DIR, 'index.html'), html);

  const recipesDir = path.join(PUBLIC_DIR, 'recipes');
  if (!fs.existsSync(recipesDir)) fs.mkdirSync(recipesDir, { recursive: true });
  atomicWrite(
    path.join(recipesDir, 'recipe-index.json'),
    JSON.stringify(recipes, null, 2)
  );
}

/**
 * Remove a prerendered file.
 * @param {string} id
 */
function removePrerender(id) {
  const filePath = path.join(R_DIR, `${id}.html`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/**
 * Hash the template files to detect template changes.
 * @returns {string}
 */
function computeTemplateHash() {
  const files = [
    path.join(__dirname, 'template.js'),
    path.join(__dirname, 'doc-to-html.js'),
    path.join(__dirname, 'index-template.js'),
    path.join(__dirname, '../lib/format-amount.js'),
  ];
  const hash = crypto.createHash('sha256');
  for (const f of files) {
    hash.update(fs.readFileSync(f));
  }
  return hash.digest('hex');
}

module.exports = { prerenderRecipe, prerenderAll, prerenderIndex, removePrerender, computeTemplateHash };
