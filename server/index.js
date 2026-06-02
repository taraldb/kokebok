const express = require('express');
const compression = require('compression');
const path = require('path');
const { migrate } = require('./db/migrate');
const { listRecipes, getRecipe } = require('./db/recipes');
const apiRecipes = require('./routes/api-recipes');
const apiAdmin = require('./routes/api-admin');
const legacy = require('./routes/legacy');
const { noCache } = require('./middleware/cache');
const { PUBLIC_DIR } = require('./config');

const { PORT = 8080 } = process.env;

migrate();

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
