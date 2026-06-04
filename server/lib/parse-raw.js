const yaml = require('js-yaml');
const { yamlToRecipe } = require('./recipe-yaml');
const { parseMarkdown } = require('./parse-markdown');
const { uniqueSlug } = require('./slugify');

/**
 * Try to parse raw input (JSON → YAML → Markdown).
 * @param {string} text
 * @returns {{ recipe: Object, warnings: string[], format: string }}
 */
function parseRaw(text) {
  const trimmed = text.trim();

  // Try JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      // If it looks like a recipe JSON (old format with .steps[].text)
      if (json.id && json.title) {
        return { recipe: normalizeJsonRecipe(json), warnings: [], format: 'json' };
      }
    } catch {}
  }

  // Try YAML
  try {
    const obj = yaml.load(trimmed);
    if (obj && typeof obj === 'object' && obj.title) {
      const recipe = yamlToRecipe(trimmed);
      return { recipe, warnings: [], format: 'yaml' };
    }
  } catch {}

  // Markdown fallback
  const { recipe, warnings } = parseMarkdown(trimmed);
  return { recipe, warnings, format: 'markdown' };
}

function normalizeJsonRecipe(json) {
  const { nanoid } = require('nanoid');
  const taken = new Set()
  const ingredients = (json.ingredients || []).map((i, pos) => {
    const id = uniqueSlug(i.name || '', taken)
    taken.add(id)
    return { id, position: pos, name: i.name || '', amount: i.amount ?? null, unit: i.unit ?? null }
  });

  const steps = (json.steps || []).map((s, pos) => ({
    id: nanoid(),
    position: pos,
    title: s.title || '',
    timer_seconds: s.timerSeconds || s.timer_seconds || 0,
    content_doc: s.text
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s.text }] }] }
      : (s.content_doc || { type: 'doc', content: [{ type: 'paragraph' }] }),
  }));

  const srv = json.servings || {};
  return {
    id: json.id,
    title: json.title || '',
    label: json.label ?? null,
    description: json.description ?? null,
    category: json.category ?? null,
    tags: json.tags || [],
    meta: json.meta || [],
    servings_base: srv.base ?? json.servings_base ?? null,
    servings_unit: srv.unit ?? json.servings_unit ?? null,
    servings_step: srv.step ?? json.servings_step ?? 1,
    servings_min: srv.min ?? json.servings_min ?? 1,
    tips: json.tips || [],
    ingredients,
    steps,
  };
}

module.exports = { parseRaw };
