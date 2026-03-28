// tools/phrase-map.js
// Usage: node tools/phrase-map.js "phrase 1" "phrase 2" --root=.
// Outputs CSV with columns: Path,Type,File Line Number
// - Type is ONLY "Directory Name" or "File Name" when the phrase matches the name.
// - File Line Number is filled only for content matches; Type left blank in that case.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const phrases = args.filter(a => !a.startsWith('--') && a.trim().length > 0);
const rootArg = args.find(a => a.startsWith('--root='));
const ROOT = rootArg ? rootArg.split('=')[1] : process.cwd();

if (!phrases.length) {
  console.error('Provide at least one phrase. Example:\n  node tools/phrase-map.js "missing sliders" --root=.');
  process.exit(1);
}

// Folders to skip
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.idea', '.vscode', '.cache']);
// Treat these as text; add more as needed
const TEXT_EXTS = new Set([
  '.js','.ts','.tsx','.jsx','.json','.md','.txt','.yml','.yaml','.html','.css','.scss',
  '.gs','.java','.py','.rb','.go','.cpp','.cc','.c','.h','.hpp','.sh'
]);

function isProbablyTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTS.has(ext)) return true;
  // fallback: small files without binary bytes
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 2_000_000) return false; // >2MB: skip
    const buf = fs.readFileSync(filePath);
    // if it contains many NUL bytes, assume binary
    const nul = buf.slice(0, 8000).includes(0);
    return !nul;
  } catch {
    return false;
  }
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield path.join(dir, e.name);
      yield* walk(path.join(dir, e.name));
    } else if (e.isFile()) {
      yield path.join(dir, e.name);
    }
  }
}

function anyMatch(haystack, needles) {
  const s = haystack.toLowerCase();
  return needles.some(p => s.includes(p.toLowerCase()));
}

// Print CSV header
process.stdout.write('Path,Type,File Line Number\n');

for (const entry of walk(ROOT)) {
  const rel = path.relative(ROOT, entry) || entry;

  // Directory-name matches
  if (fs.existsSync(entry) && fs.statSync(entry).isDirectory()) {
    if (anyMatch(path.basename(entry), phrases)) {
      process.stdout.write(`"${rel.replace(/"/g,'""')}","Directory Name",""\n`);
    }
    continue;
  }

  // File-name matches
  if (anyMatch(path.basename(entry), phrases)) {
    process.stdout.write(`"${rel.replace(/"/g,'""')}","File Name",""\n`);
  }

  // File-content matches (Type left blank; line number set)
  if (!isProbablyTextFile(entry)) continue;

  let text;
  try {
    text = fs.readFileSync(entry, 'utf8');
  } catch {
    continue; // unreadable
  }

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (anyMatch(lines[i], phrases)) {
      // For content matches, Type column is intentionally blank per your spec,
      // and File Line Number is populated.
      process.stdout.write(`"${rel.replace(/"/g,'""')}","",${i + 1}\n`);
    }
  }
}

