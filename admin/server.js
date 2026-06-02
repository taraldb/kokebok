const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const RECIPES_DIR = process.env.RECIPES_DIR || path.join(__dirname, '../recipes');
const PUBLIC_DIR  = process.env.PUBLIC_DIR  || path.join(__dirname, '../public');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

function recipeFile(id) {
  return path.join(RECIPES_DIR, `${id}.json`);
}

function indexFile() {
  return path.join(RECIPES_DIR, 'recipe-index.json');
}

function rebuildIndex() {
  const files = fs.readdirSync(RECIPES_DIR).filter(f => f.endsWith('.json') && f !== 'recipe-index.json');
  const index = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, f), 'utf8'));
    return {
      id:          data.id,
      title:       data.title,
      description: data.description || '',
      category:    data.category || '',
      tags:        data.tags || []
    };
  }).sort((a, b) => a.title.localeCompare(b.title, 'no'));

  fs.writeFileSync(indexFile(), JSON.stringify(index, null, 2));

  // Also write a copy to the public dir so nginx can serve it without the admin running
  const publicRecipesDir = path.join(PUBLIC_DIR, '../recipes');
  try {
    if (fs.existsSync(path.join(PUBLIC_DIR, '..', 'recipes'))) {
      // already correct — RECIPES_DIR and the nginx volume are the same
    }
  } catch {}
}

// List
app.get('/api/recipes', (_req, res) => {
  const idx = fs.existsSync(indexFile())
    ? JSON.parse(fs.readFileSync(indexFile(), 'utf8'))
    : [];
  res.json(idx);
});

// Get one
app.get('/api/recipes/:id', (req, res) => {
  const file = recipeFile(req.params.id);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

// Create
app.post('/api/recipes', (req, res) => {
  const recipe = req.body;
  if (!recipe.id || !recipe.title) return res.status(400).json({ error: 'id and title required' });
  const file = recipeFile(recipe.id);
  if (fs.existsSync(file)) return res.status(409).json({ error: 'recipe already exists — use PUT to update' });
  fs.writeFileSync(file, JSON.stringify(recipe, null, 2));
  rebuildIndex();
  res.status(201).json({ ok: true, id: recipe.id });
});

// Update
app.put('/api/recipes/:id', (req, res) => {
  const recipe = req.body;
  const file = recipeFile(req.params.id);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found — use POST to create' });
  recipe.id = req.params.id;
  fs.writeFileSync(file, JSON.stringify(recipe, null, 2));
  rebuildIndex();
  res.json({ ok: true });
});

// Delete
app.delete('/api/recipes/:id', (req, res) => {
  const file = recipeFile(req.params.id);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
  fs.unlinkSync(file);
  rebuildIndex();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Kokebok admin running at http://localhost:${PORT}`);
  console.log(`Recipes dir: ${RECIPES_DIR}`);
});
