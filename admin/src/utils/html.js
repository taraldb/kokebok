export function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export function onClickOutside(el, callback) {
  const handler = e => { if (!el.contains(e.target)) callback(e) }
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}
