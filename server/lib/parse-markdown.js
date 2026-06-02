const { nanoid } = require('nanoid');

/**
 * Parse a markdown recipe into a partial Recipe object.
 * Expects:
 *   # Title
 *   ## Ingredienser (or Ingredients)
 *   - 700 ml kaldt vann
 *   ## Fremgangsmåte (or Steps)
 *   1. Step title\n   Content here.
 *
 * @param {string} text
 * @returns {{ recipe: Object, warnings: string[] }}
 */
function parseMarkdown(text) {
  const warnings = [];
  const lines = text.split('\n');
  let title = null;
  let description = null;
  let currentSection = null;
  const ingredients = [];
  const steps = [];
  const tips = [];

  // Norwegian decimal comma + English period
  const ING_RE = /^[-*]\s+(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?)\s+([\wæøåÆØÅ/]+)\s+(.+)$/u;
  const ING_UNITLESS_RE = /^[-*]\s+(\d+)\s+(stk|stykk|ss|ts|dl|l|ml|g|kg|oz|lbs?|cl)\s*(.*)$/iu;
  const ING_WORDS_RE = /^[-*]\s+(.+)$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (!title && line.startsWith('# ')) {
      title = line.slice(2).trim();
      i++;
      // Collect description lines until next heading
      const descLines = [];
      while (i < lines.length && !lines[i].startsWith('#')) {
        const l = lines[i].trim();
        if (l) descLines.push(l);
        i++;
      }
      description = descLines.join(' ') || null;
      continue;
    }

    if (line.startsWith('## ')) {
      const heading = line.slice(3).toLowerCase().trim();
      if (/ingredienser|ingredients/.test(heading)) currentSection = 'ingredients';
      else if (/fremgangsmåte|steps|instructions|directions/.test(heading)) currentSection = 'steps';
      else if (/tips/.test(heading)) currentSection = 'tips';
      else currentSection = null;
      i++;
      continue;
    }

    if (currentSection === 'ingredients' && line.startsWith('-') || line.startsWith('*')) {
      const m = ING_RE.exec(line) || ING_UNITLESS_RE.exec(line);
      if (m) {
        let amtStr = m[1].replace(',', '.');
        if (amtStr.includes('/')) {
          const parts = amtStr.split(/\s+/);
          const frac = parts.find(p => p.includes('/'));
          const whole = parts.find(p => !p.includes('/')) || '0';
          const [n, d] = frac.split('/').map(Number);
          amtStr = String(parseFloat(whole) + n / d);
        }
        ingredients.push({
          id: nanoid(),
          position: ingredients.length,
          amount: parseFloat(amtStr) || null,
          unit: m[2].trim().toLowerCase(),
          name: m[3] ? m[3].trim() : m[2].trim(),
        });
      } else {
        const mWords = ING_WORDS_RE.exec(line);
        if (mWords) {
          warnings.push(`Could not parse ingredient amount/unit from: "${line}"`);
          ingredients.push({
            id: nanoid(),
            position: ingredients.length,
            amount: null,
            unit: 'stk',
            name: mWords[1].replace(/^[-*\s]+/, '').trim(),
          });
        }
      }
      i++;
      continue;
    }

    if (currentSection === 'steps') {
      // Numbered list: "1. Step title" or "1. Title\n   content"
      const stepMatch = /^\d+\.\s+(.+)$/.exec(line);
      if (stepMatch) {
        const stepTitle = stepMatch[1].trim();
        const contentLines = [];
        i++;
        while (i < lines.length && !/^\d+\./.test(lines[i].trim()) && !lines[i].startsWith('#')) {
          const l = lines[i].trim();
          if (l) contentLines.push(l);
          i++;
        }
        const content = contentLines.join(' ');
        steps.push({
          id: nanoid(),
          position: steps.length,
          title: stepTitle,
          timer_seconds: 0,
          content_doc: plainTextToDoc(content),
        });
        continue;
      }
      // Paragraph style steps (no numbered list)
      if (line && !line.startsWith('#')) {
        steps.push({
          id: nanoid(),
          position: steps.length,
          title: `Steg ${steps.length + 1}`,
          timer_seconds: 0,
          content_doc: plainTextToDoc(line),
        });
      }
    }

    if (currentSection === 'tips' && line.startsWith('-')) {
      tips.push(line.slice(1).trim());
    }

    i++;
  }

  if (!title) warnings.push('No title found (expected # H1)');

  const slug = title
    ? title.toLowerCase()
        .replace(/[æÆ]/g, 'ae').replace(/[øØ]/g, 'o').replace(/[åÅ]/g, 'a')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    : nanoid();

  return {
    recipe: {
      id: slug,
      title: title || 'Uten tittel',
      description,
      tags: [],
      meta: [],
      servings_base: null,
      servings_unit: null,
      servings_step: 1,
      servings_min: 1,
      tips,
      ingredients,
      steps,
    },
    warnings,
  };
}

function plainTextToDoc(text) {
  if (!text) return { type: 'doc', content: [{ type: 'paragraph' }] };
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

module.exports = { parseMarkdown };
