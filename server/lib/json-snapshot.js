const fs = require('fs');
const path = require('path');
const { RECIPES_JSON_DIR } = require('../config');

function writeJsonSnapshot(id, data) {
  if (!fs.existsSync(RECIPES_JSON_DIR)) fs.mkdirSync(RECIPES_JSON_DIR, { recursive: true });
  const filePath = path.join(RECIPES_JSON_DIR, `${id}.json`);
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

module.exports = { writeJsonSnapshot };
