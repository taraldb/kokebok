const { formatAmount } = require('../lib/format-amount');
const { docToHtml } = require('./doc-to-html');

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function safeJsonInScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/-->/g, '--\\u003e')
    .replace(/<!--/g, '\\u003c!--');
}

/**
 * Render a full recipe HTML page.
 * @param {import('../types').Recipe} r
 * @returns {string}
 */
function renderRecipePage(r) {
  const ingMap = new Map((r.ingredients || []).map(i => [i.id, i]));
  const servingsBase = r.servings_base ?? 1;
  const servingsUnit = r.servings_unit ?? '';
  const servingsStep = r.servings_step ?? 1;
  const servingsMin  = r.servings_min  ?? 1;

  const tagBadges = [
    r.category ? `<span class="category-badge">${esc(capitalize(r.category))}</span>` : '',
    ...(r.tags || []).map(t => `<span class="tag">${esc(t)}</span>`),
  ].join('');

  const metaItems = [
    r.active_time != null
      ? `\n      <div class="meta-item">\n        <span class="meta-label">Aktiv tid</span>\n        <span class="meta-value">~${r.active_time} min</span>\n      </div>`
      : '',
    ...(r.meta || []).map(m => {
      const val = esc([m.value, m.unit].filter(Boolean).join(' '));
      return `\n      <div class="meta-item">\n        <span class="meta-label">${esc(m.label)}</span>\n        <span class="meta-value">${val}</span>\n      </div>`;
    }),
  ].filter(Boolean).join('');

  const servingsControl = r.servings_base != null ? `
          <div class="meta-item">
            <span class="meta-label">Antall ${esc(servingsUnit)}</span>
            <div class="servings-control">
              <button class="servings-btn" onclick="adjustServings(${-servingsStep})">−</button>
              <span id="servings-display">${servingsBase} ${esc(servingsUnit)}</span>
              <button class="servings-btn" onclick="adjustServings(${servingsStep})">+</button>
            </div>
          </div>` : '';

  const ingredientItems = (r.ingredients || []).map(ing => {
    const amt = ing.amount ?? null;
    const descHtml = ing.description ? ` <span class="ingredient-desc">(${esc(ing.description)})</span>` : '';
    // Only add data-base/data-unit when amount is known — scaling JS skips elements without these attrs
    const dataAttrs = amt != null ? ` data-base="${esc(String(amt))}" data-unit="${esc(ing.unit || '')}"` : '';
    const amtDisplay = amt != null ? formatAmount(amt, ing.unit) : '—';
    return `
        <li class="ingredient">
          <span class="ingredient-amount"${dataAttrs}>${esc(amtDisplay)}</span>
          <span class="ingredient-name">${esc(capitalize(ing.name))}${descHtml}</span>
        </li>`;
  }).join('');

  const stepItems = (r.steps || []).map((step, i) => {
    const textHtml = docToHtml(step.content_doc, r.ingredients);
    const timerSeconds = step.timer_seconds || 0;
    const timerHtml = timerSeconds > 0 ? `
          <div class="timer">
            <button class="timer-btn" onclick="startTimer(event, this, ${timerSeconds})">⏱ Start timer</button>
            <span class="timer-display">${formatTime(timerSeconds)}</span>
          </div>` : '';
    return `
        <li class="step" onclick="toggleStep(this)">
          <button class="done-btn" onclick="toggleDone(event, this)">✓</button>
          <span class="step-number">${i + 1}</span>
          <div class="step-content">
            <span class="step-title">${esc(step.title)}</span>
            <p class="step-text">${textHtml}</p>
            ${timerHtml}
          </div>
        </li>`;
  }).join('');

  const tipsHtml = (r.tips || []).length > 0 ? `
      <section>
        <h2 class="section-title">Tips</h2>
        <div class="tips">
          <ul>${(r.tips).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
      </section>` : '';

  // Build the __RECIPE__ payload for client-side init skip
  const recipePayload = {
    id: r.id,
    title: r.title,
    servings: r.servings_base != null ? {
      base: r.servings_base,
      unit: r.servings_unit,
      step: r.servings_step,
      min: r.servings_min,
    } : null,
    steps: (r.steps || []).map(s => ({
      title: s.title,
      timerSeconds: s.timer_seconds,
      text: docToHtml(s.content_doc, r.ingredients),
    })),
  };

  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(r.title)} · Kokebok</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/style.css" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
  <script>const t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);<\/script>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo"><img src="/assets/logo.png" alt="" class="nav-logo-img" />Kokebok</a>
    <button id="theme-toggle" aria-label="Bytt tema">☾</button>
    <a href="/admin" class="admin-nav-btn" aria-label="Admin">⚙ Admin</a>
  </div>
</nav>

<div class="container recipe-page animate-in" id="app">
  <header class="hero">
    <div class="hero-top-row">
      <a class="back-link" href="/">← Alle oppskrifter</a>
      <div class="hero-top-actions">
        <a href="/admin#/edit/${esc(r.id)}" class="edit-admin-btn" title="Rediger i admin" aria-label="Rediger i admin">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </a>
        <button class="json-copy-btn" id="json-copy-btn" onclick="copyJsonUrl('${esc(r.id)}')" title="Kopier JSON-URL for AI">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="2" x2="12" y2="5"/><circle cx="12" cy="1.5" r="1" fill="currentColor" stroke="none"/>
            <rect x="3" y="5" width="18" height="14" rx="3"/>
            <circle cx="9" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="15" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
            <path d="M9 15.5h6"/>
          </svg>
        </button>
      </div>
    </div>
    ${(() => { const heroLabel = r.label || [r.category, (r.tags||[])[0]].filter(Boolean).join(' · '); return heroLabel ? `<p class="hero-label">${esc(heroLabel)}</p>` : ''; })()}
    <h1>${esc(r.title)}</h1>
    ${r.description ? `<p class="hero-desc">${esc(r.description)}</p>` : ''}
    <div class="tag-list">${tagBadges}</div>
    <div class="meta-row" style="margin-top:24px">
      ${metaItems}
      ${servingsControl}
    </div>
    <button class="cooking-mode-btn" onclick="enterCooking()">
      &#x1F373; Start kokemodus
    </button>
  </header>

  <section>
    <h2 class="section-title">Ingredienser</h2>
    <ul class="ingredients-list" id="ingredients">${ingredientItems}
    </ul>
  </section>

  <section>
    <h2 class="section-title">Fremgangsmåte</h2>
    <ol class="steps-list">${stepItems}
    </ol>
  </section>

  ${tipsHtml}

  <footer>
    <p>Kokebok &nbsp;·&nbsp; ${esc(r.title)}</p>
  </footer>
</div>

<div id="cooking-overlay" class="cooking-overlay hidden">
  <div class="cm-header">
    <span class="cm-progress">Steg <span id="cm-cur">1</span> av <span id="cm-tot">1</span></span>
    <button class="cm-exit" onclick="exitCooking()" aria-label="Avslutt kokemodus">✕</button>
  </div>
  <div class="cm-body">
    <div class="cm-step-num" id="cm-num"></div>
    <div class="cm-step-title" id="cm-title"></div>
    <div class="cm-step-text" id="cm-text"></div>
    <div class="cm-timer-row" id="cm-timer"></div>
  </div>
  <div class="cm-nav">
    <button class="cm-nav-btn" id="cm-prev" onclick="cmNav(-1)">← Forrige</button>
    <div class="cm-dots" id="cm-dots"></div>
    <button class="cm-nav-btn cm-nav-next" id="cm-next" onclick="cmNav(1)">Neste →</button>
  </div>
</div>

<script>window.__RECIPE__ = ${safeJsonInScript(recipePayload)};<\/script>
<script>
  const timers = {};
  let BASE_SERVINGS = ${servingsBase};
  let currentServings = ${servingsBase};
  let SERVINGS_UNIT = '${esc(servingsUnit)}';
  let currentRecipe = window.__RECIPE__;

  function init() {
    // __RECIPE__ already inlined — skip fetch, just wire up cooking mode
    document.title = currentRecipe.title + ' · Kokebok';
    BASE_SERVINGS = currentRecipe.servings?.base ?? ${servingsBase};
    currentServings = BASE_SERVINGS;
    SERVINGS_UNIT = currentRecipe.servings?.unit ?? '${esc(servingsUnit)}';
  }

  /* ── Servings ── */
  function adjustServings(delta) {
    const min = ${servingsMin};
    const next = currentServings + delta;
    if (next < min) return;
    currentServings = next;
    document.getElementById('servings-display').textContent = currentServings + ' ' + SERVINGS_UNIT;
    updateIngredients();
  }

  function updateIngredients() {
    const ratio = currentServings / BASE_SERVINGS;
    document.querySelectorAll('[data-base][data-unit]').forEach(el => {
      el.textContent = formatAmount(parseFloat(el.dataset.base) * ratio, el.dataset.unit);
    });
  }

  const FRACS = [
    [1/8,'⅛'],[1/4,'¼'],[1/3,'⅓'],[3/8,'⅜'],[1/2,'½'],
    [5/8,'⅝'],[2/3,'⅔'],[3/4,'¾'],[7/8,'⅞']
  ];

  function toFracStr(frac) {
    let best = null, bestDiff = 0.06;
    for (const [f, s] of FRACS) {
      const d = Math.abs(frac - f);
      if (d < bestDiff) { bestDiff = d; best = s; }
    }
    return best;
  }

  function formatAmount(val, unit) {
    if (val >= 1000 && unit === 'g')  return (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + ' kg';
    if (val >= 1000 && unit === 'ml') return (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + ' l';
    const whole = Math.floor(val);
    const frac = val - whole;
    const fracStr = frac > 0.04 ? toFracStr(frac) : null;
    if (fracStr) return (whole > 0 ? whole + fracStr : fracStr) + ' ' + unit;
    return Math.round(val) + ' ' + unit;
  }

  /* ── Steps ── */
  function toggleStep(el) {
    if (event.target.classList.contains('done-btn') || event.target.closest('.timer-btn')) return;
    el.classList.toggle('active');
  }

  function toggleDone(e, btn) {
    e.stopPropagation();
    const step = btn.closest('.step');
    step.classList.toggle('done');
    step.classList.remove('active');
  }

  /* ── Timer ── */
  function startTimer(e, btn, totalSeconds) {
    e.stopPropagation();
    const display = btn.nextElementSibling;
    const key = btn.closest('.step').querySelector('.step-title').textContent;

    if (timers[key]) {
      clearInterval(timers[key].interval);
      delete timers[key];
      btn.textContent = '⏱ Start timer';
      btn.classList.remove('running');
      display.classList.remove('done-timer');
      display.textContent = formatTime(totalSeconds);
      return;
    }

    let remaining = totalSeconds;
    btn.textContent = '⏹ Stopp';
    btn.classList.add('running');
    display.textContent = formatTime(remaining);

    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        delete timers[key];
        btn.textContent = '⏱ Start timer';
        btn.classList.remove('running');
        display.textContent = '✓ Ferdig!';
        display.classList.add('done-timer');
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Timer ferdig!', { body: key });
        }
      } else {
        display.textContent = formatTime(remaining);
      }
    }, 1000);

    timers[key] = { interval, remaining };

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function formatTime(s) {
    if (s < 60) return s + ' sek';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + ' t ' + m + ' min';
    if (sec === 0) return m + ' min';
    return m + ' min ' + sec + ' sek';
  }

  /* ── Cooking mode ── */
  let cmIndex = 0;
  let wakeLock = null;
  let cmTimerInterval = null;
  let cmTimerTotal = 0;
  let cmTimerRemaining = 0;

  function enterCooking() {
    if (!currentRecipe?.steps?.length) return;
    cmIndex = 0;
    document.getElementById('cooking-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    acquireWakeLock();
    cmRenderStep();
  }

  function exitCooking() {
    document.getElementById('cooking-overlay').classList.add('hidden');
    document.body.style.overflow = '';
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    cmClearTimer();
  }

  async function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }

  function cmNav(delta) {
    const steps = currentRecipe.steps;
    const next = cmIndex + delta;
    if (next < 0 || next >= steps.length) return;
    cmClearTimer();
    cmIndex = next;
    cmRenderStep();
  }

  function cmRenderStep() {
    const steps = currentRecipe.steps;
    const step  = steps[cmIndex];
    const total = steps.length;

    document.getElementById('cm-cur').textContent   = cmIndex + 1;
    document.getElementById('cm-tot').textContent   = total;
    document.getElementById('cm-num').textContent   = cmIndex + 1;
    document.getElementById('cm-title').textContent = step.title;

    const textEl = document.getElementById('cm-text');
    textEl.innerHTML = step.text;
    const ratio = currentServings / BASE_SERVINGS;
    textEl.querySelectorAll('[data-base][data-unit]').forEach(el => {
      el.textContent = formatAmount(parseFloat(el.dataset.base) * ratio, el.dataset.unit);
    });

    const timerEl = document.getElementById('cm-timer');
    if (step.timerSeconds > 0) {
      cmTimerTotal = step.timerSeconds;
      cmTimerRemaining = step.timerSeconds;
      timerEl.innerHTML = \`
        <button class="cm-timer-btn" id="cm-tbtn" onclick="cmToggleTimer()">⏱ Start timer</button>
        <span class="cm-timer-display" id="cm-tdisp">\${formatTime(step.timerSeconds)}</span>\`;
    } else {
      timerEl.innerHTML = '';
    }

    const dotsEl = document.getElementById('cm-dots');
    if (total <= 12) {
      dotsEl.innerHTML = steps.map((_, i) =>
        \`<div class="cm-dot\${i === cmIndex ? ' active' : ''}"></div>\`
      ).join('');
      dotsEl.style.fontSize = '';
    } else {
      dotsEl.innerHTML = '';
      dotsEl.textContent = \`\${cmIndex + 1} / \${total}\`;
      dotsEl.style.fontSize = '0.85rem';
      dotsEl.style.color = 'var(--text-muted)';
    }

    document.getElementById('cm-prev').disabled = cmIndex === 0;
    const nextBtn = document.getElementById('cm-next');
    nextBtn.disabled = false;
    nextBtn.textContent = cmIndex === total - 1 ? '✓ Ferdig' : 'Neste →';
    if (cmIndex === total - 1) nextBtn.onclick = exitCooking;
    else nextBtn.onclick = () => cmNav(1);
  }

  function cmToggleTimer() {
    const btn  = document.getElementById('cm-tbtn');
    const disp = document.getElementById('cm-tdisp');

    if (cmTimerInterval) {
      cmClearTimer();
      btn.textContent = '⏱ Start timer';
      btn.classList.remove('running');
      disp.textContent = formatTime(cmTimerTotal);
      disp.classList.remove('done');
      return;
    }

    btn.textContent = '⏹ Stopp';
    btn.classList.add('running');

    cmTimerInterval = setInterval(() => {
      cmTimerRemaining--;
      if (cmTimerRemaining <= 0) {
        cmClearTimer();
        btn.textContent = '⏱ Start timer';
        btn.classList.remove('running');
        disp.textContent = '✓ Ferdig!';
        disp.classList.add('done');
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Timer ferdig!', { body: currentRecipe.steps[cmIndex].title });
        }
      } else {
        disp.textContent = formatTime(cmTimerRemaining);
      }
    }, 1000);
  }

  function cmClearTimer() {
    if (cmTimerInterval) { clearInterval(cmTimerInterval); cmTimerInterval = null; }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' &&
        !document.getElementById('cooking-overlay').classList.contains('hidden')) {
      acquireWakeLock();
    }
  });

  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('cooking-overlay');
    if (overlay.classList.contains('hidden')) return;
    if (e.key === 'Escape')                              exitCooking();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') cmNav(1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   cmNav(-1);
  });

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  const ROBOT_ICON = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="5"/><circle cx="12" cy="1.5" r="1" fill="currentColor" stroke="none"/><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="11.5" r="1.5" fill="currentColor" stroke="none"/><path d="M9 15.5h6"/></svg>\`;
  const CHECK_ICON = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>\`;

  function copyJsonUrl(id) {
    const url = \`\${location.origin}/recipes/\${id}.json\`;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('json-copy-btn');
      btn.innerHTML = CHECK_ICON;
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = ROBOT_ICON; btn.classList.remove('copied'); }, 2000);
    });
  }

  init();
<\/script>
<script src="/assets/theme.js"><\/script>
</body>
</html>`;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function formatTime(s) {
  if (s < 60) return s + ' sek';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return h + ' t ' + m + ' min';
  if (sec === 0) return m + ' min';
  return m + ' min ' + sec + ' sek';
}

module.exports = { renderRecipePage };
