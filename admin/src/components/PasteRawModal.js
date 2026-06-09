import { esc } from '../utils/html.js'

/**
 * Modal for pasting raw recipe text (JSON/YAML/Markdown).
 * Shows preview before saving.
 */
export class PasteRawModal {
  constructor({ onSave } = {}) {
    this._onSave = onSave
    this._recipe = null
    this._el = this._create()
    document.body.appendChild(this._el)
  }

  _create() {
    const el = document.createElement('div')
    el.className = 'modal-overlay hidden'
    el.innerHTML = `
      <div class="modal paste-modal">
        <div class="paste-head">
          <h3>Lim inn oppskrift</h3>
          <button class="icon-btn rm-close" aria-label="Lukk">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>
          </button>
        </div>
        <textarea id="raw-input" class="paste-area" placeholder="Lim inn JSON, YAML eller Markdown…" rows="12" spellcheck="false"></textarea>
        <div id="raw-parse-error" class="paste-err hidden"></div>
        <div id="raw-preview" class="paste-preview hidden"></div>
        <div class="modal-actions">
          <button id="raw-parse-btn" class="ghost-btn">Forhåndsvis</button>
          <button id="raw-save-btn" class="primary-btn hidden">Lagre oppskrift</button>
        </div>
      </div>
    `
    el.querySelector('.rm-close').addEventListener('click', () => this.hide())
    el.addEventListener('click', e => { if (e.target === el) this.hide() })
    el.querySelector('#raw-parse-btn').addEventListener('click', () => this._parse())
    el.querySelector('#raw-save-btn').addEventListener('click', () => this._save())
    return el
  }

  show() {
    this._el.classList.remove('hidden')
    this._el.querySelector('#raw-input').focus()
  }

  hide() {
    this._el.classList.add('hidden')
    this._recipe = null
    this._el.querySelector('#raw-input').value = ''
    this._el.querySelector('#raw-preview').classList.add('hidden')
    this._el.querySelector('#raw-save-btn').classList.add('hidden')
    this._el.querySelector('#raw-parse-error').classList.add('hidden')
  }

  async _parse() {
    const text = this._el.querySelector('#raw-input').value.trim()
    if (!text) return

    const errorEl   = this._el.querySelector('#raw-parse-error')
    const previewEl = this._el.querySelector('#raw-preview')
    const saveBtn   = this._el.querySelector('#raw-save-btn')
    errorEl.classList.add('hidden')
    previewEl.classList.add('hidden')
    saveBtn.classList.add('hidden')

    const res = await fetch('/api/admin/import-raw', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: text,
    })
    const data = await res.json()

    if (!res.ok || !data.recipe) {
      errorEl.textContent = data.error || 'Kunne ikke parse innholdet.'
      errorEl.classList.remove('hidden')
      return
    }

    this._recipe = data.recipe
    const warnings = data.warnings?.length
      ? `<div class="pp-warn">${data.warnings.map(w => `<span>${esc(w)}</span>`).join('')}</div>`
      : ''
    previewEl.innerHTML = `
      <div class="pp-title">
        <span>${esc(data.recipe.title)}</span>
        <span class="pp-badge">${esc(data.format)}</span>
      </div>
      <div class="pp-meta">${data.recipe.ingredients.length} ingredienser · ${data.recipe.steps.length} steg</div>
      ${warnings}
    `
    previewEl.classList.remove('hidden')
    saveBtn.classList.remove('hidden')
  }

  async _save() {
    if (!this._recipe) return
    await this._onSave?.(this._recipe)
    this.hide()
  }
}

