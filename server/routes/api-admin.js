const express = require('express');
const { prerenderAll, computeTemplateHash } = require('../prerender/index');
const { setTemplateHash } = require('../db/recipes');

const router = express.Router();

router.post('/rerender-all', (_req, res) => {
  const { count, ms } = prerenderAll();
  setTemplateHash(computeTemplateHash());
  res.json({ ok: true, count, ms });
});

module.exports = router;
