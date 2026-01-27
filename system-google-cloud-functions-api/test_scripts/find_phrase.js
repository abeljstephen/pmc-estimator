#!/usr/bin/env node
/**
 * find_phrase.js — prints a table of matches: file, line, col, snippet
 * Usage: node test_scripts/find_phrase.js "<phrase>" [root=.]
 */
const fs = require('fs');
const path = require('path');

const phrase = process.argv[2];
const root = process.argv[3] || '.';
if (!phrase) {
  console.error('Usage: find_phrase.js "<phrase>" [root=.]\nExample: node test_scripts/find_phrase.js "find_phrase.sh.092020251040PMPST"');
  process.exit(1);
}

const ignore = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.turbo']);

function* walk(dir) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const ent of ents) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!ignore.has(ent.name)) yield* walk(p);
    } else if (ent.isFile()) {
      yield p;
    }
  }
}

const rows = [];
for (const file of walk(root)) {
  let data;
  try { data = fs.readFileSync(file, 'utf8'); } catch { continue; } // skip binaries
  const lines = data.split(/\r?\n/);
  lines.forEach((line, i) => {
    let start = 0, idx;
    while ((idx = line.indexOf(phrase, start)) !== -1) {
      const snippet = line.length > 200 ? line.slice(0, 200) + '…' : line;
      rows.push({ '#': rows.length + 1, file, line: i + 1, col: idx + 1, snippet });
      start = idx + phrase.length;
    }
  });
}

if (!rows.length) {
  console.log('No matches.');
} else {
  console.table(rows);
}

