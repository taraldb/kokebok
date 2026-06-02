import { Node, mergeAttributes } from '@tiptap/core'

export const IngredientRefNode = Node.create({
  name: 'ingredientRef',
  group: 'inline',
  inline: true,
  atom: true,

  addStorage() {
    return { ingredients: [] }
  },

  addAttributes() {
    return {
      ingredientId: { default: null },
      factor: {
        default: 1.0,
        parseHTML: el => parseFloat(el.getAttribute('data-factor') || '1'),
      },
      displayOverride: {
        default: null,
        parseHTML: el => el.getAttribute('data-display-override') || null,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span.ing-ref' }]
  },

  renderHTML({ node }) {
    const { ingredientId, factor, displayOverride } = node.attrs
    const ingredients = this.storage.ingredients || []
    const ing = ingredients.find(i => i.id === ingredientId)
    const base = ing ? (ing.amount ?? 0) * factor : 0
    const unit = ing?.unit ?? ''
    return ['span', {
      class: 'ing-ref',
      'data-ing-id': ingredientId,
      'data-factor': String(factor),
      'data-base': String(base),
      'data-unit': unit,
      'data-display-override': displayOverride || '',
    }, displayOverride || `${base} ${unit}`.trim()]
  },

  addNodeView() {
    return ({ node }) => {
      const { ingredientId, factor, displayOverride } = node.attrs
      const ingredients = this.storage.ingredients || []
      const ing = ingredients.find(i => i.id === ingredientId)
      const name = ing?.name ?? ingredientId ?? '?'
      const base = ing ? (ing.amount ?? 0) * factor : 0
      const unit = ing?.unit ?? ''
      const label = displayOverride || (factor !== 1
        ? `${base} ${unit} ${name}`.trim()
        : `${base} ${unit} ${name}`.trim())

      const dom = document.createElement('span')
      dom.className = 'ing-chip'
      dom.contentEditable = 'false'
      dom.title = `${name} × ${factor}`
      dom.textContent = label || name

      return { dom }
    }
  },
})
