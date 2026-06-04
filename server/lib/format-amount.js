// KEEP IN SYNC with public/recipe.html formatAmount + toFracStr

const FRACS = [
  [1/8,'⅛'],[1/4,'¼'],[1/3,'⅓'],[3/8,'⅜'],[1/2,'½'],
  [5/8,'⅝'],[2/3,'⅔'],[3/4,'¾'],[7/8,'⅞'],
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
  if (val == null || isNaN(val)) return '';
  if (val >= 1000 && unit === 'g')  return (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + ' kg';
  if (val >= 1000 && unit === 'ml') return (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + ' l';
  const whole = Math.floor(val);
  const frac  = val - whole;
  const fracStr = frac > 0.04 ? toFracStr(frac) : null;
  if (fracStr) return (whole > 0 ? whole + fracStr : fracStr) + ' ' + (unit || '');
  return Math.round(val) + (unit ? ' ' + unit : '');
}

module.exports = { formatAmount };
