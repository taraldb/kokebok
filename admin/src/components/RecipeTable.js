import { relativeTime, fullTimestamp } from '../utils/time.js'

const CATEGORIES = ['frokost', 'middag', 'dessert', 'tilbehør', 'snacks']

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }

export class RecipeTable {
  constructor(container, { onEdit, onNew, onPaste }) {
    this.container = container
    this.onEdit = onEdit
    this.onNew = onNew
    this.onPaste = onPaste

    this.recipes = []
    this.filtered = []
    this.selected = new Set()
    this.sortCol = 'updated_at'
    this.sortAsc = false
    this.filterText = ''
    this.filterCategory = ''
    this.filterTags = new Set()
    this.allTags = []

    this._mount()
  }

  _mount() {
    this.container.innerHTML = `
      <div class="sticky top-0 z-20 bg-brown shadow-sm">
        <div class="flex items-center justify-between px-4 sm:px-6 py-3">
          <span class="font-semibold text-sm tracking-widest uppercase text-cream opacity-60">Kokebok Admin</span>
          <div class="flex items-center gap-2">
            <button id="rt-new-btn" class="bg-accent hover:opacity-90 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity">+ Ny oppskrift</button>
            <button id="rt-paste-btn" class="border border-white/30 hover:border-white/60 text-cream/70 hover:text-cream px-3 py-1.5 rounded-lg text-sm transition-colors hidden sm:inline-flex">⤵ Importer</button>
          </div>
        </div>
        <div class="px-4 sm:px-6 pb-3 flex flex-wrap gap-2 items-center">
          <div class="relative flex-1 min-w-40 max-w-xs">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cream/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
            <input id="rt-search" type="search" placeholder="Søk..." autocomplete="off"
              class="w-full bg-white/10 border border-white/20 rounded-lg pl-8 pr-3 py-1.5 text-sm text-cream placeholder:text-cream/40 outline-none focus:bg-white/15 focus:border-white/40" />
          </div>
          <select id="rt-cat-filter"
            class="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-cream outline-none focus:bg-white/15 focus:border-white/40">
            <option value="" class="bg-brown text-cream">Alle kategorier</option>
            ${CATEGORIES.map(c => `<option value="${c}" class="bg-brown text-cream">${cap(c)}</option>`).join('')}
          </select>
          <div id="rt-tag-filter-wrap" class="relative">
            <button id="rt-tag-filter-btn" class="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-cream/70 hover:text-cream hover:border-white/40 transition-colors">
              Tagger
              <span id="rt-tag-count" class="hidden bg-accent text-white rounded-full text-xs px-1.5 leading-5 min-w-[18px] text-center">0</span>
              <span class="text-cream/40 text-xs">▾</span>
            </button>
            <div id="rt-tag-dropdown" class="hidden absolute top-full left-0 mt-1 bg-kokebok-white border border-brown-light/50 rounded-xl shadow-xl p-3 min-w-[180px] z-30 max-h-60 overflow-y-auto">
              <div id="rt-tag-list" class="flex flex-col gap-0.5"></div>
            </div>
          </div>
          <button id="rt-clear-filters" class="hidden text-cream/50 hover:text-cream text-sm transition-colors px-1">✕</button>
          <span id="rt-count" class="text-cream/40 text-xs ml-auto tabular-nums"></span>
        </div>
      </div>

      <div id="rt-content" class="pb-20">
        <div class="hidden sm:block overflow-x-auto">
          <table class="w-full text-sm border-collapse" id="rt-table">
            <thead class="border-b border-brown-light/25 bg-brown/[0.03]">
              <tr>
                <th class="w-10 px-3 py-2.5 text-left">
                  <input type="checkbox" id="rt-select-all" class="rounded border-brown-light/60 cursor-pointer accent-accent" />
                </th>
                ${this._thHtml('title', 'Navn')}
                ${this._thHtml('category', 'Kategori')}
                <th class="px-3 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide text-left">Tagger</th>
                ${this._thHtml('updated_at', 'Oppdatert')}
                ${this._thHtml('created_at', 'Opprettet')}
                <th class="w-10 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody id="rt-tbody"></tbody>
          </table>
        </div>
        <div class="sm:hidden" id="rt-cards"></div>
        <div id="rt-empty" class="hidden py-16 text-center text-muted text-sm">Ingen oppskrifter funnet</div>
      </div>

      <div id="rt-batch-bar" class="hidden fixed bottom-0 left-0 right-0 bg-brown/96 backdrop-blur-sm text-cream px-4 py-3 shadow-2xl border-t border-white/10 z-30">
        <div class="max-w-4xl mx-auto flex flex-wrap items-center gap-3">
          <span id="rt-batch-count" class="text-sm font-semibold min-w-16 shrink-0"></span>
          <div class="flex items-center gap-2 flex-wrap">
            <label class="text-cream/60 text-xs hidden sm:block">Kategori</label>
            <select id="rt-batch-cat" class="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-sm text-cream outline-none focus:bg-white/15">
              <option value="" class="bg-brown">— velg —</option>
              <option value="__clear__" class="bg-brown">× Fjern kategori</option>
              ${CATEGORIES.map(c => `<option value="${c}" class="bg-brown">${cap(c)}</option>`).join('')}
            </select>
            <button id="rt-batch-cat-apply" class="bg-accent hover:opacity-90 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity">Bruk</button>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-cream/60 text-xs hidden sm:block">Legg til tag</label>
            <input id="rt-batch-add-tag" type="text" placeholder="tag1, tag2..." class="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-sm text-cream placeholder:text-white/35 outline-none focus:bg-white/15 w-32 sm:w-44" />
            <button id="rt-batch-tag-apply" class="bg-white/15 hover:bg-white/25 text-cream px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">+</button>
          </div>
          <div id="rt-batch-remove-tags" class="flex items-center gap-1.5 flex-wrap"></div>
          <button id="rt-batch-close" class="ml-auto text-cream/40 hover:text-cream text-lg leading-none transition-colors" title="Avbryt valg">✕</button>
        </div>
      </div>
    `
    this._bindEvents()
  }

  _thHtml(col, label) {
    const isActive = this.sortCol === col
    const arrow = isActive ? (this.sortAsc ? '↑' : '↓') : '↕'
    return `<th class="px-3 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide cursor-pointer hover:text-brown select-none whitespace-nowrap text-left" data-sort="${col}">
      ${label} <span class="opacity-40 text-[10px]" id="sort-arrow-${col}">${arrow}</span>
    </th>`
  }

  _bindEvents() {
    const q = id => this.container.querySelector(`#${id}`)

    q('rt-new-btn').addEventListener('click', () => this.onNew())
    q('rt-paste-btn').addEventListener('click', () => this.onPaste())

    q('rt-search').addEventListener('input', e => {
      this.filterText = e.target.value
      this._refresh()
    })

    q('rt-cat-filter').addEventListener('change', e => {
      this.filterCategory = e.target.value
      this._refresh()
    })

    q('rt-tag-filter-btn').addEventListener('click', e => {
      e.stopPropagation()
      q('rt-tag-dropdown').classList.toggle('hidden')
    })
    document.addEventListener('click', e => {
      const wrap = q('rt-tag-filter-wrap')
      if (wrap && !wrap.contains(e.target)) q('rt-tag-dropdown')?.classList.add('hidden')
    })

    q('rt-clear-filters').addEventListener('click', () => {
      this.filterText = ''
      this.filterCategory = ''
      this.filterTags.clear()
      q('rt-search').value = ''
      q('rt-cat-filter').value = ''
      this._renderTagDropdown()
      this._refresh()
    })

    q('rt-select-all')?.addEventListener('change', e => {
      if (e.target.checked) this.filtered.forEach(r => this.selected.add(r.id))
      else this.selected.clear()
      this._renderRows()
      this._renderBatchBar()
    })

    this.container.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort
        if (this.sortCol === col) this.sortAsc = !this.sortAsc
        else { this.sortCol = col; this.sortAsc = col === 'title' }
        this._refresh()
      })
    })

    q('rt-batch-cat-apply').addEventListener('click', () => this._batchSetCategory())
    q('rt-batch-tag-apply').addEventListener('click', () => this._batchAddTags())
    q('rt-batch-add-tag').addEventListener('keydown', e => { if (e.key === 'Enter') this._batchAddTags() })
    q('rt-batch-close').addEventListener('click', () => {
      this.selected.clear()
      this._renderRows()
      this._renderBatchBar()
    })
  }

  update(recipes) {
    this.recipes = recipes
    this.allTags = [...new Set(recipes.flatMap(r => r.tags || []))].sort()
    this.selected.clear()
    this._renderTagDropdown()
    this._refresh()
  }

  _refresh() {
    this._applyFilters()
    this._renderRows()
    this._renderBatchBar()
    this._updateFilterUI()
  }

  _applyFilters() {
    const q = this.filterText.toLowerCase()
    this.filtered = this.recipes.filter(r => {
      if (this.filterCategory && r.category !== this.filterCategory) return false
      if (q && !r.title.toLowerCase().includes(q)) return false
      if (this.filterTags.size > 0) {
        const rt = new Set(r.tags || [])
        for (const t of this.filterTags) if (!rt.has(t)) return false
      }
      return true
    }).sort((a, b) => {
      const av = a[this.sortCol] ?? 0
      const bv = b[this.sortCol] ?? 0
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'nb')
      return this.sortAsc ? cmp : -cmp
    })
  }

  _renderRows() {
    const tbody = this.container.querySelector('#rt-tbody')
    const cards = this.container.querySelector('#rt-cards')
    const countEl = this.container.querySelector('#rt-count')
    const emptyEl = this.container.querySelector('#rt-empty')

    const isEmpty = this.filtered.length === 0

    if (emptyEl) emptyEl.classList.toggle('hidden', !isEmpty)
    this.container.querySelector('.hidden.sm\\:block')?.classList.toggle('opacity-0', isEmpty)

    if (tbody) {
      tbody.innerHTML = this.filtered.map(r => this._rowHtml(r)).join('')
    }
    if (cards) {
      cards.innerHTML = this.filtered.map(r => this._cardHtml(r)).join('')
    }

    if (countEl) {
      countEl.textContent = this.filtered.length === this.recipes.length
        ? `${this.recipes.length}`
        : `${this.filtered.length} / ${this.recipes.length}`
    }

    const selectAll = this.container.querySelector('#rt-select-all')
    if (selectAll) {
      const selCount = this.filtered.filter(r => this.selected.has(r.id)).length
      selectAll.checked = selCount > 0 && selCount === this.filtered.length
      selectAll.indeterminate = selCount > 0 && selCount < this.filtered.length
    }

    this._wireRowEvents()
  }

  _rowHtml(r) {
    const sel = this.selected.has(r.id)
    const catLabel = r.category ? cap(r.category) : ''
    const tagPills = (r.tags || []).slice(0, 3).map(t =>
      `<span class="inline-block bg-brown/8 text-muted rounded-full px-2 py-px text-xs whitespace-nowrap">${esc(t)}</span>`
    ).join('')
    const extra = (r.tags || []).length > 3
      ? `<span class="text-muted/60 text-xs">+${r.tags.length - 3}</span>` : ''

    return `<tr class="border-b border-brown-light/20 hover:bg-brown/[0.03] transition-colors cursor-pointer ${sel ? 'bg-accent/[0.04]' : ''}" data-row-id="${esc(r.id)}">
      <td class="px-3 py-2.5" data-no-nav>
        <input type="checkbox" class="rt-row-cb rounded border-brown-light/60 cursor-pointer accent-accent" data-id="${esc(r.id)}" ${sel ? 'checked' : ''} />
      </td>
      <td class="px-3 py-2.5 font-medium text-brown">${esc(r.title)}</td>
      <td class="px-3 py-2.5">
        ${catLabel
          ? `<span class="inline-block bg-accent/10 text-accent rounded-full px-2.5 py-px text-xs font-medium">${esc(catLabel)}</span>`
          : '<span class="text-muted/30 text-xs">—</span>'}
      </td>
      <td class="px-3 py-2.5"><div class="flex flex-wrap gap-1">${tagPills}${extra}</div></td>
      <td class="px-3 py-2.5 text-muted text-xs whitespace-nowrap" title="${esc(fullTimestamp(r.updated_at))}">${relativeTime(r.updated_at)}</td>
      <td class="px-3 py-2.5 text-muted text-xs whitespace-nowrap" title="${esc(fullTimestamp(r.created_at))}">${relativeTime(r.created_at)}</td>
      <td class="px-2 py-2.5 text-right" data-no-nav>
        <button class="rt-edit-btn text-muted/50 hover:text-accent p-1.5 rounded-lg hover:bg-accent/8 transition-colors text-base leading-none" data-id="${esc(r.id)}" title="Rediger">✎</button>
      </td>
    </tr>`
  }

  _cardHtml(r) {
    const sel = this.selected.has(r.id)
    const catLabel = r.category ? cap(r.category) : null
    const tagPills = (r.tags || []).slice(0, 3).map(t =>
      `<span class="inline-block bg-brown/8 text-muted rounded-full px-2 py-px text-xs">${esc(t)}</span>`
    ).join('')
    const extra = (r.tags || []).length > 3
      ? `<span class="text-muted/60 text-xs">+${r.tags.length - 3}</span>` : ''

    return `<div class="flex items-start gap-3 px-4 py-3 border-b border-brown-light/20 transition-colors ${sel ? 'bg-accent/[0.04]' : 'active:bg-brown/5'}" data-row-id="${esc(r.id)}">
      <div class="pt-0.5 shrink-0" data-no-nav>
        <input type="checkbox" class="rt-row-cb rounded border-brown-light/60 cursor-pointer accent-accent" data-id="${esc(r.id)}" ${sel ? 'checked' : ''} />
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-brown text-sm leading-snug">${esc(r.title)}</div>
        <div class="flex flex-wrap gap-1 mt-1">
          ${catLabel ? `<span class="inline-block bg-accent/10 text-accent rounded-full px-2 py-px text-xs font-medium">${esc(catLabel)}</span>` : ''}
          ${tagPills}${extra}
        </div>
        <div class="text-xs text-muted/70 mt-1.5" title="${esc(fullTimestamp(r.updated_at))}">Oppdatert ${relativeTime(r.updated_at)}</div>
      </div>
      <button class="rt-edit-btn shrink-0 text-muted/50 hover:text-accent p-2 rounded-lg hover:bg-accent/8 transition-colors text-base leading-none -mr-1" data-id="${esc(r.id)}" title="Rediger" data-no-nav>✎</button>
    </div>`
  }

  _wireRowEvents() {
    this.container.querySelectorAll('[data-row-id]').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('[data-no-nav]')) return
        this.onEdit(row.dataset.rowId)
      })
    })

    this.container.querySelectorAll('.rt-row-cb').forEach(cb => {
      cb.addEventListener('change', e => {
        e.stopPropagation()
        const id = cb.dataset.id
        if (cb.checked) this.selected.add(id)
        else this.selected.delete(id)
        this.container.querySelectorAll(`[data-row-id="${id}"]`).forEach(row => {
          row.classList.toggle('bg-accent/[0.04]', cb.checked)
        })
        this._updateSelectAll()
        this._renderBatchBar()
      })
    })

    this.container.querySelectorAll('.rt-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.onEdit(btn.dataset.id) })
    })
  }

  _updateSelectAll() {
    const selectAll = this.container.querySelector('#rt-select-all')
    if (!selectAll) return
    const selCount = this.filtered.filter(r => this.selected.has(r.id)).length
    selectAll.checked = selCount > 0 && selCount === this.filtered.length
    selectAll.indeterminate = selCount > 0 && selCount < this.filtered.length
  }

  _renderBatchBar() {
    const bar = this.container.querySelector('#rt-batch-bar')
    const countEl = this.container.querySelector('#rt-batch-count')
    const removeTagsEl = this.container.querySelector('#rt-batch-remove-tags')
    if (!bar) return

    const count = this.selected.size
    if (count === 0) {
      bar.classList.add('hidden')
      return
    }
    bar.classList.remove('hidden')
    if (countEl) countEl.textContent = count === 1 ? '1 valgt' : `${count} valgt`

    // Build remove-tag pills from tags present in any selected recipe
    if (removeTagsEl) {
      const selectedTags = [...new Set(
        [...this.selected].flatMap(id => {
          const r = this.recipes.find(r => r.id === id)
          return r?.tags || []
        })
      )].sort()

      if (selectedTags.length) {
        removeTagsEl.innerHTML = `<span class="text-cream/60 text-xs hidden sm:block shrink-0">Fjern tag:</span>` +
          selectedTags.map(t =>
            `<button class="rt-remove-tag-btn flex items-center gap-1 bg-white/10 hover:bg-red-900/50 border border-white/20 hover:border-red-400/50 text-cream text-xs px-2 py-1 rounded-full transition-colors" data-tag="${esc(t)}">
              ${esc(t)} <span class="opacity-60">×</span>
            </button>`
          ).join('')
        removeTagsEl.querySelectorAll('.rt-remove-tag-btn').forEach(btn => {
          btn.addEventListener('click', () => this._batchRemoveTag(btn.dataset.tag))
        })
      } else {
        removeTagsEl.innerHTML = ''
      }
    }
  }

  _renderTagDropdown() {
    const list = this.container.querySelector('#rt-tag-list')
    const countEl = this.container.querySelector('#rt-tag-count')
    if (!list) return

    if (this.allTags.length === 0) {
      list.innerHTML = '<p class="text-muted text-sm px-2 py-1">Ingen tagger</p>'
    } else {
      list.innerHTML = this.allTags.map(tag => {
        const checked = this.filterTags.has(tag)
        return `<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-cream cursor-pointer">
          <input type="checkbox" class="rt-tag-cb rounded border-brown-light/60 accent-accent" data-tag="${esc(tag)}" ${checked ? 'checked' : ''} />
          <span class="text-sm text-text">${esc(tag)}</span>
        </label>`
      }).join('')

      list.querySelectorAll('.rt-tag-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) this.filterTags.add(cb.dataset.tag)
          else this.filterTags.delete(cb.dataset.tag)
          this._updateTagCount()
          this._refresh()
        })
      })
    }

    this._updateTagCount()
  }

  _updateTagCount() {
    const countEl = this.container.querySelector('#rt-tag-count')
    if (!countEl) return
    const n = this.filterTags.size
    if (n > 0) { countEl.textContent = n; countEl.classList.remove('hidden') }
    else countEl.classList.add('hidden')
  }

  _updateFilterUI() {
    const clearBtn = this.container.querySelector('#rt-clear-filters')
    const hasFilters = this.filterText || this.filterCategory || this.filterTags.size > 0
    if (clearBtn) clearBtn.classList.toggle('hidden', !hasFilters)

    // Update sort arrows
    ;['title', 'category', 'updated_at', 'created_at'].forEach(col => {
      const el = this.container.querySelector(`#sort-arrow-${col}`)
      if (!el) return
      if (col === this.sortCol) el.textContent = this.sortAsc ? '↑' : '↓'
      else el.textContent = '↕'
    })
  }

  async _batchSetCategory() {
    const sel = this.container.querySelector('#rt-batch-cat')
    if (!sel || !sel.value) return
    const category = sel.value === '__clear__' ? null : sel.value
    const ids = [...this.selected]
    const res = await fetch('/api/admin/batch-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates: { category } }),
    })
    if (res.ok) {
      sel.value = ''
      ids.forEach(id => { const r = this.recipes.find(r => r.id === id); if (r) r.category = category })
      this.selected.clear()
      this._refresh()
    }
  }

  async _batchAddTags() {
    const input = this.container.querySelector('#rt-batch-add-tag')
    if (!input) return
    const addTags = input.value.split(',').map(t => t.trim()).filter(Boolean)
    if (!addTags.length) return
    const ids = [...this.selected]
    const res = await fetch('/api/admin/batch-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates: { addTags } }),
    })
    if (res.ok) {
      input.value = ''
      ids.forEach(id => {
        const r = this.recipes.find(r => r.id === id)
        if (r) r.tags = [...new Set([...(r.tags || []), ...addTags])]
      })
      this.allTags = [...new Set(this.recipes.flatMap(r => r.tags || []))].sort()
      this.selected.clear()
      this._renderTagDropdown()
      this._refresh()
    }
  }

  async _batchRemoveTag(tag) {
    const ids = [...this.selected]
    const res = await fetch('/api/admin/batch-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates: { removeTags: [tag] } }),
    })
    if (res.ok) {
      ids.forEach(id => {
        const r = this.recipes.find(r => r.id === id)
        if (r) r.tags = (r.tags || []).filter(t => t !== tag)
      })
      this.allTags = [...new Set(this.recipes.flatMap(r => r.tags || []))].sort()
      this.selected.clear()
      this._renderTagDropdown()
      this._refresh()
    }
  }
}
