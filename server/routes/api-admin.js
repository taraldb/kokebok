const express = require('express');

const router = express.Router();

// POST /api/admin/rerender-all — body filled in M5
router.post('/rerender-all', async (_req, res) => {
  res.json({ ok: true, count: 0, ms: 0, note: 'Prerender not yet implemented (M5)' });
});

module.exports = router;
