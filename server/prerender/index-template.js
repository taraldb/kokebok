function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Render the recipe index page (SSR).
 * @param {Array<{id,title,description,category,tags}>} recipes
 * @returns {string}
 */
function renderIndexPage(recipes) {
  const categories = [...new Set(recipes.map(r => r.category).filter(Boolean))].sort();

  const categoryBtns = categories.map(cat =>
    `<button class="nav-link" data-category="${esc(cat)}">${esc(capitalize(cat))}</button>`
  ).join('');

  const cards = recipes.map(r => `
    <a class="recipe-card" href="/r/${esc(r.id)}"
       data-category="${esc(r.category || '')}"
       data-search="${esc([r.title, r.description, r.category, ...(r.tags || [])].join(' ').toLowerCase())}">
      <div class="tag-list">
        ${r.category ? `<span class="category-badge">${esc(capitalize(r.category))}</span>` : ''}
        ${(r.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>
      <div class="card-title">${esc(r.title)}</div>
      <div class="card-desc">${esc(r.description || '')}</div>
    </a>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kokebok</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/style.css" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
  <script>const t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);<\/script>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo"><img src="/assets/logo.png" alt="" class="nav-logo-img" />Kokebok</a>
    <div class="nav-divider"></div>
    <div class="nav-links" id="nav-links">
      <button class="nav-link active" data-category="">Alle</button>
      ${categoryBtns}
    </div>
    <button id="theme-toggle" aria-label="Bytt tema">☾</button>
    <a href="/admin" class="admin-nav-btn" aria-label="Admin">⚙ Admin</a>
  </div>
</nav>

<div class="container">
  <header class="page-header">
    <h1>Oppskrifter</h1>
    <p>Hjemmelagde favoritter</p>
  </header>

  <div class="index-controls">
    <input class="search-bar" type="search" placeholder="Søk etter oppskrift…"
           id="search" autocomplete="off" />
  </div>

  <div class="recipe-grid" id="recipe-grid">
    ${cards}
  </div>

  <footer>
    <p>Kokebok &nbsp;·&nbsp; Laget med ♥</p>
  </footer>
</div>

<script>
  let activeCategory = '';

  function setCategory(cat) {
    activeCategory = cat;
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === cat);
    });
    filter();
  }

  function filter() {
    const query = document.getElementById('search').value.trim().toLowerCase();
    document.querySelectorAll('.recipe-card').forEach(card => {
      const matchCat = !activeCategory || card.dataset.category === activeCategory;
      const matchSearch = !query || card.dataset.search.includes(query);
      card.style.display = (matchCat && matchSearch) ? '' : 'none';
    });
  }

  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => setCategory(btn.dataset.category));
  });

  document.getElementById('search').addEventListener('input', filter);
<\/script>
<script src="/assets/theme.js"><\/script>
</body>
</html>`;
}

module.exports = { renderIndexPage };
