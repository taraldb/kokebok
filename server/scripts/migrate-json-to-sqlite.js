#!/usr/bin/env node
/**
 * One-shot migration: import existing recipe JSON files into SQLite.
 * Idempotent — running twice is safe (uses upsertRecipe).
 */

const fs = require('fs');
const path = require('path');
const { uniqueSlug } = require('../lib/slugify');
const { shortId } = require('../lib/id');
const { migrate } = require('../db/migrate');
const { upsertRecipe, getRecipe } = require('../db/recipes');
const { htmlToProsemirror } = require('../lib/html-to-prosemirror');

const RECIPES_JSON_DIR = process.env.RECIPES_DIR
  || path.join(__dirname, '../../recipes');

const LOG_FILE = path.join(__dirname, '../../migration.log');

function log(msg) {
  process.stdout.write(msg + '\n');
  fs.appendFileSync(LOG_FILE, msg + '\n');
}

function convertRecipe(json) {
  const allWarnings = [];

  // Build ingredient list with name-based slug ids
  const taken = new Set();
  const ingredients = (json.ingredients || []).map((ing, i) => {
    const id = uniqueSlug(ing.name || '', taken);
    taken.add(id);
    return { id, position: i, name: ing.name, amount: ing.amount ?? null, unit: ing.unit ?? null };
  });

  // Convert steps
  const steps = (json.steps || []).map((step, i) => {
    const warnings = [];
    const content_doc = htmlToProsemirror(step.text || '', ingredients, warnings);
    for (const w of warnings) {
      allWarnings.push(`  [${json.id}] step "${step.title}": ${w}`);
    }
    return {
      id: shortId(),
      position: i,
      title: step.title || '',
      timer_seconds: step.timerSeconds || 0,
      content_doc,
    };
  });

  const servings = json.servings || {};

  // Extract active_time: prefer explicit field, else pull from "Aktiv tid" meta entry
  let active_time = json.active_time ?? null;
  let metaArr = json.meta || [];
  if (active_time == null) {
    const idx = metaArr.findIndex(m => m.label?.toLowerCase() === 'aktiv tid');
    if (idx !== -1) {
      const numMatch = String(metaArr[idx].value ?? '').match(/\d+/);
      active_time = numMatch ? parseInt(numMatch[0], 10) : null;
      metaArr = metaArr.filter((_, i) => i !== idx);
    }
  }

  const recipe = {
    id: json.id,
    title: json.title || '',
    label: json.label || null,
    description: json.description || null,
    category: json.category || null,
    tags: json.tags || [],
    active_time,
    meta: metaArr,
    servings_base: servings.base ?? null,
    servings_unit: servings.unit ?? null,
    servings_step: servings.step ?? 1,
    servings_min: servings.min ?? 1,
    tips: json.tips || [],
    ingredients,
    steps,
  };

  return { recipe, warnings: allWarnings };
}

function run() {
  // Clear old log
  fs.writeFileSync(LOG_FILE, `Migration run: ${new Date().toISOString()}\n`);

  migrate();
  log('Schema OK');

  const files = fs.readdirSync(RECIPES_JSON_DIR)
    .filter(f => f.endsWith('.json') && f !== 'recipe-index.json')
    .sort();

  if (files.length === 0) {
    log('No recipe JSON files found — nothing to import');
    process.exit(0);
  }

  let totalWarnings = 0;
  let imported = 0;

  for (const file of files) {
    const filePath = path.join(RECIPES_JSON_DIR, file);
    let json;
    try {
      json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      log(`ERROR: Failed to parse ${file}: ${e.message}`);
      process.exit(1);
    }

    const { recipe, warnings } = convertRecipe(json);
    upsertRecipe(recipe);
    imported++;

    if (warnings.length) {
      for (const w of warnings) log(`WARNING: ${w}`);
      totalWarnings += warnings.length;
    } else {
      log(`Imported: ${json.id}`);
    }
  }

  log(`\nImported ${imported} recipes, ${totalWarnings} warnings`);

  if (totalWarnings > 0) {
    process.stderr.write(`\n${totalWarnings} warning(s) during migration — review migration.log\n`);
    process.exit(1);
  }
}

run();
