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
    el.className = 'raw-modal-overlay hidden'
    el.innerHTML = `
      <div class="raw-modal">
        <div class="raw-modal-header">
          <h2>Lim inn oppskrift (JSON / YAML / Markdown)</h2>
          <button class="rm-close" aria-label="Lukk">✕</button>
        </div>
        <textarea id="raw-input" placeholder="Lim inn oppskrift her..." rows="12" spellcheck="false"></textarea>
        <div class="raw-modal-actions">
          <button id="raw-parse-btn" class="save-btn">Forhåndsvis</button>
        </div>
        <div id="raw-preview" class="raw-preview hidden"></div>
        <div id="raw-parse-error" class="raw-error hidden"></div>
        <div class="raw-modal-footer hidden" id="raw-footer">
          <span id="raw-warnings" class="raw-warnings"></span>
          <button id="raw-save-btn" class="save-btn">Lagre oppskrift</button>
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
    this._el.querySelector('#raw-footer').classList.add('hidden')
    this._el.querySelector('#raw-parse-error').classList.add('hidden')
  }

  async _parse() {
    const text = this._el.querySelector('#raw-input').value.trim()
    if (!text) return

    const errorEl = this._el.querySelector('#raw-parse-error')
    const previewEl = this._el.querySelector('#raw-preview')
    const footerEl = this._el.querySelector('#raw-footer')
    errorEl.classList.add('hidden')
    previewEl.classList.add('hidden')
    footerEl.classList.add('hidden')

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
    previewEl.innerHTML = `
      <strong>${esc(data.recipe.title)}</strong>
      <span class="raw-format-badge">${esc(data.format)}</span><br>
      <small>${data.recipe.ingredients.length} ingredienser, ${data.recipe.steps.length} steg</small>
      <pre>${esc(JSON.stringify({ id: data.recipe.id, tags: data.recipe.tags, meta: data.recipe.meta }, null, 2))}</pre>
    `
    previewEl.classList.remove('hidden')

    const warnEl = this._el.querySelector('#raw-warnings')
    if (data.warnings?.length) {
      warnEl.textContent = data.warnings.join('\n')
      warnEl.classList.remove('hidden')
    } else {
      warnEl.textContent = ''
    }
    footerEl.classList.remove('hidden')
  }

  async _save() {
    if (!this._recipe) return
    await this._onSave?.(this._recipe)
    this.hide()
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
