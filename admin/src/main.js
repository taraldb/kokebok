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
  renderForm(r)
}

// ── Form ──────────────────────────────────────────────────────────────────────

function newRecipeForm() {
  editingId = null
  destroyEditors()
  renderForm({})
}

function renderForm(r) {
  destroyEditors()
  document.getElementById('form-title').textContent = r.id ? r.title : 'Ny oppskrift'

  const catOptions = CATEGORIES.map(c =>
    `<option value="${c}" ${r.category === c ? 'selected' : ''}>${cap(c)}</option>`
  ).join('')

  document.getElementById('form-area').innerHTML = `
    <div class="form-grid">
      <div class="row">
        <div class="field"><label>ID (url-slug)</label>
          <input id="f-id" value="${esc(r.id||'')}" placeholder="f.eks. sjokoladekake" ${r.id ? 'readonly' : ''} /></div>
        <div class="field"><label>Tittel</label>
          <input id="f-title" value="${esc(r.title||'')}" placeholder="Oppskriftens navn" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Etikett</label>
          <input id="f-label" value="${esc(r.label||'')}" placeholder="f.eks. Surdeig · Kaldheving" /></div>
        <div class="field"><label>Kategori</label>
          <select id="f-category"><option value="">— velg —</option>${catOptions}</select></div>
      </div>
      <div class="field"><label>Beskrivelse</label>
        <textarea id="f-desc">${esc(r.description||'')}</textarea></div>
      <div class="field"><label>Tags (kommaseparert)</label>
        <input id="f-tags" value="${esc((r.tags||[]).join(', '))}" /></div>

      <div class="section-head"><span>Meta-info</span>
        <button class="add-row-btn" id="add-meta-btn">+ Legg til</button></div>
      <div id="meta-rows">
        ${(r.meta||[]).map(m => metaRowHtml(m.label, m.value)).join('')}
      </div>

      <div class="section-head"><span>Porsjoner</span></div>
      <div class="row">
        <div class="field"><label>Base-antall</label>
          <input id="f-srv-base" type="number" value="${r.servings_base??''}" /></div>
        <div class="field"><label>Enhet</label>
          <input id="f-srv-unit" value="${esc(r.servings_unit||'')}" /></div>
        <div class="field"><label>Steg (±)</label>
          <input id="f-srv-step" type="number" value="${r.servings_step??1}" /></div>
        <div class="field"><label>Minimum</label>
          <input id="f-srv-min" type="number" value="${r.servings_min??1}" /></div>
      </div>

      <div class="section-head"><span>Ingredienser</span>
        <button class="add-row-btn" id="add-ing-btn">+ Legg til</button></div>
      <div id="ingredient-rows">
        ${(r.ingredients||[]).map(i => ingredientRowHtml(i.id, i.amount, i.unit, i.name, i.description)).join('')}
      </div>

      <div class="steps-layout">
        <div class="steps-col">
          <div class="section-head"><span>Fremgangsmåte</span>
            <button class="add-row-btn" id="add-step-btn">+ Legg til</button></div>
          <div id="step-rows"></div>
        </div>
        <div id="ing-sidebar-col"></div>
      </div>

      <div class="section-head"><span>Tips</span>
        <button class="add-row-btn" id="add-tip-btn">+ Legg til</button></div>
      <div id="tip-rows">
        ${(r.tips||[]).map(t => tipRowHtml(t)).join('')}
      </div>

      <div class="actions">
        <button class="save-btn" id="save-btn">Lagre oppskrift</button>
        <button class="cancel-btn" id="cancel-btn">Avbryt</button>
        ${r.id ? `<button class="del-btn" id="del-btn">Slett</button>` : ''}
        ${r.id ? `<a class="view-site-btn" href="/r/${esc(r.id)}" target="_blank">↗ Se på siden</a>` : ''}
      </div>
      <div class="status" id="status"></div>
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
  document.getElementById('add-ing-btn').addEventListener('click', () =>
    document.getElementById('ingredient-rows').insertAdjacentHTML('beforeend', ingredientRowHtml()))
  document.getElementById('ingredient-rows').addEventListener('click', e => {
    const btn = e.target.closest('[data-ing-dir]')
    if (!btn) return
    const row = btn.closest('[data-ing-row]')
    const dir = btn.dataset.ingDir
    if (dir === 'up') { const prev = row.previousElementSibling; if (prev) prev.before(row) }
    else              { const next = row.nextElementSibling;     if (next) next.after(row)  }
  })
  document.getElementById('add-step-btn').addEventListener('click', () =>
    appendStepEditor(stepRowsEl, null, getCurrentIngredients()))
  document.getElementById('add-tip-btn').addEventListener('click', () =>
    document.getElementById('tip-rows').insertAdjacentHTML('beforeend', tipRowHtml()))
  document.getElementById('save-btn').addEventListener('click', save)
  document.getElementById('cancel-btn').addEventListener('click', () => showList())
  document.getElementById('del-btn')?.addEventListener('click', () => del(r.id))

  const rawContainer = document.createElement('div')
  rawContainer.id = 'raw-toggle-container'
  document.getElementById('form-area').appendChild(rawContainer)
  new RawModeToggle(rawContainer, r.id || null, {
    onSaved: () => r.id && loadRecipe(r.id),
  })
}

function getCurrentIngredients() {
  return [...document.querySelectorAll('#ingredient-rows [data-ing-id-val]')].map(el => {
    const row = el.closest('.dynamic-row')
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

  const wrapper = document.createElement('div')
  wrapper.className = 'step-wrapper'
  wrapper.setAttribute('data-step-wrapper', '')
  wrapper.dataset.wrapperId = wrapperId
  wrapper.innerHTML = `
    <div class="step-header">
      <input class="step-title-input" placeholder="Tittel på steg"
             value="${esc(step?.title || '')}" data-step-title />
      <input class="step-timer-input" type="number" placeholder="Timer (sek)"
             value="${step?.timer_seconds || ''}" data-step-timer />
      <div class="step-reorder-btns">
        <button class="step-reorder-btn" data-dir="top"    title="Til toppen">⇈</button>
        <button class="step-reorder-btn" data-dir="up"     title="Opp">↑</button>
        <button class="step-reorder-btn" data-dir="down"   title="Ned">↓</button>
        <button class="step-reorder-btn" data-dir="bottom" title="Til bunnen">⇊</button>
      </div>
      <button class="rm-btn" data-rm-step>×</button>
    </div>
    <div class="step-toolbar">
      <button class="step-tool-btn" data-cmd="bold"      title="Fet (Ctrl+B)"><b>B</b></button>
      <button class="step-tool-btn" data-cmd="italic"    title="Kursiv (Ctrl+I)"><i>I</i></button>
      <button class="step-tool-btn" data-cmd="underline" title="Understrek (Ctrl+U)"><u>U</u></button>
    </div>
    <div class="step-editor-mount" id="${editorId}"></div>
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
  })

  const mountEl = document.getElementById(editorId)
  const editor = new StepEditor(mountEl, {
    ingredients,
    initialDoc: step?.content_doc || null,
    onUpdate: () => recomputeSums(),
    onFocus: () => {
      lastFocusedStepEditor = editor
      cancelIngRowHide()
      if (activeIngRow && activeIngRow !== ingRow) activeIngRow.classList.remove('active')
      activeIngRow = ingRow
      ingRow.classList.add('active')
    },
    onBlur: () => scheduleIngRowHide(),
  })

  wrapper.querySelector('[data-cmd="bold"]').addEventListener('click', () =>
    editor.editor.chain().focus().toggleBold().run())
  wrapper.querySelector('[data-cmd="italic"]').addEventListener('click', () =>
    editor.editor.chain().focus().toggleItalic().run())
  wrapper.querySelector('[data-cmd="underline"]').addEventListener('click', () =>
    editor.editor.chain().focus().toggleUnderline().run())

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

function metaRowHtml(label = '', value = '') {
  return `<div class="dynamic-row">
    <input placeholder="Etikett" value="${esc(label)}" data-meta-label />
    <input placeholder="Verdi"   value="${esc(value)}" data-meta-value />
    <button class="rm-btn" onclick="this.closest('.dynamic-row').remove()">×</button>
  </div>`
}

function ingredientRowHtml(id = '', amount = '', unit = '', name = '', desc = '') {
  const safeId = id || genId()
  return `<div class="dynamic-row" data-ing-row>
    <input type="hidden" data-ing-id="${esc(safeId)}" data-ing-id-val value="${esc(safeId)}" />
    <div class="step-reorder-btns">
      <button class="step-reorder-btn" data-ing-dir="up"   title="Opp">↑</button>
      <button class="step-reorder-btn" data-ing-dir="down" title="Ned">↓</button>
    </div>
    <input class="amount-input" type="number" step="any" placeholder="700"
           value="${amount !== null && amount !== '' ? amount : ''}" data-ing-amount />
    <input class="unit-input" placeholder="ml" value="${esc(unit||'')}" data-ing-unit />
    <input placeholder="Ingrediensnavn" value="${esc(name||'')}" data-ing-name />
    <div class="ing-desc-row">
      <input class="desc-input" placeholder="Beskrivelse (valgfri)" value="${esc(desc||'')}" data-ing-desc />
      <button class="rm-btn" onclick="this.closest('.dynamic-row').remove()">×</button>
    </div>
  </div>`
}

function tipRowHtml(text = '') {
  return `<div class="dynamic-row">
    <input placeholder="Tips" value="${esc(text)}" data-tip />
    <button class="rm-btn" onclick="this.closest('.dynamic-row').remove()">×</button>
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
    amount: parseFloat(el.closest('.dynamic-row').querySelector('[data-ing-amount]').value) || null,
    unit: el.closest('.dynamic-row').querySelector('[data-ing-unit]').value.trim() || null,
    name: el.closest('.dynamic-row').querySelector('[data-ing-name]').value.trim(),
    description: el.closest('.dynamic-row').querySelector('[data-ing-desc]').value.trim() || null,
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
    tags:         document.getElementById('f-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    meta:         [...document.querySelectorAll('[data-meta-label]')].map(el => ({
                    label: el.value.trim(),
                    value: el.closest('.dynamic-row').querySelector('[data-meta-value]').value.trim(),
                  })).filter(m => m.label),
    servings_base: parseInt(document.getElementById('f-srv-base').value) || null,
    servings_unit: document.getElementById('f-srv-unit').value.trim() || null,
    servings_step: parseInt(document.getElementById('f-srv-step').value) || 1,
    servings_min:  parseInt(document.getElementById('f-srv-min').value) || 1,
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
  const el = document.getElementById('status')
  el.textContent = msg
  el.className = 'status ' + (ok ? 'ok' : 'err')
}

// ── Init ──────────────────────────────────────────────────────────────────────

recipeTable = new RecipeTable(document.getElementById('view-list'), {
  onEdit: id => showEdit(id),
  onNew:  () => showEdit(null),
  onPaste: () => pasteRawModal.show(),
})

document.getElementById('back-btn').addEventListener('click', () => showList())

handleHash()
