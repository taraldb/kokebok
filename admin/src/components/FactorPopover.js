/**
 * Minimal factor popover: shown when clicking an ing-chip.
 * Slider + numeric input; live preview. Commits via onCommit(factor).
 */
export class FactorPopover {
  constructor() {
    this._el = null
    this._onCommit = null
    this._currentIngredient = null
    this._factor = 1.0
    this._createdDismiss = null

    this._el = document.createElement('div')
    this._el.className = 'factor-popover hidden'
    this._el.innerHTML = `
      <div class="fp-header">Mengde-faktor</div>
      <div class="fp-preview" id="fp-preview">1,0 × ? = ?</div>
      <input type="range" min="0.1" max="2" step="0.05" value="1" id="fp-slider" />
      <input type="number" min="0.01" max="10" step="0.01" value="1" id="fp-number" />
      <div class="fp-actions">
        <button id="fp-cancel">Avbryt</button>
        <button id="fp-ok" class="fp-ok-btn">OK</button>
      </div>
    `
    document.body.appendChild(this._el)

    this._el.querySelector('#fp-slider').addEventListener('input', e => {
      this._factor = parseFloat(e.target.value)
      this._sync('slider')
    })
    this._el.querySelector('#fp-number').addEventListener('input', e => {
      const v = parseFloat(e.target.value)
      if (!isNaN(v) && v > 0) { this._factor = v; this._sync('number') }
    })
    this._el.querySelector('#fp-cancel').addEventListener('click', () => this.hide())
    this._el.querySelector('#fp-ok').addEventListener('click', () => {
      if (this._onCommit) this._onCommit(this._factor)
      this.hide()
    })
  }

  /**
   * @param {{ id:string, amount:number|null, unit:string|null, name:string }|null} ing
   * @param {number} initialFactor
   * @param {Function} onCommit
   * @param {{ x: number, y: number }} position
   */
  show(ing, initialFactor, onCommit, position) {
    this._currentIngredient = ing
    this._factor = initialFactor
    this._onCommit = onCommit

    this._el.querySelector('#fp-slider').value = String(this._factor)
    this._el.querySelector('#fp-number').value = String(this._factor)
    this._updatePreview()

    this._el.classList.remove('hidden')
    this._el.style.left = `${position.x}px`
    this._el.style.top  = `${position.y}px`

    // Dismiss on outside click
    setTimeout(() => {
      this._createdDismiss = e => {
        if (!this._el.contains(e.target)) this.hide()
      }
      document.addEventListener('mousedown', this._createdDismiss)
    }, 10)
  }

  hide() {
    this._el.classList.add('hidden')
    if (this._createdDismiss) {
      document.removeEventListener('mousedown', this._createdDismiss)
      this._createdDismiss = null
    }
  }

  _sync(source) {
    if (source !== 'slider') this._el.querySelector('#fp-slider').value = String(this._factor)
    if (source !== 'number') this._el.querySelector('#fp-number').value = String(this._factor)
    this._updatePreview()
  }

  _updatePreview() {
    const ing = this._currentIngredient
    const el = this._el.querySelector('#fp-preview')
    if (!ing || ing.amount == null) {
      el.textContent = `Faktor: ${this._factor.toFixed(2)}`
      return
    }
    const result = (ing.amount * this._factor).toFixed(2).replace(/\.?0+$/, '')
    el.textContent = `${this._factor.toFixed(2)} × ${ing.amount} ${ing.unit || ''} = ${result} ${ing.unit || ''}`
  }
}
