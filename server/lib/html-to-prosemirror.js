/**
 * Converts step HTML (as produced by old recipe JSON) to a ProseMirror doc.
 *
 * Supported elements: <strong>, <em>, <br>, <span data-base data-unit>
 * The returned doc has type "doc" with a single paragraph containing inline nodes.
 *
 * @param {string} html
 * @param {Array<{id:string,amount:number|null,unit:string|null,name:string}>} ingredients
 * @param {string[]} [warnings]  array to push warning strings into
 * @returns {{ type: 'doc', content: Array }}
 */
function htmlToProsemirror(html, ingredients, warnings = []) {
  const tokens = tokenize(html);
  const inlineNodes = parseInline(tokens, ingredients, warnings);

  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: inlineNodes }],
  };
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

const TAG_RE = /<(\/?)(\w+)([^>]*)>/g;

function tokenize(html) {
  const tokens = [];
  let lastIndex = 0;
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(html)) !== null) {
    if (m.index > lastIndex) {
      tokens.push({ type: 'text', value: decodeHtmlEntities(html.slice(lastIndex, m.index)) });
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrsStr = m[3];
    if (closing) {
      tokens.push({ type: 'close', tag });
    } else if (tag === 'br') {
      tokens.push({ type: 'br' });
    } else {
      const attrs = parseAttrs(attrsStr);
      tokens.push({ type: 'open', tag, attrs });
    }
    lastIndex = TAG_RE.lastIndex;
  }
  if (lastIndex < html.length) {
    tokens.push({ type: 'text', value: decodeHtmlEntities(html.slice(lastIndex)) });
  }
  return tokens;
}

function parseAttrs(str) {
  const attrs = {};
  const re = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (!m[1]) continue;
    attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? true;
  }
  return attrs;
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// ── Inline parser ─────────────────────────────────────────────────────────────

function parseInline(tokens, ingredients, warnings) {
  const nodes = [];
  const marks = [];  // active mark names: 'bold' | 'italic'

  function currentMarks() {
    return marks.map(m => ({ type: m }));
  }

  function addText(text) {
    if (!text) return;
    const m = currentMarks();
    nodes.push(m.length ? { type: 'text', text, marks: m } : { type: 'text', text });
  }

  // Collect text inside a span (may contain nested elements — treated as plain text)
  function collectSpanText(i, tokens) {
    let text = '';
    let depth = 1;
    while (i < tokens.length && depth > 0) {
      const t = tokens[i];
      if (t.type === 'text') text += t.value;
      else if (t.type === 'open') depth++;
      else if (t.type === 'close') { depth--; if (depth === 0) break; }
      else if (t.type === 'br') text += '\n';
      i++;
    }
    return { text, next: i };
  }

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    if (t.type === 'text') {
      addText(t.value);
      i++;
    } else if (t.type === 'br') {
      nodes.push({ type: 'hardBreak' });
      i++;
    } else if (t.type === 'open' && t.tag === 'strong') {
      marks.push('bold');
      i++;
    } else if (t.type === 'close' && t.tag === 'strong') {
      const idx = marks.lastIndexOf('bold');
      if (idx !== -1) marks.splice(idx, 1);
      i++;
    } else if (t.type === 'open' && t.tag === 'em') {
      marks.push('italic');
      i++;
    } else if (t.type === 'close' && t.tag === 'em') {
      const idx = marks.lastIndexOf('italic');
      if (idx !== -1) marks.splice(idx, 1);
      i++;
    } else if (t.type === 'open' && t.tag === 'span' && t.attrs['data-base'] != null) {
      const base = parseFloat(t.attrs['data-base']);
      const unit = t.attrs['data-unit'] || null;
      i++;
      const { text: innerText, next } = collectSpanText(i, tokens);
      i = next + 1;  // skip past the closing </span>

      // Peek at the next text token for disambiguation (e.g. " fløte" after "6 dl")
      const followSuffix = (i < tokens.length && tokens[i].type === 'text') ? tokens[i].value : '';

      const resolved = resolveIngredient(base, unit, innerText, ingredients, warnings, followSuffix);
      if (resolved) {
        const node = {
          type: 'ingredientRef',
          attrs: {
            ingredientId: resolved.id,
            factor: resolved.factor,
            displayOverride: resolved.displayOverride || null,
          },
        };
        nodes.push(node);
      } else {
        // Fallback: plain text with current marks, strip surrounding whitespace text
        addText(innerText || `${base} ${unit || ''}`);
      }
    } else {
      // Skip unknown tags
      i++;
    }
  }

  return nodes;
}

// ── Ingredient resolver ───────────────────────────────────────────────────────

/**
 * @param {number} base  data-base value
 * @param {string|null} unit  data-unit value
 * @param {string} displayText  inner text of the span
 * @param {Array} ingredients
 * @param {string[]} warnings
 * @param {string} [followSuffix]  text immediately after the span (disambiguation hint)
 */
function resolveIngredient(base, unit, displayText, ingredients, warnings, followSuffix = '') {
  if (!ingredients || !ingredients.length) return null;

  const normSuffix = followSuffix.trim().toLowerCase();

  // Strategy 1: exact match on unit + amount, with name disambiguation via follow text
  const exactMatches = ingredients.filter(ing =>
    ing.unit === unit && ing.amount != null && Math.abs(ing.amount - base) < 0.001
  );
  if (exactMatches.length === 1) {
    return { id: exactMatches[0].id, factor: 1.0 };
  }
  if (exactMatches.length > 1 && normSuffix) {
    const named = exactMatches.find(ing => normSuffix.includes(ing.name.toLowerCase().split(' ')[0]));
    if (named) return { id: named.id, factor: 1.0 };
  }
  if (exactMatches.length > 0) {
    return { id: exactMatches[0].id, factor: 1.0 };
  }

  // Strategy 2: unit matches, base is a clean fraction of amount
  const unitMatches = ingredients.filter(ing => ing.unit === unit && ing.amount != null && ing.amount > 0);
  for (const ing of unitMatches) {
    const ratio = base / ing.amount;
    const cleanFractions = [0.5, 1/3, 2/3, 0.25, 0.75, 0.6, 0.4, 0.333, 0.667, 0.1, 0.2];
    for (const f of cleanFractions) {
      if (Math.abs(ratio - f) < 0.01) {
        return { id: ing.id, factor: Math.round(ratio * 1000) / 1000 };
      }
    }
    // Any ratio that's reasonably "clean" (2 decimal places)
    if (ratio > 0 && ratio <= 2 && Math.abs(ratio - Math.round(ratio * 100) / 100) < 0.005) {
      return { id: ing.id, factor: Math.round(ratio * 100) / 100 };
    }
  }

  // Strategy 3: fuzzy name match against display text
  if (displayText) {
    const normDisplay = displayText.toLowerCase().replace(/[\d.,\s]+[a-zæøå]*\s*/i, '').trim();
    for (const ing of ingredients) {
      const normName = ing.name.toLowerCase();
      if (normName.includes(normDisplay) || normDisplay.includes(normName.split(' ')[0])) {
        const factor = ing.amount && ing.amount > 0 ? base / ing.amount : 1.0;
        return { id: ing.id, factor: Math.round(factor * 1000) / 1000 };
      }
    }
  }

  warnings.push(`Could not resolve span: base=${base}, unit=${unit}, text="${displayText}"`);
  return null;
}

module.exports = { htmlToProsemirror };
