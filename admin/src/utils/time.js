const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const YEAR = 365 * DAY

export function relativeTime(ms) {
  if (!ms) return '—'
  const diff = Date.now() - ms
  if (diff < 2 * MINUTE) return 'nettopp'
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} min siden`
  if (diff < DAY) {
    const h = Math.round(diff / HOUR)
    return h === 1 ? '1 time siden' : `${h} timer siden`
  }
  if (diff < WEEK) {
    const d = Math.round(diff / DAY)
    return d === 1 ? '1 dag siden' : `${d} dager siden`
  }
  const opts = { day: 'numeric', month: 'short' }
  if (diff > YEAR) opts.year = 'numeric'
  return new Date(ms).toLocaleDateString('nb-NO', opts)
}

export function fullTimestamp(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
