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

const SVG_SEARCH = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round"/></svg>`
const SVG_PLUS   = `<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke-linecap="round"/></svg>`
const SVG_PASTE  = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10" stroke-linecap="round"/></svg>`
const SVG_ROWS   = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/></svg>`
const SVG_COMPACT= `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke-linecap="round"/></svg>`
const SVG_FOLDER = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-linecap="round"/></svg>`
const SVG_TRASH  = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round"/></svg>`
const SVG_TAG    = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1" fill="currentColor"/></svg>`
const SVG_PENCIL = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-linecap="round"/></svg>`
const SVG_DOTS   = `<svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>`

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
    this.compact = localStorage.getItem('adminCompact') === '1'

    this._mount()
  }

  _mount() {
    this.container.innerHTML = `
      <div class="app">
        <!-- Nav -->
        <nav class="nav">
          <div class="nav-inner">
            <a class="nav-logo" href="/" target="_blank">
              <img src="/assets/logo.png" alt="" />
              <b>Kokebok</b>
            </a>
            <span class="nav-crumb">Admin</span>
            <span class="nav-spacer"></span>
            <button class="ghost-btn" id="rt-paste-btn">${SVG_PASTE} Lim inn</button>
            <button class="primary-btn" id="rt-new-btn">${SVG_PLUS} Ny oppskrift</button>
            <button class="icon-btn" id="rt-theme-toggle" title="Bytt tema">${themeIcon()}</button>
          </div>
        </nav>

        <!-- Page content -->
        <div class="wrap">
          <!-- Header -->
          <header class="page-head">
            <div>
              <h1>Oppskrifter</h1>
              <p>
                <span class="count" id="rt-count">0</span> oppskrifter
              </p>
            </div>
          </header>

          <!-- Toolbar -->
          <div class="toolbar">
            <div class="search">
              ${SVG_SEARCH}
              <input id="rt-search" type="search" placeholder="Søk i oppskrifter og tags…" autocomplete="off" />
            </div>
            <div class="seg" id="rt-cat-seg">
              <button class="on" data-cat="">Alle</button>
              ${CATEGORIES.map(c => `<button data-cat="${esc(c)}">${cap(c)}</button>`).join('')}
            </div>
            <select class="sortsel" id="rt-sort">
              <option value="updated_at">Sist endret</option>
              <option value="title">Tittel A–Å</option>
              <option value="created_at">Opprettet</option>
              <option value="category">Kategori</option>
              <option value="active_time">Aktiv tid</option>
            </select>
            <button class="icon-btn" id="rt-compact-btn" title="Kompakt visning">${SVG_COMPACT}</button>
          </div>

          <!-- List header -->
          <div class="list-head">
            <span id="rt-select-all-cbx" class="cbx" role="checkbox" aria-checked="false" title="Velg alle"></span>
            <span class="sortable" data-sort="title">Oppskrift</span>
            <span class="h-cat sortable" data-sort="category">Kategori</span>
            <span class="h-tags">Tags</span>
            <span class="h-time sortable" data-sort="active_time">Tid</span>
            <span class="h-edit sortable" data-sort="updated_at">Sist endret</span>
            <span></span>
          </div>

          <!-- Rows -->
          <div class="rows" id="rt-rows"></div>

          <!-- Empty state -->
          <div class="empty" id="rt-empty" style="display:none">
            <span class="serif">Ingen treff</span>
            Prøv et annet søk eller filter.
          </div>
        </div>

        <!-- Batch bar -->
        <div class="batchbar" id="rt-batchbar">
          <span class="batch-count"><b id="rt-batch-count">0</b> valgt</span>
          <button class="batch-clear" id="rt-batch-close">Fjern</button>
          <div class="batch-actions">
            <button class="batch-btn" id="rt-batch-cat-btn">${SVG_FOLDER} Kategori</button>
            <button class="batch-btn" id="rt-batch-tag-btn">${SVG_TAG} Tags</button>
            <button class="batch-btn danger" id="rt-batch-delete-btn">${SVG_TRASH} Slett</button>
          </div>
        </div>

        <!-- Context menus (appended to body on demand) -->
      </div>
    `
    this._bindEvents()
    if (this.compact) {
      this.container.querySelector('#rt-compact-btn')?.classList.add('on')
    }
  }

  _bindEvents() {
    const q = id => this.container.querySelector(`#${id}`)

    q('rt-new-btn').addEventListener('click', () => this.onNew())
    q('rt-paste-btn').addEventListener('click', () => this.onPaste())

    q('rt-theme-toggle').addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('theme', next)
      document.querySelectorAll('#rt-theme-toggle, #edit-theme-toggle').forEach(btn => {
        btn.textContent = themeIcon()
      })
    })

    q('rt-search').addEventListener('input', e => {
      this.filterText = e.target.value
      this._refresh()
    })

    // Category segment
    q('rt-cat-seg').addEventListener('click', e => {
      const btn = e.target.closest('button[data-cat]')
      if (!btn) return
      this.filterCategory = btn.dataset.cat
      q('rt-cat-seg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn))
      this._refresh()
    })

    q('rt-sort').addEventListener('change', e => {
      this.sortCol = e.target.value
      this.sortAsc = e.target.value === 'title'
      this._refresh()
    })

    q('rt-compact-btn').addEventListener('click', () => {
      this.compact = !this.compact
      localStorage.setItem('adminCompact', this.compact ? '1' : '0')
      q('rt-compact-btn').classList.toggle('on', this.compact)
      const rows = q('rt-rows')
      if (rows) rows.classList.toggle('compact', this.compact)
    })

    // Select-all cbx
    q('rt-select-all-cbx').addEventListener('click', () => {
      const allSel = this.filtered.every(r => this.selected.has(r.id))
      if (allSel) this.selected.clear()
      else this.filtered.forEach(r => this.selected.add(r.id))
      this._renderRows()
      this._renderBatchBar()
    })

    // Batch bar actions
    q('rt-batch-close').addEventListener('click', () => {
      this.selected.clear()
      this._renderRows()
      this._renderBatchBar()
    })

    q('rt-batch-cat-btn').addEventListener('click', e => {
      const rect = e.currentTarget.getBoundingClientRect()
      this._showCatPop(rect)
    })

    q('rt-batch-tag-btn').addEventListener('click', e => {
      const rect = e.currentTarget.getBoundingClientRect()
      this._showTagPop(rect)
    })

    q('rt-batch-delete-btn').addEventListener('click', () => this._batchDelete())

    // Esc clears selection
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.selected.size > 0) {
        this.selected.clear()
        this._renderRows()
        this._renderBatchBar()
      }
    })

    // Column sort
    this.container.querySelectorAll('[data-sort]').forEach(el => {
      el.addEventListener('click', () => {
        const col = el.dataset.sort
        if (this.sortCol === col) this.sortAsc = !this.sortAsc
        else { this.sortCol = col; this.sortAsc = col === 'title' }
        const sortEl = document.getElementById('rt-sort')
        if (sortEl) sortEl.value = col
        this._refresh()
      })
    })

    // Close popovers on outside click
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('.pop')) {
        document.querySelectorAll('.pop.rt-pop').forEach(p => p.remove())
      }
    })
  }

  update(recipes) {
    this.recipes = recipes
    this.allTags = [...new Set(recipes.flatMap(r => r.tags || []))].sort()
    this.selected.clear()
    this._refresh()
  }

  _refresh() {
    this._applyFilters()
    this._renderRows()
    this._renderBatchBar()
  }

  _applyFilters() {
    const q = this.filterText.toLowerCase()
    this.filtered = this.recipes.filter(r => {
      if (this.filterCategory && r.category !== this.filterCategory) return false
      if (q && !r.title.toLowerCase().includes(q) && !(r.tags || []).some(t => t.toLowerCase().includes(q))) return false
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
    const rowsEl = this.container.querySelector('#rt-rows')
    const emptyEl = this.container.querySelector('#rt-empty')
    const countEl = this.container.querySelector('#rt-count')

    if (!rowsEl) return
    rowsEl.classList.toggle('compact', this.compact)

    const isEmpty = this.filtered.length === 0
    emptyEl.style.display = isEmpty ? '' : 'none'

    rowsEl.innerHTML = isEmpty ? '' : this.filtered.map(r => this._rowHtml(r)).join('')

    if (countEl) {
      countEl.textContent = this.filtered.length === this.recipes.length
        ? this.recipes.length
        : `${this.filtered.length} / ${this.recipes.length}`
    }

    // Update select-all cbx
    const allCbx = this.container.querySelector('#rt-select-all-cbx')
    if (allCbx) {
      const selCount = this.filtered.filter(r => this.selected.has(r.id)).length
      allCbx.classList.toggle('on', selCount > 0 && selCount === this.filtered.length)
      allCbx.classList.toggle('mixed', selCount > 0 && selCount < this.filtered.length)
    }

    this._wireRowEvents()
  }

  _rowHtml(r) {
    const sel = this.selected.has(r.id)
    const tags = (r.tags || [])
    const tagHtml = tags.slice(0, 4).map(t => `<span class="tag">${esc(t)}</span>`).join('')
    const moreHtml = tags.length > 4 ? `<span class="more">+${tags.length - 4}</span>` : ''
    const timeMin = r.active_time ? `<b>${r.active_time}</b> min` : `<span class="text-muted">—</span>`

    return `<div class="rrow${sel ? ' sel' : ''}" data-row-id="${esc(r.id)}">
      <span class="cbx${sel ? ' on' : ''}" data-cbx data-id="${esc(r.id)}" role="checkbox">${sel ? '<svg viewBox="0 0 13 13" fill="none" stroke="white" stroke-width="2.5"><path d="M2 6.5l3 3 6-6" stroke-linecap="round"/></svg>' : ''}</span>
      <div class="rcell-main">
        <div class="rtitle">${esc(r.title)}</div>
        <div class="rdesc">${esc(r.description || '')}</div>
      </div>
      <div class="rcell-cat">${r.category ? `<span class="cat-badge">${esc(cap(r.category))}</span>` : ''}</div>
      <div class="rcell-tags rtags">${tagHtml}${moreHtml}</div>
      <div class="rcell-time rmeta">${timeMin}</div>
      <div class="rcell-edit rmeta">${relativeTime(r.updated_at)}</div>
      <button class="row-menu-btn" data-menu data-id="${esc(r.id)}" title="Handlinger">${SVG_DOTS}</button>
    </div>`
  }

  _wireRowEvents() {
    this.container.querySelectorAll('[data-row-id]').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('[data-cbx]') || e.target.closest('[data-menu]')) return
        const id = row.dataset.rowId
        if (this.selected.size > 0) {
          this._toggleSel(id, row)
          return
        }
        this.onEdit(id)
      })
    })

    this.container.querySelectorAll('[data-cbx]').forEach(cbx => {
      cbx.addEventListener('click', e => {
        e.stopPropagation()
        const id = cbx.dataset.id
        const row = cbx.closest('[data-row-id]')
        this._toggleSel(id, row)
      })
    })

    this.container.querySelectorAll('[data-menu]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const id = btn.dataset.id
        const rect = btn.getBoundingClientRect()
        this._showRowMenu(id, rect)
      })
    })
  }

  _toggleSel(id, row) {
    if (this.selected.has(id)) this.selected.delete(id)
    else this.selected.add(id)
    if (row) {
      row.classList.toggle('sel', this.selected.has(id))
      const cbx = row.querySelector('[data-cbx]')
      if (cbx) {
        cbx.classList.toggle('on', this.selected.has(id))
        cbx.innerHTML = this.selected.has(id)
          ? '<svg viewBox="0 0 13 13" fill="none" stroke="white" stroke-width="2.5"><path d="M2 6.5l3 3 6-6" stroke-linecap="round"/></svg>'
          : ''
      }
    }
    this._renderBatchBar()
    // Update select-all
    const allCbx = this.container.querySelector('#rt-select-all-cbx')
    if (allCbx) {
      const selCount = this.filtered.filter(r => this.selected.has(r.id)).length
      allCbx.classList.toggle('on', selCount > 0 && selCount === this.filtered.length)
      allCbx.classList.toggle('mixed', selCount > 0 && selCount < this.filtered.length)
    }
  }

  _renderBatchBar() {
    const bar = this.container.querySelector('#rt-batchbar')
    const countEl = this.container.querySelector('#rt-batch-count')
    if (!bar) return
    const count = this.selected.size
    bar.classList.toggle('show', count > 0)
    if (countEl) countEl.textContent = count
  }

  _showRowMenu(id, rect) {
    document.querySelectorAll('.pop.rt-pop').forEach(p => p.remove())
    const pop = document.createElement('div')
    pop.className = 'pop rt-pop'
    pop.style.cssText = `position:fixed;left:${rect.right - 190}px;top:${rect.bottom + 6}px;`
    pop.innerHTML = `
      <button data-action="edit">${SVG_PENCIL} Rediger</button>
      <div class="pop-sep"></div>
      <button data-action="delete" class="danger">${SVG_TRASH} Slett</button>
    `
    document.body.appendChild(pop)
    pop.querySelector('[data-action="edit"]').addEventListener('click', () => { pop.remove(); this.onEdit(id) })
    pop.querySelector('[data-action="delete"]').addEventListener('click', () => { pop.remove(); this._deleteOne(id) })
  }

  _showCatPop(rect) {
    document.querySelectorAll('.pop.rt-pop').forEach(p => p.remove())
    const pop = document.createElement('div')
    pop.className = 'pop rt-pop'
    pop.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;transform:translateY(-100%) translateY(-6px);`
    pop.innerHTML = `
      <div class="pop-label">Sett kategori til</div>
      ${CATEGORIES.map(c => `<button data-cat="${esc(c)}">${SVG_FOLDER} ${cap(c)}</button>`).join('')}
      <div class="pop-sep"></div>
      <button data-cat="">Fjern kategori</button>
    `
    document.body.appendChild(pop)
    pop.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        pop.remove()
        this._batchSetCategory(btn.dataset.cat || null)
      })
    })
  }

  _showTagPop(rect) {
    document.querySelectorAll('.pop.rt-pop').forEach(p => p.remove())
    const pop = document.createElement('div')
    pop.className = 'pop rt-pop'
    pop.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;transform:translateY(-100%) translateY(-6px);min-width:220px;`
    const selectedTags = [...new Set([...this.selected].flatMap(id => {
      const r = this.recipes.find(r => r.id === id); return r?.tags || []
    }))].sort()
    pop.innerHTML = `
      <div class="pop-label">Legg til tag</div>
      <div style="padding:4px 8px 8px;display:flex;gap:6px;">
        <input id="rt-pop-tag-input" type="text" placeholder="tag1, tag2…" style="flex:1;padding:7px 10px;border:1px solid var(--brown-light);border-radius:8px;background:var(--cream);color:var(--text);font-family:inherit;font-size:0.85rem;outline:none;" />
        <button id="rt-pop-tag-add" style="padding:7px 12px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:0.85rem;font-weight:500;">+</button>
      </div>
      ${selectedTags.length ? `<div class="pop-label">Fjern fra valgte</div>` + selectedTags.map(t => `<button data-remove-tag="${esc(t)}">${SVG_TRASH} ${esc(t)}</button>`).join('') : ''}
    `
    document.body.appendChild(pop)
    const addBtn = pop.querySelector('#rt-pop-tag-add')
    const inp = pop.querySelector('#rt-pop-tag-input')
    const doAdd = () => {
      const tags = inp.value.split(',').map(t => t.trim()).filter(Boolean)
      if (tags.length) { pop.remove(); this._batchAddTags(tags) }
    }
    addBtn.addEventListener('click', doAdd)
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd() })
    pop.querySelectorAll('[data-remove-tag]').forEach(btn => {
      btn.addEventListener('click', () => { pop.remove(); this._batchRemoveTag(btn.dataset.removeTag) })
    })
  }

  async _deleteOne(id) {
    if (!confirm(`Slette «${id}»?`)) return
    const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      this.recipes = this.recipes.filter(r => r.id !== id)
      this.selected.delete(id)
      this.allTags = [...new Set(this.recipes.flatMap(r => r.tags || []))].sort()
      this._refresh()
    }
  }

  async _batchDelete() {
    const ids = [...this.selected]
    if (!ids.length) return
    if (!confirm(`Slette ${ids.length} oppskrift${ids.length !== 1 ? 'er' : ''}?`)) return
    for (const id of ids) {
      await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
    }
    this.recipes = this.recipes.filter(r => !ids.includes(r.id))
    ids.forEach(id => this.selected.delete(id))
    this.allTags = [...new Set(this.recipes.flatMap(r => r.tags || []))].sort()
    this._refresh()
  }

  async _batchSetCategory(category) {
    const ids = [...this.selected]
    if (!ids.length) return
    const res = await fetch('/api/admin/batch-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates: { category } }),
    })
    if (res.ok) {
      ids.forEach(id => { const r = this.recipes.find(r => r.id === id); if (r) r.category = category })
      this.selected.clear()
      this._refresh()
    }
  }

  async _batchAddTags(addTags) {
    const ids = [...this.selected]
    if (!ids.length || !addTags?.length) return
    const res = await fetch('/api/admin/batch-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates: { addTags } }),
    })
    if (res.ok) {
      ids.forEach(id => {
        const r = this.recipes.find(r => r.id === id)
        if (r) r.tags = [...new Set([...(r.tags || []), ...addTags])]
      })
      this.allTags = [...new Set(this.recipes.flatMap(r => r.tags || []))].sort()
      this.selected.clear()
      this._refresh()
    }
  }

  async _batchRemoveTag(tag) {
    const ids = [...this.selected]
    if (!ids.length) return
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
      this._refresh()
    }
  }
}
