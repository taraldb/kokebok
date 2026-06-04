export class FactorPopover {
  constructor() {
    this._ing = null
    this._factor = 1.0
    this._mode = 'amount' // 'amount' | 'factor' — persists across opens
    this._onCommit = null
    this._dismiss = null

    this._el = document.createElement('div')
    this._el.className = 'factor-popover hidden'
    this._el.innerHTML = `
      <div class="fp-mode-tabs">
        <button class="fp-tab" data-mode="amount">Mengde</button>
        <button class="fp-tab" data-mode="factor">Faktor</button>
      </div>
      <div class="fp-preview" id="fp-preview"></div>
      <div id="fp-amount-row" class="fp-input-row">
        <input type="number" min="0" step="any" id="fp-amount-input" />
        <span class="fp-unit-label" id="fp-unit-label"></span>
      </div>
      <div id="fp-factor-row" class="fp-input-row" style="display:none">
        <input type="range" min="0.05" max="3" step="0.05" value="1" id="fp-slider" />
        <input type="number" min="0.01" step="0.01" value="1" id="fp-factor-input" />
      </div>
      <div class="fp-actions">
        <button id="fp-cancel">Avbryt</button>
        <button id="fp-ok" class="fp-ok-btn">OK</button>
      </div>
    `
    document.body.appendChild(this._el)

    this._el.querySelectorAll('.fp-tab').forEach(btn =>
      btn.addEventListener('click', () => this._setMode(btn.dataset.mode))
    )
    this._el.querySelector('#fp-amount-input').addEventListener('input', e => {
      const v = parseFloat(e.target.value)
      if (!isNaN(v) && v >= 0 && this._ing?.amount) {
        this._factor = v / this._ing.amount
        this._sync('amount')
      }
    })
    this._el.querySelector('#fp-slider').addEventListener('input', e => {
      this._factor = parseFloat(e.target.value)
      this._sync('slider')
    })
    this._el.querySelector('#fp-factor-input').addEventListener('input', e => {
      const v = parseFloat(e.target.value)
      if (!isNaN(v) && v > 0) { this._factor = v; this._sync('factor-input') }
    })
    this._el.querySelector('#fp-cancel').addEventListener('click', () => this.hide())
    this._el.querySelector('#fp-ok').addEventListener('click', () => {
      if (this._onCommit) this._onCommit(this._factor)
      this.hide()
    })
  }

  show(ing, initialFactor, onCommit, position) {
    this._ing = ing
    this._factor = initialFactor
    this._onCommit = onCommit

    const hasAmount = ing?.amount != null
    this._el.querySelector('[data-mode="amount"]').style.display = hasAmount ? '' : 'none'
    if (!hasAmount) this._mode = 'factor'

    this._setMode(this._mode)
    this._sync('init')

    this._el.classList.remove('hidden')
    this._el.style.left = `${position.x}px`
    this._el.style.top  = `${position.y}px`

    setTimeout(() => {
      this._dismiss = e => { if (!this._el.contains(e.target)) this.hide() }
      document.addEventListener('mousedown', this._dismiss)
    }, 50)
  }

  hide() {
    this._el.classList.add('hidden')
    if (this._dismiss) {
      document.removeEventListener('mousedown', this._dismiss)
      this._dismiss = null
    }
  }

  _setMode(mode) {
    this._mode = mode
    this._el.querySelectorAll('.fp-tab').forEach(t =>
      t.classList.toggle('fp-tab-active', t.dataset.mode === mode)
    )
    this._el.querySelector('#fp-amount-row').style.display = mode === 'amount' ? '' : 'none'
    this._el.querySelector('#fp-factor-row').style.display = mode === 'factor' ? '' : 'none'
  }

  _sync(source) {
    const ing = this._ing
    const amountInput  = this._el.querySelector('#fp-amount-input')
    const slider       = this._el.querySelector('#fp-slider')
    const factorInput  = this._el.querySelector('#fp-factor-input')
    const unitLabel    = this._el.querySelector('#fp-unit-label')

    if (source !== 'slider')       slider.value      = String(Math.min(3, Math.max(0.05, this._factor)))
    if (source !== 'factor-input') factorInput.value = this._factor.toFixed(2)
    if (ing?.amount != null) {
      const amt = ing.amount * this._factor
      if (source !== 'amount') amountInput.value = parseFloat(amt.toFixed(6))
      unitLabel.textContent = ing.unit || ''
    }

    this._updatePreview()
  }

  _updatePreview() {
    const ing = this._ing
    const el  = this._el.querySelector('#fp-preview')
    if (!ing || ing.amount == null) {
      el.textContent = `Faktor: ${this._factor.toFixed(2)}`
      return
    }
    const amt    = ing.amount * this._factor
    const amtStr = parseFloat(amt.toFixed(4))
    el.textContent = `${amtStr} ${ing.unit || ''} (× ${this._factor.toFixed(2)})`
  }
}
