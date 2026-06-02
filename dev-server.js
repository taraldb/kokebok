// Dev server: serves public site, recipes, and admin API all on one port.
// Not for production — use the Docker setup for that.

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const RECIPES_DIR = path.join(ROOT, 'recipes');
const PUBLIC_DIR  = path.join(ROOT, 'public');

app.use(express.json({ limit: '2mb' }));

// ── Admin API ────────────────────────────────────────────────────────────────

function recipeFile(id) { return path.join(RECIPES_DIR, `${id}.json`); }
function indexFile()    { return path.join(RECIPES_DIR, 'recipe-index.json'); }

function rebuildIndex() {
  const files = fs.readdirSync(RECIPES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'recipe-index.json');
  const index = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, f), 'utf8'));
    return { id: data.id, title: data.title, description: data.description || '',
             category: data.category || '', tags: data.tags || [] };
  }).sort((a, b) => a.title.localeCompare(b.title, 'no'));
  fs.writeFileSync(indexFile(), JSON.stringify(index, null, 2));
}

app.get('/api/recipes',      (_req, res) => {
  res.json(fs.existsSync(indexFile()) ? JSON.parse(fs.readFileSync(indexFile(), 'utf8')) : []);
});
app.get('/api/recipes/:id',  (req, res) => {
  const f = recipeFile(req.params.id);
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'not found' });
  res.json(JSON.parse(fs.readFileSync(f, 'utf8')));
});
app.post('/api/recipes',     (req, res) => {
  const r = req.body;
  if (!r.id || !r.title) return res.status(400).json({ error: 'id and title required' });
  const f = recipeFile(r.id);
  if (fs.existsSync(f)) return res.status(409).json({ error: 'already exists — use PUT' });
  fs.writeFileSync(f, JSON.stringify(r, null, 2));
  rebuildIndex();
  res.status(201).json({ ok: true, id: r.id });
});
app.put('/api/recipes/:id',  (req, res) => {
  const f = recipeFile(req.params.id);
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'not found — use POST' });
  const r = { ...req.body, id: req.params.id };
  fs.writeFileSync(f, JSON.stringify(r, null, 2));
  rebuildIndex();
  res.json({ ok: true });
});
app.delete('/api/recipes/:id', (req, res) => {
  const f = recipeFile(req.params.id);
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'not found' });
  fs.unlinkSync(f);
  rebuildIndex();
  res.json({ ok: true });
});

// ── Admin UI ─────────────────────────────────────────────────────────────────
app.use('/admin', express.static(path.join(ROOT, 'admin')));

// ── Recipes JSON ─────────────────────────────────────────────────────────────
app.use('/recipes', express.static(RECIPES_DIR, {
  setHeaders(res) { res.setHeader('Cache-Control', 'no-cache'); }
}));

// ── Public site ───────────────────────────────────────────────────────────────
app.use(express.static(PUBLIC_DIR));

// ── Start ─────────────────────────────────────────────────────────────────────
const { networkInterfaces } = require('os');
app.listen(PORT, '0.0.0.0', () => {
  const lanIp = Object.values(networkInterfaces())
    .flat()
    .find(i => i.family === 'IPv4' && !i.internal)?.address ?? 'unknown';

  console.log('\nKokebok dev server running\n');
  console.log(`  Local  → http://localhost:${PORT}`);
  console.log(`  LAN    → http://${lanIp}:${PORT}`);
  console.log(`  Admin  → http://${lanIp}:${PORT}/admin\n`);
});
