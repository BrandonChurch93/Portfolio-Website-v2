// Copies Brandon's current portfolio into old-site/ so the build can use its images and facts.
// It only reads the old folder. Run it with no arguments: node scripts/import-old-site.mjs
// A path on the command line would make Claude Code ask for approval, so the path comes from here or from
// kit/old-site-path.txt (one line, the full path), never from an argument.
// Exit codes: 0 copied, 2 the old site was not found.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'old-site');
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.vercel', '.turbo', '.cache', 'coverage']);
const MEDIA = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg', '.ico', '.mp4', '.webm', '.mov', '.pdf']);
const TEXT = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.html', '.md', '.mdx', '.json', '.css', '.scss', '.txt']);
const MAX_MEDIA = 300 * 1024 * 1024;
const MAX_TEXT = 400 * 1024;
const NAME = /brandon[\s._-]*church[\s._-]*portfolio/i;

const denied = [];
function listDirs(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.') && !SKIP.has(d.name)); }
  catch (e) { if (e && (e.code === 'EPERM' || e.code === 'EACCES')) denied.push(dir); return []; }
}

function findOldSite() {
  const hint = path.join(ROOT, 'kit', 'old-site-path.txt');
  if (fs.existsSync(hint)) {
    const p = fs.readFileSync(hint, 'utf8').trim().replace(/^~(?=\/|$)/, os.homedir());
    if (p && fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  }
  const start = path.join(os.homedir(), 'Desktop');
  const found = [];
  const walk = (dir, depth) => {
    for (const d of listDirs(dir)) {
      const full = path.join(dir, d.name);
      if (path.resolve(full) === path.resolve(ROOT)) continue;
      if (NAME.test(d.name)) found.push(full);
      else if (depth < 4) walk(full, depth + 1);
    }
  };
  walk(start, 0);
  if (!found.length) return null;
  found.sort((a, b) => (/production/i.test(b) ? 1 : 0) - (/production/i.test(a) ? 1 : 0) || a.length - b.length);
  return found[0];
}

const src = findOldSite();
if (!src) {
  console.log('NOT FOUND: no folder matching "Brandon Church portfolio" under ~/Desktop (4 levels). Write the full path into kit/old-site-path.txt and run again.');
  if (denied.length) console.log('NO ACCESS to: ' + denied.join(', ') + '. macOS may be blocking this app from the Desktop folder. Log this under Needed from Brandon.');
  process.exit(2);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
const skipped = [];
const copyTree = (dir) => {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name) && e.name !== '.DS_Store') copyTree(full); continue; }
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    const kind = MEDIA.has(ext) ? 'media' : TEXT.has(ext) ? 'text' : null;
    if (!kind || e.name === 'package-lock.json') continue;
    const bytes = fs.statSync(full).size;
    const rel = path.relative(src, full);
    if (bytes > (kind === 'media' ? MAX_MEDIA : MAX_TEXT)) { skipped.push({ path: rel, bytes, why: 'too large' }); continue; }
    const dest = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(full, dest);
    manifest.push({ path: rel.split(path.sep).join('/'), bytes, kind, ext });
  }
};
copyTree(src);
manifest.sort((a, b) => a.path.localeCompare(b.path));
fs.writeFileSync(path.join(OUT, 'MANIFEST.json'), JSON.stringify({ source: src, copiedAt: new Date().toISOString(), files: manifest, skipped }, null, 2));
const media = manifest.filter((f) => f.kind === 'media').length;
console.log(`COPIED from ${src}`);
console.log(`${manifest.length} files (${media} media, ${manifest.length - media} text), ${skipped.length} skipped. See old-site/MANIFEST.json`);
