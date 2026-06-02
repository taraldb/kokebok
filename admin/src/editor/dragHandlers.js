/**
 * Make ingredient sidebar rows draggable.
 * On drop into a step editor, inserts an ingredientRef node at cursor.
 *
 * Uses text/plain JSON (Safari blocks application/json).
 */

export function makeDraggable(el, ingredientId) {
  el.draggable = true
  el.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'ingredientRef', ingredientId }))
    e.dataTransfer.effectAllowed = 'copy'
  })
}

/**
 * Wire a step editor mount to accept drops from the ingredient sidebar.
 * @param {HTMLElement} mountEl  The .step-editor-mount div
 * @param {import('./StepEditor').StepEditor} stepEditor
 * @param {{ onDrop: (ingredientId:string, factor:number) => void }} opts
 */
export function wireDropTarget(mountEl, stepEditor, { onInsert }) {
  mountEl.addEventListener('dragover', e => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  })

  mountEl.addEventListener('drop', e => {
    e.preventDefault()
    let data
    try { data = JSON.parse(e.dataTransfer.getData('text/plain')) } catch { return }
    if (data.type !== 'ingredientRef' || !data.ingredientId) return

    // Default factor 1.0 — popover can refine it
    stepEditor.insertIngredientRef(data.ingredientId, 1.0, null)
    if (onInsert) onInsert(data.ingredientId)
  })
}
