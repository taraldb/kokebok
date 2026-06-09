const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { migrate } = require('./db/migrate');
const { listRecipes, getRecipe, getTemplateHash, setTemplateHash } = require('./db/recipes');
const { prerenderAll, computeTemplateHash } = require('./prerender/index');
const apiRecipes = require('./routes/api-recipes');
const apiAdmin = require('./routes/api-admin');
const legacy = require('./routes/legacy');
const { noCache } = require('./middleware/cache');
const { PUBLIC_DIR, RECIPES_JSON_DIR } = require('./config');

const { PORT = 8080 } = process.env;

migrate();

// Auto-migrate from JSON files if DB is empty and JSON snapshots exist
(function autoMigrateIfNeeded() {
  const ROOT = path.join(__dirname, '..');
  const candidateDirs = [RECIPES_JSON_DIR, path.join(ROOT, 'recipes')];
  const jsonDir = candidateDirs.find(d => {
    if (!fs.existsSync(d)) return false;
    return fs.readdirSync(d).some(f => f.endsWith('.json') && f !== 'recipe-index.json');
  });
  if (listRecipes().length === 0 && jsonDir) {
    const jsonFiles = fs.readdirSync(jsonDir)
      .filter(f => f.endsWith('.json') && f !== 'recipe-index.json');
    console.log(`DB empty — auto-migrating ${jsonFiles.length} JSON recipes from ${jsonDir}…`);
    process.env.RECIPES_DIR = jsonDir;
    require('./scripts/migrate-json-to-sqlite');
  }
})();

// Auto-rerender when template changes or output is missing (e.g. after container replacement)
(function checkTemplateHash() {
  const current = computeTemplateHash();
  const stored  = getTemplateHash();
  const indexMissing = !fs.existsSync(path.join(PUBLIC_DIR, 'index.html'));
  if (current !== stored || indexMissing) {
    console.log(indexMissing ? 'Index missing — prerendering all recipes…' : 'Template changed — prerendering all recipes…');
    const { count, ms } = prerenderAll();
    setTemplateHash(current);
    console.log(`Prerendered ${count} recipes in ${ms}ms`);
  }
})();

const app = express();
app.use(compression());
app.use(express.json({ limit: '5mb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// ── API ───────────────────────────────────────────────────────────────────────
app.use('/api/recipes', apiRecipes);
app.use('/api/admin', apiAdmin);

// ── Admin UI (served from admin/dist in M6+) ─────────────────────────────────
const adminDistDir = path.join(__dirname, '../admin/dist');
app.use('/admin', express.static(adminDistDir, { setHeaders: noCache }));

// ── DB-backed recipe JSON (CORS, no-cache) ────────────────────────────────────

// recipe-index.json served from prerendered static file
app.get('/recipes/recipe-index.json', (req, res) => {
  const indexPath = path.join(__dirname, '../public/recipes/recipe-index.json');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).json({ error: 'not found' });
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(fs.readFileSync(indexPath));
});

app.get('/recipes/:id.json', (req, res) => {
  const r = getRecipe(req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.json(r);
});

// Bare /recipes/:id redirect → /r/:id (M10 full impl)
app.get('/recipes/:id', (req, res) => {
  res.redirect(301, `/r/${req.params.id}`);
});

// ── Prerendered recipe pages ──────────────────────────────────────────────────
app.use('/r', express.static(path.join(PUBLIC_DIR, 'r'), { setHeaders: noCache, extensions: ['html'] }));

// ── Assets (long cache) ───────────────────────────────────────────────────────
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), {
  immutable: true,
  maxAge: '7d',
}));

// ── Public static ─────────────────────────────────────────────────────────────
app.use('/', express.static(PUBLIC_DIR, { setHeaders: noCache }));

// ── Legacy redirects ─────────────────────────────────────────────────────────
app.use(legacy);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kokebok server listening on port ${PORT}`);
});

// Graceful shutdown
function shutdown() {
  const { getDb } = require('./db/index');
  try { getDb().close(); } catch {}
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
