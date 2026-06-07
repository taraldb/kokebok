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
      <!-- Header zone: white bar with nav + filters -->
      <div class="sticky top-0 z-20 bg-kokebok-white border-b border-brown-light/25 shadow-[0_1px_4px_rgba(61,43,31,0.07)]">

        <!-- Top row: title + actions -->
        <div class="flex items-center justify-between px-4 sm:px-6 py-4">
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-semibold text-brown text-base tracking-tight">Kokebok</span>
            <span class="text-brown-light/70 text-sm select-none">/</span>
            <span class="text-muted text-sm font-normal">Oppskrifter</span>
            <span id="rt-count" class="text-muted/50 text-xs tabular-nums ml-1"></span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button id="rt-paste-btn"
              class="hidden sm:inline-flex items-center gap-1.5 border border-brown-light/50 hover:border-brown/60 text-muted hover:text-brown px-3 py-1.5 rounded-lg text-sm transition-colors">
              ⤵ <span>Importer</span>
            </button>
            <button id="rt-new-btn"
              class="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white px-4 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-opacity">
              + <span>Ny oppskrift</span>
            </button>
          </div>
        </div>

        <!-- Filter row -->
        <div class="px-4 sm:px-6 pb-4 flex flex-wrap gap-2 items-center">
          <div class="relative flex-1 min-w-40 max-w-xs">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted/50 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
            <input id="rt-search" type="search" placeholder="Søk oppskrifter…" autocomplete="off"
              class="w-full bg-white/70 border border-brown-light/40 rounded-lg pl-8 pr-3 py-1.5 text-sm text-brown placeholder:text-muted/50 outline-none focus:border-brown-light focus:ring-1 focus:ring-accent/20 transition-colors" />
          </div>

          <select id="rt-cat-filter"
            class="bg-white/70 border border-brown-light/40 rounded-lg px-3 py-1.5 text-sm text-brown outline-none focus:border-brown-light focus:ring-1 focus:ring-accent/20 transition-colors cursor-pointer">
            <option value="">Alle kategorier</option>
            ${CATEGORIES.map(c => `<option value="${c}">${cap(c)}</option>`).join('')}
          </select>

          <div id="rt-tag-filter-wrap" class="relative">
            <button id="rt-tag-filter-btn"
              class="flex items-center gap-1.5 bg-white/70 border border-brown-light/40 rounded-lg px-3 py-1.5 text-sm text-muted hover:text-brown hover:border-brown-light transition-colors cursor-pointer">
              Tagger
              <span id="rt-tag-count" class="hidden bg-accent text-white rounded-full text-xs px-1.5 leading-5 min-w-[18px] text-center font-medium">0</span>
              <svg class="w-3 h-3 text-muted/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div id="rt-tag-dropdown"
              class="hidden absolute top-full left-0 mt-1.5 bg-kokebok-white border border-brown-light/40 rounded-xl shadow-lg p-2 min-w-[180px] z-30 max-h-60 overflow-y-auto">
              <div id="rt-tag-list" class="flex flex-col gap-0.5"></div>
            </div>
          </div>

          <button id="rt-clear-filters" class="hidden text-accent/80 hover:text-accent text-sm transition-colors px-1 flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            Nullstill
          </button>
        </div>
      </div>

      <!-- Table / cards area -->
      <div id="rt-content" class="pb-24">

        <!-- Desktop table -->
        <div class="hidden sm:block">
          <table class="w-full text-sm border-collapse" id="rt-table">
            <thead>
              <tr class="border-b border-brown-light/20">
                <th class="w-10 px-4 py-3 text-left bg-brown/[0.025]">
                  <input type="checkbox" id="rt-select-all"
                    class="rounded border-brown-light/60 cursor-pointer accent-accent" />
                </th>
                ${this._thHtml('title', 'Navn')}
                ${this._thHtml('category', 'Kategori')}
                <th class="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-left bg-brown/[0.025] select-none whitespace-nowrap">Tagger</th>
                ${this._thHtml('updated_at', 'Oppdatert')}
                ${this._thHtml('created_at', 'Opprettet')}
                <th class="w-10 px-3 py-3 bg-brown/[0.025]"></th>
              </tr>
            </thead>
            <tbody id="rt-tbody"></tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="sm:hidden divide-y divide-brown-light/20" id="rt-cards"></div>

        <!-- Empty state -->
        <div id="rt-empty" class="hidden py-20 text-center">
          <div class="text-muted/40 text-4xl mb-3">🍽</div>
          <p class="text-muted text-sm">Ingen oppskrifter funnet</p>
        </div>
      </div>

      <!-- Batch action bar (sticky bottom, dark inverted) -->
      <div id="rt-batch-bar"
        class="hidden fixed bottom-0 left-0 right-0 bg-brown/95 backdrop-blur-sm text-cream px-4 py-3 shadow-2xl border-t border-white/8 z-30">
        <div class="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
          <span id="rt-batch-count" class="text-sm font-semibold min-w-[70px] shrink-0 text-cream"></span>

          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-cream/50 text-xs hidden sm:block">Kategori</span>
            <select id="rt-batch-cat"
              class="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-sm text-cream outline-none focus:bg-white/15 cursor-pointer">
              <option value="" class="bg-brown">— velg —</option>
              <option value="__clear__" class="bg-brown">× Fjern kategori</option>
              ${CATEGORIES.map(c => `<option value="${c}" class="bg-brown">${cap(c)}</option>`).join('')}
            </select>
            <button id="rt-batch-cat-apply"
              class="bg-accent hover:bg-accent/90 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity shadow-sm">
              Bruk
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-cream/50 text-xs hidden sm:block">Legg til tag</span>
            <input id="rt-batch-add-tag" type="text" placeholder="tag1, tag2…"
              class="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-sm text-cream placeholder:text-white/30 outline-none focus:bg-white/15 w-32 sm:w-44 transition-colors" />
            <button id="rt-batch-tag-apply"
              class="bg-white/15 hover:bg-white/25 text-cream px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              +
            </button>
          </div>

          <div id="rt-batch-remove-tags" class="flex items-center gap-1.5 flex-wrap"></div>

          <button id="rt-batch-close"
            class="ml-auto text-cream/40 hover:text-cream transition-colors p-1" title="Avbryt valg">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    `
    this._bindEvents()
  }

  _thHtml(col, label) {
    const isActive = this.sortCol === col
    const arrow = isActive ? (this.sortAsc ? '↑' : '↓') : '↕'
    return `<th
      class="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:text-brown select-none whitespace-nowrap text-left bg-brown/[0.025] transition-colors"
      data-sort="${col}">
      ${label} <span class="opacity-40 text-[10px] ml-0.5" id="sort-arrow-${col}">${arrow}</span>
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
    const tableEl = this.container.querySelector('.hidden.sm\\:block')

    const isEmpty = this.filtered.length === 0
    if (emptyEl) emptyEl.classList.toggle('hidden', !isEmpty)
    if (tableEl) tableEl.style.visibility = isEmpty ? 'hidden' : ''

    if (tbody) tbody.innerHTML = this.filtered.map(r => this._rowHtml(r)).join('')
    if (cards) cards.innerHTML = this.filtered.map(r => this._cardHtml(r)).join('')

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
      `<span class="inline-block bg-brown/[0.07] text-muted rounded-full px-2 py-px text-xs whitespace-nowrap">${esc(t)}</span>`
    ).join('')
    const extra = (r.tags || []).length > 3
      ? `<span class="text-muted/50 text-xs">+${r.tags.length - 3}</span>` : ''

    return `<tr
      class="border-b border-brown-light/15 hover:bg-brown/[0.025] transition-colors cursor-pointer group ${sel ? 'bg-accent/[0.06]' : ''}"
      data-row-id="${esc(r.id)}">
      <td class="px-4 py-3.5" data-no-nav>
        <input type="checkbox" class="rt-row-cb rounded border-brown-light/50 cursor-pointer accent-accent" data-id="${esc(r.id)}" ${sel ? 'checked' : ''} />
      </td>
      <td class="px-4 py-3.5 font-medium text-brown">${esc(r.title)}</td>
      <td class="px-4 py-3.5">
        ${catLabel
          ? `<span class="inline-block bg-accent/10 text-accent rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">${esc(catLabel)}</span>`
          : '<span class="text-brown-light/50 text-xs">—</span>'}
      </td>
      <td class="px-4 py-3.5">
        <div class="flex flex-wrap gap-1">${tagPills}${extra}</div>
      </td>
      <td class="px-4 py-3.5 text-muted text-xs whitespace-nowrap tabular-nums" title="${esc(fullTimestamp(r.updated_at))}">${relativeTime(r.updated_at)}</td>
      <td class="px-4 py-3.5 text-muted text-xs whitespace-nowrap tabular-nums" title="${esc(fullTimestamp(r.created_at))}">${relativeTime(r.created_at)}</td>
      <td class="px-3 py-3.5 text-right" data-no-nav>
        <button
          class="rt-edit-btn opacity-0 group-hover:opacity-100 text-muted/60 hover:text-accent hover:bg-accent/8 p-1.5 rounded-lg transition-all text-sm leading-none"
          data-id="${esc(r.id)}" title="Rediger">
          ✎
        </button>
      </td>
    </tr>`
  }

  _cardHtml(r) {
    const sel = this.selected.has(r.id)
    const catLabel = r.category ? cap(r.category) : null
    const tagPills = (r.tags || []).slice(0, 4).map(t =>
      `<span class="inline-block bg-brown/[0.07] text-muted rounded-full px-2 py-px text-xs">${esc(t)}</span>`
    ).join('')
    const extra = (r.tags || []).length > 4
      ? `<span class="text-muted/50 text-xs">+${r.tags.length - 4}</span>` : ''

    return `<div
      class="flex items-start gap-3 px-4 py-3.5 bg-kokebok-white transition-colors active:bg-brown/[0.03] ${sel ? 'bg-accent/[0.05]' : ''}"
      data-row-id="${esc(r.id)}">
      <div class="pt-0.5 shrink-0" data-no-nav>
        <input type="checkbox" class="rt-row-cb rounded border-brown-light/50 cursor-pointer accent-accent" data-id="${esc(r.id)}" ${sel ? 'checked' : ''} />
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-brown text-sm leading-snug mb-1">${esc(r.title)}</div>
        <div class="flex flex-wrap items-center gap-1">
          ${catLabel ? `<span class="inline-block bg-accent/10 text-accent rounded-full px-2 py-px text-xs font-medium">${esc(catLabel)}</span>` : ''}
          ${tagPills}${extra}
        </div>
        <div class="text-xs text-muted/60 mt-1.5" title="${esc(fullTimestamp(r.updated_at))}">Oppdatert ${relativeTime(r.updated_at)}</div>
      </div>
      <button
        class="rt-edit-btn shrink-0 text-muted/40 hover:text-accent hover:bg-accent/8 p-2 rounded-lg transition-colors text-sm leading-none -mr-1 mt-0.5"
        data-id="${esc(r.id)}" title="Rediger" data-no-nav>
        ✎
      </button>
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
          if (row.tagName === 'TR') row.classList.toggle('bg-accent/[0.06]', cb.checked)
          else row.classList.toggle('bg-accent/[0.05]', cb.checked)
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
    if (count === 0) { bar.classList.add('hidden'); return }
    bar.classList.remove('hidden')
    if (countEl) countEl.textContent = count === 1 ? '1 valgt' : `${count} valgt`

    if (removeTagsEl) {
      const selectedTags = [...new Set(
        [...this.selected].flatMap(id => {
          const r = this.recipes.find(r => r.id === id)
          return r?.tags || []
        })
      )].sort()

      if (selectedTags.length) {
        removeTagsEl.innerHTML =
          `<span class="text-cream/50 text-xs hidden sm:block shrink-0">Fjern tag:</span>` +
          selectedTags.map(t =>
            `<button class="rt-remove-tag-btn flex items-center gap-1 bg-white/10 hover:bg-red-900/40 border border-white/15 hover:border-red-400/40 text-cream/80 hover:text-cream text-xs px-2 py-1 rounded-full transition-colors" data-tag="${esc(t)}">
              ${esc(t)} <span class="opacity-50 ml-0.5">×</span>
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
    if (!list) return

    if (this.allTags.length === 0) {
      list.innerHTML = '<p class="text-muted text-sm px-2 py-1.5">Ingen tagger</p>'
    } else {
      list.innerHTML = this.allTags.map(tag => {
        const checked = this.filterTags.has(tag)
        return `<label class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-cream cursor-pointer transition-colors">
          <input type="checkbox" class="rt-tag-cb rounded border-brown-light/60 accent-accent shrink-0" data-tag="${esc(tag)}" ${checked ? 'checked' : ''} />
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
