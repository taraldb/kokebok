import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { IngredientRefNode } from './IngredientRefNode.js'

export class StepEditor {
  constructor(container, { ingredients = [], initialDoc = null, onUpdate, onFocus, onBlur } = {}) {
    // Mutable ref shared with all NodeViews — updating .current is always seen immediately
    this._ingredientsRef = { current: ingredients }

    this.editor = new Editor({
      element: container,
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          bulletList: false,
          orderedList: false,
          codeBlock: false,
          code: false,
          horizontalRule: false,
          strike: false,
        }),
        IngredientRefNode.configure({ ingredientsRef: this._ingredientsRef }),
      ],
      content: initialDoc || { type: 'doc', content: [{ type: 'paragraph' }] },
      onUpdate: onUpdate ? ({ editor }) => onUpdate(editor.getJSON()) : undefined,
      onFocus: onFocus ? () => onFocus() : undefined,
      onBlur:  onBlur  ? () => onBlur()  : undefined,
    })
  }

  setIngredients(ingredients) {
    this._ingredientsRef.current = ingredients
  }

  refreshIngredients(ingredients) {
    this._ingredientsRef.current = ingredients
    this.editor.view.dom.querySelectorAll('.ing-chip[data-ing-id]').forEach(chipDom => {
      const ingredientId = chipDom.dataset.ingId
      const factor = parseFloat(chipDom.dataset.factor || '1')
      const ing = ingredients.find(i => i.id === ingredientId)
      const name = ing?.name ?? ingredientId ?? '?'
      const base = ing?.amount != null ? ing.amount * factor : 0
      const unit = ing?.unit ?? ''
      const amtStr = base > 0 ? `${parseFloat(base.toFixed(4))} ${unit}`.trim() : ''
      const displayOverride = chipDom.dataset.displayOverride || null
      const qtyStr = displayOverride || amtStr
      chipDom.title = `${name} × ${factor}`
      chipDom.innerHTML = ''
      if (qtyStr) {
        const qtyEl = document.createElement('span')
        qtyEl.className = 'ing-chip-qty'
        qtyEl.textContent = qtyStr
        chipDom.appendChild(qtyEl)
        chipDom.appendChild(document.createTextNode(' '))
      }
      const nameEl = document.createElement('span')
      nameEl.className = 'ing-chip-name'
      nameEl.textContent = name
      chipDom.appendChild(nameEl)
    })
  }

  /** @returns {Object} ProseMirror JSON doc */
  getDoc() {
    return this.editor.getJSON()
  }

  /** @param {Object} doc ProseMirror JSON doc */
  setDoc(doc) {
    this.editor.commands.setContent(doc || { type: 'doc', content: [{ type: 'paragraph' }] })
  }

  insertIngredientRef(ingredientId, factor = 1.0, displayOverride = null) {
    this.editor.chain().focus().insertContent({
      type: 'ingredientRef',
      attrs: { ingredientId, factor, displayOverride },
    }).run()
  }

  destroy() {
    this.editor.destroy()
  }
}
