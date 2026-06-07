import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { IngredientRefNode } from './IngredientRefNode.js'

export class StepEditor {
  /**
   * @param {HTMLElement} container
   * @param {Object} options
   * @param {Array}  options.ingredients
   * @param {Object} [options.initialDoc]
   * @param {Function} [options.onUpdate]
   */
  constructor(container, { ingredients = [], initialDoc = null, onUpdate, onFocus, onBlur } = {}) {
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
        IngredientRefNode.configure({ ingredients }),
      ],
      content: initialDoc || { type: 'doc', content: [{ type: 'paragraph' }] },
      onUpdate: onUpdate ? ({ editor }) => onUpdate(editor.getJSON()) : undefined,
      onFocus: onFocus ? () => onFocus() : undefined,
      onBlur:  onBlur  ? () => onBlur()  : undefined,
    })
  }

  setIngredients(ingredients) {
    this.editor.extensionManager.extensions
      .find(e => e.name === 'ingredientRef')
      ?.storage && (
        this.editor.extensionManager.extensions.find(e => e.name === 'ingredientRef').storage.ingredients = ingredients
      )
  }

  /** @returns {Object} ProseMirror JSON doc */
  getDoc() {
    return this.editor.getJSON()
  }

  /** @param {Object} doc ProseMirror JSON doc */
  setDoc(doc) {
    this.editor.commands.setContent(doc || { type: 'doc', content: [{ type: 'paragraph' }] })
  }

  /**
   * Insert an ingredientRef node at the current cursor position.
   * @param {string} ingredientId
   * @param {number} factor
   * @param {string|null} displayOverride
   */
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
