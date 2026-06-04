const { formatAmount } = require('../lib/format-amount');

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Convert a ProseMirror document to HTML for the prerendered recipe page.
 * ingredientRef nodes emit <span class="ing-ref" data-base data-unit data-ing-id data-factor>.
 *
 * @param {Object} doc - ProseMirror doc node
 * @param {Array<{id,amount,unit,name}>} ingredients
 * @returns {string}
 */
function docToHtml(doc, ingredients) {
  const ingMap = new Map((ingredients || []).map(i => [i.id, i]));

  function nodeToHtml(node) {
    if (node.type === 'text') {
      let text = esc(node.text || '');
      const marks = node.marks || [];
      for (const mark of marks) {
        if (mark.type === 'bold')   text = `<strong>${text}</strong>`;
        if (mark.type === 'italic') text = `<em>${text}</em>`;
      }
      return text;
    }

    if (node.type === 'hardBreak') return '<br>';

    if (node.type === 'ingredientRef') {
      const { ingredientId, factor = 1, displayOverride } = node.attrs || {};
      const ing = ingMap.get(ingredientId);
      if (!ing) return displayOverride ? esc(displayOverride) : '';

      const base = (ing.amount ?? 0) * factor;
      const qty = displayOverride || (base > 0 ? formatAmount(base, ing.unit) : '');
      const name = ing.name || '';
      const qtyHtml = qty
        ? `<span class="ing-ref-qty" data-base="${esc(String(base))}" data-unit="${esc(ing.unit || '')}">${esc(qty)}</span> `
        : '';
      return `<span class="ing-ref" data-ing-id="${esc(ingredientId)}" data-factor="${esc(String(factor))}">${qtyHtml}<span class="ing-ref-name">${esc(name)}</span></span>`;
    }

    if (node.type === 'paragraph') {
      const inner = (node.content || []).map(nodeToHtml).join('');
      return inner;
    }

    if (node.type === 'doc') {
      return (node.content || []).map(nodeToHtml).join('');
    }

    // Unknown nodes: recurse into children
    return (node.content || []).map(nodeToHtml).join('');
  }

  return nodeToHtml(doc);
}

module.exports = { docToHtml };
