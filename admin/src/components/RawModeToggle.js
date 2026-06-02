/**
 * Raw YAML toggle for the full recipe.
 * Fetches /api/recipes/:id/yaml, shows a textarea.
 * Saving PUTs back the YAML to /api/recipes/:id/yaml.
 */
export class RawModeToggle {
  /**
   * @param {HTMLElement} container — where to mount
   * @param {string|null} recipeId
   * @param {{ onSaved: () => void }} opts
   */
  constructor(container, recipeId, { onSaved } = {}) {
    this._container = container
    this._recipeId = recipeId
    this._onSaved = onSaved
    this._active = false
    this._render()
  }

  _render() {
    this._container.innerHTML = `
      <div class="raw-toggle-bar">
        <button class="raw-toggle-btn" id="raw-toggle-btn">YAML-modus</button>
      </div>
      <div class="raw-editor hidden" id="raw-editor">
        <textarea id="raw-textarea" spellcheck="false" rows="30"></textarea>
        <div class="raw-error hidden" id="raw-error"></div>
        <div class="raw-actions">
          <button id="raw-save-btn" class="save-btn">Lagre YAML</button>
          <button id="raw-cancel-btn" class="add-row-btn">Avbryt</button>
        </div>
      </div>
    `
    this._container.querySelector('#raw-toggle-btn').addEventListener('click', () => this._toggle())
    this._container.querySelector('#raw-save-btn').addEventListener('click', () => this._saveYaml())
    this._container.querySelector('#raw-cancel-btn').addEventListener('click', () => this._hide())
  }

  async _toggle() {
    if (this._active) { this._hide(); return }
    if (!this._recipeId) { alert('Lagre oppskriften først.'); return }

    const res = await fetch(`/api/recipes/${this._recipeId}/yaml`)
    if (!res.ok) { alert('Kunne ikke hente YAML.'); return }
    const text = await res.text()

    this._container.querySelector('#raw-textarea').value = text
    this._container.querySelector('#raw-editor').classList.remove('hidden')
    this._container.querySelector('#raw-error').classList.add('hidden')
    this._active = true
    this._container.querySelector('#raw-toggle-btn').textContent = 'Skjul YAML'
  }

  _hide() {
    this._container.querySelector('#raw-editor').classList.add('hidden')
    this._active = false
    this._container.querySelector('#raw-toggle-btn').textContent = 'YAML-modus'
  }

  async _saveYaml() {
    const text = this._container.querySelector('#raw-textarea').value
    const errorEl = this._container.querySelector('#raw-error')
    errorEl.classList.add('hidden')

    const res = await fetch(`/api/recipes/${this._recipeId}/yaml`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/yaml' },
      body: text,
    })
    const data = await res.json()
    if (res.ok) {
      this._hide()
      if (this._onSaved) this._onSaved()
    } else {
      errorEl.textContent = data.error || 'Ugyldig YAML'
      errorEl.classList.remove('hidden')
    }
  }
}
