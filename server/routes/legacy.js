const express = require('express');

const router = express.Router();

// Legacy URL redirects — filled in M10
// GET /recipe.html?id=X → 301 /r/X
router.get('/recipe.html', (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send('Missing id');
  res.redirect(301, `/r/${id}`);
});

module.exports = router;
