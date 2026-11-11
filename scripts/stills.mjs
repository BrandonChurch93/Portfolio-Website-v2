// Renders the pictures the site shows of itself before WebGL starts: the city at rest and the plan drawn in light
// (the first look of the opening), wide and tall, from the real home page. Writes WebP into public/generated/.
//
//   node scripts/stills.mjs
//
// Run before a gate's build, never during shots. public/generated/ is left out of the build id, so new stills do
// not make every shot stale; the script rebuilds out/ afterwards so the stills are in it.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { HERO, LAMP } from '../src/config/site.ts';
import { buildIfStale, hook, openBrowser, openSite, startPreview } from './shots.mjs';

const OUT = 'public/generated';
const SIZES = { wide: { vp: 'desktop', width: 1440, height: 900, scale: 1 }, tall: { vp: 'phone', width: 390, height: 844, scale: 2 } };
const KINDS = {
  city: [['freeze', 30], ['lamp', LAMP.drift.cx, LAMP.drift.cy]],
  plan: [['freeze', 30], ['lamp', LAMP.drift.cx, LAMP.drift.cy], ['opening', HERO.planStillAt]],
};
const fileOf = (kind, size) => path.join('public', HERO.stills[kind][size]);

buildIfStale();
fs.mkdirSync(OUT, { recursive: true });
const { browser } = await openBrowser({});
const preview = await startPreview();
try {
  for (const [size, s] of Object.entries(SIZES)) {
    for (const [kind, steps] of Object.entries(KINDS)) {
      const page = await openSite(browser, preview, { route: '/', vp: s.vp, width: s.width, height: s.height, scale: s.scale, steps }, [], '');
      // Only the city: no nav, no words, no switch, no earlier still.
      await page.addStyleTag({ content: 'header, [data-water-avoid], [data-piece] button, [data-piece] picture, .piece-stats { visibility: hidden !important; }' });
      await hook(page, 'settle', []);
      const box = await page.evaluate(() => { const r = document.getElementById('hero').getBoundingClientRect(); return { x: r.left, y: Math.max(0, r.top), width: r.width, height: Math.min(r.height, innerHeight) }; });
      const png = await page.screenshot({ type: 'png', clip: box });
      const out = fileOf(kind, size);
      await sharp(png).resize({ width: s.width * Math.min(2, s.scale) }).webp({ quality: 80 }).toFile(out);
      console.log(`still: ${out} · ${fs.statSync(out).size} bytes`);
      await page.close();
    }
  }
} finally {
  await preview.stop();
  await browser.close();
}
// The share images come from the same stills (kit 06: the site's own pictures are written here, before the build).
execFileSync('node', ['scripts/og.mjs'], { stdio: 'inherit' });
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
