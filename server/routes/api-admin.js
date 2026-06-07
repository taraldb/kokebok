const express = require('express');
const { prerenderAll, computeTemplateHash } = require('../prerender/index');
const { setTemplateHash, batchUpdate } = require('../db/recipes');
const { parseRaw } = require('../lib/parse-raw');

const router = express.Router();

router.post('/rerender-all', (_req, res) => {
  const { count, ms } = prerenderAll();
  setTemplateHash(computeTemplateHash());
  res.json({ ok: true, count, ms });
});

// PATCH /api/admin/batch-update — set category / add / remove tags for multiple recipes
router.patch('/batch-update', express.json(), (req, res) => {
  const { ids, updates } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  const updated = batchUpdate(ids, updates || {});
  res.json({ ok: true, updated });
});

// POST /api/admin/import-raw — preview only, does not save
router.post('/import-raw', express.text({ type: '*/*', limit: '5mb' }), (req, res) => {
  const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const { recipe, warnings, format } = parseRaw(text);
  res.json({ recipe, warnings, format });
});

module.exports = router;
