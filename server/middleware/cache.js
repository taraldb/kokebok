function noCache(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
}

function immutableAsset(res) {
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
}

module.exports = { noCache, immutableAsset };
