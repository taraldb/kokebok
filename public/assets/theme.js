(function () {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  function isDark() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function updateBtn() {
    btn.textContent = isDark() ? '☀' : '☾';
    btn.setAttribute('aria-label', isDark() ? 'Bytt til lys modus' : 'Bytt til mørk modus');
  }

  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateBtn();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBtn);
  updateBtn();
}

document.addEventListener('DOMContentLoaded', initThemeToggle);
