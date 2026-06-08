import { Node } from '@tiptap/core'

export const IngredientRefNode = Node.create({
  name: 'ingredientRef',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    // ingredientsRef is a { current: [] } object — mutating .current is always visible here
    return { ingredientsRef: { current: [] } }
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
    const ingredients = this.options.ingredientsRef.current || []
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
    // Capture the ref object — .current will always be up to date
    const ingredientsRef = this.options.ingredientsRef

    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'ing-chip'
      dom.contentEditable = 'false'

      let currentAttrs = node.attrs

      const rerender = () => {
        const { ingredientId, factor, displayOverride } = currentAttrs
        const ingredients = ingredientsRef.current || []
        const ing = ingredients.find(i => i.id === ingredientId)
        const name = ing?.name ?? ingredientId ?? '?'
        const base = ing ? (ing.amount ?? 0) * factor : 0
        const unit = ing?.unit ?? ''
        const amtStr = base > 0 ? `${parseFloat(base.toFixed(4))} ${unit}`.trim() : ''
        const qtyStr = displayOverride || amtStr

        dom.dataset.ingId = ingredientId
        dom.dataset.factor = String(factor)
        dom.dataset.displayOverride = displayOverride || ''
        dom.title = `${name} × ${factor}`
        dom.innerHTML = ''
        if (qtyStr) {
          const qtyEl = document.createElement('span')
          qtyEl.className = 'ing-chip-qty'
          qtyEl.textContent = qtyStr
          dom.appendChild(qtyEl)
          dom.appendChild(document.createTextNode(' '))
        }
        const nameEl = document.createElement('span')
        nameEl.className = 'ing-chip-name'
        nameEl.textContent = name
        dom.appendChild(nameEl)
      }

      rerender()

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'ingredientRef') return false
          currentAttrs = updatedNode.attrs
          rerender()
          return true
        },
      }
    }
  },
})
