import { StepEditor } from './editor/StepEditor.js'
import { wireDropTarget } from './editor/dragHandlers.js'
import { FactorPopover } from './components/FactorPopover.js'
import { IngredientSidebar } from './components/IngredientSidebar.js'
import { RawModeToggle } from './components/RawModeToggle.js'
import { PasteRawModal } from './components/PasteRawModal.js'

const CATEGORIES = ['surdeig','brød','middag','dessert','suppe','kaker','frokost','fisk','vegetar','snacks']

let recipes = []
let editingId = null
let stepEditors = []  // { editor: StepEditor, getTitle, getTimer }
let ingredientSidebar = null
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
      editingId = data.id || recipe.id
      await loadList()
      await loadRecipe(editingId)
    } else {
      alert(data.error || 'Feil ved lagring.')
    }
  },
})

// ── Util ──────────────────────────────────────────────────────────────────────

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }
function genId() { return Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10) }

// ── API ───────────────────────────────────────────────────────────────────────

async function loadList() {
  const res = await fetch('/api/recipes')
  recipes = await res.json()

  // Desktop sidebar list
  const ul = document.getElementById('recipe-list')
  ul.innerHTML = recipes.map(r => `
    <li class="recipe-item ${editingId === r.id ? 'active' : ''}" data-id="${esc(r.id)}">${esc(r.title)}</li>
  `).join('')
  ul.querySelectorAll('.recipe-item').forEach(li => {
    li.addEventListener('click', () => loadRecipe(li.dataset.id))
  })

  // Mobile select
  const sel = document.getElementById('mobile-recipe-select')
  if (sel) {
    sel.innerHTML = '<option value="">— Velg oppskrift —</option>' +
      recipes.map(r => `<option value="${esc(r.id)}" ${editingId === r.id ? 'selected' : ''}>${esc(r.title)}</option>`).join('')
  }
}

async function loadRecipe(id) {
  const res = await fetch(`/api/recipes/${id}`)
  const r = await res.json()
  editingId = id
  renderForm(r)
  await loadList()
}

// ── Form ──────────────────────────────────────────────────────────────────────

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
        ${(r.ingredients||[]).map(i => ingredientRowHtml(i.id, i.amount, i.unit, i.name)).join('')}
      </div>

      <div class="section-head"><span>Fremgangsmåte</span>
        <button class="add-row-btn" id="add-step-btn">+ Legg til</button></div>
      <div id="step-rows"></div>

      <div class="section-head"><span>Tips</span>
        <button class="add-row-btn" id="add-tip-btn">+ Legg til</button></div>
      <div id="tip-rows">
        ${(r.tips||[]).map(t => tipRowHtml(t)).join('')}
      </div>

      <div class="actions">
        <button class="save-btn" id="save-btn">Lagre oppskrift</button>
        <button class="cancel-btn" id="cancel-btn">Avbryt</button>
        ${r.id ? `<button class="del-btn" id="del-btn">Slett</button>` : ''}
      </div>
      <div class="status" id="status"></div>
    </div>
  `

  const ingredients = r.ingredients || []

  // Render ingredient sidebar
  const sidebarContainer = document.createElement('div')
  sidebarContainer.id = 'ing-sidebar'
  sidebarContainer.className = 'ing-sidebar-panel'
  const formGrid = document.querySelector('.form-grid')
  if (formGrid) formGrid.insertAdjacentElement('beforebegin', sidebarContainer)
  ingredientSidebar = new IngredientSidebar(sidebarContainer, ingredients)

  // Render TipTap step editors
  const stepRowsEl = document.getElementById('step-rows')
  ;(r.steps || []).forEach((step, i) => {
    appendStepEditor(stepRowsEl, step, ingredients)
  })

  // Wire buttons
  document.getElementById('add-meta-btn').addEventListener('click', () =>
    document.getElementById('meta-rows').insertAdjacentHTML('beforeend', metaRowHtml()))
  document.getElementById('add-ing-btn').addEventListener('click', () =>
    document.getElementById('ingredient-rows').insertAdjacentHTML('beforeend', ingredientRowHtml()))
  document.getElementById('add-step-btn').addEventListener('click', () =>
    appendStepEditor(stepRowsEl, null, getCurrentIngredients()))
  document.getElementById('add-tip-btn').addEventListener('click', () =>
    document.getElementById('tip-rows').insertAdjacentHTML('beforeend', tipRowHtml()))
  document.getElementById('save-btn').addEventListener('click', save)
  document.getElementById('cancel-btn').addEventListener('click', () => {
    if (r.id) {
      loadRecipe(r.id)
    } else {
      destroyEditors()
      document.getElementById('form-title').textContent = 'Velg en oppskrift eller lag ny'
      document.getElementById('form-area').innerHTML = ''
      document.querySelectorAll('.recipe-item').forEach(el => el.classList.remove('active'))
      const sel = document.getElementById('mobile-recipe-select')
      if (sel) sel.value = ''
    }
  })
  document.getElementById('del-btn')?.addEventListener('click', () => del(r.id))

  // Raw YAML toggle
  const rawContainer = document.createElement('div')
  rawContainer.id = 'raw-toggle-container'
  document.getElementById('form-area').appendChild(rawContainer)
  new RawModeToggle(rawContainer, r.id || null, {
    onSaved: () => r.id && loadRecipe(r.id),
  })
}

function getCurrentIngredients() {
  return [...document.querySelectorAll('[data-ing-id]')].map(el => {
    const row = el.closest('.dynamic-row')
    return {
      id: el.dataset.ingId,
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
      <button class="rm-btn" data-rm-step>×</button>
    </div>
    <div class="step-editor-mount" id="${editorId}"></div>
  `
  container.appendChild(wrapper)

  wrapper.querySelector('[data-rm-step]').addEventListener('click', () => {
    const idx = stepEditors.findIndex(e => e.wrapperId === wrapperId)
    if (idx !== -1) { stepEditors[idx].editor.destroy(); stepEditors.splice(idx, 1) }
    wrapper.remove()
  })

  const mountEl = document.getElementById(editorId)
  const editor = new StepEditor(mountEl, {
    ingredients,
    initialDoc: step?.content_doc || null,
    onUpdate: () => recomputeSums(),
  })

  // Wire drop target for ingredient sidebar drag
  wireDropTarget(mountEl, editor, {
    onInsert: () => recomputeSums(),
  })

  // Click on ing-chip → factor popover
  mountEl.addEventListener('click', e => {
    const chip = e.target.closest('.ing-chip')
    if (!chip) return
    const pm = editor.editor.view
    // Find the node position by traversing the document
    let foundPos = null
    pm.state.doc.descendants((node, pos) => {
      if (node.type.name === 'ingredientRef' && pm.nodeDOM(pos) === chip) {
        foundPos = pos
        return false
      }
    })
    if (foundPos === null) return
    const node = pm.state.doc.nodeAt(foundPos)
    if (!node) return
    const { ingredientId, factor } = node.attrs
    const ing = ingredients.find(i => i.id === ingredientId)
    const rect = chip.getBoundingClientRect()
    factorPopover.show(ing || null, factor, newFactor => {
      editor.editor.chain().focus()
        .command(({ tr, state }) => {
          tr.setNodeMarkup(foundPos, null, { ...node.attrs, factor: newFactor })
          return true
        }).run()
      recomputeSums()
    }, { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 4 })
  })

  const stepEntry = {
    wrapperId,
    wrapper,
    editor,
    getTitle: () => wrapper.querySelector('[data-step-title]').value.trim(),
    getTimer: () => parseInt(wrapper.querySelector('[data-step-timer]').value) || 0,
  }
  stepEditors.push(stepEntry)
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
  ingredientSidebar.updateSums(sums)
}

function destroyEditors() {
  stepEditors.forEach(e => e.editor.destroy())
  stepEditors = []
  ingredientSidebar = null
}

// ── HTML row helpers ──────────────────────────────────────────────────────────

function metaRowHtml(label = '', value = '') {
  return `<div class="dynamic-row">
    <input placeholder="Etikett" value="${esc(label)}" data-meta-label />
    <input placeholder="Verdi"   value="${esc(value)}" data-meta-value />
    <button class="rm-btn" onclick="this.closest('.dynamic-row').remove()">×</button>
  </div>`
}

function ingredientRowHtml(id = '', amount = '', unit = '', name = '') {
  const safeId = id || genId()
  return `<div class="dynamic-row" data-ing-row>
    <input type="hidden" data-ing-id="${esc(safeId)}" data-ing-id-val value="${esc(safeId)}" />
    <input class="amount-input" type="number" step="any" placeholder="700"
           value="${amount !== null && amount !== '' ? amount : ''}" data-ing-amount />
    <input class="unit-input" placeholder="ml" value="${esc(unit||'')}" data-ing-unit />
    <input placeholder="Ingrediensnavn" value="${esc(name||'')}" data-ing-name />
    <button class="rm-btn" onclick="this.closest('.dynamic-row').remove()">×</button>
  </div>`
}

function tipRowHtml(text = '') {
  return `<div class="dynamic-row">
    <input placeholder="Tips" value="${esc(text)}" data-tip />
    <button class="rm-btn" onclick="this.closest('.dynamic-row').remove()">×</button>
  </div>`
}

// ── Save / Delete ─────────────────────────────────────────────────────────────

async function save() {
  const id = document.getElementById('f-id').value.trim().toLowerCase().replace(/\s+/g,'-')
  const title = document.getElementById('f-title').value.trim()
  if (!id || !title) { showStatus('ID og tittel er påkrevd.', false); return }

  const ingredients = [...document.querySelectorAll('[data-ing-id-val]')].map((el, pos) => ({
    id: el.value,
    position: pos,
    amount: parseFloat(el.closest('.dynamic-row').querySelector('[data-ing-amount]').value) || null,
    unit: el.closest('.dynamic-row').querySelector('[data-ing-unit]').value.trim() || null,
    name: el.closest('.dynamic-row').querySelector('[data-ing-name]').value.trim(),
  })).filter(i => i.name)

  const steps = stepEditors.map((e, pos) => ({
    id: e.wrapper.dataset.stepId || genId(),
    position: pos,
    title: e.getTitle(),
    timer_seconds: e.getTimer(),
    content_doc: e.editor.getDoc(),
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
    showStatus('Oppskrift lagret!', true)
    await loadList()
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
    document.getElementById('form-title').textContent = 'Velg en oppskrift eller lag ny'
    document.getElementById('form-area').innerHTML = ''
    await loadList()
  }
}

function showStatus(msg, ok) {
  const el = document.getElementById('status')
  el.textContent = msg
  el.className = 'status ' + (ok ? 'ok' : 'err')
}

// ── Init ──────────────────────────────────────────────────────────────────────

function newRecipe() {
  editingId = null
  destroyEditors()
  renderForm({})
  document.querySelectorAll('.recipe-item').forEach(el => el.classList.remove('active'))
  const sel = document.getElementById('mobile-recipe-select')
  if (sel) sel.value = ''
}

document.getElementById('new-btn').addEventListener('click', newRecipe)
document.getElementById('paste-btn').addEventListener('click', () => pasteRawModal.show())

// Mobile bar
document.getElementById('mobile-recipe-select')?.addEventListener('change', e => {
  if (e.target.value) loadRecipe(e.target.value)
})
document.getElementById('mobile-new-btn')?.addEventListener('click', newRecipe)
document.getElementById('mobile-paste-btn')?.addEventListener('click', () => pasteRawModal.show())

loadList()
