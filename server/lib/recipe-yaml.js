const yaml = require('js-yaml');
const { docToYaml, yamlToDoc } = require('./doc-yaml');
const { nanoid } = require('nanoid');
const { uniqueSlug } = require('./slugify');

/**
 * Serialize a recipe to YAML string.
 * @param {import('../types').Recipe} r
 * @returns {string}
 */
function recipeToYaml(r) {
  const obj = {
    id: r.id,
    title: r.title,
    ...(r.label ? { label: r.label } : {}),
    ...(r.description ? { description: r.description } : {}),
    ...(r.category ? { category: r.category } : {}),
    tags: r.tags || [],
    meta: (r.meta || []).map(m => ({ label: m.label, value: m.value })),
    servings: {
      base: r.servings_base,
      unit: r.servings_unit,
      step: r.servings_step,
      min: r.servings_min,
    },
    ingredients: (r.ingredients || []).map(i => ({
      id: i.id,
      amount: i.amount,
      unit: i.unit,
      name: i.name,
      ...(i.description ? { description: i.description } : {}),
    })),
    steps: (r.steps || []).map(s => ({
      id: s.id,
      title: s.title,
      timer_seconds: s.timer_seconds,
      content: docToYaml(s.content_doc, r.ingredients),
    })),
    tips: r.tips || [],
  };
  return yaml.dump(obj, { lineWidth: 120, noRefs: true });
}

/**
 * Parse a YAML string back to a Recipe object.
 * @param {string} yamlStr
 * @returns {import('../types').Recipe}
 */
function yamlToRecipe(yamlStr) {
  const obj = yaml.load(yamlStr);
  if (!obj || typeof obj !== 'object') throw new Error('Invalid YAML');

  const taken = new Set()
  const ingredients = (obj.ingredients || []).map((i, pos) => {
    const id = i.id || uniqueSlug(i.name || '', taken)
    taken.add(id)
    return { id, position: pos, name: i.name || '', amount: i.amount ?? null, unit: i.unit ?? null, description: i.description ?? null }
  });

  const steps = (obj.steps || []).map((s, pos) => ({
    id: s.id || nanoid(),
    position: pos,
    title: s.title || '',
    timer_seconds: s.timer_seconds || 0,
    content_doc: yamlToDoc(s.content || '', ingredients),
  }));

  const srv = obj.servings || {};
  return {
    id: obj.id || nanoid(),
    title: obj.title || '',
    label: obj.label ?? null,
    description: obj.description ?? null,
    category: obj.category ?? null,
    tags: obj.tags || [],
    meta: obj.meta || [],
    servings_base: srv.base ?? null,
    servings_unit: srv.unit ?? null,
    servings_step: srv.step ?? 1,
    servings_min: srv.min ?? 1,
    tips: obj.tips || [],
    ingredients,
    steps,
  };
}

module.exports = { recipeToYaml, yamlToRecipe };
