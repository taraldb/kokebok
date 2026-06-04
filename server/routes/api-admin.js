const express = require('express');
const { prerenderAll, computeTemplateHash } = require('../prerender/index');
const { setTemplateHash } = require('../db/recipes');
const { parseRaw } = require('../lib/parse-raw');

const router = express.Router();

router.post('/rerender-all', (_req, res) => {
  const { count, ms } = prerenderAll();
  setTemplateHash(computeTemplateHash());
  res.json({ ok: true, count, ms });
});

// POST /api/admin/import-raw — preview only, does not save
router.post('/import-raw', express.text({ type: '*/*', limit: '5mb' }), (req, res) => {
  const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const { recipe, warnings, format } = parseRaw(text);
  res.json({ recipe, warnings, format });
});

module.exports = router;
