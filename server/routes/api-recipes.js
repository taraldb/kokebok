const express = require('express');
const { z } = require('zod');
const { nanoid } = require('nanoid');
const { listRecipes, getRecipe, upsertRecipe, deleteRecipe } = require('../db/recipes');
const { prerenderRecipe, removePrerender } = require('../prerender/index');
const { writeJsonSnapshot } = require('../lib/json-snapshot');
const { recipeToYaml, yamlToRecipe } = require('../lib/recipe-yaml');

const router = express.Router();

const IngredientSchema = z.object({
  id: z.string().optional(),
  position: z.number().int(),
  name: z.string().min(1),
  amount: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const StepSchema = z.object({
  id: z.string().optional(),
  position: z.number().int(),
  title: z.string().min(1),
  timer_seconds: z.number().int().default(0),
  content_doc: z.object({ type: z.string() }).passthrough(),
});

const RecipeBodySchema = z.object({
  title: z.string().min(1),
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  meta: z.array(z.object({}).passthrough()).default([]),
  servings_base: z.number().int().nullable().optional(),
  servings_unit: z.string().nullable().optional(),
  servings_step: z.number().int().default(1),
  servings_min: z.number().int().default(1),
  tips: z.array(z.string()).default([]),
  ingredients: z.array(IngredientSchema).default([]),
  steps: z.array(StepSchema).default([]),
});

function ensureIds(recipe) {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map(i => ({ ...i, id: i.id || nanoid() })),
    steps: recipe.steps.map(s => ({ ...s, id: s.id || nanoid() })),
  };
}

router.get('/', (_req, res) => {
  res.json(listRecipes());
});

router.get('/:id', (req, res) => {
  const r = getRecipe(req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json(r);
});

router.post('/', (req, res) => {
  const parsed = RecipeBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const id = req.body.id || nanoid();
  if (getRecipe(id)) return res.status(409).json({ error: 'already exists — use PUT' });

  const recipe = ensureIds({ ...parsed.data, id });
  upsertRecipe(recipe);
  writeJsonSnapshot(recipe.id, getRecipe(recipe.id));
  prerenderRecipe(recipe.id);
  res.status(201).json({ ok: true, id: recipe.id });
});

router.put('/:id', (req, res) => {
  const parsed = RecipeBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const recipe = ensureIds({ ...parsed.data, id: req.params.id });
  upsertRecipe(recipe);
  writeJsonSnapshot(recipe.id, getRecipe(recipe.id));
  prerenderRecipe(recipe.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  if (!getRecipe(req.params.id)) return res.status(404).json({ error: 'not found' });
  deleteRecipe(req.params.id);
  removePrerender(req.params.id);
  res.json({ ok: true });
});

// GET /api/recipes/:id/yaml — fetch recipe as YAML
router.get('/:id/yaml', (req, res) => {
  const r = getRecipe(req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
  res.send(recipeToYaml(r));
});

// PUT /api/recipes/:id/yaml — save recipe from YAML body
router.put('/:id/yaml', express.text({ type: ['text/yaml', 'text/plain'], limit: '5mb' }), (req, res) => {
  let recipe;
  try {
    recipe = yamlToRecipe(req.body);
  } catch (e) {
    return res.status(400).json({ error: `Invalid YAML: ${e.message}` });
  }
  recipe.id = req.params.id;
  upsertRecipe(recipe);
  writeJsonSnapshot(recipe.id, getRecipe(recipe.id));
  prerenderRecipe(recipe.id);
  res.json({ ok: true });
});

module.exports = router;
