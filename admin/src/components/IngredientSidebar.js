/**
 * Ingredient sidebar panel: shows ingredients as draggable rows
 * with Σ factor badges (green=1.0±0.02, orange=used but ≠1, grey=0).
 */
import { makeDraggable } from '../editor/dragHandlers.js'

export class IngredientSidebar {
  /**
   * @param {HTMLElement} container
   * @param {Array} ingredients
   * @param {{ onDragIng?: Function }} opts
   */
  constructor(container, ingredients, opts = {}) {
    this._container = container
    this._ingredients = ingredients
    this._opts = opts
    this._sums = {}  // ingredientId → total factor sum
    this.render()
  }

  update(ingredients) {
    this._ingredients = ingredients
    this.render()
  }

  /**
   * Update factor sums from all step editors.
   * @param {{ [ingredientId: string]: number }} sums
   */
  updateSums(sums) {
    this._sums = sums
    this._updateBadges()
  }

  render() {
    this._container.innerHTML = `
      <div class="ing-sidebar-sticky">
        <div class="section-head" style="margin-top:0">
          <span>Ingredienser</span>
        </div>
        <div class="ing-sidebar-panel">
          <ul class="ing-sidebar-list" id="ing-sidebar-list"></ul>
        </div>
      </div>
    `
    const ul = this._container.querySelector('#ing-sidebar-list')
    this._ingredients.forEach(ing => {
      const li = document.createElement('li')
      li.className = 'ing-sidebar-item'
      li.dataset.ingId = ing.id
      li.innerHTML = `
        <span class="ing-sidebar-name">${esc(ing.name)}</span>
        <span class="ing-total">${ing.amount != null ? `${ing.amount} ${ing.unit || ''}` : '—'}</span>
        <span class="ing-remaining" data-rem-id="${esc(ing.id)}"></span>
        <span class="ing-sum-badge" data-sum-id="${esc(ing.id)}">—</span>
      `
      makeDraggable(li, ing.id)
      li.addEventListener('click', () => this._opts.onInsert?.(ing.id))
      ul.appendChild(li)
    })
    this._updateBadges()
  }

  _updateBadges() {
    const container = this._container
    this._ingredients.forEach(ing => {
      const badge = container.querySelector(`[data-sum-id="${ing.id}"]`)
      const remEl = container.querySelector(`[data-rem-id="${ing.id}"]`)
      if (!badge) return
      const sum = this._sums[ing.id] ?? 0
      if (sum === 0) {
        badge.textContent = '—'
        badge.className = 'ing-sum-badge sum-grey'
        if (remEl) remEl.textContent = ''
      } else {
        const display = sum.toFixed(2).replace(/\.?0+$/, '')
        badge.textContent = `Σ ${display}`
        const diff = Math.abs(sum - 1.0)
        badge.className = 'ing-sum-badge ' + (diff <= 0.02 ? 'sum-green' : 'sum-orange')
        if (remEl && ing.amount != null) {
          const rem = ing.amount * (1 - sum)
          const remDisplay = parseFloat(rem.toFixed(4))
          remEl.textContent = rem > 0.001 ? `rest: ${remDisplay} ${ing.unit || ''}`.trim() : ''
        } else if (remEl) {
          remEl.textContent = ''
        }
      }
    })
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
