const crypto = require('crypto');
const { uniqueSlug } = require('./slugify');

function shortId() {
  return crypto.randomBytes(5).toString('hex');
}

function recipeSlugFromTitle(title, taken) {
  if (!title) return `recipe-${shortId()}`;
  return uniqueSlug(title, taken);
}

module.exports = { shortId, recipeSlugFromTitle };
