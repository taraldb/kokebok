import './main.css'
import { StepEditor } from './editor/StepEditor.js'
import { wireDropTarget } from './editor/dragHandlers.js'
import { FactorPopover } from './components/FactorPopover.js'
import { IngredientSidebar } from './components/IngredientSidebar.js'
import { RawModeToggle } from './components/RawModeToggle.js'
import { PasteRawModal } from './components/PasteRawModal.js'
import { RecipeTable } from './components/RecipeTable.js'

const CATEGORIES = ['frokost','middag','dessert','tilbehør','snacks']

let recipes = []
let editingId = null
let stepEditors = []
let ingredientSidebar = null
let lastFocusedStepEditor = null
let activeIngRow = null
let ingRowHideTimer = null
let currentSums = {}
let currentIngredients = []
let recipeTable = null

const factorPopover = new FactorPopover()

const pasteRawModal = new PasteRawModal({
  onSave: async (recipe) => {
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    })
    const data = await res.json()
    if (res.ok) {
      const newId = data.id || recipe.id
      await loadList()
      showEdit(newId)
    } else {
      alert(data.error || 'Feil ved lagring.')
    }
  },
})

// ── Util ──────────────────────────────────────────────────────────────────────

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }
function genId() { return Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10) }
function parseNumeric(v) { const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return isNaN(n) ? '' : n }

function slugify(name) {
  return name.toLowerCase()
    .replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
    || 'ingredient'
}

function uniqueSlug(name, taken) {
  const base = slugify(name)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// ── View state machine ────────────────────────────────────────────────────────

function showList() {
  document.getElementById('view-list').hidden = false
  document.getElementById('view-edit').hidden = true
  loadList()
  if (location.hash !== '#/') history.replaceState(null, '', '#/')
}

function showEdit(id) {
  document.getElementById('view-list').hidden = true
  document.getElementById('view-edit').hidden = false
  editingId = id || null
  if (id) {
    if (location.hash !== `#/edit/${id}`) history.replaceState(null, '', `#/edit/${id}`)
    loadRecipe(id)
  } else {
    if (location.hash !== '#/new') history.replaceState(null, '', '#/new')
    newRecipeForm()
  }
}

window.addEventListener('hashchange', handleHash)

function handleHash() {
  const h = location.hash
  if (h.startsWith('#/edit/')) showEdit(h.slice(7))
  else if (h === '#/new') showEdit(null)
  else showList()
}

// ── API ───────────────────────────────────────────────────────────────────────

async function loadList() {
  const res = await fetch('/api/recipes')
  recipes = await res.json()
  if (recipeTable) recipeTable.update(recipes)
}

async function loadRecipe(id) {
  const res = await fetch(`/api/recipes/${id}`)
  const r = await res.json()
  editingId = id
  migrateRecipe(r)
  renderForm(r)
}

function migrateRecipe(r) {
  // Migrate "Aktiv tid" meta row → dedicated active_time field
  if (r.active_time == null) {
    const idx = (r.meta ?? []).findIndex(m => m.label?.toLowerCase() === 'aktiv tid')
    if (idx !== -1) {
      r.active_time = parseNumeric(r.meta[idx].value) || null
      r.meta.splice(idx, 1)
    }
  }
  // Split embedded unit from value for old-format rows (e.g. "22–24 min" → value "22–24", unit "min")
  ;(r.meta ?? []).forEach(m => {
    if (m.unit !== undefined) return
    const split = splitValueUnit(m.value)
    m.value = split.value
    m.unit  = split.unit
  })
}

function splitValueUnit(str) {
  // Splits "~30 min", "8–12 timer", "22–24 min" into { value, unit }
  const m = String(str ?? '').trim().match(/^([~\d–\-\.]+)\s*(.*)$/)
  if (!m) return { value: String(str ?? ''), unit: '' }
  return { value: m[1].trim(), unit: m[2].trim() }
}

// ── Tag chip editor ───────────────────────────────────────────────────────────

function wireTagEditor() {
  const editEl = document.getElementById('tag-edit')
  const inputEl = document.getElementById('f-tags-input')
  const suggestEl = document.getElementById('tag-suggest')
  if (!editEl || !inputEl || !suggestEl) return

  const allTags = [...new Set(recipes.flatMap(r => r.tags || []))].sort()
  let activeIdx = -1

  function getCurrentTags() {
    return [...editEl.querySelectorAll('[data-tag]')].map(el => el.dataset.tag)
  }

  function updatePlaceholder() {
    inputEl.placeholder = editEl.querySelector('[data-tag]') ? 'Legg til…' : 'pasta, rask, hverdagsmat…'
  }

  function hideSuggest() {
    suggestEl.hidden = true
    activeIdx = -1
  }

  function renderSuggest(matches) {
    if (!matches.length) { hideSuggest(); return }
    activeIdx = -1
    suggestEl.innerHTML = matches
      .map(t => `<div class="tag-suggest-item" data-suggest="${esc(t)}">${esc(t)}</div>`)
      .join('')
    suggestEl.hidden = false
  }

  function addTag(text) {
    const t = text.trim().toLowerCase()
    if (!t || getCurrentTags().includes(t)) return
    const chip = document.createElement('span')
    chip.className = 'tag-chip'
    chip.dataset.tag = t
    chip.innerHTML = `${esc(t)}<button type="button" aria-label="Fjern ${esc(t)}">×</button>`
    editEl.insertBefore(chip, inputEl)
    inputEl.value = ''
    updatePlaceholder()
    hideSuggest()
    updatePreview()
  }

  function removeLastTag() {
    const chips = editEl.querySelectorAll('[data-tag]')
    if (chips.length) { chips[chips.length - 1].remove(); updatePlaceholder(); updatePreview() }
  }

  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim().toLowerCase()
    if (!q) { hideSuggest(); return }
    const current = new Set(getCurrentTags())
    renderSuggest(allTags.filter(t => !current.has(t) && t.includes(q)).slice(0, 8))
  })

  inputEl.addEventListener('keydown', e => {
    const items = [...suggestEl.querySelectorAll('.tag-suggest-item')]
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeIdx = Math.min(activeIdx + 1, items.length - 1)
      items.forEach((el, i) => el.classList.toggle('active', i === activeIdx))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeIdx = Math.max(activeIdx - 1, -1)
      items.forEach((el, i) => el.classList.toggle('active', i === activeIdx))
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const active = items[activeIdx]
      addTag(active ? active.dataset.suggest : inputEl.value.replace(/,/g, ''))
    } else if (e.key === 'Backspace' && !inputEl.value) {
      removeLastTag()
    } else if (e.key === 'Escape') {
      hideSuggest()
    }
  })

  suggestEl.addEventListener('mousedown', e => {
    const item = e.target.closest('.tag-suggest-item')
    if (item) { e.preventDefault(); addTag(item.dataset.suggest) }
  })

  editEl.addEventListener('click', e => {
    const btn = e.target.closest('.tag-chip button')
    if (btn) { btn.closest('.tag-chip').remove(); updatePlaceholder(); updatePreview() }
  })

  document.addEventListener('click', function hideOnOutside(e) {
    if (!document.getElementById('tag-edit')) {
      document.removeEventListener('click', hideOnOutside)
      return
    }
    if (!editEl.contains(e.target) && !suggestEl.contains(e.target)) hideSuggest()
  })
}

// ── Form ──────────────────────────────────────────────────────────────────────

function newRecipeForm() {
  editingId = null
  destroyEditors()
  renderForm({})
}

function renderForm(r) {
  destroyEditors()
  const titleText = r.id ? r.title : 'Ny oppskrift'
  document.getElementById('form-title').textContent = titleText

  const catOptions = CATEGORIES.map(c =>
    `<option value="${c}" ${r.category === c ? 'selected' : ''}>${cap(c)}</option>`
  ).join('')

  document.getElementById('form-area').innerHTML = `
    <div class="edit-grid" id="edit-grid">
      <!-- Form column -->
      <div class="form-col" id="form-col">

        <!-- Grunninfo -->
        <div class="fgroup">
          <div class="fgroup-title">Grunninfo</div>
          <div class="frow">
            <div class="field">
              <label>Tittel</label>
              <input id="f-title" value="${esc(r.title||'')}" placeholder="Oppskriftens navn" />
            </div>
            <div class="field">
              <label>ID (url-slug)</label>
              <input id="f-id" value="${esc(r.id||'')}" placeholder="f.eks. sjokoladekake" ${r.id ? 'readonly' : ''} />
            </div>
          </div>
          <div class="frow">
            <div class="field">
              <label>Etikett</label>
              <input id="f-label" value="${esc(r.label||'')}" placeholder="f.eks. Surdeig · Kaldheving" />
            </div>
            <div class="field">
              <label>Kategori</label>
              <div class="select-wrap">
                <select id="f-category"><option value="">— velg —</option>${catOptions}</select>
              </div>
            </div>
          </div>
          <div class="field">
            <label>Beskrivelse</label>
            <textarea id="f-desc">${esc(r.description||'')}</textarea>
          </div>
          <div class="field">
            <label>Tags</label>
            <div class="tag-field">
              <div class="tag-edit" id="tag-edit">
                ${(r.tags||[]).map(t => `<span class="tag-chip" data-tag="${esc(t)}">${esc(t)}<button type="button" aria-label="Fjern ${esc(t)}">×</button></span>`).join('')}
                <input id="f-tags-input" placeholder="${(r.tags||[]).length ? 'Legg til…' : 'pasta, rask, hverdagsmat…'}" autocomplete="off" />
              </div>
              <div id="tag-suggest" class="tag-suggest" hidden></div>
            </div>
            <span class="sub">Trykk Enter eller komma for å legge til</span>
          </div>
        </div>

        <!-- Tid & egenskaper -->
        <div class="fgroup">
          <div class="fgroup-title">
            Tid &amp; egenskaper
            <span class="hint">Aktiv tid er påkrevd</span>
          </div>
          <div class="frow-3">
            <div class="field">
              <label>Aktiv tid (min)<span class="req">påkrevd</span></label>
              <input id="f-active-time" type="text" inputmode="numeric" value="${r.active_time != null ? r.active_time : ''}" placeholder="30 eller ~30" />
            </div>
            <div class="field">
              <label>Porsjoner</label>
              <input id="f-srv-base" type="number" value="${r.servings_base??''}" placeholder="4" />
            </div>
            <div class="field">
              <label>Enhet</label>
              <input id="f-srv-unit" value="${esc(r.servings_unit||'')}" placeholder="porsjoner" />
            </div>
          </div>
          <div class="dyn-list" id="meta-rows">
            ${(r.meta||[]).map(m => metaRowHtml(m.label, m.value, m.unit ?? 'min')).join('')}
          </div>
          <button class="add-row" id="add-meta-btn">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
            Legg til egenskap (f.eks. steketid)
          </button>
        </div>

        <!-- Ingredienser -->
        <div class="fgroup">
          <div class="fgroup-title">Ingredienser</div>
          <div class="dyn-list" id="ingredient-rows">
            ${(r.ingredients||[]).map(i => ingredientRowHtml(i.id, i.amount, i.unit, i.name, i.description)).join('')}
          </div>
          <button class="add-row" id="add-ing-btn">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
            Legg til ingrediens
          </button>
        </div>

        <!-- Fremgangsmåte -->
        <div class="fgroup">
          <div class="fgroup-title">Fremgangsmåte</div>
          <div class="steps-layout" id="steps-layout">
            <div class="steps-col" id="step-rows"></div>
          </div>
          <button class="add-row" id="add-step-btn">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
            Legg til steg
          </button>
        </div>

        <!-- Tips -->
        <div class="fgroup">
          <div class="fgroup-title">Tips</div>
          <div class="dyn-list" id="tip-rows">
            ${(r.tips||[]).map(t => tipRowHtml(t)).join('')}
          </div>
          <button class="add-row" id="add-tip-btn">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
            Legg til tips
          </button>
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-bottom:24px;">
          <button class="save-btn" id="save-btn">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke-linecap="round"/></svg>
            Lagre
          </button>
          <button class="ghost-btn" id="cancel-btn">Avbryt</button>
          ${r.id ? `<button class="ghost-btn" style="color:var(--danger);border-color:color-mix(in srgb,var(--danger) 40%,transparent)" id="del-btn">Slett</button>` : ''}
          ${r.id ? `<a class="ghost-btn" href="/r/${esc(r.id)}" target="_blank">↗ Se på siden</a>` : ''}
        </div>

        <div id="status-area"></div>
      </div>

      <!-- Ingredient sidebar column -->
      <div class="ing-sidebar-col" id="ing-sidebar-col"></div>

      <!-- Preview column -->
      <div class="preview-col" id="preview-col">
        <div class="preview-frame">
          <div class="preview-chrome">
            <div class="dots"><i></i><i></i><i></i></div>
            <span class="url" id="preview-url">${location.host}/r/…</span>
            <span class="preview-label">Forhåndsvisning</span>
            <button class="icon-btn preview-toggle" id="preview-toggle" title="Skjul forhåndsvisning">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
          <div class="preview-col-label">Forhåndsvisning</div>
          <div class="preview-body" id="preview-body">
            <div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:40px 0;">Fyll inn skjema for å se forhåndsvisning</div>
          </div>
        </div>
      </div>
    </div>
  `

  const ingredients = r.ingredients || []
  currentIngredients = ingredients
  currentSums = {}

  const sidebarContainer = document.getElementById('ing-sidebar-col')
  ingredientSidebar = new IngredientSidebar(sidebarContainer, ingredients, {
    onInsert: ingId => {
      if (lastFocusedStepEditor) {
        lastFocusedStepEditor.insertIngredientRef(ingId, 1.0, null)
        recomputeSums()
      }
    },
  })

  const stepRowsEl = document.getElementById('step-rows')
  ;(r.steps || []).forEach(step => appendStepEditor(stepRowsEl, step, ingredients))
  recomputeSums()

  document.getElementById('add-meta-btn').addEventListener('click', () =>
    document.getElementById('meta-rows').insertAdjacentHTML('beforeend', metaRowHtml()))
  document.getElementById('add-ing-btn').addEventListener('click', () => {
    document.getElementById('ingredient-rows').insertAdjacentHTML('beforeend', ingredientRowHtml())
    syncIngredientsFromForm()
  })
  document.getElementById('ingredient-rows').addEventListener('input', () => syncIngredientsFromForm())
  document.getElementById('ingredient-rows').addEventListener('click', e => {
    const rmBtn = e.target.closest('[data-rm-ing]')
    if (rmBtn) { rmBtn.closest('[data-ing-row]').remove(); syncIngredientsFromForm(); return }
    const dirBtn = e.target.closest('[data-ing-dir]')
    if (!dirBtn) return
    const row = dirBtn.closest('[data-ing-row]')
    const dir = dirBtn.dataset.ingDir
    if (dir === 'up') { const prev = row.previousElementSibling; if (prev) prev.before(row) }
    else              { const next = row.nextElementSibling;     if (next) next.after(row)  }
    syncIngredientsFromForm()
  })
  document.getElementById('add-step-btn').addEventListener('click', () =>
    appendStepEditor(stepRowsEl, null, getCurrentIngredients()))
  document.getElementById('add-tip-btn').addEventListener('click', () =>
    document.getElementById('tip-rows').insertAdjacentHTML('beforeend', tipRowHtml()))
  document.getElementById('save-btn').addEventListener('click', save)
  document.getElementById('cancel-btn').addEventListener('click', () => showList())
  document.getElementById('del-btn')?.addEventListener('click', () => del(r.id))

  wireTagEditor()

  const rawContainer = document.createElement('div')
  rawContainer.id = 'raw-toggle-container'
  rawContainer.style.padding = '0 28px 32px'
  document.getElementById('form-col').appendChild(rawContainer)
  new RawModeToggle(rawContainer, r.id || null, {
    onSaved: () => r.id && loadRecipe(r.id),
  })

  // Wire preview updates
  document.getElementById('form-col').addEventListener('input', () => updatePreview())
  updatePreview()

  // Preview collapse toggle (persisted)
  const grid = document.getElementById('edit-grid')
  if (localStorage.getItem('previewCollapsed') === '1') grid.classList.add('preview-collapsed')
  document.getElementById('preview-toggle').addEventListener('click', () => {
    const collapsed = grid.classList.toggle('preview-collapsed')
    localStorage.setItem('previewCollapsed', collapsed ? '1' : '0')
  })
}

function getCurrentIngredients() {
  return [...document.querySelectorAll('#ingredient-rows [data-ing-id-val]')].map(el => {
    const row = el.closest('.ing-row')
    return {
      id: el.value,
      amount: parseFloat(row.querySelector('[data-ing-amount]').value) || null,
      unit: row.querySelector('[data-ing-unit]').value.trim() || null,
      name: row.querySelector('[data-ing-name]').value.trim(),
    }
  }).filter(i => i.name)
}

function appendStepEditor(container, step, ingredients) {
  const wrapperId = `step-wrapper-${genId()}`
  const editorId = `step-editor-${genId()}`
  const stepNum = container.children.length + 1

  const wrapper = document.createElement('div')
  wrapper.className = 'step-card'
  wrapper.setAttribute('data-step-wrapper', '')
  wrapper.dataset.wrapperId = wrapperId
  wrapper.innerHTML = `
    <div class="step-card-head">
      <span class="step-num">${stepNum}</span>
      <input class="step-title-input" placeholder="Tittel på steg"
             value="${esc(step?.title || '')}" data-step-title />
      <div class="step-reorder" style="display:flex;gap:3px;flex-shrink:0;">
        <button class="step-mini" data-dir="up"   title="Opp">↑</button>
        <button class="step-mini" data-dir="down" title="Ned">↓</button>
      </div>
      <button class="rm-mini" data-rm-step title="Fjern steg">
        <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="step-timer-field">
      <label>
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke-linecap="round"/></svg>
        Timer (sekunder)
      </label>
      <input type="number" placeholder="300" value="${step?.timer_seconds || ''}" data-step-timer />
    </div>
    <div class="step-editor" id="step-editor-wrap-${editorId}">
      <div class="step-editor-mount" id="${editorId}"></div>
      <div class="step-toolbar">
        <button data-cmd="bold"      title="Fet (Ctrl+B)"><b>B</b></button>
        <button data-cmd="italic"    title="Kursiv (Ctrl+I)"><i>I</i></button>
        <button data-cmd="underline" title="Understrek (Ctrl+U)"><u>U</u></button>
      </div>
    </div>
  `
  container.appendChild(wrapper)

  wrapper.querySelectorAll('[data-dir]').forEach(btn =>
    btn.addEventListener('click', () => reorderStep(wrapperId, btn.dataset.dir))
  )

  const ingRow = document.createElement('div')
  ingRow.className = 'step-ing-row'
  populateIngRow(ingRow, ingredients)
  wrapper.appendChild(ingRow)

  wrapper.querySelector('[data-rm-step]').addEventListener('click', () => {
    const idx = stepEditors.findIndex(e => e.wrapperId === wrapperId)
    if (idx !== -1) { stepEditors[idx].editor.destroy(); stepEditors.splice(idx, 1) }
    if (wrapper._chipMousedown) document.removeEventListener('mousedown', wrapper._chipMousedown, true)
    if (activeIngRow === ingRow) { activeIngRow = null; cancelIngRowHide() }
    wrapper.remove()
    // Renumber remaining steps
    container.querySelectorAll('.step-num').forEach((el, i) => { el.textContent = i + 1 })
  })

  const mountEl = document.getElementById(editorId)
  const editor = new StepEditor(mountEl, {
    ingredients,
    initialDoc: step?.content_doc || null,
    onUpdate: () => { recomputeSums(); updatePreview() },
    onFocus: () => {
      lastFocusedStepEditor = editor
      cancelIngRowHide()
      if (activeIngRow && activeIngRow !== ingRow) activeIngRow.classList.remove('active')
      activeIngRow = ingRow
      ingRow.classList.add('active')
      // Focus state on card + editor wrap
      wrapper.classList.add('focused')
      const edWrap = wrapper.querySelector(`#step-editor-wrap-${editorId}`)
      if (edWrap) edWrap.classList.add('focused')
    },
    onBlur: () => {
      scheduleIngRowHide()
      wrapper.classList.remove('focused')
      const edWrap = wrapper.querySelector(`#step-editor-wrap-${editorId}`)
      if (edWrap) edWrap.classList.remove('focused')
    },
  })

  wrapper.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault()
      const cmd = btn.dataset.cmd
      if (cmd === 'bold') editor.editor.chain().focus().toggleBold().run()
      else if (cmd === 'italic') editor.editor.chain().focus().toggleItalic().run()
      else if (cmd === 'underline') editor.editor.chain().focus().toggleUnderline().run()
    })
  })

  wireDropTarget(mountEl, editor, { onInsert: () => recomputeSums() })

  const chipMousedown = e => {
    const chip = e.target.closest?.('.ing-chip')
    if (!chip || !editor.editor.view.dom.contains(chip)) return
    e.preventDefault()
    e.stopPropagation()
    const pm = editor.editor.view
    let nodePos = null
    pm.state.doc.descendants((node, pos) => {
      if (nodePos !== null) return false
      if (node.type.name === 'ingredientRef') {
        const domAtPos = pm.nodeDOM(pos)
        if (domAtPos === chip || (domAtPos && domAtPos.contains && domAtPos.contains(chip))) {
          nodePos = pos; return false
        }
      }
    })
    if (nodePos === null) return
    const node = pm.state.doc.nodeAt(nodePos)
    if (!node) return
    const { ingredientId, factor } = node.attrs
    const ing = ingredients.find(i => i.id === ingredientId)
    const rect = chip.getBoundingClientRect()
    factorPopover.show(ing || null, factor, newFactor => {
      editor.editor.chain().focus()
        .command(({ tr, state }) => {
          const currentNode = state.doc.nodeAt(nodePos)
          if (!currentNode) return false
          tr.setNodeMarkup(nodePos, null, { ...currentNode.attrs, factor: newFactor })
          return true
        }).run()
      recomputeSums()
    }, { x: rect.left, y: rect.bottom + 4 })
  }
  document.addEventListener('mousedown', chipMousedown, true)
  wrapper._chipMousedown = chipMousedown

  stepEditors.push({
    wrapperId, wrapper, editor, ingRow,
    getTitle: () => wrapper.querySelector('[data-step-title]').value.trim(),
    getTimer: () => parseInt(wrapper.querySelector('[data-step-timer]').value) || 0,
  })
}

function syncIngredientsFromForm() {
  const ingredients = getCurrentIngredients()
  currentIngredients = ingredients
  if (ingredientSidebar) ingredientSidebar.update(ingredients)
  stepEditors.forEach(e => e.editor.refreshIngredients(ingredients))
  recomputeSums()
}

function recomputeSums() {
  if (!ingredientSidebar) return
  const sums = {}
  for (const { editor } of stepEditors) {
    const doc = editor.getDoc()
    const traverse = node => {
      if (node.type === 'ingredientRef') {
        const { ingredientId, factor = 1 } = node.attrs || {}
        if (ingredientId) sums[ingredientId] = (sums[ingredientId] || 0) + factor
      }
      ;(node.content || []).forEach(traverse)
    }
    traverse(doc)
  }
  currentSums = sums
  ingredientSidebar.updateSums(sums)
  updateAllIngRows(currentIngredients)
}

function destroyEditors() {
  stepEditors.forEach(e => e.editor.destroy())
  stepEditors = []
  ingredientSidebar = null
  lastFocusedStepEditor = null
  activeIngRow = null
  cancelIngRowHide()
  currentSums = {}
  currentIngredients = []
}

function reorderStep(wrapperId, direction) {
  const idx = stepEditors.findIndex(e => e.wrapperId === wrapperId)
  if (idx === -1) return
  const last = stepEditors.length - 1
  const newIdx = direction === 'top' ? 0
    : direction === 'up'     ? Math.max(0, idx - 1)
    : direction === 'down'   ? Math.min(last, idx + 1)
    : /* bottom */             last
  if (newIdx === idx) return
  const container = stepEditors[idx].wrapper.parentElement
  const [moved] = stepEditors.splice(idx, 1)
  stepEditors.splice(newIdx, 0, moved)
  stepEditors.forEach(e => container.appendChild(e.wrapper))
}

// ── Mobile inline ingredient row ──────────────────────────────────────────────

function populateIngRow(row, ingredients) {
  const sums = currentSums
  const sorted = [...ingredients].sort((a, b) => {
    const aEmpty = (sums[a.id] ?? 0) === 0
    const bEmpty = (sums[b.id] ?? 0) === 0
    return aEmpty === bEmpty ? 0 : aEmpty ? -1 : 1
  })

  row.innerHTML = ''
  sorted.forEach(ing => {
    const sum = sums[ing.id] ?? 0
    const isDone = Math.abs(sum - 1.0) <= 0.02
    const remaining = 1 - sum
    const colorClass = sum === 0 ? 'pill-grey' : (isDone ? 'pill-green' : 'pill-orange')

    let remText = ''
    if (!isDone && ing.amount != null) {
      const remAmt = parseFloat((ing.amount * Math.max(0, remaining)).toFixed(4))
      if (remAmt > 0) remText = `${remAmt}${ing.unit ? ' ' + ing.unit : ''}`
    }

    const insertFactor = (!isDone && remaining > 0.001) ? remaining : 1.0
    const btn = document.createElement('button')
    btn.className = `step-ing-pill ${colorClass}`
    btn.innerHTML = `<span class="step-ing-pill-name">${esc(ing.name)}</span>${remText ? `<span class="step-ing-pill-rem">${esc(remText)}</span>` : ''}`
    btn.addEventListener('click', () => {
      cancelIngRowHide()
      if (lastFocusedStepEditor) {
        lastFocusedStepEditor.insertIngredientRef(ing.id, insertFactor, null)
        recomputeSums()
      }
    })
    row.appendChild(btn)
  })
}

function updateAllIngRows(ingredients) {
  if (ingredients.length) currentIngredients = ingredients
  stepEditors.forEach(e => { if (e.ingRow) populateIngRow(e.ingRow, currentIngredients) })
}

function scheduleIngRowHide() {
  ingRowHideTimer = setTimeout(() => {
    if (activeIngRow) { activeIngRow.classList.remove('active'); activeIngRow = null }
  }, 200)
}

function cancelIngRowHide() {
  if (ingRowHideTimer) { clearTimeout(ingRowHideTimer); ingRowHideTimer = null }
}

// ── HTML row helpers ──────────────────────────────────────────────────────────

function metaRowHtml(label = '', value = '', unit = 'min') {
  return `<div class="extra-row">
    <input placeholder="Steketid, hevetid…" value="${esc(label)}" data-meta-label />
    <input type="text" inputmode="numeric" placeholder="30" value="${esc(value)}" data-meta-value />
    <input placeholder="min" value="${esc(unit)}" style="max-width:60px;" data-meta-unit />
    <button class="rm-mini" onclick="this.closest('.extra-row').remove()" title="Fjern">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>
    </button>
  </div>`
}

function ingredientRowHtml(id = '', amount = '', unit = '', name = '', desc = '') {
  const safeId = id || genId()
  return `<div class="ing-row" data-ing-row>
    <input type="hidden" data-ing-id="${esc(safeId)}" data-ing-id-val value="${esc(safeId)}" />
    <input type="number" step="any" placeholder="700"
           value="${amount !== null && amount !== '' ? amount : ''}" data-ing-amount style="text-align:right;" />
    <input placeholder="ml" value="${esc(unit||'')}" data-ing-unit />
    <input placeholder="Ingrediensnavn" value="${esc(name||'')}" data-ing-name />
    <button class="rm-mini" data-rm-ing title="Fjern">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>
    </button>
  </div>`
}

function tipRowHtml(text = '') {
  return `<div class="ing-row" style="grid-template-columns:1fr 34px;">
    <input placeholder="Tips" value="${esc(text)}" data-tip />
    <button class="rm-mini" onclick="this.closest('.ing-row').remove()" title="Fjern">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>
    </button>
  </div>`
}

// ── Save / Delete ─────────────────────────────────────────────────────────────

function ensureSpacesAroundChips(doc) {
  if (!doc?.content) return doc

  function fixInlineContent(content) {
    const nodes = content.slice()
    const result = []
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.type !== 'ingredientRef') { result.push(node); continue }
      if (result.length > 0) {
        const prev = result[result.length - 1]
        if (prev.type === 'text' && !prev.text.endsWith(' ')) {
          result[result.length - 1] = { ...prev, text: prev.text + ' ' }
        } else if (prev.type !== 'text') {
          result.push({ type: 'text', text: ' ' })
        }
      }
      result.push(node)
      if (i + 1 < nodes.length) {
        const next = nodes[i + 1]
        if (next.type === 'text' && !next.text.startsWith(' ')) {
          nodes[i + 1] = { ...next, text: ' ' + next.text }
        } else if (next.type !== 'text' && next.type !== 'ingredientRef') {
          result.push({ type: 'text', text: ' ' })
        }
      }
    }
    return result
  }

  function walkContent(content) {
    if (!Array.isArray(content)) return content
    const hasChip = content.some(n => n.type === 'ingredientRef')
    const fixed = hasChip ? fixInlineContent(content) : content
    return fixed.map(node => node.content ? { ...node, content: walkContent(node.content) } : node)
  }

  return { ...doc, content: walkContent(doc.content) }
}

async function save() {
  const id = document.getElementById('f-id').value.trim().toLowerCase().replace(/\s+/g,'-')
  const title = document.getElementById('f-title').value.trim()
  if (!id || !title) { showStatus('ID og tittel er påkrevd.', false); return }

  const rawIngredients = [...document.querySelectorAll('[data-ing-id-val]')].map((el, pos) => ({
    id: el.value,
    position: pos,
    amount: parseFloat(el.closest('.ing-row').querySelector('[data-ing-amount]').value) || null,
    unit: el.closest('.ing-row').querySelector('[data-ing-unit]').value.trim() || null,
    name: el.closest('.ing-row').querySelector('[data-ing-name]').value.trim(),
    description: el.closest('.ing-row').querySelector('[data-ing-desc]')?.value.trim() || null,
  })).filter(i => i.name)

  const savedIngIds = new Set((recipes.find(r => r.id === editingId)?.ingredients || []).map(i => i.id))
  const takenSlugs = new Set(rawIngredients.filter(i => savedIngIds.has(i.id)).map(i => i.id))
  const idRemap = new Map()
  const ingredients = rawIngredients.map(ing => {
    if (savedIngIds.has(ing.id)) return ing
    const slug = uniqueSlug(ing.name, takenSlugs)
    takenSlugs.add(slug)
    idRemap.set(ing.id, slug)
    return { ...ing, id: slug }
  })

  function remapDoc(doc) {
    if (!doc || !idRemap.size) return doc
    const walk = node => {
      if (!node) return node
      if (node.type === 'ingredientRef' && idRemap.has(node.attrs?.ingredientId)) {
        return { ...node, attrs: { ...node.attrs, ingredientId: idRemap.get(node.attrs.ingredientId) } }
      }
      if (node.content) return { ...node, content: node.content.map(walk) }
      return node
    }
    return walk(doc)
  }

  const fixedDocs = stepEditors.map(e => ensureSpacesAroundChips(remapDoc(e.editor.getDoc())))

  const steps = stepEditors.map((e, pos) => ({
    id: e.wrapper.dataset.stepId || genId(),
    position: pos,
    title: e.getTitle(),
    timer_seconds: e.getTimer(),
    content_doc: fixedDocs[pos],
  })).filter(s => s.title)

  const recipe = {
    id,
    title,
    label:        document.getElementById('f-label').value.trim() || null,
    description:  document.getElementById('f-desc').value.trim() || null,
    category:     document.getElementById('f-category').value || null,
    tags:         [...document.querySelectorAll('#tag-edit [data-tag]')].map(el => el.dataset.tag),
    active_time:  parseNumeric(document.getElementById('f-active-time')?.value) || null,
    meta:         [...document.querySelectorAll('[data-meta-label]')].map(el => ({
                    label: el.value.trim(),
                    value: el.closest('.extra-row').querySelector('[data-meta-value]').value.trim(),
                    unit:  el.closest('.extra-row').querySelector('[data-meta-unit]')?.value.trim() || '',
                  })).filter(m => m.label),
    servings_base: parseInt(document.getElementById('f-srv-base')?.value) || null,
    servings_unit: document.getElementById('f-srv-unit')?.value.trim() || null,
    servings_step: parseInt(document.getElementById('f-srv-step')?.value) || 1,
    servings_min:  parseInt(document.getElementById('f-srv-min')?.value) || 1,
    tips:          [...document.querySelectorAll('[data-tip]')].map(el => el.value.trim()).filter(Boolean),
    ingredients,
    steps,
  }

  const isNew = !editingId
  const method = isNew ? 'POST' : 'PUT'
  const url = isNew ? '/api/recipes' : `/api/recipes/${editingId}`

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  })
  const data = await res.json()

  if (res.ok) {
    editingId = id
    if (isNew) history.replaceState(null, '', `#/edit/${id}`)
    stepEditors.forEach((e, i) => { e.editor.setIngredients(ingredients); e.editor.setDoc(fixedDocs[i]) })
    if (ingredientSidebar) { ingredientSidebar.update(ingredients); recomputeSums() }
    updateAllIngRows(ingredients)
    document.getElementById('form-title').textContent = title
    showStatus('Oppskrift lagret!', true)
    // Update local list cache (timestamps will refresh on next loadList)
    const idx = recipes.findIndex(r => r.id === id)
    if (idx !== -1) {
      recipes[idx] = { ...recipes[idx], title, category: recipe.category, tags: recipe.tags, updated_at: Date.now() }
    } else {
      recipes.push({ id, title, category: recipe.category, tags: recipe.tags, created_at: Date.now(), updated_at: Date.now() })
    }
  } else {
    showStatus(data.error ? JSON.stringify(data.error) : 'Feil ved lagring.', false)
  }
}

async function del(id) {
  if (!confirm(`Slette «${id}»?`)) return
  const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
  if (res.ok) {
    editingId = null
    destroyEditors()
    showList()
  }
}

function showStatus(msg, ok) {
  const area = document.getElementById('status-area')
  if (!area) return
  const cls = ok
    ? 'padding:12px 16px;border-radius:10px;font-size:0.88rem;background:color-mix(in srgb,var(--green) 14%,var(--warm-white));color:var(--green);border:1px solid color-mix(in srgb,var(--green) 30%,transparent);'
    : 'padding:12px 16px;border-radius:10px;font-size:0.88rem;background:color-mix(in srgb,var(--danger) 14%,var(--warm-white));color:var(--danger);border:1px solid color-mix(in srgb,var(--danger) 30%,transparent);'
  area.innerHTML = `<div style="${cls}">${esc(msg)}</div>`
  if (ok) setTimeout(() => { if (area) area.innerHTML = '' }, 3000)
}

function docToHtmlPreview(doc, ingMap) {
  function n2h(node) {
    if (!node) return ''
    if (node.type === 'text') {
      let t = esc(node.text || '')
      for (const m of node.marks || []) {
        if (m.type === 'bold')   t = `<strong>${t}</strong>`
        if (m.type === 'italic') t = `<em>${t}</em>`
      }
      return t
    }
    if (node.type === 'hardBreak') return '<br>'
    if (node.type === 'ingredientRef') {
      const { ingredientId, factor = 1, displayOverride } = node.attrs || {}
      const ing = ingMap.get(ingredientId)
      if (!ing) return displayOverride ? esc(displayOverride) : ''
      const base = (ing.amount ?? 0) * factor
      const qty = displayOverride || (base > 0 ? `${parseFloat(base.toFixed(4))} ${ing.unit || ''}`.trim() : '')
      const qtyHtml = qty ? `<span class="ing-ref-qty">${esc(qty)}</span> ` : ''
      return `<span class="ing-ref">${qtyHtml}<span class="ing-ref-name">${esc(ing.name || '')}</span></span>`
    }
    if (node.type === 'paragraph') return (node.content || []).map(n2h).join('')
    if (node.type === 'doc') return (node.content || []).map(n2h).join('<br>')
    return (node.content || []).map(n2h).join('')
  }
  return n2h(doc)
}

function updatePreview() {
  const body = document.getElementById('preview-body')
  const urlEl = document.getElementById('preview-url')
  if (!body) return

  const id = document.getElementById('f-id')?.value.trim() || ''
  const title = document.getElementById('f-title')?.value.trim() || ''
  const desc = document.getElementById('f-desc')?.value.trim() || ''
  const labelOverride = document.getElementById('f-label')?.value.trim() || ''
  const cat = document.getElementById('f-category')?.value || ''
  const activeTime = document.getElementById('f-active-time')?.value || ''
  const srvBase = document.getElementById('f-srv-base')?.value || ''
  const srvUnit = document.getElementById('f-srv-unit')?.value || 'porsjoner'
  const tags = [...document.querySelectorAll('#tag-edit [data-tag]')].map(el => el.dataset.tag)

  const metas = [...document.querySelectorAll('.extra-row')].map(row => ({
    label: row.querySelector('[data-meta-label]')?.value.trim() || '',
    value: row.querySelector('[data-meta-value]')?.value.trim() || '',
    unit: row.querySelector('[data-meta-unit]')?.value.trim() || '',
  })).filter(m => m.label && m.value)

  const ings = getCurrentIngredients()
  const ingMap = new Map(ings.map(i => [i.id, i]))

  if (urlEl) urlEl.textContent = id ? `${location.host}/r/${id}` : `${location.host}/r/…`

  if (!title) {
    body.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:40px 0;">Fyll inn skjema for å se forhåndsvisning</div>`
    return
  }

  const catBadge = cat ? `<span class="category-badge">${esc(cap(cat))}</span>` : ''
  const tagPills = tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')

  const metaItems = [
    activeTime ? `<div class="meta-item"><span class="meta-label">Aktiv tid</span><span class="meta-value">~${activeTime} min</span></div>` : '',
    srvBase ? `<div class="meta-item"><span class="meta-label">Porsjoner</span><span class="meta-value">${srvBase} ${esc(srvUnit)}</span></div>` : '',
    ...metas.map(m => `<div class="meta-item"><span class="meta-label">${esc(m.label)}</span><span class="meta-value">${esc(m.value)} ${esc(m.unit)}</span></div>`),
  ].filter(Boolean).join('')

  const ingHtml = ings.filter(i => i.name).length ? `
    <section>
      <h2 class="section-title">Ingredienser</h2>
      <ul class="ingredients-list">
        ${ings.filter(i => i.name).map(i => `
          <li class="ingredient">
            <span class="ingredient-amount">${esc([i.amount, i.unit].filter(Boolean).join(' ') || '—')}</span>
            <span class="ingredient-name">${esc(i.name)}</span>
          </li>`).join('')}
      </ul>
    </section>` : ''

  const stepsData = stepEditors.map((e, i) => ({
    num: i + 1,
    title: e.getTitle(),
    html: docToHtmlPreview(e.editor.getDoc(), ingMap),
  })).filter(s => s.title || s.html)

  const stepsHtml = stepsData.length ? `
    <section>
      <h2 class="section-title">Fremgangsmåte</h2>
      <ol class="steps-list">
        ${stepsData.map(s => `
          <li class="step">
            <span class="step-number">${s.num}</span>
            <div class="step-content">
              ${s.title ? `<span class="step-title">${esc(s.title)}</span>` : ''}
              <p class="step-text">${s.html}</p>
            </div>
          </li>`).join('')}
      </ol>
    </section>` : ''

  body.innerHTML = `
    <div class="recipe-page">
      <header class="hero">
        ${(() => { const hl = labelOverride || [cat, tags[0]].filter(Boolean).join(' · '); return hl ? `<p class="hero-label">${esc(hl)}</p>` : ''; })()}
        <h1>${esc(title) || 'Uten tittel'}</h1>
        ${desc ? `<p class="hero-desc">${esc(desc)}</p>` : ''}
        ${(catBadge || tagPills) ? `<div class="tag-list">${catBadge}${tagPills}</div>` : ''}
        ${metaItems ? `<div class="meta-row">${metaItems}</div>` : ''}
      </header>
      ${ingHtml}
      ${stepsHtml}
    </div>
  `
}

// ── Init ──────────────────────────────────────────────────────────────────────

recipeTable = new RecipeTable(document.getElementById('view-list'), {
  onEdit: id => showEdit(id),
  onNew:  () => showEdit(null),
  onPaste: () => pasteRawModal.show(),
})

document.getElementById('back-btn').addEventListener('click', () => showList())

// Edit view theme toggle (mirrors the one in RecipeTable)
document.getElementById('edit-theme-toggle').addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const next = isDark ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('theme', next)
  document.querySelectorAll('#rt-theme-toggle, #edit-theme-toggle').forEach(btn => {
    btn.textContent = next === 'dark' ? '☀' : '☾'
  })
})

handleHash()
