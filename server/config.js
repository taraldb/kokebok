const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const RECIPES_JSON_DIR = process.env.RECIPES_DIR || path.join(DATA_DIR, 'recipes');
const DB_PATH = path.join(DATA_DIR, 'kokebok.db');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TEMPLATE_PATH = path.join(__dirname, 'prerender', 'template.js');

module.exports = { DATA_DIR, RECIPES_JSON_DIR, DB_PATH, PUBLIC_DIR, TEMPLATE_PATH };
