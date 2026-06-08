const PRESETS = [
  { label: '½',  value: 0.5   },
  { label: '⅔',  value: 0.667 },
  { label: '1',  value: 1     },
  { label: '1½', value: 1.5   },
  { label: '2',  value: 2     },
  { label: '3',  value: 3     },
]

export class FactorPopover {
  constructor() {
    this._ing = null
    this._factor = 1.0
    this._onCommit = null
    this._dismiss = null

    this._el = document.createElement('div')
    this._el.className = 'factor-pop hidden'
    this._el.innerHTML = `
      <div class="fp-name" id="fp-name"></div>
      <div class="fp-presets">
        ${PRESETS.map(p => `<button data-factor="${p.value}">${p.label}</button>`).join('')}
      </div>
      <div class="fp-amount" id="fp-amount-section">
        <span>Mengde</span>
        <div class="fp-amount-in">
          <input type="number" min="0" step="any" id="fp-amount-input" />
          <em id="fp-unit-label"></em>
        </div>
      </div>
      <div class="fp-foot">
        <span class="fp-factor-tag" id="fp-factor-tag">× 1.00</span>
        <button class="fp-rm" id="fp-rm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>
          Nullstill
        </button>
        <button class="fp-ok" id="fp-ok">OK</button>
      </div>
    `
    document.body.appendChild(this._el)

    this._el.querySelectorAll('.fp-presets button').forEach(btn =>
      btn.addEventListener('click', () => {
        this._factor = parseFloat(btn.dataset.factor)
        this._sync()
      })
    )
    this._el.querySelector('#fp-amount-input').addEventListener('input', e => {
      const v = parseFloat(e.target.value)
      if (!isNaN(v) && v >= 0 && this._ing?.amount) {
        this._factor = v / this._ing.amount
        this._sync('skip-amount')
      }
    })
    this._el.querySelector('#fp-rm').addEventListener('click', () => {
      this._factor = 1.0
      this._sync()
    })
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
    this._el.querySelector('#fp-amount-section').style.display = hasAmount ? '' : 'none'
    this._el.querySelector('#fp-name').textContent = ing?.name ?? ''

    this._sync()

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

  _sync(source) {
    const ing = this._ing
    const amountInput = this._el.querySelector('#fp-amount-input')
    const unitLabel   = this._el.querySelector('#fp-unit-label')
    const factorTag   = this._el.querySelector('#fp-factor-tag')

    factorTag.textContent = `× ${this._factor.toFixed(2)}`

    if (ing?.amount != null && source !== 'skip-amount') {
      amountInput.value = parseFloat((ing.amount * this._factor).toFixed(6))
      unitLabel.textContent = ing.unit || ''
    }

    // Highlight matching preset
    this._el.querySelectorAll('.fp-presets button').forEach(btn => {
      btn.classList.toggle('on', Math.abs(parseFloat(btn.dataset.factor) - this._factor) < 0.001)
    })
  }
}
