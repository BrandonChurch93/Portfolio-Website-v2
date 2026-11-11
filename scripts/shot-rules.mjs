// The rules of the shot gate, shared by shots.mjs, strips.mjs, verdict.mjs, critic-list.mjs and check-shots.mjs.
// kit/07-QUALITY-BAR.md explains every rule in words. After Phase 0 this file changes only when an addendum says so.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ---- viewports ---------------------------------------------------------------------------------

export const VIEWPORTS = {
  phone: { width: 390, height: 844, scale: 3, touch: true },
  tablet: { width: 834, height: 1194, scale: 2, touch: true },
  desktop: { width: 1440, height: 900, scale: 2, touch: false },
  wide: { width: 1920, height: 1080, scale: 1, touch: false },
  '4k': { width: 3840, height: 2160, scale: 1, touch: false },
};
export const VPS = Object.keys(VIEWPORTS);

// ---- which shots must exist --------------------------------------------------------------------

const range = (base, n) => Array.from({ length: n }, (_, i) => `${base}-${i + 1}`);
const pieceSet = (p) => [`${p}/form`, ...range(`${p}/close`, 6), `${p}/light`, `${p}/light-2`, `${p}/making`, `${p}/rest-desktop`, `${p}/rest-phone`, `${p}/entrance`];
export const PAGE_ROUTES = ['work', 'project', 'clients', 'games', 'photography', '3d-art', 'skills', 'about', 'resume', 'notfound'];
export const HOME_SECTIONS = ['hero', 'work', 'clients', 'skills', 'rooms', 'about', 'contact'];

const REQUIRED_BY_GROUP = {
  ref: ['ref/second-pass-desktop', 'ref/second-pass-phone', 'ref/third-pass-desktop', 'ref/third-pass-phone'],
  metal: [
    ...range('metal/aged-lamp', 3), ...range('metal/polished-lamp', 3), ...range('metal/bronze-lamp', 3), ...range('metal/panel-lamp', 3),
    'metal/text-1x', 'metal/text-2x', ...range('metal/window-lamp', 3), 'metal/window-video', 'metal/bar', 'metal/placard', 'metal/controls',
    'metal/phone', 'metal/lamp-strip',
  ],
  water: ['water/body', ...['run', 'fall', 'land', 'cling', 'pour', 'split', 'frame', 'pool'].map((m) => `water/${m}`), 'water/light-plate'],
  city: ['city/form', ...range('city/close', 6), 'city/materials', 'city/light', 'city/light-2', 'city/making', ...VPS.map((v) => `city/rest-${v}`), 'city/opening-desktop', 'city/opening-phone', 'city/settle'],
  bench: ['bench/form', ...range('bench/close', 6), 'bench/light', 'bench/light-2', 'bench/making', 'bench/rest-desktop', 'bench/rest-phone', 'bench/entrance', 'bench/water'],
  handheld: pieceSet('handheld'),
  camera: pieceSet('camera'),
  sculpture: pieceSet('sculpture'),
  rocket: [...pieceSet('rocket'), 'rocket/assembly', 'rocket/launch'],
  home: [...HOME_SECTIONS.flatMap((s) => VPS.map((v) => `home/${s}-${v}`)), 'home/scroll-desktop', 'home/scroll-phone'],
  page: PAGE_ROUTES.flatMap((r) => VPS.map((v) => `page/${r}-${v}`)),
  tier: ['tier/hero-mid', 'tier/hero-low', 'tier/hero-static', 'tier/room-mid', 'tier/room-low', 'tier/room-static'],
};

export const GROUP_COUNTS = { ref: 4, metal: 23, water: 10, city: 19, bench: 14, handheld: 13, camera: 13, sculpture: 13, rocket: 15, home: 37, page: 50, tier: 6 };
export const GROUPS = Object.keys(GROUP_COUNTS);
export const REQUIRED = Object.values(REQUIRED_BY_GROUP).flat();

// The pieces, metal and water: a critic PASS, or your own PASS after critic verdicts from three different rounds.
export const CRITIC_GROUPS = ['metal', 'water', 'city', 'bench', 'handheld', 'camera', 'rocket', 'sculpture'];
export const CRITIC_ROUNDS = 3;
// home and page: the -desktop and -phone shots need at least one critic verdict on any image.
export const PAGE_GROUPS = ['home', 'page'];
// ref and tier: your own PASS is enough. ref shots come from no build.
export const OWN_GROUPS = ['ref', 'tier'];
export const NO_BUILD_GROUPS = ['ref'];

// A critic's PASS on these counts only when the critic was given this reference image beside the shot.
export const REFERENCES = {
  'city/rest-desktop': 'kit/reference/hero-city/rest-lamp-center.jpg',
  'city/opening-desktop': 'kit/reference/hero-city/opening-strip.jpg',
  'bench/rest-desktop': 'kit/reference/workbench/fixed-light-brandons-favorite.jpg',
  'metal/aged-lamp-1': 'shots/ref/second-pass-desktop.jpg',
  'metal/window-lamp-1': 'shots/ref/third-pass-desktop.jpg',
  'water/body': 'shots/ref/second-pass-desktop.jpg',
  'water/split': 'kit/reference/third-pass/shot-cascade-and-photo-window.jpg',
};

// ---- names, files and hashes -------------------------------------------------------------------

export const groupOf = (name) => name.split('/')[0];
export const nameOf = (text) => text.trim().replace(/^`|`$/g, '').replace(/^\.\//, '').replace(/^shots\//, '').replace(/\.jpg$/, '');
export const fileOf = (name, shots = {}) => (shots[name] && shots[name].out) || `shots/${name}.jpg`;
export const sha12 = (buffer) => crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 12);
export const shaOfFile = (file) => (fs.existsSync(file) ? sha12(fs.readFileSync(file)) : null);

// ---- the verdict line --------------------------------------------------------------------------

// <shot name or image path> | sha: <hash> | reference: <path> | PASS or FAIL | <fail ids or -> | <one sentence>
// The sha and reference cells are optional in your own verdict files. A critic's line must carry the sha it was given.
export function parseLine(raw) {
  const cells = raw.replace(/^[\s>*-]+/, '').split('|').map((c) => c.trim());
  if (cells.length < 4 || !cells[0]) return null;
  const out = { name: nameOf(cells[0]), sha: '', reference: '' };
  let i = 1;
  for (; i < cells.length; i++) {
    const sha = /^sha:\s*([0-9a-f]{12})$/i.exec(cells[i]);
    const ref = /^reference:\s*(\S+)$/i.exec(cells[i]);
    if (sha) out.sha = sha[1].toLowerCase(); else if (ref) out.reference = ref[1]; else break;
  }
  const result = (cells[i] || '').toUpperCase();
  if (!['PASS', 'FAIL'].includes(result) || cells.length < i + 3) return null;
  const ids = cells[i + 1];
  return { ...out, result, ids: ids === '-' || ids === '' ? [] : ids.split(/[\s,]+/).filter(Boolean), note: cells.slice(i + 2).join(' | ') };
}

export const LEDGER = 'kit/VERDICTS.jsonl';
export function readLedger() {
  if (!fs.existsSync(LEDGER)) return [];
  return fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// A critic verdict in the ledger counts only when the critic's saved answer still holds that very line.
const answers = new Map();
export function backedByAnswer(v) {
  if (v.who !== 'critic' || !v.source || !/^kit\/critics\/\d{3}\.txt$/.test(v.source) || !fs.existsSync(v.source)) return false;
  if (!answers.has(v.source)) answers.set(v.source, fs.readFileSync(v.source, 'utf8').split('\n').map(parseLine).filter(Boolean));
  return answers.get(v.source).some((l) => l.name === v.shot && l.sha === v.sha && l.result === v.result);
}

// ---- which build is in out/ --------------------------------------------------------------------

// The build id is a hash of the sources, not of the output, because Next.js output is not identical between builds.
export const SOURCE_DIRS = ['src', 'public'];
export const SOURCE_FILES = ['package-lock.json', 'next.config.ts'];
export const SOURCE_SKIP = [path.join('public', 'generated')];
export const OUT = 'out';
export const STAMP = path.join(OUT, '.source-id');
export const MANIFEST = 'shots/manifest.json';

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (SOURCE_SKIP.some((s) => full === s || full.startsWith(s + path.sep))) continue;
    if (name === '.DS_Store') continue;
    if (fs.statSync(full).isDirectory()) out.push(...files(full)); else out.push(full);
  }
  return out;
}

export function sourceId() {
  const hash = crypto.createHash('sha1');
  for (const file of [...SOURCE_DIRS.flatMap(files), ...SOURCE_FILES.filter((f) => fs.existsSync(f))]) {
    hash.update(file.split(path.sep).join('/'));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

// The id the build in out/ was made from, written by scripts/stamp-build.mjs right after next build.
export function builtId() {
  if (!fs.existsSync(path.join(OUT, 'index.html')) || !fs.existsSync(STAMP)) return 'none';
  return fs.readFileSync(STAMP, 'utf8').trim();
}

// True when out/ is missing or was built from other sources than the ones on disk now.
export function distIsStale() {
  return builtId() !== sourceId();
}

export function buildId() {
  return sourceId();
}

export function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return {}; }
}

export function writeManifest(manifest) {
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);
}

// ---- self check --------------------------------------------------------------------------------

for (const group of GROUPS) {
  const have = REQUIRED.filter((n) => groupOf(n) === group).length;
  if (have !== GROUP_COUNTS[group]) throw new Error(`shot-rules: group ${group} builds ${have} names but ${GROUP_COUNTS[group]} are required by kit/07-QUALITY-BAR.md.`);
}
if (new Set(REQUIRED).size !== REQUIRED.length) throw new Error('shot-rules: a required name appears twice');
