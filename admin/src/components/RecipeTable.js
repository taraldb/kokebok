import { relativeTime, fullTimestamp } from '../utils/time.js'

const CATEGORIES = ['frokost', 'middag', 'dessert', 'tilbehør', 'snacks']

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }

function isDark() {
  const t = document.documentElement.getAttribute('data-theme')
  if (t === 'dark') return true
  if (t === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function themeIcon() { return isDark() ? '☀' : '☾' }

const PENCIL = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>`

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
      <!-- Nav bar — matches frontend style -->
      <nav class="sticky top-0 z-20 border-b border-brown-light"
           style="background: color-mix(in srgb, var(--cream) 92%, transparent); backdrop-filter: blur(8px);">
        <div class="max-w-[1100px] mx-auto flex items-center gap-4 px-6 h-14">

          <!-- Logo + breadcrumb -->
          <div class="flex items-center gap-2 flex-shrink-0 min-w-0">
            <img src="/assets/logo.png" alt="" class="w-7 h-7 rounded-md flex-shrink-0" />
            <span class="text-brown flex items-center gap-1.5 text-sm min-w-0">
              <span class="flex-shrink-0 tracking-tight" style="font-family: 'Playfair Display', serif; font-size: 1.05rem;">Kokebok</span>
              <span class="text-brown-light/50 flex-shrink-0">/</span>
              <span class="text-muted font-normal truncate">Oppskrifter</span>
              <span id="rt-count" class="text-muted/35 text-xs tabular-nums flex-shrink-0 ml-0.5"></span>
            </span>
          </div>

          <div class="flex-1"></div>

          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <button id="rt-paste-btn"
              class="hidden sm:inline-flex items-center gap-1.5 border border-brown-light hover:border-brown-light text-muted hover:text-brown px-3 py-1.5 rounded-full text-sm transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              Importer
            </button>
            <button id="rt-new-btn"
              class="flex items-center gap-1.5 bg-accent hover:bg-accent/90 active:scale-95 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-all">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
              <span class="hidden sm:inline">Ny oppskrift</span>
              <span class="sm:hidden">Ny</span>
            </button>
            <button id="rt-theme-toggle"
              class="flex-shrink-0 flex items-center justify-center w-[34px] h-[34px] rounded-full border border-brown-light text-muted hover:border-accent hover:text-accent transition-colors text-[0.9rem]"
              aria-label="Bytt tema">${themeIcon()}</button>
          </div>
        </div>
      </nav>

      <!-- Filter bar -->
      <div class="border-b border-brown-light/20" style="background: color-mix(in srgb, var(--cream) 80%, transparent);">
        <div class="max-w-[1100px] mx-auto px-6 py-2.5 flex flex-wrap gap-2 items-center">
          <div class="relative flex-1 min-w-32 max-w-xs">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
            <input id="rt-search" type="search" placeholder="Søk…" autocomplete="off"
              class="w-full bg-kokebok-white/60 border border-brown-light/40 rounded-lg pl-8 pr-3 py-1.5 text-sm text-brown placeholder:text-muted/40 outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-all" />
          </div>

          <select id="rt-cat-filter"
            class="bg-kokebok-white/60 border border-brown-light/40 rounded-lg px-3 py-1.5 text-sm text-brown outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-all cursor-pointer">
            <option value="">Alle kategorier</option>
            ${CATEGORIES.map(c => `<option value="${c}">${cap(c)}</option>`).join('')}
          </select>

          <div id="rt-tag-filter-wrap" class="relative">
            <button id="rt-tag-filter-btn"
              class="flex items-center gap-1.5 bg-kokebok-white/60 border border-brown-light/40 rounded-lg px-3 py-1.5 text-sm text-muted hover:text-brown hover:border-brown-light transition-colors">
              Tagger
              <span id="rt-tag-count" class="hidden bg-accent text-white rounded-full text-xs px-1.5 leading-5 min-w-[18px] text-center font-medium">0</span>
              <svg class="w-3 h-3 text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div id="rt-tag-dropdown"
              class="hidden absolute top-full left-0 mt-1.5 bg-kokebok-white border border-brown-light/30 rounded-xl shadow-lg p-2 min-w-[180px] z-30 max-h-60 overflow-y-auto">
              <div id="rt-tag-list" class="flex flex-col gap-0.5"></div>
            </div>
          </div>

          <button id="rt-clear-filters" class="hidden items-center gap-1 text-accent/70 hover:text-accent text-sm transition-colors px-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            Nullstill
          </button>
        </div>
      </div>

      <!-- Page content -->
      <div id="rt-content" class="max-w-[1100px] mx-auto px-6 py-5 pb-28">

        <!-- Desktop table in card -->
        <div class="hidden sm:block rounded-2xl border border-brown-light/20 shadow-sm overflow-hidden" id="rt-table-card">
          <table class="w-full text-sm border-collapse bg-kokebok-white" id="rt-table">
            <thead>
              <tr class="border-b border-brown-light/20" style="background: color-mix(in srgb, var(--cream) 60%, var(--warm-white));">
                <th class="w-10 pl-5 pr-2 py-3">
                  <input type="checkbox" id="rt-select-all"
                    class="rounded border-brown-light/50 cursor-pointer accent-accent" />
                </th>
                ${this._thHtml('title', 'Navn')}
                ${this._thHtml('category', 'Kategori')}
                <th class="px-4 py-3 text-[11px] font-semibold text-muted/70 uppercase tracking-wider text-left select-none">Tagger</th>
                ${this._thHtml('updated_at', 'Oppdatert')}
                ${this._thHtml('created_at', 'Opprettet')}
                <th class="w-14 pr-5 py-3"></th>
              </tr>
            </thead>
            <tbody id="rt-tbody"></tbody>
          </table>
        </div>

        <!-- Mobile cards in card -->
        <div class="sm:hidden rounded-2xl border border-brown-light/20 shadow-sm overflow-hidden divide-y divide-brown-light/15 bg-kokebok-white" id="rt-cards"></div>

        <!-- Empty state -->
        <div id="rt-empty" class="hidden py-24 flex flex-col items-center justify-center gap-3">
          <div class="w-14 h-14 rounded-2xl bg-brown/[0.05] flex items-center justify-center">
            <svg class="w-7 h-7 text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </div>
          <div class="text-center">
            <p class="text-muted font-medium text-sm">Ingen oppskrifter funnet</p>
            <p class="text-muted/50 text-xs mt-0.5">Prøv å endre søk eller filtre</p>
          </div>
        </div>
      </div>

      <!-- Batch action bar: always-dark floating panel -->
      <div id="rt-batch-bar"
        class="hidden fixed bottom-0 left-0 right-0 border-t border-white/[0.07] shadow-2xl z-30"
        style="background: var(--batch-bar-bg); backdrop-filter: blur(10px);">
        <div class="max-w-[1100px] mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          <span id="rt-batch-count" class="text-sm font-semibold min-w-[70px] shrink-0 text-white/90"></span>

          <div class="flex items-center gap-2">
            <span class="text-white/35 text-xs hidden sm:block">Kategori</span>
            <select id="rt-batch-cat"
              class="bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-sm text-white/90 outline-none focus:bg-white/15 cursor-pointer">
              <option value="" class="bg-[#1a120c]">— velg —</option>
              <option value="__clear__" class="bg-[#1a120c]">× Fjern</option>
              ${CATEGORIES.map(c => `<option value="${c}" class="bg-[#1a120c]">${cap(c)}</option>`).join('')}
            </select>
            <button id="rt-batch-cat-apply"
              class="bg-accent hover:bg-accent/90 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95">
              Bruk
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-white/35 text-xs hidden sm:block">Legg til tag</span>
            <input id="rt-batch-add-tag" type="text" placeholder="tag1, tag2…"
              class="bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-sm text-white/90 placeholder:text-white/25 outline-none focus:bg-white/15 w-32 sm:w-44 transition-colors" />
            <button id="rt-batch-tag-apply"
              class="bg-white/12 hover:bg-white/20 border border-white/15 text-white/80 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              +
            </button>
          </div>

          <div id="rt-batch-remove-tags" class="flex items-center gap-1.5 flex-wrap"></div>

          <button id="rt-batch-close"
            class="ml-auto text-white/35 hover:text-white/90 hover:bg-white/10 transition-all p-1.5 rounded-lg" title="Avbryt valg (Esc)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    `
    this._bindEvents()
  }

  _thHtml(col, label) {
    const isActive = this.sortCol === col
    const arrow = isActive ? (this.sortAsc ? ' ↑' : ' ↓') : ''
    return `<th
      class="px-4 py-3 text-[11px] font-semibold text-muted/70 uppercase tracking-wider cursor-pointer hover:text-brown select-none whitespace-nowrap text-left transition-colors"
      data-sort="${col}">
      ${label}<span class="opacity-60" id="sort-arrow-${col}">${arrow}</span>
    </th>`
  }

  _bindEvents() {
    const q = id => this.container.querySelector(`#${id}`)

    q('rt-new-btn').addEventListener('click', () => this.onNew())
    q('rt-paste-btn').addEventListener('click', () => this.onPaste())

    // Theme toggle
    q('rt-theme-toggle').addEventListener('click', () => {
      const dark = isDark()
      const next = dark ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('theme', next)
      document.querySelectorAll('#rt-theme-toggle, #edit-theme-toggle').forEach(btn => {
        btn.textContent = themeIcon()
      })
    })

    // Esc clears selection
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.selected.size > 0) {
        this.selected.clear()
        this._renderRows()
        this._renderBatchBar()
      }
    })

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
    const tableCard = this.container.querySelector('#rt-table-card')
    const countEl = this.container.querySelector('#rt-count')
    const emptyEl = this.container.querySelector('#rt-empty')

    const isEmpty = this.filtered.length === 0
    if (emptyEl) emptyEl.classList.toggle('hidden', !isEmpty)
    if (tableCard) tableCard.style.display = isEmpty ? 'none' : ''
    if (cards) cards.style.display = isEmpty ? 'none' : ''

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
      `<span class="inline-block bg-brown/[0.07] text-muted/80 rounded-md px-2 py-px text-[11px] whitespace-nowrap">${esc(t)}</span>`
    ).join('')
    const extra = (r.tags || []).length > 3
      ? `<span class="text-muted/40 text-[11px]">+${r.tags.length - 3}</span>` : ''

    return `<tr
      class="border-b border-brown-light/10 transition-colors cursor-pointer ${sel ? 'bg-accent/[0.05]' : 'hover:bg-brown/[0.02]'}"
      data-row-id="${esc(r.id)}">
      <td class="pl-5 pr-2 py-3.5" data-no-nav>
        <input type="checkbox" class="rt-row-cb rounded border-brown-light/40 cursor-pointer accent-accent" data-id="${esc(r.id)}" ${sel ? 'checked' : ''} />
      </td>
      <td class="px-4 py-3.5 font-medium text-brown text-sm">${esc(r.title)}</td>
      <td class="px-4 py-3.5">
        ${catLabel
          ? `<span class="inline-block bg-accent/[0.12] text-accent rounded-md px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap">${esc(catLabel)}</span>`
          : '<span class="text-brown-light/40 text-xs">—</span>'}
      </td>
      <td class="px-4 py-3.5">
        <div class="flex flex-wrap gap-1">${tagPills}${extra}</div>
      </td>
      <td class="px-4 py-3.5 text-muted/70 text-xs whitespace-nowrap tabular-nums" title="${esc(fullTimestamp(r.updated_at))}">${relativeTime(r.updated_at)}</td>
      <td class="px-4 py-3.5 text-muted/70 text-xs whitespace-nowrap tabular-nums" title="${esc(fullTimestamp(r.created_at))}">${relativeTime(r.created_at)}</td>
      <td class="pr-5 py-3.5 text-right" data-no-nav>
        <button
          class="rt-edit-btn inline-flex items-center gap-1 text-muted/40 hover:text-accent hover:bg-accent/[0.08] px-2 py-1.5 rounded-lg transition-all text-xs font-medium"
          data-id="${esc(r.id)}" title="Rediger">
          ${PENCIL}
        </button>
      </td>
    </tr>`
  }

  _cardHtml(r) {
    const sel = this.selected.has(r.id)
    const catLabel = r.category ? cap(r.category) : null
    const tagPills = (r.tags || []).slice(0, 4).map(t =>
      `<span class="inline-block bg-brown/[0.07] text-muted/80 rounded-md px-2 py-px text-[11px]">${esc(t)}</span>`
    ).join('')
    const extra = (r.tags || []).length > 4
      ? `<span class="text-muted/40 text-[11px]">+${r.tags.length - 4}</span>` : ''

    return `<div
      class="flex items-start gap-3 px-5 py-4 transition-colors active:bg-brown/[0.025] ${sel ? 'bg-accent/[0.04]' : ''}"
      data-row-id="${esc(r.id)}">
      <div class="pt-0.5 shrink-0" data-no-nav>
        <input type="checkbox" class="rt-row-cb rounded border-brown-light/40 cursor-pointer accent-accent" data-id="${esc(r.id)}" ${sel ? 'checked' : ''} />
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-brown text-sm leading-snug mb-1.5">${esc(r.title)}</div>
        <div class="flex flex-wrap items-center gap-1">
          ${catLabel ? `<span class="inline-block bg-accent/[0.12] text-accent rounded-md px-2 py-px text-[11px] font-semibold tracking-wide">${esc(catLabel)}</span>` : ''}
          ${tagPills}${extra}
        </div>
        <div class="text-[11px] text-muted/50 mt-2">Oppdatert ${relativeTime(r.updated_at)}</div>
      </div>
      <button
        class="rt-edit-btn shrink-0 text-muted/35 hover:text-accent hover:bg-accent/[0.08] p-2 rounded-lg transition-all -mr-1"
        data-id="${esc(r.id)}" title="Rediger" data-no-nav>
        ${PENCIL}
      </button>
    </div>`
  }

  _wireRowEvents() {
    this.container.querySelectorAll('[data-row-id]').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('[data-no-nav]')) return
        const id = row.dataset.rowId
        // In selection mode: clicking a row toggles its checkbox
        if (this.selected.size > 0) {
          if (this.selected.has(id)) this.selected.delete(id)
          else this.selected.add(id)
          const cb = this.container.querySelector(`.rt-row-cb[data-id="${CSS.escape(id)}"]`)
          if (cb) cb.checked = this.selected.has(id)
          if (row.tagName === 'TR') row.classList.toggle('bg-accent/[0.05]', this.selected.has(id))
          else row.classList.toggle('bg-accent/[0.04]', this.selected.has(id))
          if (row.tagName === 'TR') row.classList.toggle('hover:bg-brown/[0.02]', !this.selected.has(id))
          this._updateSelectAll()
          this._renderBatchBar()
          return
        }
        this.onEdit(id)
      })
    })

    this.container.querySelectorAll('.rt-row-cb').forEach(cb => {
      cb.addEventListener('change', e => {
        e.stopPropagation()
        const id = cb.dataset.id
        if (cb.checked) this.selected.add(id)
        else this.selected.delete(id)
        this.container.querySelectorAll(`[data-row-id="${id}"]`).forEach(row => {
          if (row.tagName === 'TR') {
            row.classList.toggle('bg-accent/[0.05]', cb.checked)
            row.classList.toggle('hover:bg-brown/[0.02]', !cb.checked)
          } else {
            row.classList.toggle('bg-accent/[0.04]', cb.checked)
          }
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
          `<span class="text-white/35 text-xs hidden sm:block shrink-0">Fjern:</span>` +
          selectedTags.map(t =>
            `<button class="rt-remove-tag-btn flex items-center gap-1 bg-white/10 hover:bg-red-900/40 border border-white/15 text-white/70 hover:text-white text-xs px-2 py-1 rounded-full transition-colors" data-tag="${esc(t)}">
              ${esc(t)} <span class="opacity-40">×</span>
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
          <input type="checkbox" class="rt-tag-cb rounded border-brown-light/50 accent-accent shrink-0" data-tag="${esc(tag)}" ${checked ? 'checked' : ''} />
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
      if (col === this.sortCol) el.textContent = this.sortAsc ? ' ↑' : ' ↓'
      else el.textContent = ''
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
