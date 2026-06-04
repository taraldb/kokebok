#!/usr/bin/env node
const { migrate } = require('../db/migrate');
const { prerenderAll, computeTemplateHash } = require('../prerender/index');
const { setTemplateHash } = require('../db/recipes');

migrate();
const { count, ms } = prerenderAll();
setTemplateHash(computeTemplateHash());
console.log(`Prerendered ${count} recipes in ${ms}ms`);
