const fs = require('fs');
const path = require('path');
const { getDb } = require('./index');

function migrate() {
  const db = getDb();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
}

module.exports = { migrate };
