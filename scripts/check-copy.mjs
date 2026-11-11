// Fails on copy and style rule breaks (kit/05-CONTENT.md, Checks; kit/01-PRODUCT.md, Voice).
//
//   node scripts/check-copy.mjs
//
// Scans every text file under src/ and scripts/, and the visible text of every built page in out/ when it exists.
// Fails on: an em dash anywhere; an exclamation point in copy (the content file's strings and the pages' visible text);
// pure #000000 or #ffffff (or #000, #fff) in styles (CSS and TSX); a banned word; a model version string; the word
// boudoir anywhere a visitor could read it; the site name hardcoded in application code.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { SITE_NAME } from '../src/config/site.ts';

const TEXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html', '.json', '.svg', '.txt', '.md', '.webmanifest', '.xml']);
const BANNED = [/\bpassionate\b/i, /\bleverag(e|es|ed|ing)\b/i, /\bsolutions?\b/i, /\bresults[\s-]driven\b/i, /\bworld[\s-]class\b/i, /\bboudoir\b/i];
// Model names followed by a version: "Opus 4", "claude-haiku-4-5", "GPT-4o", "Gemini 2.5", "Llama 3".
const MODEL_VERSION = /\b(?:claude[\s-]+(?:opus|sonnet|haiku)?[\s-]*\d|(?:opus|sonnet|haiku)[\s-]*\d|gpt[\s-]*\d|gemini[\s-]*\d|llama[\s-]*\d|mistral[\s-]*\d|o[134][\s-]?(?:mini|pro)\b)/i;
const EM_DASH = new RegExp(String.fromCharCode(8212), 'g');
const EM_DASH_HTML = new RegExp(String.fromCharCode(8212) + '|&mdash;|&#8212;', 'g');
const BLACK_WHITE = /#(?:000000|ffffff|000|fff)(?![0-9a-f])/gi;

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return fs.statSync(p).isDirectory() ? files(p) : [p];
  });
}

const problems = [];
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Source files.
const sources = [...files('src'), ...files('scripts')].filter((f) => TEXT.has(path.extname(f).toLowerCase()));
for (const file of sources) {
  const rel = file.split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(EM_DASH)) problems.push(`${rel}:${lineOf(text, m.index)}: em dash`);
  if (rel === 'scripts/check-copy.mjs') continue;
  if (/\.(css|tsx)$/.test(rel)) for (const m of text.matchAll(BLACK_WHITE)) problems.push(`${rel}:${lineOf(text, m.index)}: pure black or white ${m[0]}`);
  if (rel.startsWith('src/content/')) {
    // Only the strings in the content file are copy.
    for (const m of text.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      const s = m[2];
      if (s.includes('!')) problems.push(`${rel}:${lineOf(text, m.index)}: exclamation point in copy`);
      for (const b of BANNED) if (b.test(s)) problems.push(`${rel}:${lineOf(text, m.index)}: banned word ${b.source}`);
      if (MODEL_VERSION.test(s)) problems.push(`${rel}:${lineOf(text, m.index)}: model version string "${s.match(MODEL_VERSION)[0]}"`);
    }
  }
  const appCode = rel.startsWith('src/') && !rel.startsWith('src/content/') && rel !== 'src/config/site.ts';
  if (appCode && text.includes(SITE_NAME)) problems.push(`${rel}: hardcodes the site name; import SITE_NAME`);
}

// Built pages: what a visitor can read.
const pages = files('out').filter((f) => f.endsWith('.html'));
const visible = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+?(?:alt|aria-label|title|content)="([^"]*)"[^>]*>/gi, ' $1 ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ');
for (const file of pages) {
  const rel = file.split(path.sep).join('/');
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(EM_DASH_HTML)) problems.push(`${rel}: em dash in the page at ${m.index}`);
  const text = visible(html);
  for (const m of text.matchAll(/[^\s]{0,30}!(?!=)[^\s]{0,30}/g)) problems.push(`${rel}: exclamation point in visible text: "${m[0]}"`);
  for (const b of BANNED) { const m = text.match(b); if (m) problems.push(`${rel}: banned word "${m[0]}"`); }
  const mv = text.match(MODEL_VERSION);
  if (mv) problems.push(`${rel}: model version string "${mv[0]}"`);
}

console.log(`check:copy · source files: ${sources.length} · pages: ${pages.length} · problems: ${problems.length}`);
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
