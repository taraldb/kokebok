const yaml = require('js-yaml');

/**
 * Convert a ProseMirror doc to YAML-friendly text.
 * ingredientRef → {{ing:<id>}} or {{ing:<id> @ <factor>}} or {{ing:<id> @ <factor> :: "override"}}
 * bold → **text**, italic → *text*
 *
 * @param {Object} doc
 * @param {Array<{id:string}>} ingredients  (not needed for conversion but validates refs)
 * @returns {string}
 */
function docToYaml(doc, ingredients) {
  function nodeToText(node) {
    if (node.type === 'text') {
      let t = node.text || '';
      const marks = node.marks || [];
      if (marks.some(m => m.type === 'bold'))   t = `**${t}**`;
      if (marks.some(m => m.type === 'italic')) t = `*${t}*`;
      return t;
    }
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'ingredientRef') {
      const { ingredientId, factor = 1, displayOverride } = node.attrs || {};
      if (displayOverride) return `{{ing:${ingredientId} @ ${factor} :: "${displayOverride}"}}`;
      if (Math.abs(factor - 1.0) > 0.001) return `{{ing:${ingredientId} @ ${factor}}}`;
      return `{{ing:${ingredientId}}}`;
    }
    if (node.type === 'paragraph' || node.type === 'doc') {
      return (node.content || []).map(nodeToText).join('');
    }
    return (node.content || []).map(nodeToText).join('');
  }
  return nodeToText(doc);
}

/**
 * Convert YAML step content text back to ProseMirror doc.
 * Inverse of docToYaml.
 *
 * @param {string} text
 * @param {Array<{id:string}>} ingredients
 * @returns {Object} ProseMirror doc
 */
function yamlToDoc(text, ingredients) {
  const ingIds = new Set((ingredients || []).map(i => i.id));
  const content = [];
  let remaining = text;

  // Tokenize: split on {{ing:...}}, **bold**, *italic*, \n
  const TOKEN_RE = /(\{\{ing:[^}]+\}\})|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\n)/g;
  let lastIndex = 0;
  let m;

  function pushText(s, marks = []) {
    if (!s) return;
    const node = { type: 'text', text: s };
    if (marks.length) node.marks = marks;
    content.push(node);
  }

  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      pushText(text.slice(lastIndex, m.index));
    }
    lastIndex = TOKEN_RE.lastIndex;

    if (m[1]) {
      // {{ing:...}} ref
      const inner = m[1].slice(2, -2).slice(4); // strip {{ing: and }}
      const [idPart, rest] = inner.split(' @ ');
      const id = idPart.trim();
      let factor = 1.0;
      let displayOverride = null;
      if (rest) {
        const [factorStr, overrideStr] = rest.split(' :: ');
        factor = parseFloat(factorStr.trim()) || 1.0;
        if (overrideStr) displayOverride = overrideStr.replace(/^"|"$/g, '').trim();
      }
      if (ingIds.has(id)) {
        content.push({ type: 'ingredientRef', attrs: { ingredientId: id, factor, displayOverride } });
      } else {
        pushText(m[1]); // unknown id → literal text
      }
    } else if (m[2]) {
      // **bold**
      pushText(m[2].slice(2, -2), [{ type: 'bold' }]);
    } else if (m[3]) {
      // *italic*
      pushText(m[3].slice(1, -1), [{ type: 'italic' }]);
    } else if (m[4]) {
      // newline
      content.push({ type: 'hardBreak' });
    }
  }
  if (lastIndex < text.length) {
    pushText(text.slice(lastIndex));
  }

  return { type: 'doc', content: [{ type: 'paragraph', content }] };
}

module.exports = { docToYaml, yamlToDoc };
