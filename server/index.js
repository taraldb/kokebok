const express = require('express');
const compression = require('compression');
const path = require('path');
const { migrate } = require('./db/migrate');
const { listRecipes, getRecipe, getTemplateHash, setTemplateHash } = require('./db/recipes');
const { prerenderAll, computeTemplateHash } = require('./prerender/index');
const apiRecipes = require('./routes/api-recipes');
const apiAdmin = require('./routes/api-admin');
const legacy = require('./routes/legacy');
const { noCache } = require('./middleware/cache');
const { PUBLIC_DIR } = require('./config');

const { PORT = 8080 } = process.env;

migrate();

// Auto-rerender when template changes
(function checkTemplateHash() {
  const current = computeTemplateHash();
  const stored  = getTemplateHash();
  if (current !== stored) {
    console.log('Template changed — prerendering all recipes…');
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
  const { RECIPES_JSON_DIR } = require('./config');
  const indexPath = require('path').join(__dirname, '../public/recipes/recipe-index.json');
  const fs = require('fs');
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
app.use('/r', express.static(path.join(PUBLIC_DIR, 'r'), { setHeaders: noCache }));

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
